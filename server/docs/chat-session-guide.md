# Chat Session Modes Integration Guide

This guide explains how to integrate the new chat session controls (timed deletion and fully temporary chats) in the mobile or web clients.

## REST APIs

### Configure Chat Session
- **Endpoint:** `POST /api/chats/settings`
- **Auth:** Required (JWT cookie or header)
- **Body:**
  ```json
  {
    "partnerId": "<other-user-id>",
    "mode": "standard" | "temporary",
    "timerSeconds": 3600
  }
  ```
  - `mode` defaults to `standard` when omitted.
  - `timerSeconds` is optional; provide when using `standard` mode and wanting auto-deletion.
  - For `temporary` mode, `timerSeconds` (if provided) is treated as the visual countdown for clients and does not persist messages.
- **Response:**
  ```json
  {
    "success": true,
    "data": {
      "_id": "...",
      "participants": ["<initiator>", "<partner>"],
      "mode": "temporary",
      "timerSeconds": 600,
      "updatedBy": "<initiator>",
      "createdAt": "2025-11-11T10:00:00.000Z",
      "updatedAt": "2025-11-11T10:05:00.000Z"
    }
  }
  ```
  - A Socket.IO event `chatSettingsUpdated` broadcasts automatically to both users with the same payload.

### Fetch Current Chat Session
- **Endpoint:** `GET /api/chats/settings/:userId`
- **Auth:** Required
- **Response:**
  ```json
  {
    "success": true,
    "data": null | {
      "_id": "...",
      "participants": [...],
      "mode": "standard",
      "timerSeconds": 1800,
      "updatedBy": "..."
    }
  }
  ```
  - `data = null` means default behaviour (`standard` without timers).

### Send Message
- **Endpoint:** `POST /api/chats/send-message`
- **Auth:** Required
- **Body keys:** `receiverId`, `text`, optional file upload.
- **Behaviour:**
  - In `temporary` mode the response is `200` with `data.isTemporary = true`; nothing is written to MongoDB.
  - In `standard` mode the message stores `modeSnapshot` and `expiresAt` (when `timerSeconds` > 0).

## Socket.IO Events

### Update Chat Settings
```javascript
socket.emit(
  "updateChatSettings",
  { partnerId, mode: "temporary", timerSeconds: 120 },
  (ack) => {
    if (!ack?.success) console.error(ack?.message);
  }
);
```
- Emits `chatSettingsUpdated` to both users on success.
- Structure of `ack.data` matches the REST response.

### Get Chat Settings
```javascript
socket.emit("getChatSettings", { partnerId }, (ack) => {
  if (ack?.success) {
    console.log("current settings", ack.data);
  }
});
```
- Alternatively, listen for `chatSettings` events if you skip callbacks.

### Receiving Updates
- Listen for global event `chatSettingsUpdated` to sync UI:
  ```javascript
  socket.on("chatSettingsUpdated", (settings) => {
    // settings.mode -> "standard" | "temporary"
    // settings.timerSeconds -> seconds or null
  });
  ```

### Sending Messages
- **Standard/Timed Chats:** unchanged (`messageSent`, `receiveMessage`). Each message includes `modeSnapshot` and `expiresAt` for countdown displays.
- **Temporary Chats:** clients receive `temporaryMessageSent` (sender) and `temporaryMessageReceived` (receiver) events with ephemeral payload:
  ```json
  {
    "_id": "<generated>",
    "senderId": "...",
    "receiverId": "...",
    "text": "...",
    "modeSnapshot": "temporary",
    "isTemporary": true,
    "expiresInSeconds": 120
  }
  ```
  - Messages are **not** stored server-side; clients should render and drop them when the timer elapses.

### Deleting Messages
- When a sender removes a message via the REST delete API, the server now emits `messageDeleted` to both user rooms:
  ```javascript
  socket.on("messageDeleted", ({ messageId }) => {
    removeMessageFromState(String(messageId));
  });
  ```
- Register this listener with your existing Socket.IO setup so both participants instantly drop deleted messages from the UI.

## UI Recommendations
- Provide toggles for:
  1. `standard` (default)
  2. `standard + timer` (ask for minutes/seconds)
  3. `temporary` (optional countdown purely for UI)
- After changing settings via REST or socket, update local state only when `success` is true or `chatSettingsUpdated` fires.
- For timed chats, start a countdown using `expiresAt` (REST responses) or `expiresInSeconds` (temporary mode).
- When the countdown ends, remove messages locally; the server TTL and cleanup ensure consistency across devices.

## Error Handling
- Expect `chatSettingsError` socket events or `{ success: false, message }` callback responses when validation fails.
- REST endpoints return HTTP `400` for validation issues, `404` if the partner does not exist, and `200` with `data: null` when no custom setting.

With these endpoints and events wired up, the frontend can seamlessly allow users to pick temporary sessions or timed auto-delete chats without additional backend changes.
