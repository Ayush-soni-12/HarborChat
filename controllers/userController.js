const asyncHandler = require("../middlewares/asyncHandler");
const generateToken = require("../middlewares/generateToken");
const User= require("../modals/UserModal")
const bcrypt = require('bcrypt');
const admin = require("../firebaseAdmin/firebaseInit")
const  {parsePhoneNumber}  = require('libphonenumber-js');



module.exports.firebaseAuth = asyncHandler(async(req ,res)=>{
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

   generateToken(res, user._id);
   return res.status(200).json({ message: "Authenticated", user });
  } catch (err) {
    console.error("Firebase token verification failed:", err);
    res.status(401).send({ err: "Invalid Firebase Token" });
  }
})
module.exports.login = asyncHandler(async(req,res)=>{
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
module.exports.signup = asyncHandler(async(req,res)=>{
     if (req.cookies.jwt) {
        return res.json({ success: false, message: "Already signup " });
    }
  return res.render('signup');
})
module.exports.registerUser = asyncHandler(async(req,res)=>{
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
        return res.json({ success: true, message: "User login successfully" });

})


module.exports.logoutUser = asyncHandler(async(req,res)=>{
  res.clearCookie("jwt",{
    httpOnly:true,
    secure:false,
    sameSite: 'strict', // Add this line

  })
  return res.redirect("/")
})


module.exports.loginwithPassword =asyncHandler(async(req,res)=>{
     if (req.cookies.jwt) {
        return res.json({ success: false, message: "Already logged in" });
    }

return res.render("welcome.ejs");
})


module.exports.loginConfirm = asyncHandler(async (req, res) => {
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
     return res.json({ success: true, message: "Login successful" });

   } 

   

});

module.exports.changePassword = asyncHandler(async(req,res)=>{
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
module.exports.pinform = asyncHandler(async(req,res)=>{
     if (req.cookies.jwt) {
        return res.json({ success: false, message: "Already logged in" });
    }
  return res.render("pin.ejs")
})

module.exports.pinCreate = asyncHandler(async(req,res)=>{
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
module.exports.pinVerify = asyncHandler(async(req,res)=>{
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
   return res.json({ success: true, message: "Login successful" });
})