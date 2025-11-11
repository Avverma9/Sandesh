import express from 'express';
import mongoose from 'mongoose';
import Chat from '../models/chats.mjs';
import { authMiddleware } from '../auth/jwt.mjs';
import { sendMessage, upsertChatSetting, getChatSetting } from '../controllers/messenger.mjs';
import { expiryQueryFragment } from '../utils/chatSettings.mjs';
import { getIO } from '../websocket/websocket.mjs';

const router = express.Router();

/**
 * Get all chats for a user
 */
router.get('/my-chats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const now = new Date();
    const expiryClause = expiryQueryFragment(now);
    const rawChats = await Chat.find({
      $and: [
        { $or: [{ senderId: userId }, { receiverId: userId }] },
        expiryClause,
      ],
    })
      .sort({ createdAt: -1 })
      .populate('senderId', 'username email images isOnline lastSeen')
      .populate('receiverId', 'username email images isOnline lastSeen')
      .limit(100);
    const chats = rawChats.map(doc => {
      const obj = doc.toObject({ getters: false, virtuals: false });
      const isSender = obj.senderId && obj.senderId._id && obj.senderId._id.toString() === userId;
      return {
        ...obj,
        isSender,
        direction: isSender ? 'outgoing' : 'incoming'
      };
    });
    
    // Also emit via Socket.IO for real-time updates
    const io = getIO?.();
    if (io) {
      io.to(String(userId)).emit('myChats', chats);
    }
    
    res.json({ success: true, chats });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch chats', 
      error: err.message 
    });
  }
});

/**
 * Get chat history with a specific user
 */
router.get('/history/:userId', authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const otherUserId = req.params.userId;
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;

    const now = new Date();
    const expiryClause = expiryQueryFragment(now);
    const rawMessages = await Chat.find({
      $and: [
        {
          $or: [
            { senderId: currentUserId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: currentUserId },
          ],
        },
        expiryClause,
      ],
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .populate('senderId', 'username email images isOnline lastSeen')
      .populate('receiverId', 'username email images isOnline lastSeen');
    const ordered = rawMessages.reverse();
    const messages = ordered.map(doc => {
      const obj = doc.toObject();
      const isSender = obj.senderId && obj.senderId._id && obj.senderId._id.toString() === currentUserId;
      return {
        ...obj,
        isSender,
        direction: isSender ? 'outgoing' : 'incoming'
      };
    });
    res.json({ 
      success: true, 
      messages,
      hasMore: rawMessages.length === limit,
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch chat history', 
      error: err.message 
    });
  }
});

/**
 * Delete a chat message
 */
router.delete('/:messageId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const messageId = req.params.messageId;

    const message = await Chat.findById(messageId);
    
    if (!message) {
      return res.status(404).json({ 
        success: false, 
        message: 'Message not found' 
      });
    }

    // Only sender can delete
    if (message.senderId.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to delete this message' 
      });
    }

    await Chat.findByIdAndDelete(messageId);

    const io = getIO?.();
    if (io) {
      const payload = { messageId: String(message._id), auto: false };
      io.to(String(message.senderId)).emit('messageDeleted', payload);
      io.to(String(message.receiverId)).emit('messageDeleted', payload);
      console.log(`🗑️ messageDeleted event emitted for message ${payload.messageId}`);
    }

    res.json({ 
      success: true, 
      message: 'Message deleted successfully' 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete message', 
      error: err.message 
    });
  }
});

/**
 * Get conversation list (unique users with latest message)
 */
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const now = new Date();
    const expiryClause = expiryQueryFragment(now);

    const conversations = await Chat.aggregate([
      {
        $match: {
          $and: [
            {
              $or: [
                { senderId: userObjectId },
                { receiverId: userObjectId },
              ],
            },
            expiryClause,
          ],
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$senderId', userObjectId] },
              '$receiverId',
              '$senderId',
            ],
          },
          lastMessage: { $first: '$$ROOT' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },
      {
        $project: {
          user: {
            _id: 1,
            username: 1,
            email: 1,
            images: 1,
            isOnline: 1,
            lastSeen: 1,
          },
          lastMessage: 1,
        },
      },
      {
        $sort: { 'lastMessage.createdAt': -1 },
      },
    ]);

    res.json({ success: true, conversations });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch conversations', 
      error: err.message 
    });
  }
});


router.post('/send-message', authMiddleware, sendMessage)
router.post('/settings', authMiddleware, upsertChatSetting)
router.get('/settings/:userId', authMiddleware, getChatSetting)
export default router;
