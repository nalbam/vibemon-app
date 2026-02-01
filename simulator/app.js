import {
  states, CHARACTER_CONFIG, CHARACTER_NAMES, DEFAULT_CHARACTER,
  CHAR_X_BASE, CHAR_Y_BASE,
  FRAME_INTERVAL, LOADING_DOT_COUNT, THINKING_ANIMATION_SLOWDOWN,
  BLINK_START_FRAME, BLINK_END_FRAME,
  PROJECT_NAME_MAX_LENGTH, PROJECT_NAME_TRUNCATE_AT,
  MODEL_NAME_MAX_LENGTH, MODEL_NAME_TRUNCATE_AT
} from '../desktop/shared/config.js';
import { getThinkingText, getPlanningText, getWorkingText, updateMemoryBar } from '../desktop/shared/utils.js';
import { initRenderer, drawCharacter } from '../desktop/shared/character.js';
import { drawInfoIcons } from '../desktop/shared/icons.js';
import { getFloatOffsetX, getFloatOffsetY, needsAnimationRedraw } from '../desktop/shared/animation.js';

// Animation timing
let lastFrameTime = 0;

// Current state
let currentState = 'start';
let currentCharacter = 'clawd';
let animFrame = 0;
let blinkFrame = 0;
let iconType = 'emoji';

// Canvas
let canvas, ctx;

// Cached DOM elements (initialized once in init())
let domCache = null;

// Parse URL parameters
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    character: params.get('character'),
    state: params.get('state'),
    project: params.get('project'),
    tool: params.get('tool'),
    model: params.get('model'),
    memory: params.get('memory'),
    icon: params.get('icon')
  };
}

// Initialize DOM cache
function initDomCache() {
  domCache = {
    display: document.getElementById('display'),
    statusText: document.getElementById('status-text'),
    loadingDots: document.getElementById('loading-dots'),
    projectLine: document.getElementById('project-line'),
    toolLine: document.getElementById('tool-line'),
    modelLine: document.getElementById('model-line'),
    memoryLine: document.getElementById('memory-line'),
    projectValue: document.getElementById('project-value'),
    toolValue: document.getElementById('tool-value'),
    modelValue: document.getElementById('model-value'),
    memoryValue: document.getElementById('memory-value'),
    currentStateDisplay: document.getElementById('current-state-display'),
    jsonPreview: document.getElementById('json-preview'),
    toolInput: document.getElementById('tool-input'),
    projectInput: document.getElementById('project-input'),
    modelInput: document.getElementById('model-input'),
    memoryInput: document.getElementById('memory-input'),
    infoTexts: document.querySelectorAll('.info-text'),
    infoValues: document.querySelectorAll('.info-value'),
    dots: document.querySelectorAll('.dot')
  };
}

// Update canvas position for floating effect
function updateFloatingPosition() {
  const offsetX = getFloatOffsetX(animFrame);
  const offsetY = getFloatOffsetY(animFrame);
  canvas.style.left = (CHAR_X_BASE + offsetX) + 'px';
  canvas.style.top = (CHAR_Y_BASE + offsetY) + 'px';
}

// Initialize
async function init() {
  canvas = document.getElementById('character-canvas');
  ctx = canvas.getContext('2d');
  await initRenderer(ctx);
  initDomCache();

  // Get URL parameters
  const urlParams = getUrlParams();
  const stateNames = Object.keys(states);

  // State: use URL param or random
  if (urlParams.state && states[urlParams.state]) {
    currentState = urlParams.state;
  } else {
    currentState = stateNames[Math.floor(Math.random() * stateNames.length)];
  }

  // Character: use URL param or random
  if (urlParams.character && CHARACTER_CONFIG[urlParams.character]) {
    currentCharacter = urlParams.character;
  } else {
    currentCharacter = CHARACTER_NAMES[Math.floor(Math.random() * CHARACTER_NAMES.length)];
  }

  // Populate character dropdown from CHARACTER_CONFIG
  const characterSelect = document.getElementById('character-select');
  CHARACTER_NAMES.forEach(name => {
    const char = CHARACTER_CONFIG[name];
    const option = document.createElement('option');
    option.value = name;
    option.textContent = char.displayName || name;
    if (name === currentCharacter) option.selected = true;
    characterSelect.appendChild(option);
  });

  // Project: use URL param or default
  if (urlParams.project) {
    domCache.projectInput.value = urlParams.project;
  }

  // Tool: use URL param or default
  if (urlParams.tool) {
    domCache.toolInput.value = urlParams.tool;
  }

  // Model: use URL param or default
  if (urlParams.model) {
    domCache.modelInput.value = urlParams.model;
  }

  // Memory: use URL param (0-100) or random (10-90%)
  let memoryValue;
  if (urlParams.memory !== null) {
    const parsed = parseInt(urlParams.memory, 10);
    memoryValue = isNaN(parsed) ? 45 : Math.max(0, Math.min(100, parsed));
  } else {
    memoryValue = Math.floor(Math.random() * 81) + 10;
  }
  domCache.memoryInput.value = memoryValue;
  document.getElementById('memory-display').textContent = memoryValue + '%';

  // Icon type: use URL param or default
  if (urlParams.icon === 'pixel' || urlParams.icon === 'emoji') {
    iconType = urlParams.icon;
    document.getElementById('icon-type-select').value = iconType;
  }

  updateDisplay();
  startAnimation();
}

// Set state
window.setState = function(state) {
  currentState = state;
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
  const d = domCache;

  // Update background
  d.display.style.background = state.bgColor;

  // Update text and color
  const toolName = d.toolInput.value;
  if (currentState === 'thinking') {
    d.statusText.textContent = getThinkingText();
  } else if (currentState === 'planning') {
    d.statusText.textContent = getPlanningText();
  } else if (currentState === 'working') {
    d.statusText.textContent = getWorkingText(toolName);
  } else {
    d.statusText.textContent = state.text;
  }
  d.statusText.style.color = state.textColor;

  // Update loading dots visibility
  d.loadingDots.style.display = state.showLoading ? 'flex' : 'none';

  // Update tool line visibility
  d.toolLine.style.display = currentState === 'working' ? 'block' : 'none';

  // Update values from inputs
  const projectName = d.projectInput.value.trim();
  const modelName = d.modelInput.value.trim();
  const memoryUsage = d.memoryInput.value + '%';
  d.projectValue.textContent = projectName.length > PROJECT_NAME_MAX_LENGTH
    ? projectName.substring(0, PROJECT_NAME_TRUNCATE_AT) + '...'
    : projectName;
  d.toolValue.textContent = toolName;
  d.modelValue.textContent = modelName.length > MODEL_NAME_MAX_LENGTH
    ? modelName.substring(0, MODEL_NAME_TRUNCATE_AT) + '...'
    : modelName;
  d.memoryValue.textContent = memoryUsage;

  // Update project/model/memory visibility (hide memory on start state)
  const showProject = projectName && projectName !== '-';
  d.projectLine.style.display = showProject ? 'block' : 'none';
  d.modelLine.style.display = modelName && modelName !== '-' ? 'block' : 'none';
  const showMemory = currentState !== 'start' && memoryUsage && memoryUsage !== '-';
  d.memoryLine.style.display = showMemory ? 'block' : 'none';

  // Update memory bar (hide on start state, hide for kiro)
  updateMemoryBar(showMemory ? memoryUsage : null, state.bgColor);

  // Update all text colors based on state (using cached elements)
  d.infoTexts.forEach(el => el.style.color = state.textColor);
  d.infoValues.forEach(el => el.style.color = state.textColor);

  // Draw info icons
  drawInfoIcons(state.textColor, state.bgColor, iconType === 'emoji');

  // Update current state display
  d.currentStateDisplay.textContent = currentState;

  // Update JSON preview
  const json = {
    state: currentState,
    tool: currentState === 'working' ? toolName : '',
    project: projectName,
    model: modelName,
    memory: memoryUsage,
    character: currentCharacter
  };
  d.jsonPreview.textContent = JSON.stringify(json, null, 2);

  // Draw character (eyeType and effect from state)
  drawCharacter(state.eyeType, state.effect, currentState, currentCharacter, animFrame);
};

// Update loading dots (slower for thinking state)
function updateLoadingDots(slow = false) {
  const frame = slow ? Math.floor(animFrame / THINKING_ANIMATION_SLOWDOWN) : animFrame;
  const activeIndex = frame % LOADING_DOT_COUNT;
  domCache.dots.forEach((dot, i) => {
    dot.classList.toggle('dim', i !== activeIndex);
  });
}

// Animation loop using requestAnimationFrame for smoother rendering
function animationLoop(timestamp) {
  // Throttle to ~100ms intervals
  if (timestamp - lastFrameTime < FRAME_INTERVAL) {
    requestAnimationFrame(animationLoop);
    return;
  }
  lastFrameTime = timestamp;
  animFrame++;

  updateFloatingPosition();

  // Increment blinkFrame for idle state (outside redraw check)
  if (currentState === 'idle') {
    blinkFrame++;
    if (blinkFrame > BLINK_END_FRAME) {
      blinkFrame = 0;
    }
  }

  // Only redraw when necessary
  if (needsAnimationRedraw(currentState, animFrame, blinkFrame)) {
    if (currentState === 'start') {
      drawCharacter('normal', 'sparkle', currentState, currentCharacter, animFrame);
    }

    if (currentState === 'thinking') {
      updateLoadingDots(true);  // Slow for thinking
      drawCharacter('normal', 'thinking', currentState, currentCharacter, animFrame);
    }

    if (currentState === 'planning') {
      updateLoadingDots(true);  // Slow for planning (same as thinking)
      drawCharacter('normal', 'thinking', currentState, currentCharacter, animFrame);
    }

    if (currentState === 'working') {
      updateLoadingDots(false);  // Normal speed for working
      drawCharacter('focused', 'matrix', currentState, currentCharacter, animFrame);
    }

    if (currentState === 'packing') {
      updateLoadingDots(true);  // Slow for packing
      drawCharacter('normal', 'thinking', currentState, currentCharacter, animFrame);
    }

    if (currentState === 'idle') {
      if (blinkFrame === BLINK_START_FRAME) {
        drawCharacter('blink', 'none', currentState, currentCharacter, animFrame);
      } else if (blinkFrame === BLINK_END_FRAME) {
        drawCharacter('normal', 'none', currentState, currentCharacter, animFrame);
      }
    }

    if (currentState === 'sleep') {
      drawCharacter('blink', 'zzz', currentState, currentCharacter, animFrame);
    }
  }

  requestAnimationFrame(animationLoop);
}

// Start animation loop
function startAnimation() {
  requestAnimationFrame(animationLoop);
}

// Initialize on load
window.onload = init;
