import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { pool } from "@workspace/db";
import { JWT_SECRET } from "../config";

export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    res.status(401).json({ message: "No token, authorization denied" });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; tokenVersion?: number };

    const result = await pool.query(
      "SELECT token_version FROM users WHERE id = $1",
      [decoded.id]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ message: "User no longer exists" });
      return;
    }

    const currentVersion = result.rows[0].token_version || 0;
    const tokenVersion = decoded.tokenVersion || 0;

    if (currentVersion !== tokenVersion) {
      res.status(401).json({ message: "Session expired, please log in again" });
      return;
    }

    // @ts-ignore
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Token is not valid" });
  }
};
