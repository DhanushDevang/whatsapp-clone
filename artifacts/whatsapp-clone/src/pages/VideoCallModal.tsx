import { useState, useEffect } from "react";

interface Props {
  callType: "audio" | "video";
  receiverName: string;
  onEndCall: () => void;
  darkMode: boolean;
  conversationId?: number;
  userId?: number;
  userName?: string;
}

export default function VideoCallModal({ callType, receiverName, onEndCall, darkMode }: Props) {
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(callType === "video");

  useEffect(() => {
    const timer = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const bgColor = darkMode ? "#0a0e27" : "#ffffff";
  const textColor = darkMode ? "#ffffff" : "#000000";

  return (
    <div style={{ display: "flex", height: "100vh", background: bgColor, alignItems: "center", justifyContent: "center", fontFamily: "system-ui", flexDirection: "column", padding: "20px" }}>
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <h1 style={{ color: textColor, fontSize: "28px", margin: "0 0 12px 0" }}>
          {callType === "video" ? "📹" : "☎️"} {receiverName}
        </h1>
        <p style={{ color: "#999", fontSize: "16px", margin: 0 }}>{formatDuration(callDuration)}</p>
      </div>

      {callType === "video" && (
        <div style={{ width: "100%", maxWidth: "600px", aspectRatio: "16/9", background: "#000", borderRadius: "12px", marginBottom: "40px", display: "flex", alignItems: "center", justifyContent: "center", color: "#999", fontSize: "18px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "20px", right: "20px", width: "120px", height: "120px", background: "#1a1a1a", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "#666", fontSize: "14px" }}>Your Video</div>
          {receiverName} is calling...
        </div>
      )}

      {callType === "audio" && (
        <div style={{ width: "120px", height: "120px", borderRadius: "50%", background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "48px", marginBottom: "40px", animation: "pulse 1.5s infinite" }}>
          🎵
        </div>
      )}

      <div style={{ display: "flex", gap: "16px", justifyContent: "center", alignItems: "center" }}>
        <button onClick={() => setIsMuted(!isMuted)} style={{ width: "60px", height: "60px", borderRadius: "50%", background: isMuted ? "#ff9800" : "#333", color: "#fff", border: "none", fontSize: "24px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title={isMuted ? "Unmute" : "Mute"}>
          {isMuted ? "🔇" : "🔊"}
        </button>

        {callType === "video" && (
          <button onClick={() => setIsVideoOn(!isVideoOn)} style={{ width: "60px", height: "60px", borderRadius: "50%", background: isVideoOn ? "#333" : "#ff9800", color: "#fff", border: "none", fontSize: "24px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title={isVideoOn ? "Turn off camera" : "Turn on camera"}>
            {isVideoOn ? "📹" : "🚫"}
          </button>
        )}

        <button onClick={onEndCall} style={{ width: "70px", height: "70px", borderRadius: "50%", background: "#e53935", color: "#fff", border: "none", fontSize: "32px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(229,57,53,0.3)" }} title="End call">
          ☎️
        </button>
      </div>

      <p style={{ color: "#999", fontSize: "12px", marginTop: "40px", textAlign: "center" }}>
        {callType === "video" ? "📹 Video Call" : "☎️ Voice Call"}
      </p>

      <style>{`@keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.8; } }`}</style>
    </div>
  );
}
