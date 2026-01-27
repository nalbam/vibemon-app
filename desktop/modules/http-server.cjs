/**
 * HTTP server for Vibe Monitor
 */

const http = require('http');
const { HTTP_PORT, MAX_PAYLOAD_SIZE, LOCK_MODES } = require('./constants.cjs');
const { setCorsHeaders, sendJson, sendError, parseJsonBody } = require('./http-utils.cjs');
const { validateStatusPayload } = require('./validators.cjs');

class HttpServer {
  constructor(stateManager, windowManager, app) {
    this.server = null;
    this.stateManager = stateManager;
    this.windowManager = windowManager;
    this.app = app;
    this.onStateUpdate = null;  // Callback for menu/icon updates
  }

  start() {
    this.server = http.createServer((req, res) => this.handleRequest(req, res));

    this.server.on('error', (err) => {
      console.error('HTTP Server error:', err.message);
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${HTTP_PORT} is already in use`);
      }
    });

    this.server.listen(HTTP_PORT, '127.0.0.1', () => {
      console.log(`Vibe Monitor HTTP server running on http://127.0.0.1:${HTTP_PORT}`);
    });

    return this.server;
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
  }

  async handleRequest(req, res) {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const route = `${req.method} ${req.url}`;

    switch (route) {
      case 'POST /status':
        await this.handlePostStatus(req, res);
        break;
      case 'GET /status':
        this.handleGetStatus(res);
        break;
      case 'POST /lock':
        await this.handlePostLock(req, res);
        break;
      case 'POST /unlock':
        this.handlePostUnlock(res);
        break;
      case 'GET /lock-mode':
        this.handleGetLockMode(res);
        break;
      case 'POST /lock-mode':
        await this.handlePostLockMode(req, res);
        break;
      case 'GET /health':
        this.handleGetHealth(res);
        break;
      case 'POST /show':
        this.handlePostShow(res);
        break;
      case 'GET /debug':
        this.handleGetDebug(res);
        break;
      case 'POST /quit':
        this.handlePostQuit(res);
        break;
      default:
        res.writeHead(404);
        res.end('Not Found');
    }
  }

  async handlePostStatus(req, res) {
    const { data, error, statusCode } = await parseJsonBody(req, MAX_PAYLOAD_SIZE);

    if (error) {
      sendError(res, statusCode, error);
      return;
    }

    // Validate payload
    const validation = validateStatusPayload(data);
    if (!validation.valid) {
      sendError(res, 400, validation.error);
      return;
    }

    const result = this.stateManager.updateState(data);

    if (result.blocked) {
      if (result.menuUpdateOnly && this.onStateUpdate) {
        this.onStateUpdate(true);  // Menu only
      }
      sendJson(res, 200, { success: true, state: this.stateManager.getState().state });
      return;
    }

    // Recreate window if needed
    if (result.needsWindowRecreation && !this.windowManager.isWindowAvailable()) {
      this.windowManager.createWindow();
    }

    // Send update to renderer
    this.windowManager.sendToWindow('state-update', result.data);

    // Update tray
    if (this.onStateUpdate) {
      this.onStateUpdate(false);  // Full update
    }

    sendJson(res, 200, { success: true, state: this.stateManager.getState().state });
  }

  handleGetStatus(res) {
    sendJson(res, 200, this.stateManager.getState());
  }

  async handlePostLock(req, res) {
    const { data, error, statusCode } = await parseJsonBody(req, MAX_PAYLOAD_SIZE);

    if (error) {
      sendError(res, statusCode, error);
      return;
    }

    const state = this.stateManager.getState();
    const projectToLock = data.project || state.project;

    if (!projectToLock) {
      sendError(res, 400, 'No project to lock');
      return;
    }

    const needsWindowRecreation = this.stateManager.lockProject(projectToLock);

    if (needsWindowRecreation && !this.windowManager.isWindowAvailable()) {
      this.windowManager.createWindow();
    }

    if (this.onStateUpdate) {
      this.onStateUpdate(false);
    }

    sendJson(res, 200, { success: true, locked: this.stateManager.getLockedProject() });
  }

  handlePostUnlock(res) {
    this.stateManager.unlockProject();

    if (this.onStateUpdate) {
      this.onStateUpdate(true);  // Menu only
    }

    sendJson(res, 200, { success: true, locked: null });
  }

  handleGetLockMode(res) {
    sendJson(res, 200, {
      lockMode: this.stateManager.getLockMode(),
      modes: LOCK_MODES
    });
  }

  async handlePostLockMode(req, res) {
    const { data, error, statusCode } = await parseJsonBody(req, MAX_PAYLOAD_SIZE);

    if (error) {
      sendError(res, statusCode, error);
      return;
    }

    if (!data.mode || !LOCK_MODES[data.mode]) {
      sendError(res, 400, `Invalid mode. Valid modes: ${Object.keys(LOCK_MODES).join(', ')}`);
      return;
    }

    this.stateManager.setLockMode(data.mode);

    if (this.onStateUpdate) {
      this.onStateUpdate(true);  // Menu only
    }

    sendJson(res, 200, { success: true, lockMode: this.stateManager.getLockMode() });
  }

  handleGetHealth(res) {
    sendJson(res, 200, { status: 'ok' });
  }

  handlePostShow(res) {
    const shown = this.windowManager.showAndPosition();
    sendJson(res, 200, { success: shown });
  }

  handleGetDebug(res) {
    const debugInfo = this.windowManager.getDebugInfo();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(debugInfo, null, 2));
  }

  handlePostQuit(res) {
    sendJson(res, 200, { success: true });
    setTimeout(() => this.app.quit(), 100);
  }
}

module.exports = { HttpServer };
