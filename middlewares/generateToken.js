import jwt from "jsonwebtoken";
const generateToken =(res,uid)=>{
    const token = jwt.sign({uid},process.env.JWT_SECRET,{
        expiresIn:"7d",
    });


    res.cookie("jwt", token, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict', // Add this line
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
      console.log("Token generated and set in cookie:", token);
      return token;

}
export default generateToken;

    