import { Router } from "express";
import { authMiddleware } from "../auth/jwt.mjs";
import { batchSyncSentRequests } from "../utils/syncRequests.mjs";

const router = Router();

// Admin route to sync sentRequests
router.post("/sync-requests", authMiddleware, async (req, res) => {
  try {
    // Optional: Add admin check here
    // if (!req.user.isAdmin) return res.status(403).json({ message: "Unauthorized" });
    
    const { userIds } = req.body;
    const results = await batchSyncSentRequests(userIds);
    
    res.json({
      message: "Sent requests synchronized",
      results
    });
  } catch (error) {
    console.error("Error syncing sent requests:", error);
    res.status(500).json({
      message: "Failed to sync sent requests",
      error: error.message
    });
  }
});

export default router;
