const request = require("supertest");
const express = require("express");
const cors = require("cors");

require("dotenv").config();

const authRoutes = require("../routes/authRoutes");
const { notFound, errorHandler } = require("../middleware/errorMiddleware");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use("/api/auth", authRoutes);
app.use(notFound);
app.use(errorHandler);

const testEmail = `test_${Date.now()}@jest.com`;
const testPassword = "testpass123";
let authToken = "";

describe("Auth Integration Tests", () => {

  describe("POST /api/auth/register", () => {
    test("should register a new user successfully", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ username: "jestuser", email: testEmail, password: testPassword });
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty("token");
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.user).not.toHaveProperty("password");
    });

    test("should reject duplicate email", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ username: "jestuser2", email: testEmail, password: testPassword });
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("User already exists");
    });

    test("should reject missing username", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "new@test.com", password: "pass123" });
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("errors");
    });

    test("should reject invalid email format", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ username: "test", email: "not-an-email", password: "pass123" });
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("errors");
    });

    test("should reject short password", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ username: "test", email: "new2@test.com", password: "abc" });
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("errors");
    });
  });

  describe("POST /api/auth/login", () => {
    test("should login successfully with correct credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testEmail, password: testPassword });
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty("token");
      authToken = res.body.token;
    });

    test("should reject wrong password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testEmail, password: "wrongpassword" });
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Invalid credentials");
    });

    test("should reject non-existent email", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "nobody@test.com", password: "pass123" });
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Invalid credentials");
    });

    test("should reject missing password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testEmail });
      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty("errors");
    });
  });

  describe("GET /api/auth/find", () => {
    test("should find user by email with valid token", async () => {
      const res = await request(app)
        .get(`/api/auth/find?email=${testEmail}`)
        .set("Authorization", `Bearer ${authToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.email).toBe(testEmail);
      expect(res.body).not.toHaveProperty("password");
    });

    test("should return 404 for non-existent user", async () => {
      const res = await request(app)
        .get("/api/auth/find?email=nobody@nowhere.com")
        .set("Authorization", `Bearer ${authToken}`);
      expect(res.statusCode).toBe(404);
    });

    test("should reject request without token", async () => {
      const res = await request(app)
        .get(`/api/auth/find?email=${testEmail}`);
      expect(res.statusCode).toBe(401);
    });
  });

});
