const express = require('express');
const router = express.Router();
const {index} = require("../controllers/homeController");
const validToken= require('../middlewares/verifytoken');



router.get('/',index)
router.get('/dashboard',validToken,async(req,res)=>{
    return res.send('welcome to the dashboard');
}

)


module.exports= router