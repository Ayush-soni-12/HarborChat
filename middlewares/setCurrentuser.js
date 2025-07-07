import jwt from "jsonwebtoken";
import User from "../modals/UserModal.js";

const setCurrentUser = async (req, res, next) => {
     let token = req.cookies.jwt;

    // Check for token in Authorization header if not in cookies
    if (!token && req.headers.authorization) {
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        }
    }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // console.log(decoded)
      const user = await User.findById(decoded.uid).select("-password");
      // console.log(user)
      res.locals.currentUser = user;
    } catch {
      res.locals.currentUser = null;
    }
  } else {
    res.locals.currentUser = null;
  }

  next();
};

 export default  setCurrentUser;