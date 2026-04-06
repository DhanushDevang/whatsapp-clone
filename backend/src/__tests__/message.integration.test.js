const request = require("supertest");
const express = require("express");
const cors = require("cors");

require("dotenv").config();

const authRoutes = require("../routes/authRoutes");
const conversationRoutes = require("../routes/conversationRoutes");
const messageRoutes = require("../routes/messageRoutes");
const { notFound, errorHandler } = require("../middleware/errorMiddleware");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use("/api/auth", authRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use(notFound);
app.use(errorHandler);

const ts = Date.now();
let token1 = "", token2 = "", convId = 0, msgId = 0;

describe("Message & Conversation Integration Tests", () => {

  beforeAll(async () => {
    const r1 = await request(app).post("/api/auth/register")
      .send({ username: "msguser1", email: `msg1_${ts}@jest.com`, password: "pass123" });
    token1 = r1.body.token || (await request(app).post("/api/auth/login")
      .send({ email: `msg1_${ts}@jest.com`, password: "pass123" })).body.token;

    const r2 = await request(app).post("/api/auth/register")
      .send({ username: "msguser2", email: `msg2_${ts}@jest.com`, password: "pass123" });
    token2 = r2.body.token || (await request(app).post("/api/auth/login")
      .send({ email: `msg2_${ts}@jest.com`, password: "pass123" })).body.token;

    const findUser2 = await request(app)
      .get(`/api/auth/find?email=msg2_${ts}@jest.com`)
      .set("Authorization", `Bearer ${token1}`);
    const user2Id = findUser2.body.id;

    const conv = await request(app).post("/api/conversations")
      .set("Authorization", `Bearer ${token1}`)
      .send({ recipientId: user2Id });
    convId = conv.body.conversationId;
  });

  describe("Conversation Tests", () => {
    test("should get conversations list", async () => {
      const res = await request(app)
        .get("/api/conversations")
        .set("Authorization", `Bearer ${token1}`);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test("should prevent duplicate conversations", async () => {
      const findUser2 = await request(app)
        .get(`/api/auth/find?email=msg2_${ts}@jest.com`)
        .set("Authorization", `Bearer ${token1}`);
      const res = await request(app).post("/api/conversations")
        .set("Authorization", `Bearer ${token1}`)
        .send({ recipientId: findUser2.body.id });
      expect(res.body.existing).toBe(true);
      expect(res.body.conversationId).toBe(convId);
    });

    test("should reject self-conversation", async () => {
      const me = await request(app)
        .get(`/api/auth/find?email=msg1_${ts}@jest.com`)
        .set("Authorization", `Bearer ${token1}`);
      const res = await request(app).post("/api/conversations")
        .set("Authorization", `Bearer ${token1}`)
        .send({ recipientId: me.body.id });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("Message Tests", () => {
    test("should send a text message", async () => {
      const res = await request(app).post("/api/messages")
        .set("Authorization", `Bearer ${token1}`)
        .send({ conversationId: convId, content: "Hello from Jest!" });
      expect(res.statusCode).toBe(201);
      expect(res.body.content).toBe("Hello from Jest!");
      msgId = res.body.id;
    });

    test("should fetch messages for a conversation", async () => {
      const res = await request(app)
        .get(`/api/messages/${convId}`)
        .set("Authorization", `Bearer ${token1}`);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty("sender_username");
    });

    test("should reject empty message content", async () => {
      const res = await request(app).post("/api/messages")
        .set("Authorization", `Bearer ${token1}`)
        .send({ conversationId: convId, content: "" });
      expect(res.statusCode).toBe(400);
    });

    test("should block unauthorized message access", async () => {
      const res = await request(app)
        .get(`/api/messages/${convId}`)
        .set("Authorization", `Bearer `);
      expect(res.statusCode).toBe(401);
    });

    test("should delete message for me", async () => {
      const res = await request(app)
        .patch(`/api/messages/${msgId}/me`)
        .set("Authorization", `Bearer ${token1}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("should delete message for all (sender only)", async () => {
      const msg = await request(app).post("/api/messages")
        .set("Authorization", `Bearer ${token1}`)
        .send({ conversationId: convId, content: "Delete me!" });
      const res = await request(app)
        .delete(`/api/messages/${msg.body.id}/all`)
        .set("Authorization", `Bearer ${token1}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("should block non-sender from deleting for all", async () => {
      const msg = await request(app).post("/api/messages")
        .set("Authorization", `Bearer ${token1}`)
        .send({ conversationId: convId, content: "Only I can delete this!" });
      const res = await request(app)
        .delete(`/api/messages/${msg.body.id}/all`)
        .set("Authorization", `Bearer ${token2}`);
      expect(res.statusCode).toBe(403);
    });
  });

});
