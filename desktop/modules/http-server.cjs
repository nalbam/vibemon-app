/**
 * HTTP server for Vibe Monitor (Multi-Window)
 */

const http = require('http');
const { HTTP_PORT, MAX_PAYLOAD_SIZE, MAX_WINDOWS } = require('./constants.cjs');
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
      case 'GET /windows':
        this.handleGetWindows(res);
        break;
      case 'POST /close':
        await this.handlePostClose(req, res);
        break;
      case 'GET /health':
        this.handleGetHealth(res);
        break;
      case 'POST /show':
        await this.handlePostShow(req, res);
        break;
      case 'GET /debug':
        this.handleGetDebug(res);
        break;
      case 'POST /quit':
        this.handlePostQuit(res);
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
      case 'GET /window-mode':
        this.handleGetWindowMode(res);
        break;
      case 'POST /window-mode':
        await this.handlePostWindowMode(req, res);
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

    // Validate and normalize state data via stateManager
    const stateValidation = this.stateManager.validateStateData(data);
    if (!stateValidation.valid) {
      sendError(res, 400, stateValidation.error || 'Invalid state data');
      return;
    }
    const stateData = stateValidation.data;  // Extract normalized data

    // Get projectId from data or use default
    let projectId = stateData.project || 'default';

    // Create window if not exists
    if (!this.windowManager.getWindow(projectId)) {
      const result = this.windowManager.createWindow(projectId);

      // Blocked by lock in single mode
      if (result.blocked) {
        sendJson(res, 200, {
          success: false,
          error: 'Project locked',
          lockedProject: this.windowManager.getLockedProject()
        });
        return;
      }

      // No window created (max limit in multi mode)
      if (!result.window) {
        sendJson(res, 200, {
          success: false,
          error: `Maximum windows limit (${MAX_WINDOWS}) reached`,
          windowCount: this.windowManager.getWindowCount()
        });
        return;
      }

      // Project was switched in single mode
      if (result.switchedProject) {
        // Clean up old project's timers
        this.stateManager.cleanupProject(result.switchedProject);
      }
    }

    // Apply auto-lock after window is successfully created (single mode only)
    this.windowManager.applyAutoLock(projectId, stateData.state);

    // Update window state via windowManager
    this.windowManager.updateState(projectId, stateData);

    // Set up state timeout for this project
    this.stateManager.setupStateTimeout(projectId, stateData.state);

    // Send update to renderer
    this.windowManager.sendToWindow(projectId, 'state-update', stateData);

    // Update tray
    if (this.onStateUpdate) {
      this.onStateUpdate(false);  // Full update
    }

    sendJson(res, 200, {
      success: true,
      project: projectId,
      state: stateData.state,
      windowCount: this.windowManager.getWindowCount()
    });
  }

  handleGetStatus(res) {
    // Return all windows' states
    const states = this.windowManager.getStates();
    sendJson(res, 200, {
      windowCount: this.windowManager.getWindowCount(),
      projects: states
    });
  }

  handleGetWindows(res) {
    // List all active windows
    const windows = this.windowManager.getWindows();
    const windowList = Object.entries(windows).map(([projectId, windowInfo]) => ({
      project: projectId,
      state: windowInfo.state ? windowInfo.state.state : 'unknown',
      bounds: windowInfo.window && !windowInfo.window.isDestroyed()
        ? windowInfo.window.getBounds()
        : null
    }));

    sendJson(res, 200, {
      windowCount: windowList.length,
      windows: windowList
    });
  }

  async handlePostClose(req, res) {
    const { data, error, statusCode } = await parseJsonBody(req, MAX_PAYLOAD_SIZE);

    if (error) {
      sendError(res, statusCode, error);
      return;
    }

    const projectId = data.project;

    if (!projectId) {
      sendError(res, 400, 'Project is required');
      return;
    }

    const closed = this.windowManager.closeWindow(projectId);

    if (!closed) {
      sendJson(res, 200, {
        success: false,
        error: `Window for project '${projectId}' not found`
      });
      return;
    }

    // Update tray
    if (this.onStateUpdate) {
      this.onStateUpdate(true);  // Menu only
    }

    sendJson(res, 200, {
      success: true,
      project: projectId,
      windowCount: this.windowManager.getWindowCount()
    });
  }

  handleGetHealth(res) {
    sendJson(res, 200, { status: 'ok' });
  }

  async handlePostShow(req, res) {
    const { data, error, statusCode } = await parseJsonBody(req, MAX_PAYLOAD_SIZE);

    if (error) {
      sendError(res, statusCode, error);
      return;
    }

    const projectId = data.project;

    // Show specific project window or first window
    const shown = projectId
      ? this.windowManager.showWindow(projectId)
      : this.windowManager.showFirstWindow();

    sendJson(res, 200, {
      success: shown,
      project: projectId || 'first'
    });
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

  async handlePostLock(req, res) {
    const { data, error, statusCode } = await parseJsonBody(req, MAX_PAYLOAD_SIZE);

    if (error) {
      sendError(res, statusCode, error);
      return;
    }

    const projectId = data.project;

    if (!projectId) {
      sendError(res, 400, 'Project is required');
      return;
    }

    // Lock only works in single mode
    if (this.windowManager.isMultiMode()) {
      sendJson(res, 200, {
        success: false,
        error: 'Lock only available in single-window mode'
      });
      return;
    }

    const locked = this.windowManager.lockProject(projectId);

    // Update tray menu
    if (this.onStateUpdate) {
      this.onStateUpdate(true);
    }

    sendJson(res, 200, {
      success: locked,
      lockedProject: this.windowManager.getLockedProject()
    });
  }

  handlePostUnlock(res) {
    // Unlock only works in single mode
    if (this.windowManager.isMultiMode()) {
      sendJson(res, 200, {
        success: false,
        error: 'Unlock only available in single-window mode'
      });
      return;
    }

    this.windowManager.unlockProject();

    // Update tray menu
    if (this.onStateUpdate) {
      this.onStateUpdate(true);
    }

    sendJson(res, 200, {
      success: true,
      lockedProject: null
    });
  }

  handleGetLockMode(res) {
    sendJson(res, 200, {
      mode: this.windowManager.getLockMode(),
      modes: this.windowManager.getLockModes(),
      lockedProject: this.windowManager.getLockedProject(),
      windowMode: this.windowManager.getWindowMode()
    });
  }

  async handlePostLockMode(req, res) {
    const { data, error, statusCode } = await parseJsonBody(req, MAX_PAYLOAD_SIZE);

    if (error) {
      sendError(res, statusCode, error);
      return;
    }

    const mode = data.mode;

    if (!mode) {
      sendError(res, 400, 'Mode is required');
      return;
    }

    const success = this.windowManager.setLockMode(mode);

    if (!success) {
      sendJson(res, 200, {
        success: false,
        error: `Invalid mode: ${mode}`,
        validModes: Object.keys(this.windowManager.getLockModes())
      });
      return;
    }

    // Update tray menu
    if (this.onStateUpdate) {
      this.onStateUpdate(true);
    }

    sendJson(res, 200, {
      success: true,
      mode: this.windowManager.getLockMode(),
      lockedProject: this.windowManager.getLockedProject()
    });
  }

  handleGetWindowMode(res) {
    sendJson(res, 200, {
      mode: this.windowManager.getWindowMode(),
      windowCount: this.windowManager.getWindowCount(),
      lockedProject: this.windowManager.getLockedProject()
    });
  }

  async handlePostWindowMode(req, res) {
    const { data, error, statusCode } = await parseJsonBody(req, MAX_PAYLOAD_SIZE);

    if (error) {
      sendError(res, statusCode, error);
      return;
    }

    const mode = data.mode;

    if (!mode) {
      sendError(res, 400, 'Mode is required');
      return;
    }

    if (mode !== 'multi' && mode !== 'single') {
      sendJson(res, 200, {
        success: false,
        error: `Invalid mode: ${mode}`,
        validModes: ['multi', 'single']
      });
      return;
    }

    this.windowManager.setWindowMode(mode);

    // Update tray menu
    if (this.onStateUpdate) {
      this.onStateUpdate(true);
    }

    sendJson(res, 200, {
      success: true,
      mode: this.windowManager.getWindowMode(),
      windowCount: this.windowManager.getWindowCount(),
      lockedProject: this.windowManager.getLockedProject()
    });
  }
}

module.exports = { HttpServer };
