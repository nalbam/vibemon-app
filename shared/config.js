// Character size (128x128, doubled from 64)
export const CHAR_SIZE = 128;
export const SCALE = 2;

// Colors
export const COLOR_EYE = '#000000';
export const COLOR_WHITE = '#FFFFFF';

// State configuration
export const states = {
  session_start: {
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
  tool_done: {
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

// Sleep timeout (10 minutes)
export const SLEEP_TIMEOUT = 600 * 1000;
