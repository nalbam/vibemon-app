/**
 * Vibe Monitor - Main Process Entry Point
 *
 * This file orchestrates the application by connecting modules:
 * - StateManager: State and timer management (per-project timers)
 * - MultiWindowManager: Multi-window creation and management (one per project)
 * - TrayManager: System tray icon and menu
 * - HttpServer: HTTP API server
 */

const { app, ipcMain, BrowserWindow, dialog } = require('electron');
const { exec } = require('child_process');

// Modules
const { StateManager } = require('./modules/state-manager.cjs');
const { MultiWindowManager } = require('./modules/multi-window-manager.cjs');
const { TrayManager } = require('./modules/tray-manager.cjs');
const { HttpServer } = require('./modules/http-server.cjs');

// Single instance lock - prevent duplicate instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running, quit immediately
  console.log('Another instance is already running. Exiting...');
  app.exit(0);
}

// Initialize managers
const stateManager = new StateManager();
const windowManager = new MultiWindowManager();
let trayManager = null;
let httpServer = null;

// Handle second instance launch attempt
app.on('second-instance', () => {
  // Focus the first window if available
  const first = windowManager.getFirstWindow();
  if (first && !first.isDestroyed()) {
    if (first.isMinimized()) first.restore();
    first.show();
    first.focus();
  }
});

// Set up state manager callbacks
stateManager.onStateTimeout = (projectId, newState) => {
  // Merge with existing state to preserve project, model, memory, etc.
  const existingState = windowManager.getState(projectId);
  if (!existingState) return;  // Window no longer exists

  const stateData = { ...existingState, state: newState };

  // updateState returns false if window doesn't exist (handles race condition)
  if (!windowManager.updateState(projectId, stateData)) return;

  windowManager.sendToWindow(projectId, 'state-update', stateData);
  stateManager.setupStateTimeout(projectId, newState);

  // Update always on top based on new state and rearrange windows
  windowManager.updateAlwaysOnTopByState(projectId, newState);
  windowManager.rearrangeWindows();

  if (trayManager) {
    trayManager.updateIcon();
    trayManager.updateMenu();
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

// Focus terminal (iTerm2 or Ghostty on macOS)
ipcMain.handle('focus-terminal', async (event) => {
  // Only supported on macOS
  if (process.platform !== 'darwin') {
    return { success: false, reason: 'not-macos' };
  }

  // Get project ID from the window that sent the request
  const projectId = windowManager.getProjectIdByWebContents(event.sender);
  if (!projectId) {
    return { success: false, reason: 'no-project' };
  }

  // Get terminal ID for this project
  const terminalId = windowManager.getTerminalId(projectId);
  if (!terminalId) {
    return { success: false, reason: 'no-terminal-id' };
  }

  // Parse terminal type and ID (format: "iterm2:w0t4p0:UUID" or "ghostty:PID")
  const parts = terminalId.split(':');
  if (parts.length < 2) {
    return { success: false, reason: 'invalid-terminal-id-format' };
  }

  const terminalType = parts[0];

  if (terminalType === 'iterm2') {
    // Extract UUID from terminal ID (format: iterm2:w0t4p0:UUID)
    const uuid = parts.length === 3 ? parts[2] : parts[1];
    if (!uuid) {
      return { success: false, reason: 'invalid-terminal-id' };
    }

    // Validate UUID format (8-4-4-4-12 hex) to prevent command injection
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(uuid)) {
      return { success: false, reason: 'invalid-uuid-format' };
    }

    // AppleScript to activate iTerm2 and select the session
    const script = `
      tell application "iTerm2"
        activate
        repeat with aWindow in windows
          repeat with aTab in tabs of aWindow
            repeat with aSession in sessions of aTab
              if unique ID of aSession is "${uuid}" then
                select aTab
                return "ok"
              end if
            end repeat
          end repeat
        end repeat
        return "not-found"
      end tell
    `;

    return new Promise((resolve) => {
      exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, (error, stdout) => {
        if (error) {
          resolve({ success: false, reason: 'applescript-error', error: error.message });
        } else {
          const result = stdout.trim();
          resolve({ success: result === 'ok', reason: result });
        }
      });
    });
  } else if (terminalType === 'ghostty') {
    // Extract PID from terminal ID (format: ghostty:PID)
    const pid = parts[1];
    if (!pid || !/^\d+$/.test(pid)) {
      return { success: false, reason: 'invalid-ghostty-pid' };
    }

    // For Ghostty, we can only activate the application
    // Ghostty doesn't expose session/PID information via AppleScript
    // so we can't programmatically switch to a specific tab like iTerm2
    const script = `
      tell application "Ghostty"
        activate
      end tell
    `;

    return new Promise((resolve) => {
      exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, (error, _stdout) => {
        if (error) {
          resolve({ success: false, reason: 'applescript-error', error: error.message });
        } else {
          // Successfully activated Ghostty app
          // Note: User will need to manually navigate to the correct tab
          resolve({ success: true, reason: 'activated', note: 'app-activated-only' });
        }
      });
    });
  } else {
    return { success: false, reason: 'unsupported-terminal-type' };
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
  httpServer.onError = (err) => {
    if (err.code === 'EADDRINUSE') {
      dialog.showErrorBox(
        'Vibe Monitor - Port Conflict',
        'Port 19280 is already in use.\nAnother instance may be running.\n\nThe app will continue but HTTP API won\'t work.'
      );
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
  if (trayManager) {
    trayManager.cleanup();
  }
  if (httpServer) {
    httpServer.stop();
  }
});
