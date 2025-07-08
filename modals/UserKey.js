
import mongoose from "mongoose";

const userKeySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  publicKey: { type: String, required: true }, // base64 encoded
  deviceId : {type :String  , required: true}
});

export default  mongoose.model("UserKey", userKeySchema);
