import {
  states, CHARACTER_CONFIG, DEFAULT_CHARACTER,
  FLOAT_AMPLITUDE_X, FLOAT_AMPLITUDE_Y, CHAR_X_BASE, CHAR_Y_BASE,
  SLEEP_TIMEOUT
} from '../shared/config.js';
import { getThinkingText, getWorkingText, updateMemoryBar } from '../shared/utils.js';
import { initRenderer, drawCharacter } from '../shared/character.js';
import { drawInfoIcons } from '../shared/icons.js';

// Platform detection: macOS uses emoji, Windows/Linux uses pixel art
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const useEmoji = isMac;

// Current state
let currentState = 'idle';
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

  updateDisplay();
  startAnimation();

  // Listen for state updates from main process
  if (window.electronAPI) {
    window.electronAPI.onStateUpdate((data) => {
      if (data.state) currentState = data.state;
      if (data.character) currentCharacter = CHARACTER_CONFIG[data.character] ? data.character : DEFAULT_CHARACTER;
      if (data.project) currentProject = data.project;
      if (data.tool) currentTool = data.tool;
      if (data.model) currentModel = data.model;
      if (data.memory) currentMemory = data.memory;
      lastActivityTime = Date.now();
      updateDisplay();
    });
  }
}

// Update display
function updateDisplay() {
  const state = states[currentState] || states.idle;
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

  // Update background
  display.style.background = state.bgColor;

  // Update text and color
  if (currentState === 'thinking') {
    statusText.textContent = getThinkingText();
  } else if (currentState === 'working') {
    statusText.textContent = getWorkingText(currentTool);
  } else {
    statusText.textContent = state.text;
  }
  statusText.style.color = state.textColor;

  // Update loading dots visibility
  loadingDots.style.display = state.showLoading ? 'flex' : 'none';

  // Update tool line visibility
  toolLine.style.display = currentState === 'working' ? 'block' : 'none';

  // Update values
  const displayProject = currentProject.length > 16
    ? currentProject.substring(0, 13) + '...'
    : currentProject;
  projectValue.textContent = displayProject;
  toolValue.textContent = currentTool;

  // Update model value (truncate if too long)
  const displayModel = currentModel.length > 14
    ? currentModel.substring(0, 11) + '...'
    : currentModel;
  modelValue.textContent = displayModel;
  memoryValue.textContent = currentMemory;

  // Update model/memory visibility
  modelLine.style.display = currentModel && currentModel !== '-' ? 'block' : 'none';
  memoryLine.style.display = currentMemory && currentMemory !== '-' ? 'block' : 'none';

  // Update memory bar
  updateMemoryBar(currentMemory, state.bgColor);

  // Update all text colors based on state
  document.querySelectorAll('.info-text').forEach(el => {
    el.style.color = state.textColor;
  });
  document.querySelectorAll('.info-label').forEach(el => {
    el.style.color = state.textColor;
  });
  document.querySelectorAll('.info-value').forEach(el => {
    el.style.color = state.textColor;
  });

  // Draw info icons
  drawInfoIcons(state.textColor, state.bgColor, useEmoji);

  // Draw character
  drawCharacter(state.eyeType, currentState, currentCharacter, animFrame);
}

// Update loading dots
function updateLoadingDots() {
  const dots = document.querySelectorAll('.dot');
  const activeIndex = animFrame % 4;
  dots.forEach((dot, i) => {
    dot.classList.toggle('dim', i !== activeIndex);
  });
}

// Check sleep timer
function checkSleepTimer() {
  if (currentState === 'session_start' || currentState === 'idle' || currentState === 'tool_done') {
    const elapsed = Date.now() - lastActivityTime;
    if (elapsed >= SLEEP_TIMEOUT) {
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

    if (currentState === 'session_start') {
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

    checkSleepTimer();
  }, 100);
}

// Initialize on load
window.onload = init;
