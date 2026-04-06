const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { sendMessage, getMessages, deleteForAll, deleteForMe } = require("../controllers/messageController");
const { validate, sendMessageSchema } = require("../validators/messageValidator");

router.post("/", protect, validate(sendMessageSchema), sendMessage);
router.get("/:conversationId", protect, getMessages);
router.delete("/:id/all", protect, deleteForAll);
router.patch("/:id/me", protect, deleteForMe);

module.exports = router;

// Queue-based message sending (async processing)
const { messageQueue } = require("../config/queue");
const { retryWithBackoff } = require("../utils/retry");

router.post("/queue", protect, validate(sendMessageSchema), async (req, res) => {
  try {
    const { conversationId, content, message_type, media_data } = req.body;
    const senderId = req.user.id;

    // Add to queue with retry logic
    const job = await retryWithBackoff(async () => {
      return await messageQueue.add(
        "send-message",
        { conversationId, senderId, content, message_type, media_data },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        }
      );
    });

    res.status(202).json({
      message: "Message queued for processing",
      jobId: job.id,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
