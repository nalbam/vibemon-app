import { CHARACTER_CONFIG, CHARACTER_NAMES, DEFAULT_CHARACTER, states, createVibeMonEngine } from '../desktop/shared/vibemon-engine-standalone.js';

// VibeMon engine instance
let vibeMonEngine = null;

// Current state
let currentState = 'start';
let currentCharacter = 'clawd';
let iconType = 'emoji';

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
  return {
    display: document.getElementById('display'),
    titleText: null, // Not used in simulator
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
    memoryBar: document.getElementById('memory-bar'),
    memoryBarContainer: document.getElementById('memory-bar-container'),
    infoTexts: document.querySelectorAll('.info-text'),
    infoLabels: document.querySelectorAll('.info-label'),
    infoValues: document.querySelectorAll('.info-value'),
    dots: document.querySelectorAll('.dot'),
    // Simulator-specific elements
    currentStateDisplay: document.getElementById('current-state-display'),
    jsonPreview: document.getElementById('json-preview'),
    toolInput: document.getElementById('tool-input'),
    projectInput: document.getElementById('project-input'),
    modelInput: document.getElementById('model-input'),
    memoryInput: document.getElementById('memory-input')
  };
}

// Initialize
async function init() {
  const canvas = document.getElementById('character-canvas');
  domCache = initDomCache();

  // Create and initialize VibeMon engine
  vibeMonEngine = createVibeMonEngine(canvas, domCache, { useEmoji: iconType === 'emoji' });
  await vibeMonEngine.init();

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
  vibeMonEngine.startAnimation();
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
  vibeMonEngine.useEmoji = (type === 'emoji');
  updateDisplay();
};

// Update memory slider display
window.updateMemorySlider = function(value) {
  document.getElementById('memory-display').textContent = value + '%';
  updateDisplay();
};

// Update display
window.updateDisplay = function() {
  const d = domCache;

  // Get values from inputs
  const projectName = d.projectInput.value.trim();
  const toolName = d.toolInput.value;
  const modelName = d.modelInput.value.trim();
  const memoryValue = parseInt(d.memoryInput.value, 10) || 0;

  // Update VibeMon engine state
  vibeMonEngine.setState({
    state: currentState,
    character: currentCharacter,
    project: projectName,
    tool: toolName,
    model: modelName,
    memory: memoryValue
  });

  // Render using VibeMon engine
  vibeMonEngine.render();

  // Update simulator-specific UI
  d.currentStateDisplay.textContent = currentState;

  // Update JSON preview
  const json = {
    state: currentState,
    tool: currentState === 'working' ? toolName : '',
    project: projectName,
    model: modelName,
    memory: memoryValue,
    character: currentCharacter
  };
  d.jsonPreview.textContent = JSON.stringify(json, null, 2);
};

// Initialize on load
window.onload = init;
