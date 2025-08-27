import dotenv from "dotenv";
dotenv.config();

import express from "express";
const app = express();
import mongoose from "mongoose";
import path from "path";
import cors from "cors";
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
import { cloudinary } from "./ cloudConfig.js";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { fileURLToPath } from "url";
import getReplySuggestions from "./Helpers/smartReply.js";
import { startConsumer } from "./kafkaConsumer.js";
import { connectProducer } from "./kafkaProducer.js";
// import { endCall } from "./public/js/main.js";

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

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
  })
);

const server = http.createServer(app);
// const io = new Server(server);
const io = new Server(server, {
  cors: {
    origin: "*", // OR restrict to: ["http://localhost:3000", "http://192.168.1.4:3000"]
    methods: ["GET", "POST"],
  },
});

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
    const ID = await client.set(`online:${userId}`, socket.id);
    console.log("Redis online set:", ID);
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

  // Step 2: Real-Time Group Creation
  socket.on("create-group", async ({ groupId, members }) => {
    // Notify all group members except the creator
    console.log("Group creation event:", { groupId, members });
    for (const member of members) {
      const userId = member.user; // Extract user ID from member object
      const memberSocketId = await client.get(`online:${userId}`);
      console.log("MemberSocketId", memberSocketId);
      if (memberSocketId) {
        // io.to(memberSocketId).emit("group-created", { groupId });
        io.emit("group-created", { groupId });

        console.log(`Notified ${userId} of new group ${groupId}`);
      }
    }
    console.log(`📢 Group ${groupId} created, notified members`);
  });

  // 🧩 Step 2: Add WebRTC signaling handlers

  socket.on("webrtc-offer", ({ to, offer }) => {
    console.log(`📡 Offer from ${userId} → ${to}`);
    io.to(to).emit("webrtc-offer", { from: userId, offer });
  });

  socket.on("webrtc-answer", ({ to, answer }) => {
    console.log(`📡 Answer from ${userId} → ${to}`);
    io.to(to).emit("webrtc-answer", { from: userId, answer });
  });

  socket.on("webrtc-ice-candidate", ({ to, candidate }) => {
    console.log(`📡 ICE candidate from ${userId} → ${to}`);
    io.to(to).emit("webrtc-ice-candidate", { from: userId, candidate });
  });
  socket.on("call-cancelled", ({ to }) => {
    const recipientSocketId = users[to];
    if (recipientSocketId) {
      console.log(`Call cancelled by ${userId}, notifying ${to}`);
      io.to(recipientSocketId).emit("call-cancelled", {
        from: userId,
      });
    }
  });

  socket.on("call-rejected", ({ to }) => {
    const recipientSocketId = users[to];
    if (recipientSocketId) {
      console.log(`Call from ${userId} rejected by ${to}`);
      io.to(recipientSocketId).emit("call-rejected", {
        from: userId,
      });
    }
  });

  socket.on("call-ended", ({ to }) => {
    const recipientSocketId = users[to];
    if (recipientSocketId) {
      console.log(`Call ended normally by ${userId}, notifying ${to}`);
      io.to(recipientSocketId).emit("call-ended", {
        from: userId,
      });
    }
  });

  // Track which chat the user has open
  socket.on("chat-open", async ({ userId, contactId }) => {
    if (userId && contactId) {
      // Store in Redis instead of local Map for multi-server
      await client.set(`openchat:${userId}`, contactId, { EX: 600 }); // 10 min expiry
    }
  });

  socket.on(
    "chat message",
    async ({
      senderId,
      receiverId,
      chatId,
      encryptedMessage,
      status,
      encryptedKeys,
      iv,
      messageId,
      isSecretChat,
      type,
      repliedTo,
    }) => {
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
      const expiresAt = Date.now() + 60000;
      const saveMessage = {
        _id: messageId,
        senderName: sender ? sender.name : "Unknown",
        senderId,
        receiverId,
        chatId,
        message: encryptedMessage,
        encryptedKeys,
        iv,
        type,
        status,
        isDeleted: false, // Default to false, can be updated later
        pinned: false, // Default to false, can be updated later
        senderPhone,
        isSecretChat,
        repliedTo: repliedTo
          ? {
              messageId: repliedTo.messageId,
              textSnippet: repliedTo.textSnippet,
              iv: repliedTo.iv,
              encryptedAESKeys: repliedTo.encryptedAESKeys,
              imageUrl: repliedTo.imageUrl,
            }
          : null,
        expiresAt,
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
      const cacheKey = `chat:${ids[0]}:${ids[1]}:${
        isSecretChat ? "secret" : "normal"
      }`;

      let cached = await client.get(cacheKey);
      let messages = cached ? JSON.parse(cached) : [];

      messages.push(saveMessage);

      // 5. Keep only latest 30 messages
      if (messages.length > 30) {
        messages = messages.slice(-30);
      }
      const ttl = isSecretChat ? 60 : 300;
      await client.set(cacheKey, JSON.stringify(messages), { EX: ttl });

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
      // await Message.findByIdAndUpdate(messageId, { status: "delivered" });

      // Update status in Redis cache to 'delivered' for this message
      let updatedMessages = messages.map((msg) => {
        if (msg._id && msg._id.toString() === messageId.toString()) {
          return { ...msg, status: "delivered" };
        }
        return msg;
      });
      await client.set(cacheKey, JSON.stringify(updatedMessages), { EX: ttl });

      // Emit 'message-delivered' to sender for real-time double tick
      io.to(senderId).emit("message-delivered", { messageId });
    }
  );

  socket.on(
    "requestReplySuggestion",
    async ({ messageId, messageText, from, to }) => {
      try {
        console.log("messageText", messageText);
        const suggestions = await getReplySuggestions(messageText);
        const socketId = await client.get(`online:${to}`);
        if (socketId) {
          io.to(socketId).emit("replySuggestions", {
            from,
            messageId,
            suggestions,
          });
        }
      } catch (e) {
        console.error("💥 AI suggestion error:", e.message);
      }
    }
  );

  socket.on("start-burn", async ({ messageId, userId, seconds = 10 }) => {
    try {
      // 1. Fetch the message
      const message = await Message.findById(messageId);
      if (!message) {
        console.warn(`⚠️ Message not found: ${messageId}`);
        return;
      }

      // 2. Ensure only the receiver can start the burn
      if (message.receiverId !== userId) {
        console.warn(`⛔ Unauthorized burn trigger attempt by ${userId}`);
        return;
      }

      // 3. Skip if already marked as read & burned
      if (message.receiverOpened) {
        console.log(`🔁 Burn already triggered for message ${messageId}`);
        return;
      }

      // 4. Set burn flags: receiverOpened + burnAfterRead + deleteAt
      const deleteAt = new Date(Date.now() + seconds * 1000);
      message.burnAfterRead = true;
      message.receiverOpened = true;
      message.deleteAt = deleteAt;

      await message.save();

      console.log(
        `🔥 Burn timer started for message ${messageId} (TTL ${seconds}s)`
      );
    } catch (err) {
      console.error("❌ Error starting burn timer:", err);
    }
  });

  socket.on(
    "image-message",
    async ({
      senderId,
      receiverId,
      mediaUrls,
      iv,
      encryptedKeys,
      fileType,
      messageId,
      status,
      type,
      caption = "",
      isSecretChat,
    }) => {
      try {
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
        const expiresAt = Date.now() + 60000;
        const savedImageObj = {
          _id: messageId,
          senderName: sender ? sender.name : "Unknown",
          senderId,
          receiverId,
          type,
          mediaUrls,
          message: caption,
          iv,
          encryptedKeys,
          senderPhone,
          isSecretChat,
          fileType,
          expiresAt,
          timestamp: new Date(),
          status,
        };

        // Convert to plain object for cache and emit
        // const savedImageObj = newImageMessage.toObject();

        // --- Redis cache logic (same as text) ---
        const ids = [senderId, receiverId].sort();
        const cacheKey = `chat:${ids[0]}:${ids[1]}:${
          isSecretChat ? "secret" : "normal"
        }`;

        let cached = await client.get(cacheKey);
        let messages = cached ? JSON.parse(cached) : [];

        messages.push(savedImageObj);

        // Keep only latest 30 messages
        if (messages.length > 30) {
          messages = messages.slice(-30);
        }

        const ttl = isSecretChat ? 60 : 300;
        await client.set(cacheKey, JSON.stringify(messages), { EX: ttl });

        // Emit to sender (status: sent)
        io.to(senderId).emit("chat message", savedImageObj);

        // Emit to receiver (status: delivered)
        const deliveredImage = { ...savedImageObj, status: "delivered" };
        io.to(receiverId).emit("chat message", deliveredImage);

        // Update status in DB to 'delivered'
        // await Message.findByIdAndUpdate(messageId, {
        //   status: "delivered",
        // });

        // Update status in Redis cache to 'delivered'
        let updatedMessages = messages.map((msg) => {
          if (msg._id && msg._id.toString() === messageId.toString()) {
            return { ...msg, status: "delivered" };
          }
          return msg;
        });
        await client.set(cacheKey, JSON.stringify(updatedMessages), {
          EX: ttl,
        });

        // Emit 'message-delivered' to sender for real-time double tick
        io.to(senderId).emit("message-delivered", {
          messageId,
        });
      } catch (err) {
        console.error("Image upload error:", err);
      }
    }
  );

  socket.on("deleteMessage", async ({ messageId, scope }) => {
    try {
      // Try MongoDB first
      let message = await Message.findOne({ _id: messageId });
      let fromRedisOnly = false;

      if (!message) {
        // Not in DB yet — check Redis cache
        const allKeys = await client.keys("chat:*"); // or smarter lookup by userId
        for (const key of allKeys) {
          const cached = await client.get(key);
          if (cached) {
            const msgs = JSON.parse(cached);
            const found = msgs.find((m) => m._id === messageId);
            if (found) {
              message = found;
              message.cacheKey = key;
              fromRedisOnly = true;
              break;
            }
          }
        }

        if (!message) {
          console.warn("Message not found in Redis or DB");
          return;
        }
      }

      const { senderId, receiverId, isSecretChat } = message;
      // const userId = socket.userId;
      const ids = [senderId, receiverId].sort();
      const cacheKey =
        message.cacheKey ||
        `chat:${ids[0]}:${ids[1]}:${isSecretChat ? "secret" : "normal"}`;
      let cached = await client.get(cacheKey);
      let messages = cached ? JSON.parse(cached) : [];

      if (scope === "me") {
        // Redis update
        messages = messages.filter((msg) => {
          if (msg._id === messageId) {
            msg.deletedFor = msg.deletedFor || [];
            if (!msg.deletedFor.includes(userId)) {
              msg.deletedFor.push(userId);
            }

            if (
              msg.deletedFor.includes(senderId) &&
              msg.deletedFor.includes(receiverId)
            ) {
              return false; // remove
            }
          }
          return true;
        });

        await client.set(cacheKey, JSON.stringify(messages), {
          EX: isSecretChat ? 60 : 300,
        });

        if (!fromRedisOnly && message) {
          // Mongo update (only if present in DB)
          if (!message.deletedFor.includes(userId)) {
            message.deletedFor.push(userId);
            await message.save();
          }

          if (
            message.deletedFor.includes(senderId) &&
            message.deletedFor.includes(receiverId)
          ) {
            await Message.findOneAndDelete({ _id: messageId });
          }
        } else {
          // Flag for Kafka to skip insertion
          // await client.set(`deletedPendingDB:${messageId}`, "true", { EX: 600 });
          await client.set(
            `deletedPendingDB:${messageId}:${senderId}`,
            "true",
            { EX: 600 }
          );
        }

        io.to(userId).emit("messageDeletedForMe", { messageId });
      } else if (scope === "everyone" && userId === senderId) {
        // Full delete for everyone
        messages = messages.filter((msg) => msg._id !== messageId);
        await client.set(cacheKey, JSON.stringify(messages), {
          EX: isSecretChat ? 60 : 300,
        });

        if (!fromRedisOnly) {
          await Message.findOneAndDelete({ _id: messageId }).catch((err) => {
            if (err.name !== "DocumentNotFoundError") {
              console.error("Error deleting from DB:", err);
            }
          });
        } else {
          // Mark for deferred delete
          // await client.set(`deletedPendingDB:${messageId}`, "true", { EX: 600 });
          await client.set(`deleteForAll:${messageId}`, "true", { EX: 600 });
        }

        io.to(senderId).emit("messageDeletedForEveryone", { messageId });
        io.to(receiverId).emit("messageDeletedForEveryone", { messageId });
      }
    } catch (err) {
      console.error("Error in deleteMessage:", err);
    }
  });

  socket.on(
    "audio-message",
    async ({
      senderId,
      receiverId,
      audioUrl, // array of encrypted audio URLs
      iv,
      encryptedKeys,
      messageId,
      status,
      type = "audio",
      isSecretChat,
    }) => {
      try {
        const sender = await User.findById(senderId).select("name phoneNo");
        const senderPhone = sender ? sender.phoneNo : "";

        // ✅ Notification logic
        const openChat = await client.get(`openchat:${receiverId}`);
        const isChatOpen = openChat === senderId;
        if (!isChatOpen) {
          await Contact.updateOne(
            { userId: receiverId, contactId: senderId },
            { $inc: { unreadCount: 1 } }
          );
          const senderNameObj = await User.findById(senderId).select("name");
          const socketId = await client.get(`online:${receiverId}`);
          if (socketId) {
            io.to(socketId).emit("notify-new-message", {
              from: senderNameObj.name,
              message: "[Audio]",
              type: "audio",
            });
          }
        } else {
          await Contact.updateOne(
            { userId: receiverId, contactId: senderId },
            { $set: { unreadCount: 0 } }
          );
        }

        // ✅ Set expiry for secret chats
        const expiresAt = Date.now() + 60000;

        const savedAudioObj = {
          _id: messageId,
          senderName: sender ? sender.name : "Unknown",
          senderId,
          receiverId,
          type,
          audioUrl, // encrypted audio file URLs
          iv,
          encryptedKeys,
          senderPhone,
          isSecretChat,
          expiresAt,
          timestamp: new Date(),
          status,
        };

        // --- Redis cache logic ---
        const ids = [senderId, receiverId].sort();
        const cacheKey = `chat:${ids[0]}:${ids[1]}:${
          isSecretChat ? "secret" : "normal"
        }`;

        let cached = await client.get(cacheKey);
        let messages = cached ? JSON.parse(cached) : [];

        messages.push(savedAudioObj);

        if (messages.length > 30) {
          messages = messages.slice(-30);
        }

        const ttl = isSecretChat ? 60 : 300;
        let audiocache = await client.set(cacheKey, JSON.stringify(messages), {
          EX: ttl,
        });

        console.log("AudioCache", audiocache);

        // ✅ Emit to sender (sent)
        io.to(senderId).emit("chat message", savedAudioObj);

        // ✅ Emit to receiver (delivered)
        const deliveredAudio = { ...savedAudioObj, status: "delivered" };
        io.to(receiverId).emit("chat message", deliveredAudio);

        // ✅ Update Redis cache for delivered status
        let updatedMessages = messages.map((msg) => {
          if (msg._id && msg._id.toString() === messageId.toString()) {
            return { ...msg, status: "delivered" };
          }
          return msg;
        });
        await client.set(cacheKey, JSON.stringify(updatedMessages), {
          EX: ttl,
        });

        // ✅ Emit delivery tick to sender
        io.to(senderId).emit("message-delivered", { messageId });
      } catch (err) {
        console.error("Audio message error:", err);
      }
    }
  );

  // Listen for 'message-read' event from client when user opens chat
  socket.on("message-read", async ({ messageIds, readerId, receiverId }) => {
    console.log("message-read event received:", {
      messageIds,
      readerId,
      receiverId,
    });

    const messageIdsStr = (messageIds || []).map((id) => id && id.toString());

    if (!receiverId || !readerId || messageIdsStr.length === 0) {
      console.warn("Missing receiverId, readerId, or empty messageIds");
      return;
    }

    // --- Get messages from Redis instead of MongoDB (since Kafka inserts later) ---
    let messages = [];
    const chatIds = [readerId, receiverId].sort();
    const cacheKeys = [
      `chat:${chatIds[0]}:${chatIds[1]}:normal`,
      `chat:${chatIds[0]}:${chatIds[1]}:secret`,
    ];

    for (const cacheKey of cacheKeys) {
      const cached = await client.get(cacheKey);
      if (cached) {
        const cachedMessages = JSON.parse(cached);
        for (const messageId of messageIdsStr) {
          const found = cachedMessages.find((m) => m._id === messageId);
          if (found) {
            messages.push({ ...found, cacheKey });
          }
        }
        // No need to keep looking if found all
        if (messages.length === messageIdsStr.length) break;
      }
    }

    // --- Update Redis cache with read status ---
    const updatesByCacheKey = {};

    for (const msg of messages) {
      if (!updatesByCacheKey[msg.cacheKey]) {
        updatesByCacheKey[msg.cacheKey] = [];
      }
      updatesByCacheKey[msg.cacheKey].push(msg._id);
    }

    for (const [cacheKey, idsToUpdate] of Object.entries(updatesByCacheKey)) {
      let cached = await client.get(cacheKey);
      if (cached) {
        let cachedMessages = JSON.parse(cached);
        let updated = false;
        cachedMessages = cachedMessages.map((m) => {
          if (idsToUpdate.includes(m._id)) {
            updated = true;
            return { ...m, status: "read" };
          }
          return m;
        });
        if (updated) {
          const isSecretChat = cacheKey.includes(":secret");
          const ttl = isSecretChat ? 60 : 300;
          await client.set(cacheKey, JSON.stringify(cachedMessages), {
            EX: ttl,
          });
        }
      }
    }

    // --- Update MongoDB messages ---
    // --- Also update MongoDB if the messages exist there ---
    try {
      const dbMessages = await Message.find({ _id: { $in: messageIdsStr } });

      if (dbMessages.length > 0) {
        const notAlreadyRead = dbMessages.filter((m) => m.status !== "read");
        const idsToUpdate = notAlreadyRead.map((m) => m._id.toString());

        if (idsToUpdate.length > 0) {
          await Message.updateMany(
            { _id: { $in: idsToUpdate } },
            { $set: { status: "read" } }
          );
          console.log(
            `✅ MongoDB updated ${idsToUpdate.length} messages to read`
          );
        }
      } else {
        console.log(
          "📭 No messages found in MongoDB yet, likely waiting for Kafka insert"
        );
      }
    } catch (err) {
      console.error("❌ MongoDB update failed in message-read:", err.message);
    }

    // --- Update unread count in Contact collection ---
    await Contact.updateOne(
      { userId: readerId, contactId: receiverId },
      { $set: { unreadCount: 0 } }
    );

    // --- Emit read receipts to sender(s) ---
    const senderIds = new Set();
    messages.forEach((msg) => senderIds.add(msg.senderId));

    for (const senderId of senderIds) {
      const senderSocketId = await client.get(`online:${senderId}`);
      if (senderSocketId) {
        io.to(senderSocketId).emit("message-read", {
          messageIds: messageIdsStr,
          readerId,
        });
      }
    }

    // --- Emit to reader as well (so their own UI updates) ---
    const readerSocketId = await client.get(`online:${readerId}`);
    if (readerSocketId) {
      io.to(readerSocketId).emit("message-read", {
        messageIds: messageIdsStr,
        readerId,
      });
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
    console.log("user", userId);
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
// server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));4
server.listen(PORT, () => {
  console.log("Server running on port 3000");
});

connectProducer();
startConsumer();

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack || err);
  res.status(500).json({ error: "Something went wrong", details: err.message });
});

// --- Express route for group details (add to your backend index.js or routes file) ---
// Example assumes you use Express and Mongoose

// Add this near your other routes
app.get("/api/groups/:groupId", async (req, res) => {
  try {
    const groupId = req.params.groupId;
    // Replace with your actual Group model and member population logic
    const group = await Group.findById(groupId).populate({
      path: "members.user", // adjust if your schema is different
      select: "name phone",
    });
    if (!group) return res.status(404).json({ error: "Group not found" });
    // Format members for frontend
    const members = group.members.map((m) => ({
      name: m.user.name,
      phone: m.user.phone,
      role: m.role,
      _id: m.user._id,
    }));
    res.json({
      _id: group._id,
      name: group.name,
      members,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch group details" });
  }
});

// --- API route to get contact details by userId ---
app.get("/api/contacts/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    // Try to find as a User
    let user = await User.findById(userId).select("name phoneNo about image");
    if (!user) {
      // Try to find as a Contact (for non-user contacts)
      const contact = await Contact.findOne({ contactId: userId });
      if (contact) {
        user = {
          name: contact.name,
          phoneNo: contact.phone,
          about: contact.about || "",
          image: "",
        };
      }
    }
    if (!user) return res.status(404).json({ error: "Contact not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch contact details" });
  }
});
