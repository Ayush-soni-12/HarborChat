const asyncHandler = require("../middlewares/asyncHandler");

module.exports.index = asyncHandler(async(req,res)=>{
    return res.render('index.ejs')
})