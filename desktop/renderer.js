import { createVibeMonEngine } from './shared/vibemon-engine.js';

// VibeMon engine instance
let vibeMonEngine = null;

// IPC cleanup function
let cleanupStateListener = null;

// Initialize DOM cache
function initDomCache() {
  return {
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
}

// Initialize
async function init() {
  const canvas = document.getElementById('character-canvas');
  const domCache = initDomCache();

  // Display version (set in HTML, updated dynamically if needed)
  if (window.electronAPI?.getVersion) {
    window.electronAPI.getVersion().then(version => {
      document.getElementById('version-text').textContent = `v${version}`;
    }).catch(() => {});
  }

  // Get platform info for emoji detection
  let useEmoji = false;
  if (window.electronAPI?.getPlatform) {
    const platform = window.electronAPI.getPlatform();
    useEmoji = platform === 'darwin';
  }

  // Create and initialize VibeMon engine
  vibeMonEngine = createVibeMonEngine(canvas, domCache, { useEmoji });
  await vibeMonEngine.init();

  // Initial render and start animation
  vibeMonEngine.render();
  vibeMonEngine.startAnimation();

  // Listen for state updates from main process
  if (window.electronAPI) {
    cleanupStateListener = window.electronAPI.onStateUpdate((data) => {
      // Validate incoming data
      if (!data || typeof data !== 'object') return;

      // Update state in VibeMon engine
      vibeMonEngine.setState(data);
      vibeMonEngine.render();
    });
  }

  // Right-click context menu (works on all platforms)
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (window.electronAPI?.showContextMenu) {
      window.electronAPI.showContextMenu();
    }
  });

  // Click to focus terminal (iTerm2/Ghostty on macOS)
  document.addEventListener('click', (e) => {
    // Ignore right-click
    if (e.button !== 0) return;
    if (window.electronAPI?.focusTerminal) {
      window.electronAPI.focusTerminal();
    }
  });
}

// Cleanup on unload
function cleanup() {
  if (vibeMonEngine) {
    vibeMonEngine.cleanup();
    vibeMonEngine = null;
  }
  if (cleanupStateListener) {
    cleanupStateListener();
    cleanupStateListener = null;
  }
}

// Initialize on load
window.onload = init;
window.onbeforeunload = cleanup;
window.onunload = cleanup;
