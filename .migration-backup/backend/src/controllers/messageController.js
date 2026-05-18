const pool = require("../config/db");
const logger = require("../config/logger");
const { messagesSentTotal, messageDeliveryLatency } = require("../config/metrics");

const sendMessage = async (req, res) => {
  try {
    const { conversationId, content, message_type = "text", media_data } = req.body;
    const senderId = req.user.id;
    const start = Date.now();

    const participant = await pool.query(
      "SELECT * FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, senderId]
    );

    if (participant.rows.length === 0) {
      return res.status(403).json({ message: "Not a participant of this conversation" });
    }

    const message = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, content, message_type, media_data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, conversation_id, sender_id, content, message_type, media_data, created_at`,
      [conversationId, senderId, content, message_type, media_data || null]
    );

    const duration = Date.now() - start;
    messagesSentTotal.inc({ type: message_type || "text" });
    messageDeliveryLatency.observe(duration);
    logger.info("Message sent", {
      messageId: message.rows[0].id,
      conversationId,
      senderId,
      type: message_type || "text",
      duration: `${duration}ms`,
    });
    res.status(201).json(message.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const participant = await pool.query(
      "SELECT * FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId]
    );

    if (participant.rows.length === 0) {
      return res.status(403).json({ message: "Not a participant of this conversation" });
    }

    const messages = await pool.query(
      `SELECT
        m.id,
        m.content,
        m.message_type,
        m.media_data,
        m.created_at,
        m.sender_id,
        u.username AS sender_username
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );

    res.json(messages.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteForAll = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const msg = await pool.query("SELECT * FROM messages WHERE id = $1", [id]);
    if (msg.rows.length === 0) return res.status(404).json({ message: "Message not found" });
    if (msg.rows[0].sender_id !== userId) return res.status(403).json({ message: "Not authorized" });
    await pool.query(
      "UPDATE messages SET deleted_for_all = TRUE, content = $1 WHERE id = $2",
      ["This message was deleted", id]
    );
    res.json({ success: true, messageId: id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteForMe = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    await pool.query(
      "UPDATE messages SET deleted_for = array_append(deleted_for, $1::text) WHERE id = $2",
      [String(userId), id]
    );
    res.json({ success: true, messageId: id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { sendMessage, getMessages, deleteForAll, deleteForMe };
