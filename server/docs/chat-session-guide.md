# Chat Timer Integration Guide

Use this guide to wire the timed auto-delete chat feature into mobile or web clients.

## REST APIs

### Configure Chat Timer
- **Endpoint:** `POST /api/chats/settings`
- **Auth:** Required (JWT cookie or header)
- **Body:**
  ```json
  {
    "partnerId": "<other-user-id>",
    "timerSeconds": 3600
  }
  ```
  - Omit `timerSeconds` or set it to `null`/`0` to disable auto-deletion.
  - Values are rounded to the nearest whole second; negative values are rejected.
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "_id": "...",
      "participants": ["<initiator>", "<partner>"],
      "timerSeconds": 600,
      "updatedBy": "<initiator>",
      "createdAt": "2025-11-11T10:00:00.000Z",
      "updatedAt": "2025-11-11T10:05:00.000Z"
    }
  }
  ```
  - `chatSettingsUpdated` (Socket.IO) fires for both users with the same payload so their UI stays in sync.

### Fetch Current Timer
- **Endpoint:** `GET /api/chats/settings/:userId`
- **Auth:** Required
- **Response:**
  ```json
  {
    "success": true,
    "data": null | {
      "_id": "...",
      "participants": [...],
      "timerSeconds": 1800,
      "updatedBy": "..."
    }
  }
  ```
  - `data = null` means no timer is configured for the pair.

### Send Message
- **Endpoint:** `POST /api/chats/send-message`
- **Auth:** Required
- **Body keys:** `receiverId`, `text`, optional file upload.
- **Behaviour:** Messages persist as usual; when `timerSeconds > 0` the server stores an `expiresAt` timestamp so they auto-delete on schedule.

## Socket.IO Events

### Update Timer
```javascript
socket.emit(
  "updateChatSettings",
  { partnerId, timerSeconds: 120 },
  (ack) => {
    if (!ack?.success) console.error(ack?.message);
  }
);
```
- On success, `chatSettingsUpdated` is broadcast to both users with the new timer settings.

### Get Timer
```javascript
socket.emit("getChatSettings", { partnerId }, (ack) => {
  if (ack?.success) {
    console.log("current timer", ack.data?.timerSeconds);
  }
});
```
- Or listen for the dedicated `chatSettings` event if you prefer push responses.

### Receiving Updates
- Keep the UI synchronised:
  ```javascript
  socket.on("chatSettingsUpdated", (settings) => {
    // settings.timerSeconds -> seconds or null
  });
  ```

### Sending Messages
- Conversations continue to use `messageSent`, `receiveMessage`, and `newMessage`. Each payload now includes `expiresAt` so you can render a countdown.

### Deleting Messages
- Whenever a message is removed (manual delete or automatic timer expiry) the server emits `messageDeleted`:
  ```javascript
  socket.on("messageDeleted", ({ messageId, auto, expiresAt }) => {
    removeMessageFromState(String(messageId), { auto, expiresAt });
  });
  ```
- Register this listener with your Socket.IO client so both participants immediately drop deleted messages.
- `auto` is `true` when the timer triggered the deletion, otherwise `false`.

## UI Recommendations
- Offer users a simple toggle or input for the timer (e.g., Off, 5 min, 1 hour).
- After setting the timer, rely on `chatSettingsUpdated` for confirmation before updating local state.
- Use the `expiresAt` field on each message to show countdown badges or to purge the message locally when the timer hits zero.

## Error Handling
- Validation errors return HTTP `400` (REST) or `{ success: false, message }` via Socket.IO callbacks/events.
- Requests with unknown partner IDs respond with `404`.
- An empty response (`data: null`) simply means no timer is active yet.

With these endpoints and events wired up, the frontend can offer timed chats without keeping any additional temporary mode logic.
