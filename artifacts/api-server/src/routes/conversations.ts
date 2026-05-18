import { Router, Request, Response } from "express";
import { pool } from "@workspace/db";
import { protect } from "../middleware/auth";

const router = Router();

router.post("/", protect, async (req: Request, res: Response): Promise<void> => {
  try {
    const { recipientId } = req.body;
    // @ts-ignore
    const senderId = req.user.id;

    if (senderId === parseInt(recipientId)) {
      res.status(400).json({ message: "Cannot create conversation with yourself" });
      return;
    }

    const existing = await pool.query(
      `SELECT c.id FROM conversations c
       JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
       JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2`,
      [senderId, recipientId]
    );

    if (existing.rows.length > 0) {
      res.json({ conversationId: existing.rows[0].id, existing: true });
      return;
    }

    const conversation = await pool.query(
      "INSERT INTO conversations DEFAULT VALUES RETURNING id"
    );
    const conversationId = conversation.rows[0].id;

    await pool.query(
      "INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)",
      [conversationId, senderId, recipientId]
    );

    res.status(201).json({ conversationId, existing: false });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/", protect, async (req: Request, res: Response): Promise<void> => {
  try {
    // @ts-ignore
    const userId = req.user.id;

    const conversations = await pool.query(
      `SELECT 
        c.id,
        c.created_at,
        u.id AS other_user_id,
        u.username AS other_username,
        u.email AS other_email
       FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id != $1
       JOIN users u ON u.id = cp.user_id
       WHERE c.id IN (
         SELECT conversation_id FROM conversation_participants WHERE user_id = $1
       )
       ORDER BY c.created_at DESC`,
      [userId]
    );

    res.json(conversations.rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
