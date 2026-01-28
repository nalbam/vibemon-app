/**
 * Input validation functions for the Vibe Monitor
 */

const { VALID_STATES, CHARACTER_NAMES } = require('../shared/config.cjs');

// Validation limits
const PROJECT_MAX_LENGTH = 100;
const MEMORY_PATTERN = /^(\d{1,3})%$/;

/**
 * Validate state value
 * @param {string} state
 * @returns {{valid: boolean, error: string|null}}
 */
function validateState(state) {
  if (state === undefined) {
    return { valid: true, error: null };
  }
  if (!VALID_STATES.includes(state)) {
    return { valid: false, error: `Invalid state: ${state}. Valid states: ${VALID_STATES.join(', ')}` };
  }
  return { valid: true, error: null };
}

/**
 * Validate character value
 * @param {string} character
 * @returns {{valid: boolean, error: string|null}}
 */
function validateCharacter(character) {
  if (character === undefined) {
    return { valid: true, error: null };
  }
  if (!CHARACTER_NAMES.includes(character)) {
    return { valid: false, error: `Invalid character: ${character}. Valid characters: ${CHARACTER_NAMES.join(', ')}` };
  }
  return { valid: true, error: null };
}

/**
 * Validate project name
 * @param {string} project
 * @returns {{valid: boolean, error: string|null}}
 */
function validateProject(project) {
  if (project === undefined) {
    return { valid: true, error: null };
  }
  if (typeof project !== 'string') {
    return { valid: false, error: 'Project must be a string' };
  }
  if (project.length > PROJECT_MAX_LENGTH) {
    return { valid: false, error: `Project name exceeds ${PROJECT_MAX_LENGTH} characters` };
  }
  return { valid: true, error: null };
}

/**
 * Validate memory value (format: "N%" where N is 0-100)
 * @param {string} memory
 * @returns {{valid: boolean, error: string|null}}
 */
function validateMemory(memory) {
  if (memory === undefined || memory === '') {
    return { valid: true, error: null };
  }
  if (typeof memory !== 'string') {
    return { valid: false, error: 'Memory must be a string' };
  }
  const match = memory.match(MEMORY_PATTERN);
  if (!match) {
    return { valid: false, error: 'Memory must be in format "N%"' };
  }
  const value = parseInt(match[1], 10);
  if (value < 0 || value > 100) {
    return { valid: false, error: 'Memory percentage must be 0-100' };
  }
  return { valid: true, error: null };
}

/**
 * Validate status payload
 * @param {object} data
 * @returns {{valid: boolean, error: string|null}}
 */
function validateStatusPayload(data) {
  const stateResult = validateState(data.state);
  if (!stateResult.valid) return stateResult;

  const characterResult = validateCharacter(data.character);
  if (!characterResult.valid) return characterResult;

  const projectResult = validateProject(data.project);
  if (!projectResult.valid) return projectResult;

  const memoryResult = validateMemory(data.memory);
  if (!memoryResult.valid) return memoryResult;

  return { valid: true, error: null };
}

module.exports = {
  validateState,
  validateCharacter,
  validateProject,
  validateMemory,
  validateStatusPayload
};
