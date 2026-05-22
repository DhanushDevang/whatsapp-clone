import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config";

export const protect = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    res.status(401).json({ message: "No token, authorization denied" });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // @ts-ignore
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Token is not valid" });
  }
};
