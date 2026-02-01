/**
 * Shared configuration for Vibe Monitor (ES6)
 * JSON data loading and derived values
 *
 * All constants loaded from data/constants.json (single source of truth)
 */

// JSON import (ES6) - Single source of truth
import states from './data/states.json' with { type: 'json' };
import characters from './data/characters.json' with { type: 'json' };
import texts from './data/texts.json' with { type: 'json' };
import constants from './data/constants.json' with { type: 'json' };

// =============================================================================
// Constants (from JSON)
// =============================================================================
export const {
  HTTP_PORT,
  MAX_PAYLOAD_SIZE,
  WINDOW_WIDTH,
  WINDOW_HEIGHT,
  SNAP_THRESHOLD,
  SNAP_DEBOUNCE,
  WINDOW_GAP,
  MAX_WINDOWS,
  MAX_PROJECT_LIST,
  IDLE_TIMEOUT,
  SLEEP_TIMEOUT,
  WINDOW_CLOSE_TIMEOUT,
  TRAY_ICON_SIZE,
  DEFAULT_CHARACTER,
  CHAR_SIZE,
  SCALE,
  COLOR_EYE,
  COLOR_WHITE,
  FLOAT_AMPLITUDE_X,
  FLOAT_AMPLITUDE_Y,
  CHAR_X_BASE,
  CHAR_Y_BASE,
  FRAME_INTERVAL,
  FLOAT_CYCLE_FRAMES,
  LOADING_DOT_COUNT,
  THINKING_ANIMATION_SLOWDOWN,
  BLINK_START_FRAME,
  BLINK_END_FRAME,
  PROJECT_NAME_MAX_LENGTH,
  PROJECT_NAME_TRUNCATE_AT,
  MODEL_NAME_MAX_LENGTH,
  MODEL_NAME_TRUNCATE_AT,
  MATRIX_STREAM_DENSITY,
  MATRIX_SPEED_MIN,
  MATRIX_SPEED_MAX,
  MATRIX_COLUMN_WIDTH,
  MATRIX_FLICKER_PERIOD,
  MATRIX_TAIL_LENGTH_FAST,
  MATRIX_TAIL_LENGTH_SLOW,
  LOCK_MODES,
  ALWAYS_ON_TOP_MODES,
  ACTIVE_STATES
} = constants;

// =============================================================================
// State Data (from JSON)
// =============================================================================
export { states };

// Derived from states
export const VALID_STATES = Object.keys(states);
export const STATE_COLORS = Object.fromEntries(
  Object.entries(states).map(([k, v]) => [k, v.bgColor])
);
// Dark background colors (states with white text need different contrast)
export const DARK_BG_COLORS = Object.values(states)
  .filter(s => s.textColor === '#FFFFFF')
  .map(s => s.bgColor);

// =============================================================================
// Character Data (from JSON)
// =============================================================================
export const CHARACTER_CONFIG = characters;
export const CHARACTER_NAMES = Object.keys(characters);

// =============================================================================
// Text Data (from JSON)
// =============================================================================
export const THINKING_TEXTS = texts.thinking;
export const PLANNING_TEXTS = texts.planning;
export const TOOL_TEXTS = texts.tools;
