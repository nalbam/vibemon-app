const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const http = require('http');
const { createCanvas } = require('canvas');

let mainWindow;
let tray;
let isAlwaysOnTop = true;
let currentState = 'idle';
let currentProject = '';
let currentTool = '';
let currentModel = '';
let currentMemory = '';

// HTTP server for receiving status updates
let httpServer;
const HTTP_PORT = 19280;

// State colors (matching index.html)
const STATE_COLORS = {
  idle: '#00AA00',
  working: '#0066CC',
  notification: '#FFCC00',
  session_start: '#00CCCC',
  tool_done: '#00AA00'
};

const COLOR_CLAUDE = '#E07B39';
const COLOR_EYE = '#000000';

// Tray icon cache for performance
const trayIconCache = new Map();

// Create tray icon with state-based background color using canvas for proper PNG encoding
function createTrayIcon(state) {
  // Return cached icon if available
  if (trayIconCache.has(state)) {
    return trayIconCache.get(state);
  }

  const size = 22;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  const bgColor = STATE_COLORS[state] || STATE_COLORS.idle;

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

  // Draw simplified character for 22x22
  // Body (centered, 14x8)
  rect(4, 6, 14, 8, COLOR_CLAUDE);

  // Arms (2x3 each)
  rect(2, 8, 2, 3, COLOR_CLAUDE);   // Left arm
  rect(18, 8, 2, 3, COLOR_CLAUDE);  // Right arm

  // Legs (2x4 each, 4 legs)
  rect(5, 14, 2, 4, COLOR_CLAUDE);   // Left outer
  rect(8, 14, 2, 4, COLOR_CLAUDE);   // Left inner
  rect(12, 14, 2, 4, COLOR_CLAUDE);  // Right inner
  rect(15, 14, 2, 4, COLOR_CLAUDE);  // Right outer

  // Eyes (2x2 each)
  rect(6, 9, 2, 2, COLOR_EYE);   // Left eye
  rect(14, 9, 2, 2, COLOR_EYE);  // Right eye

  // Convert canvas to PNG buffer and create nativeImage
  const pngBuffer = canvas.toBuffer('image/png');
  const icon = nativeImage.createFromBuffer(pngBuffer);

  // Cache the icon for future use
  trayIconCache.set(state, icon);

  return icon;
}

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: 172,
    height: 348,
    x: screenWidth - 172,
    y: 20,
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
    mainWindow.showInactive();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  const icon = createTrayIcon(currentState);
  tray = new Tray(icon);
  tray.setToolTip('Claude Monitor');
  updateTrayMenu();
}

function updateTrayIcon() {
  if (tray) {
    const icon = createTrayIcon(currentState);
    tray.setImage(icon);
  }
}

function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: `State: ${currentState}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Set State',
      submenu: [
        { label: 'Session Start', click: () => updateState({ state: 'session_start' }) },
        { label: 'Idle', click: () => updateState({ state: 'idle' }) },
        { label: 'Working', click: () => updateState({ state: 'working' }) },
        { label: 'Notification', click: () => updateState({ state: 'notification' }) },
        { label: 'Tool Done', click: () => updateState({ state: 'tool_done' }) }
      ]
    },
    { type: 'separator' },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: isAlwaysOnTop,
      click: () => {
        isAlwaysOnTop = !isAlwaysOnTop;
        if (mainWindow) {
          mainWindow.setAlwaysOnTop(isAlwaysOnTop);
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

function updateState(data) {
  currentState = data.state || 'idle';
  if (data.project !== undefined) currentProject = data.project;
  if (data.tool !== undefined) currentTool = data.tool;
  if (data.model !== undefined) currentModel = data.model;
  if (data.memory !== undefined) currentMemory = data.memory;
  if (mainWindow) {
    mainWindow.webContents.send('state-update', data);
  }
  updateTrayIcon();
  updateTrayMenu();
}

// Show window and position to top-right corner
function showAndPositionWindow() {
  if (mainWindow) {
    const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
    mainWindow.setPosition(screenWidth - 172, 20);
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
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          updateState(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, state: currentState }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
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
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  httpServer.listen(HTTP_PORT, '127.0.0.1', () => {
    console.log(`Claude Monitor HTTP server running on http://127.0.0.1:${HTTP_PORT}`);
  });
}

// IPC handlers
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
  if (httpServer) {
    httpServer.close();
  }
});
