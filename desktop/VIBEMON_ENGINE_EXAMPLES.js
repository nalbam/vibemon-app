/**
 * VibeMonEngine Usage Examples
 *
 * This file demonstrates how to use the VibeMonEngine module
 * to render character and status in the Vibe Monitor desktop app.
 *
 * The VibeMonEngine completely separates rendering logic from the main renderer.
 * You can declare it, initialize it, and call render() to immediately update the display.
 */

// Import the renderer engine
import { createVibeMonEngine } from './shared/vibemon-engine.js';

// Example 1: Basic Usage
// ----------------------
async function basicExample() {
  // Get canvas and DOM elements
  const canvas = document.getElementById('character-canvas');
  const domElements = {
    display: document.getElementById('display'),
    titleText: document.getElementById('title-text'),
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
    dots: document.querySelectorAll('.dot')
  };

  // Create renderer engine
  const engine = createVibeMonEngine(canvas, domElements, {
    useEmoji: true // Use emoji icons on macOS
  });

  // Initialize (loads character images)
  await engine.init();

  // Set initial state
  engine.setState({
    state: 'idle',
    character: 'clawd',
    project: 'my-project',
    tool: '-',
    model: 'claude-3',
    memory: 0
  });

  // Render everything
  engine.render();

  // Start animation loop
  engine.startAnimation();
}

// Example 2: Updating State
// --------------------------
function updateStateExample(engine) {
  // Update to working state
  engine.setState({
    state: 'working',
    tool: 'Bash',
    memory: 45
  });

  // Render the changes
  engine.render();
}

// Example 3: Changing Character
// ------------------------------
function changeCharacterExample(engine) {
  // Switch to different character
  engine.setState({
    character: 'kiro', // or 'clawd' or 'claw'
    state: 'thinking'
  });

  engine.render();
}

// Example 4: Multiple State Transitions
// --------------------------------------
async function stateTransitionsExample(engine) {
  // Start state
  engine.setState({ state: 'start' });
  engine.render();
  await sleep(2000);

  // Thinking state
  engine.setState({ state: 'thinking' });
  engine.render();
  await sleep(2000);

  // Working state
  engine.setState({
    state: 'working',
    tool: 'Python',
    project: 'ai-assistant'
  });
  engine.render();
  await sleep(3000);

  // Done state
  engine.setState({ state: 'done' });
  engine.render();
  await sleep(1000);

  // Idle state
  engine.setState({ state: 'idle' });
  engine.render();
}

// Example 5: Rendering Individual Components
// -------------------------------------------
function individualRenderingExample(engine) {
  // You can also render individual components
  engine.setState({ state: 'working', tool: 'Node.js' });

  // Render just the background
  engine.renderBackground();

  // Render just the title
  engine.renderTitle();

  // Render just the status text
  engine.renderStatusText();

  // Render just the character
  engine.renderCharacter();

  // Or render everything at once
  engine.render();
}

// Example 6: Animation Control
// -----------------------------
function animationControlExample(engine) {
  // Start animation
  engine.startAnimation();

  // Stop animation (when needed)
  engine.stopAnimation();

  // Cleanup (call before unload)
  engine.cleanup();
}

// Example 7: Getting Current State
// ---------------------------------
function getStateExample(engine) {
  const currentState = engine.getStateObject();
  console.log('Current state:', currentState);
  // Output: { state: 'working', character: 'clawd', project: 'my-project', ... }
}

// Example 8: Complete Integration (like in renderer.js)
// ------------------------------------------------------
async function completeIntegrationExample() {
  const canvas = document.getElementById('character-canvas');
  const domElements = initDomCache(); // Your DOM cache function

  // Get platform for emoji detection
  const useEmoji = getPlatform() === 'darwin';

  // Create and initialize
  const engine = createVibeMonEngine(canvas, domElements, { useEmoji });
  await engine.init();

  // Initial render and animation
  engine.render();
  engine.startAnimation();

  // Listen for IPC updates
  window.electronAPI.onStateUpdate((data) => {
    engine.setState(data);
    engine.render();
  });

  // Cleanup on unload
  window.onunload = () => {
    engine.cleanup();
  };
}

// Helper function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function initDomCache() {
  // Returns DOM elements object (see example 1)
  return {};
}

function getPlatform() {
  return window.electronAPI?.getPlatform() || 'linux';
}

// Exports for demonstration
export {
  basicExample,
  updateStateExample,
  changeCharacterExample,
  stateTransitionsExample,
  individualRenderingExample,
  animationControlExample,
  getStateExample,
  completeIntegrationExample
};
