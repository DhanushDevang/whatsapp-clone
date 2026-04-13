import { io } from "socket.io-client";

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "https://whatsapp-clone-production-0db0.up.railway.app";

const socket = io(SOCKET_URL);

export default socket;
