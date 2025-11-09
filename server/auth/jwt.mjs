import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import User from "../models/user.mjs";
import dotenv from "dotenv";

dotenv.config();

export const authMiddleware = asyncHandler(async (req, res, next) => {
  let token = req.headers.authorization;

  if (token && token.startsWith("Bearer ")) {
    token = token.substring(7);
  }

  if (!token) {
    token = req.cookies?.accessToken;
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: "Token invalid or expired" });
  }

  const user = await User.findById(decoded.userId);

  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }

  if (user.accountStatus === "banned") {
    return res.status(403).json({
      message: "Your account has been blocked. Please contact support."
    });
  }

  req.user = decoded;
  next();
});

export const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      email: user.email,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d",
    }
  );
};
