import { COLOR_EYE, COLOR_WHITE, CHARACTER_CONFIG, DEFAULT_CHARACTER } from './config.js';

// Effect color for white characters (yellow)
const COLOR_EFFECT_ALT = '#FFFF00';

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
  const effectColor = getEffectColor(char);

  switch (eyeType) {
    case 'normal':
      drawRect(leftX, eyeY, 6, 6, COLOR_EYE);
      drawRect(rightX, eyeY, 6, 6, COLOR_EYE);
      break;

    case 'focused':
      drawRect(leftX, eyeY + 2, 6, 3, COLOR_EYE);
      drawRect(rightX, eyeY + 2, 6, 3, COLOR_EYE);
      break;

    case 'alert':
      drawRect(leftX + 1, eyeY, 4, 6, COLOR_EYE);
      drawRect(leftX, eyeY + 1, 6, 4, COLOR_EYE);
      drawRect(rightX + 1, eyeY, 4, 6, COLOR_EYE);
      drawRect(rightX, eyeY + 1, 6, 4, COLOR_EYE);
      drawQuestionMark(50, 2, drawRect);
      break;

    case 'sparkle':
      drawRect(leftX, eyeY, 6, 6, COLOR_EYE);
      drawRect(rightX, eyeY, 6, 6, COLOR_EYE);
      drawSparkle(50, 8, animFrame, drawRect, effectColor);
      break;

    case 'happy':
      // Left eye - downward V
      drawRect(leftX + 2, eyeY, 2, 2, COLOR_EYE);
      drawRect(leftX + 1, eyeY + 2, 2, 2, COLOR_EYE);
      drawRect(leftX + 3, eyeY + 2, 2, 2, COLOR_EYE);
      drawRect(leftX, eyeY + 4, 2, 2, COLOR_EYE);
      drawRect(leftX + 4, eyeY + 4, 2, 2, COLOR_EYE);
      // Right eye - downward V
      drawRect(rightX + 2, eyeY, 2, 2, COLOR_EYE);
      drawRect(rightX + 1, eyeY + 2, 2, 2, COLOR_EYE);
      drawRect(rightX + 3, eyeY + 2, 2, 2, COLOR_EYE);
      drawRect(rightX, eyeY + 4, 2, 2, COLOR_EYE);
      drawRect(rightX + 4, eyeY + 4, 2, 2, COLOR_EYE);
      break;

    case 'blink':
      drawRect(leftX, eyeY + 2, 6, 2, COLOR_EYE);
      drawRect(rightX, eyeY + 2, 6, 2, COLOR_EYE);
      break;

    case 'sleep':
      drawRect(leftX, eyeY + 2, 6, 2, COLOR_EYE);
      drawRect(rightX, eyeY + 2, 6, 2, COLOR_EYE);
      drawZzz(50, 6, animFrame, drawRect, effectColor);
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
