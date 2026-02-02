import { CHARACTER_CONFIG, CHARACTER_NAMES, DEFAULT_CHARACTER, states, createVibeMonEngine } from 'https://static.vibemon.toast.sh/js/vibemon-engine-standalone.js';

// Static server base URL
const STATIC_BASE = 'https://static.vibemon.toast.sh';

// VibeMon engine instance
let vibeMonEngine = null;

// Current state
let currentState = 'start';
let currentCharacter = 'clawd';
let iconType = 'emoji';

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

// Initialize
async function init() {
  const container = document.getElementById('vibemon-display');

  // Create and initialize VibeMon engine with static server images
  vibeMonEngine = createVibeMonEngine(container, {
    useEmoji: iconType === 'emoji',
    characterImageUrls: {
      clawd: `${STATIC_BASE}/characters/clawd.png`,
      kiro: `${STATIC_BASE}/characters/kiro.png`,
      claw: `${STATIC_BASE}/characters/claw.png`
    }
  });
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

  // Get input elements
  const projectInput = document.getElementById('project-input');
  const toolInput = document.getElementById('tool-input');
  const modelInput = document.getElementById('model-input');
  const memoryInput = document.getElementById('memory-input');

  // Project: use URL param or default
  if (urlParams.project) {
    projectInput.value = urlParams.project;
  }

  // Tool: use URL param or default
  if (urlParams.tool) {
    toolInput.value = urlParams.tool;
  }

  // Model: use URL param or default
  if (urlParams.model) {
    modelInput.value = urlParams.model;
  }

  // Memory: use URL param (0-100) or random (10-90%)
  let memoryValue;
  if (urlParams.memory !== null) {
    const parsed = parseInt(urlParams.memory, 10);
    memoryValue = isNaN(parsed) ? 45 : Math.max(0, Math.min(100, parsed));
  } else {
    memoryValue = Math.floor(Math.random() * 81) + 10;
  }
  memoryInput.value = memoryValue;
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
  const projectInput = document.getElementById('project-input');
  const toolInput = document.getElementById('tool-input');
  const modelInput = document.getElementById('model-input');
  const memoryInput = document.getElementById('memory-input');

  // Get values from inputs
  const projectName = projectInput.value.trim();
  const toolName = toolInput.value;
  const modelName = modelInput.value.trim();
  const memoryValue = parseInt(memoryInput.value, 10) || 0;

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
  document.getElementById('current-state-display').textContent = currentState;

  // Update JSON preview
  const json = {
    state: currentState,
    tool: currentState === 'working' ? toolName : '',
    project: projectName,
    model: modelName,
    memory: memoryValue,
    character: currentCharacter
  };
  document.getElementById('json-preview').textContent = JSON.stringify(json, null, 2);
};

// Initialize on load
window.onload = init;
