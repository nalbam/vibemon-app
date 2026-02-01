/**
 * Shared configuration for Vibe Monitor (CommonJS)
 * JSON data loading and derived values
 *
 * Constants are in constants.cjs - re-exported here for convenience
 */

const path = require('path');
const os = require('os');

// JSON require (CommonJS) - Single source of truth
const states = require('./data/states.json');
const characters = require('./data/characters.json');

// Re-export all constants for backward compatibility
const constants = require('./constants.cjs');

// =============================================================================
// WebSocket Configuration (from environment variables)
// =============================================================================
const WS_URL = process.env.VIBEMON_WS_URL || null;
const WS_TOKEN = process.env.VIBEMON_WS_TOKEN || null;

// =============================================================================
// Paths
// =============================================================================
const STATS_CACHE_PATH = path.join(os.homedir(), '.claude', 'stats-cache.json');

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

  // Paths
  STATS_CACHE_PATH,

  // State data
  states,
  VALID_STATES,
  STATE_COLORS,

  // Character data
  CHARACTER_CONFIG,
  CHARACTER_NAMES,

  // WebSocket
  WS_URL,
  WS_TOKEN
};
