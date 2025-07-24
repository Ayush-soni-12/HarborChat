import  express from "express";
const router = express.Router();
import  {index,chat,contact,setting,Status,profile,updateProfile,updateEmail,me,personalChat,searchContact,audioMessage,whisperBotMessage,translateChat,pinMessage,unPinMessage} from "../controllers/homeController.js";
import  validToken from '../middlewares/verifytoken.js';
import  {verifyemail, newContactSchema }from "../validations/authValidation.js"
import  validation from "../middlewares/validate.js";
import  multer from  "multer";
import  {cloudinary} from "../ cloudConfig.js";
import  { storage } from "../ cloudConfig.js";
const multerUpload = multer({ storage });
// const upload = multer();
function setUserFolder(req, res, next) {
    req.cloudinaryFolder = "userImage";
    next();
}
function setaudioFolder(req, res, next) {
    req.cloudinaryFolder = "HarborChat/audio";
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
router.get("/api/contacts/search",validToken,searchContact)
router.post('/upload-audio',validToken,setaudioFolder,multerUpload.single('audio'),audioMessage);
router.post('/api/whisperbot',validToken,whisperBotMessage)
router.post('/api/translate',validToken,translateChat);
router.post('/api/messages/pin',validToken,pinMessage);
router.patch('/api/pin/:id',validToken, unPinMessage);


export default router