/**
 * HTTP utility functions for the Vibe Monitor HTTP server
 */

/**
 * Set CORS headers on response
 * @param {http.ServerResponse} res
 */
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * Send JSON response
 * @param {http.ServerResponse} res
 * @param {number} statusCode
 * @param {object} data
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Send error response
 * @param {http.ServerResponse} res
 * @param {number} statusCode
 * @param {string} message
 */
function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

/**
 * Parse JSON body from request with size limit
 * @param {http.IncomingMessage} req
 * @param {number} maxSize - Maximum payload size in bytes
 * @returns {Promise<{data: object|null, error: string|null, statusCode: number|null}>}
 */
function parseJsonBody(req, maxSize) {
  return new Promise((resolve) => {
    const chunks = [];
    let bodySize = 0;
    let aborted = false;

    req.on('data', (chunk) => {
      if (aborted) return;
      bodySize += chunk.length;
      if (bodySize > maxSize) {
        aborted = true;
        req.destroy();
        resolve({ data: null, error: 'Payload too large', statusCode: 413 });
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (aborted) return;
      try {
        const body = chunks.length > 0 ? Buffer.concat(chunks).toString('utf-8') : '{}';
        const data = JSON.parse(body);
        resolve({ data, error: null, statusCode: null });
      } catch (e) {
        resolve({ data: null, error: 'Invalid JSON', statusCode: 400 });
      }
    });

    req.on('error', () => {
      if (!aborted) {
        resolve({ data: null, error: 'Request error', statusCode: 500 });
      }
    });
  });
}

module.exports = {
  setCorsHeaders,
  sendJson,
  sendError,
  parseJsonBody
};
