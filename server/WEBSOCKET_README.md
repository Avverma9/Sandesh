# WebSocket Chat Implementation

## Features ✨

- Real-time messaging using Socket.IO
- Online/Offline user status tracking
- Typing indicators
- Chat history retrieval
- Message persistence in MongoDB
- User authentication integration

## WebSocket Events

### Client → Server Events

#### 1. `setUserId`
Connect user and set them online
```javascript
socket.emit('setUserId', userId);
```

#### 2. `sendMessage`
Send a chat message
```javascript
socket.emit('sendMessage', {
  senderId: 'user123',
  receiverId: 'user456',
  text: 'Hello!',
  file: null // optional file object
});
```

#### 3. `typing`
Send typing indicator
```javascript
socket.emit('typing', {
  receiverId: 'user456',
  isTyping: true
});
```

#### 4. `getChatHistory`
Retrieve chat history
```javascript
socket.emit('getChatHistory', {
  userId1: 'user123',
  userId2: 'user456',
  limit: 50,
  skip: 0
});
```

#### 5. `messageRead`
Mark message as read
```javascript
socket.emit('messageRead', {
  messageId: 'msg123'
});
```

### Server → Client Events

#### 1. `receiveMessage`
Receive incoming message
```javascript
socket.on('receiveMessage', (data) => {
  console.log('New message:', data);
  // data contains: senderId, receiverId, text, file, createdAt, etc.
});
```

#### 2. `messageSent`
Confirmation that message was sent
```javascript
socket.on('messageSent', (data) => {
  console.log('Message sent:', data);
});
```

#### 3. `messageError`
Error sending message
```javascript
socket.on('messageError', (data) => {
  console.error('Error:', data.error);
});
```

#### 4. `userOnline`
User online/offline status change
```javascript
socket.on('userOnline', (data) => {
  console.log(`User ${data.userId} is ${data.isOnline ? 'online' : 'offline'}`);
});
```

#### 5. `userTyping`
User typing indicator
```javascript
socket.on('userTyping', (data) => {
  console.log(`User ${data.userId} is typing...`);
});
```

#### 6. `chatHistory`
Chat history response
```javascript
socket.on('chatHistory', (messages) => {
  console.log('Chat history:', messages);
});
```

## REST API Endpoints

### 1. Get My Chats
```
GET /api/chats/my-chats
Headers: Authorization: Bearer <token>
```

### 2. Get Chat History with User
```
GET /api/chats/history/:userId?limit=50&skip=0
Headers: Authorization: Bearer <token>
```

### 3. Delete Message
```
DELETE /api/chats/:messageId
Headers: Authorization: Bearer <token>
```

### 4. Get Conversations List
```
GET /api/chats/conversations
Headers: Authorization: Bearer <token>
```

## Frontend Integration Example

### HTML + Vanilla JS
```html
<script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
<script>
  const socket = io('http://localhost:3000');
  
  socket.on('connect', () => {
    socket.emit('setUserId', currentUserId);
  });
  
  socket.on('receiveMessage', (data) => {
    displayMessage(data);
  });
  
  function sendMessage(receiverId, text) {
    socket.emit('sendMessage', {
      senderId: currentUserId,
      receiverId: receiverId,
      text: text
    });
  }
</script>
```

### React Example
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

useEffect(() => {
  socket.on('connect', () => {
    socket.emit('setUserId', userId);
  });
  
  socket.on('receiveMessage', (data) => {
    setMessages(prev => [...prev, data]);
  });
  
  return () => socket.disconnect();
}, []);

const sendMessage = (receiverId, text) => {
  socket.emit('sendMessage', {
    senderId: userId,
    receiverId,
    text
  });
};
```

## Testing

1. Open `test-websocket.html` in browser
2. Enter your user ID
3. Click "Connect"
4. Enter receiver ID and message
5. Send messages and test features

## Database Models

### Chat Model
```javascript
{
  senderId: ObjectId,      // User who sent the message
  receiverId: ObjectId,    // User who receives the message
  text: String,            // Message text
  file: {                  // Optional file attachment
    url: String,
    type: String,          // image, video, audio, document
    name: String,
    size: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

### User Model (Updated)
```javascript
{
  username: String,
  email: String,
  isOnline: Boolean,       // Online status
  lastSeen: Date,          // Last seen timestamp
  // ... other fields
}
```

## Environment Variables

No additional environment variables required. Uses existing MongoDB connection.

## Notes

- WebSocket server runs on the same port as Express (default 3000)
- CORS is enabled for all origins (restrict in production)
- Messages are stored in MongoDB for persistence
- Online/offline status is tracked automatically
- Typing indicators are real-time only (not stored)

## Production Considerations

1. Restrict CORS origins in `websocket/websocket.mjs`
2. Add authentication middleware for WebSocket connections
3. Implement rate limiting for messages
4. Add message encryption for sensitive data
5. Set up Redis adapter for horizontal scaling
6. Add message delivery receipts
7. Implement push notifications for offline users
