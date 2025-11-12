import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/user.mjs";
import Chat from "../models/chats.mjs";
import CallHistory from "../models/callHistory.mjs";
import {
  getChatSettingForUsers,
  upsertChatSettingRecord,
  expiryQueryFragment,
} from "../utils/chatSettings.mjs";

const onlineUsers = new Map(); // userId -> Set(socketIds)
let ioRef = null;

function addSocketForUser(userId, socketId) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
}

function removeSocketForUser(userId, socketId) {
  const set = onlineUsers.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) onlineUsers.delete(userId);
}

function getAllOnlineUserIds() {
  return Array.from(onlineUsers.keys());
}

async function buildMyChats(userId) {
  const now = new Date();
  const rawChats = await Chat.find({
    $and: [
      { $or: [{ senderId: userId }, { receiverId: userId }] },
      expiryQueryFragment(now),
    ],
  })
    .sort({ createdAt: -1 })
    .populate("senderId", "username email images isOnline lastSeen")
    .populate("receiverId", "username email images isOnline lastSeen")
    .limit(100);

  return rawChats.map((doc) => {
    const obj = doc.toObject();
    const isSender = obj?.senderId?._id?.toString() === String(userId);
    return { ...obj, isSender, direction: isSender ? "outgoing" : "incoming" };
  });
}

export async function emitMyChatsToUser(io, userId) {
  try {
    const chats = await buildMyChats(userId);
    io.to(String(userId)).emit("myChats", chats);
  } catch (e) {
    console.error("emitMyChatsToUser error:", e.message);
  }
}

export const getIO = () => ioRef;

export const setupSocket = (server) => {
  const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"], credentials: true },
  });
  ioRef = io;

  io.use(async (socket, next) => {
    try {
      const authToken =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization ||
        socket.handshake.query?.token;
      let token = authToken;
      if (token && typeof token === "string" && token.startsWith("Bearer "))
        token = token.substring(7);
      if (!token) return next(new Error("Unauthorized: token missing"));
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        return next(new Error("Unauthorized: token invalid"));
      }
      const user = await User.findById(decoded.userId);
      if (!user) return next(new Error("Unauthorized: user not found"));
      if (user.accountStatus === "banned") return next(new Error("Forbidden: user banned"));
      socket.userId = decoded.userId;
      socket.userPayload = decoded;
      next();
    } catch (err) {
      next(err);
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.userId;
    console.log(`[SOCKET] User connected: ${userId}, socket: ${socket.id}`);
    
    const wasOnline = onlineUsers.has(userId);
    addSocketForUser(userId, socket.id);
    
    console.log(`[SOCKET] Added user ${userId} to onlineUsers Map. Total online: ${onlineUsers.size}`);
    
    try {
      socket.join(String(userId));
      socket.join(`user:${userId}`); // Also join user:{id} room for cleaner targeting
    } catch {}

    if (!wasOnline) {
      try {
        await User.findByIdAndUpdate(userId, { isOnline: true });
      } catch (e) {
        console.error("Error setting user online:", e.message);
      }
      socket.broadcast.emit("userOnline", { userId, isOnline: true });
    }

    socket.emit("onlineUsers", getAllOnlineUserIds());
    emitMyChatsToUser(io, userId);

    socket.on("getChatSettings", async (data, callback) => {
      try {
        const partnerId = data?.partnerId;
        if (!partnerId) throw new Error("partnerId required");

        const setting = await getChatSettingForUsers(userId, partnerId);
        const payload = {
          success: true,
          data: setting ? setting.toObject() : null,
        };

        if (typeof callback === "function") {
          callback(payload);
        } else {
          socket.emit("chatSettings", { partnerId, ...payload });
        }
      } catch (err) {
        const errorPayload = { success: false, message: err.message };
        if (typeof callback === "function") {
          callback(errorPayload);
        } else {
          socket.emit("chatSettingsError", errorPayload);
        }
      }
    });

    socket.on("updateChatSettings", async (data, callback) => {
      try {
        const { partnerId, timerSeconds } = data || {};
        if (!partnerId) throw new Error("partnerId required");
        if (String(partnerId) === String(userId)) throw new Error("Cannot configure chat with yourself");

        const partnerExists = await User.exists({ _id: partnerId });
        if (!partnerExists) throw new Error("Partner user not found");

        let setting;
        try {
          setting = await upsertChatSettingRecord({
            initiatorId: userId,
            partnerId,
            timerSeconds,
          });
        } catch (err) {
          if (err.statusCode === 400) {
            const payload = { success: false, message: err.message };
            if (typeof callback === "function") {
              callback(payload);
            } else {
              socket.emit("chatSettingsError", payload);
            }
            return;
          }
          throw err;
        }

        const payload = { success: true, data: setting.toObject() };
        io.to(String(userId)).emit("chatSettingsUpdated", payload.data);
        io.to(String(partnerId)).emit("chatSettingsUpdated", payload.data);

        if (typeof callback === "function") {
          callback(payload);
        }
      } catch (err) {
        const payload = { success: false, message: err.message };
        if (typeof callback === "function") {
          callback(payload);
        } else {
          socket.emit("chatSettingsError", payload);
        }
      }
    });

    socket.on("sendMessage", async (data) => {
      try {
        const { receiverId, text, file, fileType } = data || {};
        if (!receiverId) throw new Error("receiverId required");
        if (!text && !file) throw new Error("Message content empty");
        const receiver = await User.findById(receiverId).select("_id");
        if (!receiver) throw new Error("Receiver not found");

        const now = new Date();
        const chatSetting = await getChatSettingForUsers(userId, receiverId);
        const timerSeconds = chatSetting?.timerSeconds
          ? Number(chatSetting.timerSeconds)
          : null;

        let expiresAt = null;
        if (timerSeconds && timerSeconds > 0) {
          expiresAt = new Date(now.getTime() + timerSeconds * 1000);
        }

        const newMessage = new Chat({
          senderId: userId,
          receiverId,
          text: text || "",
          file: file || null,
          fileType: fileType || null,
          expiresAt,
        });
        const savedMessage = await newMessage.save();
        await savedMessage.populate("senderId", "username email images isOnline lastSeen");
        await savedMessage.populate("receiverId", "username email images isOnline lastSeen");

        if (chatSetting) {
          chatSetting.lastMessageAt = now;
          chatSetting.expiresAt = expiresAt;
          chatSetting.updatedBy = userId;
          await chatSetting.save();
        }

        const senderSockets = onlineUsers.get(userId) || new Set();
        for (const sid of senderSockets) {
          io.to(sid).emit("messageSent", savedMessage);
          io.to(sid).emit("newMessage", savedMessage);
        }

        const receiverSockets = onlineUsers.get(receiverId) || new Set();
        for (const sid of receiverSockets) {
          io.to(sid).emit("receiveMessage", savedMessage);
          io.to(sid).emit("newMessage", savedMessage);
        }

        emitMyChatsToUser(io, userId);
        emitMyChatsToUser(io, receiverId);
      } catch (err) {
        console.error("sendMessage error:", err.message);
        socket.emit("messageError", { error: err.message });
      }
    });

    socket.on("getMyChats", async () => {
      await emitMyChatsToUser(io, userId);
    });

    socket.on("typing", (data) => {
      try {
        const { receiverId, isTyping } = data || {};
        if (!receiverId) return;
        const receiverSockets = onlineUsers.get(receiverId) || new Set();
        for (const sid of receiverSockets) {
          io.to(sid).emit("userTyping", { userId, isTyping: !!isTyping });
        }
      } catch (e) {
        console.error("typing event error:", e.message);
      }
    });

    socket.on("getChatHistory", async (data) => {
      try {
        const { otherUserId, limit = 50, skip = 0 } = data || {};
        if (!otherUserId) throw new Error("otherUserId required");
        const now = new Date();
        const messages = await Chat.find({
          $and: [
            {
              $or: [
                { senderId: userId, receiverId: otherUserId },
                { senderId: otherUserId, receiverId: userId },
              ],
            },
            expiryQueryFragment(now),
          ],
        })
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(skip)
          .populate("senderId", "username email images isOnline lastSeen")
          .populate("receiverId", "username email images isOnline lastSeen");
        socket.emit("chatHistory", messages.reverse());
      } catch (err) {
        console.error("getChatHistory error:", err.message);
        socket.emit("chatHistoryError", { error: err.message });
      }
    });

    socket.on("messageRead", async (data) => {
      try {
        const { messageId } = data || {};
        if (!messageId) return;
      } catch (e) {
        console.error("messageRead error:", e.message);
      }
    });

    socket.on("initiateCall", async ({ receiverId, callType }) => {
      try {
        console.log(`[CALL] initiateCall from ${userId} to ${receiverId} (type: ${callType})`);
        
        if (!receiverId) throw new Error("receiverId required");
        if (!["audio", "video"].includes(callType)) throw new Error("callType must be 'audio' or 'video'");

        const receiver = await User.findById(receiverId).select("_id username email isOnline");
        if (!receiver) {
          console.error(`[CALL] Receiver not found: ${receiverId}`);
          throw new Error("Receiver not found");
        }

        console.log(`[CALL] Receiver found: ${receiver.username} (${receiver._id})`);

        const callRecord = await new CallHistory({
          callerId: userId,
          receiverId,
          callType,
          status: "no-answer",
        }).save();

        await callRecord.populate("callerId", "username email images isOnline");
        await callRecord.populate("receiverId", "username email images isOnline");

        console.log(`[CALL] CallRecord created: ${callRecord._id}`);

        // Try both string versions of receiverId
        const receiverIdString = String(receiverId);
        const receiverIdFromDb = String(receiver._id);
        
        let receiverSockets = onlineUsers.get(receiverIdString) || onlineUsers.get(receiverIdFromDb) || new Set();
        
        console.log(`[CALL] Online users Map keys:`, Array.from(onlineUsers.keys()));
        console.log(`[CALL] Looking for receiverId: ${receiverIdString} or ${receiverIdFromDb}`);
        console.log(`[CALL] Found ${receiverSockets.size} socket(s) for receiver`);
        
        if (receiverSockets.size > 0) {
          for (const sid of receiverSockets) {
            console.log(`[CALL] Emitting incomingCall to socket: ${sid}`);
            io.to(sid).emit("incomingCall", {
              callId: String(callRecord._id),
              callerId: String(userId),
              callType,
              caller: callRecord.callerId,
            });
          }
        }

        socket.emit("callInitiated", {
          callId: String(callRecord._id),
          receiverId: String(receiverId),
          callType,
        });

        if (receiverSockets.size === 0) {
          console.log(`[CALL] User ${receiverId} is offline or not connected`);
          socket.emit("userNotAvailable", { message: "User is offline" });
        }
      } catch (err) {
        console.error("initiateCall error:", err.message);
        socket.emit("callError", { error: err.message });
      }
    });

    socket.on("acceptCall", async ({ callId }) => {
      try {
        if (!callId) throw new Error("callId required");

        const callRecord = await CallHistory.findById(callId);
        if (!callRecord) throw new Error("Call not found");

        if (String(callRecord.receiverId) !== String(userId)) {
          throw new Error("Not authorized");
        }

        if (callRecord.status !== "no-answer") {
          throw new Error("Call already processed");
        }

        callRecord.status = "completed";
        callRecord.startedAt = new Date();
        await callRecord.save();

        const callerSockets = onlineUsers.get(String(callRecord.callerId)) || new Set();
        for (const sid of callerSockets) {
          io.to(sid).emit("callAccepted", {
            callId: String(callRecord._id),
            receiverId: String(userId),
          });
        }

        socket.emit("callAcceptedConfirm", { callId: String(callRecord._id) });
      } catch (err) {
        console.error("acceptCall error:", err.message);
        socket.emit("callError", { error: err.message });
      }
    });

    socket.on("rejectCall", async ({ callId }) => {
      try {
        if (!callId) throw new Error("callId required");

        const callRecord = await CallHistory.findById(callId);
        if (!callRecord) throw new Error("Call not found");

        if (String(callRecord.receiverId) !== String(userId)) {
          throw new Error("Not authorized");
        }

        if (callRecord.status !== "no-answer") {
          throw new Error("Call already processed");
        }

        callRecord.status = "rejected";
        callRecord.endedAt = new Date();
        await callRecord.save();

        const callerSockets = onlineUsers.get(String(callRecord.callerId)) || new Set();
        for (const sid of callerSockets) {
          io.to(sid).emit("callRejected", {
            callId: String(callRecord._id),
            receiverId: String(userId),
          });
        }

        socket.emit("callRejectedConfirm", { callId: String(callRecord._id) });
      } catch (err) {
        console.error("rejectCall error:", err.message);
        socket.emit("callError", { error: err.message });
      }
    });

    socket.on("endCall", async ({ callId }) => {
      try {
        if (!callId) throw new Error("callId required");

        const callRecord = await CallHistory.findById(callId);
        if (!callRecord) throw new Error("Call not found");

        const isParticipant =
          String(callRecord.callerId) === String(userId) ||
          String(callRecord.receiverId) === String(userId);

        if (!isParticipant) throw new Error("Not authorized");

        if (callRecord.endedAt) {
          throw new Error("Call already ended");
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

        const otherUserId =
          String(callRecord.callerId) === String(userId)
            ? String(callRecord.receiverId)
            : String(callRecord.callerId);

        const otherSockets = onlineUsers.get(otherUserId) || new Set();
        for (const sid of otherSockets) {
          io.to(sid).emit("callEnded", {
            callId: String(callRecord._id),
            endedBy: String(userId),
          });
        }

        socket.emit("callEndedConfirm", { callId: String(callRecord._id) });
      } catch (err) {
        console.error("endCall error:", err.message);
        socket.emit("callError", { error: err.message });
      }
    });

    socket.on("sendOffer", ({ to, offer, callId }) => {
      const targets = onlineUsers.get(to) || new Set();
      for (const sid of targets) {
        io.to(sid).emit("receiveOffer", { offer, from: String(userId), callId });
      }
    });

    socket.on("sendAnswer", ({ to, answer, callId }) => {
      const targets = onlineUsers.get(to) || new Set();
      for (const sid of targets) {
        io.to(sid).emit("receiveAnswer", { answer, from: String(userId), callId });
      }
    });

    socket.on("sendIceCandidate", ({ to, candidate, callId }) => {
      const targets = onlineUsers.get(to) || new Set();
      for (const sid of targets) {
        io.to(sid).emit("receiveIceCandidate", { candidate, from: String(userId), callId });
      }
    });

    socket.on("disconnect", async () => {
      removeSocketForUser(userId, socket.id);
      const stillOnline = onlineUsers.has(userId);
      if (!stillOnline) {
        try {
          const lastSeen = new Date();
          await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });
          socket.broadcast.emit("userOnline", { userId, isOnline: false, lastSeen });
        } catch (e) {
          console.error("Error marking offline:", e.message);
        }
      }
    });
  });

  return io;
};
