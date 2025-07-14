import dotenv from 'dotenv';
dotenv.config();

import express from "express";
const app = express(); 
import mongoose from "mongoose";
import path from "path";
import cookieParser from "cookie-parser";
import methodOverride from "method-override";
import setCurrentUser from "./middlewares/setCurrentuser.js";
import User from "./modals/UserModal.js";
import Contact from "./modals/contactModal.js";
import { Server } from "socket.io";
import Message from "./modals/Message.js";
import http from "http";
import authRoutes from "./routes/auth.js";
import homeRoute from "./routes/home.js";
import client from "./redisClient.js";
import { cloudinary } from "./ cloudConfig.js"
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { fileURLToPath } from "url";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  await mongoose.connect("mongodb://localhost:27017/harborchat");
  console.log("connected to mongodb");
}
main().catch((err) => {
  console.log("error connecting to mongodb", err);
});
app.use(methodOverride("_method"));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("views", express.static(path.join(__dirname, "views")));
app.set("view engine", "ejs");
app.use(setCurrentUser);

const server = http.createServer(app);
const io = new Server(server);

app.use("/auth", authRoutes);
app.use("/", homeRoute);

const pubClient = createClient({
  url: "redis://default:myStrongRedisPass123@localhost:6379",
});
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
  console.log("✅ Socket.IO Redis adapter enabled");
});
console.log("Cloudinary config:", cloudinary.config());


const users = {}; // (optional, can remove)
// const onlineUsers = new Map(); // REMOVE
const userContacts = new Map(); // keep for now, or move to Redis for full scaling
// --- Track which chat each user currently has open ---
const currentOpenChats = new Map();

io.on("connection", (socket) => {
  console.log("🟢 New client connected:", socket.id);
  let userId = null;

  // Step 1: Store userId with socket
  socket.on("join", async (id) => {
    userId = id;
    users[id] = socket.id; // (optional, can remove)
    // onlineUsers.set(userId, socket.id); // REMOVE
    await client.set(`online:${userId}`, socket.id);
    socket.join(id);
    const contacts = await Contact.find({ userId: id }).select(
      "contactId unreadCount"
    );
    const contactIds = contacts.map((c) => c.contactId.toString());
    userContacts.set(userId, contactIds);

    // Send the list of online contacts to the user who just joined
    const onlineContactIds = [];
    for (const contactId of contactIds) {
      const contactSocketId = await client.get(`online:${contactId}`);
      if (contactSocketId) onlineContactIds.push(contactId);
    }
    socket.emit("online-contacts", onlineContactIds);

    // Send unread counts for all contacts
    const unreadCounts = {};
    contacts.forEach((c) => {
      unreadCounts[c.contactId.toString()] = c.unreadCount || 0;
    });
    socket.emit("unread-counts", unreadCounts);

    // Notify contacts that this user is online
    for (const contactId of contactIds) {
      const contactSocketId = await client.get(`online:${contactId}`);
      if (contactSocketId) {
        io.to(contactSocketId).emit("user-online", userId);
      }
    }
    console.log(`User ${id} joined room ${id}`);
  });

  // Track which chat the user has open
  socket.on("chat-open", async ({ userId, contactId }) => {
    if (userId && contactId) {
      // Store in Redis instead of local Map for multi-server
      await client.set(`openchat:${userId}`, contactId, { EX: 600 }); // 10 min expiry
    }
  });

  socket.on("chat message", async ({ senderId, receiverId,encryptedMessage ,status, encryptedKeys,iv,messageId }) => {

    // Debug: show which rooms this socket is in
    console.log("🔍 Socket Rooms:", socket.rooms);
    // console.log(senderId)
    const sender = await User.findById(senderId).select("name phoneNo");
    console.log(sender);
    //    console.log(sender)
    const senderPhone = sender ? sender.phoneNo : "";

    // unread messages...............................

    // Only increment unreadCount if receiver is NOT currently viewing this chat
    const openChat = await client.get(`openchat:${receiverId}`);
    const isChatOpen = openChat === senderId;
    if (!isChatOpen) {
      await Contact.updateOne(
        { userId: receiverId, contactId: senderId },
        { $inc: { unreadCount: 1 } }
      );

      // Only send notification if chat is NOT open
      const socketId = await client.get(`online:${receiverId}`);
      if (socketId) {
        const sender = await User.findById(senderId).select("name");
        io.to(socketId).emit("notify-new-message", {
          from: sender.name,
          message: "🔐 Encrypted message",
          type: "text",
        });
      }
    } else {
      // If chat is open, ensure unreadCount is 0 (defensive)
      await Contact.updateOne(
        { userId: receiverId, contactId: senderId },
        { $set: { unreadCount: 0 } }
      );
    }
    const saveMessage = {
    _id: messageId,
    senderId,
    receiverId,
    message: encryptedMessage,
    encryptedKeys,
    iv,
    type : "text",
    status,
    senderPhone,
    timestamp: new Date(),
  };


    await Contact.updateOne(
      { userId: senderId, contactId: receiverId },
      { $set: { messageTime: new Date() } }
    );

    await Contact.updateOne(
      { userId: receiverId, contactId: senderId },
      { $set: { messageTime: new Date() } }
    );

    const ids = [senderId, receiverId].sort();
    const cacheKey = `chat:${ids[0]}:${ids[1]}`;

    let cached = await client.get(cacheKey);
    let messages = cached ? JSON.parse(cached) : [];

    messages.push(saveMessage);

    // 5. Keep only latest 30 messages
    if (messages.length > 30) {
      messages = messages.slice(-30);
    }

    await client.set(cacheKey, JSON.stringify(messages), { EX: 300 });

    // Emit the message to the sender (with 'sent' status)
    io.to(senderId).emit("chat message", saveMessage);

    // Emit the message to the receiver (with 'delivered' status)
    const deliveredMessage = {
      ...saveMessage,
      status: "delivered",
    };
    io.to(receiverId).emit("chat message", deliveredMessage);
    // Removed duplicate notification emit here
    // Update status in DB to 'delivered' when delivered to receiver
    await Message.findByIdAndUpdate(messageId, { status: "delivered" });

    // Update status in Redis cache to 'delivered' for this message
    let updatedMessages = messages.map((msg) => {
      if (msg._id && msg._id.toString() === messageId.toString()) {
        return { ...msg, status: "delivered" };
      }
      return msg;
    });
    await client.set(cacheKey, JSON.stringify(updatedMessages), { EX: 300 });

    // Emit 'message-delivered' to sender for real-time double tick
    io.to(senderId).emit("message-delivered", { messageId });
  });

  socket.on(
    "image-message",
    async ({ senderId, receiverId, mediaUrls,iv,encryptedKeys,fileType,messageId, status ,type,caption = "" }) => {
      try {
        // // Upload image to Cloudinary
        // const uploadRes = await cloudinary.uploader.upload(image, {
        //   folder: "harborchat/images",
        //   resource_type: "image",
        // });

        // const imageUrl = uploadRes.secure_url;

        // Save to MongoDB
        // const newImageMessage = await Message.create({
        //   senderId,
        //   receiverId,
        //   type: "image",
        //   message: caption,
        //   mediaUrls: [imageUrl],
        //   status: "sent",
        //   timestamp: new Date(),
        // });
        const sender = await User.findById(senderId).select("name phoneNo");
        console.log(sender);
        //    console.log(sender)
        const senderPhone = sender ? sender.phoneNo : "";        

        const openChat = await client.get(`openchat:${receiverId}`);
        const isChatOpen = openChat === senderId;
        if (!isChatOpen) {
          await Contact.updateOne(
            { userId: receiverId, contactId: senderId },
            { $inc: { unreadCount: 1 } }
          );
          const sender = await User.findById(senderId).select("name");
          const socketId = await client.get(`online:${receiverId}`);
          if (socketId) {
            io.to(socketId).emit("notify-new-message", {
              from: sender.name,
              message: caption,
              type: "image",
            });
          }
        } else {
          // If chat is open, ensure unreadCount is 0 (defensive)
          await Contact.updateOne(
            { userId: receiverId, contactId: senderId },
            { $set: { unreadCount: 0 } }
          );
        }

       const savedImageObj = {
      _id: messageId,
      senderId,
      receiverId,
      type,
      mediaUrls,
      message:caption,
      iv,
      encryptedKeys,
      senderPhone,
      fileType,
      timestamp: new Date(),
      status,
    };

        // Convert to plain object for cache and emit
        // const savedImageObj = newImageMessage.toObject();

        // --- Redis cache logic (same as text) ---
        const ids = [senderId, receiverId].sort();
        const cacheKey = `chat:${ids[0]}:${ids[1]}`;

        let cached = await client.get(cacheKey);
        let messages = cached ? JSON.parse(cached) : [];

        messages.push(savedImageObj);

        // Keep only latest 30 messages
        if (messages.length > 30) {
          messages = messages.slice(-30);
        }

        await client.set(cacheKey, JSON.stringify(messages), { EX: 300 });

        // Emit to sender (status: sent)
        io.to(senderId).emit("chat message", savedImageObj);

        // Emit to receiver (status: delivered)
        const deliveredImage = { ...savedImageObj, status: "delivered" };
        io.to(receiverId).emit("chat message", deliveredImage);

        // Update status in DB to 'delivered'
        await Message.findByIdAndUpdate(messageId, {
          status: "delivered",
        });

        // Update status in Redis cache to 'delivered'
        let updatedMessages = messages.map((msg) => {
          if (
            msg._id &&
            msg._id.toString() === messageId.toString()
          ) {
            return { ...msg, status: "delivered" };
          }
          return msg;
        });
        await client.set(cacheKey, JSON.stringify(updatedMessages), {
          EX: 300,
        });

        // Emit 'message-delivered' to sender for real-time double tick
        io.to(senderId).emit("message-delivered", {
          messageId
        });
      } catch (err) {
        console.error("Image upload error:", err);
      }
    }
  );

  socket.on("audioMessage", async ({ audioUrl, senderId, receiverId }) => {
  try {
    // Save to MongoDB
    const newAudioMessage = await Message.create({
      senderId,
      receiverId,
      type: "audio",
      audioUrl,
      status: "sent",
      timestamp: new Date(),
    });

    // --- Redis cache logic (same as text/image) ---
    const ids = [senderId, receiverId].sort();
    const cacheKey = `chat:${ids[0]}:${ids[1]}`;

    let cached = await client.get(cacheKey);
    let messages = cached ? JSON.parse(cached) : [];

    messages.push(newAudioMessage.toObject());

    // Keep only latest 30 messages
    if (messages.length > 30) {
      messages = messages.slice(-30);
    }

    await client.set(cacheKey, JSON.stringify(messages), { EX: 300 });

    // Emit to sender (status: sent)
    io.to(senderId).emit("chat message", newAudioMessage.toObject());

    // Emit to receiver (status: delivered)
    const deliveredAudio = { ...newAudioMessage.toObject(), status: "delivered" };
    io.to(receiverId).emit("chat message", deliveredAudio);

    // Update status in DB to 'delivered'
    await Message.findByIdAndUpdate(newAudioMessage._id, { status: "delivered" });

    // Update status in Redis cache to 'delivered'
    let updatedMessages = messages.map((msg) => {
      if (msg._id && msg._id.toString() === newAudioMessage._id.toString()) {
        return { ...msg, status: "delivered" };
      }
      return msg;
    });
    await client.set(cacheKey, JSON.stringify(updatedMessages), { EX: 300 });

    // Emit 'message-delivered' to sender for real-time double tick
    io.to(senderId).emit("message-delivered", { messageId: newAudioMessage._id });

    // Optionally: notification logic (if chat not open)
    const openChat = await client.get(`openchat:${receiverId}`);
    const isChatOpen = openChat === senderId;
    if (!isChatOpen) {
      await Contact.updateOne(
        { userId: receiverId, contactId: senderId },
        { $inc: { unreadCount: 1 } }
      );
      const senderUser = await User.findById(senderId).select("name");
      const socketId = await client.get(`online:${receiverId}`);
      if (socketId) {
        io.to(socketId).emit("notify-new-message", {
          from: senderUser.name,
          message: "[Audio]",
          type: "audio",
        });
      }
    } else {
      // If chat is open, ensure unreadCount is 0 (defensive)
      await Contact.updateOne(
        { userId: receiverId, contactId: senderId },
        { $set: { unreadCount: 0 } }
      );
    }
  } catch (err) {
    console.error("Audio message error:", err);
  }
});



  // Listen for 'message-read' event from client when user opens chat
  socket.on("message-read", async ({ messageIds, readerId, receiverId }) => {
    // Ensure all IDs are strings for comparison
    const messageIdsStr = (messageIds || []).map((id) => id && id.toString());
    // Defensive: skip if no receiverId or readerId
    if (!receiverId || !readerId) {
      console.warn("Missing receiverId or readerId in message-read event");
      return;
    }
    // Update all messages to 'read' in DB
    if (messageIdsStr.length > 0) {
      await Message.updateMany(
        { _id: { $in: messageIdsStr } },
        { status: "read" }
      );
    }
    // Reset the unread message count for this chat
    await Contact.updateOne(
      { userId: readerId, contactId: receiverId },
      { $set: { unreadCount: 0 } }
    );
    // Notify sender(s) and receiver that their messages have been read
    const messages =
      messageIdsStr.length > 0
        ? await Message.find({ _id: { $in: messageIdsStr } })
        : [];
    const senderIds = new Set();
    messages.forEach((msg) => {
      senderIds.add(msg.senderId);
    });
    // Emit to all senders
    senderIds.forEach(async (senderId) => {
      const senderSocketId = await client.get(`online:${senderId}`);
      if (senderSocketId) {
        io.to(senderSocketId).emit("message-read", {
          messageIds: messageIdsStr,
          readerId,
        });
      }
    });
    // Also emit to the reader (so their own UI updates instantly)
    const readerSocketId = await client.get(`online:${readerId}`);
    if (readerSocketId) {
      io.to(readerSocketId).emit("message-read", {
        messageIds: messageIdsStr,
        readerId,
      });
    }
    // --- Redis cache update for read status ---
    // Find the chat cache key for each message and update status in Redis
    for (const msg of messages) {
      const ids = [msg.senderId.toString(), msg.receiverId.toString()].sort();
      const cacheKey = `chat:${ids[0]}:${ids[1]}`;
      let cached = await client.get(cacheKey);
      if (cached) {
        let cachedMessages = JSON.parse(cached);
        let updated = false;
        cachedMessages = cachedMessages.map((m) => {
          if (m._id && messageIdsStr.includes(m._id.toString())) {
            updated = true;
            return { ...m, status: "read" };
          }
          return m;
        });
        if (updated) {
          await client.set(cacheKey, JSON.stringify(cachedMessages), {
            EX: 300,
          });
        }
      }
    }
  });

  // --- TYPING INDICATOR (multi-server robust) ---
  // Store who is typing to whom in Redis for a short TTL
  // Key: typing:<senderId>:<receiverId> = 1 (EX 5)

  socket.on("typing", async ({ senderId, receiverId }) => {
    if (!senderId || !receiverId) return;
    // Mark typing in Redis (optional, for advanced anti-spam/UX)
    await client.set(`typing:${senderId}:${receiverId}`, 1, { EX: 5 });
    // Find receiver's socketId from Redis
    const receiverSocketId = await client.get(`online:${receiverId}`);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing", senderId);
    }
  });

  // Optionally, you can add a 'stop-typing' event for more accurate UX:
  socket.on("stop-typing", async ({ senderId, receiverId }) => {
    if (!senderId || !receiverId) return;
    await client.del(`typing:${senderId}:${receiverId}`);
    const receiverSocketId = await client.get(`online:${receiverId}`);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("stop-typing", senderId);
    }
  });

  socket.on("disconnect", async () => {
    console.log("user",userId)
    if (userId) {
      await client.del(`online:${userId}`);
      await client.del(`openchat:${userId}`); // Clean up open chat info in Redis
      // Notify only contacts that this user is offline
      const contactIds = userContacts.get(userId) || [];
      for (const contactId of contactIds) {
        const contactSocketId = await client.get(`online:${contactId}`);
        if (contactSocketId) {
          io.to(contactSocketId).emit("user-offline", userId);
        }
      }
      userContacts.delete(userId);
      // currentOpenChats.delete(userId); // Clean up open chat info
    }
    for (const uid in users) {
      if (users[uid] === socket.id) {
        delete users[uid];
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`))




app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack || err);
  res.status(500).json({ error: "Something went wrong", details: err.message });
});
