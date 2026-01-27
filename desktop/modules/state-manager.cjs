/**
 * State and timer management for Vibe Monitor
 */

const Store = require('electron-store');
const { IDLE_TIMEOUT, SLEEP_TIMEOUT, CHARACTER_CONFIG, DEFAULT_CHARACTER } = require('../shared/config.cjs');
const { LOCK_MODES, WINDOW_CLOSE_TIMEOUT } = require('./constants.cjs');

class StateManager {
  constructor() {
    // Persistent storage for settings
    this.store = new Store({
      defaults: {
        lockMode: 'on-thinking'
      }
    });

    // Current state
    this.currentState = 'start';
    this.currentCharacter = 'clawd';
    this.currentProject = '';
    this.currentTool = '';
    this.currentModel = '';
    this.currentMemory = '';

    // Project lock feature
    this.projectList = [];
    this.lockedProject = null;
    this.lockMode = this.store.get('lockMode');

    // Timers
    this.stateTimeoutTimer = null;
    this.windowCloseTimer = null;

    // Callbacks (set by main.js)
    this.onStateChange = null;
    this.onWindowClose = null;
  }

  // Getters
  getState() {
    return {
      state: this.currentState,
      character: this.currentCharacter,
      project: this.currentProject,
      tool: this.currentTool,
      model: this.currentModel,
      memory: this.currentMemory,
      locked: this.lockedProject,
      lockMode: this.lockMode,
      projects: this.projectList
    };
  }

  getLockMode() {
    return this.lockMode;
  }

  getLockModes() {
    return LOCK_MODES;
  }

  getLockedProject() {
    return this.lockedProject;
  }

  getProjectList() {
    return this.projectList;
  }

  // Timer management
  clearStateTimeout() {
    if (this.stateTimeoutTimer) {
      clearTimeout(this.stateTimeoutTimer);
      this.stateTimeoutTimer = null;
    }
  }

  clearWindowCloseTimer() {
    if (this.windowCloseTimer) {
      clearTimeout(this.windowCloseTimer);
      this.windowCloseTimer = null;
    }
  }

  setupWindowCloseTimer() {
    this.clearWindowCloseTimer();

    if (this.currentState === 'sleep' && this.onWindowClose) {
      this.windowCloseTimer = setTimeout(() => {
        this.onWindowClose();
      }, WINDOW_CLOSE_TIMEOUT);
    }
  }

  setupStateTimeout() {
    this.clearStateTimeout();
    this.clearWindowCloseTimer();

    if (this.currentState === 'start' || this.currentState === 'done') {
      // start/done -> idle after 1 minute
      this.stateTimeoutTimer = setTimeout(() => {
        this.updateState({ state: 'idle' });
      }, IDLE_TIMEOUT);
    } else if (this.currentState === 'idle' || this.currentState === 'notification') {
      // idle/notification -> sleep after 5 minutes
      this.stateTimeoutTimer = setTimeout(() => {
        this.updateState({ state: 'sleep' });
      }, SLEEP_TIMEOUT);
    } else if (this.currentState === 'sleep') {
      // sleep -> close window after 10 minutes
      this.setupWindowCloseTimer();
    }
  }

  // Project management
  addProjectToList(project) {
    if (project && !this.projectList.includes(project)) {
      this.projectList.push(project);
    }
  }

  lockProject(project) {
    if (!project) return false;

    const previousLocked = this.lockedProject;
    this.addProjectToList(project);
    this.lockedProject = project;

    // Transition to idle state when lock changes
    if (previousLocked !== project) {
      this.currentState = 'idle';
      this.currentProject = project;
      this.currentTool = '';
      this.currentModel = '';
      this.currentMemory = '';
      this.setupStateTimeout();

      if (this.onStateChange) {
        this.onStateChange({
          state: 'idle',
          project: project,
          tool: '',
          model: '',
          memory: ''
        }, true);  // true = needs window recreation
      }
      return true;
    }
    return false;
  }

  unlockProject() {
    this.lockedProject = null;
  }

  setLockMode(mode) {
    if (!LOCK_MODES[mode]) return false;

    this.lockMode = mode;
    this.lockedProject = null;  // Reset lock when mode changes
    this.store.set('lockMode', mode);
    return true;
  }

  // State update
  updateState(data) {
    const incomingProject = data.project;

    // Add incoming project to list
    if (incomingProject) {
      this.addProjectToList(incomingProject);
    }

    // Auto-lock based on lockMode
    if (this.lockMode === 'first-project') {
      if (incomingProject && this.projectList.length === 1 && this.lockedProject === null) {
        this.lockedProject = incomingProject;
      }
    } else if (this.lockMode === 'on-thinking') {
      if (data.state === 'thinking' && incomingProject) {
        this.lockedProject = incomingProject;
      }
    }

    // Check if update should be blocked due to project lock
    const isLocked = this.lockedProject !== null;
    const isDifferentProject = incomingProject && incomingProject !== this.lockedProject;
    const shouldBlockUpdate = isLocked && isDifferentProject;

    if (shouldBlockUpdate) {
      return { blocked: true, menuUpdateOnly: true };
    }

    // Ignore updates without state
    if (data.state === undefined) {
      return { blocked: true, menuUpdateOnly: false };
    }

    // Update state
    this.currentState = data.state;
    if (data.character !== undefined) {
      this.currentCharacter = CHARACTER_CONFIG[data.character] ? data.character : DEFAULT_CHARACTER;
    }

    // Clear model and memory when project changes
    if (data.project !== undefined && data.project !== this.currentProject) {
      this.currentModel = '';
      this.currentMemory = '';
      data.model = '';
      data.memory = '';
    }

    if (data.project !== undefined) this.currentProject = data.project;
    if (data.tool !== undefined) this.currentTool = data.tool;
    if (data.model !== undefined) this.currentModel = data.model;
    if (data.memory !== undefined) this.currentMemory = data.memory;

    // Set up state timeout for auto-transitions
    this.setupStateTimeout();

    return {
      blocked: false,
      needsWindowRecreation: data.state !== 'sleep',
      data
    };
  }

  // Cleanup
  cleanup() {
    this.clearStateTimeout();
    this.clearWindowCloseTimer();
  }
}

module.exports = { StateManager };
