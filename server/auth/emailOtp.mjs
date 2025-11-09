import express from "express";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import sendEmail from "../sendEmail.mjs";
import User from "../models/user.mjs";

dotenv.config();
const router = express.Router();

const isProd = process.env.NODE_ENV === "production";

/**
 * In-memory OTP store:
 * { [email]: { code: "1234", expiresAt: number, attempts: number } }
 * NOTE: consider Redis for production / multi-instance.
 */
const otpStore = Object.create(null);

// Using shared sendEmail helper (config comes from env via sendEmail.mjs)

// --- Helpers ---
const normalizeEmail = (e) => String(e || "").trim().toLowerCase();
const generateOtp = () => String(Math.floor(1000 + Math.random() * 9000)); // 4-digit
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_MAX_ATTEMPTS = 5;

// --- Routes ---
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

    // Store structured OTP record expected by the verify route
    // store using normalized email as key
    otpStore[email] = {
      code: String(otp),
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
    };

    // Use shared sendEmail helper which reads SMTP config from env
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

    // OTP valid -> consume
    delete otpStore[email];

  const payload = { userId: user._id.toString(), email: user.email };

    // Short-lived Access Token
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    // Long-lived Refresh Token
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: "30d",
    });

    // Persist refresh token against the user (optional: store hash)
    user.refreshToken = refreshToken;
    await user.save();

    // Set cookies
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return res.status(200).json({
      message: "OTP verified successfully",
      accessToken,   // if you prefer, omit from body since it's in cookie
      refreshToken,  // same note as above
      user
    });
  } catch (err) {
    console.error("Error verifying email OTP:", err);
    return res
      .status(500)
      .json({ message: "Failed to verify OTP", error: err.message });
  }
});

export default router;
