import { useState, useEffect, useRef } from "react";
import axios from "axios";
import socket from "../socket";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../supabase";

const COLORS = ["#128C7E","#9b59b6","#e67e22","#2980b9","#c0392b","#16a085"];
const getColor = (name) => COLORS[name?.charCodeAt(0) % COLORS.length] || COLORS[0];
const getInitials = (name) => name?.charAt(0).toUpperCase() || "?";
const formatTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const isOnline = (id, onlineUsers) => onlineUsers.map(String).includes(String(id));

const getAudioSrc = (media_data) => {
  if (!media_data) return "";
  if (media_data.startsWith("http")) return media_data;
  if (media_data.startsWith("data:")) return media_data;
  return `data:audio/webm;base64,${media_data}`;
};

const getImageSrc = (media_data) => {
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

export default function ChatPage() {
  const { user, token, logout } = useAuth();
  const [dark, setDark] = useState(false);
  const [wallpaper, setWallpaper] = useState(localStorage.getItem("wallpaper") || "default");
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState(localStorage.getItem("wallpaper_custom") || null);
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [transcriptions, setTranscriptions] = useState({});
  const [transcribing, setTranscribing] = useState({});
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [recording, setRecording] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [imagePreview, setImagePreview] = useState(null);
  const [sendingImage, setSendingImage] = useState(false);
  const [deleteMenu, setDeleteMenu] = useState(null);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const wallpaperInputRef = useRef(null);
  const currentAudioRef = useRef(null);
  const selectedConvRef = useRef(null);

  const t = dark ? darkTheme : lightTheme;

  const api = axios.create({
    baseURL: (process.env.REACT_APP_API_URL || "http://localhost:5001") + "/api",
    headers: { Authorization: `Bearer ${token}` },
  });

  useEffect(() => {
    fetchConversations();
    socket.emit("user_online", user.id);
    socket.on("online_users", (users) => setOnlineUsers(users));
    return () => socket.off("online_users");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    selectedConvRef.current = selectedConv;
    if (selectedConv) {
      fetchMessages(selectedConv.id);
      socket.emit("join_conversation", selectedConv.id);
    }
  }, [selectedConv]);

  useEffect(() => {
    socket.on("receive_message", (data) => {
      const convId = data.conversation_id || data.conversationId;
      if (selectedConvRef.current && String(convId) === String(selectedConvRef.current.id)) {
        fetchMessages(convId);
      }
    });
    return () => socket.off("receive_message");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const closeDeleteMenu = () => setDeleteMenu(null);
    document.addEventListener("click", closeDeleteMenu);
    return () => document.removeEventListener("click", closeDeleteMenu);
  }, []);

  const fetchConversations = async () => {
    try { const res = await api.get("/conversations"); setConversations(res.data); } catch {}
  };

  const fetchMessages = async (id) => {
    try {
      const res = await api.get(`/messages/${id}`);
      setMessages(res.data);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {}
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConv) return;
    const content = newMessage;
    setNewMessage("");
    try {
      const res = await api.post("/messages", {
        conversationId: selectedConv.id,
        content,
        message_type: "text",
      });
      setMessages((prev) => [...prev, { ...res.data, sender_username: user.username }]);
      socket.emit("send_message", {
        conversation_id: selectedConv.id,
        conversationId: selectedConv.id,
        message_type: "text",
      });
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch {}
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Image must be under 5MB"); return; }
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const sendImage = async () => {
    if (!imagePreview || !selectedConv || sendingImage) return;
    setSendingImage(true);
    const preview = imagePreview;
    setImagePreview(null);
    try {
      const res = await api.post("/messages", {
        conversationId: selectedConv.id,
        content: "📷 Image",
        message_type: "image",
        media_data: preview,
      });
      setMessages((prev) => [...prev, { ...res.data, sender_username: user.username }]);
      socket.emit("send_message", {
        conversation_id: selectedConv.id,
        conversationId: selectedConv.id,
        message_type: "image",
      });
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      alert("Failed to send image. Make sure it's under 5MB.");
    } finally {
      setSendingImage(false);
    }
  };

  const startRecording = async () => {
    if (typeof MediaRecorder === "undefined") {
      alert("Voice messages are not supported in Safari. Please use Chrome or Firefox.");
      return;
    }
    if (recording) {
      stopRecording();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "audio/ogg";
      const mr = new MediaRecorder(stream, { mimeType });
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const mimeUsed = mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: mimeUsed });
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

  const sendVoiceMessage = async (blob) => {
    if (!selectedConv) return;
    try {
      const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
      const fileName = `voice_${user.id}_${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("chat-images")
        .upload(fileName, blob, { contentType: blob.type || "audio/webm", upsert: true });
      if (error) throw new Error(error.message);
      const { data: urlData } = supabase.storage.from("chat-images").getPublicUrl(fileName);
      const voiceUrl = urlData.publicUrl;
      const res = await api.post("/messages", {
        conversationId: selectedConv.id,
        content: "🎤 Voice message",
        message_type: "voice",
        media_data: voiceUrl,
      });
      setMessages((prev) => [...prev, { ...res.data, sender_username: user.username }]);
      socket.emit("send_message", {
        conversation_id: selectedConv.id,
        conversationId: selectedConv.id,
        message_type: "voice",
      });
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) { alert("Failed to send voice: " + err.message); }
  };

  const startNewChat = async () => {
    setError("");
    try {
      const userRes = await api.get(`/auth/find?email=${newEmail}`);
      await api.post("/conversations", { recipientId: userRes.data.id });
      setShowNewChat(false);
      setNewEmail("");
      fetchConversations();
    } catch (err) {
      setError(err.response?.data?.message || "User not found");
    }
  };

  const transcribeAudio = (msgId, audioUrl) => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Speech recognition not supported in this browser. Try Chrome!");
      return;
    }
    setTranscribing((prev) => ({ ...prev, [msgId]: true }));
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    const audio = new Audio(audioUrl);
    audio.play();

    recognition.onresult = (e) => {
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

  const handleDeleteForMe = async (msgId) => {
    try {
      await api.patch(`/messages/${msgId}/me`);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      setDeleteMenu(null);
    } catch (err) { alert("Failed to delete message"); }
  };

  const handleDeleteForAll = async (msg) => {
    try {
      await api.delete(`/messages/${msg.id}/all`);
      setMessages((prev) => prev.map((m) =>
        m.id === msg.id
          ? { ...m, deleted_for_all: true, content: "This message was deleted", message_type: "text", media_data: null }
          : m
      ));
      socket.emit("delete_message_all", { messageId: msg.id, conversationId: selectedConv.id });
      setDeleteMenu(null);
    } catch (err) { alert("Failed to delete message"); }
  };

  const handleAudioPlay = (e) => {
    if (currentAudioRef.current && currentAudioRef.current !== e.target) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
    }
    currentAudioRef.current = e.target;
  };

  const handleCustomWallpaper = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      localStorage.setItem("wallpaper", "custom");
      localStorage.setItem("wallpaper_custom", reader.result);
      setWallpaper("custom");
      setCustomWallpaperUrl(reader.result);
      setShowWallpaperPicker(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const saveWallpaper = (id) => {
    setWallpaper(id);
    localStorage.setItem("wallpaper", id);
    setShowWallpaperPicker(false);
  };

  const getWallpaperStyle = () => {
    if (wallpaper === "custom" && customWallpaperUrl) {
      return { backgroundImage: `url(${customWallpaperUrl})`, backgroundSize: "cover", backgroundPosition: "center" };
    }
    const w = WALLPAPERS.find(w => w.id === wallpaper) || WALLPAPERS[0];
    return {
      background: w.value,
      ...(w.size && { backgroundSize: w.size }),
      ...(w.color && { backgroundColor: w.color }),
    };
  };

  const filtered = conversations.filter((c) =>
    c.other_username?.toLowerCase().includes(search.toLowerCase())
  );

  const renderMessage = (msg, i) => {
    const isMe = msg.sender_id === user.id;
    const type = msg.message_type || "text";

    const showDeleteMenu = (e, msg) => {
      e.preventDefault();
      setDeleteMenu({ msg, x: e.clientX, y: e.clientY });
    };

    return (
      <div key={i} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", marginBottom: "8px" }} onContextMenu={(e) => showDeleteMenu(e, msg)}>
        {type === "image" && msg.media_data ? (
          <div style={{ ...s.bubble, background: isMe ? t.bubbleMe : t.bubbleThem, border: isMe ? "none" : `1px solid ${t.border}`, borderBottomRightRadius: isMe ? "4px" : "14px", borderBottomLeftRadius: isMe ? "14px" : "4px", padding: "6px" }}>
            <img
              src={getImageSrc(msg.media_data)}
              alt="shared"
              style={{ maxWidth: "240px", maxHeight: "240px", borderRadius: "8px", display: "block", cursor: "pointer" }}
              onClick={() => window.open(getImageSrc(msg.media_data), "_blank")}
              onError={(e) => { e.target.style.display = "none"; }}
            />
            <span style={{ ...s.bubbleTime, color: t.mutedText }}>{formatTime(msg.created_at)}{isMe && " ✓✓"}</span>
          </div>
        ) : type === "voice" && msg.media_data ? (
          <div style={{ ...s.voiceBubble, background: isMe ? t.bubbleMe : t.bubbleThem, border: isMe ? "none" : `1px solid ${t.border}`, flexDirection: "column", alignItems: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
              <audio
                controls
                src={msg.media_data?.startsWith("http") ? msg.media_data : getAudioSrc(msg.media_data)}
                style={{ height: "36px", outline: "none", maxWidth: "200px", borderRadius: "8px" }}
                onPlay={handleAudioPlay}
                onError={(e) => console.log("Audio error:", e.target.error)}
              />
              <button
                onClick={() => transcribeAudio(msg.id, msg.media_data?.startsWith("http") ? msg.media_data : getAudioSrc(msg.media_data))}
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
            <span style={{ ...s.bubbleTime, color: t.mutedText, whiteSpace: "nowrap" }}>{formatTime(msg.created_at)}{isMe && " ✓✓"}</span>
          </div>
        ) : (
          <div style={{ ...s.bubble, background: isMe ? t.bubbleMe : t.bubbleThem, border: isMe ? "none" : `1px solid ${t.border}`, borderBottomRightRadius: isMe ? "4px" : "14px", borderBottomLeftRadius: isMe ? "14px" : "4px" }}>
            <p style={{ ...s.bubbleText, color: isMe ? t.bubbleMeText : t.text }}>{msg.content}</p>
            <span style={{ ...s.bubbleTime, color: t.mutedText }}>{formatTime(msg.created_at)}{isMe && " ✓✓"}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ ...s.app, background: t.pageBg }}>
      <div style={{ ...s.sidebar, background: t.sidebarBg, borderRight: `1px solid ${t.border}` }}>
        <div style={{ ...s.profileRow, background: t.headerBg }}>
          <div style={{ ...s.avatar, background: getColor(user?.username) }}>{getInitials(user?.username)}</div>
          <div style={s.profileInfo}>
            <span style={{ ...s.profileName, color: t.headerText }}>{user?.username}</span>
            <span style={{ color: isOnline(user.id, onlineUsers) ? "#4ade80" : "#aaa", fontSize: "11px" }}>
              {isOnline(user.id, onlineUsers) ? "● Online" : "● Connecting..."}
            </span>
          </div>
          <div style={s.toggleRow}>
            <span style={{ fontSize: "13px" }}>☀</span>
            <div style={{ ...s.toggle, background: dark ? "#25D366" : "#e5e5e5" }} onClick={() => setDark(!dark)}>
              <div style={{ ...s.toggleThumb, transform: dark ? "translateX(16px)" : "translateX(0)" }} />
            </div>
            <span style={{ fontSize: "13px" }}>🌙</span>
          </div>
          <button style={{ ...s.iconBtn, color: t.mutedText }} onClick={logout}>⏻</button>
        </div>

        <div style={{ padding: "10px 16px", background: t.sidebarBg }}>
          <div style={{ ...s.searchBox, background: t.inputBg }}>
            <span style={{ fontSize: "13px" }}>🔍</span>
            <input style={{ ...s.searchInput, color: t.text, background: "transparent" }} placeholder="Search or start new chat" value={search} onChange={(e) => setSearch(e.target.value)} onFocus={() => setShowNewChat(true)} />
          </div>
        </div>

        {showNewChat && (
          <div style={{ ...s.newChat, background: t.inputBg, border: `1px solid ${t.border}`, margin: "0 16px 12px" }}>
            <input style={{ ...s.newChatInput, background: t.sidebarBg, border: `1px solid ${t.border}`, color: t.text }} placeholder="Enter email to start chat..." value={newEmail} onChange={(e) => setNewEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && startNewChat()} autoFocus />
            {error && <p style={s.newChatErr}>{error}</p>}
            <div style={s.newChatBtns}>
              <button style={{ ...s.cancelBtn, background: t.sidebarBg, border: `1px solid ${t.border}`, color: t.mutedText }} onClick={() => { setShowNewChat(false); setError(""); setSearch(""); }}>Cancel</button>
              <button style={s.startBtn} onClick={startNewChat}>Start Chat</button>
            </div>
          </div>
        )}

        <div style={s.convList}>
          {filtered.length === 0 && (
            <div style={s.empty}>
              <p style={{ fontSize: "32px", margin: "0 0 8px" }}>💬</p>
              <p style={{ color: t.text, fontWeight: "600", margin: "0 0 4px", fontSize: "14px" }}>No conversations yet</p>
              <p style={{ color: t.mutedText, fontSize: "12px", margin: 0 }}>Click search to start chatting</p>
            </div>
          )}
          {filtered.map((conv) => (
            <div key={conv.id} style={{ ...s.convItem, borderBottom: `1px solid ${t.border}`, background: selectedConv?.id === conv.id ? t.activeConv : "transparent" }} onClick={() => setSelectedConv(conv)}>
              <div style={{ ...s.avatar, background: getColor(conv.other_username) }}>{getInitials(conv.other_username)}</div>
              <div style={s.convMeta}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ ...s.convName, color: t.text }}>{conv.other_username}</span>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: isOnline(conv.other_user_id, onlineUsers) ? "#4ade80" : "#aaa", display: "inline-block" }} />
                </div>
                <span style={{ color: t.mutedText, fontSize: "12px" }}>{conv.other_email}</span>
              </div>
            </div>
          ))}
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
              <div style={{ ...s.avatar, background: getColor(selectedConv.other_username) }}>{getInitials(selectedConv.other_username)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ ...s.chatName, color: t.text }}>{selectedConv.other_username}</div>
                <div style={{ fontSize: "12px", color: isOnline(selectedConv.other_user_id, onlineUsers) ? "#4ade80" : "#aaa" }}>
                  {isOnline(selectedConv.other_user_id, onlineUsers) ? "● Online" : "● Offline"}
                </div>
              </div>
              <button
                style={{ background: "transparent", border: "none", fontSize: "20px", cursor: "pointer", padding: "4px", title: "Change wallpaper" }}
                onClick={() => setShowWallpaperPicker(!showWallpaperPicker)}
                title="Change wallpaper"
              ><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></button>
            </div>

            {showWallpaperPicker && (
              <div style={{ padding: "12px 20px", background: t.sidebarBg, borderBottom: `1px solid ${t.border}`, display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                <span style={{ color: t.mutedText, fontSize: "12px", width: "100%", marginBottom: "4px" }}>Choose wallpaper:</span>
                {WALLPAPERS.map((w) => (
                  <div
                    key={w.id}
                    onClick={() => saveWallpaper(w.id)}
                    style={{
                      width: "40px", height: "40px", borderRadius: "8px",
                      background: w.value,
                      ...(w.size && { backgroundSize: w.size }),
                      ...(w.color && { backgroundColor: w.color }),
                      cursor: "pointer",
                      border: wallpaper === w.id ? "3px solid #25D366" : `2px solid ${t.border}`,
                      flexShrink: 0,
                    }}
                    title={w.label}
                  />
                ))}
                <div
                  onClick={() => wallpaperInputRef.current.click()}
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
                {deleteMenu.msg.sender_id === user.id && (
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
              <button style={{ ...s.attachBtn, color: t.mutedText }} onClick={() => fileInputRef.current.click()} title="Send image">📎</button>
              <input style={{ ...s.msgInput, background: t.inputBg, color: t.text, border: `1px solid ${t.border}` }} placeholder="Type a message..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} />
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
                <span style={{ color: "#e53935", fontSize: "12px" }}>● Recording... release to send</span>
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

const s = {
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
