import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { currentUserId } from "../../util/auth";
import socket from "../../util/socket";
import {
  getHistory,
  sendMessage as sendMessageThunk,
  deleteMessage as deleteMessageThunk,
  upsertIncomingMessage,
} from "../../redux/reducers/chat";

const useTheme = () => {
  const [theme, setThemeState] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("theme") || "dark" : "dark"
  );
  const setTheme = (newTheme) => setThemeState(newTheme);
  return { theme, setTheme };
};

function DeleteMessageModal({ message, onClose, onDelete }) {
  if (!message) return null;
  return createPortal(
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed z-50 bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-800 rounded-t-2xl shadow-lg animate-slideUp">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Message?</h3>
        <p className="text-sm text-gray-600 dark:text-white/70 mb-4 truncate">"{message.text}"</p>
        <button
          onClick={() => onDelete("me")}
          className="w-full text-left p-3 text-red-500 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
        >
          Delete for me
        </button>
        <button
          onClick={() => onDelete("everyone")}
          className="w-full text-left p-3 text-red-500 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
        >
          Delete for everyone
        </button>
        <button
          onClick={onClose}
          className="w-full text-left p-3 text-gray-700 dark:text-white/80 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors mt-2"
        >
          Cancel
        </button>
      </div>
    </>,
    document.body
  );
}

function CallModal({ incomingCall, onAccept, onReject, onCancel }) {
  return createPortal(
    <>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-2xl max-w-sm animate-slideUp">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Incoming {incomingCall.callType.toUpperCase()} Call
          </h2>
          <p className="text-gray-600 dark:text-white/70 mb-6">From: {incomingCall.callerName}</p>
          <div className="flex gap-4">
            <button
              onClick={onAccept}
              className="flex-1 px-4 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors"
            >
              Accept
            </button>
            <button
              onClick={onReject}
              className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors"
            >
              Reject
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

function VideoCallModal({ stream, remoteStream, callType, onEndCall }) {
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();

  useEffect(() => {
    if (localVideoRef.current && stream) {
      localVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 bg-black backdrop-blur-sm" />
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center">
        <div className="relative w-full h-full flex items-center justify-center">
          {callType === "video" ? (
            <>
              <video
                ref={remoteVideoRef}
                autoPlay
                className="w-full h-full object-cover"
              />
              <video
                ref={localVideoRef}
                autoPlay
                muted
                className="absolute bottom-4 right-4 w-48 h-36 object-cover rounded-lg border-4 border-white shadow-lg"
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 animate-pulse mb-4" />
              <p className="text-white text-xl font-semibold">Audio Call in Progress</p>
            </div>
          )}

          <button
            onClick={onEndCall}
            className="absolute bottom-4 left-4 px-6 py-3 bg-red-500 text-white rounded-full font-semibold hover:bg-red-600 transition-colors shadow-lg"
          >
            End Call
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

function ChatSettingsModal({ user, onClose }) {
  const [deleteTimer, setDeleteTimer] = useState("off");
  const timerOptions = [
    { label: "Do not auto-delete", value: "off", icon: "M6 18L18 6M6 6l12 12" },
    { label: "1 Minute", value: "1m", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
    { label: "5 Minutes", value: "5m", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
    { label: "Temp Chat (1 Hour)", value: "1h", icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" },
  ];

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex flex-col h-screen bg-white dark:bg-gray-900 animate-slideInRight text-gray-900 dark:text-white">
        <header className="flex-shrink-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl p-4 flex items-center border-b border-black/5 dark:border-white/5 shadow-lg">
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-xl transition-all duration-300 hover:scale-110 border border-black/10 dark:border-white/10 text-gray-800 dark:text-white mr-4"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
            Profile & Settings
          </h2>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="flex flex-col items-center p-6 bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg rounded-2xl shadow-md">
            <img
              src={user.pic}
              alt={user.name}
              className="w-24 h-24 rounded-full object-cover mb-4 ring-4 ring-cyan-400/50"
            />
            <h3 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent mb-2">
              {user.name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-white/60 text-center italic">"{user.bio}"</p>
            <div className="w-full mt-6 space-y-3 text-sm border-t border-black/10 dark:border-white/10 pt-4">
              <p className="flex items-center text-gray-700 dark:text-white/80">
                <svg className="w-5 h-5 mr-3 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {user.email}
              </p>
              <p className="flex items-center text-gray-700 dark:text-white/80">
                <svg className="w-5 h-5 mr-3 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {user.mobile}
              </p>
            </div>
          </div>

          <div className="p-4 bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg rounded-2xl shadow-md">
            <h4 className="text-lg font-semibold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent mb-4">
              Disappearing Messages
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {timerOptions.map((option) => {
                const isSelected = deleteTimer === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setDeleteTimer(option.value)}
                    className={`p-4 rounded-xl text-left transition-all duration-300 ${
                      isSelected
                        ? "bg-cyan-500/20 dark:bg-cyan-500/30 ring-2 ring-cyan-500 shadow-lg"
                        : "bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10"
                    }`}
                  >
                    <svg
                      className={`w-5 h-5 mb-2 ${
                        isSelected ? "text-cyan-500" : "text-gray-600 dark:text-white/60"
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={option.icon} />
                    </svg>
                    <span
                      className={`block font-semibold text-sm ${
                        isSelected ? "text-gray-900 dark:text-white" : "text-gray-700 dark:text-white/80"
                      }`}
                    >
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

function MessageBubble({ message, onHold, isDeleting, currentUserId }) {
  const sId = message?.senderId?._id || message?.senderId;
  const isSender = String(sId || "") === String(currentUserId || "");
  const bubbleClasses = isSender
    ? "self-end bg-gradient-to-r from-cyan-400 to-blue-500 text-white rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl rounded-br-sm cursor-pointer"
    : "self-start bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-tl-2xl rounded-tr-2xl rounded-bl-sm rounded-br-2xl";

  const handleContextMenu = (e) => {
    if (isSender) {
      e.preventDefault();
      onHold(message);
    }
  };

  const animationClass = isDeleting ? "animate-dissolve" : "animate-fadeIn";

  const getSenderImage = () => {
    const images = message?.senderId?.images;
    if (Array.isArray(images) && images.length > 0) return images[0];
    if (typeof images === "string" && images) return images;
    const name = message?.senderId?.username || message?.senderId?.name || "U";
    return `https://placehold.co/100x100/E2E8F0/4A5568?text=${(name[0] || "U").toUpperCase()}`;
  };

  const senderName = message?.senderId?.username || message?.senderId?.name || "User";

  return (
    <div className={`flex w-full ${isSender ? "justify-end" : "justify-start"} mb-4 ${animationClass}`}>
      {!isSender && (
        <div className="flex shrink-0 items-start mr-2 mt-1">
          <img src={getSenderImage()} alt={senderName} className="w-8 h-8 rounded-full object-cover" />
        </div>
      )}
      <div className={`flex flex-col ${isSender ? "items-end" : "items-start"} max-w-xs md:max-w-md`}>
        {!isSender && (
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 ml-1">{senderName}</span>
        )}
        <div
          className={`px-4 py-3 shadow-md ${bubbleClasses} transition-transform transform active:scale-95`}
          onContextMenu={handleContextMenu}
        >
          <p>{message.text}</p>
        </div>
        <span className="text-xs text-gray-500 dark:text-white/50 mt-1.5 px-1">
          {new Date(message?.createdAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}

export default function Messenger({ onBack }) {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const currentUser = useSelector((s) => s.user.userInfo);
  const activeUser = useSelector((s) => s.chat.activeUser);
  const messagesMap = useSelector((s) => s.chat.messagesByUser);

  const [localMessages, setLocalMessages] = useState([]);
  const [messageUpdateTime, setMessageUpdateTime] = useState(Date.now());
  const [currentMessage, setCurrentMessage] = useState("");
  const [activeUserStatus, setActiveUserStatus] = useState({
    isOnline: activeUser?.isOnline || false,
    lastSeen: activeUser?.lastSeen || null,
  });
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isCancelHover, setIsCancelHover] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [deletingMessages, setDeletingMessages] = useState(new Set());

  const [incomingCall, setIncomingCall] = useState(null);
  const [callActive, setCallActive] = useState(false);
  const [callType, setCallType] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isCallInitiating, setIsCallInitiating] = useState(false);

  const recordingTimerRef = useRef(null);
  const cancelAreaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const peerConnectionRef = useRef(null);

  const activeUserId = activeUser?._id || activeUser?.id || null;

  const RTCConfig = {
    iceServers: [
      { urls: ["stun:stun.l.google.com:19302"] },
      { urls: ["stun:stun1.l.google.com:19302"] },
    ],
  };

  const messages = useMemo(() => {
    const reduxMessages = activeUserId ? messagesMap[String(activeUserId)]?.messages || [] : [];
    const all = [...reduxMessages, ...localMessages];

    const seen = new Set();
    const uniq = [];
    for (const m of all) {
      const id = String(m?._id || m?.id || `${m?.createdAt || ""}-${m?.text || ""}`);
      if (!seen.has(id)) {
        seen.add(id);
        uniq.push(m);
      }
    }

    uniq.sort((a, b) => new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0));
    return uniq;
  }, [activeUserId, messagesMap, localMessages, messageUpdateTime]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", theme);
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(theme);
    }
  }, [theme]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, messageUpdateTime]);

  useEffect(() => {
    if (activeUserId) {
      dispatch(getHistory({ userId: activeUserId, limit: 50, skip: 0 }));
      socket.emit("getChatHistory", { otherUserId: activeUserId, limit: 50, skip: 0 });
    }
  }, [activeUserId, dispatch]);

  useEffect(() => {
    if (activeUser) {
      setActiveUserStatus({
        isOnline: activeUser?.isOnline || false,
        lastSeen: activeUser?.lastSeen || null,
      });
      setLocalMessages([]);
    }
  }, [activeUser]);

  useEffect(() => {
    const normalize = (msg) => {
      const sId = msg?.senderId?._id || msg?.senderId;
      const rId = msg?.receiverId?._id || msg?.receiverId;
      return {
        ...msg,
        senderId: typeof msg?.senderId === "object" ? msg?.senderId : { _id: sId },
        receiverId: typeof msg?.receiverId === "object" ? msg?.receiverId : { _id: rId },
      };
    };

    const addMessageToLocalState = (msg) => {
      const sId = msg?.senderId?._id || msg?.senderId;
      const rId = msg?.receiverId?._id || msg?.receiverId;
      const involvesMe =
        String(sId || "") === String(currentUserId || "") ||
        String(rId || "") === String(currentUserId || "");
      const involvesActive =
        activeUserId &&
        (String(sId || "") === String(activeUserId || "") ||
          String(rId || "") === String(activeUserId || ""));

      if (!involvesMe) return false;

      if (involvesActive) {
        const nm = normalize(msg);
        setLocalMessages((prev) => {
          const msgId = String(nm?._id || nm?.id || `${nm?.createdAt || ""}-${nm?.text || ""}`);
          const exists = prev.some((m) => String(m?._id || m?.id || "") === msgId);
          if (exists) return prev;
          return [...prev, nm];
        });
        setMessageUpdateTime(Date.now());
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
        return true;
      }

      dispatch(upsertIncomingMessage(normalize(msg)));
      return false;
    };

    const handleOnlineUsers = (userIds) => {
      if (activeUserId && userIds.includes(activeUserId))
        setActiveUserStatus((prev) => ({ ...prev, isOnline: true }));
    };

    const handleUserOnline = (data) => {
      if (data.userId === activeUserId)
        setActiveUserStatus({ isOnline: data.isOnline, lastSeen: data.lastSeen || null });
    };

    const handleUserTyping = (data) => {
      if (data.userId !== activeUserId) return;
      if (data.isTyping) setTypingUsers((prev) => new Set([...prev, data.userId]));
      else
        setTypingUsers((prev) => {
          const ns = new Set(prev);
          ns.delete(data.userId);
          return ns;
        });
    };

    const handleNewMessage = (msg) => addMessageToLocalState(msg);
    const handleMessageSent = (msg) => addMessageToLocalState(msg);
    const handleReceiveMessage = (msg) => addMessageToLocalState(msg);

    const handleChatHistory = (history) => {
      if (!Array.isArray(history)) return;
      const normalized = history.map((m) => normalize(m));
      setLocalMessages((prev) => {
        const existing = new Set(prev.map((m) => String(m?._id || m?.id || "")));
        const add = normalized.filter((m) => !existing.has(String(m?._id || m?.id || "")));
        return [...prev, ...add];
      });
      setMessageUpdateTime(Date.now());
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    };

    const handleMyChats = (msgs) => {
      if (!Array.isArray(msgs)) return;
      const filtered = msgs
        .map((msg) => {
          const sId = msg?.senderId?._id || msg?.senderId;
          const rId = msg?.receiverId?._id || msg?.receiverId;
          const forActive =
            activeUserId &&
            (String(sId || "") === String(activeUserId || "") ||
              String(rId || "") === String(activeUserId || ""));
          return forActive ? normalize(msg) : null;
        })
        .filter(Boolean);
      setLocalMessages(filtered);
      setMessageUpdateTime(Date.now());
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    };

    const handleIncomingCall = ({ from, callType, callerName }) => {
      setIncomingCall({ from, callType, callerName });
    };

    const handleCallAccepted = async () => {
      try {
        const mediaConstraints =
          callType === "video"
            ? { audio: true, video: { width: 1280, height: 720 } }
            : { audio: true, video: false };

        const mediaStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        setLocalStream(mediaStream);

        const peerConnection = new RTCPeerConnection(RTCConfig);

        mediaStream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, mediaStream);
        });

        peerConnection.ontrack = (event) => {
          setRemoteStream(event.streams[0]);
        };

        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("sendIceCandidate", { to: incomingCall.from, candidate: event.candidate });
          }
        };

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit("sendAnswer", { to: incomingCall.from, answer });

        peerConnectionRef.current = peerConnection;
      } catch (error) {
        console.error("Error accepting call:", error);
      }
    };

    const handleReceiveOffer = async ({ offer, from }) => {
      if (!peerConnectionRef.current) {
        const peerConnection = new RTCPeerConnection(RTCConfig);

        if (localStream) {
          localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
          });
        }

        peerConnection.ontrack = (event) => {
          setRemoteStream(event.streams[0]);
        };

        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("sendIceCandidate", { to: from, candidate: event.candidate });
          }
        };

        peerConnectionRef.current = peerConnection;
      }

      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
    };

    const handleReceiveAnswer = async ({ answer }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    const handleReceiveIceCandidate = ({ candidate }) => {
      if (peerConnectionRef.current && candidate) {
        peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    };

    const handleCallEnded = () => {
      setCallActive(false);
      setIncomingCall(null);
      cleanupCall();
    };

    socket.on("onlineUsers", handleOnlineUsers);
    socket.on("userOnline", handleUserOnline);
    socket.on("userTyping", handleUserTyping);
    socket.on("newMessage", handleNewMessage);
    socket.on("messageSent", handleMessageSent);
    socket.on("receiveMessage", handleReceiveMessage);
    socket.on("chatHistory", handleChatHistory);
    socket.on("myChats", handleMyChats);
    socket.on("incomingCall", handleIncomingCall);
    socket.on("callAccepted", handleCallAccepted);
    socket.on("receiveOffer", handleReceiveOffer);
    socket.on("receiveAnswer", handleReceiveAnswer);
    socket.on("receiveIceCandidate", handleReceiveIceCandidate);
    socket.on("callEnded", handleCallEnded);

    socket.emit("getMyChats");

    return () => {
      socket.off("onlineUsers", handleOnlineUsers);
      socket.off("userOnline", handleUserOnline);
      socket.off("userTyping", handleUserTyping);
      socket.off("newMessage", handleNewMessage);
      socket.off("messageSent", handleMessageSent);
      socket.off("receiveMessage", handleReceiveMessage);
      socket.off("chatHistory", handleChatHistory);
      socket.off("myChats", handleMyChats);
      socket.off("incomingCall", handleIncomingCall);
      socket.off("callAccepted", handleCallAccepted);
      socket.off("receiveOffer", handleReceiveOffer);
      socket.off("receiveAnswer", handleReceiveAnswer);
      socket.off("receiveIceCandidate", handleReceiveIceCandidate);
      socket.off("callEnded", handleCallEnded);
    };
  }, [currentUserId, activeUserId, dispatch, incomingCall, localStream, callType]);

  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } else {
      clearInterval(recordingTimerRef.current);
      setRecordingTime(0);
    }
    return () => clearInterval(recordingTimerRef.current);
  }, [isRecording]);

  const handleSendMessage = async () => {
    if (currentMessage.trim() === "" || !activeUserId) return;
    const text = currentMessage.trim();

    const messageId = `temp-${Date.now()}`;
    const optimistic = {
      _id: messageId,
      senderId: {
        _id: currentUserId,
        username: currentUser?.username,
        email: currentUser?.email,
        images: Array.isArray(currentUser?.images) ? currentUser.images : [currentUser?.images],
        isOnline: true,
      },
      receiverId: {
        _id: activeUserId,
        username: activeUser?.username,
        email: activeUser?.email,
        images: Array.isArray(activeUser?.images) ? activeUser.images : [activeUser?.images],
      },
      text,
      createdAt: new Date().toISOString(),
    };

    setLocalMessages((prev) => [...prev, optimistic]);
    setMessageUpdateTime(Date.now());

    socket.emit("sendMessage", { receiverId: activeUserId, text, file: null });

    setCurrentMessage("");
    setShowEmojiPicker(false);
    handleTyping(false);
    clearTimeout(typingTimeoutRef.current);

    socket.emit("getMyChats");

    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTyping = (isTyping) => {
    if (!activeUserId) return;
    socket.emit("typing", { receiverId: activeUserId, isTyping });
  };

  const handleMessageChange = (e) => {
    const value = e.target.value;
    setCurrentMessage(value);
    if (value.trim().length > 0) {
      handleTyping(true);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => handleTyping(false), 1000);
    } else {
      handleTyping(false);
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleHoldMessage = (message) => {
    setSelectedMessage(message);
    setShowDeleteMenu(true);
  };

  const handleCloseDeleteMenu = () => {
    setShowDeleteMenu(false);
    setSelectedMessage(null);
  };

  const handleDeleteMessage = async (deleteType) => {
    if (!selectedMessage) return;
    handleCloseDeleteMenu();
    const messageId = selectedMessage._id || selectedMessage.id;
    if (!messageId) return;
    try {
      setDeletingMessages((prev) => {
        const ns = new Set(prev);
        ns.add(messageId);
        return ns;
      });
      await dispatch(deleteMessageThunk({ messageId, deleteType })).unwrap();
    } finally {
      setTimeout(() => {
        setDeletingMessages((prev) => {
          const ns = new Set(prev);
          ns.delete(messageId);
          return ns;
        });
      }, 500);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const sendVoiceMessage = async () => {
    if (!activeUserId) return;
    const text = `🎤 Voice Message (${formatTime(recordingTime)})`;

    const messageId = `temp-voice-${Date.now()}`;
    const optimistic = {
      _id: messageId,
      senderId: {
        _id: currentUserId,
        username: currentUser?.username,
        email: currentUser?.email,
        images: Array.isArray(currentUser?.images) ? currentUser.images : [currentUser?.images],
        isOnline: true,
      },
      receiverId: {
        _id: activeUserId,
        username: activeUser?.username,
        email: activeUser?.email,
        images: Array.isArray(activeUser?.images) ? activeUser.images : [activeUser?.images],
      },
      text,
      createdAt: new Date().toISOString(),
      fileType: "voice",
    };

    setLocalMessages((prev) => [...prev, optimistic]);
    setMessageUpdateTime(Date.now());

    socket.emit("sendMessage", { receiverId: activeUserId, text, file: null, fileType: "voice" });

    socket.emit("getMyChats");

    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  };

  const handleMicDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentMessage.trim().length === 0) {
      setIsRecording(true);
      setIsCancelHover(false);
    }
  };

  const handleMicUp = async (e) => {
    if (isRecording) {
      e.preventDefault();
      e.stopPropagation();
      setIsRecording(false);
      if (!isCancelHover && recordingTime > 0) await sendVoiceMessage();
      setIsCancelHover(false);
    }
  };

  const handleMicMove = (e) => {
    if (!isRecording) return;
    const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
    if (cancelAreaRef.current) {
      const rect = cancelAreaRef.current.getBoundingClientRect();
      setIsCancelHover(clientX < rect.right);
    }
  };

  const handleToggleEmojiPicker = () => setShowEmojiPicker((v) => !v);
  
  const isActiveUserTyping = activeUserId && typingUsers.has(activeUserId);

  const startCall = async (type) => {
    if (!activeUserId || isCallInitiating) return;
    
    try {
      setIsCallInitiating(true);
      setCallType(type);

      const mediaConstraints =
        type === "video"
          ? { audio: true, video: { width: 1280, height: 720 } }
          : { audio: true, video: false };

      const mediaStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      setLocalStream(mediaStream);

      const peerConnection = new RTCPeerConnection(RTCConfig);

      mediaStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, mediaStream);
      });

      peerConnection.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("sendIceCandidate", { to: activeUserId, candidate: event.candidate });
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      socket.emit("initiateCall", {
        to: activeUserId,
        from: currentUserId,
        callType: type,
        callerName: currentUser?.username || currentUser?.name,
      });

      socket.emit("sendOffer", { to: activeUserId, offer });

      peerConnectionRef.current = peerConnection;
      setCallActive(true);
    } catch (error) {
      console.error("Error starting call:", error);
      setCallType(null);
      setIsCallInitiating(false);
    }
  };

  const handleAcceptCall = async () => {
    setCallActive(true);
    socket.emit("callAccepted", { to: incomingCall.from });
    setIncomingCall(null);
    await handleCallAccepted();
  };

  const handleRejectCall = () => {
    socket.emit("callRejected", { to: incomingCall.from });
    setIncomingCall(null);
  };

  const cleanupCall = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    setRemoteStream(null);
    setCallType(null);
    setIsCallInitiating(false);
  };

  const handleEndCall = () => {
    if (activeUserId) {
      socket.emit("endCall", { to: activeUserId });
    }
    cleanupCall();
  };

  return (
    <>
      <style>{`
        @keyframes panBackground { 0% { background-position: 0% 50%; } 25% { background-position: 100% 50%; } 50% { background-position: 100% 100%; } 75% { background-position: 0% 100%; } 100% { background-position: 0% 50%; } }
        .animate-panBackground { background-size: 400% 400%; animation: panBackground 20s ease-in-out infinite; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0%); opacity: 1; } }
        .animate-slideInRight { animation: slideInRight 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        @keyframes dissolve { 0% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(0.8) translateY(20px); filter: blur(5px); } }
        .animate-dissolve { animation: dissolve 0.5s ease-out forwards; }
        @keyframes pulseRecord { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);} 50% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } }
        .animate-pulseRecord { animation: pulseRecord 1.5s infinite; }
        @keyframes typing { 0%, 60%, 100% { opacity: 0.5; } 30% { opacity: 1; } }
        .animate-typing { animation: typing 1.4s infinite; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        .dark ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 10px; }
        .dark ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }
        .light ::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.2); border-radius: 10px; }
        .light ::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.3); }
      `}</style>

      <div className={`min-h-screen font-sans overflow-hidden relative ${theme}`}>
        <div className="absolute inset-0 z-0 animate-panBackground bg-gradient-to-br from-cyan-500 via-blue-600 via-purple-600 to-pink-500" />
        <div className="relative z-10 flex flex-col h-screen bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl text-gray-900 dark:text-white">
          <header className="flex-shrink-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl p-4 flex justify-between items-center border-b border-black/5 dark:border-white/5 shadow-lg">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  if (typeof onBack === "function") onBack();
                  else navigate("/chats");
                }}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-xl transition-all duration-300 hover:scale-110 border border-black/10 dark:border-white/10 text-gray-800 dark:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div onClick={() => setShowChatSettings(true)} className="cursor-pointer flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                    {activeUser?.username || activeUser?.name || activeUser?.email || "Chat"}
                  </h2>
                  {activeUserStatus.isOnline && <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
                </div>
                <div className="flex items-center text-xs gap-1.5">
                  {isActiveUserTyping ? (
                    <span className="text-purple-500 font-medium">Typing...</span>
                  ) : activeUserStatus.isOnline ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-green-500 font-medium">Online</span>
                    </>
                  ) : (
                    <span className="text-gray-600 dark:text-white/60">
                      {activeUserStatus.lastSeen
                        ? `Last seen ${new Date(activeUserStatus.lastSeen).toLocaleString()}`
                        : "Offline"}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex space-x-2 text-gray-800 dark:text-white">
              <button 
                onClick={() => startCall("video")}
                disabled={!activeUserStatus.isOnline || callActive}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-xl transition-all duration-300 hover:scale-110 border border-black/10 dark:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M4 8h11a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" />
                </svg>
              </button>
              <button 
                onClick={() => startCall("audio")}
                disabled={!activeUserStatus.isOnline || callActive}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-xl transition-all duration-300 hover:scale-110 border border-black/10 dark:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-transparent to-black/5 dark:to-white/5">
            <div className="space-y-1">
              {messages.map((msg) => (
                <MessageBubble
                  key={String(msg?._id || msg?.id || `${msg?.createdAt}-${msg?.text}`)}
                  message={msg}
                  onHold={handleHoldMessage}
                  isDeleting={deletingMessages.has(msg?._id || msg?.id)}
                  currentUserId={currentUserId}
                />
              ))}

              {isActiveUserTyping && (
                <div className="flex justify-start mb-4">
                  <div className="flex items-start gap-2">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-md">
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-gray-400 animate-typing" />
                        <span className="w-2 h-2 rounded-full bg-gray-400 animate-typing" style={{ animationDelay: "0.2s" }} />
                        <span className="w-2 h-2 rounded-full bg-gray-400 animate-typing" style={{ animationDelay: "0.4s" }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          </div>

          {showEmojiPicker && (
            <div className="flex-shrink-0 h-64 p-4 bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl border-t border-black/5 dark:border-white/5 overflow-y-auto animate-slideUp">
              <div className="flex flex-wrap gap-2 mt-2">
                {["😀", "😂", "😍", "🤔", "👍", "❤️", "🔥", "🎉"].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setCurrentMessage((v) => `${v}${emoji}`)}
                    className="p-2 text-2xl rounded-lg hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          <footer
            className="flex-shrink-0 p-3 bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl border-t border-black/5 dark:border-white/5"
            onMouseMove={handleMicMove}
            onTouchMove={handleMicMove}
          >
            <div className="flex items-center space-x-2">
              {isRecording ? (
                <div
                  ref={cancelAreaRef}
                  className={`flex-1 flex items-center transition-all duration-300 ${
                    isCancelHover ? "text-red-500" : "text-gray-700 dark:text-white/80"
                  }`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span className="ml-3 font-semibold text-sm">{isCancelHover ? "Release to Cancel" : "Slide to Cancel"}</span>
                </div>
              ) : (
                <>
                  <button
                    onClick={handleToggleEmojiPicker}
                    className="p-3 rounded-full text-gray-600 dark:text-white/70 hover:bg-white/20 dark:hover:bg-white/10 transition-colors duration-200"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  <button className="p-3 rounded-full text-gray-600 dark:text-white/70 hover:bg-white/20 dark:hover:bg-white/10 transition-colors duration-200">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a4 4 0 00-5.656-5.656l-6.415 6.415a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>
                </>
              )}

              {isRecording ? (
                <div className="flex-1 text-center">
                  <span className="text-red-500 font-semibold animate-pulse">{formatTime(recordingTime)}</span>
                </div>
              ) : (
                <input
                  type="text"
                  value={currentMessage}
                  onChange={handleMessageChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-3 rounded-xl bg-white/20 dark:bg-white/10 backdrop-blur-xl border border-black/10 dark:border-white/10 text-gray-900 placeholder-gray-700/60 dark:text-white dark:placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                />
              )}

              <button
                onClick={currentMessage.trim().length > 0 ? handleSendMessage : undefined}
                onMouseDown={currentMessage.trim().length === 0 ? handleMicDown : undefined}
                onMouseUp={currentMessage.trim().length === 0 ? handleMicUp : undefined}
                onMouseLeave={currentMessage.trim().length === 0 ? handleMicUp : undefined}
                onTouchStart={currentMessage.trim().length === 0 ? handleMicDown : undefined}
                onTouchEnd={currentMessage.trim().length === 0 ? handleMicUp : undefined}
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all transform ${
                  isRecording
                    ? `bg-red-500 text-white scale-110 ${isCancelHover ? "" : "animate-pulseRecord"}`
                    : "bg-gradient-to-r from-cyan-400 to-blue-500 text-white hover:scale-110 active:scale-95"
                }`}
              >
                {currentMessage.trim().length > 0 ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>
            </div>
          </footer>
        </div>

        {showDeleteMenu && (
          <DeleteMessageModal message={selectedMessage} onClose={handleCloseDeleteMenu} onDelete={handleDeleteMessage} />
        )}

        {incomingCall && !callActive && (
          <CallModal
            incomingCall={incomingCall}
            onAccept={handleAcceptCall}
            onReject={handleRejectCall}
            onCancel={() => setIncomingCall(null)}
          />
        )}

        {callActive && (
          <VideoCallModal
            stream={localStream}
            remoteStream={remoteStream}
            callType={callType}
            onEndCall={handleEndCall}
          />
        )}

        {showChatSettings && activeUser && (
          <ChatSettingsModal
            user={{
              name: activeUser.username || activeUser.name || activeUser.email,
              pic: Array.isArray(activeUser.images)
                ? activeUser.images[0]
                : typeof activeUser.images === "string"
                ? activeUser.images
                : "https://placehold.co/100x100/E2E8F0/4A5568?text=U",
              mobile: activeUser.mobile,
              email: activeUser.email,
              bio: activeUser.bio || "",
            }}
            onClose={() => setShowChatSettings(false)}
          />
        )}
      </div>
    </>
  );
}
