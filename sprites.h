/*
 * Claude Monitor Character Sprites
 * 128x128 pixel art for ESP32-C6-LCD-1.47
 * (Doubled from 64x64 original design)
 */

#ifndef SPRITES_H
#define SPRITES_H

#include <Arduino.h>

// Character colors (RGB565)
#define COLOR_CLAUDE      0xEB66  // #E07B39 Claude orange
#define COLOR_KIRO        0xFFFF  // #FFFFFF White ghost
#define COLOR_EYE         0x0000  // #000000 Black
#define COLOR_TRANSPARENT 0x0000  // Transparent (same as background)
#define COLOR_EFFECT_ALT  0xFFE0  // #FFFF00 Yellow for white character effects

// Kiro sprite (64x64) - string-based pixel art
// '0' = transparent, '1' = white body
const char* KIRO_SPRITE[64] = {
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000111111111111111111000000000000000000000",
  "0000000000000000000000011111111111111111111110000000000000000000",
  "0000000000000000000001111111111111111111111111110000000000000000",
  "0000000000000000000111111111111111111111111111111000000000000000",
  "0000000000000000001111111111111111111111111111111100000000000000",
  "0000000000000000011111111111111111111111111111111110000000000000",
  "0000000000000000111111111111111111111111111111111110000000000000",
  "0000000000000001111111111111111111111111111111111111000000000000",
  "0000000000000001111111111111111111111111111111111111100000000000",
  "0000000000000011111111111111111111111111111111111111100000000000",
  "0000000000000011111111111111111111111111111111111111100000000000",
  "0000000000000011111111111111111111111111111111111111100000000000",
  "0000000000000011111111111111111111111111111111111111110000000000",
  "0000000000000011111111111111111111111111111111111111110000000000",
  "0000000000000111111111111111111111111111111111111111110000000000",
  "0000000000000111111111111111111111111111111111111111110000000000",
  "0000000000000111111111111111111111111111111111111111100000000000",
  "0000000000001111111111111111111111111111111111111111100000000000",
  "0000000000011111111111111111111111111111111111111111100000000000",
  "0000000000111111111111111111111111111111111111111111100000000000",
  "0000000000111111111111111111111111111111111111111111000000000000",
  "0000000000111111111111111111111111111111111111111110000000000000",
  "0000000000111111111111111111111111111111111111111100000000000000",
  "0000000000011111111111111111111111111111111111111100000000000000",
  "0000000000000000111111111111111111111111111111111100000000000000",
  "0000000000000000111111111111111111111111111111111000000000000000",
  "0000000000000000111111111111111111111111111111110000000000000000",
  "0000000000000000111111111111111111111111111111100000000000000000",
  "0000000000000000011111111111111100111111111110000000000000000000",
  "0000000000000000000000111000000000000111000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000",
  "0000000000000000000000000000000000000000000000000000000000000000"
};

// Draw Kiro sprite (64x64 base, scaled 2x to 128x128)
void drawKiroSprite(TFT_eSPI &tft, int x, int y, uint16_t bgColor) {
  for (int row = 0; row < 64; row++) {
    for (int col = 0; col < 64; col++) {
      char c = KIRO_SPRITE[row][col];
      if (c == '1') {
        tft.fillRect(x + col * SCALE, y + row * SCALE, SCALE, SCALE, COLOR_KIRO);
      }
      // '0' = transparent, background already drawn
    }
  }
}

// Character geometry structure
typedef struct {
  const char* name;
  uint16_t color;
  // Body
  int bodyX, bodyY, bodyW, bodyH;
  bool isGhost;           // Ghost shape flag
  // Arms (optional)
  bool hasArms;
  int armLeftX, armRightX, armY, armW, armH;
  // Legs or Tail parts
  int partCount;          // Number of legs or tail parts
  int partX[4];
  int partY[4];
  int partW[4];
  int partH[4];
  // Eyes
  int eyeLeftX, eyeRightX, eyeY, eyeSize;
} CharacterGeometry;

// Character definitions
const CharacterGeometry CHAR_CLAWD = {
  "clawd",
  COLOR_CLAUDE,
  // Body: x=6, y=8, w=52, h=36
  6, 8, 52, 36,
  false,  // Not a ghost
  // Arms: hasArms=true
  true,
  0, 58, 22, 6, 10,  // leftX, rightX, y, w, h
  // Legs: 4 parts
  4,
  {10, 18, 40, 48},  // partX
  {44, 44, 44, 44},  // partY
  {6, 6, 6, 6},      // partW
  {12, 12, 12, 12},  // partH
  // Eyes
  14, 44, 22, 6      // leftX, rightX, y, size
};

const CharacterGeometry CHAR_KIRO = {
  "kiro",
  COLOR_KIRO,
  // Sprite-based rendering (64x64 sprite, body geometry for reference)
  10, 3, 44, 30,
  true,   // Is a ghost (uses sprite)
  // Arms: hasArms=false
  false,
  0, 0, 0, 0, 0,
  // No tail parts (included in sprite)
  0,
  {0, 0, 0, 0},
  {0, 0, 0, 0},
  {0, 0, 0, 0},
  {0, 0, 0, 0},
  // Eyes (matches 64x64 sprite positions)
  34, 43, 11, 5      // leftX, rightX, y, size
};

// Character array for dynamic lookup
// To add a new character, add to this array and define the CharacterGeometry above
const CharacterGeometry* ALL_CHARACTERS[] = {
  &CHAR_CLAWD,
  &CHAR_KIRO
};
const int CHARACTER_COUNT = sizeof(ALL_CHARACTERS) / sizeof(ALL_CHARACTERS[0]);
const CharacterGeometry* DEFAULT_CHARACTER = &CHAR_CLAWD;

// Get character geometry by name (loop-based for extensibility)
const CharacterGeometry* getCharacter(String name) {
  for (int i = 0; i < CHARACTER_COUNT; i++) {
    if (name == ALL_CHARACTERS[i]->name) {
      return ALL_CHARACTERS[i];
    }
  }
  return DEFAULT_CHARACTER;
}

// Check if character name is valid
bool isValidCharacter(String name) {
  for (int i = 0; i < CHARACTER_COUNT; i++) {
    if (name == ALL_CHARACTERS[i]->name) {
      return true;
    }
  }
  return false;
}

// Background colors by state (RGB565)
#define COLOR_BG_IDLE     0x0540  // #00AA00 Green
#define COLOR_BG_WORKING  0x0339  // #0066CC Blue
#define COLOR_BG_NOTIFY   0xFE60  // #FFCC00 Yellow
#define COLOR_BG_SESSION  0x0666  // #00CCCC Cyan
#define COLOR_BG_DONE     0x0540  // #00AA00 Green
#define COLOR_BG_SLEEP    0x18C9  // #1a1a4e Navy blue

// Text colors
#define COLOR_TEXT_WHITE  0xFFFF
#define COLOR_TEXT_DIM    0x7BEF

// Character dimensions (128x128, doubled from 64x64)
#define CHAR_WIDTH  128
#define CHAR_HEIGHT 128
#define SCALE       2    // Scale factor from original design

// Eye types
enum EyeType {
  EYE_SPARKLE,     // session_start: normal + sparkle
  EYE_NORMAL,      // idle: square eyes
  EYE_FOCUSED,     // working: horizontal flat eyes
  EYE_ALERT,       // notification: round eyes
  EYE_HAPPY,       // done: curved happy eyes
  EYE_SLEEP        // sleep: closed eyes + Zzz
};

// Animation frame counter
extern int animFrame;

// Tool-based status texts for working state
const char* BASH_TEXTS[] = {"Running", "Executing", "Processing"};
const char* READ_TEXTS[] = {"Reading", "Scanning", "Checking"};
const char* EDIT_TEXTS[] = {"Editing", "Modifying", "Fixing"};
const char* WRITE_TEXTS[] = {"Writing", "Creating", "Saving"};
const char* GREP_TEXTS[] = {"Searching", "Finding", "Looking"};
const char* GLOB_TEXTS[] = {"Scanning", "Browsing", "Finding"};
const char* TASK_TEXTS[] = {"Thinking", "Working", "Planning"};
const char* WEBFETCH_TEXTS[] = {"Fetching", "Loading", "Getting"};
const char* WEBSEARCH_TEXTS[] = {"Searching", "Googling", "Looking"};
const char* DEFAULT_TEXTS[] = {"Working", "Busy", "Coding"};

/*
 * Character structure (128x128, scaled 2x from 64x64):
 *
 *         20    88    20
 *        +----+------+----+
 *        |    |██████|    |  16   (top padding)
 *        |    |██████|    |
 *        |    |█ ■■ █|    |  24  (eyes area)
 *   +----+----+██████+----+----+
 *   |████|    |██████|    |████|  24  (arms)
 *   +----+----+██████+----+----+
 *        |    |██████|    |  16
 *        |    +--++--+    |
 *        |      |██|      |  32  (legs)
 *        |      |██|      |
 *        +------+--+------+
 */

// Draw the Claude character at specified position (128x128)
void drawCharacter(TFT_eSPI &tft, int x, int y, EyeType eyeType, uint16_t bgColor, const CharacterGeometry* character = &CHAR_CLAWD) {
  // Clear background area
  tft.fillRect(x, y, CHAR_WIDTH, CHAR_HEIGHT, bgColor);

  uint16_t charColor = character->color;

  // Draw body
  if (character == &CHAR_KIRO) {
    // Use sprite-based rendering for Kiro
    drawKiroSprite(tft, x, y, bgColor);
  } else if (character->isGhost) {
    // Generic ghost body (rounded egg/chick shape) - fallback
    int bx = x + (character->bodyX * SCALE);
    int by = y + (character->bodyY * SCALE);
    int bw = character->bodyW * SCALE;
    int bh = character->bodyH * SCALE;

    // Rounded top (gradual curve)
    tft.fillRect(bx + (10 * SCALE), by, bw - (20 * SCALE), 2 * SCALE, charColor);
    tft.fillRect(bx + (6 * SCALE), by + (2 * SCALE), bw - (12 * SCALE), 2 * SCALE, charColor);
    tft.fillRect(bx + (4 * SCALE), by + (4 * SCALE), bw - (8 * SCALE), 2 * SCALE, charColor);
    tft.fillRect(bx + (2 * SCALE), by + (6 * SCALE), bw - (4 * SCALE), 2 * SCALE, charColor);

    // Main body (middle)
    tft.fillRect(bx, by + (8 * SCALE), bw, bh - (16 * SCALE), charColor);

    // Rounded bottom (gradual curve)
    tft.fillRect(bx + (2 * SCALE), by + bh - (8 * SCALE), bw - (4 * SCALE), 2 * SCALE, charColor);
    tft.fillRect(bx + (4 * SCALE), by + bh - (6 * SCALE), bw - (8 * SCALE), 2 * SCALE, charColor);
    tft.fillRect(bx + (6 * SCALE), by + bh - (4 * SCALE), bw - (12 * SCALE), 2 * SCALE, charColor);
    tft.fillRect(bx + (10 * SCALE), by + bh - (2 * SCALE), bw - (20 * SCALE), 2 * SCALE, charColor);
  } else {
    // Standard rectangular body
    tft.fillRect(x + (character->bodyX * SCALE), y + (character->bodyY * SCALE),
                 character->bodyW * SCALE, character->bodyH * SCALE, charColor);
  }

  // Draw arms (if exists)
  if (character->hasArms) {
    int armY = y + (character->armY * SCALE);
    int armW = character->armW * SCALE;
    int armH = character->armH * SCALE;
    tft.fillRect(x + (character->armLeftX * SCALE), armY, armW, armH, charColor);
    tft.fillRect(x + (character->armRightX * SCALE), armY, armW, armH, charColor);
  }

  // Draw legs or tail parts
  for (int i = 0; i < character->partCount; i++) {
    int px = x + (character->partX[i] * SCALE);
    int py = y + (character->partY[i] * SCALE);
    int pw = character->partW[i] * SCALE;
    int ph = character->partH[i] * SCALE;

    if (character->isGhost) {
      // Draw rounded blob for ghost tail/leg parts
      tft.fillRect(px + (2 * SCALE), py, pw - (4 * SCALE), 2 * SCALE, charColor);
      tft.fillRect(px + (1 * SCALE), py + (2 * SCALE), pw - (2 * SCALE), ph - (4 * SCALE), charColor);
      tft.fillRect(px + (2 * SCALE), py + ph - (2 * SCALE), pw - (4 * SCALE), 2 * SCALE, charColor);
    } else {
      // Standard rectangular parts
      tft.fillRect(px, py, pw, ph, charColor);
    }
  }

  // Draw eyes based on type
  drawEyes(tft, x, y, eyeType, character);
}

// Draw eyes based on eye type (scaled 2x)
void drawEyes(TFT_eSPI &tft, int x, int y, EyeType eyeType, const CharacterGeometry* character = &CHAR_CLAWD) {
  // Eye base positions (scaled 2x)
  int leftEyeX = x + (character->eyeLeftX * SCALE);
  int rightEyeX = x + (character->eyeRightX * SCALE);
  int eyeY = y + (character->eyeY * SCALE);
  int eyeSize = character->eyeSize;
  int es = eyeSize * SCALE;  // Scaled eye size

  // Effect color (yellow for white characters, white for others)
  uint16_t effectColor = (character->color == COLOR_KIRO) ? COLOR_EFFECT_ALT : COLOR_TEXT_WHITE;

  // Effect position (relative to right eye)
  int effectX = rightEyeX + es + (2 * SCALE);
  int effectY = eyeY - (4 * SCALE);

  switch (eyeType) {
    case EYE_NORMAL:
      tft.fillRect(leftEyeX, eyeY, es, es, COLOR_EYE);
      tft.fillRect(rightEyeX, eyeY, es, es, COLOR_EYE);
      break;

    case EYE_FOCUSED:
      tft.fillRect(leftEyeX, eyeY + es/3, es, es/2, COLOR_EYE);
      tft.fillRect(rightEyeX, eyeY + es/3, es, es/2, COLOR_EYE);
      break;

    case EYE_ALERT:
      // Round eyes
      tft.fillRect(leftEyeX + SCALE, eyeY, es - 2*SCALE, es, COLOR_EYE);
      tft.fillRect(leftEyeX, eyeY + SCALE, es, es - 2*SCALE, COLOR_EYE);
      tft.fillRect(rightEyeX + SCALE, eyeY, es - 2*SCALE, es, COLOR_EYE);
      tft.fillRect(rightEyeX, eyeY + SCALE, es, es - 2*SCALE, COLOR_EYE);
      drawQuestionMark(tft, effectX, effectY);
      break;

    case EYE_SPARKLE:
      tft.fillRect(leftEyeX, eyeY, es, es, COLOR_EYE);
      tft.fillRect(rightEyeX, eyeY, es, es, COLOR_EYE);
      drawSparkle(tft, effectX, effectY + (2 * SCALE), effectColor);
      break;

    case EYE_HAPPY: {
      // Simplified happy eyes (^ ^)
      int unit = max(1, eyeSize / 3) * SCALE;
      tft.fillRect(leftEyeX + unit, eyeY, unit, unit, COLOR_EYE);
      tft.fillRect(leftEyeX, eyeY + unit, unit, unit, COLOR_EYE);
      tft.fillRect(leftEyeX + unit * 2, eyeY + unit, unit, unit, COLOR_EYE);
      tft.fillRect(rightEyeX + unit, eyeY, unit, unit, COLOR_EYE);
      tft.fillRect(rightEyeX, eyeY + unit, unit, unit, COLOR_EYE);
      tft.fillRect(rightEyeX + unit * 2, eyeY + unit, unit, unit, COLOR_EYE);
      break;
    }

    case EYE_SLEEP:
      tft.fillRect(leftEyeX, eyeY + es/3, es, es/3, COLOR_EYE);
      tft.fillRect(rightEyeX, eyeY + es/3, es, es/3, COLOR_EYE);
      drawZzz(tft, effectX, effectY, animFrame, effectColor);
      break;
  }
}

// Draw sparkle effect (scaled 2x)
void drawSparkle(TFT_eSPI &tft, int x, int y, uint16_t sparkleColor = COLOR_TEXT_WHITE) {
  // 4-point star sparkle
  int frame = animFrame % 4;

  // Center dot (2x2 -> 4x4)
  tft.fillRect(x + (2 * SCALE), y + (2 * SCALE), 2 * SCALE, 2 * SCALE, sparkleColor);

  // Rays (rotating based on frame)
  if (frame == 0 || frame == 2) {
    // Vertical and horizontal
    tft.fillRect(x + (2 * SCALE), y, 2 * SCALE, 2 * SCALE, sparkleColor);
    tft.fillRect(x + (2 * SCALE), y + (4 * SCALE), 2 * SCALE, 2 * SCALE, sparkleColor);
    tft.fillRect(x, y + (2 * SCALE), 2 * SCALE, 2 * SCALE, sparkleColor);
    tft.fillRect(x + (4 * SCALE), y + (2 * SCALE), 2 * SCALE, 2 * SCALE, sparkleColor);
  } else {
    // Diagonal
    tft.fillRect(x, y, 2 * SCALE, 2 * SCALE, sparkleColor);
    tft.fillRect(x + (4 * SCALE), y, 2 * SCALE, 2 * SCALE, sparkleColor);
    tft.fillRect(x, y + (4 * SCALE), 2 * SCALE, 2 * SCALE, sparkleColor);
    tft.fillRect(x + (4 * SCALE), y + (4 * SCALE), 2 * SCALE, 2 * SCALE, sparkleColor);
  }
}

// Draw question mark effect (scaled 2x)
void drawQuestionMark(TFT_eSPI &tft, int x, int y) {
  uint16_t color = TFT_BLACK;  // Dark on yellow background

  // Question mark shape (6x10 pixels, scaled)
  //   ████
  //       ██
  //     ██
  //     ██
  //
  //     ██
  tft.fillRect(x + (1 * SCALE), y, 4 * SCALE, 2 * SCALE, color);              // Top curve
  tft.fillRect(x + (4 * SCALE), y + (2 * SCALE), 2 * SCALE, 2 * SCALE, color); // Right side
  tft.fillRect(x + (2 * SCALE), y + (4 * SCALE), 2 * SCALE, 2 * SCALE, color); // Middle
  tft.fillRect(x + (2 * SCALE), y + (6 * SCALE), 2 * SCALE, 2 * SCALE, color); // Lower middle
  tft.fillRect(x + (2 * SCALE), y + (10 * SCALE), 2 * SCALE, 2 * SCALE, color); // Dot
}

// Draw Zzz animation for sleep state (scaled 2x)
void drawZzz(TFT_eSPI &tft, int x, int y, int frame, uint16_t color = COLOR_TEXT_WHITE) {

  // Blink effect: show Z for 10 frames, hide for 10 frames (2 second cycle)
  if ((frame % 20) < 10) {
    // Z shape (6x6 pixels, scaled)
    // ██████
    //     ██
    //   ██
    //  ██
    // ██████
    tft.fillRect(x, y, 6 * SCALE, 1 * SCALE, color);              // Top
    tft.fillRect(x + (4 * SCALE), y + (1 * SCALE), 2 * SCALE, 1 * SCALE, color); // Upper diagonal 1
    tft.fillRect(x + (3 * SCALE), y + (2 * SCALE), 2 * SCALE, 1 * SCALE, color); // Upper diagonal 2
    tft.fillRect(x + (2 * SCALE), y + (3 * SCALE), 2 * SCALE, 1 * SCALE, color); // Lower diagonal 1
    tft.fillRect(x + (1 * SCALE), y + (4 * SCALE), 2 * SCALE, 1 * SCALE, color); // Lower diagonal 2
    tft.fillRect(x, y + (5 * SCALE), 6 * SCALE, 1 * SCALE, color); // Bottom
  }
}

// Draw loading dots animation
void drawLoadingDots(TFT_eSPI &tft, int centerX, int y, int frame) {
  int dotRadius = 4;
  int dotSpacing = 16;
  int startX = centerX - (dotSpacing * 1.5);

  for (int i = 0; i < 4; i++) {
    int dotX = startX + (i * dotSpacing);
    uint16_t color = (i == (frame % 4)) ? COLOR_TEXT_WHITE : COLOR_TEXT_DIM;
    tft.fillCircle(dotX, y, dotRadius, color);
  }
}

// RGB565 color constants for gradient
#define COLOR_MEM_GREEN  0x0540  // #00AA00
#define COLOR_MEM_YELLOW 0xFE60  // #FFCC00
#define COLOR_MEM_RED    0xF800  // #FF0000

// Interpolate between two RGB565 colors
uint16_t lerpColor565(uint16_t color1, uint16_t color2, int ratio, int maxRatio) {
  // Extract RGB components from RGB565
  int r1 = (color1 >> 11) & 0x1F;
  int g1 = (color1 >> 5) & 0x3F;
  int b1 = color1 & 0x1F;

  int r2 = (color2 >> 11) & 0x1F;
  int g2 = (color2 >> 5) & 0x3F;
  int b2 = color2 & 0x1F;

  // Interpolate
  int r = r1 + ((r2 - r1) * ratio) / maxRatio;
  int g = g1 + ((g2 - g1) * ratio) / maxRatio;
  int b = b1 + ((b2 - b1) * ratio) / maxRatio;

  // Clamp values
  r = min(31, max(0, r));
  g = min(63, max(0, g));
  b = min(31, max(0, b));

  return (r << 11) | (g << 5) | b;
}

// Get gradient color for a specific position in the bar
uint16_t getGradientColor(int pos, int width, int percent) {
  // Calculate base color from percent (smooth transition)
  uint16_t baseStart, baseEnd;
  int baseRatio;

  if (percent < 50) {
    // Green to Yellow range
    baseStart = COLOR_MEM_GREEN;
    baseEnd = COLOR_MEM_YELLOW;
    baseRatio = percent * 2;  // 0-100 for 0-50%
  } else {
    // Yellow to Red range
    baseStart = COLOR_MEM_YELLOW;
    baseEnd = COLOR_MEM_RED;
    baseRatio = (percent - 50) * 2;  // 0-100 for 50-100%
  }

  // Apply position-based gradient within the bar
  int posRatio = (pos * 30) / width;  // 0-30% variation across bar
  int totalRatio = min(100, max(0, baseRatio + posRatio));

  return lerpColor565(baseStart, baseEnd, totalRatio, 100);
}

// Draw memory bar with gradient
void drawMemoryBar(TFT_eSPI &tft, int x, int y, int width, int height, int percent, uint16_t bgColor) {
  int clampedPercent = min(100, max(0, percent));
  int fillWidth = (width * clampedPercent) / 100;

  // Determine border/bg colors based on background brightness
  bool isDarkBg = (bgColor == COLOR_BG_WORKING || bgColor == COLOR_BG_SLEEP);
  uint16_t borderColor = isDarkBg ? 0xAD75 : 0x4208;  // Light gray or dark gray
  uint16_t containerBg = isDarkBg ? 0x3186 : 0x2104;  // Lighter or darker

  // Border (1px)
  tft.drawRect(x, y, width, height, borderColor);

  // Background - inside border
  tft.fillRect(x + 1, y + 1, width - 2, height - 2, containerBg);

  // Fill bar with gradient
  if (fillWidth > 2) {
    int barHeight = height - 2;
    for (int i = 0; i < fillWidth - 2; i++) {
      uint16_t color = getGradientColor(i, fillWidth - 2, clampedPercent);
      tft.drawFastVLine(x + 1 + i, y + 1, barHeight, color);
    }
  }
}

// Draw blink animation (for idle state)
void drawBlinkEyes(TFT_eSPI &tft, int x, int y, int frame, const CharacterGeometry* character = &CHAR_CLAWD) {
  int leftEyeX = x + (character->eyeLeftX * SCALE);
  int rightEyeX = x + (character->eyeRightX * SCALE);
  int eyeY = y + (character->eyeY * SCALE);
  int eyeSize = character->eyeSize;

  if (frame == 0) {
    // Eyes closed (thin line)
    tft.fillRect(leftEyeX, eyeY + (2 * SCALE), eyeSize * SCALE, 2 * SCALE, COLOR_EYE);
    tft.fillRect(rightEyeX, eyeY + (2 * SCALE), eyeSize * SCALE, 2 * SCALE, COLOR_EYE);
  } else {
    // Eyes open (normal)
    tft.fillRect(leftEyeX, eyeY, eyeSize * SCALE, eyeSize * SCALE, COLOR_EYE);
    tft.fillRect(rightEyeX, eyeY, eyeSize * SCALE, eyeSize * SCALE, COLOR_EYE);
  }
}

// Get background color for state
uint16_t getBackgroundColor(String state) {
  if (state == "session_start") return COLOR_BG_SESSION;
  if (state == "idle") return COLOR_BG_IDLE;
  if (state == "working") return COLOR_BG_WORKING;
  if (state == "notification") return COLOR_BG_NOTIFY;
  if (state == "tool_done") return COLOR_BG_DONE;
  if (state == "sleep") return COLOR_BG_SLEEP;
  return COLOR_BG_IDLE;  // default
}

// Get eye type for state
EyeType getEyeType(String state) {
  if (state == "session_start") return EYE_SPARKLE;
  if (state == "idle") return EYE_NORMAL;
  if (state == "working") return EYE_FOCUSED;
  if (state == "notification") return EYE_ALERT;
  if (state == "tool_done") return EYE_HAPPY;
  if (state == "sleep") return EYE_SLEEP;
  return EYE_NORMAL;  // default
}

// Get working text based on tool (random selection, case-insensitive)
String getWorkingText(String tool) {
  int idx = random(3);
  String t = tool;
  t.toLowerCase();
  if (t == "bash") return BASH_TEXTS[idx];
  if (t == "read") return READ_TEXTS[idx];
  if (t == "edit") return EDIT_TEXTS[idx];
  if (t == "write") return WRITE_TEXTS[idx];
  if (t == "grep") return GREP_TEXTS[idx];
  if (t == "glob") return GLOB_TEXTS[idx];
  if (t == "task") return TASK_TEXTS[idx];
  if (t == "webfetch") return WEBFETCH_TEXTS[idx];
  if (t == "websearch") return WEBSEARCH_TEXTS[idx];
  return DEFAULT_TEXTS[idx];
}

// Get status text for state
String getStatusText(String state, String tool = "") {
  if (state == "session_start") return "Hello!";
  if (state == "idle") return "Ready";
  if (state == "working") return getWorkingText(tool);
  if (state == "notification") return "Input?";
  if (state == "tool_done") return "Done!";
  if (state == "sleep") return "Zzz...";
  return state;
}

// Get text color for state (dark text on bright backgrounds)
uint16_t getTextColor(String state) {
  if (state == "session_start") return TFT_BLACK;  // Dark on cyan
  if (state == "notification") return TFT_BLACK;   // Dark on yellow
  return COLOR_TEXT_WHITE;  // White on dark backgrounds
}

// Draw folder icon (📂) - 8x7 pixels
void drawFolderIcon(TFT_eSPI &tft, int x, int y, uint16_t color) {
  // Folder tab (top)
  tft.fillRect(x, y, 3, 1, color);
  // Folder body
  tft.fillRect(x, y + 1, 8, 6, color);
  // Inner fold line
  tft.drawLine(x + 1, y + 2, x + 6, y + 2, 0x0000);
}

// Draw tool/wrench icon (🛠️) - 8x8 pixels
void drawToolIcon(TFT_eSPI &tft, int x, int y, uint16_t color) {
  // Wrench head (top)
  tft.fillRect(x + 1, y, 6, 3, color);
  tft.fillRect(x + 3, y, 2, 1, 0x0000);  // Notch
  // Handle (diagonal)
  tft.fillRect(x + 3, y + 3, 2, 5, color);
}

// Draw robot icon (🤖) - 8x8 pixels
void drawRobotIcon(TFT_eSPI &tft, int x, int y, uint16_t color) {
  // Antenna
  tft.fillRect(x + 3, y, 2, 1, color);
  // Head
  tft.fillRect(x + 1, y + 1, 6, 5, color);
  // Eyes
  tft.fillRect(x + 2, y + 2, 1, 2, 0x0000);
  tft.fillRect(x + 5, y + 2, 1, 2, 0x0000);
  // Mouth
  tft.fillRect(x + 2, y + 5, 4, 1, 0x0000);
  // Ears
  tft.fillRect(x, y + 2, 1, 2, color);
  tft.fillRect(x + 7, y + 2, 1, 2, color);
}

// Draw brain icon (🧠) - 8x7 pixels
void drawBrainIcon(TFT_eSPI &tft, int x, int y, uint16_t color) {
  // Brain shape (simplified)
  tft.fillRect(x + 1, y, 6, 7, color);
  tft.fillRect(x, y + 1, 8, 5, color);
  // Brain folds (center line)
  tft.drawLine(x + 4, y + 1, x + 4, y + 5, 0x0000);
  // Top bumps
  tft.fillRect(x + 2, y, 1, 1, 0x0000);
  tft.fillRect(x + 5, y, 1, 1, 0x0000);
}

#endif // SPRITES_H
