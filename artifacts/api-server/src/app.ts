import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import router from "./routes";
import { logger } from "./lib/logger";
import { JWT_SECRET } from "./config";
import { pool } from "@workspace/db";

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

io.use((socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    (socket.handshake.headers?.authorization as string | undefined)?.split(" ")[1];

  if (!token) {
    next(new Error("Authentication required"));
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
    socket.data.userId = decoded.id;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
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

const onlineUsers = new Map<string, string>();

io.on("connection", (socket) => {
  logger.info({ socketId: socket.id, userId: socket.data.userId }, "User connected");

  socket.on("user_online", (userId: string) => {
    onlineUsers.set(String(userId), socket.id);
    io.emit("online_users", Array.from(onlineUsers.keys()));
  });

  socket.on("join_conversation", async (conversationId: string) => {
    try {
      const userId = socket.data.userId;
      const result = await pool.query(
        "SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2",
        [conversationId, userId]
      );
      if (result.rows.length === 0) {
        logger.warn({ userId, conversationId }, "Unauthorized join_conversation attempt");
        return;
      }
      socket.join(`conversation_${conversationId}`);
    } catch (err) {
      logger.error({ err }, "join_conversation error");
    }
  });

  socket.on("send_message", (data: { conversation_id: string; conversationId: string; message_type: string }) => {
    const convId = data.conversation_id || data.conversationId;
    socket.to(`conversation_${convId}`).emit("receive_message", data);
  });

  socket.on("delete_message_all", (data: { messageId: string; conversationId: string }) => {
    socket.to(`conversation_${data.conversationId}`).emit("delete_message_all", data);
  });

  socket.on("initiate_call", (data: { from: string; to: string; callType: string; conversationId: string }) => {
    io.to(`conversation_${data.conversationId}`).emit("incoming_call", data);
  });

  socket.on("accept_call", (data: { from: string; to: string; callType: string }) => {
    io.emit("call_accepted", data);
  });

  socket.on("decline_call", (data: { from: string; to: string }) => {
    io.emit("call_declined", data);
  });

  socket.on("end_call", (data: { conversationId: string }) => {
    io.to(`conversation_${data.conversationId}`).emit("call_ended", data);
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
