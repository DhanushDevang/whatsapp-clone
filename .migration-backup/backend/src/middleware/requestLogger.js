const morgan = require("morgan");
const logger = require("../config/logger");
const { apiRequestCount } = require("../config/metrics");

const stream = {
  write: (message) => logger.info(message.trim()),
};

const morganMiddleware = morgan(
  ":method :url :status :response-time ms - :res[content-length]",
  { stream }
);

const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const route = req.route?.path || req.path;
    apiRequestCount.inc({
      method: req.method,
      route,
      status: res.statusCode,
    });
    logger.info("API Request", {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });
  next();
};

module.exports = { morganMiddleware, metricsMiddleware };
