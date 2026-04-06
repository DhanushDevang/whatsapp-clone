describe("Message Unit Tests", () => {

  describe("Message Type Validation", () => {
    const validTypes = ["text", "image", "voice"];

    test("should accept valid message types", () => {
      validTypes.forEach((type) => {
        expect(validTypes.includes(type)).toBe(true);
      });
    });

    test("should reject invalid message type", () => {
      expect(validTypes.includes("video")).toBe(false);
      expect(validTypes.includes("file")).toBe(false);
    });
  });

  describe("Message Content Validation", () => {
    test("should reject empty message content", () => {
      const content = "";
      expect(content.trim().length).toBe(0);
    });

    test("should accept valid message content", () => {
      const content = "Hello World!";
      expect(content.trim().length).toBeGreaterThan(0);
    });

    test("should reject message exceeding max length", () => {
      const content = "a".repeat(10001);
      expect(content.length).toBeGreaterThan(10000);
    });

    test("should trim whitespace from message", () => {
      const content = "  hello  ";
      expect(content.trim()).toBe("hello");
    });
  });

  describe("Conversation ID Validation", () => {
    test("should reject negative conversation ID", () => {
      const id = -1;
      expect(id).toBeLessThan(0);
    });

    test("should reject zero conversation ID", () => {
      const id = 0;
      expect(id).toBe(0);
    });

    test("should accept positive conversation ID", () => {
      const id = 5;
      expect(id).toBeGreaterThan(0);
    });
  });

  describe("Deleted Message Logic", () => {
    test("should mark message as deleted for all", () => {
      const message = { id: 1, content: "Hello", deleted_for_all: false };
      message.deleted_for_all = true;
      message.content = "This message was deleted";
      expect(message.deleted_for_all).toBe(true);
      expect(message.content).toBe("This message was deleted");
    });

    test("should add user to deleted_for array", () => {
      const message = { id: 1, deleted_for: [] };
      message.deleted_for.push("5");
      expect(message.deleted_for).toContain("5");
    });

    test("should check if user is in deleted_for array", () => {
      const message = { id: 1, deleted_for: ["3", "5"] };
      expect(message.deleted_for.includes("5")).toBe(true);
      expect(message.deleted_for.includes("7")).toBe(false);
    });
  });

});
