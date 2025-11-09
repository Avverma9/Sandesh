import userRoute from "./user.mjs";
import emailRoute from "../auth/emailOtp.mjs";
import contactsRoute from "./contacts.mjs";
import adminRoute from "./admin.mjs";
import chatRoute from "./chat.mjs";
import express from "express";
const router = express.Router();

router.use("/users", userRoute);
router.use("/auth", emailRoute);
router.use("/contacts", contactsRoute);
router.use("/admin", adminRoute);
router.use("/chats", chatRoute);
export default router;
