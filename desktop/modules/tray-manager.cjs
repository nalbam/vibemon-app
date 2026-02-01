/**
 * System tray management for Vibe Monitor
 */

const { Tray, Menu, nativeImage, BrowserWindow } = require('electron');
const { createCanvas } = require('canvas');
const fs = require('fs');
const {
  STATE_COLORS, CHARACTER_CONFIG, DEFAULT_CHARACTER,
  HTTP_PORT, LOCK_MODES, ALWAYS_ON_TOP_MODES,
  VALID_STATES, CHARACTER_NAMES, TRAY_ICON_SIZE,
  STATS_CACHE_PATH
} = require('../shared/config.cjs');

const COLOR_EYE = '#000000';

// Tray icon cache for performance
const trayIconCache = new Map();

/**
 * Create tray icon with state-based background color using canvas
 */
function createTrayIcon(state, character = 'clawd') {
  const cacheKey = `${state}-${character}`;

  // Return cached icon if available
  if (trayIconCache.has(cacheKey)) {
    return trayIconCache.get(cacheKey);
  }

  const size = TRAY_ICON_SIZE;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  const bgColor = STATE_COLORS[state] || STATE_COLORS.idle;
  const charConfig = CHARACTER_CONFIG[character] || CHARACTER_CONFIG[DEFAULT_CHARACTER];
  const charColor = charConfig.color;
  const charName = charConfig.name;

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

  if (charName === 'kiro') {
    // Draw ghost character for kiro
    rect(6, 4, 10, 2, charColor);   // Rounded top
    rect(5, 6, 12, 8, charColor);   // Main body
    rect(5, 14, 4, 3, charColor);   // Left wave
    rect(9, 15, 4, 2, charColor);   // Middle wave
    rect(13, 14, 4, 3, charColor);  // Right wave
    rect(7, 8, 2, 2, COLOR_EYE);    // Left eye
    rect(13, 8, 2, 2, COLOR_EYE);   // Right eye
  } else if (charName === 'claw') {
    // Draw claw character (red with antennae)
    rect(8, 2, 2, 4, charColor);    // Left antenna
    rect(12, 2, 2, 4, charColor);   // Right antenna
    rect(5, 6, 12, 10, charColor);  // Body
    rect(6, 16, 3, 3, charColor);   // Left leg
    rect(13, 16, 3, 3, charColor);  // Right leg
    rect(7, 10, 2, 2, '#40E0D0');   // Left eye (cyan)
    rect(13, 10, 2, 2, '#40E0D0');  // Right eye (cyan)
  } else {
    // Draw clawd character (default)
    rect(4, 6, 14, 8, charColor);   // Body
    rect(2, 8, 2, 3, charColor);    // Left arm
    rect(18, 8, 2, 3, charColor);   // Right arm
    rect(5, 14, 2, 4, charColor);   // Left outer leg
    rect(8, 14, 2, 4, charColor);   // Left inner leg
    rect(12, 14, 2, 4, charColor);  // Right inner leg
    rect(15, 14, 2, 4, charColor);  // Right outer leg
    rect(6, 9, 2, 2, COLOR_EYE);    // Left eye
    rect(14, 9, 2, 2, COLOR_EYE);   // Right eye
  }

  // Convert canvas to PNG buffer and create nativeImage
  const pngBuffer = canvas.toBuffer('image/png');
  const icon = nativeImage.createFromBuffer(pngBuffer);

  // Cache the icon for future use
  trayIconCache.set(cacheKey, icon);

  return icon;
}

class TrayManager {
  constructor(windowManager, app, wsClient = null) {
    this.tray = null;
    this.windowManager = windowManager;
    this.app = app;
    this.wsClient = wsClient;
    this.statsWindow = null;
  }

  /**
   * Set WebSocket client reference (can be set after construction)
   * @param {WsClient} wsClient
   */
  setWsClient(wsClient) {
    this.wsClient = wsClient;
  }

  openStatsWindow() {
    // If window exists, close it first
    if (this.statsWindow && !this.statsWindow.isDestroyed()) {
      this.statsWindow.close();
      this.statsWindow = null;
    }

    // Create new stats window (frameless like monitor window)
    this.statsWindow = new BrowserWindow({
      width: 640,
      height: 475,
      frame: false,
      transparent: true,
      resizable: false,
      hasShadow: true,
      alwaysOnTop: false,
      skipTaskbar: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    this.statsWindow.loadURL(`http://127.0.0.1:${HTTP_PORT}/stats`);

    this.statsWindow.on('closed', () => {
      this.statsWindow = null;
    });

    // Close on blur (lose focus)
    this.statsWindow.on('blur', () => {
      if (this.statsWindow && !this.statsWindow.isDestroyed()) {
        this.statsWindow.close();
      }
    });
  }

  /**
   * Get state from first window or return default state
   * @returns {Object}
   */
  getFirstWindowState() {
    const projectIds = this.windowManager.getProjectIds();
    if (projectIds.length === 0) {
      return { state: 'idle', character: DEFAULT_CHARACTER, project: null };
    }
    const firstProjectId = projectIds[0];
    const state = this.windowManager.getState(firstProjectId);
    return state || { state: 'idle', character: DEFAULT_CHARACTER, project: firstProjectId };
  }

  createTray() {
    const state = this.getFirstWindowState();
    const icon = createTrayIcon(state.state, state.character);
    this.tray = new Tray(icon);
    this.tray.setToolTip('Vibe Monitor');
    this.updateMenu();

    // Left-click to show menu (Windows support)
    this.tray.on('click', () => {
      this.tray.popUpContextMenu();
    });

    return this.tray;
  }

  updateIcon() {
    if (!this.tray) return;
    const state = this.getFirstWindowState();
    const icon = createTrayIcon(state.state, state.character);
    this.tray.setImage(icon);
  }

  buildWindowsSubmenu() {
    const projectIds = this.windowManager.getProjectIds();

    if (projectIds.length === 0) {
      return [{ label: 'No windows', enabled: false }];
    }

    const items = projectIds.map(projectId => {
      const state = this.windowManager.getState(projectId);
      const currentState = state ? state.state : 'idle';
      const currentCharacter = state ? state.character : DEFAULT_CHARACTER;
      return {
        label: `${projectId} (${currentState})`,
        submenu: [
          { label: 'Show', click: () => this.windowManager.showWindow(projectId) },
          { label: 'Close', click: () => this.windowManager.closeWindow(projectId) },
          { type: 'separator' },
          {
            label: 'State',
            submenu: VALID_STATES.map(s => ({
              label: s,
              type: 'radio',
              checked: currentState === s,
              click: () => {
                // Re-fetch state at click time to avoid stale closure reference
                const currentState = this.windowManager.getState(projectId);
                if (!currentState) return;
                const newState = { ...currentState, state: s };
                this.windowManager.updateState(projectId, newState);
                this.windowManager.sendToWindow(projectId, 'state-update', newState);
                this.windowManager.updateAlwaysOnTopByState(projectId, s);
                this.updateMenu();
                this.updateIcon();
              }
            }))
          },
          {
            label: 'Character',
            submenu: CHARACTER_NAMES.map(c => ({
              label: c,
              type: 'radio',
              checked: currentCharacter === c,
              click: () => {
                // Re-fetch state at click time to avoid stale closure reference
                const currentState = this.windowManager.getState(projectId);
                if (!currentState) return;
                const newState = { ...currentState, character: c };
                this.windowManager.updateState(projectId, newState);
                this.windowManager.sendToWindow(projectId, 'state-update', newState);
                this.updateMenu();
                this.updateIcon();
              }
            }))
          }
        ]
      };
    });

    items.push({ type: 'separator' });
    items.push({
      label: 'Show All',
      enabled: projectIds.length > 0,
      click: () => this.windowManager.showAllWindows()
    });
    items.push({
      label: 'Close All',
      enabled: projectIds.length > 0,
      click: () => this.windowManager.closeAllWindows()
    });

    return items;
  }

  buildProjectLockSubmenu() {
    const items = [];
    const lockMode = this.windowManager.getLockMode();
    const lockedProject = this.windowManager.getLockedProject();
    const projectList = this.windowManager.getProjectList();

    // Lock Mode selection
    items.push({
      label: 'Lock Mode',
      submenu: Object.entries(LOCK_MODES).map(([mode, label]) => ({
        label: label,
        type: 'radio',
        checked: lockMode === mode,
        click: () => {
          this.windowManager.setLockMode(mode);
          this.updateMenu();
        }
      }))
    });

    items.push({ type: 'separator' });

    if (projectList.length === 0) {
      items.push({
        label: 'No projects',
        enabled: false
      });
    } else {
      // List all projects sorted by name
      const sortedProjects = [...projectList].sort((a, b) => a.localeCompare(b));
      sortedProjects.forEach(project => {
        const isLocked = project === lockedProject;
        items.push({
          label: project,
          type: 'radio',
          checked: isLocked,
          click: () => {
            this.windowManager.lockProject(project);
            this.updateMenu();
            this.updateIcon();
          }
        });
      });

      items.push({ type: 'separator' });
    }

    // Unlock option
    items.push({
      label: 'Unlock',
      enabled: lockedProject !== null,
      click: () => {
        this.windowManager.unlockProject();
        this.updateMenu();
      }
    });

    return items;
  }

  buildAlwaysOnTopSubmenu() {
    const currentMode = this.windowManager.getAlwaysOnTopMode();

    return Object.entries(ALWAYS_ON_TOP_MODES).map(([mode, label]) => ({
      label: label,
      type: 'radio',
      checked: currentMode === mode,
      click: () => {
        this.windowManager.setAlwaysOnTopMode(mode);
        this.updateMenu();
      }
    }));
  }

  buildWebSocketStatusMenu() {
    if (!this.wsClient) {
      return [];
    }

    const status = this.wsClient.getStatus();
    let statusLabel;
    let statusIcon;

    switch (status) {
      case 'connected':
        statusIcon = '●';
        statusLabel = 'WebSocket: Connected';
        break;
      case 'connecting':
        statusIcon = '○';
        statusLabel = 'WebSocket: Connecting...';
        break;
      case 'disconnected':
        statusIcon = '○';
        statusLabel = 'WebSocket: Disconnected';
        break;
      case 'not-configured':
      default:
        return [];  // Don't show if not configured
    }

    return [
      {
        label: `${statusIcon} ${statusLabel}`,
        enabled: false
      }
    ];
  }

  buildMenuTemplate() {
    const projectIds = this.windowManager.getProjectIds();
    const windowCount = projectIds.length;
    const state = this.getFirstWindowState();

    // Build status display based on window count
    let statusLabel;
    if (windowCount === 0) {
      statusLabel = 'No active windows';
    } else if (windowCount === 1) {
      statusLabel = `${state.project || 'Unknown'}: ${state.state}`;
    } else {
      statusLabel = `${windowCount} windows active`;
    }

    return [
      {
        label: statusLabel,
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Windows',
        submenu: this.buildWindowsSubmenu()
      },
      { type: 'separator' },
      {
        label: 'Always on Top',
        submenu: this.buildAlwaysOnTopSubmenu()
      },
      {
        label: 'Rearrange',
        enabled: windowCount > 1 && this.windowManager.isMultiMode(),
        click: () => {
          this.windowManager.arrangeWindowsByName();
        }
      },
      {
        label: 'Multi-Window Mode',
        type: 'checkbox',
        checked: this.windowManager.isMultiMode(),
        click: () => {
          const newMode = this.windowManager.isMultiMode() ? 'single' : 'multi';
          this.windowManager.setWindowMode(newMode);
          this.updateMenu();
        }
      },
      ...(this.windowManager.isMultiMode() ? [] : [{
        label: 'Project Lock',
        submenu: this.buildProjectLockSubmenu()
      }]),
      { type: 'separator' },
      {
        label: 'Claude Stats',
        enabled: fs.existsSync(STATS_CACHE_PATH),
        click: () => this.openStatsWindow()
      },
      { type: 'separator' },
      ...this.buildWebSocketStatusMenu(),
      {
        label: `HTTP Server: localhost:${HTTP_PORT}`,
        enabled: false
      },
      {
        label: `Version: ${this.app.getVersion()}`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          this.app.quit();
        }
      }
    ];
  }

  updateMenu() {
    if (!this.tray) return;
    const contextMenu = Menu.buildFromTemplate(this.buildMenuTemplate());
    this.tray.setContextMenu(contextMenu);
  }

  showContextMenu(sender) {
    const contextMenu = Menu.buildFromTemplate(this.buildMenuTemplate());
    const win = BrowserWindow.fromWebContents(sender);
    if (win && !win.isDestroyed()) {
      contextMenu.popup({ window: win });
    } else {
      // Fallback: popup without specific window
      contextMenu.popup();
    }
  }

  /**
   * Cleanup resources on app quit
   */
  cleanup() {
    // Clear tray icon cache to free memory
    trayIconCache.clear();
    if (this.statsWindow && !this.statsWindow.isDestroyed()) {
      this.statsWindow.close();
      this.statsWindow = null;
    }
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

module.exports = { TrayManager, createTrayIcon };
