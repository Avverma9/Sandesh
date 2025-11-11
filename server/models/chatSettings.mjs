import mongoose from "mongoose";

const { Schema } = mongoose;

export const buildRoomKey = (userA, userB) => {
  if (!userA || !userB) {
    throw new Error("Both user ids are required to build a chat room key");
  }
  return [String(userA), String(userB)].sort().join(":");
};

const chatSettingSchema = new Schema(
  {
    roomKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    participants: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      ],
      validate: {
        validator: (value) => Array.isArray(value) && value.length === 2,
        message: "Exactly two participants are required",
      },
    },
    mode: {
      type: String,
      enum: ["standard", "temporary"],
      default: "standard",
    },
    timerSeconds: {
      type: Number,
      min: 0,
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

chatSettingSchema.index({ participants: 1 });

chatSettingSchema.statics.findByParticipants = function findByParticipants(userA, userB) {
  const roomKey = buildRoomKey(userA, userB);
  return this.findOne({ roomKey });
};

chatSettingSchema.pre("validate", function setRoomKey(next) {
  if (Array.isArray(this.participants) && this.participants.length === 2) {
    this.roomKey = buildRoomKey(this.participants[0], this.participants[1]);
  }
  next();
});

const ChatSetting = mongoose.models.ChatSetting || mongoose.model("ChatSetting", chatSettingSchema);

export default ChatSetting;
