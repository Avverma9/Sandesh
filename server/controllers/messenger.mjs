import mongoose from 'mongoose';
import Chat from '../models/chats.mjs';
import User from '../models/user.mjs';
import { getIO, emitMyChatsToUser } from '../websocket/websocket.mjs';
import { upsertChatSettingRecord, getChatSettingForUsers } from '../utils/chatSettings.mjs';

export const upsertChatSetting = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { partnerId, mode, timerSeconds } = req.body || {};

    if (!partnerId) {
      return res.status(400).json({ success: false, message: 'partnerId is required' });
    }

    if (String(partnerId) === String(userId)) {
      return res.status(400).json({ success: false, message: 'Cannot configure chat with yourself' });
    }

    const partnerExists = await User.exists({ _id: partnerId });
    if (!partnerExists) {
      return res.status(404).json({ success: false, message: 'Partner user not found' });
    }

    let chatSetting;
    try {
      chatSetting = await upsertChatSettingRecord({
        initiatorId: userId,
        partnerId,
        mode,
        timerSeconds,
      });
    } catch (error) {
      if (error.statusCode === 400) {
        return res.status(400).json({ success: false, message: error.message });
      }
      throw error;
    }

    const io = getIO?.();
    if (io) {
      const payload = chatSetting.toObject();
      io.to(String(userId)).emit('chatSettingsUpdated', payload);
      io.to(String(partnerId)).emit('chatSettingsUpdated', payload);
    }

    return res.status(200).json({ success: true, data: chatSetting });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update chat settings', error: error.message });
  }
};

export const getChatSetting = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { userId: partnerId } = req.params;

    if (!partnerId) {
      return res.status(400).json({ success: false, message: 'userId param is required' });
    }

    const setting = await getChatSettingForUsers(userId, partnerId);
    if (!setting) {
      return res.status(200).json({ success: true, data: null });
    }

    return res.status(200).json({ success: true, data: setting });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch chat settings', error: error.message });
  }
};

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

    const now = new Date();
    const chatSetting = await getChatSettingForUsers(senderId, receiverId);
    const chatMode = chatSetting?.mode || 'standard';
    const timerSeconds = chatSetting?.timerSeconds ? Number(chatSetting.timerSeconds) : null;

    if (chatMode === 'temporary') {
      const payload = {
        _id: new mongoose.Types.ObjectId(),
        senderId,
        receiverId,
        text: text || '',
        file,
        modeSnapshot: 'temporary',
        isTemporary: true,
        createdAt: now,
        updatedAt: now,
        expiresInSeconds: timerSeconds || null,
      };

      const io = getIO?.();
      if (io) {
        io.to(String(senderId)).emit('temporaryMessageSent', payload);
        io.to(String(receiverId)).emit('temporaryMessageReceived', payload);
      }

      return res.status(200).json({
        success: true,
        message: 'Temporary message delivered',
        data: payload,
      });
    }

    let expiresAt = null;
    if (timerSeconds && timerSeconds > 0) {
      expiresAt = new Date(now.getTime() + timerSeconds * 1000);
    }

    // Save the message
    const message = await new Chat({
      senderId,
      receiverId,
      text: text || '',
      file,
      modeSnapshot: chatMode,
      expiresAt,
    }).save();
    await message.populate('senderId', 'username email images isOnline lastSeen');
    await message.populate('receiverId', 'username email images isOnline lastSeen');

    if (chatSetting) {
      chatSetting.lastMessageAt = now;
      chatSetting.expiresAt = expiresAt;
      chatSetting.updatedBy = senderId;
      await chatSetting.save();
    }

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