import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    index:true,
  },
  password: {
    type: String,
    required: true,
  },
  phoneNo: {
    type: String,
    required: true,
    unique: true,
  },
  email:{
    type:String,
    required:true,
    unique:true
  },
  image:{
    type:String,
  },
    image_id: {
      type:String, 
    },
  about:{
    type:String,
  },
  pin:{
    type:String,
  },
  isPin:{
    type:Boolean,
    default:false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const User = mongoose.model('User',userSchema);
export default User