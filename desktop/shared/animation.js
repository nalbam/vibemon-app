// Shared animation utilities
import {
  FLOAT_AMPLITUDE_X, FLOAT_AMPLITUDE_Y,
  FLOAT_CYCLE_FRAMES, BLINK_START_FRAME, BLINK_END_FRAME
} from './config.js';

// Calculate floating X offset using cosine wave (~3.2 second cycle at 100ms interval)
export function getFloatOffsetX(animFrame) {
  const angle = (animFrame % FLOAT_CYCLE_FRAMES) * (2.0 * Math.PI / FLOAT_CYCLE_FRAMES);
  return Math.cos(angle) * FLOAT_AMPLITUDE_X;
}

// Calculate floating Y offset using sine wave
export function getFloatOffsetY(animFrame) {
  const angle = (animFrame % FLOAT_CYCLE_FRAMES) * (2.0 * Math.PI / FLOAT_CYCLE_FRAMES);
  return Math.sin(angle) * FLOAT_AMPLITUDE_Y;
}

// Check if animation frame requires redraw for given state
export function needsAnimationRedraw(state, animFrame, blinkFrame) {
  switch (state) {
    case 'start':
    case 'thinking':
    case 'planning':
    case 'working':
    case 'sleep':
      return true;  // Always animate these states
    case 'idle':
      return blinkFrame === BLINK_START_FRAME || blinkFrame === BLINK_END_FRAME;  // Only during blink
    default:
      return false;
  }
}
