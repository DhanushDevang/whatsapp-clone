const client = require("prom-client");

// Enable default metrics (CPU, memory, event loop)
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Custom metrics
const messagesSentTotal = new client.Counter({
  name: "messages_sent_total",
  help: "Total number of messages sent",
  labelNames: ["type"],
  registers: [register],
});

const activeConnections = new client.Gauge({
  name: "active_connections",
  help: "Number of active WebSocket connections",
  registers: [register],
});

const apiRequestCount = new client.Counter({
  name: "api_request_count",
  help: "Total number of API requests",
  labelNames: ["method", "route", "status"],
  registers: [register],
});

const messageDeliveryLatency = new client.Histogram({
  name: "message_delivery_latency_ms",
  help: "Message delivery latency in milliseconds",
  buckets: [10, 50, 100, 200, 500, 1000],
  registers: [register],
});

const authAttemptsTotal = new client.Counter({
  name: "auth_attempts_total",
  help: "Total number of auth attempts",
  labelNames: ["type", "status"],
  registers: [register],
});

module.exports = {
  register,
  messagesSentTotal,
  activeConnections,
  apiRequestCount,
  messageDeliveryLatency,
  authAttemptsTotal,
};
