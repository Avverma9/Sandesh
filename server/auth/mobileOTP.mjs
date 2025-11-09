// routes/mobileOtp.routes.mjs
import express from "express";
import dotenv from "dotenv";
import twilio from "twilio";
import { asyncHandler } from "../asyncHandler.mjs";
import User from "../models/user.mjs";

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken  = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_SERVICE_SID;

if (!accountSid || !authToken || !serviceSid) {
  throw new Error("Missing Twilio env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SERVICE_SID");
}

const client = twilio(accountSid, authToken);
const router = express.Router();

/** ---- Helpers ---- */
const normalizeMobile = (m) => String(m || "").trim();

/**
 * (Optional) minimal E.164 check.
 * Twilio Verify expects E.164 (e.g. +919876543210). Adjust to your needs.
 */
const isE164 = (m) => /^\+\d{8,15}$/.test(m);

/** ---- Twilio service functions ---- */
export const sendOTP = asyncHandler(async (mobile) => {
  const verification = await client.verify.v2
    .services(serviceSid)
    .verifications.create({ to: mobile, channel: "sms" });

  return {
    success: true,
    sid: verification.sid,
    status: verification.status, // "pending"
  };
});

export const verifyOTP = asyncHandler(async (mobile, code) => {
  const verificationCheck = await client.verify.v2
    .services(serviceSid)
    .verificationChecks.create({ to: mobile, code });

  return {
    success: verificationCheck.status === "approved",
    status: verificationCheck.status, // "approved" | "pending" | "canceled"
  };
});

/** ---- Routes ---- */
router.post(
  "/send-mobile-otp",
  asyncHandler(async (req, res) => {
    const mobileRaw = req.body?.mobile;
    const mobile = normalizeMobile(mobileRaw);

    if (!mobile) {
      return res.status(400).json({ success: false, error: "Phone number is required" });
    }
    if (!isE164(mobile)) {
      return res.status(400).json({ success: false, error: "Phone must be in E.164 format, e.g. +919876543210" });
    }

    const user = await User.findOne({ mobile });
    if (!user) {
      return res.status(404).json({ success: false, error: "Phone number not registered" });
    }

    try {
      const response = await sendOTP(mobile);
      return res.json(response);
    } catch (err) {
      // Twilio error surfaces in err.message
      console.error("Error sending OTP:", err);
      return res.status(500).json({ success: false, error: "Failed to send OTP", details: err.message });
    }
  })
);

router.post(
  "/verify-mobile-otp",
  asyncHandler(async (req, res) => {
    const mobileRaw = req.body?.mobile;
    const codeRaw = req.body?.code;

    const mobile = normalizeMobile(mobileRaw);
    const code = String(codeRaw ?? "").trim();

    if (!mobile || !code) {
      return res.status(400).json({ success: false, error: "Phone number and code are required" });
    }
    if (!isE164(mobile)) {
      return res.status(400).json({ success: false, error: "Phone must be in E.164 format, e.g. +919876543210" });
    }

    const user = await User.findOne({ mobile });
    if (!user) {
      return res.status(404).json({ success: false, error: "Phone number not registered" });
    }

    try {
      const response = await verifyOTP(mobile, code);
      return res.json(response);
    } catch (err) {
      console.error("Error verifying OTP:", err);
      return res.status(500).json({ success: false, error: "Failed to verify OTP", details: err.message });
    }
  })
);

export default router;
