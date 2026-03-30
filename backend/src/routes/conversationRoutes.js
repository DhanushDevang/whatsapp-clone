const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const {
  createConversation,
  getConversations,
} = require("../controllers/conversationController");

router.post("/", protect, createConversation);
router.get("/", protect, getConversations);

module.exports = router;
