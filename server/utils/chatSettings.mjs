import Chat from "../models/chats.mjs";
import ChatSetting, { buildRoomKey } from "../models/chatSettings.mjs";

export const buildParticipantsQuery = (userA, userB) => ({
  $or: [
    { senderId: userA, receiverId: userB },
    { senderId: userB, receiverId: userA },
  ],
});

export const normaliseTimerSeconds = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return NaN;
  if (parsed <= 0) return null;
  return Math.round(parsed);
};

export const expiryQueryFragment = (now = new Date()) => ({
  $or: [
    { expiresAt: { $exists: false } },
    { expiresAt: null },
    { expiresAt: { $gt: now } },
  ],
});

export const applyChatSettingToMessages = async (setting) => {
  if (!setting) return;
  const [userA, userB] = setting.participants.map((id) => String(id));
  const query = buildParticipantsQuery(userA, userB);

  if (setting.timerSeconds && setting.timerSeconds > 0) {
    const cutoff = new Date(Date.now() - setting.timerSeconds * 1000);
    await Chat.deleteMany({ ...query, createdAt: { $lt: cutoff } });
    await Chat.updateMany(
      query,
      [
        {
          $set: {
            expiresAt: {
              $cond: [
                { $ifNull: ["$expiresAt", false] },
                "$expiresAt",
                {
                  $dateAdd: {
                    startDate: "$createdAt",
                    unit: "second",
                    amount: setting.timerSeconds,
                  },
                },
              ],
            },
          },
        },
      ]
    );
  } else {
    await Chat.updateMany(query, { $unset: { expiresAt: "" } });
  }
};

export const upsertChatSettingRecord = async ({ initiatorId, partnerId, timerSeconds }) => {
  const resolvedTimer = normaliseTimerSeconds(timerSeconds);
  if (Number.isNaN(resolvedTimer)) {
    const error = new Error("timerSeconds must be a number");
    error.statusCode = 400;
    throw error;
  }

  const roomKey = buildRoomKey(initiatorId, partnerId);
  let chatSetting = await ChatSetting.findOne({ roomKey });

  if (!chatSetting) {
    chatSetting = new ChatSetting({
      participants: [initiatorId, partnerId],
      timerSeconds: resolvedTimer,
      updatedBy: initiatorId,
    });
  } else {
    chatSetting.timerSeconds = resolvedTimer;
    chatSetting.updatedBy = initiatorId;
  }

  chatSetting.lastMessageAt = chatSetting.lastMessageAt || null;
  chatSetting.expiresAt = chatSetting.expiresAt || null;

  await chatSetting.save();
  await applyChatSettingToMessages(chatSetting);

  return chatSetting;
};

export const getChatSettingForUsers = async (userA, userB) => {
  return ChatSetting.findByParticipants(userA, userB);
};
