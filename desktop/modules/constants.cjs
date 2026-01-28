/**
 * Main process constants for Vibe Monitor
 */

// HTTP server
const HTTP_PORT = 19280;
const MAX_PAYLOAD_SIZE = 10 * 1024; // 10KB limit for security

// Window settings
const WINDOW_WIDTH = 172;
const WINDOW_HEIGHT = 348;
const SNAP_THRESHOLD = 30;  // pixels from edge to trigger snap
const SNAP_DEBOUNCE = 150;  // milliseconds
const WINDOW_GAP = 10;      // Gap between windows (px)
const MAX_WINDOWS = 5;      // Maximum simultaneous windows

// Timeouts
const WINDOW_CLOSE_TIMEOUT = 10 * 60 * 1000;  // 10 minutes (sleep -> close window)

// Lock modes (single window mode only)
const LOCK_MODES = {
  'first-project': 'First Project',
  'on-thinking': 'On Thinking'
};

// Active states that keep window always on top
// Inactive states (start, idle, done, sleep) will disable always on top
const ACTIVE_STATES = ['thinking', 'planning', 'working', 'notification'];

module.exports = {
  HTTP_PORT,
  MAX_PAYLOAD_SIZE,
  WINDOW_WIDTH,
  WINDOW_HEIGHT,
  SNAP_THRESHOLD,
  SNAP_DEBOUNCE,
  WINDOW_GAP,
  MAX_WINDOWS,
  WINDOW_CLOSE_TIMEOUT,
  LOCK_MODES,
  ACTIVE_STATES
};
