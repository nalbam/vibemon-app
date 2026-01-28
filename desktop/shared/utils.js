import { TOOL_TEXTS, THINKING_TEXTS, PLANNING_TEXTS } from './config.js';

// Get thinking text (random selection)
export function getThinkingText() {
  return THINKING_TEXTS[Math.floor(Math.random() * THINKING_TEXTS.length)];
}

// Get planning text (random selection)
export function getPlanningText() {
  return PLANNING_TEXTS[Math.floor(Math.random() * PLANNING_TEXTS.length)];
}

// Get working text based on tool (random selection, case-insensitive)
export function getWorkingText(tool) {
  const key = (tool || '').toLowerCase();
  const texts = TOOL_TEXTS[key] || TOOL_TEXTS['default'];
  return texts[Math.floor(Math.random() * texts.length)];
}

// Interpolate between two colors based on ratio (0-1)
export function lerpColor(color1, color2, ratio) {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);
  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);

  return `rgb(${r}, ${g}, ${b})`;
}

// Get gradient colors based on percentage (smooth transition)
export function getMemoryGradient(percent) {
  const green = '#00AA00';
  const yellow = '#FFCC00';
  const red = '#FF4444';

  let startColor, endColor;
  if (percent < 50) {
    const ratio = percent / 50;
    startColor = lerpColor(green, yellow, ratio * 0.5);
    endColor = lerpColor(green, yellow, Math.min(1, ratio * 0.5 + 0.3));
  } else {
    const ratio = (percent - 50) / 50;
    startColor = lerpColor(yellow, red, ratio * 0.7);
    endColor = lerpColor(yellow, red, Math.min(1, ratio * 0.7 + 0.3));
  }

  return `linear-gradient(to right, ${startColor}, ${endColor})`;
}

// Calculate memory bar styles (pure function, no DOM access)
// Returns { display, containerStyles, barStyles } for the caller to apply
export function getMemoryBarStyles(memoryUsage, bgColor) {
  if (!memoryUsage || memoryUsage === '-') {
    return { display: 'none', containerStyles: null, barStyles: null };
  }

  const isDarkBg = (bgColor === '#0066CC' || bgColor === '#1a1a4e');
  const containerStyles = {
    borderColor: isDarkBg ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
    background: isDarkBg ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.3)'
  };

  const percent = parseInt(memoryUsage.replace('%', '')) || 0;
  const clampedPercent = Math.min(100, Math.max(0, percent));

  const barStyles = {
    width: clampedPercent + '%',
    background: getMemoryGradient(clampedPercent)
  };

  return { display: 'block', containerStyles, barStyles };
}

// Update memory bar display (applies styles to DOM elements)
// Accepts optional DOM elements for testability; falls back to document.getElementById
export function updateMemoryBar(memoryUsage, bgColor, elements = null) {
  const memoryBar = elements?.memoryBar || document.getElementById('memory-bar');
  const memoryBarContainer = elements?.memoryBarContainer || document.getElementById('memory-bar-container');

  const styles = getMemoryBarStyles(memoryUsage, bgColor);

  memoryBarContainer.style.display = styles.display;

  if (styles.containerStyles) {
    memoryBarContainer.style.borderColor = styles.containerStyles.borderColor;
    memoryBarContainer.style.background = styles.containerStyles.background;
  }

  if (styles.barStyles) {
    memoryBar.style.width = styles.barStyles.width;
    memoryBar.style.background = styles.barStyles.background;
  }
}
