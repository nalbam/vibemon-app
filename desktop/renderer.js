import {
  states, CHARACTER_CONFIG, DEFAULT_CHARACTER,
  CHAR_X_BASE, CHAR_Y_BASE, SLEEP_TIMEOUT,
  FRAME_INTERVAL, LOADING_DOT_COUNT, THINKING_ANIMATION_SLOWDOWN,
  BLINK_START_FRAME, BLINK_END_FRAME,
  PROJECT_NAME_MAX_LENGTH, PROJECT_NAME_TRUNCATE_AT,
  MODEL_NAME_MAX_LENGTH, MODEL_NAME_TRUNCATE_AT
} from './shared/config.js';
import { getThinkingText, getPlanningText, getWorkingText, updateMemoryBar } from './shared/utils.js';
import { initRenderer, drawCharacter } from './shared/character.js';
import { drawInfoIcons } from './shared/icons.js';
import { getFloatOffsetX, getFloatOffsetY, needsAnimationRedraw } from './shared/animation.js';

// Platform detection: macOS uses emoji, Windows/Linux uses pixel art
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const useEmoji = isMac;

// Animation timing
let lastFrameTime = 0;

// Current state
let currentState = 'start';
let currentCharacter = 'clawd';
let currentProject = '-';
let currentTool = '-';
let currentModel = '-';
let currentMemory = '-';
let animFrame = 0;
let blinkFrame = 0;
let lastActivityTime = Date.now();

// Canvas
let canvas, ctx;

// Cached DOM elements (initialized once in init())
let domCache = null;

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
    infoTexts: document.querySelectorAll('.info-text'),
    infoLabels: document.querySelectorAll('.info-label'),
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

  // Display version (set in HTML, updated dynamically if needed)
  if (window.electronAPI?.getVersion) {
    window.electronAPI.getVersion().then(version => {
      document.getElementById('version-text').textContent = `v${version}`;
    }).catch(() => {});
  }

  updateDisplay();
  startAnimation();

  // Listen for state updates from main process
  if (window.electronAPI) {
    window.electronAPI.onStateUpdate((data) => {
      if (data.state) currentState = data.state;
      if (data.character) currentCharacter = CHARACTER_CONFIG[data.character] ? data.character : DEFAULT_CHARACTER;
      if (data.project) currentProject = data.project;
      if (data.tool) currentTool = data.tool;
      if (data.model !== undefined) currentModel = data.model || '-';
      if (data.memory !== undefined) currentMemory = data.memory || '-';
      lastActivityTime = Date.now();
      updateDisplay();
    });
  }

  // Right-click context menu (works on all platforms)
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (window.electronAPI?.showContextMenu) {
      window.electronAPI.showContextMenu();
    }
  });
}

// Update display
function updateDisplay() {
  const state = states[currentState] || states.idle;
  const d = domCache;

  // Update background
  d.display.style.background = state.bgColor;

  // Update text and color
  if (currentState === 'thinking') {
    d.statusText.textContent = getThinkingText();
  } else if (currentState === 'planning') {
    d.statusText.textContent = getPlanningText();
  } else if (currentState === 'working') {
    d.statusText.textContent = getWorkingText(currentTool);
  } else {
    d.statusText.textContent = state.text;
  }
  d.statusText.style.color = state.textColor;

  // Update loading dots visibility
  d.loadingDots.style.display = state.showLoading ? 'flex' : 'none';

  // Update tool line visibility
  const isKiro = currentCharacter === 'kiro';
  d.toolLine.style.display = currentState === 'working' ? 'block' : 'none';

  // Update values (using constants for truncation)
  const displayProject = currentProject.length > PROJECT_NAME_MAX_LENGTH
    ? currentProject.substring(0, PROJECT_NAME_TRUNCATE_AT) + '...'
    : currentProject;
  d.projectValue.textContent = displayProject;
  d.toolValue.textContent = currentTool;

  // Update model value (truncate if too long)
  const displayModel = currentModel.length > MODEL_NAME_MAX_LENGTH
    ? currentModel.substring(0, MODEL_NAME_TRUNCATE_AT) + '...'
    : currentModel;
  d.modelValue.textContent = displayModel;
  d.memoryValue.textContent = currentMemory;

  // Update project/model/memory visibility (hide memory on start state, hide tool/model/memory for kiro)
  const showProject = currentProject && currentProject !== '-';
  d.projectLine.style.display = showProject ? 'block' : 'none';
  d.modelLine.style.display = currentModel && currentModel !== '-' && !isKiro ? 'block' : 'none';
  const showMemory = currentState !== 'start' && currentMemory && currentMemory !== '-' && !isKiro;
  d.memoryLine.style.display = showMemory ? 'block' : 'none';

  // Update memory bar (hide on start state, hide for kiro)
  updateMemoryBar(showMemory ? currentMemory : null, state.bgColor);

  // Update all text colors based on state (using cached elements)
  d.infoTexts.forEach(el => el.style.color = state.textColor);
  d.infoLabels.forEach(el => el.style.color = state.textColor);
  d.infoValues.forEach(el => el.style.color = state.textColor);

  // Draw info icons
  drawInfoIcons(state.textColor, state.bgColor, useEmoji);

  // Draw character
  drawCharacter(state.eyeType, currentState, currentCharacter, animFrame);
}

// Update loading dots (slower for thinking state)
function updateLoadingDots(slow = false) {
  const frame = slow ? Math.floor(animFrame / THINKING_ANIMATION_SLOWDOWN) : animFrame;
  const activeIndex = frame % LOADING_DOT_COUNT;
  domCache.dots.forEach((dot, i) => {
    dot.classList.toggle('dim', i !== activeIndex);
  });
}

// Check sleep timer
function checkSleepTimer() {
  // idle/notification -> sleep after 5 minutes
  if (currentState === 'idle' || currentState === 'notification') {
    const elapsed = Date.now() - lastActivityTime;
    if (elapsed >= SLEEP_TIMEOUT) {
      currentState = 'sleep';
      updateDisplay();
    }
  }
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
      drawCharacter('sparkle', currentState, currentCharacter, animFrame);
    }

    if (currentState === 'thinking') {
      updateLoadingDots(true);  // Slow for thinking
      drawCharacter('thinking', currentState, currentCharacter, animFrame);
    }

    if (currentState === 'planning') {
      updateLoadingDots(true);  // Slow for planning
      drawCharacter('thinking', currentState, currentCharacter, animFrame);
    }

    if (currentState === 'working') {
      updateLoadingDots(false);  // Normal speed for working
      drawCharacter('focused', currentState, currentCharacter, animFrame);
    }

    if (currentState === 'idle') {
      if (blinkFrame === BLINK_START_FRAME) {
        drawCharacter('blink', currentState, currentCharacter, animFrame);
      } else if (blinkFrame === BLINK_END_FRAME) {
        drawCharacter('normal', currentState, currentCharacter, animFrame);
      }
    }

    if (currentState === 'sleep') {
      drawCharacter('sleep', currentState, currentCharacter, animFrame);
    }
  }

  checkSleepTimer();
  requestAnimationFrame(animationLoop);
}

// Start animation loop
function startAnimation() {
  requestAnimationFrame(animationLoop);
}

// Initialize on load
window.onload = init;
