import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Messenger from "./messenger";
import { useDispatch, useSelector } from "react-redux";
import { getConversations, getMyChats } from "../../redux/reducers/chat";
import { setActiveUser } from "../../redux/reducers/chat";
import socket from "../../util/socket";
import {
  searchUsers,
  sendRequest,
  getPendingRequests,
  acceptRequests,
  getContacts,
  declineRequest,
  withdrawRequest,
  getUserById,
} from "../../redux/reducers/user";
import { clearTokens } from "../../util/auth";
import api from "../../util/api";
// We'll assume useTheme is imported from a context file
// import { useTheme } from "../contexts/ThemeContext";

// Mock implementation of useTheme hook for demonstration
// In your real app, you'd import this from your context file
const useTheme = () => {
  const [theme, setThemeState] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") || "dark";
    }
    return "dark";
  });

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
  };

  return { theme, setTheme };
};


const sampleStatus = [
  {
    id: 2,
    name: "Avinash Verma",
    time: "Today, 10:45 AM",
    pic: "https://placehold.co/100x100/E2E8F0/4A5568?text=AV",
  },
  {
    id: 3,
    name: "Mom",
    time: "Today, 8:30 AM",
    pic: "https://placehold.co/100x100/FEE2E2/B91C1C?text=M",
  },
];

const sampleCalls = [
  {
    id: 1,
    name: "Avinash Verma",
    type: "video",
    incoming: true,
    time: "Today, 11:00 AM",
    pic: "https://placehold.co/100x100/E2E8F0/4A5568?text=AV",
    missed: false,
  },
  {
    id: 2,
    name: "Mom",
    type: "audio",
    incoming: false,
    time: "Today, 9:20 AM",
    pic: "https://placehold.co/100x100/FEE2E2/B91C1C?text=M",
    missed: false,
  },
  {
    id: 3,
    name: "Work Group",
    type: "audio",
    incoming: true,
    time: "Yesterday, 5:30 PM",
    pic: "https://placehold.co/100x100/DBEAFE/1D4ED8?text=WG",
    missed: true,
  },
  {
    id: 4,
    name: "Dad",
    type: "video",
    incoming: false,
    time: "Yesterday, 3:00 PM",
    pic: "https://placehold.co/100x100/E0E7FF/3730A3?text=D",
    missed: false,
  },
];

// friend requests will come from API via Redux

function ChatListItem({ chat, onClick }) {
  return (
    <div
      onClick={onClick}
      className="group flex items-center p-4 hover:bg-gradient-to-r hover:from-cyan-500/10 hover:to-blue-500/10 cursor-pointer transition-all duration-300 border-b border-black/5 dark:border-white/5 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
      <div className="relative">
        <img
          src={chat.pic}
          alt={chat.name}
          className="w-14 h-14 rounded-full object-cover mr-4 ring-2 ring-cyan-400/20 group-hover:ring-cyan-400/60 transition-all duration-300 group-hover:scale-110"
        />
        {chat.unread > 0 && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center text-xs font-bold text-black animate-pulse">
            {chat.unread}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate group-hover:text-cyan-500 transition-colors">
          {chat.name}
        </h3>
        <p className="text-sm text-gray-600 dark:text-white/60 truncate mt-0.5">
          {chat.lastMessage}
        </p>
      </div>
      <div className="flex flex-col items-end text-xs text-gray-500 dark:text-white/50 ml-3">
        <span className="font-medium">{chat.time}</span>
      </div>
    </div>
  );
}

function StatusListItem({ status, isMyStatus = false }) {
  return (
    <div className="group flex items-center p-4 hover:bg-gradient-to-r hover:from-purple-500/10 hover:to-pink-500/10 cursor-pointer transition-all duration-300 border-b border-black/5 dark:border-white/5 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
      <div
        className={`relative ${
          isMyStatus
            ? "p-0.5 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
            : "p-[3px] rounded-full bg-gradient-to-r from-purple-400 via-pink-400 to-red-400"
        }`}
      >
        <div className="bg-white dark:bg-gray-900 rounded-full p-0.5">
          <img
            src={status.pic}
            alt={status.name}
            className="w-14 h-14 rounded-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        </div>
        {isMyStatus && (
          <div className="absolute bottom-0 right-0 w-6 h-6 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900 shadow-lg">
            <svg
              className="w-3.5 h-3.5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-hidden ml-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate group-hover:text-purple-500 transition-colors">
          {status.name}
        </h3>
        <p className="text-sm text-gray-600 dark:text-white/60 truncate mt-0.5">
          {status.time}
        </p>
      </div>
    </div>
  );
}

function CallHistoryItem({ call }) {
  const isMissed = call.missed;
  const colorClass = isMissed
    ? "text-red-500"
    : "text-gray-500 dark:text-white/60";
  return (
    <div className="group flex items-center p-4 hover:bg-gradient-to-r hover:from-green-500/10 hover:to-emerald-500/10 cursor-pointer transition-all duration-300 border-b border-black/5 dark:border-white/5 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
      <img
        src={call.pic}
        alt={call.name}
        className="w-14 h-14 rounded-full object-cover mr-4 ring-2 ring-green-400/20 group-hover:ring-green-400/60 transition-all duration-300 group-hover:scale-110"
      />
      <div className="flex-1 overflow-hidden">
        <h3
          className={`text-base font-semibold truncate transition-colors ${
            isMissed
              ? "text-red-500"
              : "text-gray-900 dark:text-white group-hover:text-green-500"
          }`}
        >
          {call.name}
        </h3>
        <div className="flex items-center text-sm mt-0.5">
          {call.incoming ? (
            <svg
              className={`w-4 h-4 mr-1.5 ${colorClass}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          ) : (
            <svg
              className={`w-4 h-4 mr-1.5 ${colorClass}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          )}
          <span className={colorClass}>{call.time}</span>
        </div>
      </div>
      <div className="ml-3 p-2 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 group-hover:scale-110 transition-transform duration-300 shadow-lg">
        {call.type === "video" ? (
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M4 8h11a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"
            />
          </svg>
        ) : (
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
            />
          </svg>
        )}
      </div>
    </div>
  );
}

function ContactListItem({ contact, onClick }) {
  const fallbackPic = `https://placehold.co/100x100/E0E7FF/3730A3?text=${
    contact?.name?.charAt(0)?.toUpperCase() || "U"
  }`;
  return (
    <div
      onClick={onClick}
      className="group flex items-center p-4 hover:bg-gradient-to-r hover:from-cyan-500/10 hover:to-blue-500/10 cursor-pointer transition-all duration-300 border-b border-black/5 dark:border-white/5 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />

      <img
        src={contact?.images?.[0] || fallbackPic}
        alt={contact?.name || "User"}
        className="w-14 h-14 rounded-full object-cover mr-4 ring-2 ring-blue-400/20 group-hover:ring-blue-400/60 transition-all duration-300 group-hover:scale-110"
      />

      <div className="flex-1 overflow-hidden">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-500 transition-colors">
          {contact?.name || "Unknown User"}
        </h3>

        <p className="text-sm text-gray-600 dark:text-white/60 truncate mt-0.5">
          {contact?.status || contact?.bio || ""}
        </p>
      </div>
    </div>
  );
}

// Naya Component: Friend Request Item
function FriendRequestItem({ request, onAccept, onDecline }) {
  return (
    <div className="group flex items-center p-4 hover:bg-gradient-to-r hover:from-yellow-500/10 hover:to-orange-500/10 transition-all duration-300 border-b border-black/5 dark:border-white/5 relative overflow-hidden">
      <img
        src={request.images?.[0] || `https://placehold.co/100x100/FBBF24/92400E?text=${request.name?.charAt(0)?.toUpperCase() || "U"}`}
        alt={request.name}
        className="w-14 h-14 rounded-full object-cover mr-4 ring-2 ring-yellow-400/20 group-hover:ring-yellow-400/60 transition-all duration-300"
      />
      <div className="flex-1 overflow-hidden">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
          {request.name}
        </h3>
        <p className="text-sm text-gray-600 dark:text-white/60 truncate mt-0.5">
          {request.email}
        </p>
      </div>
      <div className="flex space-x-2 ml-3">
        <button
          onClick={() => onAccept(request.id)}
          className="p-2 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-lg transform transition-transform hover:scale-110"
          title="Accept"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </button>
        <button
          onClick={() => onDecline(request.id)}
          className={
            request.isSent
              ? "p-2 rounded-full bg-gradient-to-r from-gray-400 to-gray-600 text-white shadow-lg transform transition-transform hover:scale-110"
              : "p-2 rounded-full bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg transform transition-transform hover:scale-110"
          }
          title={request.status === "pending" ? "Withdraw request" : "Decline"}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

function DropdownMenu({ isOpen, onClose, onProfileClick }) {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    try {
      clearTokens();
      if (typeof document !== "undefined") {
        document.cookie.split("; ").forEach((c) => {
          const eqPos = c.indexOf("=");
          const name = eqPos > -1 ? c.substring(0, eqPos) : c;
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        });
      }
      toast.success("Logged out");
    } catch (e) {
      // ignore
    } finally {
      onClose?.();
      navigate("/login");
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const menu = (
    <>
      <div
        className="fixed inset-0 z-[9998] bg-transparent"
        onClick={onClose}
      />
      <div className="fixed top-16 right-4 w-64 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-2xl shadow-2xl z-[9999] overflow-hidden animate-fadeInDown border border-black/10 dark:border-white/10">
        <div className="p-2">
          <button
            type="button"
            onClick={() => {
              onProfileClick();
              onClose();
            }}
            className="w-full flex items-center p-4 hover:bg-gradient-to-r hover:from-cyan-500/20 hover:to-blue-500/20 rounded-xl transition-all duration-300 group text-left"
          >
            <div className="p-2 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-xl mr-3 group-hover:scale-110 transition-transform duration-300">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">
              Profile
            </span>
          </button>

          <button
            type="button"
            className="w-full flex items-center p-4 hover:bg-gradient-to-r hover:from-purple-500/20 hover:to-pink-500/20 rounded-xl transition-all duration-300 group text-left"
          >
            <div className="p-2 bg-gradient-to-r from-purple-400 to-pink-500 rounded-xl mr-3 group-hover:scale-110 transition-transform duration-300">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">
              Settings
            </span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center p-4 hover:bg-gradient-to-r hover:from-red-500/20 hover:to-rose-500/20 rounded-xl transition-all duration-300 group text-left"
          >
            <div className="p-2 bg-gradient-to-r from-red-500 to-rose-500 rounded-xl mr-3 group-hover:scale-110 transition-transform duration-300">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1"
                />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">
              Logout
            </span>
          </button>

          <div className="h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent my-2" />

          <div className="flex items-center justify-between p-4 hover:bg-gradient-to-r hover:from-yellow-500/20 hover:to-orange-500/20 rounded-xl transition-all duration-300">
            <div className="flex items-center">
              <div className="p-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl mr-3">
                {theme === "dark" ? (
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                )}
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">
                Theme
              </span>
            </div>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className={`relative w-14 h-7 rounded-full transition-colors duration-300 ${
                theme === "dark"
                  ? "bg-gradient-to-r from-blue-500 to-purple-600"
                  : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${
                  theme === "dark" ? "translate-x-7" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(menu, document.body);
}

function AddContactView({ onBack }) {
  const [searchInput, setSearchInput] = useState("");
  const [searchResult, setSearchResult] = useState(null); // null, 'not_found', or {user_object}
  const [requestSent, setRequestSent] = useState(false);
  const [pendingSentRequest, setPendingSentRequest] = useState(null); // { requestId, recipientId }
  const dispatch = useDispatch();

  const handleSearch = async () => {
    setRequestSent(false);
    setPendingSentRequest(null);
    setSearchResult(null);
    const query = searchInput.trim();

    if (query === "") return;

    try {
      const resultAction = await dispatch(searchUsers(query));
      if (searchUsers.fulfilled.match(resultAction)) {
        const { success, users } = resultAction.payload;
        if (success && users && users.length > 0) {
          // Transform the user data to match our display format
          const u = users[0];
          // id might be _id from backend
          const userId = u.id || u._id || u._userId;

          // images can be an array already or a JSON string; handle both
          let picUrl = "https://placehold.co/100x100/A78BFA/FFFFFF?text=U";
          if (u.images) {
            if (typeof u.images === "string") {
              try {
                const parsed = JSON.parse(u.images);
                if (Array.isArray(parsed) && parsed.length > 0)
                  picUrl = parsed[0];
              } catch (e) {
                // fall back to using the string directly if parse fails
                picUrl = u.images;
              }
            } else if (Array.isArray(u.images) && u.images.length > 0) {
              picUrl = u.images[0];
            }
          }

          const userToDisplay = {
            id: userId,
            name: u.username || u.name,
            email: u.email,
            mobile: u.mobile,
            pic: picUrl,
            bio: u.bio,
          };
          // Check payload for any sentRequests that match this user and are pending
          // The search API may return sentRequests at the top-level of the payload
          const sentRequestsFromPayload =
            resultAction.payload?.sentRequests ||
            resultAction.payload?.sentRequests;
          if (
            Array.isArray(sentRequestsFromPayload) &&
            sentRequestsFromPayload.length > 0
          ) {
            const found = sentRequestsFromPayload.find((sr) => {
              const recipientRaw =
                sr.recipient?._id ||
                sr.recipient ||
                sr.toUserId ||
                sr.contactId;
              const candidateId = userId;
              return (
                candidateId &&
                recipientRaw &&
                String(recipientRaw) === String(candidateId)
              );
            });
            if (found && String(found.status).toLowerCase() === "pending") {
              const recipientRaw =
                found.recipient?._id ||
                found.recipient ||
                found.toUserId ||
                found.contactId;
              setPendingSentRequest({
                requestId: found._id || found.id || found.requestId,
                recipientId: recipientRaw,
              });
              setRequestSent(true);
            }
          }
          setSearchResult(userToDisplay);
        } else {
          setSearchResult("not_found");
          toast.error("No user found with that email or mobile");
        }
      } else {
        toast.error(resultAction.error?.message || "Search failed");
        setSearchResult("not_found");
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Failed to search users");
      setSearchResult("not_found");
    }
  };

  const handleSendRequest = async () => {
    if (!searchResult || searchResult === "not_found") return;

    try {
      const resultAction = await dispatch(
        sendRequest({
          recipientEmail: searchResult.email,
          message: "Hi! I'd like to connect with you on Sandesh.",
        })
      );

      if (sendRequest.fulfilled.match(resultAction)) {
        const payload = resultAction?.payload;
        const successMsg =
          typeof payload === "string"
            ? payload
            : payload?.message || "Request sent";
        toast.success(successMsg);
        // Refresh server-side state and clear local AddContactView state so component is 'refreshed'
        dispatch(getPendingRequests());
        dispatch(getContacts());
        // clear local UI state
        setSearchInput("");
        setSearchResult(null);
        setRequestSent(false);
        setPendingSentRequest(null);
      } else {
        const errorMessage = resultAction.payload;
        toast.info(errorMessage);
        setRequestSent(true); // Update UI to show "Request Sent" since there's already a pending request
      }
    } catch (error) {
      toast.error("Request already sent or failed to send");
      setRequestSent(true);
    }
  };

  const handleWithdrawRequest = async () => {
    if (!pendingSentRequest?.recipientId) {
      toast.error("No pending request to withdraw");
      return;
    }

    try {
      const result = await dispatch(
        withdrawRequest(pendingSentRequest.recipientId)
      );
      if (withdrawRequest.fulfilled.match(result)) {
        toast.success(result.payload?.data?.message || "Request withdrawn");
        setPendingSentRequest(null);
        setRequestSent(false);
        dispatch(getPendingRequests());
        dispatch(getContacts());
      } else {
        const msg =
          result.payload ||
          result.error?.message ||
          "Failed to withdraw request";
        toast.error(
          typeof msg === "string" ? msg : "Failed to withdraw request"
        );
      }
    } catch (e) {
      toast.error("Failed to withdraw request");
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col h-screen bg-white dark:bg-gray-900 animate-slideInRight text-gray-900 dark:text-white">
      <header className="flex-shrink-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl p-5 flex items-center border-b border-black/5 dark:border-white/5 shadow-lg">
        <button
          onClick={onBack}
          className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-xl transition-all duration-300 hover:scale-110 mr-4 border border-black/10 dark:border-white/10 text-gray-800 dark:text-white"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </button>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
          Add New Contact
        </h1>
      </header>

      <div className="p-4 space-y-4">
        <p className="text-sm text-gray-600 dark:text-white/60 text-center">
          Search for new contacts by email or mobile.
        </p>
        <div className="flex space-x-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Enter email or mobile number"
            className="flex-1 px-4 py-3 rounded-xl bg-white/20 dark:bg-white/10 backdrop-blur-xl border border-black/10 dark:border-white/10 text-gray-900 placeholder-gray-700/60 dark:text-white dark:placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-400"
          />
          <button
            onClick={handleSearch}
            className="px-5 py-3 bg-gradient-to-r from-cyan-400 to-blue-500 text-white font-bold rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
          >
            Search
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {searchResult === "not_found" && (
          <p className="text-center text-gray-500 dark:text-white/60">
            No user found with that email or mobile.
          </p>
        )}
        {searchResult && searchResult !== "not_found" && (
          <div className="p-6 bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg rounded-2xl shadow-md">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <img
                  src={searchResult.pic}
                  alt={searchResult.name}
                  className="w-16 h-16 rounded-full object-cover mr-4 shadow-lg"
                />
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {searchResult.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-white/60 mt-1">
                    {searchResult?.email}
                    <br />
                    {searchResult?.mobile}
                  </p>
                </div>
              </div>
              {pendingSentRequest ? (
                <button
                  onClick={handleWithdrawRequest}
                  className="px-2 py-2 font-semibold rounded-xl bg-gradient-to-r from-gray-500 to-gray-700 text-white transition-all shadow-lg hover:scale-105"
                >
                  Withdraw
                </button>
              ) : (
                <button
                  onClick={handleSendRequest}
                  disabled={requestSent}
                  className={`px-2 py-2 font-semibold rounded-xl transition-all shadow-lg ${
                    requestSent
                      ? "bg-gray-500 text-white/70"
                      : "bg-gradient-to-r from-cyan-400 to-blue-500 text-white transform hover:scale-105"
                  }`}
                >
                  {requestSent ? "Request Sent" : "Send Request"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function UserProfileView({ onBack }) {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await api.get("/me");
        console.log("Fetched user profile:", data);
        if (!mounted) return;

        // Accept either { user: {...} } or the user object directly
        const u = data?.user ?? data ?? {};
        setUserProfile(u);
      } catch (e) {
        if (!mounted) return;
        setErr(
          e?.response?.data?.message || e?.message || "Failed to load profile."
        );
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const name = userProfile?.name || userProfile?.username || "User";
  const email = userProfile?.email || "—";
  const mobile = userProfile?.mobile || "—";
  const bio = userProfile?.bio || "No bio available";
  const pic =
    (Array.isArray(userProfile?.images) && userProfile.images[0]) ||
    userProfile?.pic ||
    `https://placehold.co/200x200/93C5FD/1E3A8A?text=${(name?.[0] || "U")
      .toString()
      .toUpperCase()}`;

  return (
    <div className="absolute inset-0 z-50 flex flex-col h-screen bg-white dark:bg-gray-900 animate-slideInRight text-gray-900 dark:text-white">
      <header className="flex-shrink-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl p-5 flex items-center border-b border-black/5 dark:border-white/5 shadow-lg">
        <button
          onClick={onBack}
          className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-xl transition-all duration-300 hover:scale-110 mr-4 border border-black/10 dark:border-white/10 text-gray-800 dark:text-white"
          aria-label="Back"
          type="button"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </button>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
          Profile
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <div className="mx-auto max-w-md p-6 bg-white/50 dark:bg-gray-800/50 rounded-2xl backdrop-blur-lg shadow-md animate-pulse">
            <div className="w-28 h-28 rounded-full bg-gray-200 dark:bg-gray-700 mx-auto mb-4" />
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mx-auto mb-2" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto mb-6" />
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
        ) : err ? (
          <div className="mx-auto max-w-md p-6 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-2xl">
            {err}
          </div>
        ) : (
          <div className="mx-auto max-w-md flex flex-col items-center p-6 bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg rounded-2xl shadow-xl border border-black/5 dark:border-white/10">
            <div className="p-1 rounded-full bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-500">
              <img
                src={pic}
                alt={name}
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover bg-white dark:bg-gray-900"
              />
            </div>

            <h3 className="mt-4 text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
              {name}
            </h3>

            <p className="mt-2 text-sm sm:text-base text-gray-700 dark:text-white/70 text-center italic">
              “{bio}”
            </p>

            <div className="w-full mt-6 space-y-3 text-sm border-t border-black/10 dark:border-white/10 pt-4">
              <p className="flex items-center text-gray-800 dark:text-white/80">
                <svg
                  className="w-5 h-5 mr-3 text-cyan-500 flex-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <span className="truncate">{email}</span>
              </p>

              <p className="flex items-center text-gray-800 dark:text-white/80">
                <svg
                  className="w-5 h-5 mr-3 text-cyan-500 flex-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.95.69l1.5 4.49a1 1 0 01-.5 1.21l-2.26 1.13a11.04 11.04 0 005.52 5.52l1.13-2.26a1 1 0 011.21-.5l4.49 1.5a1 1 0 01.69.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z"
                  />
                </svg>
                <span className="truncate">{mobile}</span>
              </p>
            </div>

            <button
              type="button"
              className="mt-6 w-full px-8 py-3 bg-gradient-to-r from-cyan-400 to-blue-500 text-white font-bold rounded-xl shadow-xl hover:shadow-2xl transition-transform hover:scale-[1.02] active:scale-100"
              onClick={() => {}}
            >
              Edit Profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Chats() {
  const [activeTab, setActiveTab] = useState("chats");
  const [currentView, setCurrentView] = useState("home"); // home, contacts, add_contact, profile, chat

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [chats, setChats] = useState([]);
  const conversations = useSelector((s) => s.chat.conversations);
  const myChats = useSelector((s) => s.chat.myChats);
  const loadingConversations = useSelector((s) => s.chat.loadingConversations);
  const contacts = useSelector((state) => state.user.contacts);
  const loadingContacts = useSelector((state) => state.user.loadingContacts);
  const [status, setStatus] = useState(sampleStatus);
  const [calls, setCalls] = useState(sampleCalls);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const pendingRequests = useSelector((state) => state.user.pendingRequests);
  const loadingPendingRequests = useSelector(
    (state) => state.user.loadingPendingRequests
  );
  const currentUser = useSelector((state) => state.user.userInfo);

  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  }, [theme]);

  // Fetch pending requests and conversations when component mounts
  useEffect(() => {
    dispatch(getPendingRequests());
    dispatch(getContacts());
    dispatch(getConversations());
    dispatch(getMyChats());
  }, [dispatch]);

  // Listen for socket events to refresh conversations in real-time
  useEffect(() => {
    const handleMyChats = (chats) => {
      console.log('myChats event received:', chats?.length || 0);
      // Refresh conversations when myChats is received
      dispatch(getConversations());
    };

    const handleNewMessage = (msg) => {
      console.log('newMessage event received in Chats');
      // Refresh conversations when a new message arrives
      dispatch(getConversations());
    };

    const handleUserOnline = (data) => {
      console.log('userOnline event received:', data);
      // Could update user online status in conversations if needed
    };

    socket.on('myChats', handleMyChats);
    socket.on('newMessage', handleNewMessage);
    socket.on('userOnline', handleUserOnline);

    return () => {
      socket.off('myChats', handleMyChats);
      socket.off('newMessage', handleNewMessage);
      socket.off('userOnline', handleUserOnline);
    };
  }, [dispatch]);

  // Map API pending requests to UI shape
  const requests = (pendingRequests || []).map((r) => {
    const senderId = r.sender?.id || r.sender?._id || r.userId;
    const recipientId =
      r.recipient?.id ||
      r.recipient?._id ||
      r.contact?.id ||
      r.contactId ||
      r.toUserId;
    const isSent = !!(
      currentUser &&
      senderId &&
      String(senderId) ===
        String(currentUser.id || currentUser._id || currentUser.userId)
    );

    // Choose which user to show in the UI: if current user sent it, show recipient info; otherwise show sender info
    const displayUser = isSent
      ? r.recipient || r.contact || { username: "Unknown", email: "" }
      : r.sender || { username: "Unknown", email: "" };

    const pic = displayUser.images
      ? Array.isArray(displayUser.images)
        ? displayUser.images[0]
        : typeof displayUser.images === "string"
        ? (() => {
            try {
              const p = JSON.parse(displayUser.images);
              return Array.isArray(p) && p.length ? p[0] : displayUser.images;
            } catch (e) {
              return displayUser.images;
            }
          })()
        : null
      : null;

    return {
      id: r.requestId,
      senderId,
      recipientId,
      isSent,
      name:
        displayUser.username ||
        displayUser.name ||
        displayUser.email ||
        "Unknown",
      email: displayUser.email || "",
      pic:
        pic ||
        "https://placehold.co/100x100/F87171/FFFFFF?text=" +
          ((displayUser.username || displayUser.name || "U")[0] || "U"),
      raw: r,
    };
  });

  // Handlers for requests
  const handleAcceptRequest = async (id) => {
    try {
      const req = requests.find((x) => x.id === id);
      if (!req?.senderId) return;
      const result = await dispatch(acceptRequests(req.senderId));
      if (acceptRequests.fulfilled.match(result)) {
        toast.success(result.payload?.message || "Friend request accepted");
        dispatch(getPendingRequests());
        dispatch(getContacts());
      } else {
        const msg = result.payload || "Failed to accept request";
        toast.error(typeof msg === "string" ? msg : "Failed to accept request");
      }
    } catch (e) {
      toast.error("Failed to accept request");
    }
  };

  const handleDeclineRequest = async (id) => {
    try {
      // find original request object from API payload
      const original = (pendingRequests || []).find(
        (r) =>
          String(r.requestId) === String(id) ||
          String(r.requestId) === String(id) ||
          String(r.id) === String(id)
      );

      // If we don't have the original, try from mapped requests
      const mappedReq = requests.find((x) => x.id === id);

      if (original) {
        const senderId =
          original.sender?.id || original.userId || original.fromUserId;
        const recipientId =
          original.recipient?.id ||
          original.contactId ||
          original.toUserId ||
          original.contact?.id;

        // If current user is the sender, this is a withdraw action
        if (
          currentUser &&
          senderId &&
          String(senderId) === String(currentUser.id || currentUser.userId)
        ) {
          const targetRecipient = recipientId || mappedReq?.senderId || null;
          if (!targetRecipient) {
            toast.error("Cannot determine recipient to withdraw");
            return;
          }
          const result = await dispatch(withdrawRequest(targetRecipient));
          if (withdrawRequest.fulfilled.match(result)) {
            toast.success(result.payload?.data?.message || "Request withdrawn");
            dispatch(getPendingRequests());
            dispatch(getContacts());
          } else {
            const msg =
              result.payload ||
              result.error?.message ||
              "Failed to withdraw request";
            toast.error(
              typeof msg === "string" ? msg : "Failed to withdraw request"
            );
          }
        } else {
          // Otherwise, decline (receiver rejecting sender)
          const targetSender = senderId || mappedReq?.senderId || id;
          if (!targetSender) {
            toast.error("Cannot determine sender to decline");
            return;
          }
          const result = await dispatch(declineRequest(targetSender));
          if (declineRequest.fulfilled.match(result)) {
            toast.success(result.payload?.data?.message || "Request declined");
            dispatch(getPendingRequests());
            dispatch(getContacts());
          } else {
            const msg =
              result.payload ||
              result.error?.message ||
              "Failed to decline request";
            toast.error(
              typeof msg === "string" ? msg : "Failed to decline request"
            );
          }
        }
      } else if (mappedReq?.senderId) {
        // Fallback: use mapped request's senderId to decline
        const result = await dispatch(declineRequest(mappedReq.senderId));
        if (declineRequest.fulfilled.match(result)) {
          toast.success(result.payload?.data?.message || "Request declined");
          dispatch(getPendingRequests());
          dispatch(getContacts());
        } else {
          const msg =
            result.payload ||
            result.error?.message ||
            "Failed to decline request";
          toast.error(
            typeof msg === "string" ? msg : "Failed to decline request"
          );
        }
      } else {
        toast.error("Request not found");
      }
    } catch (e) {
      console.error("Decline/Withdraw error:", e);
      toast.error("Failed to process request");
    }
  };

  const FabIcon = () => {
    switch (activeTab) {
      case "chats":
        return (
          <svg
            className="w-7 h-7"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
        );
      case "status":
        return (
          <svg
            className="w-7 h-7"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        );
      case "calls":
        return (
          <svg
            className="w-7 h-7"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  const handleFabClick = () => {
    if (activeTab === "chats") setCurrentView("contacts");
  };

  const renderView = () => {
    switch (currentView) {
      case "contacts":
        return (
          <div className="absolute inset-0 z-50 flex flex-col h-screen bg-white dark:bg-gray-900 animate-slideInRight text-gray-900 dark:text-white">
            <header className="flex-shrink-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl p-5 flex items-center border-b border-black/5 dark:border-white/5 shadow-lg">
              <button
                onClick={() => {
                  setCurrentView("home");
                  navigate("/chats");
                }}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-xl transition-all duration-300 hover:scale-110 mr-4 border border-black/10 dark:border-white/10 text-gray-800 dark:text-white"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </button>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                Select Contact
              </h1>
            </header>

            <div className="flex-1 overflow-y-auto bg-gradient-to-b from-transparent to-black/5 dark:to-white/5 p-4 space-y-6">
              {/* Naya Friend Requests Section */}
              {loadingPendingRequests && (
                <div className="p-4 text-sm text-gray-600 dark:text-white/60">
                  Loading requests...
                </div>
              )}
              {!loadingPendingRequests && requests.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 uppercase tracking-wider mb-3">
                    Pending Requests
                  </h4>
                  <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg rounded-2xl shadow-md overflow-hidden">
                    {requests.map((req) => (
                      <FriendRequestItem
                        key={req.id}
                        request={req}
                        onAccept={handleAcceptRequest}
                        onDecline={handleDeclineRequest}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* My Contacts Section */}
              <div>
                <h4 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 uppercase tracking-wider mb-3">
                  My Contacts
                </h4>

                <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg rounded-2xl shadow-md overflow-hidden">
                  <div
                    onClick={() => setCurrentView("add_contact")}
                    className="flex items-center p-4 hover:bg-gradient-to-r hover:from-cyan-500/10 hover:to-blue-500/10 cursor-pointer transition-all duration-300 border-b border-black/5 dark:border-white/5 group"
                  >
                    <div className="w-14 h-14 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 flex items-center justify-center mr-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <svg
                        className="w-7 h-7 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                      Add New Contact
                    </h3>
                  </div>

                  <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg rounded-2xl shadow-md overflow-hidden">
                    {loadingContacts ? (
                      <p className="p-4 text-center text-sm text-gray-500 dark:text-white/60">
                        Loading contacts...
                      </p>
                    ) : contacts.length > 0 ? (
                      contacts.map((contact) => (
                        <ContactListItem
                          key={contact.id}
                          contact={{
                            id: contact.id,
                            images: contact?.images || [],
                            name: contact.username || contact.name,
                            status: contact.bio || contact.status || "",
                          }}
                          onClick={async () => {
                            try {
                              // First get user details including online status using the new API
                              const result = await dispatch(getUserById(contact._id)).unwrap();
                              console.log("User details fetched:", result);
                              
                              // Also get my chats for complete data
                              await dispatch(getMyChats()).unwrap();
                              
                              // Use the detailed user info from API response if available
                              const userObj = {
                                ...(contact || {}),
                                _id: contact.id,
                                ...(result?.user || {}),
                                isOnline: result?.user?.isOnline || false,
                                lastSeen: result?.user?.lastSeen || null
                              };
                              
                              dispatch(setActiveUser(userObj));
                              setCurrentView("chat");
                            } catch (error) {
                              console.error("Failed to fetch user details:", error);
                              // Still navigate to chat even if the API call fails
                              const userObj = {
                                ...(contact || {}),
                                _id: contact.id,
                              };
                              dispatch(setActiveUser(userObj));
                              setCurrentView("chat");
                            }
                          }}
                        />
                      ))
                    ) : (
                      <p className="p-4 text-center text-sm text-gray-500 dark:text-white/60">
                        Your contact list is empty.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* No contacts ya requests hone par placeholder */}
              {!loadingContacts &&
                contacts.length === 0 &&
                !loadingPendingRequests &&
                requests.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <div className="w-32 h-32 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center mb-6 shadow-2xl animate-float">
                      <svg
                        className="w-16 h-16 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                        />
                      </svg>
                    </div>
                    <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                      No contacts found
                    </h2>
                    <p className="text-gray-600 dark:text-white/60">
                      Click "Add New Contact" to find friends.
                    </p>
                  </div>
                )}
            </div>
          </div>
        );
      case "add_contact":
        return (
          <AddContactView
            onBack={() => {
              setCurrentView("contacts");
              navigate("/chats");
            }}
          />
        );
      case "profile":
        return (
          <UserProfileView
            onBack={() => {
              setCurrentView("home");
              navigate("/chats");
            }}
          />
        );
      case "chat":
        return (
          <Messenger
            onBack={() => {
              setCurrentView("home");
              navigate("/chats");
            }}
          />
        );

      case "home":
      default:
        return (
          <div className="relative z-10 flex flex-col h-screen bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl text-gray-900 dark:text-white">
            <header className="flex-shrink-0 bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl p-5 flex justify-between items-center border-b border-black/5 dark:border-white/5 shadow-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg animate-float">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                  Sandesh
                </h1>
              </div>
              <div className="flex space-x-3 relative text-gray-800 dark:text-white">
                {showSearch ? (
                  <div className="flex items-center animate-fadeInDown w-full max-w-full">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search..."
                      className="flex-1 sm:w-64 md:w-80 p-2 rounded-xl bg-white/20 dark:bg-white/10 backdrop-blur-xl border border-black/10 dark:border-white/10 text-gray-900 placeholder-gray-700/60 dark:text-white dark:placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    />
                    <button
                      onClick={() => setShowSearch(false)}
                      className="ml-2 p-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-xl transition-all duration-300 hover:scale-110 border border-black/10 dark:border-white/10"
                    >
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowSearch(true)}
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-xl transition-all duration-300 hover:scale-110 border border-black/10 dark:border-white/10"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className={`p-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-xl transition-all duration-300 hover:scale-110 border border-black/10 dark:border-white/10 ${
                    showSearch ? "hidden sm:block" : "block"
                  }`}
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                    />
                  </svg>
                </button>
                <DropdownMenu
                  isOpen={isMenuOpen}
                  onClose={() => setIsMenuOpen(false)}
                  onProfileClick={() => setCurrentView("profile")}
                />
              </div>
            </header>

            <nav className="flex-shrink-0 flex justify-around bg-white/50 dark:bg-gray-800/50 backdrop-blur-xl border-b border-black/5 dark:border-white/5">
              {[
                {
                  key: "chats",
                  label: "Chats",
                  gradient: "from-cyan-400 to-blue-500",
                },
                {
                  key: "status",
                  label: "Status",
                  gradient: "from-purple-400 to-pink-500",
                },
                {
                  key: "calls",
                  label: "Calls",
                  gradient: "from-green-400 to-emerald-500",
                },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative w-full py-4 text-center font-bold uppercase tracking-wider text-sm transition-all duration-300 ${
                    activeTab === tab.key
                      ? "text-transparent bg-clip-text bg-gradient-to-r " +
                        tab.gradient
                      : "text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/70"
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.key && (
                    <div
                      className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 w-20 h-1 rounded-full bg-gradient-to-r ${tab.gradient} shadow-lg`}
                    ></div>
                  )}
                </button>
              ))}
            </nav>

            <div className="flex-1 overflow-y-auto bg-gradient-to-b from-transparent to-black/5 dark:to-white/5">
              {activeTab === "chats" && (
                <div>
                  {loadingConversations ? (
                    <p className="p-4 text-center text-sm text-gray-500 dark:text-white/60">Loading chats...</p>
                  ) : (conversations && conversations.length > 0) ? (
                    conversations.map((c) => {
                      const user = c.user || c.lastMessage?.senderId || c.lastMessage?.receiverId || {};
                      const name = user.username || user.name || user.email || "User";
                      const pic = Array.isArray(user.images) ? user.images[0] : (typeof user.images === 'string' ? user.images : `https://placehold.co/100x100/E2E8F0/4A5568?text=${(name[0]||'U')}`);
                      const lastText = c.lastMessage?.text || (c.lastMessage?.file ? c.lastMessage.file.name : "");
                      const time = c.lastMessage?.createdAt ? new Date(c.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";
                      const item = { id: user._id || user.id, name, pic, lastMessage: lastText, time, unread: 0 };
                      return (
                        <ChatListItem
                          key={String(item.id)}
                          chat={item}
                          onClick={async () => {
                            try {
                              const userId = user._id || user.id;
                              
                              // First get user details including online status using the new API
                              const result = await dispatch(getUserById(userId)).unwrap();
                              console.log("User details fetched from chat:", result);
                              
                              // Also get my chats for complete data
                              await dispatch(getMyChats()).unwrap();
                              
                              // Use the detailed user info from API response if available
                              const userObj = {
                                ...user,
                                ...(result?.user || {}),
                                _id: userId,
                                isOnline: result?.user?.isOnline || false,
                                lastSeen: result?.user?.lastSeen || null
                              };
                              
                              dispatch(setActiveUser(userObj));
                              setCurrentView("chat");
                            } catch (error) {
                              console.error("Failed to fetch user details:", error);
                              // Still navigate to chat even if the API call fails
                              dispatch(setActiveUser(user));
                              setCurrentView("chat");
                            }
                          }}
                        />
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                      <div className="w-32 h-32 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full flex items-center justify-center mb-6 shadow-2xl animate-float">
                        <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">No chats yet</h2>
                      <p className="text-gray-600 dark:text-white/60">Tap the button below to start a conversation</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "status" && (
                <div>
                  <StatusListItem
                    status={{
                      id: 1,
                      name: "My Status",
                      time: "Tap to add status update",
                      pic: "https://placehold.co/100x100/E0E7FF/3730A3?text=Me",
                    }}
                    isMyStatus={true}
                  />
                  <div className="px-4 pt-6 pb-3">
                    <h4 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 uppercase tracking-wider">
                      Recent Updates
                    </h4>
                  </div>
                  {status.length > 0 ? (
                    status.map((s) => <StatusListItem key={s.id} status={s} />)
                  ) : (
                    <p className="px-4 py-8 text-center text-gray-500 dark:text-white/60">
                      No recent updates
                    </p>
                  )}
                </div>
              )}

              {activeTab === "calls" && (
                <div>
                  {calls.length > 0 ? (
                    calls.map((call) => (
                      <CallHistoryItem key={call.id} call={call} />
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                      <div className="w-32 h-32 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-2xl animate-float">
                        <svg
                          className="w-16 h-16 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
                      </div>
                      <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                        No call history
                      </h2>
                      <p className="text-gray-600 dark:text-white/60">
                        Make your first call today
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <footer className="flex-shrink-0 p-3 text-center">
              <p className="text-xs text-gray-900/40 dark:text-white/30 font-semibold">
                Sandesh âœ¨ Made with â¤ï¸ by Avverma
              </p>
            </footer>

            <button
              onClick={handleFabClick}
              className="absolute bottom-20 right-6 w-16 h-16 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 text-white rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 transform hover:scale-110 hover:rotate-90 animate-float"
            >
              <FabIcon />
            </button>
          </div>
        );
    }
  };

  return (
    <>
      <style>{`
        @keyframes panBackground {
          0% { background-position: 0% 50%; }
          25% { background-position: 100% 50%; }
          50% { background-position: 100% 100%; }
          75% { background-position: 0% 100%; }
          100% { background-position: 0% 50%; }
        }
        .animate-panBackground { background-size: 400% 400%; animation: panBackground 20s ease-in-out infinite; }
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0%); opacity: 1; } }
        .animate-slideInRight { animation: slideInRight 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-20px) scale(0.9); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .animate-fadeInDown { animation: fadeInDown 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        .animate-float { animation: float 3s ease-in-out infinite; }
        @keyframes shimmer { 0% { background-position: -1000px 0; } 100% { background-position: 1000px 0; } }
        .animate-shimmer { animation: shimmer 3s infinite; background: linear-gradient(to right, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%); background-size: 1000px 100%; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        .dark ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 10px; }
        .dark ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }
        .light ::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.2); border-radius: 10px; }
        .light ::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.3); }
      `}</style>

      <div
        className={`min-h-screen font-sans overflow-hidden relative ${theme}`}
      >
        <div className="absolute inset-0 z-0 animate-panBackground bg-gradient-to-br from-cyan-500 via-blue-600 via-purple-600 to-pink-500" />

        {/* Render the current view */}
        {renderView()}
      </div>
    </>
  );
}
