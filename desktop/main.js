const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow;
let tray;
let isAlwaysOnTop = true;
let currentState = 'idle';

// HTTP server for receiving status updates
let httpServer;
const HTTP_PORT = 19280;

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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  // Allow window to be dragged
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  // Create a simple tray icon (orange circle)
  const iconSize = 16;
  const canvas = Buffer.alloc(iconSize * iconSize * 4);
  for (let y = 0; y < iconSize; y++) {
    for (let x = 0; x < iconSize; x++) {
      const idx = (y * iconSize + x) * 4;
      const cx = iconSize / 2, cy = iconSize / 2, r = 6;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= r) {
        canvas[idx] = 0xE0;     // R
        canvas[idx + 1] = 0x7B; // G
        canvas[idx + 2] = 0x39; // B
        canvas[idx + 3] = 255;  // A
      } else {
        canvas[idx + 3] = 0;    // Transparent
      }
    }
  }

  const icon = nativeImage.createFromBuffer(canvas, {
    width: iconSize,
    height: iconSize
  });

  tray = new Tray(icon);
  tray.setToolTip('Claude Monitor');

  updateTrayMenu();
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
        { label: 'Idle', click: () => updateState({ state: 'idle' }) },
        { label: 'Working', click: () => updateState({ state: 'working' }) },
        { label: 'Notification', click: () => updateState({ state: 'notification' }) },
        { label: 'Session Start', click: () => updateState({ state: 'session_start' }) },
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
  if (mainWindow) {
    mainWindow.webContents.send('state-update', data);
  }
  updateTrayMenu();
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
      res.end(JSON.stringify({ state: currentState }));
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
