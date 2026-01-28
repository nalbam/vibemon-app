/**
 * Shared configuration for Vibe Monitor (ES6)
 * JSON data loading and derived values
 *
 * Constants are in constants.js - re-exported here for convenience
 */

// JSON import (ES6) - Single source of truth
import states from './data/states.json' with { type: 'json' };
import characters from './data/characters.json' with { type: 'json' };
import texts from './data/texts.json' with { type: 'json' };

// Re-export all constants for backward compatibility
export * from './constants.js';

// =============================================================================
// State Data (from JSON)
// =============================================================================
export { states };

// Derived from states
export const VALID_STATES = Object.keys(states);
export const STATE_COLORS = Object.fromEntries(
  Object.entries(states).map(([k, v]) => [k, v.bgColor])
);

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
