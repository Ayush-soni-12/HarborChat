if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const cookieParser = require("cookie-parser");
const methodOverride = require("method-override");
const setCurrentUser = require("./middlewares/setCurrentuser");
const User = require("./modals/UserModal");
const Contact = require("./modals/contactModal");
const socketIO = require("socket.io");
const Message = require("./modals/Message");
const http = require("http");
const authRoutes = require("./routes/auth");
const homeRoute = require("./routes/home");
const client = require("./redisClient.js");

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

app.use("/auth", authRoutes);
app.use("/", homeRoute);

const io = socketIO(server);
const users = {};
const onlineUsers = new Map();
const userContacts = new Map();
// --- Track which chat each user currently has open ---
const currentOpenChats = new Map();

io.on("connection", (socket) => {
  console.log("🟢 New client connected:", socket.id);
  let userId = null;

  // Step 1: Store userId with socket
  socket.on("join", async (id) => {
    userId = id;
    users[id] = socket.id;
    onlineUsers.set(userId, socket.id);
    socket.join(id);
    const contacts = await Contact.find({ userId: id }).select(
      "contactId unreadCount"
    );
    const contactIds = contacts.map((c) => c.contactId.toString());
    userContacts.set(userId, contactIds);

    // Send the list of online contacts to the user who just joined
    const onlineContactIds = contactIds.filter((contactId) =>
      onlineUsers.has(contactId)
    );
    socket.emit("online-contacts", onlineContactIds);

    // Send unread counts for all contacts
    const unreadCounts = {};
    contacts.forEach((c) => {
      unreadCounts[c.contactId.toString()] = c.unreadCount || 0;
    });
    socket.emit("unread-counts", unreadCounts);

    contactIds.forEach((contactId) => {
      const contactSocketId = onlineUsers.get(contactId);
      if (contactSocketId) {
        io.to(contactSocketId).emit("user-online", userId);
      }
    });
    console.log(`User ${id} joined room ${id}`);
  });

  // Track which chat the user has open
  socket.on("chat-open", ({ userId, contactId }) => {
    if (userId && contactId) {
      currentOpenChats.set(userId, contactId);
    }
  });

  socket.on("chat message", async ({ senderId, receiverId, message }) => {
    console.log("📨 Message received:", { senderId, receiverId, message });
    console.log(`📤 Sending message from ${senderId} to ${receiverId}`);

    // Debug: show which rooms this socket is in
    console.log("🔍 Socket Rooms:", socket.rooms);
    // console.log(senderId)
    const sender = await User.findById(senderId);
    // console.log(sender)
    //    console.log(sender)
    const senderPhone = sender ? sender.phoneNo : "";

    // unread messages...............................

    // Only increment unreadCount if receiver is NOT currently viewing this chat
    const isChatOpen = currentOpenChats.get(receiverId) === senderId;
    if (!isChatOpen) {
      await Contact.updateOne(
        { userId: receiverId, contactId: senderId },
        { $inc: { unreadCount: 1 } }
      );
    } else {
      // If chat is open, ensure unreadCount is 0 (defensive)
      await Contact.updateOne(
        { userId: receiverId, contactId: senderId },
        { $set: { unreadCount: 0 } }
      );
    }

    //   await Contact.findOneAndUpdate(
    //   { userId: senderId, contactId: receiverId },
    //   {
    //     name: receiverName, // or "Unknown"
    //     phone: receiverPhone,
    //     messageTime: now,
    //   },
    //   { upsert: true, new: true }
    // );
    //    console.log(senderPhone)
    // Save message to MongoDB with status 'sent'
    const savedMessage = await Message.create({
      senderId,
      receiverId,
      message,
      senderPhone,
      status: "sent",
    });

    // // --- Update lastMessage for both sender and receiver contacts ---
    // await Contact.updateOne(
    //   { userId: senderId, contactId: receiverId },
    //   { $set: { lastMessage: message } }
    // );
    // await Contact.updateOne(
    //   { userId: receiverId, contactId: senderId },
    //   { $set: { lastMessage: message } }
    // );

    // Convert to plain object for cache and emit
    const savedMessageObj = savedMessage.toObject();

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

    messages.push(savedMessageObj);

    // 5. Keep only latest 30 messages
    if (messages.length > 30) {
      messages = messages.slice(-30);
    }

    await client.set(cacheKey, JSON.stringify(messages), { EX: 300 });

    // Emit the message to the sender (with 'sent' status)
    io.to(senderId).emit("chat message", savedMessageObj);

    // Emit the message to the receiver (with 'delivered' status)
    const deliveredMessage = {
      ...savedMessageObj,
      status: "delivered",
    };
    io.to(receiverId).emit("chat message", deliveredMessage);

    // Update status in DB to 'delivered' when delivered to receiver
    await Message.findByIdAndUpdate(savedMessage._id, { status: "delivered" });

    // Update status in Redis cache to 'delivered' for this message
    let updatedMessages = messages.map((msg) => {
      if (msg._id && msg._id.toString() === savedMessage._id.toString()) {
        return { ...msg, status: "delivered" };
      }
      return msg;
    });
    await client.set(cacheKey, JSON.stringify(updatedMessages), { EX: 300 });

    // Emit 'message-delivered' to sender for real-time double tick
    io.to(senderId).emit("message-delivered", { messageId: savedMessage._id });
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
    senderIds.forEach((senderId) => {
      const senderSocketId = onlineUsers.get(senderId);
      if (senderSocketId) {
        io.to(senderSocketId).emit("message-read", {
          messageIds: messageIdsStr,
          readerId,
        });
      }
    });
    // Also emit to the reader (so their own UI updates instantly)
    const readerSocketId = onlineUsers.get(readerId);
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

  socket.on("typing", ({ senderId, receiverId }) => {
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing", senderId);
    }
  });

  socket.on("disconnect", () => {
    if (userId) {
      onlineUsers.delete(userId);

      // Notify only contacts that this user is offline
      const contactIds = userContacts.get(userId) || [];
      contactIds.forEach((contactId) => {
        const contactSocketId = onlineUsers.get(contactId);
        if (contactSocketId) {
          io.to(contactSocketId).emit("user-offline", userId);
        }
      });

      userContacts.delete(userId);
      currentOpenChats.delete(userId); // Clean up open chat info
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
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
