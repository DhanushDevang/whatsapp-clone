const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();
require("./config/db");

const logger = require("./config/logger");
const { register, activeConnections } = require("./config/metrics");
const { morganMiddleware, metricsMiddleware } = require("./middleware/requestLogger");

const authRoutes = require("./routes/authRoutes");
const conversationRoutes = require("./routes/conversationRoutes");
const messageRoutes = require("./routes/messageRoutes");
const { errorHandler, notFound } = require("./middleware/errorMiddleware");
const { apiLimiter, authLimiter, messageLimiter } = require("./config/rateLimiter");
const { messageQueue, connection } = require("./config/queue");
const { createMessageWorker } = require("./workers/messageWorker");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(morganMiddleware);
app.use(metricsMiddleware);

// Rate limiters
app.use("/api/", apiLimiter);
app.use("/api/auth", authLimiter);
app.use("/api/messages", messageLimiter);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);

// Health check
app.get("/", (req, res) => {
  res.json({ message: "WhatsApp Clone API is running 🚀" });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
    version: process.version,
  });
});

// Prometheus metrics endpoint
app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

// Start message worker
const worker = createMessageWorker(io, connection);

const onlineUsers = new Map();

io.on("connection", (socket) => {
  activeConnections.inc();
  logger.info("User connected", { socketId: socket.id });

  socket.on("user_online", (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit("online_users", Array.from(onlineUsers.keys()));
    logger.info("User online", { userId });
  });

  socket.on("join_conversation", (conversationId) => {
    socket.join(`conversation_${conversationId}`);
    logger.info("User joined conversation", { socketId: socket.id, conversationId });
  });

  socket.on("send_message", (data) => {
    io.to(`conversation_${data.conversationId}`).emit("receive_message", data);
  });

  socket.on("delete_message_all", (data) => {
    io.to(`conversation_${data.conversationId}`).emit("message_deleted", data);
  });

  socket.on("disconnect", () => {
    activeConnections.dec();
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        logger.info("User offline", { userId });
        break;
      }
    }
    io.emit("online_users", Array.from(onlineUsers.keys()));
    logger.info("User disconnected", { socketId: socket.id });
  });
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  logger.info(`Server started`, { port: PORT, env: process.env.NODE_ENV });
});
