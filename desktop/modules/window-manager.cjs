/**
 * Window management for Vibe Monitor
 */

const { BrowserWindow, screen } = require('electron');
const path = require('path');
const { WINDOW_WIDTH, WINDOW_HEIGHT, SNAP_THRESHOLD, SNAP_DEBOUNCE } = require('./constants.cjs');

class WindowManager {
  constructor() {
    this.mainWindow = null;
    this.isAlwaysOnTop = true;
    this.snapTimer = null;
  }

  createWindow() {
    const { workArea } = screen.getPrimaryDisplay();

    this.mainWindow = new BrowserWindow({
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
      x: workArea.x + workArea.width - WINDOW_WIDTH,
      y: workArea.y,
      frame: false,
      transparent: true,
      alwaysOnTop: this.isAlwaysOnTop,
      resizable: false,
      skipTaskbar: false,
      hasShadow: true,
      show: false,
      icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    this.mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));

    // Allow window to be dragged
    this.mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    // Show window without stealing focus
    this.mainWindow.once('ready-to-show', () => {
      if (this.isAlwaysOnTop) {
        this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
      }
      this.mainWindow.showInactive();
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Snap to corner when drag ends (debounced)
    this.mainWindow.on('move', () => {
      this.handleWindowMove();
    });

    return this.mainWindow;
  }

  handleWindowMove() {
    if (!this.mainWindow) return;

    // Clear previous timer
    if (this.snapTimer) {
      clearTimeout(this.snapTimer);
    }

    // Set new timer - snap after debounce time (drag ended)
    this.snapTimer = setTimeout(() => {
      if (!this.mainWindow) return;

      const bounds = this.mainWindow.getBounds();
      const display = screen.getDisplayMatching(bounds);
      const { workArea } = display;

      let newX = bounds.x;
      let newY = bounds.y;
      let shouldSnap = false;

      // Check horizontal snap (left or right edge)
      if (Math.abs(bounds.x - workArea.x) < SNAP_THRESHOLD) {
        newX = workArea.x;
        shouldSnap = true;
      } else if (Math.abs((bounds.x + bounds.width) - (workArea.x + workArea.width)) < SNAP_THRESHOLD) {
        newX = workArea.x + workArea.width - bounds.width;
        shouldSnap = true;
      }

      // Check vertical snap (top or bottom edge)
      if (Math.abs(bounds.y - workArea.y) < SNAP_THRESHOLD) {
        newY = workArea.y;
        shouldSnap = true;
      } else if (Math.abs((bounds.y + bounds.height) - (workArea.y + workArea.height)) < SNAP_THRESHOLD) {
        newY = workArea.y + workArea.height - bounds.height;
        shouldSnap = true;
      }

      // Apply snap if needed
      if (shouldSnap && (newX !== bounds.x || newY !== bounds.y)) {
        this.mainWindow.setPosition(newX, newY);
      }
    }, SNAP_DEBOUNCE);
  }

  getWindow() {
    return this.mainWindow;
  }

  isWindowAvailable() {
    return this.mainWindow !== null;
  }

  sendToWindow(channel, data) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  showAndPosition() {
    if (!this.mainWindow) return false;

    const { workArea } = screen.getPrimaryDisplay();
    const x = workArea.x + workArea.width - WINDOW_WIDTH;
    const y = workArea.y;
    this.mainWindow.setBounds({ x, y, width: WINDOW_WIDTH, height: WINDOW_HEIGHT });
    this.mainWindow.showInactive();
    return true;
  }

  showWindow() {
    if (this.mainWindow) {
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  hideWindow() {
    if (this.mainWindow) {
      this.mainWindow.hide();
    }
  }

  minimizeWindow() {
    if (this.mainWindow) {
      this.mainWindow.minimize();
    }
  }

  closeWindow() {
    if (this.mainWindow) {
      this.mainWindow.close();
    }
  }

  setAlwaysOnTop(value) {
    this.isAlwaysOnTop = value;
    if (this.mainWindow) {
      this.mainWindow.setAlwaysOnTop(value, 'screen-saver');
    }
  }

  toggleAlwaysOnTop() {
    this.setAlwaysOnTop(!this.isAlwaysOnTop);
    return this.isAlwaysOnTop;
  }

  getIsAlwaysOnTop() {
    return this.isAlwaysOnTop;
  }

  getBounds() {
    return this.mainWindow ? this.mainWindow.getBounds() : null;
  }

  getDebugInfo() {
    const displays = screen.getAllDisplays();
    const primary = screen.getPrimaryDisplay();
    const windowBounds = this.mainWindow ? this.mainWindow.getBounds() : null;

    return {
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
    };
  }
}

module.exports = { WindowManager };
