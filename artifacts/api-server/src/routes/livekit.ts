import { Router } from "express";
import { AccessToken } from "livekit-server-sdk";
import { protect } from "../middleware/auth";

const router = Router();

router.post("/token", protect, async (req, res) => {
  try {
    const { roomName, participantName } = req.body as { roomName?: string; participantName?: string };
    if (!roomName || !participantName) {
      res.status(400).json({ message: "roomName and participantName are required" });
      return;
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!apiKey || !apiSecret) {
      res.status(500).json({ message: "LiveKit credentials not configured" });
      return;
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      ttl: "1h",
    });
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
    const token = await at.toJwt();
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: "Failed to generate token" });
  }
});

export default router;
