
if(process.env.NODE_ENV !== 'production'){
    require('dotenv').config();
}   


const express = require('express');
const app = express();
const mongoose = require('mongoose');
const path = require('path');
const cookieParser= require('cookie-parser');
const authRoutes =require('./routes/auth')
const homeRoute = require("./routes/home");

async function main(){
    await mongoose.connect('mongodb://localhost:27017/harborchat')
    console.log('connected to mongodb');
}
main().catch((err)=>{
    console.log('error connecting to mongodb',err);
})

app.use(cookieParser());
app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use(express.static(path.join(__dirname,'public')));
app.use('views',express.static(path.join(__dirname,'views')));
app.set('view engine','ejs');




app.use("/auth",authRoutes)
app.use('/',homeRoute)







app.listen(3000,()=>{
    console.log('server is started on port ');
})
