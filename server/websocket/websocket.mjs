import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/user.mjs";
import Chat from "../models/chats.mjs";

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
  const rawChats = await Chat.find({
    $or: [{ senderId: userId }, { receiverId: userId }],
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
    const wasOnline = onlineUsers.has(userId);
    addSocketForUser(userId, socket.id);
    try {
      socket.join(String(userId));
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

    socket.on("sendMessage", async (data) => {
      try {
        const { receiverId, text, file, fileType } = data || {};
        if (!receiverId) throw new Error("receiverId required");
        if (!text && !file) throw new Error("Message content empty");
        const receiver = await User.findById(receiverId).select("_id");
        if (!receiver) throw new Error("Receiver not found");

        const newMessage = new Chat({
          senderId: userId,
          receiverId,
          text: text || "",
          file: file || null,
          fileType: fileType || null,
        });
        const savedMessage = await newMessage.save();
        await savedMessage.populate("senderId", "username email images isOnline lastSeen");
        await savedMessage.populate("receiverId", "username email images isOnline lastSeen");

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
        const messages = await Chat.find({
          $or: [
            { senderId: userId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: userId },
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

    socket.on("initiateCall", ({ to, from, callType }) => {
      const targets = onlineUsers.get(to) || new Set();
      for (const sid of targets) {
        io.to(sid).emit("incomingCall", { from, callType, socketId: socket.id });
      }
      if (targets.size === 0) socket.emit("userNotAvailable", { message: "User is offline" });
    });

    socket.on("sendOffer", ({ to, offer }) => {
      const targets = onlineUsers.get(to) || new Set();
      for (const sid of targets) io.to(sid).emit("receiveOffer", { offer, from: socket.id });
    });

    socket.on("sendAnswer", ({ to, answer }) => {
      const targets = onlineUsers.get(to) || new Set();
      for (const sid of targets) io.to(sid).emit("receiveAnswer", { answer, from: socket.id });
    });

    socket.on("sendIceCandidate", ({ to, candidate }) => {
      const targets = onlineUsers.get(to) || new Set();
      for (const sid of targets) io.to(sid).emit("receiveIceCandidate", { candidate });
    });

    socket.on("callAccepted", ({ to }) => {
      const targets = onlineUsers.get(to) || new Set();
      for (const sid of targets) io.to(sid).emit("callStarted");
    });

    socket.on("callRejected", ({ to }) => {
      const targets = onlineUsers.get(to) || new Set();
      for (const sid of targets) io.to(sid).emit("callRejected");
    });

    socket.on("endCall", ({ to }) => {
      const targets = onlineUsers.get(to) || new Set();
      for (const sid of targets) io.to(sid).emit("callEnded");
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
