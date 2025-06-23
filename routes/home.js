const express = require('express');
const router = express.Router();
const {index,chat,contact,setting,Status,profile,updateProfile,updateEmail,me,personalChat} = require("../controllers/homeController");
const validToken= require('../middlewares/verifytoken');
const {verifyemail, newContactSchema }= require("../validations/authValidation.js")
const validation = require("../middlewares/validate");
const multer =  require("multer");
const {cloudinary} = require("../ cloudConfig.js");
const {storage} = require("../ cloudConfig.js");
const multerUpload = multer({ storage });
function setUserFolder(req, res, next) {
    req.cloudinaryFolder = "userImage";
    next();
}


router.get('/',index)


router.get('/chat',validToken,chat)

router.post("/contacts/ajax/add",validation(newContactSchema),validToken,contact)

router.get("/chat/setting",validToken,setting)
router.get("/chat/status",validToken,Status)
router.get("/chat/profile",validToken,profile)
router.patch("/update-profile",validToken,setUserFolder,multerUpload.single('image'),updateProfile)
router.patch("/update-email",validToken,validation(verifyemail),updateEmail)
router.get("/api/me",validToken,me)
router.get("/api/messages/:receiverId",validToken,personalChat)


module.exports= router