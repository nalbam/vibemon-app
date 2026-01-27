/**
 * System tray management for Vibe Monitor
 */

const { Tray, Menu, nativeImage, BrowserWindow } = require('electron');
const { createCanvas } = require('canvas');
const { STATE_COLORS, CHARACTER_CONFIG, DEFAULT_CHARACTER } = require('../shared/config.cjs');
const { HTTP_PORT, LOCK_MODES } = require('./constants.cjs');

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
    rect(6, 4, 10, 2, charColor);   // Rounded top
    rect(5, 6, 12, 8, charColor);   // Main body
    rect(5, 14, 4, 3, charColor);   // Left wave
    rect(9, 15, 4, 2, charColor);   // Middle wave
    rect(13, 14, 4, 3, charColor);  // Right wave
    rect(7, 8, 2, 2, COLOR_EYE);    // Left eye
    rect(13, 8, 2, 2, COLOR_EYE);   // Right eye
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
  constructor(windowManager, app) {
    this.tray = null;
    this.windowManager = windowManager;
    this.app = app;
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
      const stateLabel = state ? state.state : 'unknown';
      return {
        label: `${projectId} (${stateLabel})`,
        submenu: [
          { label: 'Show', click: () => this.windowManager.showWindow(projectId) },
          { label: 'Close', click: () => this.windowManager.closeWindow(projectId) }
        ]
      };
    });

    items.push({ type: 'separator' });
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
        type: 'checkbox',
        checked: this.windowManager.getIsAlwaysOnTop(),
        click: () => {
          this.windowManager.toggleAlwaysOnTop();
        }
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
    if (win) {
      contextMenu.popup({ window: win });
    } else {
      // Fallback: popup without specific window
      contextMenu.popup();
    }
  }
}

module.exports = { TrayManager, createTrayIcon };
