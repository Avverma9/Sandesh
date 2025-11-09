import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../util/api";

// Thunks
export const getMyChats = createAsyncThunk(
  "chat/getMyChats",
  async (_, thunkAPI) => {
    try {
      const { data } = await api.get("/chats/my-chats");
      return data; // { success, chats }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Request failed";
      return thunkAPI.rejectWithValue(msg);
    }
  }
);

export const getConversations = createAsyncThunk(
  "chat/getConversations",
  async (_, thunkAPI) => {
    try {
      const { data } = await api.get("/chats/conversations");
      return data; // { success, conversations }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Request failed";
      return thunkAPI.rejectWithValue(msg);
    }
  }
);

export const getHistory = createAsyncThunk(
  "chat/getHistory",
  async ({ userId, limit = 50, skip = 0 }, thunkAPI) => {
    try {
      const { data } = await api.get(`/chats/history/${userId}?limit=${limit}&skip=${skip}`);
      return { ...data, userId, limit, skip }; // { success, messages, hasMore }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Request failed";
      return thunkAPI.rejectWithValue(msg);
    }
  }
);

export const sendMessage = createAsyncThunk(
  "chat/sendMessage",
  async ({ receiverId, text, fileType = null }, thunkAPI) => {
    try {
      if (!receiverId) return thunkAPI.rejectWithValue("receiverId required");
      const body = { receiverId, text, fileType };
      // Primary endpoint based on provided API reference
      try {
        const { data } = await api.post("/chats/send-message", body);
        return data;
      } catch (primaryErr) {
        // Fallback legacy endpoint if server uses /send
        const { data } = await api.post("/chats/send", body);
        return data;
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Request failed";
      return thunkAPI.rejectWithValue(msg);
    }
  }
);

export const deleteMessage = createAsyncThunk(
  "chat/deleteMessage",
  async ({ messageId }, thunkAPI) => {
    try {
      const { data } = await api.delete(`/chats/${messageId}`);
      return { data, messageId };
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Request failed";
      return thunkAPI.rejectWithValue(msg);
    }
  }
);

const initialState = {
  myChats: [],
  conversations: [],
  activeUser: null, // { _id, username, email, images, ... }
  messagesByUser: {}, // userId -> { messages: [], hasMore: true, skip: 0 }
  lastMessageUpdate: null, // Add this for real-time updates
  loadingMyChats: false,
  loadingConversations: false,
  loadingHistory: false,
  sending: false,
  deleting: false,
  error: null,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setActiveUser(state, action) {
      state.activeUser = action.payload;
    },
    // Force UI update when new message is received
    FORCE_MESSAGE_RERENDER(state, action) {
      // This is a dummy action just to trigger a re-render
      // The timestamp ensures it's always a new value
      state.lastMessageUpdate = action.payload;
    },
    upsertIncomingMessage(state, action) {
      const msg = action.payload; // full message doc with senderId/receiverId populated or ids
      console.log('[REDUX] Adding message to state:', msg);
      
      // Determine which user this message belongs to (for organizing in the state)
      const sId = msg.senderId?._id || msg.senderId;
      const rId = msg.receiverId?._id || msg.receiverId;
      
      // If we have an active user, use that to determine the chat key
      // Otherwise use the other participant in the conversation
      const current = state.activeUser?._id || state.activeUser?.id;
      let otherUserId;
      
      if (current) {
        // If the current user is the sender, use the receiver as the key
        // Otherwise, use the sender as the key
        otherUserId = String(sId) === String(current) ? rId : sId;
      } else {
        // No active user, just use either sender or receiver
        otherUserId = sId || rId;
      }
      
      const key = String(otherUserId);
      console.log('[REDUX] Message mapped to chat key:', key);
      
      // Initialize the messages array if it doesn't exist
      if (!state.messagesByUser[key]) {
        state.messagesByUser[key] = { messages: [], hasMore: true, skip: 0 };
      }
      
      // Check for duplicates by message ID
      const msgId = String(msg._id || msg.id);
      const exists = state.messagesByUser[key].messages.some(m => 
        String(m._id || m.id) === msgId
      );
      
      // Only add if not duplicate
      if (!exists) {
        // Add to beginning if it's newer than the first message, otherwise add to end
        // This maintains proper chronological order
        const messages = state.messagesByUser[key].messages;
        const newMsgDate = new Date(msg.createdAt);
        
        if (messages.length > 0) {
          // Create a new array to force React to detect the change
          state.messagesByUser[key].messages = [...messages, msg];
        } else {
          state.messagesByUser[key].messages = [msg];
        }
        
        console.log('[REDUX] Message added, new count:', state.messagesByUser[key].messages.length);
      } else {
        console.log('[REDUX] Duplicate message skipped:', msgId);
      }
    },
    clearChatState(state) {
      return { ...initialState };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getMyChats.pending, (state) => {
        state.loadingMyChats = true;
        state.error = null;
      })
      .addCase(getMyChats.fulfilled, (state, action) => {
        state.loadingMyChats = false;
        state.myChats = action.payload?.chats ?? action.payload ?? [];
      })
      .addCase(getMyChats.rejected, (state, action) => {
        state.loadingMyChats = false;
        state.error = action.payload || "Failed to fetch chats";
      })

      .addCase(getConversations.pending, (state) => {
        state.loadingConversations = true;
        state.error = null;
      })
      .addCase(getConversations.fulfilled, (state, action) => {
        state.loadingConversations = false;
        state.conversations = action.payload?.conversations ?? action.payload ?? [];
      })
      .addCase(getConversations.rejected, (state, action) => {
        state.loadingConversations = false;
        state.error = action.payload || "Failed to fetch conversations";
      })

      .addCase(getHistory.pending, (state) => {
        state.loadingHistory = true;
        state.error = null;
      })
      .addCase(getHistory.fulfilled, (state, action) => {
        state.loadingHistory = false;
            const { userId, messages = [], hasMore = false, skip = 0 } = action.payload || {};
        const key = String(userId);
            if (!state.messagesByUser[key] || skip === 0) {
              state.messagesByUser[key] = { messages: [], hasMore: true, skip: 0 };
            }
            // Try to capture remote user's meta (like isOnline/lastSeen) from payload if provided
            const remoteUser = action.payload?.user || action.payload?.otherUser || action.payload?.participant || action.payload?.with || null;
            const userMetaDirect = {
              isOnline: action.payload?.isOnline,
              lastSeen: action.payload?.lastSeen,
            };
            const combinedUser = {
              ...(typeof remoteUser === 'object' && remoteUser ? remoteUser : {}),
              ...Object.fromEntries(Object.entries(userMetaDirect).filter(([, v]) => v !== undefined)),
            };
            // Merge user meta into per-user cache and activeUser if this conversation is currently open
            if (Object.keys(combinedUser).length > 0) {
              state.messagesByUser[key].user = {
                ...(state.messagesByUser[key].user || {}),
                ...combinedUser,
              };
              const activeId = state.activeUser?._id || state.activeUser?.id;
              const combinedId = combinedUser?._id || combinedUser?.id;
              if (activeId && (String(activeId) === String(userId) || (combinedId && String(activeId) === String(combinedId)))) {
                state.activeUser = {
                  ...(state.activeUser || {}),
                  ...combinedUser,
                };
              }
            }
        // append and maintain order by createdAt asc
        const combined = [...(state.messagesByUser[key].messages || []), ...messages];
        combined.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        state.messagesByUser[key] = {
              ...(state.messagesByUser[key] || {}),
              messages: combined,
          hasMore,
          skip: skip + messages.length,
        };
      })
      .addCase(getHistory.rejected, (state, action) => {
        state.loadingHistory = false;
        state.error = action.payload || "Failed to fetch history";
      })

      .addCase(sendMessage.pending, (state) => {
        state.sending = true;
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.sending = false;
        const payload = action.payload;
        const msg = payload?.data || payload?.message || payload; // server returns { success, message: 'Message sent', data }
        const sender = msg?.senderId?._id || msg?.senderId;
        const receiver = msg?.receiverId?._id || msg?.receiverId;
        const currentOther = state.activeUser?._id || state.activeUser?.id;
        const key = String(sender) === String(currentOther) ? String(sender) : String(receiver);
        if (!state.messagesByUser[key]) {
          state.messagesByUser[key] = { messages: [], hasMore: true, skip: 0 };
        }
        state.messagesByUser[key].messages = [...state.messagesByUser[key].messages, msg];
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.sending = false;
        state.error = action.payload || "Failed to send message";
      })

      .addCase(deleteMessage.pending, (state) => {
        state.deleting = true;
      })
      .addCase(deleteMessage.fulfilled, (state, action) => {
        state.deleting = false;
        const id = action.payload?.messageId;
        if (!id) return;
        // remove from all message arrays where present
        Object.keys(state.messagesByUser).forEach((key) => {
          state.messagesByUser[key].messages = state.messagesByUser[key].messages.filter((m) => String(m._id || m.id) !== String(id));
        });
      })
      .addCase(deleteMessage.rejected, (state, action) => {
        state.deleting = false;
        state.error = action.payload || "Failed to delete message";
      });
  },
});

export const { setActiveUser, upsertIncomingMessage, clearChatState, FORCE_MESSAGE_RERENDER } = chatSlice.actions;
export default chatSlice.reducer;
