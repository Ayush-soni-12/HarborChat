const express = require("express");
const router = express.Router();
const {firebaseAuth,login,signup,registerUser,logoutUser,loginwithPassword,loginConfirm} =require("../controllers/userController");


router.post("/verify-firebase",firebaseAuth)
router.get("/login",login);
router.get("/loginwithPassword",loginwithPassword)
router.post("/loginwithPassword",loginConfirm)
router.get("/signup",signup);
router.post("/signup",registerUser)
router.get("/logout",logoutUser);


module.exports = router;