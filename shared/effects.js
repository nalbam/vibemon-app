import { COLOR_EYE, COLOR_WHITE, CHARACTER_CONFIG, DEFAULT_CHARACTER } from './config.js';

// Effect color for white characters (orange)
const COLOR_EFFECT_ALT = '#FFA500';

// Get effect color based on character color
function getEffectColor(char) {
  return char.color === '#FFFFFF' ? COLOR_EFFECT_ALT : COLOR_WHITE;
}

// Draw eyes (scaled 2x)
export function drawEyes(eyeType, char, animFrame, drawRect) {
  char = char || CHARACTER_CONFIG[DEFAULT_CHARACTER];
  const leftX = char.eyes.left.x;
  const rightX = char.eyes.right.x;
  const eyeY = char.eyes.left.y;
  // Support separate width/height or fallback to size
  const eyeW = char.eyes.w || char.eyes.size || 6;
  const eyeH = char.eyes.h || char.eyes.size || 6;
  const effectColor = getEffectColor(char);

  // Effect position (relative to character, above eyes)
  const effectX = rightX + eyeW + 2;
  const effectY = eyeY - 18;

  switch (eyeType) {
    case 'normal':
      drawRect(leftX, eyeY, eyeW, eyeH, COLOR_EYE);
      drawRect(rightX, eyeY, eyeW, eyeH, COLOR_EYE);
      break;

    case 'focused':
      drawRect(leftX, eyeY + Math.floor(eyeH/3), eyeW, Math.floor(eyeH/2), COLOR_EYE);
      drawRect(rightX, eyeY + Math.floor(eyeH/3), eyeW, Math.floor(eyeH/2), COLOR_EYE);
      drawMatrix(effectX, effectY, animFrame, drawRect);
      break;

    case 'alert':
      // Round eyes for alert
      drawRect(leftX + 1, eyeY, eyeW - 2, eyeH, COLOR_EYE);
      drawRect(leftX, eyeY + 1, eyeW, eyeH - 2, COLOR_EYE);
      drawRect(rightX + 1, eyeY, eyeW - 2, eyeH, COLOR_EYE);
      drawRect(rightX, eyeY + 1, eyeW, eyeH - 2, COLOR_EYE);
      drawQuestionMark(effectX, effectY, drawRect);
      break;

    case 'sparkle':
      drawRect(leftX, eyeY, eyeW, eyeH, COLOR_EYE);
      drawRect(rightX, eyeY, eyeW, eyeH, COLOR_EYE);
      drawSparkle(effectX, effectY + 2, animFrame, drawRect, effectColor);
      break;

    case 'happy': {
      // Happy eyes (^ ^) - use eye width for sizing
      const unit = Math.max(2, Math.floor(eyeW / 2));
      drawRect(leftX + unit, eyeY, unit, unit, COLOR_EYE);
      drawRect(leftX, eyeY + unit, unit, unit, COLOR_EYE);
      drawRect(leftX + eyeW - unit, eyeY + unit, unit, unit, COLOR_EYE);
      drawRect(rightX + unit, eyeY, unit, unit, COLOR_EYE);
      drawRect(rightX, eyeY + unit, unit, unit, COLOR_EYE);
      drawRect(rightX + eyeW - unit, eyeY + unit, unit, unit, COLOR_EYE);
      break;
    }

    case 'thinking': {
      // Thinking eyes - looking up (pupils at top)
      const pupilH = Math.max(2, Math.floor(eyeH / 3));
      // Draw pupils at top of eyes
      drawRect(leftX + 1, eyeY, eyeW - 2, pupilH, COLOR_EYE);
      drawRect(rightX + 1, eyeY, eyeW - 2, pupilH, COLOR_EYE);
      // Draw thought bubble effect
      drawThoughtBubble(effectX, effectY, animFrame, drawRect, effectColor);
      break;
    }

    case 'blink':
      drawRect(leftX, eyeY + Math.floor(eyeH/3), eyeW, Math.floor(eyeH/3), COLOR_EYE);
      drawRect(rightX, eyeY + Math.floor(eyeH/3), eyeW, Math.floor(eyeH/3), COLOR_EYE);
      break;

    case 'sleep':
      drawRect(leftX, eyeY + Math.floor(eyeH/3), eyeW, Math.floor(eyeH/3), COLOR_EYE);
      drawRect(rightX, eyeY + Math.floor(eyeH/3), eyeW, Math.floor(eyeH/3), COLOR_EYE);
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

// Matrix rain colors (green shades only)
const COLOR_MATRIX_BRIGHT = '#00FF00';
const COLOR_MATRIX_MID = '#00AA00';
const COLOR_MATRIX_DIM = '#006600';

// Draw matrix rain effect for working state (falling green squares)
export function drawMatrix(x, y, animFrame, drawRect) {
  const height = 24;

  // Stream 1 - left column
  const pos1 = (animFrame * 3) % height;
  drawRect(x, y + pos1, 2, 2, COLOR_MATRIX_BRIGHT);
  if (pos1 >= 3) drawRect(x, y + pos1 - 3, 2, 2, COLOR_MATRIX_MID);
  if (pos1 >= 6) drawRect(x, y + pos1 - 6, 2, 2, COLOR_MATRIX_DIM);

  // Stream 2 - center column (different phase)
  const pos2 = (animFrame * 3 + 8) % height;
  drawRect(x + 4, y + pos2, 2, 2, COLOR_MATRIX_BRIGHT);
  if (pos2 >= 3) drawRect(x + 4, y + pos2 - 3, 2, 2, COLOR_MATRIX_MID);
  if (pos2 >= 6) drawRect(x + 4, y + pos2 - 6, 2, 2, COLOR_MATRIX_DIM);

  // Stream 3 - right column (different phase)
  const pos3 = (animFrame * 3 + 16) % height;
  drawRect(x + 8, y + pos3, 2, 2, COLOR_MATRIX_BRIGHT);
  if (pos3 >= 3) drawRect(x + 8, y + pos3 - 3, 2, 2, COLOR_MATRIX_MID);
  if (pos3 >= 6) drawRect(x + 8, y + pos3 - 6, 2, 2, COLOR_MATRIX_DIM);
}
