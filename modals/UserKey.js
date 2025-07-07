
import mongoose from "mongoose";

const userKeySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  publicKey: { type: String, required: true }, // base64 encoded
});

export default  mongoose.model("UserKey", userKeySchema);
