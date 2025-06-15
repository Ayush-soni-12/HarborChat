const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const User = mongoose.model('User',userSchema);
module.exports= User
