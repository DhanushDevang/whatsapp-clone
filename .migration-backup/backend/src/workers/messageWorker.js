const { Worker } = require("bullmq");
const pool = require("../config/db");

const createMessageWorker = (io, connection) => {
  const worker = new Worker(
    "messages",
    async (job) => {
      const { conversationId, senderId, content, message_type, media_data } = job.data;

      console.log(`📨 Processing message job ${job.id} for conversation ${conversationId}`);

      const result = await pool.query(
        `INSERT INTO messages (conversation_id, sender_id, content, message_type, media_data)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, conversation_id, sender_id, content, message_type, created_at`,
        [conversationId, senderId, content, message_type || "text", media_data || null]
      );

      const message = result.rows[0];

      io.to(`conversation_${conversationId}`).emit("receive_message", {
        ...message,
        conversation_id: conversationId,
        conversationId,
      });

      console.log(`✅ Message job ${job.id} completed`);
      return message;
    },
    {
      connection,
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    }
  );

  worker.on("completed", (job) => console.log(`✅ Job ${job.id} completed`));
  worker.on("failed", (job, err) => console.error(`❌ Job ${job.id} failed: ${err.message}`));
  worker.on("error", (err) => console.error("Worker error:", err.message));

  return worker;
};

module.exports = { createMessageWorker };
