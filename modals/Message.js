
import mongoose from "mongoose";

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
  encryptedAESKey: {
    type: String,
    required: true,
  },
  encryptedsenderAESKey:{
    type :String,
    required: true,
  },
  iv: {
    type: String,
    required: true,
  },

  mediaUrls: {
    type: [String], // used for image/audio/multiple image URLs
    default: [],
  },
  audioUrl:{
    type :String,
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


export default mongoose.model("Message", messageSchema);
