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
