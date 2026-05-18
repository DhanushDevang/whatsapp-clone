const logger = require("../config/logger");
const {
  messagesSentTotal,
  activeConnections,
  apiRequestCount,
  messageDeliveryLatency,
  authAttemptsTotal,
  register,
} = require("../config/metrics");

describe("Observability Unit Tests", () => {

  describe("Logger", () => {
    test("should have logger instance", () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
    });

    test("should log without throwing", () => {
      expect(() => logger.info("Test log message")).not.toThrow();
      expect(() => logger.warn("Test warning")).not.toThrow();
      expect(() => logger.error("Test error")).not.toThrow();
    });

    test("should log with metadata without throwing", () => {
      expect(() => logger.info("User action", { userId: 1, action: "login" })).not.toThrow();
    });
  });

  describe("Prometheus Metrics", () => {
    test("should have messages_sent_total counter", () => {
      expect(messagesSentTotal).toBeDefined();
      messagesSentTotal.inc({ type: "text" });
    });

    test("should have active_connections gauge", () => {
      expect(activeConnections).toBeDefined();
      activeConnections.inc();
      activeConnections.dec();
    });

    test("should have api_request_count counter", () => {
      expect(apiRequestCount).toBeDefined();
      apiRequestCount.inc({ method: "GET", route: "/api/test", status: "200" });
    });

    test("should have message_delivery_latency histogram", () => {
      expect(messageDeliveryLatency).toBeDefined();
      messageDeliveryLatency.observe(42);
    });

    test("should have auth_attempts_total counter", () => {
      expect(authAttemptsTotal).toBeDefined();
      authAttemptsTotal.inc({ type: "login", status: "success" });
    });

    test("should expose metrics from registry", async () => {
      const metrics = await register.metrics();
      expect(typeof metrics).toBe("string");
      expect(metrics).toContain("messages_sent_total");
      expect(metrics).toContain("active_connections");
      expect(metrics).toContain("api_request_count");
    });
  });

  describe("Health Check Data", () => {
    test("should have valid uptime", () => {
      const uptime = process.uptime();
      expect(uptime).toBeGreaterThan(0);
    });

    test("should have valid memory usage", () => {
      const memory = process.memoryUsage();
      expect(memory).toHaveProperty("heapUsed");
      expect(memory).toHaveProperty("heapTotal");
      expect(memory.heapUsed).toBeGreaterThan(0);
    });

    test("should have valid node version", () => {
      expect(process.version).toMatch(/^v\d+\.\d+\.\d+/);
    });
  });

});
