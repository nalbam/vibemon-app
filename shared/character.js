import { CHAR_SIZE, SCALE, CHARACTER_CONFIG, DEFAULT_CHARACTER, states } from './config.js';
import { drawEyes } from './effects.js';

let ctx = null;

// Initialize renderer with canvas context
export function initRenderer(canvasCtx) {
  ctx = canvasCtx;
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

  if (char.isGhost) {
    // Ghost body (rounded top effect with multiple rects)
    drawRect(char.body.x + 4, char.body.y, char.body.w - 8, 4, char.color);
    drawRect(char.body.x + 2, char.body.y + 2, char.body.w - 4, 4, char.color);
    drawRect(char.body.x, char.body.y + 4, char.body.w, char.body.h - 4, char.color);
  } else {
    // Standard rectangular body
    drawRect(char.body.x, char.body.y, char.body.w, char.body.h, char.color);
  }

  // Arms (if exists)
  if (char.arms) {
    drawRect(char.arms.left.x, char.arms.left.y, char.arms.left.w, char.arms.left.h, char.color);
    drawRect(char.arms.right.x, char.arms.right.y, char.arms.right.w, char.arms.right.h, char.color);
  }

  // Legs or Tail
  if (char.tail && char.tail.length > 0) {
    char.tail.forEach(t => drawRect(t.x, t.y, t.w, t.h, char.color));
  } else if (char.legs && char.legs.length > 0) {
    char.legs.forEach(leg => drawRect(leg.x, leg.y, leg.w, leg.h, char.color));
  }

  // Draw eyes
  drawEyes(eyeType, char, animFrame, drawRect);
}

// Get context for external use
export function getContext() {
  return ctx;
}
