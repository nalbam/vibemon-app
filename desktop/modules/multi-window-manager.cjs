/**
 * Multi-window management for Vibe Monitor
 * Manages multiple windows, one per project
 */

const { BrowserWindow, screen } = require('electron');
const path = require('path');
const {
  WINDOW_WIDTH,
  WINDOW_HEIGHT,
  WINDOW_GAP,
  MAX_WINDOWS,
  SNAP_THRESHOLD,
  SNAP_DEBOUNCE
} = require('./constants.cjs');

class MultiWindowManager {
  constructor() {
    this.windows = new Map();  // Map<projectId, { window, state }>
    this.isAlwaysOnTop = true;
    this.snapTimers = new Map();  // Map<projectId, timerId>
    this.onWindowClosed = null;  // callback: (projectId) => void
  }

  /**
   * Calculate window position by index
   * Index 0 = rightmost (top-right corner)
   * Each subsequent index moves left by (WINDOW_WIDTH + WINDOW_GAP)
   * @param {number} index - Window index (0 = rightmost)
   * @returns {{x: number, y: number}}
   */
  calculatePosition(index) {
    const { workArea } = screen.getPrimaryDisplay();
    const x = workArea.x + workArea.width - WINDOW_WIDTH - (index * (WINDOW_WIDTH + WINDOW_GAP));
    const y = workArea.y;
    return { x, y };
  }

  /**
   * Check if more windows can be created
   * Considers MAX_WINDOWS limit and screen width
   * @returns {boolean}
   */
  canCreateWindow() {
    // Check MAX_WINDOWS limit
    if (this.windows.size >= MAX_WINDOWS) {
      return false;
    }

    // Check if there's enough screen space
    const { workArea } = screen.getPrimaryDisplay();
    const requiredWidth = (this.windows.size + 1) * (WINDOW_WIDTH + WINDOW_GAP) - WINDOW_GAP;
    if (requiredWidth > workArea.width) {
      return false;
    }

    return true;
  }

  /**
   * Create a window for a project
   * Returns existing window if already exists
   * @param {string} projectId - Project identifier
   * @returns {BrowserWindow|null}
   */
  createWindow(projectId) {
    // Return existing window if it exists
    const existing = this.windows.get(projectId);
    if (existing) {
      return existing.window;
    }

    // Check if we can create more windows
    if (!this.canCreateWindow()) {
      return null;
    }

    // Calculate position for new window (will be the newest, so rightmost)
    const index = 0;
    const position = this.calculatePosition(index);

    // Shift existing windows to the left
    // Windows will be arranged after ready-to-show

    const window = new BrowserWindow({
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
      x: position.x,
      y: position.y,
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

    window.loadFile(path.join(__dirname, '..', 'index.html'));

    // Allow window to be dragged across workspaces
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    // Store window entry with initial state
    const windowEntry = {
      window,
      state: null  // Initial state, will be set via updateState
    };
    this.windows.set(projectId, windowEntry);

    // Show window without stealing focus once ready
    window.once('ready-to-show', () => {
      if (this.isAlwaysOnTop) {
        window.setAlwaysOnTop(true, 'floating');
      }
      window.showInactive();

      // Send initial state if available
      if (windowEntry.state) {
        window.webContents.send('status-update', windowEntry.state);
      }

      // Arrange all windows alphabetically
      this.arrangeWindowsByName();
    });

    // Handle window closed
    window.on('closed', () => {
      // Clear snap timer if exists
      const timerId = this.snapTimers.get(projectId);
      if (timerId) {
        clearTimeout(timerId);
        this.snapTimers.delete(projectId);
      }

      // Remove from windows map
      this.windows.delete(projectId);

      // Notify callback
      if (this.onWindowClosed) {
        this.onWindowClosed(projectId);
      }

      // Rearrange remaining windows
      this.rearrangeWindows();
    });

    // Handle window move for snap to edges
    window.on('move', () => {
      this.handleWindowMove(projectId);
    });

    return window;
  }

  /**
   * Arrange all windows by project name alphabetically
   * A-Z from left to right (Z = rightmost)
   */
  arrangeWindowsByName() {
    // Collect all windows with projectId
    const windowsList = [];
    for (const [projectId, entry] of this.windows) {
      if (entry.window && !entry.window.isDestroyed()) {
        windowsList.push({ projectId, entry });
      }
    }

    // Sort reverse alphabetically by projectId (Z first = rightmost)
    windowsList.sort((a, b) => b.projectId.localeCompare(a.projectId));

    // Assign positions (index 0 = rightmost = first alphabetically)
    let index = 0;
    for (const { entry } of windowsList) {
      const position = this.calculatePosition(index);
      entry.window.setPosition(position.x, position.y);
      index++;
    }
  }

  /**
   * Rearrange windows after one closes or new one created
   * Sorts by project name alphabetically (A-Z from right to left)
   */
  rearrangeWindows() {
    this.arrangeWindowsByName();
  }

  /**
   * Handle window move event with debounced snap to edges
   * @param {string} projectId - Project identifier
   */
  handleWindowMove(projectId) {
    const entry = this.windows.get(projectId);
    if (!entry || !entry.window || entry.window.isDestroyed()) {
      return;
    }

    // Clear previous timer
    const existingTimer = this.snapTimers.get(projectId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer - snap after debounce time (drag ended)
    const timerId = setTimeout(() => {
      if (!entry.window || entry.window.isDestroyed()) {
        return;
      }

      const bounds = entry.window.getBounds();
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
        entry.window.setPosition(newX, newY);
      }
    }, SNAP_DEBOUNCE);

    this.snapTimers.set(projectId, timerId);
  }

  // ========== Utility Methods ==========

  /**
   * Get window by project ID
   * @param {string} projectId
   * @returns {BrowserWindow|null}
   */
  getWindow(projectId) {
    const entry = this.windows.get(projectId);
    return entry ? entry.window : null;
  }

  /**
   * Get state by project ID
   * @param {string} projectId
   * @returns {Object|null}
   */
  getState(projectId) {
    const entry = this.windows.get(projectId);
    return entry ? entry.state : null;
  }

  /**
   * Update state for a project (immutable update)
   * @param {string} projectId
   * @param {Object} newState
   * @returns {boolean} - true if updated
   */
  updateState(projectId, newState) {
    const entry = this.windows.get(projectId);
    if (!entry) {
      return false;
    }

    // Create new entry with updated state (immutable)
    const updatedEntry = {
      ...entry,
      state: { ...newState }
    };
    this.windows.set(projectId, updatedEntry);
    return true;
  }

  /**
   * Check if window exists for project
   * @param {string} projectId
   * @returns {boolean}
   */
  hasWindow(projectId) {
    const entry = this.windows.get(projectId);
    return entry !== undefined && entry.window !== null && !entry.window.isDestroyed();
  }

  /**
   * Send data to window via IPC
   * @param {string} projectId
   * @param {string} channel
   * @param {*} data
   * @returns {boolean}
   */
  sendToWindow(projectId, channel, data) {
    const entry = this.windows.get(projectId);
    if (entry && entry.window && !entry.window.isDestroyed()) {
      entry.window.webContents.send(channel, data);
      return true;
    }
    return false;
  }

  /**
   * Close window for project
   * @param {string} projectId
   * @returns {boolean}
   */
  closeWindow(projectId) {
    const entry = this.windows.get(projectId);
    if (entry && entry.window && !entry.window.isDestroyed()) {
      entry.window.close();
      return true;
    }
    return false;
  }

  /**
   * Close all windows
   */
  closeAllWindows() {
    for (const [projectId] of this.windows) {
      this.closeWindow(projectId);
    }
  }

  /**
   * Cleanup resources on app quit
   * Clears all pending snap timers
   */
  cleanup() {
    for (const [, timerId] of this.snapTimers) {
      clearTimeout(timerId);
    }
    this.snapTimers.clear();
  }

  /**
   * Show window for project
   * @param {string} projectId
   * @returns {boolean}
   */
  showWindow(projectId) {
    const entry = this.windows.get(projectId);
    if (entry && entry.window && !entry.window.isDestroyed()) {
      entry.window.showInactive();
      return true;
    }
    return false;
  }

  /**
   * Hide window for project
   * @param {string} projectId
   * @returns {boolean}
   */
  hideWindow(projectId) {
    const entry = this.windows.get(projectId);
    if (entry && entry.window && !entry.window.isDestroyed()) {
      entry.window.hide();
      return true;
    }
    return false;
  }

  /**
   * Get all project IDs
   * @returns {string[]}
   */
  getProjectIds() {
    return Array.from(this.windows.keys());
  }

  /**
   * Get number of active windows
   * @returns {number}
   */
  getWindowCount() {
    return this.windows.size;
  }

  /**
   * Set always on top for all windows
   * @param {boolean} value
   */
  setAlwaysOnTop(value) {
    this.isAlwaysOnTop = value;
    for (const [, entry] of this.windows) {
      if (entry.window && !entry.window.isDestroyed()) {
        entry.window.setAlwaysOnTop(value, 'floating');
      }
    }
  }

  /**
   * Toggle always on top for all windows
   * @returns {boolean} - New value
   */
  toggleAlwaysOnTop() {
    this.setAlwaysOnTop(!this.isAlwaysOnTop);
    return this.isAlwaysOnTop;
  }

  /**
   * Get always on top setting
   * @returns {boolean}
   */
  getIsAlwaysOnTop() {
    return this.isAlwaysOnTop;
  }

  /**
   * Get first window (for backward compatibility)
   * Returns the first (oldest) window from the Map iteration order
   * Note: Map preserves insertion order, so this returns the earliest created window
   * @returns {BrowserWindow|null}
   */
  getFirstWindow() {
    if (this.windows.size === 0) {
      return null;
    }
    // Return the first entry's window (oldest, by Map insertion order)
    const firstEntry = this.windows.values().next().value;
    return firstEntry ? firstEntry.window : null;
  }

  /**
   * Get states of all windows
   * @returns {Object.<string, Object>} Map of projectId to state
   */
  getStates() {
    const states = {};
    for (const [projectId, entry] of this.windows) {
      states[projectId] = entry.state;
    }
    return states;
  }

  /**
   * Get all window entries
   * @returns {Object.<string, {window: BrowserWindow, state: Object}>}
   */
  getWindows() {
    const result = {};
    for (const [projectId, entry] of this.windows) {
      result[projectId] = entry;
    }
    return result;
  }

  /**
   * Show and focus the first available window
   * @returns {boolean} Whether a window was shown
   */
  showFirstWindow() {
    const firstWindow = this.getFirstWindow();
    if (firstWindow && !firstWindow.isDestroyed()) {
      firstWindow.show();
      firstWindow.focus();
      return true;
    }
    return false;
  }

  /**
   * Get debug info for all windows
   * @returns {Object}
   */
  getDebugInfo() {
    const displays = screen.getAllDisplays();
    const primary = screen.getPrimaryDisplay();

    const windowsInfo = [];
    for (const [projectId, entry] of this.windows) {
      if (entry.window && !entry.window.isDestroyed()) {
        windowsInfo.push({
          projectId,
          bounds: entry.window.getBounds(),
          state: entry.state ? entry.state.state : null
        });
      }
    }

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
      windows: windowsInfo,
      windowCount: this.windows.size,
      maxWindows: MAX_WINDOWS,
      isAlwaysOnTop: this.isAlwaysOnTop,
      platform: process.platform
    };
  }
}

module.exports = { MultiWindowManager };
