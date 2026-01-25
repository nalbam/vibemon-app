import { CHAR_SIZE, SCALE, CHARACTER_CONFIG, DEFAULT_CHARACTER, states } from './config.js';
import { drawEyes, drawMatrixBackground } from './effects.js';
import { hasSprite, getSprite, drawSprite } from './sprites.js';

let ctx = null;

// Character images cache
const characterImages = {};
let imagesLoaded = false;

// Image paths for each character
const CHARACTER_IMAGES = {
  clawd: '../images/clawd-128.png',
  kiro: '../images/kiro-128.png'
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
export function initRenderer(canvasCtx) {
  ctx = canvasCtx;
  preloadImages();
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
    drawMatrixBackground(animFrame, drawRect, CHAR_SIZE / SCALE, char.body);
  }

  // Use image if available
  if (hasImage(currentCharacter)) {
    const img = characterImages[currentCharacter];
    ctx.drawImage(img, 0, 0, CHAR_SIZE, CHAR_SIZE);
  } else if (hasSprite(currentCharacter)) {
    // Fallback to sprite-based rendering
    const { sprite, palette } = getSprite(currentCharacter);
    drawSprite(ctx, sprite, palette, state.bgColor, SCALE);
  } else if (char.isGhost) {
    // Ghost body (rounded egg/chick shape) - fallback geometry
    const bx = char.body.x;
    const by = char.body.y;
    const bw = char.body.w;
    const bh = char.body.h;

    // Rounded top (gradual curve)
    drawRect(bx + 10, by, bw - 20, 2, char.color);
    drawRect(bx + 6, by + 2, bw - 12, 2, char.color);
    drawRect(bx + 4, by + 4, bw - 8, 2, char.color);
    drawRect(bx + 2, by + 6, bw - 4, 2, char.color);

    // Main body (middle)
    drawRect(bx, by + 8, bw, bh - 16, char.color);

    // Rounded bottom (gradual curve)
    drawRect(bx + 2, by + bh - 8, bw - 4, 2, char.color);
    drawRect(bx + 4, by + bh - 6, bw - 8, 2, char.color);
    drawRect(bx + 6, by + bh - 4, bw - 12, 2, char.color);
    drawRect(bx + 10, by + bh - 2, bw - 20, 2, char.color);

    // Draw tail parts
    if (char.tail && char.tail.length > 0) {
      char.tail.forEach(t => {
        if (t.round) {
          const cx = t.x;
          const cy = t.y;
          const s = t.w;
          drawRect(cx + 2, cy, s - 4, 2, char.color);
          drawRect(cx + 1, cy + 2, s - 2, s - 4, char.color);
          drawRect(cx + 2, cy + s - 2, s - 4, 2, char.color);
        } else {
          drawRect(t.x, t.y, t.w, t.h, char.color);
        }
      });
    }
  } else {
    // Standard rectangular body
    drawRect(char.body.x, char.body.y, char.body.w, char.body.h, char.color);

    // Arms (if exists)
    if (char.arms) {
      drawRect(char.arms.left.x, char.arms.left.y, char.arms.left.w, char.arms.left.h, char.color);
      drawRect(char.arms.right.x, char.arms.right.y, char.arms.right.w, char.arms.right.h, char.color);
    }

    // Legs
    if (char.legs && char.legs.length > 0) {
      char.legs.forEach(leg => drawRect(leg.x, leg.y, leg.w, leg.h, char.color));
    }
  }

  // Draw eyes (for all characters)
  drawEyes(eyeType, char, animFrame, drawRect);
}
