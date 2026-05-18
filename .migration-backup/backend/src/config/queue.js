const { Queue, Worker, QueueEvents } = require("bullmq");
const IORedis = require("ioredis");

const connection = process.env.REDIS_URL
  ? new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      tls: { rejectUnauthorized: false },
    })
  : new IORedis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: process.env.REDIS_PORT || 6379,
      maxRetriesPerRequest: null,
    });

connection.on("connect", () => console.log("✅ Redis connected"));
connection.on("error", (err) => console.error("❌ Redis error:", err.message));

const messageQueue = new Queue("messages", { connection });

module.exports = { messageQueue, connection };
