/**
 * Shared configuration for Vibe Monitor (CommonJS)
 * JSON data loading and derived values
 *
 * Constants are in constants.cjs - re-exported here for convenience
 */

// JSON require (CommonJS) - Single source of truth
const states = require('./data/states.json');
const characters = require('./data/characters.json');

// Re-export all constants for backward compatibility
const constants = require('./constants.cjs');

// =============================================================================
// State Data (from JSON)
// =============================================================================

// Derived from states
const VALID_STATES = Object.keys(states);
const STATE_COLORS = Object.fromEntries(
  Object.entries(states).map(([k, v]) => [k, v.bgColor])
);

// =============================================================================
// Character Data (from JSON)
// =============================================================================
const CHARACTER_CONFIG = characters;
const CHARACTER_NAMES = Object.keys(characters);

module.exports = {
  // Re-export all constants
  ...constants,

  // State data
  states,
  VALID_STATES,
  STATE_COLORS,

  // Character data
  CHARACTER_CONFIG,
  CHARACTER_NAMES
};
