/**
 * Shared constants for Vibe Monitor (ES6)
 * Single source of truth for all constants
 */

// =============================================================================
// HTTP Server
// =============================================================================
export const HTTP_PORT = 19280;
export const MAX_PAYLOAD_SIZE = 10 * 1024; // 10KB limit for security

// =============================================================================
// Window Settings
// =============================================================================
export const WINDOW_WIDTH = 172;
export const WINDOW_HEIGHT = 348;
export const SNAP_THRESHOLD = 30;   // pixels from edge to trigger snap
export const SNAP_DEBOUNCE = 150;   // milliseconds
export const WINDOW_GAP = 10;       // Gap between windows (px)
export const MAX_WINDOWS = 5;       // Maximum simultaneous windows

// =============================================================================
// Timeouts (State Transitions)
// =============================================================================
export const IDLE_TIMEOUT = 60 * 1000;                  // 1 minute (start/done -> idle)
export const SLEEP_TIMEOUT = 5 * 60 * 1000;             // 5 minutes (idle -> sleep)
export const WINDOW_CLOSE_TIMEOUT = 10 * 60 * 1000;     // 10 minutes (sleep -> close window)
export const ALWAYS_ON_TOP_GRACE_PERIOD = 60 * 1000;    // 1 minute (grace period before disabling always on top)

// =============================================================================
// Character Settings
// =============================================================================
export const DEFAULT_CHARACTER = 'clawd';
export const CHAR_SIZE = 128;       // Character canvas size (128x128, doubled from 64)
export const SCALE = 2;             // Scale factor

// =============================================================================
// Colors
// =============================================================================
export const COLOR_EYE = '#000000';
export const COLOR_WHITE = '#FFFFFF';

// =============================================================================
// Floating Animation
// =============================================================================
export const FLOAT_AMPLITUDE_X = 3;
export const FLOAT_AMPLITUDE_Y = 5;
export const CHAR_X_BASE = 22;
export const CHAR_Y_BASE = 20;

// =============================================================================
// Animation Timing
// =============================================================================
export const FRAME_INTERVAL = 100;              // 100ms per frame
export const FLOAT_CYCLE_FRAMES = 32;           // ~3.2 seconds at 100ms tick
export const LOADING_DOT_COUNT = 4;
export const THINKING_ANIMATION_SLOWDOWN = 3;   // 3x slower for thinking state
export const BLINK_START_FRAME = 30;
export const BLINK_END_FRAME = 31;

// =============================================================================
// Text Truncation
// =============================================================================
export const PROJECT_NAME_MAX_LENGTH = 16;
export const PROJECT_NAME_TRUNCATE_AT = 13;
export const MODEL_NAME_MAX_LENGTH = 14;
export const MODEL_NAME_TRUNCATE_AT = 11;

// =============================================================================
// Matrix Effect
// =============================================================================
export const MATRIX_STREAM_DENSITY = 0.7;       // 70% of streams visible
export const MATRIX_SPEED_MIN = 1;
export const MATRIX_SPEED_MAX = 6;
export const MATRIX_COLUMN_WIDTH = 4;
export const MATRIX_FLICKER_PERIOD = 3;
export const MATRIX_TAIL_LENGTH_FAST = 8;       // speed > 3
export const MATRIX_TAIL_LENGTH_SLOW = 6;

// =============================================================================
// Window Modes
// =============================================================================
export const LOCK_MODES = {
  'first-project': 'First Project',
  'on-thinking': 'On Thinking'
};

export const ALWAYS_ON_TOP_MODES = {
  'active-only': 'Active Only',     // Only active state windows stay on top
  'all': 'All Windows',             // All windows stay on top
  'disabled': 'Disabled'            // No windows stay on top
};

// Active states that keep window always on top (when mode is 'active-only')
// Inactive states (start, idle, done, sleep) will disable always on top
export const ACTIVE_STATES = ['thinking', 'planning', 'working', 'notification'];
