import Chat from "../models/chats.mjs";

const DEFAULT_SWEEP_MS = Number(process.env.CHAT_EXPIRY_SWEEP_MS) || 30000;
const MAX_BATCH_SIZE = Number(process.env.CHAT_EXPIRY_BATCH_SIZE) || 100;

let intervalRef = null;

const emitDeletion = (io, message, { isAuto = false } = {}) => {
  if (!io || !message) return;
  const payload = {
    messageId: String(message._id),
    auto: isAuto,
    expiresAt: message.expiresAt || null,
  };
  io.to(String(message.senderId)).emit("messageDeleted", payload);
  io.to(String(message.receiverId)).emit("messageDeleted", payload);
};

export const startExpiredMessageScheduler = (io, options = {}) => {
  if (!io) {
    console.warn("⚠️ startExpiredMessageScheduler called without a Socket.IO instance");
    return () => {};
  }

  const intervalMs = options.intervalMs || DEFAULT_SWEEP_MS;
  const batchSize = options.batchSize || MAX_BATCH_SIZE;

  const sweep = async () => {
    try {
      const now = new Date();
      const expiredMessages = await Chat.find({
        expiresAt: { $ne: null, $lte: now },
      })
        .limit(batchSize)
        .lean();

      if (!expiredMessages.length) {
        return;
      }

      const ids = expiredMessages.map((msg) => msg._id);
      await Chat.deleteMany({ _id: { $in: ids } });

      expiredMessages.forEach((msg) => emitDeletion(io, msg, { isAuto: true }));
      console.log(`🧹 Auto-deleted ${expiredMessages.length} expired message(s)`);
    } catch (err) {
      console.error("Expired message sweep failed:", err.message);
    }
  };

  // run immediately so recently expired messages disappear fast
  sweep();

  intervalRef = setInterval(sweep, intervalMs);
  console.log(`✅ Expired message scheduler running every ${intervalMs}ms (batch size ${batchSize})`);

  return () => {
    if (intervalRef) {
      clearInterval(intervalRef);
      intervalRef = null;
      console.log("🛑 Expired message scheduler stopped");
    }
  };
};

export default startExpiredMessageScheduler;
