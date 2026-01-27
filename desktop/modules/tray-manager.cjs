/**
 * System tray management for Vibe Monitor
 */

const { Tray, Menu, nativeImage, BrowserWindow } = require('electron');
const { createCanvas } = require('canvas');
const { STATE_COLORS, CHARACTER_CONFIG, CHARACTER_NAMES, DEFAULT_CHARACTER } = require('../shared/config.cjs');
const { LOCK_MODES, HTTP_PORT } = require('./constants.cjs');

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
  constructor(stateManager, windowManager, app) {
    this.tray = null;
    this.stateManager = stateManager;
    this.windowManager = windowManager;
    this.app = app;
  }

  createTray() {
    const state = this.stateManager.getState();
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
    const state = this.stateManager.getState();
    const icon = createTrayIcon(state.state, state.character);
    this.tray.setImage(icon);
  }

  buildProjectLockSubmenu() {
    const items = [];
    const lockMode = this.stateManager.getLockMode();
    const lockedProject = this.stateManager.getLockedProject();
    const projectList = this.stateManager.getProjectList();

    // Lock Mode selection
    items.push({
      label: 'Lock Mode',
      submenu: Object.entries(LOCK_MODES).map(([mode, label]) => ({
        label: label,
        type: 'radio',
        checked: lockMode === mode,
        click: () => {
          this.stateManager.setLockMode(mode);
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
            this.stateManager.lockProject(project);
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
        this.stateManager.unlockProject();
        this.updateMenu();
      }
    });

    return items;
  }

  buildMenuTemplate() {
    const state = this.stateManager.getState();
    const projectDisplay = state.project || '-';

    return [
      {
        label: `State: ${state.state}`,
        enabled: false
      },
      {
        label: `Character: ${state.character}`,
        enabled: false
      },
      {
        label: `Project: ${projectDisplay}`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Set State',
        submenu: [
          { label: 'Start', type: 'radio', checked: state.state === 'start', click: () => this.handleStateChange('start') },
          { label: 'Idle', type: 'radio', checked: state.state === 'idle', click: () => this.handleStateChange('idle') },
          { label: 'Thinking', type: 'radio', checked: state.state === 'thinking', click: () => this.handleStateChange('thinking') },
          { label: 'Planning', type: 'radio', checked: state.state === 'planning', click: () => this.handleStateChange('planning') },
          { label: 'Working', type: 'radio', checked: state.state === 'working', click: () => this.handleStateChange('working') },
          { label: 'Notification', type: 'radio', checked: state.state === 'notification', click: () => this.handleStateChange('notification') },
          { label: 'Done', type: 'radio', checked: state.state === 'done', click: () => this.handleStateChange('done') },
          { label: 'Sleep', type: 'radio', checked: state.state === 'sleep', click: () => this.handleStateChange('sleep') }
        ]
      },
      {
        label: 'Set Character',
        submenu: CHARACTER_NAMES.map(name => {
          const char = CHARACTER_CONFIG[name];
          return {
            label: char.displayName,
            type: 'radio',
            checked: state.character === name,
            click: () => this.handleCharacterChange(name)
          };
        })
      },
      {
        label: 'Project Lock',
        submenu: this.buildProjectLockSubmenu()
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
        label: 'Show Window',
        click: () => {
          this.windowManager.showWindow();
        }
      },
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

  handleStateChange(newState) {
    const result = this.stateManager.updateState({ state: newState });
    if (!result.blocked) {
      this.windowManager.sendToWindow('state-update', result.data);
      this.updateIcon();
    }
    this.updateMenu();
  }

  handleCharacterChange(character) {
    const currentState = this.stateManager.getState();
    const result = this.stateManager.updateState({ state: currentState.state, character });
    if (!result.blocked) {
      this.windowManager.sendToWindow('state-update', result.data);
      this.updateIcon();
    }
    this.updateMenu();
  }

  showContextMenu(sender) {
    const contextMenu = Menu.buildFromTemplate(this.buildMenuTemplate());
    contextMenu.popup(BrowserWindow.fromWebContents(sender));
  }
}

module.exports = { TrayManager, createTrayIcon };
