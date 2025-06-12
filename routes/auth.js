const express = require("express");
const router = express.Router();
const {firebaseAuth,login,signup,registerUser,logoutUser,loginwithPassword,loginConfirm} =require("../controllers/userController");
const {registerSchema ,loginSchema} = require("../validations/authValidation")
const validation = require("../middlewares/validate")


router.post("/verify-firebase",firebaseAuth)
router.get("/login",login);
router.get("/loginwithPassword",loginwithPassword)
router.post("/loginwithPassword",validation(loginSchema),loginConfirm)
router.get("/signup",signup);
router.post("/signup",validation(registerSchema),registerUser)
router.get("/logout",logoutUser);


module.exports = router;