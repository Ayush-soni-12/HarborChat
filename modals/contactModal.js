// models/Contact.js
import mongoose from "mongoose";

const contactSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  contactId:{type:mongoose.Schema.Types.ObjectId, ref:"User",required:true},
  name: { type: String, required: true },
  phone: { type: String, required: true,  },
  messageTime: { type: Date, default: Date.now },
  unreadCount: {type :Number},
  // lastMessage: { type: String, default: "" }
});



contactSchema.index({ userId: 1 });
contactSchema.index({ userId: 1, phone: 1 },{unique:true});
contactSchema.index({ userId: 1, contactId: 1 }, { unique: true });
contactSchema.index({ userId: 1, messageTime: -1 });

export default mongoose.model("Contact", contactSchema);

