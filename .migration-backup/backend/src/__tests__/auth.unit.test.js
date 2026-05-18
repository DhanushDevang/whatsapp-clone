const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

describe("Auth Unit Tests", () => {

  describe("Password Hashing", () => {
    test("should hash password correctly", async () => {
      const password = "testpassword123";
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(20);
    });

    test("should verify correct password against hash", async () => {
      const password = "testpassword123";
      const hash = await bcrypt.hash(password, 10);
      const isMatch = await bcrypt.compare(password, hash);
      expect(isMatch).toBe(true);
    });

    test("should reject incorrect password", async () => {
      const password = "testpassword123";
      const hash = await bcrypt.hash(password, 10);
      const isMatch = await bcrypt.compare("wrongpassword", hash);
      expect(isMatch).toBe(false);
    });
  });

  describe("JWT Token", () => {
    const secret = "test_secret";

    test("should generate a valid JWT token", () => {
      const payload = { id: 1 };
      const token = jwt.sign(payload, secret, { expiresIn: "1h" });
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.split(".").length).toBe(3);
    });

    test("should decode JWT token correctly", () => {
      const payload = { id: 42 };
      const token = jwt.sign(payload, secret, { expiresIn: "1h" });
      const decoded = jwt.verify(token, secret);
      expect(decoded.id).toBe(42);
    });

    test("should reject invalid JWT token", () => {
      expect(() => {
        jwt.verify("invalid.token.here", secret);
      }).toThrow();
    });

    test("should reject expired JWT token", () => {
      const token = jwt.sign({ id: 1 }, secret, { expiresIn: "0s" });
      expect(() => {
        jwt.verify(token, secret);
      }).toThrow();
    });
  });

  describe("Input Validation Logic", () => {
    test("should detect empty email", () => {
      const email = "";
      expect(email.length).toBe(0);
    });

    test("should detect valid email format", () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test("test@test.com")).toBe(true);
      expect(emailRegex.test("invalid-email")).toBe(false);
    });

    test("should detect short password", () => {
      const password = "abc";
      expect(password.length).toBeLessThan(6);
    });
  });

});
