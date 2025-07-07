import jwt from "jsonwebtoken";
import asyncHandler from "../middlewares/asyncHandler.js" ;
import User from "../modals/UserModal.js"


  const validToken = asyncHandler(async (req, res, next) => {
    let token = req.cookies.jwt;

    // Check for token in Authorization header if not in cookies
    if (!token && req.headers.authorization) {
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        }
    }


    if (!token) {
        return res.redirect("/auth/login");
    }


    // const isBlacklisted = await redis.get(`blacklist:${token}`);
    // if (isBlacklisted) {
    //     return res.status(403).send("Token has been revoked. Please log in again.");
    // }

    

    try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // console.log("decoded",decoded);

       
        req.user = await User.findById(decoded.uid).select("-password");
        // console.log("req.use",req.user)
    

        if (!req.user) {
            res.status(404);
            throw new Error("User not found.");
        }
           console.log("hello")
        next();
    } catch (err) {
        res.status(401);
        throw new Error(`Not authorized. Token failed: ${err.message}`);
    }
});

export default validToken

