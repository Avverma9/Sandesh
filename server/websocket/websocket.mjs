import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/user.mjs';
import Chat from '../models/chats.mjs';

// onlineUsers: userId -> Set(socketIds)
const onlineUsers = new Map();

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

// Build "my chats" list similar to GET /api/chats/my-chats and add direction flags
async function buildMyChats(userId) {
  const rawChats = await Chat.find({
    $or: [{ senderId: userId }, { receiverId: userId }],
  })
    .sort({ createdAt: -1 })
    .populate('senderId', 'username email images isOnline lastSeen')
    .populate('receiverId', 'username email images isOnline lastSeen')
    .limit(100);

  return rawChats.map((doc) => {
    const obj = doc.toObject();
    const isSender = obj?.senderId?._id?.toString() === String(userId);
    return {
      ...obj,
      isSender,
      direction: isSender ? 'outgoing' : 'incoming',
    };
  });
}

export async function emitMyChatsToUser(io, userId) {
  try {
    const chats = await buildMyChats(userId);
    io.to(String(userId)).emit('myChats', chats);
  } catch (e) {
    console.error('emitMyChatsToUser error:', e.message);
  }
}

let ioRef = null;
export const getIO = () => ioRef;

export const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: '*', // tighten in production
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });
  ioRef = io;

  // Auth middleware for socket handshake
  io.use(async (socket, next) => {
    try {
      const authToken = socket.handshake.auth?.token || socket.handshake.headers?.authorization || socket.handshake.query?.token;
      let token = authToken;
      if (token && typeof token === 'string' && token.startsWith('Bearer ')) token = token.substring(7);
      if (!token) return next(new Error('Unauthorized: token missing'));
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        return next(new Error('Unauthorized: token invalid'));
      }
      const user = await User.findById(decoded.userId);
      if (!user) return next(new Error('Unauthorized: user not found'));
      if (user.accountStatus === 'banned') return next(new Error('Forbidden: user banned'));
      socket.userId = decoded.userId;
      socket.userPayload = decoded;
      next();
    } catch (err) {
      next(err);
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`🟢 Socket connected ${socket.id} for user ${userId}`);

    // Mark online if first socket
    const wasOnline = onlineUsers.has(userId);
    addSocketForUser(userId, socket.id);
  // Join a personal room for targeted emits from REST
  try { socket.join(userId); } catch {}
    if (!wasOnline) {
      try {
        await User.findByIdAndUpdate(userId, { isOnline: true });
      } catch (e) {
        console.error('Error setting user online:', e.message);
      }
      socket.broadcast.emit('userOnline', { userId, isOnline: true });
    }

    // Send current online users list to the connecting user
    socket.emit('onlineUsers', getAllOnlineUserIds());

  // Also send initial my-chats for this user
  emitMyChatsToUser(io, userId);

    // MESSAGE SEND
    socket.on('sendMessage', async (data) => {
      try {
        const { receiverId, text, file } = data;
        if (!receiverId) throw new Error('receiverId required');
        if (!text && !file) throw new Error('Message content empty');

        // Validate receiver exists
        const receiver = await User.findById(receiverId).select('_id');
        if (!receiver) throw new Error('Receiver not found');

        const newMessage = new Chat({
          senderId: userId,
          receiverId,
          text: text || '',
          file: file || null,
        });
        const savedMessage = await newMessage.save();
        await savedMessage.populate('senderId', 'username email images isOnline lastSeen');
        await savedMessage.populate('receiverId', 'username email images isOnline lastSeen');

        // Emit to all sender sockets (if multiple tabs)
        const senderSockets = onlineUsers.get(userId) || new Set();
        senderSockets.forEach(sid => {
          io.to(sid).emit('messageSent', savedMessage);
          io.to(sid).emit('newMessage', savedMessage);
        });

        // Emit to all receiver sockets
        const receiverSockets = onlineUsers.get(receiverId) || new Set();
        receiverSockets.forEach(sid => {
          io.to(sid).emit('receiveMessage', savedMessage);
          io.to(sid).emit('newMessage', savedMessage);
        });

        console.log(`💬 Message saved sender=${userId} receiver=${receiverId}`);

        // Update my-chats for both participants in real-time
        emitMyChatsToUser(io, userId);
        emitMyChatsToUser(io, receiverId);
      } catch (err) {
        console.error('❌ sendMessage error:', err.message);
        socket.emit('messageError', { error: err.message });
      }
    });

    // Client can request latest my-chats explicitly
    socket.on('getMyChats', async () => {
      await emitMyChatsToUser(io, userId);
    });

    // TYPING
    socket.on('typing', (data) => {
      try {
        const { receiverId, isTyping } = data || {};
        if (!receiverId) return;
        const receiverSockets = onlineUsers.get(receiverId) || new Set();
        receiverSockets.forEach(sid => io.to(sid).emit('userTyping', { userId, isTyping: !!isTyping }));
      } catch (e) {
        console.error('typing event error:', e.message);
      }
    });

    // CHAT HISTORY
    socket.on('getChatHistory', async (data) => {
      try {
        const { otherUserId, limit = 50, skip = 0 } = data || {};
        if (!otherUserId) throw new Error('otherUserId required');
        const messages = await Chat.find({
          $or: [
            { senderId: userId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: userId },
          ],
        })
          .sort({ createdAt: -1 })
          .limit(limit)
          .skip(skip)
          .populate('senderId', 'username email images isOnline lastSeen')
          .populate('receiverId', 'username email images isOnline lastSeen');
        socket.emit('chatHistory', messages.reverse());
      } catch (err) {
        console.error('❌ getChatHistory error:', err.message);
        socket.emit('chatHistoryError', { error: err.message });
      }
    });

    // MESSAGE READ (placeholder)
    socket.on('messageRead', async (data) => {
      try {
        const { messageId } = data || {};
        if (!messageId) return;
        console.log(`✓ Message ${messageId} read by ${userId}`);
      } catch (e) {
        console.error('messageRead error:', e.message);
      }
    });

    // DISCONNECT
    socket.on('disconnect', async () => {
      removeSocketForUser(userId, socket.id);
      const stillOnline = onlineUsers.has(userId);
      console.log(`🔴 Socket ${socket.id} disconnected for user ${userId}. Remaining sockets: ${stillOnline ? onlineUsers.get(userId).size : 0}`);
      if (!stillOnline) {
        try {
          await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });
        } catch (e) {
          console.error('Error marking offline:', e.message);
        }
        socket.broadcast.emit('userOnline', { userId, isOnline: false, lastSeen: new Date() });
      }
    });
  });

  return io;
};