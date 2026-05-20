import { Router, Request, Response } from "express";
import { pool } from "@workspace/db";
import { protect } from "../middleware/auth";
import { io } from "../app";

const router = Router();

router.post("/", protect, async (req: Request, res: Response): Promise<void> => {
  try {
    const { conversationId, content, message_type = "text", media_data } = req.body;
    // @ts-ignore
    const senderId = req.user.id;

    const participant = await pool.query(
      "SELECT * FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, senderId]
    );

    if (participant.rows.length === 0) {
      res.status(403).json({ message: "Not a participant of this conversation" });
      return;
    }

    const message = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, content, message_type, media_data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, conversation_id, sender_id, content, message_type, media_data, created_at`,
      [conversationId, senderId, content, message_type, media_data || null]
    );

    io.to(`conversation_${conversationId}`).emit("receive_message", {
      ...message.rows[0],
      conversationId,
    });

    res.status(201).json(message.rows[0]);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/list", protect, async (req: Request, res: Response): Promise<void> => {
  try {
    const conversationId = req.query.conversationId;
    // @ts-ignore
    const userId = req.user.id;

    const participant = await pool.query(
      "SELECT * FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId]
    );

    if (participant.rows.length === 0) {
      res.status(403).json({ message: "Not a participant of this conversation" });
      return;
    }

    const messages = await pool.query(
      `SELECT
        m.id,
        m.content,
        m.message_type,
        m.media_data,
        m.created_at,
        m.sender_id,
        m.deleted_for_all,
        m.deleted_for,
        u.username AS sender_username
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC
       LIMIT 100`,
      [conversationId]
    );

    res.json(messages.rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/delete-all", protect, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.body;
    // @ts-ignore
    const userId = req.user.id;
    const msg = await pool.query("SELECT * FROM messages WHERE id = $1", [id]);
    if (msg.rows.length === 0) {
      res.status(404).json({ message: "Message not found" });
      return;
    }
    if (msg.rows[0].sender_id !== userId) {
      res.status(403).json({ message: "Not authorized" });
      return;
    }
    await pool.query(
      "UPDATE messages SET deleted_for_all = TRUE, content = $1 WHERE id = $2",
      ["This message was deleted", id]
    );
    res.json({ success: true, messageId: id });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/:conversationId", protect, async (req: Request, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    // @ts-ignore
    const userId = req.user.id;

    const participant = await pool.query(
      "SELECT * FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId]
    );

    if (participant.rows.length === 0) {
      res.status(403).json({ message: "Not a participant of this conversation" });
      return;
    }

    const messages = await pool.query(
      `SELECT m.*, u.username AS sender_username
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC
       LIMIT 100`,
      [conversationId]
    );

    res.json(messages.rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:messageId/delete", protect, async (req: Request, res: Response): Promise<void> => {
  try {
    const { messageId } = req.params;
    const { deleteForAll } = req.body;
    // @ts-ignore
    const userId = req.user.id;

    if (deleteForAll) {
      const msg = await pool.query("SELECT * FROM messages WHERE id = $1", [messageId]);
      if (msg.rows.length === 0) { res.status(404).json({ message: "Message not found" }); return; }
      if (msg.rows[0].sender_id !== userId) { res.status(403).json({ message: "Not authorized" }); return; }
      await pool.query("DELETE FROM messages WHERE id = $1 AND sender_id = $2", [messageId, userId]);
    } else {
      await pool.query(
        "UPDATE messages SET deleted_for = array_append(COALESCE(deleted_for, ARRAY[]::text[]), $1::text) WHERE id = $2",
        [String(userId), messageId]
      );
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/delete-me", protect, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.body;
    // @ts-ignore
    const userId = req.user.id;
    await pool.query(
      "UPDATE messages SET deleted_for = array_append(COALESCE(deleted_for, ARRAY[]::text[]), $1::text) WHERE id = $2",
      [String(userId), id]
    );
    res.json({ success: true, messageId: id });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
