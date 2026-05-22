import { Router, Request, Response } from "express";
import { pool } from "@workspace/db";
import { protect } from "../middleware/auth";

const router = Router();

const convWithParticipants = async (conversationId: number, excludeUserId: number) => {
  const result = await pool.query(
    `SELECT c.id, c.created_at,
      json_agg(json_build_object('id', u.id, 'username', u.username, 'email', u.email))
        FILTER (WHERE u.id != $2) AS participants
     FROM conversations c
     JOIN conversation_participants cp ON cp.conversation_id = c.id
     JOIN users u ON u.id = cp.user_id
     WHERE c.id = $1
     GROUP BY c.id`,
    [conversationId, excludeUserId]
  );
  return result.rows[0] || null;
};

router.post("/", protect, async (req: Request, res: Response): Promise<void> => {
  try {
    const { participantEmail, recipientId } = req.body;
    // @ts-ignore
    const senderId = req.user.id;

    let targetId: number;

    if (participantEmail) {
      const userRes = await pool.query(
        "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
        [participantEmail]
      );
      if (userRes.rows.length === 0) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      targetId = userRes.rows[0].id;
    } else if (recipientId) {
      targetId = parseInt(recipientId);
    } else {
      res.status(400).json({ message: "participantEmail or recipientId required" });
      return;
    }

    if (senderId === targetId) {
      res.status(400).json({ message: "Cannot create conversation with yourself" });
      return;
    }

    const existing = await pool.query(
      `SELECT c.id FROM conversations c
       JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
       JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2`,
      [senderId, targetId]
    );

    if (existing.rows.length > 0) {
      const conv = await convWithParticipants(existing.rows[0].id, senderId);
      res.json(conv);
      return;
    }

    const conversation = await pool.query(
      "INSERT INTO conversations DEFAULT VALUES RETURNING id"
    );
    const conversationId = conversation.rows[0].id;

    await pool.query(
      "INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)",
      [conversationId, senderId, targetId]
    );

    const conv = await convWithParticipants(conversationId, senderId);
    res.status(201).json(conv);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/", protect, async (req: Request, res: Response): Promise<void> => {
  try {
    // @ts-ignore
    const userId = req.user.id;

    const conversations = await pool.query(
      `SELECT c.id, c.created_at,
        json_agg(json_build_object('id', u.id, 'username', u.username, 'email', u.email))
          FILTER (WHERE u.id != $1) AS participants
       FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id
       JOIN users u ON u.id = cp.user_id
       WHERE c.id IN (
         SELECT conversation_id FROM conversation_participants WHERE user_id = $1
       )
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [userId]
    );

    res.json(conversations.rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
