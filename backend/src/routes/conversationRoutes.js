const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { createConversation, getConversations } = require("../controllers/conversationController");
const { validate, conversationSchema } = require("../validators/messageValidator");

router.post("/", protect, validate(conversationSchema), createConversation);
router.get("/", protect, getConversations);

module.exports = router;
