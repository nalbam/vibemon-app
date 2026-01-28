/**
 * Multi-window management for Vibe Monitor
 * Manages multiple windows, one per project
 * Supports both multi-window and single-window modes
 */

const { BrowserWindow, screen } = require('electron');
const path = require('path');
const Store = require('electron-store');
const {
  WINDOW_WIDTH,
  WINDOW_HEIGHT,
  WINDOW_GAP,
  MAX_WINDOWS,
  SNAP_THRESHOLD,
  SNAP_DEBOUNCE,
  LOCK_MODES,
  ALWAYS_ON_TOP_MODES,
  ACTIVE_STATES,
  ALWAYS_ON_TOP_GRACE_PERIOD
} = require('../shared/config.cjs');

// Platform-specific always-on-top level
// macOS: 'floating' (required for tray menu visibility)
// Windows/Linux: 'screen-saver' (required for window visibility in WSL/Windows)
const ALWAYS_ON_TOP_LEVEL = process.platform === 'darwin' ? 'floating' : 'screen-saver';

class MultiWindowManager {
  constructor() {
    this.windows = new Map();  // Map<projectId, { window, state }>
    this.snapTimers = new Map();  // Map<projectId, timerId>
    this.alwaysOnTopTimers = new Map();  // Map<projectId, timerId> for grace period
    this.onWindowClosed = null;  // callback: (projectId) => void

    // Persistent settings
    this.store = new Store({
      defaults: {
        windowMode: 'multi',  // 'multi' or 'single'
        lockedProject: null,
        lockMode: 'on-thinking',  // 'first-project' or 'on-thinking'
        alwaysOnTopMode: 'active-only',  // 'active-only', 'all', or 'disabled'
        projectList: []  // Persisted project list for lock menu
      }
    });

    // Window mode: 'multi' (multiple windows) or 'single' (one window with lock)
    this.windowMode = this.store.get('windowMode');
    this.lockedProject = this.store.get('lockedProject');
    this.lockMode = this.store.get('lockMode');
    this.alwaysOnTopMode = this.store.get('alwaysOnTopMode');

    // Project list (tracks all projects seen) - persisted
    this.projectList = this.store.get('projectList') || [];
  }

  // ============================================================================
  // Window Mode Management
  // ============================================================================

  /**
   * Get current window mode
   * @returns {'multi'|'single'}
   */
  getWindowMode() {
    return this.windowMode;
  }

  /**
   * Set window mode
   * @param {'multi'|'single'} mode
   */
  setWindowMode(mode) {
    if (mode !== 'multi' && mode !== 'single') return;

    this.windowMode = mode;
    this.store.set('windowMode', mode);

    // When switching to single mode, close extra windows
    if (mode === 'single' && this.windows.size > 1) {
      const projectIds = Array.from(this.windows.keys());
      // Keep only the first (or locked) window
      const keepProject = this.lockedProject || projectIds[0];
      for (const projectId of projectIds) {
        if (projectId !== keepProject) {
          this.closeWindow(projectId);
        }
      }
    }

    // Clear lock when switching to multi mode
    if (mode === 'multi') {
      this.lockedProject = null;
      this.store.set('lockedProject', null);
    }
  }

  /**
   * Check if in multi-window mode
   * @returns {boolean}
   */
  isMultiMode() {
    return this.windowMode === 'multi';
  }

  // ============================================================================
  // Lock Management (Single Window Mode)
  // ============================================================================

  /**
   * Add project to the project list (persisted)
   * @param {string} project
   */
  addProjectToList(project) {
    if (project && !this.projectList.includes(project)) {
      this.projectList.push(project);
      this.store.set('projectList', this.projectList);
    }
  }

  /**
   * Get list of all known projects
   * @returns {string[]}
   */
  getProjectList() {
    return this.projectList;
  }

  /**
   * Lock to a specific project (single mode only)
   * @param {string} projectId
   * @returns {boolean}
   */
  lockProject(projectId) {
    if (this.windowMode !== 'single') return false;
    if (!projectId) return false;

    this.addProjectToList(projectId);
    this.lockedProject = projectId;
    this.store.set('lockedProject', projectId);
    return true;
  }

  /**
   * Unlock project (single mode only)
   */
  unlockProject() {
    this.lockedProject = null;
    this.store.set('lockedProject', null);
  }

  /**
   * Get locked project
   * @returns {string|null}
   */
  getLockedProject() {
    return this.lockedProject;
  }

  /**
   * Get current lock mode
   * @returns {'first-project'|'on-thinking'}
   */
  getLockMode() {
    return this.lockMode;
  }

  /**
   * Get all available lock modes
   * @returns {Object}
   */
  getLockModes() {
    return LOCK_MODES;
  }

  /**
   * Set lock mode (single mode only)
   * @param {'first-project'|'on-thinking'} mode
   * @returns {boolean}
   */
  setLockMode(mode) {
    if (!LOCK_MODES[mode]) return false;

    this.lockMode = mode;
    this.lockedProject = null;  // Reset lock when mode changes
    this.store.set('lockMode', mode);
    this.store.set('lockedProject', null);
    return true;
  }

  /**
   * Apply auto-lock based on lock mode
   * Called when a status update is received
   * @param {string} projectId
   * @param {string} state - Current state (thinking, working, etc.)
   */
  applyAutoLock(projectId, state) {
    if (this.windowMode !== 'single') return;
    if (!projectId) return;

    this.addProjectToList(projectId);

    if (this.lockMode === 'first-project') {
      // Lock to first project if not already locked
      if (this.projectList.length === 1 && this.lockedProject === null) {
        this.lockedProject = projectId;
        this.store.set('lockedProject', projectId);
      }
    } else if (this.lockMode === 'on-thinking') {
      // Lock when entering thinking state
      if (state === 'thinking') {
        this.lockedProject = projectId;
        this.store.set('lockedProject', projectId);
      }
    }
  }

  // ============================================================================
  // Window Position Calculation
  // ============================================================================

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
   * In single mode: reuses existing window or respects lock
   * In multi mode: creates new window per project
   * @param {string} projectId - Project identifier
   * @returns {{window: BrowserWindow|null, blocked: boolean, switchedProject: string|null}}
   */
  createWindow(projectId) {
    // Return existing window if it exists for this project
    const existing = this.windows.get(projectId);
    if (existing) {
      return { window: existing.window, blocked: false, switchedProject: null };
    }

    // Single window mode handling
    if (this.windowMode === 'single') {
      // If locked to different project, block
      if (this.lockedProject && this.lockedProject !== projectId) {
        return { window: null, blocked: true, switchedProject: null };
      }

      // If window exists for different project, switch it
      if (this.windows.size > 0) {
        const [oldProjectId, entry] = this.windows.entries().next().value;

        // Clear timers for the old project
        this.clearAlwaysOnTopTimer(oldProjectId);
        const snapTimer = this.snapTimers.get(oldProjectId);
        if (snapTimer) {
          clearTimeout(snapTimer);
          this.snapTimers.delete(oldProjectId);
        }

        // Remove old entry and re-register with new projectId
        this.windows.delete(oldProjectId);
        this.windows.set(projectId, entry);
        // Update mutable projectId for event handlers using closure
        entry.currentProjectId = projectId;
        // Reset state for new project (clear previous project's data)
        entry.state = { project: projectId };
        return { window: entry.window, blocked: false, switchedProject: oldProjectId };
      }
    }

    // Check if we can create more windows (multi mode)
    if (!this.canCreateWindow()) {
      return { window: null, blocked: false, switchedProject: null };
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
      alwaysOnTop: this.alwaysOnTopMode !== 'disabled',
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
    // currentProjectId is mutable to handle single-mode window reuse
    const windowEntry = {
      window,
      state: null,  // Initial state, will be set via updateState
      currentProjectId: projectId  // Mutable: updated when window is reused in single mode
    };
    this.windows.set(projectId, windowEntry);

    // Show window without stealing focus once ready
    window.once('ready-to-show', () => {
      // Set always on top based on mode and current state
      const currentState = windowEntry.state ? windowEntry.state.state : null;
      const shouldBeOnTop = this.shouldBeAlwaysOnTop(currentState);
      window.setAlwaysOnTop(shouldBeOnTop, ALWAYS_ON_TOP_LEVEL);

      window.showInactive();

      // Send initial state if available
      if (windowEntry.state) {
        window.webContents.send('state-update', windowEntry.state);
      }

      // Arrange all windows by state and name
      this.arrangeWindowsByName();
    });

    // Handle window closed
    // Use windowEntry.currentProjectId to get the current project (handles single-mode reuse)
    window.on('closed', () => {
      const currentProjectId = windowEntry.currentProjectId;

      // Verify this entry still owns the projectId in the Map
      // In single-mode, window may have been reused for a different project
      const entry = this.windows.get(currentProjectId);
      if (entry !== windowEntry) {
        // Window was reused - skip cleanup for this projectId
        return;
      }

      // Clear snap timer if exists
      const snapTimer = this.snapTimers.get(currentProjectId);
      if (snapTimer) {
        clearTimeout(snapTimer);
        this.snapTimers.delete(currentProjectId);
      }

      // Clear alwaysOnTop timer if exists
      this.clearAlwaysOnTopTimer(currentProjectId);

      // Remove from windows map
      this.windows.delete(currentProjectId);

      // Notify callback
      if (this.onWindowClosed) {
        this.onWindowClosed(currentProjectId);
      }

      // Rearrange remaining windows
      this.rearrangeWindows();
    });

    // Handle window move for snap to edges
    // Use windowEntry.currentProjectId to get the current project (handles single-mode reuse)
    window.on('move', () => {
      this.handleWindowMove(windowEntry.currentProjectId);
    });

    return { window, blocked: false, switchedProject: null };
  }

  /**
   * Arrange all windows by state and project name
   * Right side: active states (thinking, planning, working, notification)
   * Left side: inactive states (start, idle, done, sleep)
   * Within each group: sorted by project name (Z first = rightmost)
   */
  arrangeWindowsByName() {
    // Collect all windows with projectId and state
    const windowsList = [];
    for (const [projectId, entry] of this.windows) {
      if (entry.window && !entry.window.isDestroyed()) {
        const state = entry.state ? entry.state.state : 'idle';
        const isActive = ACTIVE_STATES.includes(state);
        windowsList.push({ projectId, entry, isActive });
      }
    }

    // Sort: active first (rightmost), then by name descending (Z first)
    windowsList.sort((a, b) => {
      // Active states come first (rightmost)
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }
      // Within same group, sort by name descending (Z first = rightmost)
      return b.projectId.localeCompare(a.projectId);
    });

    // Assign positions (index 0 = rightmost)
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
   * Update state for a project
   * Note: Entry object is mutated to preserve event handler closure references.
   * The state property is replaced with a new object for partial immutability.
   * @param {string} projectId
   * @param {Object} newState
   * @returns {boolean} - true if updated
   */
  updateState(projectId, newState) {
    const entry = this.windows.get(projectId);
    if (!entry) {
      return false;
    }

    // Mutate entry's state property (entry object must be preserved for event handler closures)
    entry.state = { ...newState };
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
    if (entry && entry.window && !entry.window.isDestroyed() && !entry.window.webContents.isDestroyed()) {
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
   * Clears all pending timers
   */
  cleanup() {
    for (const [, timerId] of this.snapTimers) {
      clearTimeout(timerId);
    }
    this.snapTimers.clear();

    for (const [, timerId] of this.alwaysOnTopTimers) {
      clearTimeout(timerId);
    }
    this.alwaysOnTopTimers.clear();
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
   * Show all windows
   * @returns {number} Number of windows shown
   */
  showAllWindows() {
    let count = 0;
    for (const [projectId, entry] of this.windows) {
      if (entry.window && !entry.window.isDestroyed()) {
        entry.window.showInactive();
        count++;
      }
    }
    return count;
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
   * Determine if a window should be always on top based on mode and state
   * @param {string|null} state - Current window state
   * @returns {boolean}
   */
  shouldBeAlwaysOnTop(state) {
    switch (this.alwaysOnTopMode) {
      case 'all':
        return true;
      case 'active-only':
        return state && ACTIVE_STATES.includes(state);
      case 'disabled':
      default:
        return false;
    }
  }

  /**
   * Get always on top mode
   * @returns {'active-only'|'all'|'disabled'}
   */
  getAlwaysOnTopMode() {
    return this.alwaysOnTopMode;
  }

  /**
   * Get all available always on top modes
   * @returns {Object}
   */
  getAlwaysOnTopModes() {
    return ALWAYS_ON_TOP_MODES;
  }

  /**
   * Set always on top mode and update all windows
   * @param {'active-only'|'all'|'disabled'} mode
   */
  setAlwaysOnTopMode(mode) {
    if (!ALWAYS_ON_TOP_MODES[mode]) return;

    this.alwaysOnTopMode = mode;
    this.store.set('alwaysOnTopMode', mode);

    // Update all windows based on new mode
    for (const [, entry] of this.windows) {
      if (entry.window && !entry.window.isDestroyed()) {
        const state = entry.state ? entry.state.state : null;
        const shouldBeOnTop = this.shouldBeAlwaysOnTop(state);
        entry.window.setAlwaysOnTop(shouldBeOnTop, ALWAYS_ON_TOP_LEVEL);
      }
    }
  }

  /**
   * Clear always on top timer for a specific project
   * @param {string} projectId
   */
  clearAlwaysOnTopTimer(projectId) {
    const timer = this.alwaysOnTopTimers.get(projectId);
    if (timer) {
      clearTimeout(timer);
      this.alwaysOnTopTimers.delete(projectId);
    }
  }

  /**
   * Update always on top for a specific window based on state
   * Active states (thinking, planning, working, notification) keep always on top
   * Inactive states (start, idle, done) have grace period before on top is disabled
   * Sleep state immediately disables on top (no grace period needed)
   * Respects alwaysOnTopMode setting
   * @param {string} projectId
   * @param {string} state
   */
  updateAlwaysOnTopByState(projectId, state) {
    const entry = this.windows.get(projectId);
    if (!entry || !entry.window || entry.window.isDestroyed()) {
      return;
    }

    const isActiveState = ACTIVE_STATES.includes(state);
    const isSleepState = state === 'sleep';

    // Always clear any pending timer first
    this.clearAlwaysOnTopTimer(projectId);

    if (this.alwaysOnTopMode === 'active-only') {
      if (isActiveState) {
        // Active state: immediately enable on top
        entry.window.setAlwaysOnTop(true, ALWAYS_ON_TOP_LEVEL);
      } else if (isSleepState) {
        // Sleep state: immediately disable on top (no grace period)
        entry.window.setAlwaysOnTop(false, ALWAYS_ON_TOP_LEVEL);
      } else {
        // Other inactive states (start, idle, done): grace period before disable
        entry.window.setAlwaysOnTop(true, ALWAYS_ON_TOP_LEVEL);

        const timer = setTimeout(() => {
          this.alwaysOnTopTimers.delete(projectId);
          // Re-check window still exists
          if (entry.window && !entry.window.isDestroyed()) {
            entry.window.setAlwaysOnTop(false, ALWAYS_ON_TOP_LEVEL);
          }
        }, ALWAYS_ON_TOP_GRACE_PERIOD);

        this.alwaysOnTopTimers.set(projectId, timer);
      }
    } else {
      // 'all' or 'disabled' mode: apply immediately without grace period
      const shouldBeOnTop = this.shouldBeAlwaysOnTop(state);
      entry.window.setAlwaysOnTop(shouldBeOnTop, ALWAYS_ON_TOP_LEVEL);
    }
  }

  /**
   * Get always on top setting (legacy compatibility)
   * @returns {boolean}
   * @deprecated Use getAlwaysOnTopMode() instead
   */
  getIsAlwaysOnTop() {
    return this.alwaysOnTopMode !== 'disabled';
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
   * Get terminal ID for a project
   * @param {string} projectId
   * @returns {string|null}
   */
  getTerminalId(projectId) {
    const entry = this.windows.get(projectId);
    return entry && entry.state ? entry.state.terminalId || null : null;
  }

  /**
   * Get project ID by webContents
   * @param {Electron.WebContents} webContents
   * @returns {string|null}
   */
  getProjectIdByWebContents(webContents) {
    for (const [projectId, entry] of this.windows) {
      if (entry.window && !entry.window.isDestroyed() &&
          entry.window.webContents === webContents) {
        return projectId;
      }
    }
    return null;
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
      alwaysOnTopMode: this.alwaysOnTopMode,
      platform: process.platform
    };
  }
}

module.exports = { MultiWindowManager };
