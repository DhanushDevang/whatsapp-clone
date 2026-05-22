import { io } from "socket.io-client";

const SOCKET_URL = window.location.origin;

const token = localStorage.getItem("token") ?? undefined;

const socket = io(SOCKET_URL, {
  path: "/api/socket.io",
  auth: { token },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  transports: ["websocket", "polling"],
});

export function reconnectWithToken(newToken: string) {
  socket.auth = { token: newToken };
  if (!socket.connected) {
    socket.connect();
  }
}

export default socket;
