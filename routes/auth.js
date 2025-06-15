const express = require("express");
const router = express.Router();
const {firebaseAuth,login,signup,registerUser,logoutUser,loginwithPassword,loginConfirm,changePassword} =require("../controllers/userController");
const {registerSchema ,loginSchema,passwordChange} = require("../validations/authValidation")
const validation = require("../middlewares/validate");
const validToken = require("../middlewares/verifytoken");
const { verifyEmailChange } = require("../controllers/homeController");



router.post("/verify-firebase",firebaseAuth)
router.get("/login",login);
router.get("/loginwithPassword",loginwithPassword)
router.post("/loginwithPassword",validation(loginSchema),loginConfirm)
router.get("/signup",signup);
router.post("/signup",validation(registerSchema),registerUser)
router.get("/logout",logoutUser);
router.get("/verifyemail",verifyEmailChange)
router.post("/changePassword",validToken,validation(passwordChange),changePassword)


module.exports = router;