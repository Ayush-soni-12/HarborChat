const express = require('express');
const router = express.Router();
const {index} = require("../controllers/homeController");



router.get('/',index)


module.exports= router