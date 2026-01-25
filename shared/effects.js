import {
  COLOR_EYE, COLOR_WHITE, CHARACTER_CONFIG, DEFAULT_CHARACTER,
  MATRIX_STREAM_DENSITY, MATRIX_SPEED_MIN, MATRIX_SPEED_MAX,
  MATRIX_COLUMN_WIDTH, MATRIX_FLICKER_PERIOD,
  MATRIX_TAIL_LENGTH_FAST, MATRIX_TAIL_LENGTH_SLOW
} from './config.js';

// Effect color for white characters (orange)
const COLOR_EFFECT_ALT = '#FFA500';

// Sunglasses colors
const COLOR_SUNGLASSES_FRAME = '#111111';
const COLOR_SUNGLASSES_LENS = '#001100';
const COLOR_SUNGLASSES_SHINE = '#003300';

// Get eye cover position (used by sunglasses and sleep eyes)
function getEyeCoverPosition(leftX, rightX, eyeY, eyeW, eyeH, isKiro = false) {
  const lensW = eyeW + 4;
  const lensH = eyeH + 2;
  // Kiro: shift up 2px
  const lensY = eyeY - 1 - (isKiro ? 2 : 0);
  // Kiro: left lens 2px right, right lens 6px right
  const leftLensX = leftX - 2 + (isKiro ? 2 : 0);
  const rightLensX = rightX - 2 + (isKiro ? 6 : 0);
  return { lensW, lensH, lensY, leftLensX, rightLensX };
}

// Draw sunglasses (Matrix style)
function drawSunglasses(leftX, rightX, eyeY, eyeW, eyeH, drawRect, isKiro = false) {
  const { lensW, lensH, lensY, leftLensX, rightLensX } = getEyeCoverPosition(leftX, rightX, eyeY, eyeW, eyeH, isKiro);

  // Sunglasses colors (same for all characters)
  const frameColor = COLOR_SUNGLASSES_FRAME;
  const lensColor = COLOR_SUNGLASSES_LENS;
  const shineColor = COLOR_SUNGLASSES_SHINE;

  // Left lens (dark green tint)
  drawRect(leftLensX, lensY, lensW, lensH, lensColor);
  // Left lens shine
  drawRect(leftLensX + 1, lensY + 1, 2, 1, shineColor);

  // Right lens (dark green tint)
  drawRect(rightLensX, lensY, lensW, lensH, lensColor);
  // Right lens shine
  drawRect(rightLensX + 1, lensY + 1, 2, 1, shineColor);

  // Frame - top
  drawRect(leftLensX - 1, lensY - 1, lensW + 2, 1, frameColor);
  drawRect(rightLensX - 1, lensY - 1, lensW + 2, 1, frameColor);

  // Frame - bottom
  drawRect(leftLensX - 1, lensY + lensH, lensW + 2, 1, frameColor);
  drawRect(rightLensX - 1, lensY + lensH, lensW + 2, 1, frameColor);

  // Frame - sides
  drawRect(leftLensX - 1, lensY, 1, lensH, frameColor);
  drawRect(leftLensX + lensW, lensY, 1, lensH, frameColor);
  drawRect(rightLensX - 1, lensY, 1, lensH, frameColor);
  drawRect(rightLensX + lensW, lensY, 1, lensH, frameColor);

  // Bridge (connects two lenses)
  const bridgeY = lensY + Math.floor(lensH / 2);
  drawRect(leftLensX + lensW, bridgeY, rightLensX - leftLensX - lensW, 1, frameColor);
}

// Draw sleep eyes (closed eyes with body color background)
function drawSleepEyes(leftX, rightX, eyeY, eyeW, eyeH, drawRect, bodyColor, isKiro = false) {
  const { lensW, lensH, lensY, leftLensX, rightLensX } = getEyeCoverPosition(leftX, rightX, eyeY, eyeW, eyeH, isKiro);

  // Cover original eyes with body color (same area as sunglasses)
  drawRect(leftLensX, lensY, lensW, lensH, bodyColor);
  drawRect(rightLensX, lensY, lensW, lensH, bodyColor);

  // Draw closed eyes (horizontal lines in the middle)
  const closedEyeY = lensY + Math.floor(lensH / 2);
  const closedEyeH = 2;  // 2px thick line
  drawRect(leftLensX + 1, closedEyeY, lensW - 2, closedEyeH, COLOR_EYE);
  drawRect(rightLensX + 1, closedEyeY, lensW - 2, closedEyeH, COLOR_EYE);
}

// Get effect color based on character color
function getEffectColor(char) {
  return char.color === '#FFFFFF' ? COLOR_EFFECT_ALT : COLOR_WHITE;
}

// Draw eyes (scaled 2x)
// Note: Eyes are now part of character images, only draw effects and sunglasses
export function drawEyes(eyeType, char, animFrame, drawRect) {
  char = char || CHARACTER_CONFIG[DEFAULT_CHARACTER];
  const leftX = char.eyes.left.x;
  const rightX = char.eyes.right.x;
  const eyeY = char.eyes.left.y;
  // Support separate width/height or fallback to size
  const eyeW = char.eyes.w || char.eyes.size || 6;
  const eyeH = char.eyes.h || char.eyes.size || 6;
  const isKiro = char.name === 'kiro';
  const effectColor = getEffectColor(char);

  // Effect position (relative to character, above eyes)
  const effectX = rightX + eyeW + 2;
  const effectY = eyeY - 18;

  switch (eyeType) {
    case 'focused':
      // Sunglasses for Matrix style (working state)
      drawSunglasses(leftX, rightX, eyeY, eyeW, eyeH, drawRect, isKiro);
      break;

    case 'alert':
      // Question mark effect (notification state)
      drawQuestionMark(effectX, effectY, drawRect);
      break;

    case 'sparkle':
      // Sparkle effect (start state)
      drawSparkle(effectX, effectY + 2, animFrame, drawRect, effectColor);
      break;

    case 'thinking':
      // Thought bubble effect (thinking state)
      drawThoughtBubble(effectX, effectY, animFrame, drawRect, effectColor);
      break;

    case 'sleep':
      // Sleep eyes (closed eyes) and Zzz effect
      drawSleepEyes(leftX, rightX, eyeY, eyeW, eyeH, drawRect, char.color, isKiro);
      drawZzz(effectX, effectY, animFrame, drawRect, effectColor);
      break;
  }
}

// Draw sparkle (scaled 2x)
export function drawSparkle(x, y, animFrame, drawRect, color = COLOR_WHITE) {
  const frame = animFrame % 4;
  drawRect(x + 2, y + 2, 2, 2, color);

  if (frame === 0 || frame === 2) {
    drawRect(x + 2, y, 2, 2, color);
    drawRect(x + 2, y + 4, 2, 2, color);
    drawRect(x, y + 2, 2, 2, color);
    drawRect(x + 4, y + 2, 2, 2, color);
  } else {
    drawRect(x, y, 2, 2, color);
    drawRect(x + 4, y, 2, 2, color);
    drawRect(x, y + 4, 2, 2, color);
    drawRect(x + 4, y + 4, 2, 2, color);
  }
}

// Draw question mark
export function drawQuestionMark(x, y, drawRect) {
  const color = '#000000';
  drawRect(x + 1, y, 4, 2, color);
  drawRect(x + 4, y + 2, 2, 2, color);
  drawRect(x + 2, y + 4, 2, 2, color);
  drawRect(x + 2, y + 6, 2, 2, color);
  drawRect(x + 2, y + 10, 2, 2, color);
}

// Draw Zzz animation for sleep state
export function drawZzz(x, y, animFrame, drawRect, color = COLOR_WHITE) {
  const frame = animFrame % 20;
  if (frame < 10) {
    drawRect(x, y, 6, 1, color);
    drawRect(x + 4, y + 1, 2, 1, color);
    drawRect(x + 3, y + 2, 2, 1, color);
    drawRect(x + 2, y + 3, 2, 1, color);
    drawRect(x + 1, y + 4, 2, 1, color);
    drawRect(x, y + 5, 6, 1, color);
  }
}

// Draw thought bubble animation for thinking state
export function drawThoughtBubble(x, y, animFrame, drawRect, color = COLOR_WHITE) {
  const frame = animFrame % 12;
  // Small dots leading to bubble (always visible)
  drawRect(x, y + 6, 2, 2, color);
  drawRect(x + 2, y + 3, 2, 2, color);
  // Main bubble (animated size)
  if (frame < 6) {
    // Larger bubble
    drawRect(x + 3, y - 2, 6, 2, color);
    drawRect(x + 2, y, 8, 3, color);
    drawRect(x + 3, y + 3, 6, 1, color);
  } else {
    // Smaller bubble
    drawRect(x + 4, y - 1, 4, 2, color);
    drawRect(x + 3, y + 1, 6, 2, color);
  }
}

// Matrix rain colors (green shades - movie style)
const COLOR_MATRIX_WHITE = '#CCFFCC';
const COLOR_MATRIX_BRIGHT = '#00FF00';
const COLOR_MATRIX_MID = '#00BB00';
const COLOR_MATRIX_DIM = '#008800';
const COLOR_MATRIX_DARK = '#004400';

// Pseudo-random number generator for consistent randomness
function pseudoRandom(seed) {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

// Draw matrix background effect (full area, movie style)
export function drawMatrixBackground(animFrame, drawRect, size = 64, body = null) {
  // Draw streams across entire area (character will be drawn on top)
  const streamCount = Math.floor(size / MATRIX_COLUMN_WIDTH);
  for (let i = 0; i < streamCount; i++) {
    const seed = i * 23 + 7;
    // Show streams based on density setting
    if (pseudoRandom(seed + 100) > MATRIX_STREAM_DENSITY) continue;
    const x = i * MATRIX_COLUMN_WIDTH;
    const offset = Math.floor(pseudoRandom(seed) * size);
    // Variable speed
    const speedRange = MATRIX_SPEED_MAX - MATRIX_SPEED_MIN + 1;
    const speed = MATRIX_SPEED_MIN + Math.floor(pseudoRandom(seed + 1) * speedRange);
    // Variable tail length based on speed
    const tailLen = speed > 3 ? MATRIX_TAIL_LENGTH_FAST : MATRIX_TAIL_LENGTH_SLOW;
    drawMatrixStreamMovie(x, 0, animFrame, drawRect, offset, size, speed, tailLen, seed);
  }
}

// Draw matrix stream with movie-style effect
function drawMatrixStreamMovie(x, y, animFrame, drawRect, offset, height, speed, tailLen, seed) {
  if (height < MATRIX_COLUMN_WIDTH) return;
  const pos = (animFrame * speed + offset) % height;

  // Head: bright white/green (flicker effect)
  const flicker = (animFrame + seed) % MATRIX_FLICKER_PERIOD === 0;
  const headColor = flicker ? COLOR_MATRIX_WHITE : COLOR_MATRIX_BRIGHT;
  drawRect(x, y + pos, 2, 2, headColor);

  // Tail with gradient
  if (pos >= 2) drawRect(x, y + pos - 2, 2, 2, COLOR_MATRIX_BRIGHT);
  if (pos >= 4) drawRect(x, y + pos - 4, 2, 2, COLOR_MATRIX_MID);
  if (pos >= 6) drawRect(x, y + pos - 6, 2, 2, COLOR_MATRIX_MID);
  if (tailLen >= 8 && pos >= 8) drawRect(x, y + pos - 8, 2, 2, COLOR_MATRIX_DIM);
  if (tailLen >= 8 && pos >= 10) drawRect(x, y + pos - 10, 2, 2, COLOR_MATRIX_DARK);
}
