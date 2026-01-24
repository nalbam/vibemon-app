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
  const eyeSize = char.eyes.size || 6;
  const effectColor = getEffectColor(char);

  // Effect position (relative to character)
  const effectX = rightX + eyeSize + 2;
  const effectY = eyeY - 4;

  switch (eyeType) {
    case 'normal':
      drawRect(leftX, eyeY, eyeSize, eyeSize, COLOR_EYE);
      drawRect(rightX, eyeY, eyeSize, eyeSize, COLOR_EYE);
      break;

    case 'focused':
      drawRect(leftX, eyeY + Math.floor(eyeSize/3), eyeSize, Math.floor(eyeSize/2), COLOR_EYE);
      drawRect(rightX, eyeY + Math.floor(eyeSize/3), eyeSize, Math.floor(eyeSize/2), COLOR_EYE);
      break;

    case 'alert':
      // Round eyes for alert
      drawRect(leftX + 1, eyeY, eyeSize - 2, eyeSize, COLOR_EYE);
      drawRect(leftX, eyeY + 1, eyeSize, eyeSize - 2, COLOR_EYE);
      drawRect(rightX + 1, eyeY, eyeSize - 2, eyeSize, COLOR_EYE);
      drawRect(rightX, eyeY + 1, eyeSize, eyeSize - 2, COLOR_EYE);
      drawQuestionMark(effectX, effectY, drawRect);
      break;

    case 'sparkle':
      drawRect(leftX, eyeY, eyeSize, eyeSize, COLOR_EYE);
      drawRect(rightX, eyeY, eyeSize, eyeSize, COLOR_EYE);
      drawSparkle(effectX, effectY + 2, animFrame, drawRect, effectColor);
      break;

    case 'happy':
      // Simplified happy eyes (^ ^) - scaled to eye size
      const unit = Math.max(1, Math.floor(eyeSize / 3));
      drawRect(leftX + unit, eyeY, unit, unit, COLOR_EYE);
      drawRect(leftX, eyeY + unit, unit, unit, COLOR_EYE);
      drawRect(leftX + unit * 2, eyeY + unit, unit, unit, COLOR_EYE);
      drawRect(rightX + unit, eyeY, unit, unit, COLOR_EYE);
      drawRect(rightX, eyeY + unit, unit, unit, COLOR_EYE);
      drawRect(rightX + unit * 2, eyeY + unit, unit, unit, COLOR_EYE);
      break;

    case 'blink':
      drawRect(leftX, eyeY + Math.floor(eyeSize/3), eyeSize, Math.floor(eyeSize/3), COLOR_EYE);
      drawRect(rightX, eyeY + Math.floor(eyeSize/3), eyeSize, Math.floor(eyeSize/3), COLOR_EYE);
      break;

    case 'sleep':
      drawRect(leftX, eyeY + Math.floor(eyeSize/3), eyeSize, Math.floor(eyeSize/3), COLOR_EYE);
      drawRect(rightX, eyeY + Math.floor(eyeSize/3), eyeSize, Math.floor(eyeSize/3), COLOR_EYE);
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
