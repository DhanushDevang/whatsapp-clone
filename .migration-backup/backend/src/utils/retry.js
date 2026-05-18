/**
 * Retry a function with exponential backoff
 * @param {Function} fn - async function to retry
 * @param {number} maxAttempts - max number of attempts
 * @param {number} baseDelay - initial delay in ms
 */
const retryWithBackoff = async (fn, maxAttempts = 3, baseDelay = 500) => {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) break;

      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.warn(`⚠️ Attempt ${attempt} failed: ${err.message}. Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

module.exports = { retryWithBackoff };
