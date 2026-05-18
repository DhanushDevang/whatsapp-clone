import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { createServer } from "http";
import { Server } from "socket.io";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  path: "/api/socket.io",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
  pingInterval: 10000,
  pingTimeout: 60000,
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use("/api", router);

// Socket.io online users
const onlineUsers = new Map<string, string>();

io.on("connection", (socket) => {
  logger.info({ socketId: socket.id }, "User connected");

  socket.on("user_online", (userId: string) => {
    onlineUsers.set(String(userId), socket.id);
    io.emit("online_users", Array.from(onlineUsers.keys()));
  });

  socket.on("join_conversation", (conversationId: string) => {
    socket.join(`conversation_${conversationId}`);
  });

  socket.on("send_message", (data: { conversation_id: string; conversationId: string; message_type: string }) => {
    const convId = data.conversation_id || data.conversationId;
    socket.to(`conversation_${convId}`).emit("receive_message", data);
  });

  socket.on("delete_message_all", (data: { messageId: string; conversationId: string }) => {
    socket.to(`conversation_${data.conversationId}`).emit("delete_message_all", data);
  });

  socket.on("disconnect", () => {
    for (const [userId, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }
    io.emit("online_users", Array.from(onlineUsers.keys()));
    logger.info({ socketId: socket.id }, "User disconnected");
  });
});

export default httpServer;
