import express from "express";
import { authMiddleware } from "../auth/jwt.mjs";
import {
  initiateCall,
  acceptCall,
  rejectCall,
  endCall,
  getCallHistory,
  getMissedCalls,
  deleteCallHistory,
} from "../controllers/calls.mjs";

const router = express.Router();

router.post("/initiate", authMiddleware, initiateCall);
router.post("/accept", authMiddleware, acceptCall);
router.post("/reject", authMiddleware, rejectCall);
router.post("/end", authMiddleware, endCall);
router.get("/history", authMiddleware, getCallHistory);
router.get("/missed", authMiddleware, getMissedCalls);
router.delete("/history/:callId", authMiddleware, deleteCallHistory);

export default router;
