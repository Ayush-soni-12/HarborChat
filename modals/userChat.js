// models/UserChat.js
import mongoose from "mongoose" ;

const UserChatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  conversationKey: { type: String, required: true }, 
  lastClearedAt: { type: Date, default: new Date(0) }
});

UserChatSchema.index({ userId: 1, conversationKey: 1 }, { unique: true });

export default mongoose.model("UserChat", UserChatSchema);
