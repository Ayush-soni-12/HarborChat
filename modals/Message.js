const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  senderId: {
    type: String,
    required: true,
  },
  receiverId: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["text", "image", "audio", "multi-image"],
    default: "text",
  },

  message: {
    type: String,
    // required: true,
  },
  mediaUrls: {
    type: [String], // used for image/audio/multiple image URLs
    default: [],
  },
  senderPhone: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ["sent", "delivered", "read"],
    default: "sent",
  },
});


messageSchema.index({ senderId: 1, receiverId: 1, timestamp: 1 });
messageSchema.index({ receiverId: 1, senderId: 1, timestamp: 1 });


module.exports = mongoose.model("Message", messageSchema);
