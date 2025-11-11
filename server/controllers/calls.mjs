import CallHistory from "../models/callHistory.mjs";
import User from "../models/user.mjs";
import { getIO } from "../websocket/websocket.mjs";

export const initiateCall = async (req, res) => {
  try {
    const { receiverId, callType } = req.body;
    const callerId = req.user.userId;

    if (!receiverId) {
      return res.status(400).json({ success: false, message: "receiverId is required" });
    }

    if (!["audio", "video"].includes(callType)) {
      return res.status(400).json({ success: false, message: "callType must be 'audio' or 'video'" });
    }

    if (String(receiverId) === String(callerId)) {
      return res.status(400).json({ success: false, message: "Cannot call yourself" });
    }

    const receiver = await User.findById(receiverId).select("_id username email isOnline");
    if (!receiver) {
      return res.status(404).json({ success: false, message: "Receiver not found" });
    }

    const callRecord = await new CallHistory({
      callerId,
      receiverId,
      callType,
      status: "no-answer",
    }).save();

    await callRecord.populate("callerId", "username email images isOnline");
    await callRecord.populate("receiverId", "username email images isOnline");

    const io = getIO?.();
    if (io) {
      io.to(String(receiverId)).emit("incomingCall", {
        callId: String(callRecord._id),
        callerId: String(callerId),
        callType,
        caller: callRecord.callerId,
      });
    }

    return res.status(201).json({
      success: true,
      message: "Call initiated",
      data: callRecord,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to initiate call",
      error: error.message,
    });
  }
};

export const acceptCall = async (req, res) => {
  try {
    const { callId } = req.body;
    const userId = req.user.userId;

    if (!callId) {
      return res.status(400).json({ success: false, message: "callId is required" });
    }

    const callRecord = await CallHistory.findById(callId);
    if (!callRecord) {
      return res.status(404).json({ success: false, message: "Call not found" });
    }

    if (String(callRecord.receiverId) !== String(userId)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (callRecord.status !== "no-answer") {
      return res.status(400).json({ success: false, message: "Call already processed" });
    }

    callRecord.status = "completed";
    callRecord.startedAt = new Date();
    await callRecord.save();

    const io = getIO?.();
    if (io) {
      io.to(String(callRecord.callerId)).emit("callAccepted", {
        callId: String(callRecord._id),
        receiverId: String(userId),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Call accepted",
      data: callRecord,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to accept call",
      error: error.message,
    });
  }
};

export const rejectCall = async (req, res) => {
  try {
    const { callId } = req.body;
    const userId = req.user.userId;

    if (!callId) {
      return res.status(400).json({ success: false, message: "callId is required" });
    }

    const callRecord = await CallHistory.findById(callId);
    if (!callRecord) {
      return res.status(404).json({ success: false, message: "Call not found" });
    }

    if (String(callRecord.receiverId) !== String(userId)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (callRecord.status !== "no-answer") {
      return res.status(400).json({ success: false, message: "Call already processed" });
    }

    callRecord.status = "rejected";
    callRecord.endedAt = new Date();
    await callRecord.save();

    const io = getIO?.();
    if (io) {
      io.to(String(callRecord.callerId)).emit("callRejected", {
        callId: String(callRecord._id),
        receiverId: String(userId),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Call rejected",
      data: callRecord,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to reject call",
      error: error.message,
    });
  }
};

export const endCall = async (req, res) => {
  try {
    const { callId } = req.body;
    const userId = req.user.userId;

    if (!callId) {
      return res.status(400).json({ success: false, message: "callId is required" });
    }

    const callRecord = await CallHistory.findById(callId);
    if (!callRecord) {
      return res.status(404).json({ success: false, message: "Call not found" });
    }

    const isParticipant =
      String(callRecord.callerId) === String(userId) ||
      String(callRecord.receiverId) === String(userId);

    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (callRecord.endedAt) {
      return res.status(400).json({ success: false, message: "Call already ended" });
    }

    callRecord.endedAt = new Date();
    if (callRecord.startedAt) {
      callRecord.duration = Math.floor(
        (callRecord.endedAt - callRecord.startedAt) / 1000
      );
    }

    if (callRecord.status === "no-answer") {
      const isCaller = String(callRecord.callerId) === String(userId);
      callRecord.status = isCaller ? "cancelled" : "missed";
    }

    await callRecord.save();

    const io = getIO?.();
    if (io) {
      const otherUserId =
        String(callRecord.callerId) === String(userId)
          ? String(callRecord.receiverId)
          : String(callRecord.callerId);

      io.to(otherUserId).emit("callEnded", {
        callId: String(callRecord._id),
        endedBy: String(userId),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Call ended",
      data: callRecord,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to end call",
      error: error.message,
    });
  }
};

export const getCallHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { type, limit = 50, skip = 0 } = req.query;

    const query = {
      $or: [{ callerId: userId }, { receiverId: userId }],
    };

    if (type && ["audio", "video"].includes(type)) {
      query.callType = type;
    }

    const calls = await CallHistory.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .populate("callerId", "username email images isOnline")
      .populate("receiverId", "username email images isOnline")
      .lean();

    const enrichedCalls = calls.map((call) => {
      const isOutgoing = String(call.callerId._id) === String(userId);
      return {
        ...call,
        direction: isOutgoing ? "outgoing" : "incoming",
        isMissed: !isOutgoing && call.status === "missed",
      };
    });

    return res.status(200).json({
      success: true,
      data: enrichedCalls,
      hasMore: calls.length === Number(limit),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch call history",
      error: error.message,
    });
  }
};

export const getMissedCalls = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 20, skip = 0 } = req.query;

    const calls = await CallHistory.find({
      receiverId: userId,
      status: "missed",
    })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .populate("callerId", "username email images isOnline")
      .populate("receiverId", "username email images isOnline")
      .lean();

    return res.status(200).json({
      success: true,
      data: calls,
      hasMore: calls.length === Number(limit),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch missed calls",
      error: error.message,
    });
  }
};

export const deleteCallHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { callId } = req.params;

    if (!callId) {
      return res.status(400).json({ success: false, message: "callId is required" });
    }

    const callRecord = await CallHistory.findById(callId);
    if (!callRecord) {
      return res.status(404).json({ success: false, message: "Call not found" });
    }

    const isParticipant =
      String(callRecord.callerId) === String(userId) ||
      String(callRecord.receiverId) === String(userId);

    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    await CallHistory.findByIdAndDelete(callId);

    return res.status(200).json({
      success: true,
      message: "Call history deleted",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete call history",
      error: error.message,
    });
  }
};
