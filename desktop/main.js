const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const http = require('http');
const { createCanvas } = require('canvas');

let mainWindow;
let tray;
let isAlwaysOnTop = true;
let currentState = 'start';
let currentCharacter = 'clawd';  // 'clawd' or 'kiro'
let currentProject = '';
let currentTool = '';
let currentModel = '';
let currentMemory = '';

// State timeout management
let stateTimeoutTimer = null;
const DONE_TO_IDLE_TIMEOUT = 60 * 1000;      // 1 minute
const IDLE_TO_SLEEP_TIMEOUT = 10 * 60 * 1000; // 10 minutes

// HTTP server for receiving status updates
let httpServer;
const HTTP_PORT = 19280;
const MAX_PAYLOAD_SIZE = 10 * 1024; // 10KB limit for security

// Valid states for validation
const VALID_STATES = ['start', 'idle', 'thinking', 'working', 'notification', 'done', 'sleep'];

// State colors for tray icon (must match shared/config.js states.bgColor)
// NOTE: Cannot import ESM from CommonJS, keep in sync manually
const STATE_COLORS = {
  start: '#00CCCC',
  idle: '#00AA00',
  thinking: '#6633CC',
  working: '#0066CC',
  notification: '#FFCC00',
  done: '#00AA00',
  sleep: '#1a1a4e'
};

// Character configurations for tray icon (must match shared/config.js CHARACTER_CONFIG)
// NOTE: Cannot import ESM from CommonJS, keep in sync manually
const CHARACTER_CONFIG = {
  clawd: {
    name: 'clawd',
    displayName: 'Clawd',
    color: '#D97757',
    isGhost: false
  },
  kiro: {
    name: 'kiro',
    displayName: 'Kiro',
    color: '#FFFFFF',
    isGhost: true
  }
};

const CHARACTER_NAMES = Object.keys(CHARACTER_CONFIG);
const DEFAULT_CHARACTER = 'clawd';
const COLOR_EYE = '#000000';

// Tray icon cache for performance
const trayIconCache = new Map();

// Create tray icon with state-based background color using canvas for proper PNG encoding
function createTrayIcon(state, character = 'clawd') {
  const cacheKey = `${state}-${character}`;

  // Return cached icon if available
  if (trayIconCache.has(cacheKey)) {
    return trayIconCache.get(cacheKey);
  }

  const size = 22;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  const bgColor = STATE_COLORS[state] || STATE_COLORS.idle;
  const charConfig = CHARACTER_CONFIG[character] || CHARACTER_CONFIG[DEFAULT_CHARACTER];
  const charColor = charConfig.color;
  const isGhost = charConfig.isGhost;

  // Helper to draw filled rectangle
  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  // Clear canvas (transparent)
  ctx.clearRect(0, 0, size, size);

  // Draw rounded background
  const radius = 4;
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, radius);
  ctx.fill();

  if (isGhost) {
    // Draw ghost character for kiro
    // Body (rounded top effect)
    rect(6, 4, 10, 2, charColor);   // Rounded top
    rect(5, 6, 12, 8, charColor);   // Main body

    // Wavy tail (instead of legs)
    rect(5, 14, 4, 3, charColor);   // Left wave
    rect(9, 15, 4, 2, charColor);   // Middle wave
    rect(13, 14, 4, 3, charColor);  // Right wave

    // Eyes (2x2 each)
    rect(7, 8, 2, 2, COLOR_EYE);    // Left eye
    rect(13, 8, 2, 2, COLOR_EYE);   // Right eye
  } else {
    // Draw clawd character (default)
    // Body (centered, 14x8)
    rect(4, 6, 14, 8, charColor);

    // Arms (2x3 each)
    rect(2, 8, 2, 3, charColor);   // Left arm
    rect(18, 8, 2, 3, charColor);  // Right arm

    // Legs (2x4 each, 4 legs)
    rect(5, 14, 2, 4, charColor);   // Left outer
    rect(8, 14, 2, 4, charColor);   // Left inner
    rect(12, 14, 2, 4, charColor);  // Right inner
    rect(15, 14, 2, 4, charColor);  // Right outer

    // Eyes (2x2 each)
    rect(6, 9, 2, 2, COLOR_EYE);   // Left eye
    rect(14, 9, 2, 2, COLOR_EYE);  // Right eye
  }

  // Convert canvas to PNG buffer and create nativeImage
  const pngBuffer = canvas.toBuffer('image/png');
  const icon = nativeImage.createFromBuffer(pngBuffer);

  // Cache the icon for future use
  trayIconCache.set(cacheKey, icon);

  return icon;
}

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();

  mainWindow = new BrowserWindow({
    width: 172,
    height: 348,
    x: workArea.x + workArea.width - 172,
    y: workArea.y,
    frame: false,
    transparent: true,
    alwaysOnTop: isAlwaysOnTop,
    resizable: false,
    skipTaskbar: false,
    hasShadow: true,
    show: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  // Allow window to be dragged
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Show window without stealing focus
  mainWindow.once('ready-to-show', () => {
    // Set alwaysOnTop with level for better Windows support
    if (isAlwaysOnTop) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
    mainWindow.showInactive();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const icon = createTrayIcon(currentState, currentCharacter);
  tray = new Tray(icon);
  tray.setToolTip('Vibe Monitor');
  updateTrayMenu();
}

function updateTrayIcon() {
  if (tray) {
    const icon = createTrayIcon(currentState, currentCharacter);
    tray.setImage(icon);
  }
}

function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: `State: ${currentState}`,
      enabled: false
    },
    {
      label: `Character: ${currentCharacter}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Set State',
      submenu: [
        { label: 'Start', click: () => updateState({ state: 'start' }) },
        { label: 'Idle', click: () => updateState({ state: 'idle' }) },
        { label: 'Working', click: () => updateState({ state: 'working' }) },
        { label: 'Notification', click: () => updateState({ state: 'notification' }) },
        { label: 'Done', click: () => updateState({ state: 'done' }) },
        { label: 'Sleep', click: () => updateState({ state: 'sleep' }) }
      ]
    },
    {
      label: 'Set Character',
      submenu: CHARACTER_NAMES.map(name => {
        const char = CHARACTER_CONFIG[name];
        return {
          label: char.displayName,
          type: 'radio',
          checked: currentCharacter === name,
          click: () => updateState({ state: currentState, character: name })
        };
      })
    },
    { type: 'separator' },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: isAlwaysOnTop,
      click: () => {
        isAlwaysOnTop = !isAlwaysOnTop;
        if (mainWindow) {
          mainWindow.setAlwaysOnTop(isAlwaysOnTop, 'screen-saver');
        }
      }
    },
    {
      label: 'Show Window',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: `HTTP Server: localhost:${HTTP_PORT}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

// Clear any existing state timeout timer
function clearStateTimeout() {
  if (stateTimeoutTimer) {
    clearTimeout(stateTimeoutTimer);
    stateTimeoutTimer = null;
  }
}

// Set up state timeout based on current state
function setupStateTimeout() {
  clearStateTimeout();

  if (currentState === 'done') {
    // done -> idle after 1 minute
    stateTimeoutTimer = setTimeout(() => {
      updateState({ state: 'idle' });
    }, DONE_TO_IDLE_TIMEOUT);
  } else if (currentState === 'idle' || currentState === 'start') {
    // idle/start -> sleep after 10 minutes
    stateTimeoutTimer = setTimeout(() => {
      updateState({ state: 'sleep' });
    }, IDLE_TO_SLEEP_TIMEOUT);
  }
}

function updateState(data) {
  // If state is provided (from vibe-monitor.sh), update all fields
  if (data.state !== undefined) {
    currentState = data.state;
    if (data.character !== undefined) {
      currentCharacter = CHARACTER_CONFIG[data.character] ? data.character : DEFAULT_CHARACTER;
    }
    // Clear model and memory when project changes
    if (data.project !== undefined && data.project !== currentProject) {
      currentModel = '';
      currentMemory = '';
      data.model = '';
      data.memory = '';
    }
    if (data.project !== undefined) currentProject = data.project;
    if (data.tool !== undefined) currentTool = data.tool;
    if (data.model !== undefined) currentModel = data.model;
    if (data.memory !== undefined) currentMemory = data.memory;

    // Set up state timeout for auto-transitions
    setupStateTimeout();
  } else {
    // If no state (from statusline.sh), only update model/memory if project matches
    if (data.project !== undefined && data.project === currentProject) {
      if (data.model !== undefined) currentModel = data.model;
      if (data.memory !== undefined) currentMemory = data.memory;
    }
  }
  if (mainWindow) {
    mainWindow.webContents.send('state-update', data);
  }
  updateTrayIcon();
  updateTrayMenu();
}

// Show window and position to top-right corner
function showAndPositionWindow() {
  if (mainWindow) {
    const { workArea } = screen.getPrimaryDisplay();
    const x = workArea.x + workArea.width - 172;
    const y = workArea.y;
    // Use setBounds for better Windows compatibility
    mainWindow.setBounds({ x, y, width: 172, height: 348 });
    mainWindow.showInactive();
    return true;
  }
  return false;
}

function startHttpServer() {
  httpServer = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url === '/status') {
      const chunks = [];
      let bodySize = 0;
      let aborted = false;

      req.on('data', chunk => {
        if (aborted) return;
        bodySize += chunk.length;
        if (bodySize > MAX_PAYLOAD_SIZE) {
          aborted = true;
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Payload too large' }));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });

      req.on('end', () => {
        if (aborted) return;
        try {
          const body = Buffer.concat(chunks).toString('utf-8');
          const data = JSON.parse(body);

          // Validate state if provided
          if (data.state !== undefined && !VALID_STATES.includes(data.state)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Invalid state: ${data.state}` }));
            return;
          }

          // Validate character if provided
          if (data.character !== undefined && !CHARACTER_NAMES.includes(data.character)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Invalid character: ${data.character}` }));
            return;
          }

          updateState(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, state: currentState }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });

      req.on('error', () => {
        if (!aborted) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Request error' }));
        }
      });
    } else if (req.method === 'GET' && req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        state: currentState,
        project: currentProject,
        tool: currentTool,
        model: currentModel,
        memory: currentMemory
      }));
    } else if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    } else if (req.method === 'POST' && req.url === '/show') {
      const shown = showAndPositionWindow();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: shown }));
    } else if (req.method === 'GET' && req.url === '/debug') {
      const displays = screen.getAllDisplays();
      const primary = screen.getPrimaryDisplay();
      const windowBounds = mainWindow ? mainWindow.getBounds() : null;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        primaryDisplay: {
          bounds: primary.bounds,
          workArea: primary.workArea,
          workAreaSize: primary.workAreaSize,
          scaleFactor: primary.scaleFactor
        },
        allDisplays: displays.map(d => ({
          id: d.id,
          bounds: d.bounds,
          workArea: d.workArea,
          scaleFactor: d.scaleFactor
        })),
        window: windowBounds,
        platform: process.platform
      }, null, 2));
    } else if (req.method === 'POST' && req.url === '/quit') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      setTimeout(() => app.quit(), 100);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  httpServer.on('error', (err) => {
    console.error('HTTP Server error:', err.message);
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${HTTP_PORT} is already in use`);
    }
  });

  httpServer.listen(HTTP_PORT, '127.0.0.1', () => {
    console.log(`Vibe Monitor HTTP server running on http://127.0.0.1:${HTTP_PORT}`);
  });
}

// IPC handlers
ipcMain.handle('get-version', () => {
  return app.getVersion();
});

ipcMain.on('close-window', () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});

ipcMain.on('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  startHttpServer();
  setupStateTimeout();  // Start timeout timer for initial state

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Keep app running in tray on macOS
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  clearStateTimeout();
  if (httpServer) {
    httpServer.close();
  }
});
