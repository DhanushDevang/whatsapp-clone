import { io } from "socket.io-client";

const SOCKET_URL = window.location.origin;

const socket = io(SOCKET_URL, {
  path: "/api/socket.io",
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  transports: ["websocket", "polling"],
});

export default socket;
