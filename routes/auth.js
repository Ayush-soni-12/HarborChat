import express from "express";
const router = express.Router();
import {firebaseAuth,login,signup,registerUser,logoutUser,loginwithPassword,loginConfirm,changePassword,pinCreate,pinform,pinVerify,deleteAccount,savePublicKey,fetchPublicKeys,sendEncryptData} from"../controllers/userController.js";
import {registerSchema ,loginSchema,passwordChange,pinSchema} from "../validations/authValidation.js"
import validation from "../middlewares/validate.js";
import validToken from "../middlewares/verifytoken.js";
import { verifyEmailChange } from "../controllers/homeController.js";
import { sendEncryptedMessage } from "../public/Security/encryptAeskey.js";



router.post("/verify-firebase",firebaseAuth)
router.get("/login",login);
router.get("/loginwithPassword",loginwithPassword)
router.post("/loginwithPassword",validation(loginSchema),loginConfirm)
router.get("/signup",signup);
router.post("/signup",validation(registerSchema),registerUser)
router.get("/logout",logoutUser);
router.get("/verifyemail",verifyEmailChange)
router.patch("/changePassword",validToken,validation(passwordChange),changePassword)
router.get("/pin",pinform)
router.post("/changePin",validToken,pinCreate)
router.post("/pinVerify",pinVerify)
router.post("/savePublicKey",validToken,savePublicKey)
router.get("/userPublicKey/:id",validToken,fetchPublicKeys)
router.post("/messages/sendEncrypted",validToken,sendEncryptData)
router.delete("/deleteAccount",validToken,deleteAccount)


export default  router;