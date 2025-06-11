const asyncHandler = require("../middlewares/asyncHandler");
const generateToken = require("../middlewares/generateToken");
const User= require("../modals/UserModal")
const bcrypt = require('bcrypt');
const admin = require("../firebaseAdmin/firebaseInit")


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
return res.render('logins.ejs');
})
module.exports.signup = asyncHandler(async(req,res)=>{
  return res.render('signup');
})
module.exports.registerUser = asyncHandler(async(req,res)=>{
  const {name,phoneNo,password} = req.body
  if(!name || !phoneNo || !password){
    return res.status(400).send({error:"Please fill all the fields"})
  }
  const isExist = await User.findOne({phoneNo})
  if(isExist){
    return res.redirect('/auth/signup');
  }
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password,salt);

   
// ...existing code...
const newUser = new User({
  name,
  phoneNo,
  password: hashedPassword
});
// ...existing code...
  await newUser.save();
console.log("user created Successfully");
generateToken(res,newUser._id);
return res.redirect("/")

})


module.exports.logoutUser = asyncHandler(async(req,res)=>{
  res.clearCookie("jwt",{
    httpOnly:true,
    secure:false,

  })
  return res.redirect("/")
})


module.exports.loginwithPassword =asyncHandler(async(req,res)=>{

return res.render("welcome.ejs");
})