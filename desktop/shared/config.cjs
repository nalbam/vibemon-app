/**
 * Shared configuration for Vibe Monitor (CommonJS)
 * Single source of truth for constants shared between main process and renderer
 */

// Valid states
const VALID_STATES = ['start', 'idle', 'thinking', 'planning', 'working', 'notification', 'done', 'sleep'];

// State colors for tray icon
const STATE_COLORS = {
  start: '#00CCCC',
  idle: '#00AA00',
  thinking: '#6633CC',
  planning: '#008888',
  working: '#0066CC',
  notification: '#FFCC00',
  done: '#00AA00',
  sleep: '#1a1a4e'
};

// Character configurations
const CHARACTER_CONFIG = {
  clawd: {
    name: 'clawd',
    displayName: 'Clawd',
    color: '#D97757',
    isGhost: false
  },
  kiro: {
    name: 'kiro',
    displayName: 'Kiro',
    color: '#FFFFFF',
    isGhost: true
  }
};

const CHARACTER_NAMES = Object.keys(CHARACTER_CONFIG);
const DEFAULT_CHARACTER = 'clawd';

// Colors
const COLOR_EYE = '#000000';
const COLOR_WHITE = '#FFFFFF';

// State timeouts
const IDLE_TIMEOUT = 60 * 1000;            // 1 minute (start/done -> idle)
const SLEEP_TIMEOUT = 5 * 60 * 1000;       // 5 minutes (idle -> sleep)

module.exports = {
  VALID_STATES,
  STATE_COLORS,
  CHARACTER_CONFIG,
  CHARACTER_NAMES,
  DEFAULT_CHARACTER,
  COLOR_EYE,
  COLOR_WHITE,
  IDLE_TIMEOUT,
  SLEEP_TIMEOUT
};
