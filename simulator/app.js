import {
  states, CHARACTER_CONFIG, CHARACTER_NAMES, DEFAULT_CHARACTER,
  FLOAT_AMPLITUDE_X, FLOAT_AMPLITUDE_Y, CHAR_X_BASE, CHAR_Y_BASE,
  DONE_TO_IDLE_TIMEOUT, SLEEP_TIMEOUT
} from '../shared/config.js';
import { getThinkingText, getWorkingText, updateMemoryBar } from '../shared/utils.js';
import { initRenderer, drawCharacter } from '../shared/character.js';
import { drawInfoIcons } from '../shared/icons.js';

// Current state
let currentState = 'start';
let currentCharacter = 'clawd';
let animFrame = 0;
let blinkFrame = 0;
let iconType = 'emoji';
let lastActivityTime = Date.now();
let lastDoneTime = null;

// Canvas
let canvas, ctx;

// Calculate floating X offset using cosine wave
function getFloatOffsetX() {
  const angle = (animFrame % 32) * (2.0 * Math.PI / 32.0);
  return Math.cos(angle) * FLOAT_AMPLITUDE_X;
}

// Calculate floating Y offset using sine wave
function getFloatOffsetY() {
  const angle = (animFrame % 32) * (2.0 * Math.PI / 32.0);
  return Math.sin(angle) * FLOAT_AMPLITUDE_Y;
}

// Update canvas position for floating effect
function updateFloatingPosition() {
  const offsetX = getFloatOffsetX();
  const offsetY = getFloatOffsetY();
  canvas.style.left = (CHAR_X_BASE + offsetX) + 'px';
  canvas.style.top = (CHAR_Y_BASE + offsetY) + 'px';
}

// Initialize
function init() {
  canvas = document.getElementById('character-canvas');
  ctx = canvas.getContext('2d');
  initRenderer(ctx);

  // Random state selection
  const stateNames = Object.keys(states);
  const randomState = stateNames[Math.floor(Math.random() * stateNames.length)];
  currentState = randomState;

  // Random character selection
  const randomCharacter = CHARACTER_NAMES[Math.floor(Math.random() * CHARACTER_NAMES.length)];
  currentCharacter = randomCharacter;

  // Populate character dropdown from CHARACTER_CONFIG
  const characterSelect = document.getElementById('character-select');
  CHARACTER_NAMES.forEach(name => {
    const char = CHARACTER_CONFIG[name];
    const option = document.createElement('option');
    option.value = name;
    option.textContent = char.displayName || name;
    if (name === randomCharacter) option.selected = true;
    characterSelect.appendChild(option);
  });

  // Set random initial memory value (10-90%)
  const randomMemory = Math.floor(Math.random() * 81) + 10;
  document.getElementById('memory-input').value = randomMemory;
  document.getElementById('memory-display').textContent = randomMemory + '%';

  updateDisplay();
  startAnimation();
}

// Set state
window.setState = function(state) {
  currentState = state;
  lastActivityTime = Date.now();
  lastDoneTime = (state === 'done') ? Date.now() : null;
  updateDisplay();
};

// Set character
window.setCharacter = function(character) {
  currentCharacter = CHARACTER_CONFIG[character] ? character : DEFAULT_CHARACTER;
  updateDisplay();
};

// Set icon type
window.setIconType = function(type) {
  iconType = type;
  updateDisplay();
};

// Update memory slider display
window.updateMemorySlider = function(value) {
  document.getElementById('memory-display').textContent = value + '%';
  updateDisplay();
};

// Update display
window.updateDisplay = function() {
  const state = states[currentState];
  const display = document.getElementById('display');
  const statusText = document.getElementById('status-text');
  const loadingDots = document.getElementById('loading-dots');
  const toolLine = document.getElementById('tool-line');
  const modelLine = document.getElementById('model-line');
  const memoryLine = document.getElementById('memory-line');
  const projectValue = document.getElementById('project-value');
  const toolValue = document.getElementById('tool-value');
  const modelValue = document.getElementById('model-value');
  const memoryValue = document.getElementById('memory-value');
  const currentStateDisplay = document.getElementById('current-state-display');
  const jsonPreview = document.getElementById('json-preview');

  // Update background
  display.style.background = state.bgColor;

  // Update text and color
  const toolName = document.getElementById('tool-input').value;
  if (currentState === 'thinking') {
    statusText.textContent = getThinkingText();
  } else if (currentState === 'working') {
    statusText.textContent = getWorkingText(toolName);
  } else {
    statusText.textContent = state.text;
  }
  statusText.style.color = state.textColor;

  // Update loading dots visibility
  loadingDots.style.display = state.showLoading ? 'flex' : 'none';

  // Update tool line visibility
  toolLine.style.display = currentState === 'working' ? 'block' : 'none';

  // Update values from inputs
  const projectName = document.getElementById('project-input').value;
  const modelName = document.getElementById('model-input').value;
  const memoryUsage = document.getElementById('memory-input').value + '%';
  projectValue.textContent = projectName.length > 16 ? projectName.substring(0, 13) + '...' : projectName;
  toolValue.textContent = toolName;
  modelValue.textContent = modelName.length > 14 ? modelName.substring(0, 11) + '...' : modelName;
  memoryValue.textContent = memoryUsage;

  // Update model/memory visibility (hide memory on start state)
  modelLine.style.display = modelName ? 'block' : 'none';
  const showMemory = currentState !== 'start' && memoryUsage;
  memoryLine.style.display = showMemory ? 'block' : 'none';

  // Update memory bar (hide on start state)
  updateMemoryBar(showMemory ? memoryUsage : null, state.bgColor);

  // Update all text colors based on state
  document.querySelectorAll('.info-text').forEach(el => {
    el.style.color = state.textColor;
  });
  document.querySelectorAll('.info-value').forEach(el => {
    el.style.color = state.textColor;
  });

  // Draw info icons
  drawInfoIcons(state.textColor, state.bgColor, iconType === 'emoji');

  // Update current state display
  currentStateDisplay.textContent = currentState;

  // Update JSON preview
  const json = {
    state: currentState,
    event: getEventName(currentState),
    tool: currentState === 'working' ? toolName : '',
    project: projectName,
    model: modelName,
    memory: memoryUsage,
    character: currentCharacter
  };
  jsonPreview.textContent = JSON.stringify(json, null, 2);

  // Draw character
  drawCharacter(state.eyeType, currentState, currentCharacter, animFrame);
};

// Get event name for state
function getEventName(state) {
  const events = {
    start: 'SessionStart',
    idle: 'Stop',
    thinking: 'UserPromptSubmit',
    working: 'PreToolUse',
    notification: 'Notification',
    done: 'PostToolUse',
    sleep: 'Sleep'
  };
  return events[state] || 'Unknown';
}

// Update loading dots
function updateLoadingDots() {
  const dots = document.querySelectorAll('.dot');
  const activeIndex = animFrame % 4;
  dots.forEach((dot, i) => {
    dot.classList.toggle('dim', i !== activeIndex);
  });
}

// Check state timeouts
function checkStateTimeouts() {
  const now = Date.now();

  // done -> idle after 1 minute
  if (currentState === 'done' && lastDoneTime) {
    if (now - lastDoneTime >= DONE_TO_IDLE_TIMEOUT) {
      currentState = 'idle';
      lastDoneTime = null;
      lastActivityTime = now;
      updateDisplay();
      return;
    }
  }

  // idle/start -> sleep after 10 minutes
  if (currentState === 'start' || currentState === 'idle') {
    if (now - lastActivityTime >= SLEEP_TIMEOUT) {
      currentState = 'sleep';
      updateDisplay();
    }
  }
}

// Animation loop
function startAnimation() {
  setInterval(() => {
    animFrame++;

    updateFloatingPosition();

    if (currentState === 'start') {
      drawCharacter('sparkle', currentState, currentCharacter, animFrame);
    }

    if (currentState === 'thinking') {
      updateLoadingDots();
      drawCharacter('thinking', currentState, currentCharacter, animFrame);
    }

    if (currentState === 'working') {
      updateLoadingDots();
    }

    if (currentState === 'idle') {
      blinkFrame++;
      if (blinkFrame === 30) {
        drawCharacter('blink', currentState, currentCharacter, animFrame);
      } else if (blinkFrame === 31) {
        drawCharacter('normal', currentState, currentCharacter, animFrame);
        blinkFrame = 0;
      }
    }

    if (currentState === 'sleep') {
      drawCharacter('sleep', currentState, currentCharacter, animFrame);
    }

    checkStateTimeouts();
  }, 100);
}

// Initialize on load
window.onload = init;
