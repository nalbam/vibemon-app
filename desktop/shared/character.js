import { CHAR_SIZE, SCALE, CHARACTER_CONFIG, DEFAULT_CHARACTER, states } from './config.js';
import { drawEyes, drawMatrixBackground } from './effects.js';

/**
 * Module-level state for character rendering.
 * Note: Each Electron renderer window runs in its own isolated JS context,
 * so these module-level variables are safe (not shared between windows).
 * If this changes, consider refactoring to a class-based renderer.
 */
let ctx = null;

// Character images cache (per renderer context)
const characterImages = {};
let imagesLoaded = false;

// Image paths for each character (relative to this module)
const CHARACTER_IMAGES = {
  clawd: new URL('../assets/characters/clawd-128.png', import.meta.url).href,
  kiro: new URL('../assets/characters/kiro-128.png', import.meta.url).href,
  claw: new URL('../assets/characters/claw-128.png', import.meta.url).href
};

// Preload character images
function preloadImages() {
  if (imagesLoaded) return Promise.resolve();

  const promises = Object.entries(CHARACTER_IMAGES).map(([name, path]) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        characterImages[name] = img;
        resolve();
      };
      img.onerror = () => {
        console.warn(`Failed to load image for ${name}: ${path}`);
        resolve();
      };
      img.src = path;
    });
  });

  return Promise.all(promises).then(() => {
    imagesLoaded = true;
  });
}

// Check if character has image
function hasImage(characterName) {
  return characterImages[characterName] !== undefined;
}

// Initialize renderer with canvas context
export async function initRenderer(canvasCtx) {
  ctx = canvasCtx;
  await preloadImages();
}

// Helper: draw scaled rect
export function drawRect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * SCALE, y * SCALE, w * SCALE, h * SCALE);
}

// Draw character (128x128, scaled 2x from 64x64)
export function drawCharacter(eyeType, currentState, currentCharacter, animFrame) {
  const state = states[currentState] || states.idle;
  const char = CHARACTER_CONFIG[currentCharacter] || CHARACTER_CONFIG[DEFAULT_CHARACTER];

  // Clear with background color
  ctx.fillStyle = state.bgColor;
  ctx.fillRect(0, 0, CHAR_SIZE, CHAR_SIZE);

  // Draw matrix background for working state (behind character)
  if (currentState === 'working') {
    drawMatrixBackground(animFrame, drawRect, CHAR_SIZE / SCALE);
  }

  // Draw character image
  if (hasImage(currentCharacter)) {
    const img = characterImages[currentCharacter];
    ctx.drawImage(img, 0, 0, CHAR_SIZE, CHAR_SIZE);
  }

  // Draw eyes (for all characters)
  drawEyes(eyeType, char, animFrame, drawRect);
}
