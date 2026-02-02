/**
 * VibeMon Engine - Standalone Version
 * Complete rendering engine for VibeMon in a single file
 *
 * This self-contained module includes:
 * - Character rendering (canvas, images, animations)
 * - State display (background color, state text, loading dots)
 * - Info display (project, tool, model, memory)
 * - Memory bar rendering
 * - Icon rendering (pixel art and emoji)
 * - All animations and effects
 *
 * Usage:
 *   const engine = createVibeMonEngine(canvas, domElements, { useEmoji: true });
 *   await engine.init();
 *   engine.setState({ state: 'working', tool: 'Bash' });
 *   engine.render();
 *   engine.startAnimation();
 *
 * Character images must be provided via options.characterImages or loaded from URLs
 */

// =============================================================================
// CONSTANTS AND CONFIGURATION DATA
// =============================================================================

const CONSTANTS = {
  DEFAULT_CHARACTER: "clawd",
  CHAR_SIZE: 128,
  SCALE: 2,
  COLOR_EYE: "#000000",
  COLOR_WHITE: "#FFFFFF",
  FLOAT_AMPLITUDE_X: 3,
  FLOAT_AMPLITUDE_Y: 5,
  CHAR_X_BASE: 22,
  CHAR_Y_BASE: 20,
  FRAME_INTERVAL: 100,
  FLOAT_CYCLE_FRAMES: 32,
  LOADING_DOT_COUNT: 4,
  THINKING_ANIMATION_SLOWDOWN: 3,
  BLINK_START_FRAME: 30,
  BLINK_END_FRAME: 31,
  PROJECT_NAME_MAX_LENGTH: 20,
  PROJECT_NAME_TRUNCATE_AT: 17,
  MODEL_NAME_MAX_LENGTH: 14,
  MODEL_NAME_TRUNCATE_AT: 11,
  MATRIX_STREAM_DENSITY: 0.7,
  MATRIX_SPEED_MIN: 1,
  MATRIX_SPEED_MAX: 6,
  MATRIX_COLUMN_WIDTH: 4,
  MATRIX_FLICKER_PERIOD: 3,
  MATRIX_TAIL_LENGTH_FAST: 8,
  MATRIX_TAIL_LENGTH_SLOW: 6
};

const STATES = {
  "start": {
    "bgColor": "#00CCCC",
    "text": "Hello!",
    "eyeType": "normal",
    "effect": "sparkle",
    "showLoading": false,
    "textColor": "#000000"
  },
  "idle": {
    "bgColor": "#00AA00",
    "text": "Ready",
    "eyeType": "normal",
    "effect": "none",
    "showLoading": false,
    "textColor": "#FFFFFF"
  },
  "thinking": {
    "bgColor": "#9933FF",
    "text": "Thinking",
    "eyeType": "normal",
    "effect": "thinking",
    "showLoading": true,
    "textColor": "#FFFFFF"
  },
  "planning": {
    "bgColor": "#008888",
    "text": "Planning",
    "eyeType": "normal",
    "effect": "thinking",
    "showLoading": true,
    "textColor": "#FFFFFF"
  },
  "working": {
    "bgColor": "#0066CC",
    "text": "Working",
    "eyeType": "focused",
    "effect": "sparkle",
    "showLoading": true,
    "textColor": "#FFFFFF"
  },
  "packing": {
    "bgColor": "#AAAAAA",
    "text": "Packing",
    "eyeType": "normal",
    "effect": "thinking",
    "showLoading": true,
    "textColor": "#000000"
  },
  "notification": {
    "bgColor": "#FFCC00",
    "text": "Input?",
    "eyeType": "normal",
    "effect": "alert",
    "showLoading": false,
    "textColor": "#000000"
  },
  "sleep": {
    "bgColor": "#111144",
    "text": "Zzz...",
    "eyeType": "blink",
    "effect": "zzz",
    "showLoading": false,
    "textColor": "#FFFFFF"
  },
  "done": {
    "bgColor": "#00AA00",
    "text": "Done!",
    "eyeType": "happy",
    "effect": "none",
    "showLoading": false,
    "textColor": "#FFFFFF"
  }
};

const CHARACTER_CONFIG = {
  "clawd": {
    "name": "clawd",
    "displayName": "Clawd",
    "color": "#D97757",
    "eyes": { "left": { "x": 14, "y": 22 }, "right": { "x": 44, "y": 22 }, "size": 6 },
    "effect": { "x": 52, "y": 4 }
  },
  "kiro": {
    "name": "kiro",
    "displayName": "Kiro",
    "color": "#FFFFFF",
    "eyes": { "left": { "x": 30, "y": 21 }, "right": { "x": 39, "y": 21 }, "w": 5, "h": 8 },
    "effect": { "x": 50, "y": 3 }
  },
  "claw": {
    "name": "claw",
    "displayName": "Claw",
    "color": "#DD4444",
    "eyes": { "left": { "x": 21, "y": 16 }, "right": { "x": 38, "y": 16 }, "size": 6 },
    "effect": { "x": 49, "y": 4 }
  }
};

const TEXTS = {
  "tools": {
    "bash": "Running",
    "read": "Reading",
    "edit": "Editing",
    "write": "Writing",
    "grep": "Searching",
    "glob": "Scanning",
    "task": "Working",
    "webfetch": "Fetching",
    "websearch": "Searching",
    "default": "Working"
  }
};

const DARK_BG_COLORS = Object.values(STATES)
  .filter(s => s.textColor === '#FFFFFF')
  .map(s => s.bgColor);

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getThinkingText() {
  return STATES.thinking.text;
}

function getPlanningText() {
  return STATES.planning.text;
}

function getWorkingText(tool) {
  const key = (tool || '').toLowerCase();
  return TEXTS.tools[key] || TEXTS.tools['default'];
}

function lerpColor(color1, color2, ratio) {
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

function getMemoryGradient(percent) {
  const green = '#00AA00';
  const yellow = '#FFCC00';
  const red = '#FF4444';

  let startColor, endColor;
  if (percent < 75) {
    const ratio = percent / 75;
    startColor = lerpColor(green, yellow, ratio * 0.5);
    endColor = lerpColor(green, yellow, Math.min(1, ratio * 0.5 + 0.3));
  } else if (percent < 90) {
    const ratio = (percent - 75) / 15;
    startColor = lerpColor(yellow, red, ratio * 0.5);
    endColor = lerpColor(yellow, red, Math.min(1, ratio * 0.5 + 0.3));
  } else {
    const ratio = (percent - 90) / 10;
    startColor = lerpColor(yellow, red, 0.5 + ratio * 0.25);
    endColor = lerpColor(yellow, red, Math.min(1, 0.5 + ratio * 0.25 + 0.3));
  }

  return `linear-gradient(to right, ${startColor}, ${endColor})`;
}

function getMemoryBarStyles(memoryUsage, bgColor) {
  if (memoryUsage === null || memoryUsage === undefined || memoryUsage <= 0) {
    return { display: 'none', containerStyles: null, barStyles: null };
  }

  const isDarkBg = DARK_BG_COLORS.includes(bgColor);
  const containerStyles = {
    borderColor: isDarkBg ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
    background: isDarkBg ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.3)'
  };

  const clampedPercent = Math.min(100, Math.max(0, memoryUsage));

  const barStyles = {
    width: clampedPercent + '%',
    background: getMemoryGradient(clampedPercent)
  };

  return { display: 'block', containerStyles, barStyles };
}

function updateMemoryBar(memoryUsage, bgColor, elements) {
  const memoryBar = elements?.memoryBar;
  const memoryBarContainer = elements?.memoryBarContainer;

  if (!memoryBar || !memoryBarContainer) return;

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

// =============================================================================
// ANIMATION FUNCTIONS
// =============================================================================

function getFloatOffsetX(animFrame) {
  const angle = (animFrame % CONSTANTS.FLOAT_CYCLE_FRAMES) * (2.0 * Math.PI / CONSTANTS.FLOAT_CYCLE_FRAMES);
  return Math.cos(angle) * CONSTANTS.FLOAT_AMPLITUDE_X;
}

function getFloatOffsetY(animFrame) {
  const angle = (animFrame % CONSTANTS.FLOAT_CYCLE_FRAMES) * (2.0 * Math.PI / CONSTANTS.FLOAT_CYCLE_FRAMES);
  return Math.sin(angle) * CONSTANTS.FLOAT_AMPLITUDE_Y;
}

function needsAnimationRedraw(state, animFrame, blinkFrame) {
  switch (state) {
    case 'start':
    case 'thinking':
    case 'planning':
    case 'working':
    case 'packing':
    case 'sleep':
      return true;
    case 'idle':
      return blinkFrame === CONSTANTS.BLINK_START_FRAME || blinkFrame === CONSTANTS.BLINK_END_FRAME;
    default:
      return false;
  }
}

// =============================================================================
// ICON RENDERING FUNCTIONS
// =============================================================================

let iconCache = null;

function initIconCache() {
  const iconProject = document.getElementById('icon-project');
  const iconTool = document.getElementById('icon-tool');
  const iconModel = document.getElementById('icon-model');
  const iconMemory = document.getElementById('icon-memory');

  iconCache = {
    emojiIcons: document.querySelectorAll('.emoji-icon'),
    pixelIcons: document.querySelectorAll('.pixel-icon'),
    canvases: [
      { canvas: iconProject, ctx: iconProject?.getContext('2d') },
      { canvas: iconTool, ctx: iconTool?.getContext('2d') },
      { canvas: iconModel, ctx: iconModel?.getContext('2d') },
      { canvas: iconMemory, ctx: iconMemory?.getContext('2d') }
    ]
  };
}

function drawFolderIcon(iconCtx, color) {
  iconCtx.fillStyle = color;
  iconCtx.fillRect(0, 0, 3, 1);
  iconCtx.fillRect(0, 1, 8, 6);
  iconCtx.fillStyle = '#000000';
  iconCtx.fillRect(1, 2, 6, 1);
}

function drawToolIcon(iconCtx, color) {
  iconCtx.fillStyle = color;
  iconCtx.fillRect(1, 0, 6, 3);
  iconCtx.fillStyle = '#000000';
  iconCtx.fillRect(3, 0, 2, 1);
  iconCtx.fillStyle = color;
  iconCtx.fillRect(3, 3, 2, 5);
}

function drawRobotIcon(iconCtx, color) {
  iconCtx.fillStyle = color;
  iconCtx.fillRect(3, 0, 2, 1);
  iconCtx.fillRect(1, 1, 6, 5);
  iconCtx.fillStyle = '#000000';
  iconCtx.fillRect(2, 2, 1, 2);
  iconCtx.fillRect(5, 2, 1, 2);
  iconCtx.fillRect(2, 5, 4, 1);
  iconCtx.fillStyle = color;
  iconCtx.fillRect(0, 2, 1, 2);
  iconCtx.fillRect(7, 2, 1, 2);
}

function drawBrainIcon(iconCtx, color) {
  iconCtx.fillStyle = color;
  iconCtx.fillRect(1, 0, 6, 7);
  iconCtx.fillRect(0, 1, 8, 5);
  iconCtx.fillStyle = '#000000';
  iconCtx.fillRect(4, 1, 1, 5);
  iconCtx.fillRect(2, 0, 1, 1);
  iconCtx.fillRect(5, 0, 1, 1);
}

function drawInfoIcons(color, bgColor, useEmoji) {
  if (!iconCache) initIconCache();

  const c = iconCache;

  c.emojiIcons.forEach(el => el.style.display = useEmoji ? 'inline' : 'none');
  c.pixelIcons.forEach(el => el.style.display = useEmoji ? 'none' : 'inline-block');

  if (!useEmoji) {
    const drawFuncs = [drawFolderIcon, drawToolIcon, drawRobotIcon, drawBrainIcon];

    c.canvases.forEach((item, index) => {
      if (item.ctx) {
        item.ctx.fillStyle = bgColor;
        item.ctx.fillRect(0, 0, 8, 8);
        drawFuncs[index](item.ctx, color);
      }
    });
  }
}

// =============================================================================
// CHARACTER AND EFFECTS RENDERING
// =============================================================================

const COLOR_EFFECT_ALT = '#FFA500';
const COLOR_SUNGLASSES_FRAME = '#111111';
const COLOR_SUNGLASSES_LENS = '#001100';
const COLOR_SUNGLASSES_SHINE = '#003300';

// Matrix effect state (per renderer instance)
const matrixStreams = [];

function initMatrixStreams() {
  const numColumns = Math.floor(64 / CONSTANTS.MATRIX_COLUMN_WIDTH);
  matrixStreams.length = 0;

  for (let i = 0; i < numColumns; i++) {
    if (Math.random() < CONSTANTS.MATRIX_STREAM_DENSITY) {
      matrixStreams.push({
        x: i * CONSTANTS.MATRIX_COLUMN_WIDTH,
        y: Math.floor(Math.random() * 64),
        speed: Math.floor(Math.random() * (CONSTANTS.MATRIX_SPEED_MAX - CONSTANTS.MATRIX_SPEED_MIN + 1)) + CONSTANTS.MATRIX_SPEED_MIN,
        tailLength: Math.random() < 0.3 ? CONSTANTS.MATRIX_TAIL_LENGTH_FAST : CONSTANTS.MATRIX_TAIL_LENGTH_SLOW
      });
    }
  }
}

function drawMatrixBackground(animFrame, drawRect, canvasSize) {
  if (matrixStreams.length === 0) initMatrixStreams();

  matrixStreams.forEach(stream => {
    const currentY = (stream.y + Math.floor(animFrame / stream.speed)) % (canvasSize + stream.tailLength);

    for (let i = 0; i < stream.tailLength; i++) {
      const y = currentY - i;
      if (y < 0 || y >= canvasSize) continue;

      let color;
      if (i === 0) {
        color = (animFrame % CONSTANTS.MATRIX_FLICKER_PERIOD === 0) ? '#FFFFFF' : '#00FF00';
      } else {
        const brightness = Math.floor(255 * (1 - i / stream.tailLength));
        const green = brightness.toString(16).padStart(2, '0');
        color = `#00${green}00`;
      }

      drawRect(stream.x, y, CONSTANTS.MATRIX_COLUMN_WIDTH - 1, 1, color);
    }
  });
}

function getEyeCoverPosition(leftX, rightX, eyeY, eyeW, eyeH, isKiro = false) {
  const lensW = eyeW + 4;
  const lensH = eyeH + 2;
  const lensY = eyeY - 1 - (isKiro ? 2 : 0);
  const leftLensX = leftX - 2 + (isKiro ? 2 : 0);
  const rightLensX = rightX - 2 + (isKiro ? 5 : 0);
  return { lensW, lensH, lensY, leftLensX, rightLensX };
}

function drawSunglasses(leftX, rightX, eyeY, eyeW, eyeH, drawRect, isKiro = false) {
  const { lensW, lensH, lensY, leftLensX, rightLensX } = getEyeCoverPosition(leftX, rightX, eyeY, eyeW, eyeH, isKiro);

  drawRect(leftLensX, lensY, lensW, lensH, COLOR_SUNGLASSES_LENS);
  drawRect(leftLensX + 1, lensY + 1, 2, 1, COLOR_SUNGLASSES_SHINE);
  drawRect(rightLensX, lensY, lensW, lensH, COLOR_SUNGLASSES_LENS);
  drawRect(rightLensX + 1, lensY + 1, 2, 1, COLOR_SUNGLASSES_SHINE);

  drawRect(leftLensX - 1, lensY - 1, lensW + 2, 1, COLOR_SUNGLASSES_FRAME);
  drawRect(rightLensX - 1, lensY - 1, lensW + 2, 1, COLOR_SUNGLASSES_FRAME);
  drawRect(leftLensX - 1, lensY + lensH, lensW + 2, 1, COLOR_SUNGLASSES_FRAME);
  drawRect(rightLensX - 1, lensY + lensH, lensW + 2, 1, COLOR_SUNGLASSES_FRAME);
  drawRect(leftLensX - 1, lensY, 1, lensH, COLOR_SUNGLASSES_FRAME);
  drawRect(leftLensX + lensW, lensY, 1, lensH, COLOR_SUNGLASSES_FRAME);
  drawRect(rightLensX - 1, lensY, 1, lensH, COLOR_SUNGLASSES_FRAME);
  drawRect(rightLensX + lensW, lensY, 1, lensH, COLOR_SUNGLASSES_FRAME);

  const bridgeY = lensY + Math.floor(lensH / 2);
  drawRect(leftLensX + lensW, bridgeY, rightLensX - leftLensX - lensW, 1, COLOR_SUNGLASSES_FRAME);
}

function drawBlinkEyes(leftX, rightX, eyeY, eyeW, eyeH, drawRect, bodyColor, isKiro = false) {
  const { lensW, lensH, lensY, leftLensX, rightLensX } = getEyeCoverPosition(leftX, rightX, eyeY, eyeW, eyeH, isKiro);

  drawRect(leftLensX, lensY, lensW, lensH, bodyColor);
  drawRect(rightLensX, lensY, lensW, lensH, bodyColor);

  const closedEyeY = lensY + Math.floor(lensH / 2);
  const closedEyeH = 2;
  drawRect(leftLensX + 1, closedEyeY, lensW - 2, closedEyeH, CONSTANTS.COLOR_EYE);
  drawRect(rightLensX + 1, closedEyeY, lensW - 2, closedEyeH, CONSTANTS.COLOR_EYE);
}

function drawHappyEyes(leftX, rightX, eyeY, eyeW, eyeH, drawRect, bodyColor, isKiro = false) {
  const { lensW, lensH, lensY, leftLensX, rightLensX } = getEyeCoverPosition(leftX, rightX, eyeY, eyeW, eyeH, isKiro);

  drawRect(leftLensX, lensY, lensW, lensH, bodyColor);
  drawRect(rightLensX, lensY, lensW, lensH, bodyColor);

  const centerY = lensY + Math.floor(lensH / 2);
  const leftCenterX = leftLensX + Math.floor(lensW / 2);
  const rightCenterX = rightLensX + Math.floor(lensW / 2);

  drawRect(leftCenterX - 2, centerY - 2, 2, 2, CONSTANTS.COLOR_EYE);
  drawRect(leftCenterX, centerY, 2, 2, CONSTANTS.COLOR_EYE);
  drawRect(leftCenterX - 2, centerY + 2, 2, 2, CONSTANTS.COLOR_EYE);

  drawRect(rightCenterX + 1, centerY - 2, 2, 2, CONSTANTS.COLOR_EYE);
  drawRect(rightCenterX - 1, centerY, 2, 2, CONSTANTS.COLOR_EYE);
  drawRect(rightCenterX + 1, centerY + 2, 2, 2, CONSTANTS.COLOR_EYE);
}

function drawEyeType(eyeType, char, animFrame, drawRect) {
  const isKiro = char.name === 'kiro';
  const leftX = char.eyes.left.x;
  const rightX = char.eyes.right.x;
  const eyeY = char.eyes.left.y;
  const eyeW = char.eyes.w || char.eyes.size || 6;
  const eyeH = char.eyes.h || char.eyes.size || 6;

  if (eyeType === 'focused') {
    drawSunglasses(leftX, rightX, eyeY, eyeW, eyeH, drawRect, isKiro);
  } else if (eyeType === 'blink') {
    drawBlinkEyes(leftX, rightX, eyeY, eyeW, eyeH, drawRect, char.color, isKiro);
  } else if (eyeType === 'happy') {
    drawHappyEyes(leftX, rightX, eyeY, eyeW, eyeH, drawRect, char.color, isKiro);
  }
}

function drawEffect(effect, char, animFrame, drawRect) {
  const effectX = char.effect.x;
  const effectY = char.effect.y;
  const isWhiteChar = char.color === CONSTANTS.COLOR_WHITE;
  const effectColor = isWhiteChar ? COLOR_EFFECT_ALT : CONSTANTS.COLOR_WHITE;

  if (effect === 'sparkle') {
    // 4-point star sparkle (matches ESP32)
    const frame = animFrame % 4;
    // Center dot (always visible)
    drawRect(effectX + 2, effectY + 2, 2, 2, effectColor);
    if (frame === 0 || frame === 2) {
      // Vertical and horizontal rays
      drawRect(effectX + 2, effectY, 2, 2, effectColor);
      drawRect(effectX + 2, effectY + 4, 2, 2, effectColor);
      drawRect(effectX, effectY + 2, 2, 2, effectColor);
      drawRect(effectX + 4, effectY + 2, 2, 2, effectColor);
    } else {
      // Diagonal rays
      drawRect(effectX, effectY, 2, 2, effectColor);
      drawRect(effectX + 4, effectY, 2, 2, effectColor);
      drawRect(effectX, effectY + 4, 2, 2, effectColor);
      drawRect(effectX + 4, effectY + 4, 2, 2, effectColor);
    }
  } else if (effect === 'thinking') {
    // Thought bubble with animation (matches ESP32)
    // Small dots leading to bubble (always visible)
    drawRect(effectX, effectY + 6, 2, 2, effectColor);
    drawRect(effectX + 2, effectY + 3, 2, 2, effectColor);
    // Main bubble (animated size)
    if ((animFrame % 12) < 6) {
      // Larger bubble
      drawRect(effectX + 3, effectY - 2, 6, 2, effectColor);
      drawRect(effectX + 2, effectY, 8, 3, effectColor);
      drawRect(effectX + 3, effectY + 3, 6, 1, effectColor);
    } else {
      // Smaller bubble
      drawRect(effectX + 4, effectY - 1, 4, 2, effectColor);
      drawRect(effectX + 3, effectY + 1, 6, 2, effectColor);
    }
  } else if (effect === 'alert') {
    // Question mark (matches ESP32)
    const color = '#000000'; // Dark on yellow background
    drawRect(effectX + 1, effectY, 4, 2, color);
    drawRect(effectX + 4, effectY + 2, 2, 2, color);
    drawRect(effectX + 2, effectY + 4, 2, 2, color);
    drawRect(effectX + 2, effectY + 6, 2, 2, color);
    drawRect(effectX + 2, effectY + 10, 2, 2, color);
  } else if (effect === 'zzz') {
    // Z with blink effect (matches ESP32)
    if ((animFrame % 20) < 10) {
      drawRect(effectX, effectY, 6, 1, effectColor);
      drawRect(effectX + 4, effectY + 1, 2, 1, effectColor);
      drawRect(effectX + 3, effectY + 2, 2, 1, effectColor);
      drawRect(effectX + 2, effectY + 3, 2, 1, effectColor);
      drawRect(effectX + 1, effectY + 4, 2, 1, effectColor);
      drawRect(effectX, effectY + 5, 6, 1, effectColor);
    }
  }
}

// =============================================================================
// CHARACTER RENDERING
// =============================================================================

class CharacterRenderer {
  constructor(ctx, characterImages) {
    this.ctx = ctx;
    this.characterImages = characterImages || {};
    this.imagesLoaded = false;
  }

  async preloadImages(imageUrls) {
    if (this.imagesLoaded) return Promise.resolve();

    const promises = Object.entries(imageUrls).map(([name, url]) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          this.characterImages[name] = img;
          resolve();
        };
        img.onerror = () => {
          console.warn(`Failed to load image for ${name}: ${url}`);
          resolve();
        };
        img.src = url;
      });
    });

    return Promise.all(promises).then(() => {
      this.imagesLoaded = true;
    });
  }

  hasImage(characterName) {
    return this.characterImages[characterName] !== undefined;
  }

  drawRect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x * CONSTANTS.SCALE, y * CONSTANTS.SCALE, w * CONSTANTS.SCALE, h * CONSTANTS.SCALE);
  }

  drawCharacter(eyeType, effect, currentState, currentCharacter, animFrame) {
    const state = STATES[currentState] || STATES.idle;
    const char = CHARACTER_CONFIG[currentCharacter] || CHARACTER_CONFIG[CONSTANTS.DEFAULT_CHARACTER];

    this.ctx.fillStyle = state.bgColor;
    this.ctx.fillRect(0, 0, CONSTANTS.CHAR_SIZE, CONSTANTS.CHAR_SIZE);

    if (effect === 'matrix') {
      drawMatrixBackground(animFrame, this.drawRect.bind(this), CONSTANTS.CHAR_SIZE / CONSTANTS.SCALE);
    }

    if (this.hasImage(currentCharacter)) {
      const img = this.characterImages[currentCharacter];
      this.ctx.drawImage(img, 0, 0, CONSTANTS.CHAR_SIZE, CONSTANTS.CHAR_SIZE);
    }

    drawEyeType(eyeType, char, animFrame, this.drawRect.bind(this));
    drawEffect(effect, char, animFrame, this.drawRect.bind(this));
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export class VibeMonEngine {
  constructor(canvas, domElements, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas?.getContext('2d');
    this.dom = domElements;
    this.useEmoji = options.useEmoji || false;
    
    // Default character image URLs from static server
    // Can be overridden by options.characterImageUrls
    const defaultImageUrls = options.characterImageUrls || {
      clawd: 'https://static.vibemon.io/characters/clawd.png',
      kiro: 'https://static.vibemon.io/characters/kiro.png',
      claw: 'https://static.vibemon.io/characters/claw.png'
    };
    this.characterImageUrls = defaultImageUrls;

    this.currentState = 'start';
    this.currentCharacter = 'clawd';
    this.currentProject = '-';
    this.currentTool = '-';
    this.currentModel = '-';
    this.currentMemory = 0;

    this.animFrame = 0;
    this.blinkFrame = 0;
    this.lastFrameTime = 0;
    this.animationRunning = false;
    this.animationFrameId = null;

    this.characterRenderer = null;
  }

  async init() {
    if (this.ctx) {
      this.characterRenderer = new CharacterRenderer(this.ctx);
      if (this.characterImageUrls) {
        await this.characterRenderer.preloadImages(this.characterImageUrls);
      }
    }
    return this;
  }

  setState(data) {
    if (!data || typeof data !== 'object') return;

    const prevState = this.currentState;
    if (data.state !== undefined) this.currentState = data.state;
    if (data.character !== undefined) {
      this.currentCharacter = CHARACTER_CONFIG[data.character] ? data.character : CONSTANTS.DEFAULT_CHARACTER;
    }
    if (data.project !== undefined) this.currentProject = data.project || '-';
    if (data.tool !== undefined) this.currentTool = data.tool || '-';
    if (data.model !== undefined) this.currentModel = data.model || '-';
    if (data.memory !== undefined) this.currentMemory = data.memory || 0;

    if (this.currentState === 'idle' && prevState !== 'idle') {
      this.blinkFrame = 0;
    }
  }

  getStateObject() {
    return {
      state: this.currentState,
      character: this.currentCharacter,
      project: this.currentProject,
      tool: this.currentTool,
      model: this.currentModel,
      memory: this.currentMemory
    };
  }

  render() {
    this.renderBackground();
    this.renderTitle();
    this.renderStatusText();
    this.renderLoadingDots();
    this.renderInfoLines();
    this.renderMemoryBar();
    this.renderIcons();
    this.renderCharacter();
  }

  renderBackground() {
    const state = STATES[this.currentState] || STATES.idle;
    if (this.dom.display) {
      this.dom.display.style.background = state.bgColor;
    }
  }

  renderTitle() {
    if (!this.dom.titleText) return;

    const titleProject = this.currentProject && this.currentProject !== '-' ? this.currentProject : 'VibeMon';
    const displayTitle = titleProject.length > CONSTANTS.PROJECT_NAME_MAX_LENGTH
      ? titleProject.substring(0, CONSTANTS.PROJECT_NAME_TRUNCATE_AT) + '...'
      : titleProject;
    this.dom.titleText.textContent = displayTitle;
  }

  renderStatusText() {
    if (!this.dom.statusText) return;

    const state = STATES[this.currentState] || STATES.idle;

    if (this.currentState === 'thinking') {
      this.dom.statusText.textContent = getThinkingText();
    } else if (this.currentState === 'planning') {
      this.dom.statusText.textContent = getPlanningText();
    } else if (this.currentState === 'working') {
      this.dom.statusText.textContent = getWorkingText(this.currentTool);
    } else {
      this.dom.statusText.textContent = state.text;
    }
    this.dom.statusText.style.color = state.textColor;
  }

  renderLoadingDots() {
    if (!this.dom.loadingDots) return;

    const state = STATES[this.currentState] || STATES.idle;
    this.dom.loadingDots.style.display = state.showLoading ? 'flex' : 'none';
  }

  updateLoadingDots(slow = false) {
    if (!this.dom.dots) return;

    const frame = slow ? Math.floor(this.animFrame / CONSTANTS.THINKING_ANIMATION_SLOWDOWN) : this.animFrame;
    const activeIndex = frame % CONSTANTS.LOADING_DOT_COUNT;
    this.dom.dots.forEach((dot, i) => {
      dot.classList.toggle('dim', i !== activeIndex);
    });
  }

  renderInfoLines() {
    const state = STATES[this.currentState] || STATES.idle;

    if (this.dom.toolLine) {
      this.dom.toolLine.style.display = this.currentState === 'working' ? 'block' : 'none';
    }

    const displayProject = this.currentProject.length > CONSTANTS.PROJECT_NAME_MAX_LENGTH
      ? this.currentProject.substring(0, CONSTANTS.PROJECT_NAME_TRUNCATE_AT) + '...'
      : this.currentProject;
    if (this.dom.projectValue) this.dom.projectValue.textContent = displayProject;
    if (this.dom.toolValue) this.dom.toolValue.textContent = this.currentTool;

    const displayModel = this.currentModel.length > CONSTANTS.MODEL_NAME_MAX_LENGTH
      ? this.currentModel.substring(0, CONSTANTS.MODEL_NAME_TRUNCATE_AT) + '...'
      : this.currentModel;
    if (this.dom.modelValue) this.dom.modelValue.textContent = displayModel;
    if (this.dom.memoryValue) {
      this.dom.memoryValue.textContent = this.currentMemory > 0 ? this.currentMemory + '%' : '-';
    }

    const showProject = this.currentProject && this.currentProject !== '-';
    if (this.dom.projectLine) {
      this.dom.projectLine.style.display = showProject ? 'block' : 'none';
    }
    if (this.dom.modelLine) {
      this.dom.modelLine.style.display = this.currentModel && this.currentModel !== '-' ? 'block' : 'none';
    }
    const showMemory = this.currentState !== 'start' && this.currentMemory > 0;
    if (this.dom.memoryLine) {
      this.dom.memoryLine.style.display = showMemory ? 'block' : 'none';
    }

    if (this.dom.infoTexts) {
      this.dom.infoTexts.forEach(el => el.style.color = state.textColor);
    }
    if (this.dom.infoLabels) {
      this.dom.infoLabels.forEach(el => el.style.color = state.textColor);
    }
    if (this.dom.infoValues) {
      this.dom.infoValues.forEach(el => el.style.color = state.textColor);
    }
  }

  renderMemoryBar() {
    const state = STATES[this.currentState] || STATES.idle;
    const showMemory = this.currentState !== 'start' && this.currentMemory > 0;

    updateMemoryBar(showMemory ? this.currentMemory : null, state.bgColor, {
      memoryBar: this.dom.memoryBar,
      memoryBarContainer: this.dom.memoryBarContainer
    });
  }

  renderIcons() {
    const state = STATES[this.currentState] || STATES.idle;
    drawInfoIcons(state.textColor, state.bgColor, this.useEmoji);
  }

  renderCharacter() {
    if (!this.characterRenderer) return;

    const state = STATES[this.currentState] || STATES.idle;
    this.characterRenderer.drawCharacter(state.eyeType, state.effect, this.currentState, this.currentCharacter, this.animFrame);
  }

  updateFloatingPosition() {
    if (!this.canvas) return;

    const offsetX = getFloatOffsetX(this.animFrame);
    const offsetY = getFloatOffsetY(this.animFrame);
    this.canvas.style.left = (CONSTANTS.CHAR_X_BASE + offsetX) + 'px';
    this.canvas.style.top = (CONSTANTS.CHAR_Y_BASE + offsetY) + 'px';
  }

  _animationLoop(timestamp) {
    if (!this.animationRunning) return;

    if (timestamp - this.lastFrameTime < CONSTANTS.FRAME_INTERVAL) {
      this.animationFrameId = requestAnimationFrame(this._animationLoop.bind(this));
      return;
    }
    this.lastFrameTime = timestamp;
    this.animFrame++;

    this.updateFloatingPosition();

    if (this.currentState === 'idle') {
      this.blinkFrame++;
      if (this.blinkFrame > CONSTANTS.BLINK_END_FRAME) {
        this.blinkFrame = 0;
      }
    }

    if (needsAnimationRedraw(this.currentState, this.animFrame, this.blinkFrame)) {
      if (this.currentState === 'start') {
        this.characterRenderer?.drawCharacter('normal', 'sparkle', this.currentState, this.currentCharacter, this.animFrame);
      }

      if (this.currentState === 'thinking') {
        this.updateLoadingDots(true);
        this.characterRenderer?.drawCharacter('normal', 'thinking', this.currentState, this.currentCharacter, this.animFrame);
      }

      if (this.currentState === 'planning') {
        this.updateLoadingDots(true);
        this.characterRenderer?.drawCharacter('normal', 'thinking', this.currentState, this.currentCharacter, this.animFrame);
      }

      if (this.currentState === 'working') {
        this.updateLoadingDots(false);
        this.characterRenderer?.drawCharacter('focused', 'sparkle', this.currentState, this.currentCharacter, this.animFrame);
      }

      if (this.currentState === 'packing') {
        this.updateLoadingDots(true);
        this.characterRenderer?.drawCharacter('normal', 'thinking', this.currentState, this.currentCharacter, this.animFrame);
      }

      if (this.currentState === 'idle') {
        if (this.blinkFrame === CONSTANTS.BLINK_START_FRAME) {
          this.characterRenderer?.drawCharacter('blink', 'none', this.currentState, this.currentCharacter, this.animFrame);
        } else if (this.blinkFrame === CONSTANTS.BLINK_END_FRAME) {
          this.characterRenderer?.drawCharacter('normal', 'none', this.currentState, this.currentCharacter, this.animFrame);
        }
      }

      if (this.currentState === 'sleep') {
        this.characterRenderer?.drawCharacter('blink', 'zzz', this.currentState, this.currentCharacter, this.animFrame);
      }
    }

    this.animationFrameId = requestAnimationFrame(this._animationLoop.bind(this));
  }

  startAnimation() {
    if (this.animationRunning) return;
    this.animationRunning = true;
    this.animationFrameId = requestAnimationFrame(this._animationLoop.bind(this));
  }

  stopAnimation() {
    this.animationRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  cleanup() {
    this.stopAnimation();
  }
}

// =============================================================================
// FACTORY FUNCTION AND ADDITIONAL EXPORTS
// =============================================================================

export function createVibeMonEngine(canvas, domElements, options = {}) {
  return new VibeMonEngine(canvas, domElements, options);
}

// Export constants for external use (e.g., simulator)
export { STATES as states, CHARACTER_CONFIG, CONSTANTS };
export const CHARACTER_NAMES = Object.keys(CHARACTER_CONFIG);
export const DEFAULT_CHARACTER = CONSTANTS.DEFAULT_CHARACTER;
