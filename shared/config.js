// Character size (128x128, doubled from 64)
export const CHAR_SIZE = 128;
export const SCALE = 2;

// Colors
export const COLOR_EYE = '#000000';
export const COLOR_WHITE = '#FFFFFF';

// State configuration
export const states = {
  start: {
    bgColor: '#00CCCC',
    text: 'Hello!',
    eyeType: 'sparkle',
    showLoading: false,
    textColor: '#000000'
  },
  idle: {
    bgColor: '#00AA00',
    text: 'Ready',
    eyeType: 'normal',
    showLoading: false,
    textColor: '#FFFFFF'
  },
  thinking: {
    bgColor: '#6633CC',
    text: 'Thinking',
    eyeType: 'thinking',
    showLoading: true,
    textColor: '#FFFFFF'
  },
  working: {
    bgColor: '#0066CC',
    text: 'Working',
    eyeType: 'focused',
    showLoading: true,
    textColor: '#FFFFFF'
  },
  notification: {
    bgColor: '#FFCC00',
    text: 'Input?',
    eyeType: 'alert',
    showLoading: false,
    textColor: '#000000'
  },
  done: {
    bgColor: '#00AA00',
    text: 'Done!',
    eyeType: 'happy',
    showLoading: false,
    textColor: '#FFFFFF'
  },
  sleep: {
    bgColor: '#1a1a4e',
    text: 'Zzz...',
    eyeType: 'sleep',
    showLoading: false,
    textColor: '#FFFFFF'
  }
};

// Character configurations - Single source of truth
export const CHARACTER_CONFIG = {
  clawd: {
    name: 'clawd',
    displayName: 'Clawd',
    color: '#E07B39',
    body: { x: 6, y: 8, w: 52, h: 36 },
    arms: { left: { x: 0, y: 22, w: 6, h: 10 }, right: { x: 58, y: 22, w: 6, h: 10 } },
    legs: [
      { x: 10, y: 44, w: 6, h: 12 },
      { x: 18, y: 44, w: 6, h: 12 },
      { x: 40, y: 44, w: 6, h: 12 },
      { x: 48, y: 44, w: 6, h: 12 }
    ],
    tail: null,
    eyes: { left: { x: 14, y: 22 }, right: { x: 44, y: 22 }, size: 6 },
    isGhost: false
  },
  kiro: {
    name: 'kiro',
    displayName: 'Kiro',
    color: '#FFFFFF',
    // Sprite-based rendering (see sprites.js) - 64x64 sprite
    body: { x: 10, y: 3, w: 44, h: 30 },
    arms: null,
    legs: [],
    tail: [],
    // Eyes positioned in sprite (drawn by drawEyes, not in sprite)
    eyes: { left: { x: 29, y: 21 }, right: { x: 39, y: 21 }, w: 5, h: 8 },
    isGhost: true
  }
};

export const CHARACTER_NAMES = Object.keys(CHARACTER_CONFIG);
export const DEFAULT_CHARACTER = 'clawd';

// Thinking state texts (random selection)
export const THINKING_TEXTS = ['Thinking', 'Hmm', 'Let me see'];

// Tool-based status texts for working state (lowercase keys)
export const TOOL_TEXTS = {
  'bash': ['Running', 'Executing', 'Processing'],
  'read': ['Reading', 'Scanning', 'Checking'],
  'edit': ['Editing', 'Modifying', 'Fixing'],
  'write': ['Writing', 'Creating', 'Saving'],
  'grep': ['Searching', 'Finding', 'Looking'],
  'glob': ['Scanning', 'Browsing', 'Finding'],
  'task': ['Thinking', 'Working', 'Planning'],
  'webfetch': ['Fetching', 'Loading', 'Getting'],
  'websearch': ['Searching', 'Googling', 'Looking'],
  'default': ['Working', 'Busy', 'Coding']
};

// Floating animation constants
export const FLOAT_AMPLITUDE_X = 3;
export const FLOAT_AMPLITUDE_Y = 5;
export const CHAR_X_BASE = 22;
export const CHAR_Y_BASE = 20;

// State timeouts
export const DONE_TO_IDLE_TIMEOUT = 60 * 1000;    // 1 minute
export const SLEEP_TIMEOUT = 600 * 1000;          // 10 minutes

// Animation constants
export const FRAME_INTERVAL = 100;                // 100ms per frame
export const FLOAT_CYCLE_FRAMES = 32;             // ~3.2 seconds at 100ms tick
export const LOADING_DOT_COUNT = 4;
export const THINKING_ANIMATION_SLOWDOWN = 3;     // 3x slower for thinking state
export const BLINK_START_FRAME = 30;
export const BLINK_END_FRAME = 31;

// Text truncation limits
export const PROJECT_NAME_MAX_LENGTH = 16;
export const PROJECT_NAME_TRUNCATE_AT = 13;
export const MODEL_NAME_MAX_LENGTH = 14;
export const MODEL_NAME_TRUNCATE_AT = 11;

// Matrix effect constants
export const MATRIX_STREAM_DENSITY = 0.7;         // 70% of streams visible
export const MATRIX_SPEED_MIN = 1;
export const MATRIX_SPEED_MAX = 6;
export const MATRIX_COLUMN_WIDTH = 4;
export const MATRIX_FLICKER_PERIOD = 3;
export const MATRIX_TAIL_LENGTH_FAST = 8;         // speed > 3
export const MATRIX_TAIL_LENGTH_SLOW = 6;
