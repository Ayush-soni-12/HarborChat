import asyncHandler  from "../middlewares/asyncHandler.js";
import generateToken  from "../middlewares/generateToken.js";
import User from "../modals/UserModal.js"
import UserKey  from "../modals/UserKey.js"
import Message from "../modals/Message.js";
import bcrypt  from 'bcrypt';
import admin  from "../firebaseAdmin/firebaseInit.js"
import  {parsePhoneNumber}   from 'libphonenumber-js';
import mongoose  from "mongoose";
import crypto from "crypto";
import { sendMessageToKafka } from "../kafkaProducer.js";




export const firebaseAuth = asyncHandler(async(req ,res)=>{
      console.log("Incoming token:", req.body.token);
      const { token } = req.body;

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    console.log("Decoded Firebase Token:", decoded);
    const { uid, phone_number } = decoded;
    console.log("Decoded Firebase Token:", decoded);

    
    const user = await User.findOne({ phoneNo: decoded.phone_number });
    console.log("user",user);
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    if(user.isPin){

     return res.cookie("tempUser", user._id.toString(), {
    httpOnly: true,
    secure: false,
    sameSite:'strict',
    maxAge: 5 * 60 * 1000, // 5 minutes
  }).json({ success: true, message: "Require PIN", redirect: "/auth/pin" });
       
    }else{

    generateToken(res, user._id);
    // handleLogin(user._id);
   return res.status(200).json({success:true, message: "Authenticated", userId:user._id });

    }


  } catch (err) {
    console.error("Firebase token verification failed:", err);
    res.status(401).send({ err: "Invalid Firebase Token" });
  }
})
export const login = asyncHandler(async(req,res)=>{
     if (req.cookies.jwt) {
        return res.json({ success: false, message: "Already logged in" });
    }
res.render('logins', {
  firebaseConfig: {
    apiKey: process.env.API_KEY,
    authDomain: process.env.AUTH_DOMAIN,
    projectId: process.env.PROJECT_ID,
    storageBucket: process.env.STORAGE_BUCKET,
    messagingSenderId: process.env.MESSAGINGSENDER_ID,
    appId: process.env.APP_ID,
  }
});
})
export const signup = asyncHandler(async(req,res)=>{
     if (req.cookies.jwt) {
        return res.json({ success: false, message: "Already signup " });
    }
  return res.render('signup');
})
export const registerUser = asyncHandler(async(req,res)=>{
     if (req.cookies.jwt) {
        return res.json({ success: false, message: "Already logged in" });
    }
  const {name,phoneNo,email,password} = req.body
  if(!name || !phoneNo  ||!email || !password){
        return res.json({ success: false, message: "Please provide all Fields" });
  }

  const parsed = parsePhoneNumber(phoneNo, 'IN'); // 'IN' is for India
  if (!parsed || !parsed.isValid()) {
            return res.json({ success: false, message: "Invalid phone no" });
  }

  const formattedPhone = parsed.number; // +919876543210

  // Check if user already exists
const isExist = await User.findOne({
  $or: [
    { phoneNo: formattedPhone },
    { email: email }
  ]
});

  if(isExist){
           return res.json({ success: false, message: "Phoneno or email is already exist" });
  }
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password,salt);

   
// ...existing code...
const newUser = new User({
  name,
  phoneNo:formattedPhone,
  email,
  password: hashedPassword
});
// ...existing code...
  await newUser.save();
console.log("user created Successfully");
generateToken(res,newUser._id);
// generateAndStoreRSAKeys(newUser._id);
   return res.json({ success: true, message: "User register successfully",userId: newUser._id});

})


export const logoutUser = asyncHandler(async(req,res)=>{
  res.clearCookie("jwt",{
    httpOnly:true,
    secure:false,
    sameSite: 'strict', // Add this line

  })
  return res.redirect("/")
})


export const loginwithPassword =asyncHandler(async(req,res)=>{
     if (req.cookies.jwt) {
        return res.json({ success: false, message: "Already logged in" });
    }

return res.render("welcome.ejs");
})


export const loginConfirm = asyncHandler(async (req, res) => {
    if (req.cookies.jwt) {
        return res.json({ success: false, message: "Already logged in" });
    }

    const { email, password } = req.body;

    if (!email || !password) {
        return res.json({ success: false, message: "Provide email and password" });
    }

    const user = await User.findOne({ email });
    if (!user) {
        return res.json({ success: false, message: "User not found" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
        return res.json({ success: false, message: "Email or password is incorrect" }); // ✅ JSON response
    }
    console.log(user.isPin)
     if (user.isPin) {
     return res.cookie("tempUser", user._id.toString(), {
    httpOnly: true,
    secure: false,
    sameSite:'strict',
    maxAge: 5 * 60 * 1000, // 5 minutes
  }).json({ success: true, message: "Require PIN", redirect: "/auth/pin" });
     }

   else{
     generateToken(res,user._id)
    //  handleLogin(user._id)
     return res.json({ success: true, message: "Login successful",userId: user._id });

   } 

   

});

export const changePassword = asyncHandler(async(req,res)=>{
  const {currentPassword,newPassword,confirmPassword} = req.body;
  console.log(req.body)
  if(!currentPassword || !newPassword || !confirmPassword){
    return res.send("please provide password for changes")
  }
  if(newPassword!==confirmPassword){
    return res.send("New password not matach ")
  }
  const user = await User.findById(req.user._id)
  console.log(user)

  if(!user){
    return res.send("User not found")
  }

  const match = await bcrypt.compare(currentPassword,user.password);
  console.log(match)
  if(!match){
    return res.send("current password not match")
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword,salt);
  
  
  user.password = hashedPassword;
  await user.save()
  return res.send("Password changed successfully")


})
export const pinform = asyncHandler(async(req,res)=>{
     if (req.cookies.jwt) {
        return res.json({ success: false, message: "Already logged in" });
    }
  return res.render("pin.ejs")
})

export const pinCreate = asyncHandler(async(req,res)=>{
     let {pin,isPin} = req.body
     if(!pin){
       pin = null;
      return res.send("Please Provide pin")
     }
     const userDetail = await User.findById(req.user._id)
     if(!userDetail){
      return res.send("User not Found")
     }
     userDetail.pin = pin;
      userDetail.isPin = isPin;

     await userDetail.save()
     return res.send("Pin Created")
})
export const pinVerify = asyncHandler(async(req,res)=>{
   if (req.cookies.jwt) {
    return res.json({ success: false, message: "Already logged in" });
    }
  const {pin} = req.body
    const userId = req.cookies.tempUser;
  if(!userId){
    return res.json({success:false, message:"Session expired"})
  }
  const user = await User.findById(userId);
  if (!user || user.pin !== pin) {
    return res.status(401).json({ success: false, message: "Invalid PIN" });
  }

   res.clearCookie("tempUser");

  generateToken(res,user._id)
  // handleLogin(user._id);
   return res.json({ success: true, message: "Login successful",userId:user._id });
})


export const savePublicKey = asyncHandler(async(req,res)=>{
    try {
    const { userId, publicKey ,deviceId} = req.body;

    if (!userId || !publicKey || !deviceId) {
      return res.status(400).json({ error: "Missing userId or publicKey or deviceId" });
    }

    // ✅ Safely cast string to ObjectId
    const objectUserId = new mongoose.Types.ObjectId(String(userId));

const result = await UserKey.findOneAndUpdate(
  { userId: objectUserId, deviceId }, // <- filter includes deviceId
  { publicKey, userId: objectUserId, deviceId }, // <- update data
  { upsert: true, new: true, setDefaultsOnInsert: true } // <- options
);

    console.log("✅ Public key saved for user:", objectUserId);
    res.status(200).json({ message: "Public key saved." });
  } catch (err) {
    console.error("❌ Error saving public key:", err);
    res.status(500).json({ error: "Server error" });
  }
})

export const fetchPublicKeys = asyncHandler(async (req, res) => {
  try {
    const userId = req.params.id;

    const userKeys = await UserKey.find({ userId });

    if (!userKeys || userKeys.length === 0) {
      return res.status(404).json({ error: "No public keys found for this user" });
    }

    const keys = userKeys.map(key => ({
      deviceId: key.deviceId,
      publicKey: key.publicKey, // base64 or JWK string
    }));

    res.status(200).json({ keys });
  } catch (err) {
    console.error("❌ Error fetching public keys:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});


export const sendEncryptData = asyncHandler(async (req, res) => {
  try {
    const {
      senderId,
      receiverId,
      encryptedMessage,
      encryptedKeys,
      caption,
      mediaUrls,
      isSecretChat,
      messageId,
      iv,
      status,
      type,
      repliedTo
    } = req.body;

    if (!senderId || !receiverId || !iv || !Array.isArray(encryptedKeys)) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const sender = await User.findById(req.user._id).select("phoneNo");
    const senderPhone = sender?.phoneNo || "";

    const newMessage = new Message({
      senderId,
      _id:messageId,
      receiverId,
      encryptedKeys,
      iv,
      type,
      senderPhone,
      isSecretChat,
      status,
      repliedTo: repliedTo || null,
      timestamp: new Date(),
    });

    if (type === "text" && encryptedMessage) {
      newMessage.message = encryptedMessage;
    }

    if (["image", "audio", "multi-image"].includes(type)) {
      if (mediaUrls?.length > 0) {
        newMessage.mediaUrls = mediaUrls;
        newMessage.message = caption;
      }
      // if (audioUrl) {
      //   newMessage.audioUrl = audioUrl;
      // }
    }
    console.log('Secret chat:', isSecretChat);


    // ✅ For secret messages, add deleteAt field for TTL auto-delete
    if (isSecretChat) {
      newMessage.deleteAt = new Date(Date.now() + 1 * 60 * 1000); // 1 minutes from now
    }

    // const savedMessage = await newMessage.save();
    // const messageId = savedMessage._id.toString();
    if(!isSecretChat){
    await sendMessageToKafka(newMessage);
    }

    res.status(201).json({
      message: "Encrypted message saved successfully",
      // messageId,
    });
  } catch (err) {
    console.error("❌ Error saving encrypted message:", err);
    res.status(500).json({ error: "Failed to save encrypted message" });
  }
});


export const uploadImage = asyncHandler(async(req,res)=>{
   const timestamp = Math.round(Date.now() / 1000);
  const folder = req.body.folder || "harborchat/images"; // optional folder name

  const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash("sha1")
    .update(paramsToSign + process.env.CLOUD_API_SECRET)
    .digest("hex");

  res.json({
    timestamp,
    folder,
    signature,
    apiKey: process.env.CLOUD_API_KEY,
    cloudName: process.env.CLOUD_NAME,
  });

})


export const sendCodeLockedMessage = asyncHandler(async (req, res) => {
  try {
    const {
      senderId,
      receiverId,
      encryptedMessage,
      iv,
      status,
      caption,
      mediaUrls,
      burnAfterRead,
      type, // should be "lockedText"
      isSecretChat
    } = req.body;

    if (!senderId || !receiverId || !iv  || !type) {
      return res.status(400).json({ error: "Missing or invalid fields for locked message" });
    }

    // Fetch sender's phone number for metadata
    const sender = await User.findById(req.user._id).select("phoneNo");
    const senderPhone = sender?.phoneNo || "";

    // Create new locked message
    const newMessage = new Message({
      senderId,
      receiverId,
      iv,
      type,
      senderPhone,
      burnAfterRead,
      status,
      isSecretChat,
      timestamp: new Date(),
    });

    if (type === "lockedText" && encryptedMessage) {
      newMessage.message = encryptedMessage;
    }

    if (["lockedImage"].includes(type)) {
      if (mediaUrls?.length > 0) {
        newMessage.mediaUrls = mediaUrls;
        newMessage.message = caption;
      }
    }

    // Optional: TTL for secret chats (auto-delete)


    // Save to DB
    const savedMessage = await newMessage.save();

    // Return message ID to frontend
    res.status(201).json({
      message: "Locked message saved successfully",
      messageId: savedMessage._id.toString()
    });

  } catch (err) {
    console.error("❌ Error saving code-locked message:", err);
    res.status(500).json({ error: "Failed to save locked message" });
  }
});



export const deleteAccount = asyncHandler(async(req,res)=>{
  console.log(req.user)
  const deletedUser = await User.findByIdAndDelete(req.user._id)  
  console.log(deletedUser)
     console.log("🧼 Private key deleted. Re-generate on next login.");
  // return res.json({ success: true, message: "User deleted successfully" });
  res.clearCookie("jwt");
  return res.json({ success: true, message: "User deleted", redirect: "/" });
})