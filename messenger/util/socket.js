import { io } from "socket.io-client";
import { baseUrl } from "./baseUrl";
import { getAccessToken } from "./auth";

// Derive socket server URL from API baseUrl (strip trailing /api if present)
const socketUrl = baseUrl.replace(/\/api\/?$/, "") || baseUrl;

// Initialize socket with auth token (if available). We also expose a helper
// to update the token later (useful after login/refresh).
const socket = io(socketUrl, {
  auth: {
    token: getAccessToken() || null,
  },
  transports: ["websocket"],
  autoConnect: true,
});

socket.on("connect", () => {
  console.log("Socket connected:", socket.id);
});

socket.on('message', (msg) => {
  console.log('New message:', msg);
});

// Backend emits 'myChats' (from emitMyChatsToUser)
socket.on('myChats', (data) => {
  console.log('myChats received:', data?.length || 0, 'items');
});

// Backend also uses 'newMessage' event for real-time updates
socket.on('newMessage', (msg) => {
  console.log('newMessage received:', msg);
});

// Backend emits 'userTyping' when someone is typing
socket.on('userTyping', (data) => {
  console.log('User typing:', data);
});

// Backend emits 'userOnline' when a user goes online/offline
socket.on('userOnline', (data) => {
  console.log('User online status changed:', data);
});

// Backend sends list of all online users on connect
socket.on('onlineUsers', (userIds) => {
  console.log('Online users:', userIds);
});

// Backend emits 'chatHistory' in response to 'getChatHistory'
socket.on('chatHistory', (messages) => {
  console.log('Chat history received:', messages?.length || 0, 'messages');
});

socket.on('chatHistoryError', (err) => {
  console.error('Chat history error:', err);
});

socket.on('messageError', (err) => {
  console.error('Message error:', err);
});

socket.on('auth', (data) => {
  console.log('Authentication successful:', data);
  // store server-sent auth token if provided
  try {
    if (data?.token) sessionStorage.setItem("authToken", data.token);
  } catch (e) {
    console.warn("Failed to persist auth token from socket auth event", e);
  }
});

socket.on("connect_error", (err) => {
  console.error("Socket connection error:", err?.message || err);
});

// Helper: update socket auth token at runtime (call after login/refresh)
export function setSocketAuthToken(token) {
  try {
    socket.auth = { token };
    if (!socket.connected) socket.connect();
  } catch (e) {
    console.warn("Failed to set socket auth token", e);
  }
}

// Helper: request my-chats from server
export function requestMyChats() {
  try {
    socket.emit('getMyChats');
    console.log('[SOCKET] Requested getMyChats');
  } catch (e) {
    console.warn('Failed to request myChats', e);
  }
}

// Helper: request chat history with another user
export function requestChatHistory(otherUserId, limit = 50, skip = 0) {
  try {
    socket.emit('getChatHistory', { otherUserId, limit, skip });
    console.log(`[SOCKET] Requested chat history with ${otherUserId}`);
  } catch (e) {
    console.warn('Failed to request chat history', e);
  }
}

// Helper: send typing indicator
export function sendTyping(receiverId, isTyping = true) {
  try {
    socket.emit('typing', { receiverId, isTyping });
  } catch (e) {
    console.warn('Failed to send typing indicator', e);
  }
}

// Helper: send message via socket (alternative to REST API)
export function sendSocketMessage(receiverId, text, file = null) {
  try {
    socket.emit('sendMessage', { receiverId, text, file });
    console.log(`[SOCKET] Sent message to ${receiverId}`);
  } catch (e) {
    console.warn('Failed to send socket message', e);
  }
}

// Helper: mark message as read
export function markMessageRead(messageId) {
  try {
    socket.emit('messageRead', { messageId });
  } catch (e) {
    console.warn('Failed to mark message as read', e);
  }
}

// Add debug function for monitoring emit events
const originalEmit = socket.emit;
socket.emit = function(event, ...args) {
  if (['getMyChats', 'getChatHistory', 'sendMessage', 'typing'].includes(event)) {
    console.log(`[SOCKET DEBUG] Emitting ${event} at ${new Date().toISOString()}`, args[0]);
  }
  return originalEmit.apply(this, [event, ...args]);
};

export default socket;