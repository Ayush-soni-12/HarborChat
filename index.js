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
const client = require('./redisClient.js')

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

io.on("connection", (socket) => {
  console.log("🟢 New client connected:", socket.id);
  let userId = null;

  // Step 1: Store userId with socket
  socket.on("join", async (id) => {
    userId = id;
    users[id] = socket.id;
    onlineUsers.set(userId, socket.id);
    socket.join(id);
    const contacts = await Contact.find({ userId: id }).select("contactId");
    const contactIds = contacts.map((c) => c.contactId.toString());
    userContacts.set(userId, contactIds);

    // Send the list of online contacts to the user who just joined
    const onlineContactIds = contactIds.filter((contactId) =>
      onlineUsers.has(contactId)
    );
    socket.emit("online-contacts", onlineContactIds);

    contactIds.forEach((contactId) => {
      const contactSocketId = onlineUsers.get(contactId);
      if (contactSocketId) {
        io.to(contactSocketId).emit("user-online", userId);
      }
    });
    console.log(`User ${id} joined room ${id}`);
  });

  socket.on("chat message", async ({ senderId, receiverId, message }) => {
    console.log("📨 Message received:", { senderId, receiverId, message });
    console.log(`📤 Sending message from ${senderId} to ${receiverId}`);

    // Debug: show which rooms this socket is in
    console.log("🔍 Socket Rooms:", socket.rooms);
    const sender = await User.findById(senderId);
    //    console.log(sender)
    const senderPhone = sender ? sender.phoneNo : "";
    //    console.log(senderPhone)
    // Save message to MongoDB with status 'sent'
    const savedMessage = await Message.create({
      senderId,
      receiverId,
      message,
      senderPhone,
      status: "sent",
    });

   const ids = [senderId, receiverId].sort();
  const cacheKey = `chat:${ids[0]}:${ids[1]}`;


  let cached = await client.get(cacheKey);
  let messages = cached ? JSON.parse(cached) : [];

  

   messages.push(savedMessage);

  // 5. Keep only latest 20 messages
  if (messages.length > 30) {
    messages = messages.slice(-30);
  }

    await client.set(cacheKey, JSON.stringify(messages), { EX: 300 });

    // Emit the message to the sender (with 'sent' status)
    io.to(senderId).emit("chat message", savedMessage);

    // Emit the message to the receiver (with 'delivered' status)
    const deliveredMessage = {
      ...savedMessage.toObject(),
      status: "delivered",
    };
    io.to(receiverId).emit("chat message", deliveredMessage);

    // Update status in DB to 'delivered' when delivered to receiver
    await Message.findByIdAndUpdate(savedMessage._id, { status: "delivered" });

    // Emit 'message-delivered' to sender for real-time double tick
    io.to(senderId).emit("message-delivered", { messageId: savedMessage._id });
  });

  // Listen for 'message-read' event from client when user opens chat
  socket.on("message-read", async ({ messageIds, readerId }) => {
    // Update all messages to 'read' in DB
    await Message.updateMany({ _id: { $in: messageIds } }, { status: "read" });
    // Notify sender(s) and receiver that their messages have been read
    const messages = await Message.find({ _id: { $in: messageIds } });
    const senderIds = new Set();
    messages.forEach((msg) => {
      senderIds.add(msg.senderId);
    });
    // Emit to all senders
    senderIds.forEach((senderId) => {
      const senderSocketId = onlineUsers.get(senderId);
      if (senderSocketId) {
        io.to(senderSocketId).emit("message-read", { messageIds, readerId });
      }
    });
    // Also emit to the reader (so their own UI updates instantly)
    const readerSocketId = onlineUsers.get(readerId);
    if (readerSocketId) {
      io.to(readerSocketId).emit("message-read", { messageIds, readerId });
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
