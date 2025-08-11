
import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  _id: {
    type:String,
    required:true,
    // unique:true,
  },
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
    enum: [
      "text",
      "image",
      "audio",
      "multi-image",
      "lockedText",
      "lockedImage",
    ],
    default: "text",
  },

  message: {
    type: String,
    // required: true,
  },
  encryptedKeys: {
    type: [
      {
        deviceId: { type: String, required: true },
        encryptedAESKey: { type: String, required: true }, // base64
      },
    ],
    default: [],
  },
  iv: {
    type: String,
    // required: true,
  },

  mediaUrls: {
    type: [String], // used for image/audio/multiple image URLs
    default: [],
  },
  audioUrl: {
    type: String,
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
  deleteAt: {
    type: Date,
    default: null,
  },
  burnAfterRead: {
    type: Boolean,
    default: false,
  },
  receiverOpened: {
    type: Boolean,
    default: false,
  },
  isSecretChat: {
    type: Boolean,
    default: false,
  },
  pinned: {
    type: Boolean,
    default: false,
  },

  repliedTo: {
    type: {
      messageId: { type: String, ref: "Message" },
      textSnippet: { type: String },
      iv: { type: String },
      encryptedAESKeys: [
        {
          deviceId: { type: String },
          encryptedAESKey: { type: String },
        },
      ],
      imageUrl: { type: Boolean,default: false }, // Add imageUrl for image reply preview
    },
    default: null,
  },
  deletedFor: [
    String
  ], 
  deleteChat:[
    String
  ],
  isDeleted: { type: Boolean, default: false }, // for "delete for everyone"
});

messageSchema.index({ senderId: 1, receiverId: 1, timestamp: 1 });
messageSchema.index({ receiverId: 1, senderId: 1, timestamp: 1 });
messageSchema.index({ deleteAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Message", messageSchema);
