import jwt from "jsonwebtoken";
import User from "../models/user.mjs";

// Optional authentication middleware - won't block requests without tokens
export const optionalAuthMiddleware = async (req, res, next) => {
  let token = req.headers.authorization;

  if (token && token.startsWith("Bearer ")) {
    token = token.substring(7);
  }

  if (!token) {
    token = req.cookies?.accessToken;
  }

  // If no token, just continue without setting user info
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (user) {
      req.user = decoded;
    }
    
    next();
  } catch (err) {
    // Just continue without setting user info if token is invalid
    next();
  }
};
