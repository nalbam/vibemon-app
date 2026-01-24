import { TOOL_TEXTS } from './config.js';

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

// Update memory bar display
export function updateMemoryBar(memoryUsage, bgColor) {
  const memoryBar = document.getElementById('memory-bar');
  const memoryBarContainer = document.getElementById('memory-bar-container');

  if (!memoryUsage || memoryUsage === '-') {
    memoryBarContainer.style.display = 'none';
    return;
  }

  memoryBarContainer.style.display = 'block';

  const isDarkBg = (bgColor === '#0066CC' || bgColor === '#1a1a4e');
  if (isDarkBg) {
    memoryBarContainer.style.borderColor = 'rgba(255, 255, 255, 0.6)';
    memoryBarContainer.style.background = 'rgba(255, 255, 255, 0.2)';
  } else {
    memoryBarContainer.style.borderColor = 'rgba(0, 0, 0, 0.6)';
    memoryBarContainer.style.background = 'rgba(0, 0, 0, 0.3)';
  }

  const percent = parseInt(memoryUsage.replace('%', '')) || 0;
  const clampedPercent = Math.min(100, Math.max(0, percent));

  memoryBar.style.width = clampedPercent + '%';
  memoryBar.style.background = getMemoryGradient(clampedPercent);
}
