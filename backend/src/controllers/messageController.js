const pool = require("../config/db");

const sendMessage = async (req, res) => {
  try {
    const { conversationId, content, message_type = "text", media_data } = req.body;
    const senderId = req.user.id;

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

module.exports = { sendMessage, getMessages };
