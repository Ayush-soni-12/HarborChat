const express = require("express");
const router = express.Router();
const {firebaseAuth,login,signup,registerUser} =require("../controllers/userController");


router.post("/verify-firebase",firebaseAuth)
router.get("/login",login);
router.get("/signup",signup);
router.post("/signup",registerUser)


module.exports = router;