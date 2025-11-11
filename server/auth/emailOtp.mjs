import express from "express";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import sendEmail from "../sendEmail.mjs";
import User from "../models/user.mjs";

dotenv.config();
const router = express.Router();

const isProd = process.env.NODE_ENV === "production";
const googleClientIds = (process.env.GOOGLE_CLIENT_ID || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

const googleAuthClients = googleClientIds.map((id) => ({
  id,
  client: new OAuth2Client(id),
}));

const decodeJwtWithoutVerify = (token) => {
  if (!token || typeof token !== "string") return null;
  const segments = token.split(".");
  if (segments.length < 2) return null;

  try {
    const base64 = segments[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json);
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Failed to decode Google JWT payload", err);
    }
    return null;
  }
};

const otpStore = Object.create(null);

const normalizeEmail = (e) => String(e || "").trim().toLowerCase();
const generateOtp = () => String(Math.floor(1000 + Math.random() * 9000));
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

const ensureUniqueUsername = async (base) => {
  const sanitizedBase = base || `User${Date.now()}`;
  let username = sanitizedBase;
  let suffix = 0;

  while (await User.exists({ username })) {
    suffix += 1;
    username = `${sanitizedBase}${suffix}`;
  }

  return username;
};

const issueTokens = async (res, user) => {
  const payload = { userId: user._id.toString(), email: user.email };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "30d",
  });

  user.refreshToken = refreshToken;
  await user.save();

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    maxAge: 15 * 60 * 1000,
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  return { accessToken, refreshToken };
};

router.post("/send-otp", async (req, res) => {
  try {
    const { email: rawEmail } = req.body;
    const email = normalizeEmail(rawEmail);

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    const findUser = await User.findOne({ email });
    if (!findUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const otp = Math.floor(1000 + Math.random() * 9000);

    otpStore[email] = {
      code: String(otp),
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
    };

    await sendEmail({
      email,
      subject: "OTP Verification",
      message: `Your OTP is: ${otp}`,
    });

    res.json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error sending email OTP:", error);
    res
      .status(500)
      .json({ message: "Failed to send OTP", error: error.message });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp || "");

    if (!email || !otp)
      return res.status(400).json({ message: "Email and OTP required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const record = otpStore[email];
    if (!record)
      return res.status(400).json({ message: "OTP not found or expired" });

    if (Date.now() > record.expiresAt) {
      delete otpStore[email];
      return res.status(400).json({ message: "OTP expired" });
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      delete otpStore[email];
      return res.status(429).json({ message: "Too many attempts. OTP reset." });
    }

    record.attempts += 1;
    if (record.code !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    delete otpStore[email];

    const { accessToken, refreshToken } = await issueTokens(res, user);

    return res.status(200).json({
      message: "OTP verified successfully",
      accessToken,
      refreshToken,
      user,
    });
  } catch (err) {
    console.error("Error verifying email OTP:", err);
    return res
      .status(500)
      .json({ message: "Failed to verify OTP", error: err.message });
  }
});

router.post("/google-login", async (req, res) => {
  try {
    const token = req.body.credential;
    if (!token) {
      return res.status(400).json({ message: "Token required" });
    }

    const payloadBase64 = token.split(".")[1];
    const decoded = JSON.parse(
      Buffer.from(payloadBase64, "base64").toString("utf8")
    );

    const { name, email: rawEmail, picture } = decoded;
    const email = normalizeEmail(rawEmail);

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    let user = await User.findOne({ email });

    if (!user) {
      const username = await ensureUniqueUsername(name);
      user = await User.create({
        name,
        email,
        username,
        images: picture ? [picture] : [],
      });
    }

    const { accessToken, refreshToken } = await issueTokens(res, user);

    return res.status(200).json({
      message: "Login successful",
      accessToken,
      refreshToken,
      user,
    });
  } catch (err) {
    console.error("Error in Google login:", err);
    return res
      .status(500)
      .json({ message: "Login failed", error: err.message });
  }
});

export default router;