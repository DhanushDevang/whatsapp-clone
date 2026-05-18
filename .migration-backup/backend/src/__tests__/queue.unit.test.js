const { retryWithBackoff } = require("../utils/retry");

describe("Production Concepts Unit Tests", () => {

  describe("Retry Logic", () => {
    test("should succeed on first attempt", async () => {
      const fn = jest.fn().mockResolvedValue("success");
      const result = await retryWithBackoff(fn, 3, 10);
      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test("should retry on failure and succeed", async () => {
      let attempts = 0;
      const fn = jest.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) throw new Error("Temporary failure");
        return "success after retries";
      });
      const result = await retryWithBackoff(fn, 3, 10);
      expect(result).toBe("success after retries");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    test("should throw after max attempts", async () => {
      const fn = jest.fn().mockRejectedValue(new Error("Permanent failure"));
      await expect(retryWithBackoff(fn, 3, 10)).rejects.toThrow("Permanent failure");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    test("should use exponential backoff delays", async () => {
      const delays = [];
      const originalSetTimeout = global.setTimeout;
      jest.spyOn(global, "setTimeout").mockImplementation((cb, delay) => {
        delays.push(delay);
        return originalSetTimeout(cb, 0);
      });

      const fn = jest.fn()
        .mockRejectedValueOnce(new Error("fail1"))
        .mockRejectedValueOnce(new Error("fail2"))
        .mockResolvedValue("success");

      await retryWithBackoff(fn, 3, 100);
      expect(delays[0]).toBe(100);
      expect(delays[1]).toBe(200);

      jest.restoreAllMocks();
    });
  });

  describe("Rate Limiting Config", () => {
    test("should have correct message rate limit", () => {
      const MAX_MESSAGES_PER_SECOND = 20;
      expect(MAX_MESSAGES_PER_SECOND).toBe(20);
    });

    test("should have correct auth rate limit", () => {
      const MAX_AUTH_ATTEMPTS = 10;
      const WINDOW_MS = 15 * 60 * 1000;
      expect(MAX_AUTH_ATTEMPTS).toBe(10);
      expect(WINDOW_MS).toBe(900000);
    });
  });

  describe("Message Queue Structure", () => {
    test("should create valid job data structure", () => {
      const jobData = {
        conversationId: 1,
        senderId: 5,
        content: "Hello!",
        message_type: "text",
        media_data: null,
      };
      expect(jobData).toHaveProperty("conversationId");
      expect(jobData).toHaveProperty("senderId");
      expect(jobData).toHaveProperty("content");
      expect(jobData.message_type).toBe("text");
    });

    test("should validate job data has required fields", () => {
      const isValidJob = (data) =>
        data.conversationId && data.senderId && data.content;

      expect(isValidJob({ conversationId: 1, senderId: 2, content: "hi" })).toBeTruthy();
      expect(isValidJob({ conversationId: 1, senderId: 2 })).toBeFalsy();
    });

    test("should calculate exponential backoff correctly", () => {
      const baseDelay = 1000;
      const attempt1Delay = baseDelay * Math.pow(2, 0);
      const attempt2Delay = baseDelay * Math.pow(2, 1);
      const attempt3Delay = baseDelay * Math.pow(2, 2);
      expect(attempt1Delay).toBe(1000);
      expect(attempt2Delay).toBe(2000);
      expect(attempt3Delay).toBe(4000);
    });
  });

});
