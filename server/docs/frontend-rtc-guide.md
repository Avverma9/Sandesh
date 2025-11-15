# Sandesh Frontend Guide: Real-Time Audio & Video Calling

This guide explains how to integrate WebRTC-based audio/video calling into the Sandesh frontend so it works with the existing Node/Express + Socket.IO backend contained in this repository.

---

## 1. Prerequisites & Dependencies

| Requirement | Notes |
| --- | --- |
| Modern browser | Must support `MediaDevices.getUserMedia`, `RTCPeerConnection`, and `ICE` (Chrome, Edge, Safari 15+, Firefox). |
| Authenticated session | You need a JWT produced by the Sandesh auth flow; it is used both for REST calls and WebSocket auth. |
| Packages | `socket.io-client`, `zustand` (or another state manager), and optionally `simple-peer` if you prefer a helper. |
| TURN server | Add your own TURN credentials (e.g., Twilio, coturn). The backend currently leaves this to the client. |

Install the core dependencies inside the frontend project:

```powershell
npm install socket.io-client
```

If you want a declarative state store and WebRTC helpers:

```powershell
npm install zustand simple-peer
```

---

## 2. Call Flow Overview

The backend already exposes REST endpoints in `routes/calls.mjs` and emits Socket.IO events from `websocket/websocket.mjs`. The recommended flow is:

1. **Caller taps "call"** → frontend hits `POST /calls/initiate` (or emits `socket.emit("initiateCall", {...})`).
2. **Backend saves CallHistory** → emits `incomingCall` to receiver's room.
3. **Receiver UI shows modal** → accepts or rejects.
4. On accept, both sides create `RTCPeerConnection`, capture local media, exchange SDP offers/answers through socket events (`sendOffer`, `receiveOffer`, `sendAnswer`, `receiveAnswer`).
5. ICE candidates flow via `sendIceCandidate`/`receiveIceCandidate` until `RTCPeerConnection` reaches `connected`.
6. When either user hangs up, emit `endCall` so the backend updates CallHistory and pings the peer with `callEnded`.

Sequence (simplified):

```text
Caller            Backend (Socket.IO)            Receiver
  | --initiateCall--> |                             |
  |<--callInitiated-- |                             |
  |                   | --incomingCall------------> |
  |                   | <---acceptCall------------- |
  |<--callAccepted----|                             |
  | --sendOffer------>|                             |
  |<-----receiveAnswer (via backend relay)--------- |
  |<-----receiveIceCandidate----------------------- |
  | --endCall-------> | --callEnded---------------> |
```

---

## 3. Recommended Frontend Architecture

- **State store** for current call (participants, type, status, media stream refs, timers).
- **Device permission layer** that requests mic/camera access only when needed and handles declines.
- **Call UI components**:
  - Dialer / contact list with call buttons.
  - Incoming-call toast/modal.
  - In-call screen with remote/local video, mute, switch camera, hang-up.
- **Service layer** wrapping all socket/REST interactions so components stay declarative.

Contract sketch:

- **Inputs**: authenticated user ID, peer ID, call type, audio/video constraints, TURN config.
- **Outputs**: `currentCall` object `{ id, callerId, receiverId, status, type, localStream, remoteStream }`, derived booleans (`isMuted`, `isVideoEnabled`).
- **Error modes**: device permission denied, peer offline, network disconnect, ICE failure.
- **Success criteria**: remote track playing within 3s after answering, call history entry recorded, clean teardown.

---

## 4. Implementation Steps

### 4.1 Connect the socket with JWT auth

```ts
import { io } from "socket.io-client";

export const socket = io(process.env.VITE_API_URL, {
  transports: ["websocket"],
  auth: { token: `Bearer ${jwt}` },
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

socket.on("connect_error", (err) => console.error("Socket error", err.message));
```

Mirror the backend rooms by listening for:

- `onlineUsers`
- `incomingCall`
- `callAccepted`, `callRejected`, `callEnded`
- `receiveOffer`, `receiveAnswer`, `receiveIceCandidate`

### 4.2 State store (example with Zustand)

```ts
import { create } from "zustand";

export const useCallStore = create((set, get) => ({
  currentCall: null,
  localStream: null,
  remoteStream: null,
  setCall: (call) => set({ currentCall: call }),
  setLocalStream: (stream) => set({ localStream: stream }),
  setRemoteStream: (stream) => set({ remoteStream: stream }),
  reset: () => set({ currentCall: null, localStream: null, remoteStream: null }),
}));
```

### 4.3 Device permissions & helpers

```ts
export async function getMediaStream({ audio = true, video = true }) {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio, video });
  } catch (err) {
    if (err.name === "NotAllowedError") throw new Error("Mic/Camera access blocked");
    throw err;
  }
}
```

Offer toggles by enabling/disabling individual tracks.

### 4.4 Peer connection setup

```ts
const iceServers = [{ urls: "stun:stun.l.google.com:19302" } /* add TURN here */];

export function createPeerConnection({ onRemoteTrack }) {
  const pc = new RTCPeerConnection({ iceServers });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("sendIceCandidate", {
        to: peerId,
        candidate: event.candidate,
        callId,
      });
    }
  };

  pc.ontrack = (event) => onRemoteTrack(event.streams[0]);
  pc.onconnectionstatechange = () => console.log("PC state", pc.connectionState);

  return pc;
}
```

### 4.5 Signaling helpers

```ts
export async function startOutgoingCall({ receiverId, callType }) {
  const payload = { receiverId, callType };
  socket.emit("initiateCall", payload);
}

socket.on("callInitiated", async ({ callId, receiverId, callType }) => {
  const localStream = await getMediaStream({ audio: true, video: callType === "video" });
  useCallStore.getState().setLocalStream(localStream);

  const pc = createPeerConnection({
    onRemoteTrack: (remoteStream) => useCallStore.getState().setRemoteStream(remoteStream),
  });

  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("sendOffer", { to: receiverId, offer, callId });
});

socket.on("receiveOffer", async ({ from, offer, callId }) => {
  const localStream = await getMediaStream({ audio: true, video: true });
  const pc = createPeerConnection({ onRemoteTrack: setRemoteStream });
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("sendAnswer", { to: from, answer, callId });
});

socket.on("receiveAnswer", async ({ answer }) => {
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("receiveIceCandidate", ({ candidate }) => {
  pc.addIceCandidate(new RTCIceCandidate(candidate));
});
```

### 4.6 REST fallbacks and history

Use the existing routes:

- `GET /calls/history?type=audio&limit=20`
- `GET /calls/missed`
- `DELETE /calls/history/:callId`

These endpoints expect the standard auth header (`Authorization: Bearer <token>`).

### 4.7 UI building blocks

- **Incoming call modal** triggered by `socket.on("incomingCall", handler)`.
- **Call screen** that shows local/remote streams via `<video autoPlay playsInline ref={videoRef} />`.
- **Controls**: mute/unmute, camera toggle, speaker switch (mobile), hang up.
- **Call timers**: track `startedAt` from `callAccepted` payload.

Example React snippet:

```tsx
function CallScreen() {
  const { localStream, remoteStream } = useCallStore();

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div className="call-screen">
      <video ref={remoteVideoRef} autoPlay playsInline className="remote" />
      <video ref={localVideoRef} autoPlay playsInline muted className="local" />
      <button onClick={hangUp}>End</button>
    </div>
  );
}
```

---

## 5. Handling Call States & Edge Cases

| Scenario | Handling |
| --- | --- |
| Peer offline | Backend emits `userNotAvailable`; show toast and stop local stream. |
| Missed call | Backend marks status `missed`; ping `/calls/missed` to display badges. |
| Permission denied | Surface CTA guiding users to enable mic/camera. |
| Network drop | Listen to `socket.on("disconnect")` and pause UI; auto retry by rejoining room. |
| Double call | If `currentCall` is active, auto reject new `incomingCall` with `rejectCall`. |
| Mobile backgrounding | Stop video tracks when app goes background to save battery. |

---

## 6. Security & Performance Tips

- Always sanitize user media selection (default to audio-only for low bandwidth).
- Add a TURN server for NAT traversal; STUN alone will fail for symmetric NATs.
- Use `navigator.mediaDevices.enumerateDevices()` to let users pick microphones/cameras.
- Stop and detach tracks in `hangUp` to avoid ghost LED indicators.
- Limit call duration via UI + server `endCall` guard if needed.
- Log call quality metrics using `pc.getStats()` for later analytics.

---

## 7. Testing Checklist

1. **Happy path**: user A video-calls user B; verify both audio & video in < 3 seconds.
2. **Audio-only fallback**: start video call, disable video, ensure audio persists.
3. **Missed call**: B ignores call; backend should mark `status = "missed"` and UI shows notification.
4. **Reject flow**: B rejects; caller receives `callRejected` immediately.
5. **End call**: either side taps hang-up; both get `callEnded` and streams stop.
6. **Reconnection**: unplug network mid-call and reconnect—peer connection should renegotiate or you prompt to retry.

---

## 8. Next Steps & Nice-to-Haves

- Add push notifications for incoming calls on mobile (via FCM/APNS).
- Record calls server-side by mixing streams if compliance requires it.
- Surface call quality stats to the user (packet loss, bitrate).
- Allow screen sharing by swapping the video track (`getDisplayMedia`).

---

With these steps, the Sandesh frontend can integrate seamlessly with the existing real-time signaling stack and deliver reliable audio/video calling. Adapt the code snippets to your framework of choice (React, Vue, React Native) while keeping the signaling contract identical.
