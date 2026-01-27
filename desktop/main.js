/**
 * Vibe Monitor - Main Process Entry Point
 *
 * This file orchestrates the application by connecting modules:
 * - StateManager: State and timer management (per-project timers)
 * - MultiWindowManager: Multi-window creation and management (one per project)
 * - TrayManager: System tray icon and menu
 * - HttpServer: HTTP API server
 */

const { app, ipcMain, BrowserWindow, Menu } = require('electron');

// Modules
const { StateManager } = require('./modules/state-manager.cjs');
const { MultiWindowManager } = require('./modules/multi-window-manager.cjs');
const { TrayManager } = require('./modules/tray-manager.cjs');
const { HttpServer } = require('./modules/http-server.cjs');

// Initialize managers
const stateManager = new StateManager();
const windowManager = new MultiWindowManager();
let trayManager = null;
let httpServer = null;

// Set up state manager callbacks
stateManager.onStateTimeout = (projectId, newState) => {
  if (windowManager.hasWindow(projectId)) {
    const stateData = { state: newState };
    windowManager.updateState(projectId, stateData);
    windowManager.sendToWindow(projectId, 'state-update', stateData);
    stateManager.setupStateTimeout(projectId, newState);

    if (trayManager) {
      trayManager.updateIcon();
      trayManager.updateMenu();
    }
  }
};

stateManager.onWindowCloseTimeout = (projectId) => {
  windowManager.closeWindow(projectId);
};

// Set up window manager callback for when windows are closed
windowManager.onWindowClosed = (projectId) => {
  stateManager.cleanupProject(projectId);
  if (trayManager) {
    trayManager.updateMenu();
    trayManager.updateIcon();
  }
};

// IPC handlers
ipcMain.handle('get-version', () => {
  return app.getVersion();
});

ipcMain.on('close-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.close();
  }
});

ipcMain.on('minimize-window', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    win.minimize();
  }
});

ipcMain.on('show-context-menu', (event) => {
  if (trayManager) {
    trayManager.showContextMenu(event.sender);
  }
});

// App lifecycle
app.whenReady().then(() => {
  // Create tray (windows are created on demand via HTTP /status endpoint)
  trayManager = new TrayManager(windowManager, app);
  trayManager.createTray();

  // Start HTTP server
  httpServer = new HttpServer(stateManager, windowManager, app);
  httpServer.onStateUpdate = (menuOnly) => {
    if (trayManager) {
      if (!menuOnly) {
        trayManager.updateIcon();
      }
      trayManager.updateMenu();
    }
  };
  httpServer.start();

  app.on('activate', () => {
    const first = windowManager.getFirstWindow();
    if (first && !first.isDestroyed()) {
      first.show();
      first.focus();
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
  stateManager.cleanup();
  windowManager.cleanup();
  if (httpServer) {
    httpServer.stop();
  }
});
