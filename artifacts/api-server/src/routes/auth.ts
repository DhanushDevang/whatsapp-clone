import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "@workspace/db";
import { protect } from "../middleware/auth";
import { JWT_SECRET, RECAPTCHA_SECRET_KEY } from "../config";

const router = Router();

async function verifyRecaptcha(token: string): Promise<boolean> {
  if (!RECAPTCHA_SECRET_KEY || !token) return false;
  const params = new URLSearchParams();
  params.append("secret", RECAPTCHA_SECRET_KEY);
  params.append("response", token);
  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    body: params,
  });
  const data = await res.json();
  return data.success === true;
}

router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password, recaptchaToken } = req.body;
    if (!username || !email || !password) {
      res.status(400).json({ message: "All fields are required" });
      return;
    }
    if (RECAPTCHA_SECRET_KEY) {
      const valid = await verifyRecaptcha(recaptchaToken);
      if (!valid) {
        res.status(400).json({ message: "reCAPTCHA verification failed" });
        return;
      }
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
    const token = jwt.sign({ id: newUser.rows[0].id }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ user: newUser.rows[0], token });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, recaptchaToken } = req.body;
    if (!email || !password) {
      res.status(400).json({ message: "Email and password required" });
      return;
    }
    if (RECAPTCHA_SECRET_KEY) {
      const valid = await verifyRecaptcha(recaptchaToken);
      if (!valid) {
        res.status(400).json({ message: "reCAPTCHA verification failed" });
        return;
      }
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

    // 1) Check account lock
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      await pool.query(
        "INSERT INTO login_logs (user_id, email, ip_address, status) VALUES ($1, $2, $3, 'locked')",
        [user.id, email, req.ip]
      );
      res.status(423).json({ message: "Account locked. Too many failed attempts. Try again in 15 minutes." });
      return;
    }

    // 2) Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // 3) Wrong password: increment failed_attempts
      const failed = (user.failed_attempts || 0) + 1;
      if (failed >= 5) {
        const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        await pool.query("UPDATE users SET failed_attempts = $1, locked_until = $2 WHERE id = $3", [failed, lockedUntil, user.id]);
        await pool.query(
          "INSERT INTO login_logs (user_id, email, ip_address, status) VALUES ($1, $2, $3, 'locked')",
          [user.id, email, req.ip]
        );
        res.status(423).json({ message: "Account locked. Too many failed attempts. Try again in 15 minutes." });
        return;
      }
      await pool.query("UPDATE users SET failed_attempts = $1 WHERE id = $2", [failed, user.id]);
      await pool.query(
        "INSERT INTO login_logs (user_id, email, ip_address, status) VALUES ($1, $2, $3, 'failed')",
        [user.id, email, req.ip]
      );
      res.status(400).json({ message: "Invalid credentials" });
      return;
    }

    // 4) Correct password: reset failed_attempts
    if (user.failed_attempts > 0 || user.locked_until) {
      await pool.query("UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1", [user.id]);
    }

    await pool.query(
      "INSERT INTO login_logs (user_id, email, ip_address, status) VALUES ($1, $2, $3, 'success')",
      [user.id, email, req.ip]
    );

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
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
      "SELECT id, username, email FROM users WHERE LOWER(email) = LOWER($1)",
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

export default router;
