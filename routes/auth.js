const express = require("express");
const router = express.Router();
const {firebaseAuth,login,signup,registerUser,logoutUser,loginwithPassword,loginConfirm,changePassword,pinCreate,pinform,pinVerify} =require("../controllers/userController");
const {registerSchema ,loginSchema,passwordChange,pinSchema} = require("../validations/authValidation")
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
router.get("/pin",pinform)
router.post("/changePin",validToken,pinCreate)
router.post("/pinVerify",pinVerify)


module.exports = router;