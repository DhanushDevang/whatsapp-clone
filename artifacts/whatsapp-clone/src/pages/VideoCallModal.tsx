import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || "wss://whatsapp-clone-qf1ee8df.livekit.cloud";

interface Props {
  callType: "audio" | "video";
  receiverName: string;
  onEndCall: () => void;
  livekitToken: string | null;
}

export default function VideoCallModal({ callType, receiverName, onEndCall, livekitToken }: Props) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(callType === "video");
  const [callDuration, setCallDuration] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [room] = useState(() => new Room({ adaptiveStream: true, dynacast: true }));
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!livekitToken) return;

    const connect = async () => {
      room.on(RoomEvent.Connected, () => {
        setIsConnected(true);
        timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
      });

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
          track.attach(remoteVideoRef.current);
        }
        if (track.kind === Track.Kind.Audio) {
          const audioEl = document.createElement("audio");
          audioEl.autoplay = true;
          audioEl.playsInline = true;
          document.body.appendChild(audioEl);
          track.attach(audioEl);
        }
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => track.detach());

      await room.connect(LIVEKIT_URL, livekitToken);
      await room.localParticipant.setMicrophoneEnabled(true);

      if (callType === "video") {
        await room.localParticipant.setCameraEnabled(true);
        const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        if (pub?.track && localVideoRef.current) {
          pub.track.attach(localVideoRef.current);
        }
      }
    };

    connect().catch(console.error);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      room.disconnect();
    };
  }, [livekitToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMute = async () => {
    await room.localParticipant.setMicrophoneEnabled(isMuted);
    setIsMuted(!isMuted);
  };

  const toggleVideo = async () => {
    await room.localParticipant.setCameraEnabled(!isVideoOn);
    setIsVideoOn(!isVideoOn);
  };

  const handleEndCall = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    room.disconnect();
    onEndCall();
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", zIndex: 9999, color: "#fff", fontFamily: "system-ui",
    }}>
      <h2 style={{ margin: "0 0 4px", fontSize: "22px" }}>{receiverName}</h2>
      <p style={{ margin: "0 0 24px", color: isConnected ? "#25D366" : "#aaa", fontSize: "14px" }}>
        {isConnected ? fmt(callDuration) : "Connecting..."}
      </p>

      {callType === "video" ? (
        <div style={{
          position: "relative", width: "640px", maxWidth: "90vw", height: "360px",
          background: "#111", borderRadius: "16px", overflow: "hidden", marginBottom: "32px",
        }}>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{
            position: "absolute", bottom: "12px", right: "12px", width: "120px", height: "90px",
            background: "#222", borderRadius: "8px", overflow: "hidden",
          }}>
            <video ref={localVideoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          {!isConnected && (
            <div style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center",
              justifyContent: "center", background: "rgba(0,0,0,0.6)", fontSize: "16px",
            }}>
              Waiting for {receiverName}...
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: "40px", textAlign: "center" }}>
          <div style={{
            width: "120px", height: "120px", borderRadius: "50%", background: "#25D366",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: "52px",
            margin: "0 auto 16px",
            animation: isConnected ? "pulse 2s infinite" : "none",
          }}>
            {receiverName?.charAt(0).toUpperCase()}
          </div>
          <audio ref={remoteAudioRef} autoPlay />
        </div>
      )}

      <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
        <button onClick={toggleMute} style={{
          width: "60px", height: "60px", borderRadius: "50%",
          background: isMuted ? "#e53935" : "#333", color: "#fff",
          border: "none", fontSize: "22px", cursor: "pointer",
        }}>
          {isMuted ? "🔇" : "🎙️"}
        </button>

        {callType === "video" && (
          <button onClick={toggleVideo} style={{
            width: "60px", height: "60px", borderRadius: "50%",
            background: isVideoOn ? "#333" : "#e53935", color: "#fff",
            border: "none", fontSize: "22px", cursor: "pointer",
          }}>
            {isVideoOn ? "📹" : "🚫"}
          </button>
        )}

        <button onClick={handleEndCall} style={{
          width: "70px", height: "70px", borderRadius: "50%", background: "#e53935",
          color: "#fff", border: "none", fontSize: "28px", cursor: "pointer",
          boxShadow: "0 4px 20px rgba(229,57,53,0.5)",
        }}>
          📵
        </button>
      </div>

      <p style={{ color: "#555", fontSize: "11px", marginTop: "24px" }}>
        Powered by LiveKit • End-to-end encrypted
      </p>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(37,211,102,0.4); }
          50% { transform: scale(1.05); box-shadow: 0 0 0 20px rgba(37,211,102,0); }
        }
      `}</style>
    </div>
  );
}
