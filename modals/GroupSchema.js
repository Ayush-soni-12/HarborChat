import mongoose  from  "mongoose";

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String }, 
  avatar: {type:String},// Cloudinary URL
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  members: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User"  },
      role: { type: String, enum: ["owner", "admin", "member"], default: "member" },
      joinedAt: { type: Date, default: Date.now },
    },
  ],
  isPublic: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  lastMessageAt: { type: Date },
  unreadCount: {type :Number},

});

GroupSchema.index({ "members.user": 1 });
export default mongoose.model("Group", GroupSchema);
