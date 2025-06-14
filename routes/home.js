const express = require('express');
const router = express.Router();
const {index,chat,contact} = require("../controllers/homeController");
const validToken= require('../middlewares/verifytoken');



router.get('/',index)


router.get('/chat',validToken,chat)

router.post("/contacts/ajax/add",validToken,contact)


module.exports= router