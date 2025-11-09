// models/Chat.js
import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      default: '',
    },
    file: {
      url: { type: String },          // S3 / local file path
      type: {                         // image, video, audio, doc, etc.
        type: String,
        enum: ['image', 'video', 'audio', 'document'],
      },
      name: { type: String },         // original file name
      size: { type: Number },         // in bytes
    },
  },
  { timestamps: true }
);

const Chat = mongoose.model('Chat', chatSchema);

export default Chat;