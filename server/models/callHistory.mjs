import mongoose from "mongoose";

const { Schema } = mongoose;

const callHistorySchema = new Schema(
  {
    callerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    callType: {
      type: String,
      enum: ["audio", "video"],
      required: true,
    },
    status: {
      type: String,
      enum: ["missed", "rejected", "completed", "cancelled", "no-answer"],
      required: true,
    },
    duration: {
      type: Number,
      default: 0,
      min: 0,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

callHistorySchema.index({ callerId: 1, createdAt: -1 });
callHistorySchema.index({ receiverId: 1, createdAt: -1 });
callHistorySchema.index({ callerId: 1, receiverId: 1, createdAt: -1 });

const CallHistory = mongoose.models.CallHistory || mongoose.model("CallHistory", callHistorySchema);

export default CallHistory;
