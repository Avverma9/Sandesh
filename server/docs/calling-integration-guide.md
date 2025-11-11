# Audio & Video Calling Integration Guide

Complete guide for implementing WebRTC-based audio and video calling in your mobile/web application.

## Call Flow Overview

1. **Initiating a Call**: Caller sends `initiateCall` via Socket.IO or REST API
2. **Receiving Notification**: Receiver gets `incomingCall` event with call details
3. **Accept/Reject**: Receiver responds with `acceptCall` or `rejectCall`
4. **WebRTC Negotiation**: Exchange SDP offers/answers and ICE candidates
5. **Active Call**: Both parties connected via peer-to-peer WebRTC
6. **End Call**: Either party can send `endCall` to terminate

---

## REST APIs

### 1. Initiate Call
**Endpoint:** `POST /api/calls/initiate`  
**Auth:** Required  
**Body:**
```json
{
  "receiverId": "<user-id>",
  "callType": "audio" | "video"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Call initiated",
  "data": {
    "_id": "<call-id>",
    "callerId": { ... },
    "receiverId": { ... },
    "callType": "video",
    "status": "no-answer",
    "createdAt": "2025-11-11T..."
  }
}
```

### 2. Accept Call
**Endpoint:** `POST /api/calls/accept`  
**Auth:** Required  
**Body:**
```json
{
  "callId": "<call-id>"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Call accepted",
  "data": { ... }
}
```

### 3. Reject Call
**Endpoint:** `POST /api/calls/reject`  
**Auth:** Required  
**Body:**
```json
{
  "callId": "<call-id>"
}
```

### 4. End Call
**Endpoint:** `POST /api/calls/end`  
**Auth:** Required  
**Body:**
```json
{
  "callId": "<call-id>"
}
```
**Response:** Updates call status to `completed`/`cancelled`/`missed` and records duration.

### 5. Get Call History
**Endpoint:** `GET /api/calls/history?type=audio&limit=50&skip=0`  
**Auth:** Required  
**Query Params:**
- `type` (optional): `audio` | `video`
- `limit` (optional): default 50
- `skip` (optional): for pagination

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "<call-id>",
      "callerId": { ... },
      "receiverId": { ... },
      "callType": "video",
      "status": "completed",
      "duration": 125,
      "direction": "outgoing",
      "isMissed": false,
      "createdAt": "...",
      "startedAt": "...",
      "endedAt": "..."
    }
  ],
  "hasMore": true
}
```

**Status Types:**
- `missed` - receiver didn't answer
- `rejected` - receiver declined
- `completed` - call connected successfully
- `cancelled` - caller hung up before answer
- `no-answer` - still ringing

### 6. Get Missed Calls
**Endpoint:** `GET /api/calls/missed?limit=20&skip=0`  
**Auth:** Required  
**Response:** Returns only missed calls for the authenticated user.

### 7. Delete Call History
**Endpoint:** `DELETE /api/calls/history/:callId`  
**Auth:** Required  
**Response:** Removes the call record from history.

---

## Socket.IO Events

### Outgoing Events (Client → Server)

#### 1. Initiate Call
```javascript
socket.emit("initiateCall", {
  receiverId: "<user-id>",
  callType: "audio" // or "video"
});

// Listen for confirmation
socket.on("callInitiated", ({ callId, receiverId, callType }) => {
  console.log("Call initiated with ID:", callId);
  // Start local media stream
});
```

#### 2. Accept Call
```javascript
socket.emit("acceptCall", { callId: "<call-id>" });

socket.on("callAcceptedConfirm", ({ callId }) => {
  console.log("Call accepted, start WebRTC");
});
```

#### 3. Reject Call
```javascript
socket.emit("rejectCall", { callId: "<call-id>" });

socket.on("callRejectedConfirm", ({ callId }) => {
  console.log("Call rejected");
});
```

#### 4. End Call
```javascript
socket.emit("endCall", { callId: "<call-id>" });

socket.on("callEndedConfirm", ({ callId }) => {
  console.log("Call ended");
  // Close peer connection
});
```

#### 5. WebRTC Signaling

**Send Offer (SDP)**
```javascript
socket.emit("sendOffer", {
  to: "<receiver-user-id>",
  offer: rtcPeerConnection.localDescription,
  callId: "<call-id>"
});
```

**Send Answer (SDP)**
```javascript
socket.emit("sendAnswer", {
  to: "<caller-user-id>",
  answer: rtcPeerConnection.localDescription,
  callId: "<call-id>"
});
```

**Send ICE Candidate**
```javascript
socket.emit("sendIceCandidate", {
  to: "<other-user-id>",
  candidate: iceCandidate,
  callId: "<call-id>"
});
```

---

### Incoming Events (Server → Client)

#### 1. Incoming Call Notification
```javascript
socket.on("incomingCall", ({ callId, callerId, callType, caller }) => {
  // Show incoming call UI
  // caller object contains: { username, email, images, isOnline }
  showIncomingCallScreen(caller, callType, callId);
});
```

#### 2. Call Accepted
```javascript
socket.on("callAccepted", ({ callId, receiverId }) => {
  console.log("Receiver accepted the call");
  // Start WebRTC peer connection
});
```

#### 3. Call Rejected
```javascript
socket.on("callRejected", ({ callId, receiverId }) => {
  console.log("Receiver rejected the call");
  // Close call UI
});
```

#### 4. Call Ended
```javascript
socket.on("callEnded", ({ callId, endedBy }) => {
  console.log("Call ended by user:", endedBy);
  // Close peer connection and UI
});
```

#### 5. User Not Available
```javascript
socket.on("userNotAvailable", ({ message }) => {
  console.log("User is offline");
  // Show "User is unavailable" message
});
```

#### 6. WebRTC Signaling Events

**Receive Offer**
```javascript
socket.on("receiveOffer", async ({ offer, from, callId }) => {
  await rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await rtcPeerConnection.createAnswer();
  await rtcPeerConnection.setLocalDescription(answer);
  socket.emit("sendAnswer", { to: from, answer, callId });
});
```

**Receive Answer**
```javascript
socket.on("receiveAnswer", async ({ answer, from, callId }) => {
  await rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});
```

**Receive ICE Candidate**
```javascript
socket.on("receiveIceCandidate", async ({ candidate, from, callId }) => {
  await rtcPeerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});
```

#### 7. Call Error
```javascript
socket.on("callError", ({ error }) => {
  console.error("Call error:", error);
  // Show error message to user
});
```

---

## WebRTC Implementation Example

### Basic Call Setup (React Native / Web)

```javascript
let rtcPeerConnection = null;
let localStream = null;
let remoteStream = null;

// 1. Get local media stream
async function startCall(receiverId, callType) {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === "video"
    });

    // Display local stream in UI
    localVideoElement.srcObject = localStream;

    // Initiate call
    socket.emit("initiateCall", { receiverId, callType });

  } catch (error) {
    console.error("Error accessing media devices:", error);
  }
}

// 2. Create peer connection when call is accepted
socket.on("callAccepted", async ({ callId, receiverId }) => {
  rtcPeerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" }
    ]
  });

  // Add local stream tracks
  localStream.getTracks().forEach(track => {
    rtcPeerConnection.addTrack(track, localStream);
  });

  // Listen for remote stream
  rtcPeerConnection.ontrack = (event) => {
    remoteStream = event.streams[0];
    remoteVideoElement.srcObject = remoteStream;
  };

  // Handle ICE candidates
  rtcPeerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("sendIceCandidate", {
        to: receiverId,
        candidate: event.candidate,
        callId
      });
    }
  };

  // Create and send offer
  const offer = await rtcPeerConnection.createOffer();
  await rtcPeerConnection.setLocalDescription(offer);
  socket.emit("sendOffer", { to: receiverId, offer, callId });
});

// 3. Handle incoming call
socket.on("incomingCall", ({ callId, callerId, callType, caller }) => {
  // Show accept/reject UI
  showIncomingCallUI(caller, callType, callId, callerId);
});

// 4. Accept call
async function acceptIncomingCall(callId, callerId, callType) {
  localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: callType === "video"
  });

  localVideoElement.srcObject = localStream;

  rtcPeerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }
    ]
  });

  localStream.getTracks().forEach(track => {
    rtcPeerConnection.addTrack(track, localStream);
  });

  rtcPeerConnection.ontrack = (event) => {
    remoteStream = event.streams[0];
    remoteVideoElement.srcObject = remoteStream;
  };

  rtcPeerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("sendIceCandidate", {
        to: callerId,
        candidate: event.candidate,
        callId
      });
    }
  };

  socket.emit("acceptCall", { callId });
}

// 5. End call
function endCall(callId) {
  socket.emit("endCall", { callId });
  
  if (rtcPeerConnection) {
    rtcPeerConnection.close();
    rtcPeerConnection = null;
  }
  
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
}

// Listen for call ended
socket.on("callEnded", ({ callId, endedBy }) => {
  endCall(callId);
  // Update UI
});
```

---

## UI Implementation Tips

### 1. Call History Screen
```javascript
async function fetchCallHistory() {
  const response = await fetch('/api/calls/history?limit=50', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const { data } = await response.json();
  
  // Group by date, show icons based on:
  // - direction: "outgoing" (green) or "incoming" (blue)
  // - isMissed: true (red icon)
  // - callType: "audio" or "video"
  // - status: "completed", "missed", "rejected", "cancelled"
  
  renderCallHistory(data);
}
```

### 2. Missed Calls Badge
```javascript
async function getMissedCallsCount() {
  const response = await fetch('/api/calls/missed?limit=100', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const { data } = await response.json();
  updateBadgeCount(data.length);
}
```

### 3. Call Status Icons
- ✅ **Completed**: Green phone icon
- ❌ **Missed**: Red phone icon with badge
- 🚫 **Rejected**: Red declined icon
- ⏹️ **Cancelled**: Gray icon

---

## Error Handling

```javascript
socket.on("callError", ({ error }) => {
  switch(error) {
    case "receiverId required":
    case "Receiver not found":
      showError("User not found");
      break;
    case "callId required":
    case "Call not found":
      showError("Call expired or invalid");
      break;
    case "Not authorized":
      showError("You cannot perform this action");
      break;
    case "Call already processed":
      showError("Call already answered or rejected");
      break;
    default:
      showError("An error occurred. Please try again.");
  }
});
```

---

## Production Considerations

1. **TURN Server**: For peer-to-peer connections behind NAT/firewalls, add a TURN server:
   ```javascript
   iceServers: [
     { urls: "stun:stun.l.google.com:19302" },
     {
       urls: "turn:your-turn-server.com:3478",
       username: "user",
       credential: "pass"
     }
   ]
   ```

2. **Permissions**: Request microphone/camera permissions before initiating calls.

3. **Network Quality**: Monitor connection quality and show indicators to users.

4. **Reconnection**: Handle network drops gracefully with reconnection logic.

5. **Call History Cleanup**: Implement periodic cleanup of old call records.

---

## Testing Flow

1. User A initiates call → `POST /api/calls/initiate` or `socket.emit("initiateCall")`
2. User B receives `incomingCall` event
3. User B accepts → `socket.emit("acceptCall")`
4. User A receives `callAccepted`
5. WebRTC negotiation (offer/answer/ICE)
6. Active call with audio/video streams
7. Either user ends → `socket.emit("endCall")`
8. Both receive `callEnded` event
9. Check `/api/calls/history` for the completed call record

With this setup, your mobile app can handle full-duplex audio and video calling with complete call history tracking!
