import mongoose from "mongoose";

const groupMessageSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  groupId: {
    type: String,
    required: true, // instead of receiverId
  },
  senderId: {
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
  },
  encryptedKeys: {
    type: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        deviceId: { type: String, required: true },
        encryptedAESKey: { type: String, required: true },
      },
    ],
    default: [],
  },
  iv: {
    type: String,
  },
  mediaUrls: {
    type: [String],
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
      messageId: { type: String, ref: "GroupMessage" },
      textSnippet: { type: String },
      iv: { type: String },
      encryptedAESKeys: [
        {
          deviceId: { type: String },
          encryptedAESKey: { type: String },
        },
      ],
      imageUrl: { type: Boolean, default: false },
    },
    default: null,
  },
  deletedFor: [String],
  deleteChat: [String],
  isDeleted: { type: Boolean, default: false },
});

groupMessageSchema.index({ groupId: 1, timestamp: 1 });
groupMessageSchema.index({ deleteAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("GroupMessage", groupMessageSchema);
