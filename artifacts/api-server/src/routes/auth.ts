import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs"import jwt from "jsonwebtoken";
import { pool } from "@workspace/db";
import { protect } from "../middleware/auth";
import { JWT_SECRET } from "../config";

const router = Router();

router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      res.status(400).json({ message: "All fields are required" });
      return;
    }
    const existing = await pool.query("SELECT id FROM users WHERE LOWER(email) = LOWER($1)", [email]);
    if (existing.rows.length > 0) {
      res.status(400).json({ message: "User already exists" });
      return;
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = await pool.query(
      "INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email",
      [username, email, hashedPassword]
    );
    const token = jwt.sign(
    { id: newUser.rows[0].id, tokenVersion: 0 },
    JWT_SECRET,
    { expiresIn: "7d" }
    );
    res.status(201).json({ user: newUser.rows[0], token });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ message: "Email and password required" });
      return;
    }
    const result = await pool.query("SELECT * FROM users WHERE LOWER(email) = LOWER($1)", [email]);
    if (result.rows.length === 0) {
  await pool.query(
    "INSERT INTO login_logs (email, ip_address, status) VALUES ($1, $2, 'failed')",
    [email, req.ip]
  );
  res.status(400).json({ message: "Invalid credentials" });
  return;
}
    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
  await pool.query(
    "INSERT INTO login_logs (user_id, email, ip_address, status) VALUES ($1, $2, $3, 'failed')",
    [user.id, email, req.ip]
  );
  res.status(400).json({ message: "Invalid credentials" });
  return;
}
await pool.query(
  "INSERT INTO login_logs (user_id, email, ip_address, status) VALUES ($1, $2, $3, 'success')",
  [user.id, email, req.ip]
);
const token = jwt.sign(
  { id: newUser.rows[0].id, tokenVersion: 0 },
  JWT_SECRET,
  { expiresIn: "7d" }
);
res.json({ user: { id: user.id, username: user.username, email: user.email }, token });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/find", protect, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.query as { email: string };
    if (!email) {
      res.status(400).json({ message: "Email is required" });
      return;
    }
    const result = await pool.query(
      "SELECT id, username, email FROM users WHERE email = $1",
      [email]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/logout-all", protect, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    await pool.query(
      "UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = $1",
      [userId]
    );
    res.json({ message: "Logged out from all devices" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
