import mongoose from 'mongoose';
import Chat from '../models/chats.mjs';
import User from '../models/user.mjs';
import { getIO, emitMyChatsToUser } from '../websocket/websocket.mjs';

export const sendMessage = async (req, res) => {
  try {
    const { receiverId, text, fileType } = req.body;
    const senderId = req.user.userId;
    if (!receiverId) return res.status(400).json({ message: 'receiverId is required' });
    if (!text && !req.file) return res.status(400).json({ message: 'Message content empty' });

    let file = null;
    if (req.file) {
      file = {
        url: req.file.path.replace(/\\/g, '/'),
        type: fileType,
        name: req.file.originalname,
        size: req.file.size,
      };
    }

    // Validate receiver exists
    const receiverExists = await User.exists({ _id: receiverId });
    if (!receiverExists) return res.status(404).json({ message: 'Receiver not found' });

    // Save the message
    const message = await new Chat({ senderId, receiverId, text: text || '', file }).save();
    await message.populate('senderId', 'username email images isOnline lastSeen');
    await message.populate('receiverId', 'username email images isOnline lastSeen');

    // Emit via WebSocket rooms (userId rooms are joined in websocket setup)
    const io = getIO?.();
    if (io) {
      io.to(String(senderId)).emit('messageSent', message);
      io.to(String(senderId)).emit('newMessage', message);
      io.to(String(receiverId)).emit('receiveMessage', message);
      io.to(String(receiverId)).emit('newMessage', message);
      
      // Update my-chats for both users in real-time
      await emitMyChatsToUser(io, senderId);
      await emitMyChatsToUser(io, receiverId);
    }

    console.log(`📩 REST Message sent from ${senderId} to ${receiverId}`);
    return res.status(201).json({ success: true, message: 'Message sent', data: message });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send message', error: error.message });
  }
};

// Get messages between two users (paginated)
// Removed duplicate APIs: getMessages, getChat, deleteMessage