import { useState, useEffect, useRef } from "react";
import socket from "../socket";
import { useAuth } from "../context/AuthContext";
import VideoCallModal from "./VideoCallModal";

const API_URL = "/api";

const COLORS = ["#128C7E", "#9b59b6", "#e67e22", "#2980b9", "#c0392b", "#16a085"];
const getColor = (name?: string) => COLORS[(name?.charCodeAt(0) ?? 0) % COLORS.length] || COLORS[0];
const getInitials = (name?: string) => name?.charAt(0).toUpperCase() || "?";
const formatTime = (ts: string) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const isOnline = (id: number, onlineUsers: string[]) => onlineUsers.map(String).includes(String(id));

const getAudioSrc = (media_data: string) => {
  if (!media_data) return "";
  if (media_data.startsWith("http")) return media_data;
  if (media_data.startsWith("data:")) return media_data;
  return `data:audio/webm;base64,${media_data}`;
};

const getImageSrc = (media_data: string) => {
  if (!media_data) return "";
  if (media_data.startsWith("data:")) return media_data;
  return `data:image/jpeg;base64,${media_data}`;
};

const WALLPAPERS = [
  { id: "default", label: "Default", value: "#f0ece5" },
  { id: "dark", label: "Dark", value: "#1a1a1a" },
  { id: "blue", label: "Ocean", value: "linear-gradient(135deg, #1a1a2e, #16213e)" },
  { id: "green", label: "Forest", value: "linear-gradient(135deg, #134e5e, #71b280)" },
  { id: "purple", label: "Lavender", value: "linear-gradient(135deg, #667eea, #764ba2)" },
  { id: "sunset", label: "Sunset", value: "linear-gradient(135deg, #f093fb, #f5576c)" },
  { id: "pattern1", label: "Dots", value: "radial-gradient(circle, #128C7E 1px, transparent 1px)", size: "20px 20px", color: "#f0ece5" },
  { id: "pattern2", label: "Grid", value: "linear-gradient(#128C7E44 1px, transparent 1px), linear-gradient(90deg, #128C7E44 1px, transparent 1px)", size: "20px 20px", color: "#f0ece5" },
];

interface ConversationParticipant {
  id: number;
  username: string;
  email: string;
}

interface Conversation {
  id: number;
  created_at: string;
  participants: ConversationParticipant[];
}

interface Message {
  id: number;
  conversation_id?: number;
  sender_id: number;
  sender_username?: string;
  content: string;
  message_type?: string;
  media_data?: string | null;
  created_at: string;
  deleted_for_all?: boolean;
}

export default function ChatPage() {
  const { user, token, logout } = useAuth();
  const [dark, setDark] = useState(false);
  const [wallpaper, setWallpaper] = useState(localStorage.getItem("wallpaper") || "default");
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState<string | null>(localStorage.getItem("wallpaper_custom"));
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [transcriptions, setTranscriptions] = useState<Record<number, string>>({});
  const [transcribing, setTranscribing] = useState<Record<number, boolean>>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [recording, setRecording] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sendingImage, setSendingImage] = useState(false);
  const [deleteMenu, setDeleteMenu] = useState<{ msg: Message; x: number; y: number } | null>(null);
  const [inCall, setInCall] = useState(false);
  const [callType, setCallType] = useState<"audio" | "video" | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ from: string; to: string; callType: "audio" | "video"; conversationId: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const selectedConvRef = useRef<Conversation | null>(null);

  const t = dark ? darkTheme : lightTheme;

  const apiHeaders = () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

  useEffect(() => {
    fetchConversations();
    if (user) {
      socket.emit("user_online", user.id);
    }
    socket.on("online_users", (users: string[]) => setOnlineUsers(users));
    socket.on("incoming_call", (data: any) => setIncomingCall(data));
    socket.on("call_accepted", (data: any) => { setInCall(true); setCallType(data.callType); setIncomingCall(null); });
    socket.on("call_declined", () => setIncomingCall(null));
    socket.on("call_ended", () => { setInCall(false); setCallType(null); });
    return () => {
      socket.off("online_users");
      socket.off("incoming_call");
      socket.off("call_accepted");
      socket.off("call_declined");
      socket.off("call_ended");
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    selectedConvRef.current = selectedConv;
    if (selectedConv) {
      fetchMessages(selectedConv.id);
      socket.emit("join_conversation", selectedConv.id);
    }
  }, [selectedConv]);

  useEffect(() => {
    socket.on("receive_message", (data: any) => {
      const convId = data.conversation_id || data.conversationId;
      if (selectedConvRef.current && String(convId) === String(selectedConvRef.current.id)) {
        fetchMessages(convId);
      }
    });
    socket.on("delete_message_all", (data: any) => {
      setMessages((prev) => prev.map((m) =>
        m.id === data.messageId
          ? { ...m, deleted_for_all: true, content: "This message was deleted", message_type: "text", media_data: null }
          : m
      ));
    });
    return () => {
      socket.off("receive_message");
      socket.off("delete_message_all");
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const close = () => setDeleteMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await fetch(`${API_URL}/conversations`, { headers: apiHeaders() });
      if (res.ok) setConversations(await res.json());
    } catch {}
  };

  const fetchMessages = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/messages/list?conversationId=${id}`, { headers: apiHeaders() });
      if (res.ok) {
        setMessages(await res.json());
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    } catch {}
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConv) return;
    const content = newMessage;
    setNewMessage("");
    try {
      const res = await fetch(`${API_URL}/messages`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ conversationId: selectedConv.id, content, message_type: "text" }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages((prev) => [...prev, { ...msg, sender_username: user?.username }]);
        socket.emit("send_message", { conversation_id: selectedConv.id, conversationId: selectedConv.id, message_type: "text" });
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    } catch {}
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5MB"); return; }
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const sendImage = async () => {
    if (!imagePreview || !selectedConv || sendingImage) return;
    setSendingImage(true);
    const preview = imagePreview;
    setImagePreview(null);
    try {
      const base64 = preview.includes(",") ? preview.split(",")[1] : preview;
      const res = await fetch(`${API_URL}/messages`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ conversationId: selectedConv.id, content: base64, message_type: "image" }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages((prev) => [...prev, { ...msg, sender_username: user?.username }]);
        socket.emit("send_message", { conversation_id: selectedConv.id, conversationId: selectedConv.id, message_type: "image" });
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    } catch { alert("Failed to send image. Make sure it's under 5MB."); }
    finally { setSendingImage(false); }
  };

  const startRecording = async () => {
    if (typeof MediaRecorder === "undefined") {
      alert("Voice messages are not supported in Safari. Please use Chrome or Firefox.");
      return;
    }
    if (recording) { stopRecording(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "audio/ogg";
      const mr = new MediaRecorder(stream, { mimeType });
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach((t) => t.stop());
        sendVoiceMessage(blob);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch { alert("Microphone access denied."); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const sendVoiceMessage = async (blob: Blob) => {
    if (!selectedConv) return;
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const result = reader.result as string;
        const base64Audio = result.includes(",") ? result.split(",")[1] : result;
        if (!base64Audio) { alert("No audio recorded"); return; }
        const res = await fetch(`${API_URL}/messages`, {
          method: "POST",
          headers: apiHeaders(),
          body: JSON.stringify({ conversationId: selectedConv.id, content: base64Audio, message_type: "voice" }),
        });
        if (res.ok) {
          const msg = await res.json();
          setMessages((prev) => [...prev, { ...msg, sender_username: user?.username }]);
          socket.emit("send_message", { conversation_id: selectedConv.id, conversationId: selectedConv.id, message_type: "voice" });
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        }
      };
      reader.readAsDataURL(blob);
    } catch (err: any) { alert("Failed to send voice: " + err.message); }
  };

  const startNewChat = async () => {
    setError("");
    if (!newEmail.trim()) { setError("Please enter an email"); return; }
    try {
      const convRes = await fetch(`${API_URL}/conversations`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ participantEmail: newEmail.trim() }),
      });
      const data = await convRes.json();
      if (!convRes.ok) throw new Error(data.message);
      setShowNewChat(false);
      setNewEmail("");
      setConversations((prev) => {
        const exists = prev.find((c) => c.id === data.id);
        return exists ? prev : [data, ...prev];
      });
      setSelectedConv(data);
    } catch (err: any) { setError(err.message || "User not found"); }
  };

  const transcribeAudio = (msgId: number, audioUrl: string) => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("Speech recognition not supported in this browser. Try Chrome!");
      return;
    }
    setTranscribing((prev) => ({ ...prev, [msgId]: true }));
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    const audio = new Audio(audioUrl);
    audio.play();
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setTranscriptions((prev) => ({ ...prev, [msgId]: transcript }));
      setTranscribing((prev) => ({ ...prev, [msgId]: false }));
      audio.pause();
    };
    recognition.onerror = () => {
      setTranscriptions((prev) => ({ ...prev, [msgId]: "Could not transcribe audio." }));
      setTranscribing((prev) => ({ ...prev, [msgId]: false }));
      audio.pause();
    };
    recognition.onend = () => {
      setTranscribing((prev) => ({ ...prev, [msgId]: false }));
      audio.pause();
    };
    recognition.start();
  };

  const handleDeleteForMe = async (msgId: number) => {
    try {
      const res = await fetch(`${API_URL}/messages/delete-me`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ id: msgId }),
      });
      if (res.ok) setMessages((prev) => prev.filter((m) => m.id !== msgId));
      setDeleteMenu(null);
    } catch { alert("Failed to delete message"); }
  };

  const handleDeleteForAll = async (msg: Message) => {
    try {
      const res = await fetch(`${API_URL}/messages/delete-all`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ id: msg.id }),
      });
      if (res.ok) {
        setMessages((prev) => prev.map((m) =>
          m.id === msg.id
            ? { ...m, deleted_for_all: true, content: "This message was deleted", message_type: "text", media_data: null }
            : m
        ));
        socket.emit("delete_message_all", { messageId: msg.id, conversationId: selectedConv?.id });
      }
      setDeleteMenu(null);
    } catch { alert("Failed to delete message"); }
  };

  const initiateCall = (type: "audio" | "video") => {
    if (!selectedConv) return;
    socket.emit("initiate_call", {
      from: String(user?.id),
      to: String(selectedConv.participants?.[0]?.id),
      callType: type,
      conversationId: String(selectedConv.id),
    });
    setCallType(type);
    setInCall(true);
  };

  const acceptCall = () => {
    if (incomingCall) {
      socket.emit("accept_call", { from: incomingCall.from, to: incomingCall.to, callType: incomingCall.callType });
      setInCall(true);
      setCallType(incomingCall.callType);
      setIncomingCall(null);
    }
  };

  const declineCall = () => {
    if (incomingCall) {
      socket.emit("decline_call", { from: incomingCall.from, to: incomingCall.to });
      setIncomingCall(null);
    }
  };

  const endCall = () => {
    socket.emit("end_call", { conversationId: String(selectedConv?.id) });
    setInCall(false);
    setCallType(null);
  };

  const handleAudioPlay = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    if (currentAudioRef.current && currentAudioRef.current !== e.target) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
    }
    currentAudioRef.current = e.target as HTMLAudioElement;
  };

  const handleCustomWallpaper = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      localStorage.setItem("wallpaper", "custom");
      localStorage.setItem("wallpaper_custom", reader.result as string);
      setWallpaper("custom");
      setCustomWallpaperUrl(reader.result as string);
      setShowWallpaperPicker(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const saveWallpaper = (id: string) => {
    setWallpaper(id);
    localStorage.setItem("wallpaper", id);
    setShowWallpaperPicker(false);
  };

  const getWallpaperStyle = (): React.CSSProperties => {
    if (wallpaper === "custom" && customWallpaperUrl) {
      return { backgroundImage: `url(${customWallpaperUrl})`, backgroundSize: "cover", backgroundPosition: "center" };
    }
    const w = WALLPAPERS.find((w) => w.id === wallpaper) || WALLPAPERS[0];
    return {
      background: w.value,
      ...(w.size && { backgroundSize: w.size }),
      ...(w.color && { backgroundColor: w.color }),
    };
  };

  const filtered = conversations.filter((c) =>
    c.participants?.[0]?.username?.toLowerCase().includes(search.toLowerCase()) ||
    c.participants?.[0]?.email?.toLowerCase().includes(search.toLowerCase())
  );

  const renderMessage = (msg: Message, i: number) => {
    const isMe = msg.sender_id === user?.id;
    const type = msg.message_type || "text";

    const showDeleteMenu = (e: React.MouseEvent, msg: Message) => {
      e.preventDefault();
      setDeleteMenu({ msg, x: e.clientX, y: e.clientY });
    };

    const mediaSrc = msg.media_data || msg.content;

    return (
      <div key={i} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: "8px" }} onContextMenu={(e) => showDeleteMenu(e, msg)}>
        {type === "image" && mediaSrc ? (
          <div style={{ ...s.bubble, background: isMe ? t.bubbleMe : t.bubbleThem, border: isMe ? "none" : `1px solid ${t.border}`, borderBottomRightRadius: isMe ? "4px" : "14px", borderBottomLeftRadius: isMe ? "14px" : "4px", padding: "6px" }}>
            <img
              src={getImageSrc(mediaSrc)}
              alt="shared"
              style={{ maxWidth: "240px", maxHeight: "240px", borderRadius: "8px", display: "block", cursor: "pointer" }}
              onClick={() => window.open(getImageSrc(mediaSrc), "_blank")}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <span style={{ ...s.bubbleTime, color: t.mutedText }}>{formatTime(msg.created_at)}{isMe && " ✓✓"}</span>
          </div>
        ) : type === "voice" && mediaSrc ? (
          <div style={{ ...s.voiceBubble, background: isMe ? t.bubbleMe : t.bubbleThem, border: isMe ? "none" : `1px solid ${t.border}`, flexDirection: "column", alignItems: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
              <audio
                controls
                src={getAudioSrc(mediaSrc)}
                style={{ height: "36px", outline: "none", maxWidth: "200px", borderRadius: "8px" }}
                onPlay={handleAudioPlay}
              />
              <button
                onClick={() => transcribeAudio(msg.id, getAudioSrc(mediaSrc))}
                style={{ background: "#25D366", border: "none", borderRadius: "6px", color: "#fff", fontSize: "11px", padding: "4px 8px", cursor: "pointer", flexShrink: 0 }}
                title="Convert to text"
              >
                {transcribing[msg.id] ? "..." : "📝"}
              </button>
            </div>
            {transcriptions[msg.id] && (
              <div style={{ marginTop: "6px", fontSize: "12px", color: isMe ? "#ccc" : t.mutedText, fontStyle: "italic", maxWidth: "220px", wordBreak: "break-word" }}>
                📝 "{transcriptions[msg.id]}"
              </div>
            )}
            <span style={{ ...s.bubbleTime, color: t.mutedText }}>{formatTime(msg.created_at)}{isMe && " ✓✓"}</span>
          </div>
        ) : (
          <div style={{
            ...s.bubble,
            background: isMe ? t.bubbleMe : t.bubbleThem,
            color: isMe ? (dark ? "#e0e0e0" : "#fff") : t.text,
            border: isMe ? "none" : `1px solid ${t.border}`,
            borderBottomRightRadius: isMe ? "4px" : "14px",
            borderBottomLeftRadius: isMe ? "14px" : "4px",
            opacity: msg.deleted_for_all ? 0.6 : 1,
          }}>
            {!isMe && <div style={{ fontSize: "11px", fontWeight: "600", color: "#25D366", marginBottom: "4px" }}>{msg.sender_username}</div>}
            <p style={{ ...s.bubbleText, fontStyle: msg.deleted_for_all ? "italic" : "normal" }}>{msg.content}</p>
            <span style={{ ...s.bubbleTime, color: isMe ? (dark ? "#aaa" : "#ccc") : t.mutedText }}>{formatTime(msg.created_at)}{isMe && " ✓✓"}</span>
          </div>
        )}
      </div>
    );
  };

  if (inCall && callType) {
    return (
      <VideoCallModal
        callType={callType}
        receiverName={selectedConv?.participants?.[0]?.username || "User"}
        onEndCall={endCall}
        darkMode={dark}
        conversationId={selectedConv?.id}
        userId={user?.id}
        userName={user?.username}
      />
    );
  }

  return (
    <div style={{ ...s.app, background: t.pageBg }}>
      {incomingCall && (
        <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: dark ? "#1a1f3a" : "#fff", border: `2px solid ${t.border}`, borderRadius: "12px", padding: "24px", zIndex: 9999, textAlign: "center", minWidth: "320px", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
          <h2 style={{ color: t.text, margin: "0 0 16px 0" }}>Incoming Call</h2>
          <p style={{ color: t.text, fontSize: "16px", margin: "0 0 8px 0" }}>Someone is calling...</p>
          <p style={{ color: "#999", fontSize: "12px", margin: "0 0 20px 0" }}>{incomingCall.callType === "video" ? "📹 Video Call" : "☎️ Voice Call"}</p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            <button onClick={acceptCall} style={{ padding: "10px 24px", background: "#25D366", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>✓ Accept</button>
            <button onClick={declineCall} style={{ padding: "10px 24px", background: "#e53935", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>✕ Decline</button>
          </div>
        </div>
      )}
      <div style={{ ...s.sidebar, background: t.sidebarBg, borderRight: `1px solid ${t.border}` }}>
        <div style={{ ...s.profileRow, borderBottom: `1px solid ${t.border}` }}>
          <div style={{ ...s.avatar, background: getColor(user?.username) }}>{getInitials(user?.username)}</div>
          <div style={s.profileInfo}>
            <span style={{ ...s.profileName, color: t.text }}>{user?.username}</span>
            <span style={{ fontSize: "11px", color: t.mutedText }}>{user?.email}</span>
          </div>
          <div style={s.toggleRow}>
            <span style={{ fontSize: "11px", color: t.mutedText }}>{dark ? "🌙" : "☀️"}</span>
            <div
              style={{ ...s.toggle, background: dark ? "#25D366" : "#ccc" }}
              onClick={() => setDark(!dark)}
            >
              <div style={{ ...s.toggleThumb, transform: dark ? "translateX(16px)" : "translateX(0)" }} />
            </div>
          </div>
          <button style={{ ...s.iconBtn, color: t.mutedText }} onClick={logout} title="Logout">⏻</button>
        </div>

        <div style={{ ...s.searchBox, background: t.inputBg, margin: "10px 12px 6px", borderRadius: "12px" }}>
          <span style={{ color: t.mutedText }}>🔍</span>
          <input
            style={{ ...s.searchInput, background: "transparent", color: t.text }}
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button style={{ ...s.iconBtn, color: "#25D366", fontSize: "22px" }} onClick={() => setShowNewChat(!showNewChat)} title="New chat">✎</button>
        </div>

        {showNewChat && (
          <div style={{ ...s.newChat, background: t.inputBg, margin: "0 12px 8px", borderRadius: "12px" }}>
            <input
              style={{ ...s.newChatInput, background: t.sidebarBg, color: t.text, border: `1px solid ${t.border}` }}
              placeholder="Enter Gmail address to chat..."
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startNewChat()}
            />
            {error && <p style={s.newChatErr}>{error}</p>}
            <div style={s.newChatBtns}>
              <button style={{ ...s.cancelBtn, background: t.inputBg, border: `1px solid ${t.border}`, color: t.text }} onClick={() => { setShowNewChat(false); setError(""); }}>Cancel</button>
              <button style={s.startBtn} onClick={startNewChat}>Start Chat</button>
            </div>
          </div>
        )}

        <div style={s.convList}>
          {filtered.length === 0 && (
            <div style={s.empty}>
              <p style={{ fontSize: "32px", margin: "0 0 8px" }}>💬</p>
              <p style={{ color: t.text, fontWeight: "600", margin: "0 0 4px", fontSize: "14px" }}>No conversations yet</p>
              <p style={{ color: t.mutedText, fontSize: "12px", margin: 0 }}>Click ✎ to start chatting</p>
            </div>
          )}
          {filtered.map((conv) => {
            const peer = conv.participants?.[0];
            return (
              <div
                key={conv.id}
                style={{ ...s.convItem, borderBottom: `1px solid ${t.border}`, background: selectedConv?.id === conv.id ? t.activeConv : "transparent" }}
                onClick={() => setSelectedConv(conv)}
              >
                <div style={{ ...s.avatar, background: getColor(peer?.username) }}>{getInitials(peer?.username)}</div>
                <div style={s.convMeta}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ ...s.convName, color: t.text }}>{peer?.username}</span>
                    <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: isOnline(peer?.id ?? 0, onlineUsers) ? "#4ade80" : "#aaa", display: "inline-block" }} />
                  </div>
                  <span style={{ color: t.mutedText, fontSize: "12px" }}>{peer?.email}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ ...s.chat, background: t.chatBg }}>
        {!selectedConv ? (
          <div style={s.welcome}>
            <div style={{ fontSize: "56px" }}>💬</div>
            <h2 style={{ ...s.welcomeTitle, color: t.text }}>WhatsApp Web</h2>
            <p style={{ color: t.mutedText, fontSize: "14px", margin: 0 }}>Select a conversation or start a new one</p>
          </div>
        ) : (
          <>
            <div style={{ ...s.chatHeader, background: t.sidebarBg, borderBottom: `1px solid ${t.border}` }}>
              {(() => { const peer = selectedConv.participants?.[0]; const online = isOnline(peer?.id ?? 0, onlineUsers); return (<>
              <div style={{ ...s.avatar, background: getColor(peer?.username) }}>{getInitials(peer?.username)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ ...s.chatName, color: t.text }}>{peer?.username}</div>
                <div style={{ fontSize: "12px", color: online ? "#4ade80" : "#aaa" }}>
                  {online ? "● Online" : "● Offline"}
                </div>
              </div>
              <button
                onClick={() => initiateCall("audio")}
                style={{ width: "36px", height: "36px", borderRadius: "50%", background: online ? "#25D366" : "#ccc", color: "#fff", border: "none", fontSize: "18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                title="Voice Call"
              >☎️</button>
              <button
                onClick={() => initiateCall("video")}
                style={{ width: "36px", height: "36px", borderRadius: "50%", background: online ? "#25D366" : "#ccc", color: "#fff", border: "none", fontSize: "18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                title="Video Call"
              >📹</button>
              </>); })()}
              <button
                style={{ background: "transparent", border: "none", fontSize: "20px", cursor: "pointer", padding: "4px", color: t.mutedText }}
                onClick={() => setShowWallpaperPicker(!showWallpaperPicker)}
                title="Change wallpaper"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </button>
            </div>

            {showWallpaperPicker && (
              <div style={{ padding: "12px 20px", background: t.sidebarBg, borderBottom: `1px solid ${t.border}`, display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                <span style={{ color: t.mutedText, fontSize: "12px", width: "100%", marginBottom: "4px" }}>Choose wallpaper:</span>
                {WALLPAPERS.map((w) => (
                  <div
                    key={w.id}
                    onClick={() => saveWallpaper(w.id)}
                    style={{ width: "40px", height: "40px", borderRadius: "8px", background: w.value, ...(w.size && { backgroundSize: w.size }), ...(w.color && { backgroundColor: w.color }), cursor: "pointer", border: wallpaper === w.id ? "3px solid #25D366" : `2px solid ${t.border}`, flexShrink: 0 }}
                    title={w.label}
                  />
                ))}
                <div
                  onClick={() => wallpaperInputRef.current?.click()}
                  style={{ width: "40px", height: "40px", borderRadius: "8px", background: "linear-gradient(135deg, #667eea, #764ba2)", cursor: "pointer", border: `2px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}
                  title="Upload from device"
                >📁</div>
                <button style={{ fontSize: "11px", padding: "4px 8px", borderRadius: "6px", border: `1px solid ${t.border}`, background: t.inputBg, color: t.mutedText, cursor: "pointer" }} onClick={() => setShowWallpaperPicker(false)}>Close</button>
              </div>
            )}

            {deleteMenu && (
              <div
                style={{ position: "fixed", top: deleteMenu.y, left: deleteMenu.x, background: "#fff", borderRadius: "12px", boxShadow: "0 4px 24px rgba(0,0,0,0.15)", zIndex: 1000, overflow: "hidden", minWidth: "180px", border: "1px solid #ebebeb" }}
                onMouseLeave={() => setDeleteMenu(null)}
              >
                <div style={{ padding: "12px 18px", cursor: "pointer", fontSize: "14px", color: "#e53935", borderBottom: "1px solid #f5f5f5", display: "flex", alignItems: "center", gap: "8px" }} onClick={() => handleDeleteForMe(deleteMenu.msg.id)}>
                  🗑️ Delete for Me
                </div>
                {deleteMenu.msg.sender_id === user?.id && (
                  <div style={{ padding: "12px 18px", cursor: "pointer", fontSize: "14px", color: "#e53935", borderBottom: "1px solid #f5f5f5", display: "flex", alignItems: "center", gap: "8px" }} onClick={() => handleDeleteForAll(deleteMenu.msg)}>
                    🗑️ Delete for Everyone
                  </div>
                )}
                <div style={{ padding: "12px 18px", cursor: "pointer", fontSize: "14px", color: "#aaa", display: "flex", alignItems: "center", gap: "8px" }} onClick={() => setDeleteMenu(null)}>
                  ✕ Cancel
                </div>
              </div>
            )}

            <div style={{ ...s.messages, ...getWallpaperStyle() }}>
              {messages.map((msg, i) => renderMessage(msg, i))}
              <div ref={messagesEndRef} />
            </div>

            {imagePreview && (
              <div style={{ ...s.imagePreviewBar, background: t.sidebarBg, borderTop: `1px solid ${t.border}` }}>
                <img src={imagePreview} alt="preview" style={{ height: "80px", borderRadius: "8px", objectFit: "cover" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ color: t.text, fontSize: "13px" }}>{sendingImage ? "Sending..." : "Ready to send"}</span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button style={{ ...s.cancelBtn, background: t.inputBg, border: `1px solid ${t.border}`, color: t.text }} onClick={() => setImagePreview(null)} disabled={sendingImage}>Cancel</button>
                    <button style={{ ...s.startBtn, opacity: sendingImage ? 0.6 : 1 }} onClick={sendImage} disabled={sendingImage}>
                      {sendingImage ? "Sending..." : "Send Image"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div style={{ ...s.inputRow, background: t.sidebarBg, borderTop: `1px solid ${t.border}` }}>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageSelect} />
              <input ref={wallpaperInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCustomWallpaper} />
              <button style={{ ...s.attachBtn, color: t.mutedText }} onClick={() => fileInputRef.current?.click()} title="Send image">📎</button>
              <input
                style={{ ...s.msgInput, background: t.inputBg, color: t.text, border: `1px solid ${t.border}` }}
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              {newMessage.trim() ? (
                <button style={{ ...s.sendBtn, background: dark ? "#25D366" : "#111" }} onClick={sendMessage}>➤</button>
              ) : (
                <button
                  style={{ ...s.sendBtn, background: recording ? "#e53935" : (dark ? "#25D366" : "#111") }}
                  onClick={recording ? stopRecording : startRecording}
                >
                  {recording ? "⏹" : "🎤"}
                </button>
              )}
            </div>
            {recording && (
              <div style={{ padding: "6px 24px", textAlign: "center", background: t.sidebarBg }}>
                <span style={{ color: "#e53935", fontSize: "12px" }}>● Recording... click to stop</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const lightTheme = {
  pageBg: "#f5f5f0", sidebarBg: "#ffffff", headerBg: "#ffffff", headerText: "#111",
  text: "#111", mutedText: "#aaa", border: "#ebebeb", inputBg: "#f5f5f0",
  chatBg: "#f9f9f7", msgBg: "#f0ece5", activeConv: "#f5f5f0",
  bubbleMe: "#111", bubbleThem: "#ffffff", bubbleMeText: "#ffffff",
};

const darkTheme = {
  pageBg: "#0a0a0a", sidebarBg: "#1a1a1a", headerBg: "#111", headerText: "#ffffff",
  text: "#e0e0e0", mutedText: "#666", border: "#2a2a2a", inputBg: "#2a2a2a",
  chatBg: "#0f0f0f", msgBg: "#111", activeConv: "#252525",
  bubbleMe: "#005c4b", bubbleThem: "#2a2a2a", bubbleMeText: "#e0e0e0",
};

const s: Record<string, React.CSSProperties> = {
  app: { display: "flex", height: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif" },
  sidebar: { width: "360px", display: "flex", flexDirection: "column", flexShrink: 0 },
  profileRow: { display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px" },
  avatar: { width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: "700", fontSize: "16px", flexShrink: 0 },
  profileInfo: { flex: 1, display: "flex", flexDirection: "column", gap: "2px" },
  profileName: { fontWeight: "600", fontSize: "14px" },
  toggleRow: { display: "flex", alignItems: "center", gap: "6px" },
  toggle: { width: "36px", height: "20px", borderRadius: "10px", position: "relative", cursor: "pointer", transition: "background 0.3s", flexShrink: 0 },
  toggleThumb: { width: "16px", height: "16px", background: "#fff", borderRadius: "50%", position: "absolute", top: "2px", left: "2px", transition: "transform 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" },
  iconBtn: { background: "transparent", border: "none", fontSize: "18px", cursor: "pointer", padding: "4px" },
  searchBox: { display: "flex", alignItems: "center", gap: "8px", borderRadius: "12px", padding: "8px 14px" },
  searchInput: { flex: 1, border: "none", outline: "none", fontSize: "14px" },
  newChat: { borderRadius: "12px", padding: "14px" },
  newChatInput: { width: "100%", padding: "10px 12px", borderRadius: "8px", fontSize: "13px", outline: "none", boxSizing: "border-box" },
  newChatErr: { color: "#e53935", fontSize: "12px", margin: "6px 0 0" },
  newChatBtns: { display: "flex", gap: "8px", marginTop: "10px" },
  cancelBtn: { flex: 1, padding: "8px", borderRadius: "8px", cursor: "pointer", fontSize: "13px" },
  startBtn: { flex: 1, padding: "8px", background: "#25D366", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600" },
  convList: { flex: 1, overflowY: "auto" },
  empty: { padding: "60px 20px", textAlign: "center" },
  convItem: { padding: "14px 20px", display: "flex", alignItems: "center", gap: "14px", cursor: "pointer", transition: "background 0.15s" },
  convMeta: { display: "flex", flexDirection: "column", gap: "3px" },
  convName: { fontWeight: "600", fontSize: "14px" },
  chat: { flex: 1, display: "flex", flexDirection: "column" },
  welcome: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" },
  welcomeTitle: { fontSize: "24px", fontWeight: "600", margin: 0 },
  chatHeader: { padding: "14px 24px", display: "flex", alignItems: "center", gap: "14px" },
  chatName: { fontWeight: "600", fontSize: "15px" },
  messages: { flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column" },
  bubble: { maxWidth: "60%", padding: "10px 14px", borderRadius: "14px" },
  voiceBubble: { maxWidth: "280px", padding: "10px 14px", borderRadius: "14px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
  bubbleText: { margin: "0 0 4px", fontSize: "14px", lineHeight: "1.5", whiteSpace: "pre-wrap", wordBreak: "break-word" },
  bubbleTime: { fontSize: "11px", float: "right", marginLeft: "10px" },
  imagePreviewBar: { padding: "12px 24px", display: "flex", alignItems: "center", gap: "16px" },
  inputRow: { padding: "12px 20px", display: "flex", gap: "12px", alignItems: "center" },
  attachBtn: { background: "transparent", border: "none", fontSize: "22px", cursor: "pointer", padding: "4px", flexShrink: 0 },
  msgInput: { flex: 1, padding: "12px 18px", borderRadius: "24px", fontSize: "14px", outline: "none" },
  sendBtn: { width: "44px", height: "44px", borderRadius: "50%", color: "#fff", border: "none", fontSize: "18px", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" },
};
