const express = require('express');
const router = express.Router();
const {index,chat,contact,setting,Status,profile} = require("../controllers/homeController");
const validToken= require('../middlewares/verifytoken');



router.get('/',index)


router.get('/chat',validToken,chat)

router.post("/contacts/ajax/add",validToken,contact)

router.get("/chat/setting",validToken,setting)
router.get("/chat/status",validToken,Status)
router.get("/chat/profile",validToken,profile)



module.exports= router