/**
 * Vibe Monitor - Main Process Entry Point
 *
 * This file orchestrates the application by connecting modules:
 * - StateManager: State and timer management
 * - WindowManager: Window creation and management
 * - TrayManager: System tray icon and menu
 * - HttpServer: HTTP API server
 */

const { app, ipcMain, BrowserWindow, Menu } = require('electron');

// Modules
const { StateManager } = require('./modules/state-manager.cjs');
const { WindowManager } = require('./modules/window-manager.cjs');
const { TrayManager } = require('./modules/tray-manager.cjs');
const { HttpServer } = require('./modules/http-server.cjs');

// Initialize managers
const stateManager = new StateManager();
const windowManager = new WindowManager();
let trayManager = null;
let httpServer = null;

// Set up state manager callbacks
stateManager.onStateChange = (data, needsWindowRecreation) => {
  if (needsWindowRecreation && !windowManager.isWindowAvailable()) {
    windowManager.createWindow();
  }
  windowManager.sendToWindow('state-update', data);
  if (trayManager) {
    trayManager.updateIcon();
    trayManager.updateMenu();
  }
};

stateManager.onWindowClose = () => {
  windowManager.closeWindow();
};

// IPC handlers
ipcMain.handle('get-version', () => {
  return app.getVersion();
});

ipcMain.on('close-window', () => {
  windowManager.hideWindow();
});

ipcMain.on('minimize-window', () => {
  windowManager.minimizeWindow();
});

ipcMain.on('show-context-menu', (event) => {
  if (trayManager) {
    trayManager.showContextMenu(event.sender);
  }
});

// App lifecycle
app.whenReady().then(() => {
  // Create window and tray
  windowManager.createWindow();
  trayManager = new TrayManager(stateManager, windowManager, app);
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

  // Start state timeout timer for initial state
  stateManager.setupStateTimeout();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createWindow();
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
  if (httpServer) {
    httpServer.stop();
  }
});
