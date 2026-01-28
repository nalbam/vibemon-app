/**
 * Shared constants for Vibe Monitor (CommonJS)
 * Single source of truth for all constants
 */

// =============================================================================
// HTTP Server
// =============================================================================
const HTTP_PORT = 19280;
const MAX_PAYLOAD_SIZE = 10 * 1024; // 10KB limit for security

// =============================================================================
// Window Settings
// =============================================================================
const WINDOW_WIDTH = 172;
const WINDOW_HEIGHT = 348;
const SNAP_THRESHOLD = 30;   // pixels from edge to trigger snap
const SNAP_DEBOUNCE = 150;   // milliseconds
const WINDOW_GAP = 10;       // Gap between windows (px)
const MAX_WINDOWS = 5;       // Maximum simultaneous windows

// =============================================================================
// Timeouts (State Transitions)
// =============================================================================
const IDLE_TIMEOUT = 60 * 1000;                  // 1 minute (start/done -> idle)
const SLEEP_TIMEOUT = 5 * 60 * 1000;             // 5 minutes (idle -> sleep)
const WINDOW_CLOSE_TIMEOUT = 10 * 60 * 1000;     // 10 minutes (sleep -> close window)
const ALWAYS_ON_TOP_GRACE_PERIOD = 60 * 1000;    // 1 minute (grace period before disabling always on top)

// =============================================================================
// Character Settings
// =============================================================================
const DEFAULT_CHARACTER = 'clawd';
const CHAR_SIZE = 128;       // Character canvas size (128x128, doubled from 64)
const SCALE = 2;             // Scale factor

// =============================================================================
// Colors
// =============================================================================
const COLOR_EYE = '#000000';
const COLOR_WHITE = '#FFFFFF';

// =============================================================================
// Floating Animation
// =============================================================================
const FLOAT_AMPLITUDE_X = 3;
const FLOAT_AMPLITUDE_Y = 5;
const CHAR_X_BASE = 22;
const CHAR_Y_BASE = 20;

// =============================================================================
// Animation Timing
// =============================================================================
const FRAME_INTERVAL = 100;              // 100ms per frame
const FLOAT_CYCLE_FRAMES = 32;           // ~3.2 seconds at 100ms tick
const LOADING_DOT_COUNT = 4;
const THINKING_ANIMATION_SLOWDOWN = 3;   // 3x slower for thinking state
const BLINK_START_FRAME = 30;
const BLINK_END_FRAME = 31;

// =============================================================================
// Text Truncation
// =============================================================================
const PROJECT_NAME_MAX_LENGTH = 16;
const PROJECT_NAME_TRUNCATE_AT = 13;
const MODEL_NAME_MAX_LENGTH = 14;
const MODEL_NAME_TRUNCATE_AT = 11;

// =============================================================================
// Matrix Effect
// =============================================================================
const MATRIX_STREAM_DENSITY = 0.7;       // 70% of streams visible
const MATRIX_SPEED_MIN = 1;
const MATRIX_SPEED_MAX = 6;
const MATRIX_COLUMN_WIDTH = 4;
const MATRIX_FLICKER_PERIOD = 3;
const MATRIX_TAIL_LENGTH_FAST = 8;       // speed > 3
const MATRIX_TAIL_LENGTH_SLOW = 6;

// =============================================================================
// Window Modes
// =============================================================================
const LOCK_MODES = {
  'first-project': 'First Project',
  'on-thinking': 'On Thinking'
};

const ALWAYS_ON_TOP_MODES = {
  'active-only': 'Active Only',     // Only active state windows stay on top
  'all': 'All Windows',             // All windows stay on top
  'disabled': 'Disabled'            // No windows stay on top
};

// Active states that keep window always on top (when mode is 'active-only')
// Inactive states (start, idle, done, sleep) will disable always on top
const ACTIVE_STATES = ['thinking', 'planning', 'working', 'notification'];

module.exports = {
  // HTTP Server
  HTTP_PORT,
  MAX_PAYLOAD_SIZE,

  // Window Settings
  WINDOW_WIDTH,
  WINDOW_HEIGHT,
  SNAP_THRESHOLD,
  SNAP_DEBOUNCE,
  WINDOW_GAP,
  MAX_WINDOWS,

  // Timeouts
  IDLE_TIMEOUT,
  SLEEP_TIMEOUT,
  WINDOW_CLOSE_TIMEOUT,
  ALWAYS_ON_TOP_GRACE_PERIOD,

  // Character Settings
  DEFAULT_CHARACTER,
  CHAR_SIZE,
  SCALE,

  // Colors
  COLOR_EYE,
  COLOR_WHITE,

  // Floating Animation
  FLOAT_AMPLITUDE_X,
  FLOAT_AMPLITUDE_Y,
  CHAR_X_BASE,
  CHAR_Y_BASE,

  // Animation Timing
  FRAME_INTERVAL,
  FLOAT_CYCLE_FRAMES,
  LOADING_DOT_COUNT,
  THINKING_ANIMATION_SLOWDOWN,
  BLINK_START_FRAME,
  BLINK_END_FRAME,

  // Text Truncation
  PROJECT_NAME_MAX_LENGTH,
  PROJECT_NAME_TRUNCATE_AT,
  MODEL_NAME_MAX_LENGTH,
  MODEL_NAME_TRUNCATE_AT,

  // Matrix Effect
  MATRIX_STREAM_DENSITY,
  MATRIX_SPEED_MIN,
  MATRIX_SPEED_MAX,
  MATRIX_COLUMN_WIDTH,
  MATRIX_FLICKER_PERIOD,
  MATRIX_TAIL_LENGTH_FAST,
  MATRIX_TAIL_LENGTH_SLOW,

  // Window Modes
  LOCK_MODES,
  ALWAYS_ON_TOP_MODES,
  ACTIVE_STATES
};
