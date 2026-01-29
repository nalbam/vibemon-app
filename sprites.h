/*
 * Vibe Monitor Character Sprites
 * 128x128 pixel art for ESP32-C6-LCD-1.47
 * (Doubled from 64x64 original design)
 */

#ifndef SPRITES_H
#define SPRITES_H

#include <Arduino.h>

// Character image data (RGB565 format)
#include "img_clawd.h"
#include "img_kiro.h"

// Character colors (RGB565)
#define COLOR_CLAUDE      0xDBAA  // #D97757 Claude orange (217,119,87)
#define COLOR_KIRO        0xFFFF  // #FFFFFF White ghost
#define COLOR_EYE         0x0000  // #000000 Black
#define COLOR_TRANSPARENT 0x0000  // Transparent (same as background)
#define COLOR_EFFECT_ALT  0xFD20  // #FFA500 Orange for white character effects

// Transparent color marker for pushImage
#define COLOR_TRANSPARENT_MARKER 0xFFFF

// Draw character image from RGB565 array (128x128) using pushImage
// Uses hardware-accelerated block transfer with transparent color support
void drawClawdImage(TFT_eSPI &tft, int x, int y) {
  tft.pushImage(x, y, IMG_CLAWD_WIDTH, IMG_CLAWD_HEIGHT, IMG_CLAWD, COLOR_TRANSPARENT_MARKER);
}

void drawKiroImage(TFT_eSPI &tft, int x, int y) {
  tft.pushImage(x, y, IMG_KIRO_WIDTH, IMG_KIRO_HEIGHT, IMG_KIRO, COLOR_TRANSPARENT_MARKER);
}

// Sprite versions for double buffering
void drawClawdImageToSprite(TFT_eSprite &sprite) {
  sprite.pushImage(0, 0, IMG_CLAWD_WIDTH, IMG_CLAWD_HEIGHT, IMG_CLAWD, COLOR_TRANSPARENT_MARKER);
}

void drawKiroImageToSprite(TFT_eSprite &sprite) {
  sprite.pushImage(0, 0, IMG_KIRO_WIDTH, IMG_KIRO_HEIGHT, IMG_KIRO, COLOR_TRANSPARENT_MARKER);
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
  int eyeLeftX, eyeRightX, eyeY, eyeW, eyeH;
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
  // Eyes (w, h for width and height)
  14, 44, 22, 6, 6      // leftX, rightX, y, w, h
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
  // Eyes (matches 64x64 sprite, tall vertical eyes)
  29, 39, 21, 5, 8      // leftX, rightX, y, w, h
};

// Character array for dynamic lookup
// To add a new character, add to this array and define the CharacterGeometry above
const CharacterGeometry* ALL_CHARACTERS[] = {
  &CHAR_CLAWD,
  &CHAR_KIRO
};
const int CHARACTER_COUNT = sizeof(ALL_CHARACTERS) / sizeof(ALL_CHARACTERS[0]);
const CharacterGeometry* DEFAULT_CHARACTER = &CHAR_CLAWD;

// Get character geometry by name (const char* version - no String allocation)
const CharacterGeometry* getCharacterByName(const char* name) {
  for (int i = 0; i < CHARACTER_COUNT; i++) {
    if (strcmp(name, ALL_CHARACTERS[i]->name) == 0) {
      return ALL_CHARACTERS[i];
    }
  }
  return DEFAULT_CHARACTER;
}

// Check if character name is valid (const char* version)
bool isValidCharacter(const char* name) {
  for (int i = 0; i < CHARACTER_COUNT; i++) {
    if (strcmp(name, ALL_CHARACTERS[i]->name) == 0) {
      return true;
    }
  }
  return false;
}

// Legacy String versions for compatibility
const CharacterGeometry* getCharacter(String name) {
  return getCharacterByName(name.c_str());
}

bool isValidCharacter(String name) {
  return isValidCharacter(name.c_str());
}

// Background colors by state (RGB565)
#define COLOR_BG_IDLE     0x0540  // #00AA00 Green
#define COLOR_BG_THINKING 0x6199  // #6633CC Purple
#define COLOR_BG_PLANNING 0x0451  // #008888 Teal
#define COLOR_BG_WORKING  0x0339  // #0066CC Blue
#define COLOR_BG_NOTIFY   0xFE60  // #FFCC00 Yellow
#define COLOR_BG_SESSION  0x0679  // #00CCCC Cyan
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
  EYE_SPARKLE,     // start: normal + sparkle
  EYE_NORMAL,      // idle: square eyes
  EYE_BLINK,       // idle blink: closed eyes (no Zzz)
  EYE_THINKING,    // thinking: looking up eyes + thought bubble
  EYE_FOCUSED,     // working: horizontal flat eyes
  EYE_ALERT,       // notification: round eyes
  EYE_HAPPY,       // done: curved happy eyes
  EYE_SLEEP        // sleep: closed eyes + Zzz
};

// Animation frame counter
extern int animFrame;

// Forward declarations for functions called before definition
void drawMatrixBackground(TFT_eSPI &tft, int x, int y, int frame, int size, int bodyX, int bodyY, int bodyW, int bodyH);
void drawEyes(TFT_eSPI &tft, int x, int y, EyeType eyeType, const CharacterGeometry* character);
void drawQuestionMark(TFT_eSPI &tft, int x, int y);
void drawSparkle(TFT_eSPI &tft, int x, int y, uint16_t sparkleColor);
void drawThoughtBubble(TFT_eSPI &tft, int x, int y, int frame, uint16_t color);
void drawZzz(TFT_eSPI &tft, int x, int y, int frame, uint16_t color);

// Thinking state texts (random selection)
const char* THINKING_TEXTS[] = {"Thinking", "Hmm...", "Pondering"};

// Planning state texts (random selection)
const char* PLANNING_TEXTS[] = {"Planning", "Design", "Drafting"};

// Tool-based status texts for working state (max 8 chars)
const char* BASH_TEXTS[] = {"Running", "Exec", "Process"};
const char* READ_TEXTS[] = {"Reading", "Scanning", "Checking"};
const char* EDIT_TEXTS[] = {"Editing", "Modify", "Fixing"};
const char* WRITE_TEXTS[] = {"Writing", "Creating", "Saving"};
const char* GREP_TEXTS[] = {"Search", "Finding", "Looking"};
const char* GLOB_TEXTS[] = {"Scanning", "Browse", "Finding"};
const char* TASK_TEXTS[] = {"Thinking", "Working", "Planning"};
const char* WEBFETCH_TEXTS[] = {"Fetching", "Loading", "Getting"};
const char* WEBSEARCH_TEXTS[] = {"Search", "Googling", "Looking"};
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

// Forward declarations for sprite versions
void drawMatrixBackgroundToSprite(TFT_eSprite &sprite, int frame, int size, int bodyX, int bodyY, int bodyW, int bodyH);
void drawEyesToSprite(TFT_eSprite &sprite, EyeType eyeType, const CharacterGeometry* character);

// Draw the Claude character to sprite buffer (128x128) - NO FLICKERING
void drawCharacterToSprite(TFT_eSprite &sprite, EyeType eyeType, uint16_t bgColor, const CharacterGeometry* character = &CHAR_CLAWD) {
  // Clear sprite with background color
  sprite.fillSprite(bgColor);

  // Draw matrix background for working state (behind character)
  if (eyeType == EYE_FOCUSED) {
    drawMatrixBackgroundToSprite(sprite, animFrame, CHAR_WIDTH / SCALE,
                                 character->bodyX, character->bodyY, character->bodyW, character->bodyH);
  }

  // Draw body using images
  if (character == &CHAR_CLAWD) {
    drawClawdImageToSprite(sprite);
  } else if (character == &CHAR_KIRO) {
    drawKiroImageToSprite(sprite);
  }

  // Draw eyes based on type
  drawEyesToSprite(sprite, eyeType, character);
}

// Legacy: Draw the Claude character at specified position (128x128) - direct to screen
void drawCharacter(TFT_eSPI &tft, int x, int y, EyeType eyeType, uint16_t bgColor, const CharacterGeometry* character = &CHAR_CLAWD) {
  // Clear background area
  tft.fillRect(x, y, CHAR_WIDTH, CHAR_HEIGHT, bgColor);

  // Draw matrix background for working state (behind character)
  if (eyeType == EYE_FOCUSED) {
    drawMatrixBackground(tft, x, y, animFrame, CHAR_WIDTH / SCALE,
                         character->bodyX, character->bodyY, character->bodyW, character->bodyH);
  }

  uint16_t charColor = character->color;

  // Draw body using images
  if (character == &CHAR_CLAWD) {
    // Use image for Clawd
    drawClawdImage(tft, x, y);
  } else if (character == &CHAR_KIRO) {
    // Use image for Kiro
    drawKiroImage(tft, x, y);
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

// Sunglasses colors
#define COLOR_SUNGLASSES_FRAME 0x0841  // #111111
#define COLOR_SUNGLASSES_LENS  0x0080  // #001100
#define COLOR_SUNGLASSES_SHINE 0x0180  // #003300

// Get eye cover position (used by sunglasses and sleep eyes)
void getEyeCoverPosition(int leftEyeX, int rightEyeX, int eyeY, int ew, int eh, bool isKiro,
                         int &lensW, int &lensH, int &lensY, int &leftLensX, int &rightLensX) {
  lensW = ew + (4 * SCALE);
  lensH = eh + (2 * SCALE);
  // Kiro: shift up 2px
  lensY = eyeY - SCALE - (isKiro ? (2 * SCALE) : 0);
  // Kiro: left lens 2px right, right lens 5px right
  leftLensX = leftEyeX - (2 * SCALE) + (isKiro ? (2 * SCALE) : 0);
  rightLensX = rightEyeX - (2 * SCALE) + (isKiro ? (5 * SCALE) : 0);
}

// Draw sleep eyes (closed eyes with body color background)
void drawSleepEyes(TFT_eSPI &tft, int leftEyeX, int rightEyeX, int eyeY, int ew, int eh, uint16_t bodyColor, bool isKiro = false) {
  int lensW, lensH, lensY, leftLensX, rightLensX;
  getEyeCoverPosition(leftEyeX, rightEyeX, eyeY, ew, eh, isKiro, lensW, lensH, lensY, leftLensX, rightLensX);

  // Cover original eyes with body color (same area as sunglasses)
  tft.fillRect(leftLensX, lensY, lensW, lensH, bodyColor);
  tft.fillRect(rightLensX, lensY, lensW, lensH, bodyColor);

  // Draw closed eyes (horizontal lines in the middle)
  int closedEyeY = lensY + lensH / 2;
  int closedEyeH = 2 * SCALE;  // 2px thick line (scaled)
  tft.fillRect(leftLensX + SCALE, closedEyeY, lensW - (2 * SCALE), closedEyeH, COLOR_EYE);
  tft.fillRect(rightLensX + SCALE, closedEyeY, lensW - (2 * SCALE), closedEyeH, COLOR_EYE);
}

// Draw happy eyes (> < style for done state)
void drawHappyEyes(TFT_eSPI &tft, int leftEyeX, int rightEyeX, int eyeY, int ew, int eh, uint16_t bodyColor, bool isKiro = false) {
  int lensW, lensH, lensY, leftLensX, rightLensX;
  getEyeCoverPosition(leftEyeX, rightEyeX, eyeY, ew, eh, isKiro, lensW, lensH, lensY, leftLensX, rightLensX);

  // Cover original eyes with body color
  tft.fillRect(leftLensX, lensY, lensW, lensH, bodyColor);
  tft.fillRect(rightLensX, lensY, lensW, lensH, bodyColor);

  // Center position for drawing > <
  int centerY = lensY + lensH / 2;
  int leftCenterX = leftLensX + lensW / 2;
  int rightCenterX = rightLensX + lensW / 2;

  // Draw > for left eye (pointing right)
  tft.fillRect(leftCenterX - (2 * SCALE), centerY - (2 * SCALE), 2 * SCALE, 2 * SCALE, COLOR_EYE);
  tft.fillRect(leftCenterX, centerY, 2 * SCALE, 2 * SCALE, COLOR_EYE);
  tft.fillRect(leftCenterX - (2 * SCALE), centerY + (2 * SCALE), 2 * SCALE, 2 * SCALE, COLOR_EYE);

  // Draw < for right eye (pointing left)
  tft.fillRect(rightCenterX + SCALE, centerY - (2 * SCALE), 2 * SCALE, 2 * SCALE, COLOR_EYE);
  tft.fillRect(rightCenterX - SCALE, centerY, 2 * SCALE, 2 * SCALE, COLOR_EYE);
  tft.fillRect(rightCenterX + SCALE, centerY + (2 * SCALE), 2 * SCALE, 2 * SCALE, COLOR_EYE);
}

// Draw sunglasses (Matrix style)
void drawSunglasses(TFT_eSPI &tft, int leftEyeX, int rightEyeX, int eyeY, int ew, int eh, bool isKiro = false) {
  int lensW, lensH, lensY, leftLensX, rightLensX;
  getEyeCoverPosition(leftEyeX, rightEyeX, eyeY, ew, eh, isKiro, lensW, lensH, lensY, leftLensX, rightLensX);

  // Left lens (dark green tint)
  tft.fillRect(leftLensX, lensY, lensW, lensH, COLOR_SUNGLASSES_LENS);
  // Left lens shine
  tft.fillRect(leftLensX + SCALE, lensY + SCALE, 2 * SCALE, SCALE, COLOR_SUNGLASSES_SHINE);

  // Right lens (dark green tint)
  tft.fillRect(rightLensX, lensY, lensW, lensH, COLOR_SUNGLASSES_LENS);
  // Right lens shine
  tft.fillRect(rightLensX + SCALE, lensY + SCALE, 2 * SCALE, SCALE, COLOR_SUNGLASSES_SHINE);

  // Frame - top
  tft.fillRect(leftLensX - SCALE, lensY - SCALE, lensW + (2 * SCALE), SCALE, COLOR_SUNGLASSES_FRAME);
  tft.fillRect(rightLensX - SCALE, lensY - SCALE, lensW + (2 * SCALE), SCALE, COLOR_SUNGLASSES_FRAME);

  // Frame - bottom
  tft.fillRect(leftLensX - SCALE, lensY + lensH, lensW + (2 * SCALE), SCALE, COLOR_SUNGLASSES_FRAME);
  tft.fillRect(rightLensX - SCALE, lensY + lensH, lensW + (2 * SCALE), SCALE, COLOR_SUNGLASSES_FRAME);

  // Frame - sides
  tft.fillRect(leftLensX - SCALE, lensY, SCALE, lensH, COLOR_SUNGLASSES_FRAME);
  tft.fillRect(leftLensX + lensW, lensY, SCALE, lensH, COLOR_SUNGLASSES_FRAME);
  tft.fillRect(rightLensX - SCALE, lensY, SCALE, lensH, COLOR_SUNGLASSES_FRAME);
  tft.fillRect(rightLensX + lensW, lensY, SCALE, lensH, COLOR_SUNGLASSES_FRAME);

  // Bridge (connects two lenses)
  int bridgeY = lensY + lensH / 2;
  tft.fillRect(leftLensX + lensW, bridgeY, rightLensX - leftLensX - lensW, SCALE, COLOR_SUNGLASSES_FRAME);
}

// Draw eyes based on eye type (scaled 2x)
// Note: Eyes are now part of character images, only draw effects and sunglasses
void drawEyes(TFT_eSPI &tft, int x, int y, EyeType eyeType, const CharacterGeometry* character = &CHAR_CLAWD) {
  // Eye base positions (scaled 2x)
  int leftEyeX = x + (character->eyeLeftX * SCALE);
  int rightEyeX = x + (character->eyeRightX * SCALE);
  int eyeY = y + (character->eyeY * SCALE);
  int ew = character->eyeW * SCALE;  // Scaled eye width
  int eh = character->eyeH * SCALE;  // Scaled eye height
  bool isKiro = (character == &CHAR_KIRO);

  // Effect color (yellow for white characters, white for others)
  uint16_t effectColor = isKiro ? COLOR_EFFECT_ALT : COLOR_TEXT_WHITE;

  // Effect position (relative to right eye, above eyes)
  int effectX = rightEyeX + ew + (2 * SCALE);
  int effectY = eyeY - (18 * SCALE);

  // Only draw effects and sunglasses (eyes are in the images)
  switch (eyeType) {
    case EYE_FOCUSED:
      // Sunglasses for Matrix style (working state)
      drawSunglasses(tft, leftEyeX, rightEyeX, eyeY, ew, eh, isKiro);
      break;

    case EYE_ALERT:
      // Question mark effect (notification state)
      drawQuestionMark(tft, effectX, effectY);
      break;

    case EYE_SPARKLE:
      // Sparkle effect (start state)
      drawSparkle(tft, effectX, effectY + (2 * SCALE), effectColor);
      break;

    case EYE_THINKING:
      // Thought bubble effect (thinking state)
      drawThoughtBubble(tft, effectX, effectY, animFrame, effectColor);
      break;

    case EYE_SLEEP:
      // Sleep eyes (closed eyes) and Zzz effect
      drawSleepEyes(tft, leftEyeX, rightEyeX, eyeY, ew, eh, character->color, isKiro);
      drawZzz(tft, effectX, effectY, animFrame, effectColor);
      break;

    case EYE_BLINK:
      // Blink eyes (closed eyes without Zzz)
      drawSleepEyes(tft, leftEyeX, rightEyeX, eyeY, ew, eh, character->color, isKiro);
      break;

    case EYE_HAPPY:
      // Happy eyes (> <) for done state
      drawHappyEyes(tft, leftEyeX, rightEyeX, eyeY, ew, eh, character->color, isKiro);
      break;

    default:
      // EYE_NORMAL: no additional effects needed
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

// Draw thought bubble animation for thinking state (scaled 2x)
void drawThoughtBubble(TFT_eSPI &tft, int x, int y, int frame, uint16_t color = COLOR_TEXT_WHITE) {
  // Small dots leading to bubble (always visible)
  tft.fillRect(x, y + (6 * SCALE), 2 * SCALE, 2 * SCALE, color);
  tft.fillRect(x + (2 * SCALE), y + (3 * SCALE), 2 * SCALE, 2 * SCALE, color);

  // Main bubble (animated size)
  if ((frame % 12) < 6) {
    // Larger bubble
    tft.fillRect(x + (3 * SCALE), y - (2 * SCALE), 6 * SCALE, 2 * SCALE, color);
    tft.fillRect(x + (2 * SCALE), y, 8 * SCALE, 3 * SCALE, color);
    tft.fillRect(x + (3 * SCALE), y + (3 * SCALE), 6 * SCALE, 1 * SCALE, color);
  } else {
    // Smaller bubble
    tft.fillRect(x + (4 * SCALE), y - (1 * SCALE), 4 * SCALE, 2 * SCALE, color);
    tft.fillRect(x + (3 * SCALE), y + (1 * SCALE), 6 * SCALE, 2 * SCALE, color);
  }
}

// Matrix rain colors (green shades - movie style)
#define COLOR_MATRIX_WHITE  0xCFF9  // #CCFFCC
#define COLOR_MATRIX_BRIGHT 0x07E0  // #00FF00
#define COLOR_MATRIX_MID    0x05E0  // #00BB00
#define COLOR_MATRIX_DIM    0x0440  // #008800
#define COLOR_MATRIX_DARK   0x0220  // #004400

// Pseudo-random number generator for consistent randomness
float pseudoRandom(int seed) {
  float x = sin(seed * 9999.0) * 10000.0;
  return x - floor(x);
}

// Draw matrix stream with movie-style effect
void drawMatrixStreamMovie(TFT_eSPI &tft, int x, int y, int frame, int offset, int height, int speed, int tailLen, int seed) {
  if (height < 4) return;
  int pos = (frame * speed + offset) % height;

  // Head: bright white/green (flicker effect)
  bool flicker = ((frame + seed) % 3) == 0;
  uint16_t headColor = flicker ? COLOR_MATRIX_WHITE : COLOR_MATRIX_BRIGHT;
  tft.fillRect(x, y + (pos * SCALE), 2 * SCALE, 2 * SCALE, headColor);

  // Tail with gradient
  if (pos >= 2) tft.fillRect(x, y + ((pos - 2) * SCALE), 2 * SCALE, 2 * SCALE, COLOR_MATRIX_BRIGHT);
  if (pos >= 4) tft.fillRect(x, y + ((pos - 4) * SCALE), 2 * SCALE, 2 * SCALE, COLOR_MATRIX_MID);
  if (pos >= 6) tft.fillRect(x, y + ((pos - 6) * SCALE), 2 * SCALE, 2 * SCALE, COLOR_MATRIX_MID);
  if (tailLen >= 8 && pos >= 8) tft.fillRect(x, y + ((pos - 8) * SCALE), 2 * SCALE, 2 * SCALE, COLOR_MATRIX_DIM);
  if (tailLen >= 8 && pos >= 10) tft.fillRect(x, y + ((pos - 10) * SCALE), 2 * SCALE, 2 * SCALE, COLOR_MATRIX_DARK);
}

// Draw matrix background effect (full area, movie style)
void drawMatrixBackground(TFT_eSPI &tft, int x, int y, int frame, int size, int bodyX, int bodyY, int bodyW, int bodyH) {
  // Draw streams across entire area (character will be drawn on top)
  for (int i = 0; i < size / 4; i++) {
    int seed = i * 23 + 7;
    // Show ~70% of streams for dense matrix look
    if (pseudoRandom(seed + 100) > 0.7) continue;
    int colX = x + (i * 4 * SCALE);
    int offset = (int)(pseudoRandom(seed) * size);
    // Variable speed: some fast, some slow (1-6)
    int speed = 1 + (int)(pseudoRandom(seed + 1) * 6);
    // Variable tail length based on speed
    int tailLen = speed > 3 ? 8 : 6;
    drawMatrixStreamMovie(tft, colX, y, frame, offset, size, speed, tailLen, seed);
  }
}

// Draw loading dots animation (slow = true for thinking state)
void drawLoadingDots(TFT_eSPI &tft, int centerX, int y, int frame, bool slow = false) {
  int dotRadius = 4;
  int dotSpacing = 16;
  int startX = centerX - (dotSpacing * 1.5);
  int adjustedFrame = slow ? (frame / 3) : frame;

  for (int i = 0; i < 4; i++) {
    int dotX = startX + (i * dotSpacing);
    uint16_t color = (i == (adjustedFrame % 4)) ? COLOR_TEXT_WHITE : COLOR_TEXT_DIM;
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
// Note: With image-based rendering, blinking redraws character image (eyes are in image)
void drawBlinkEyes(TFT_eSPI &tft, int x, int y, int frame, const CharacterGeometry* character = &CHAR_CLAWD) {
  // Calculate eye positions from character position
  int leftEyeX = x + (character->eyeLeftX * SCALE);
  int rightEyeX = x + (character->eyeRightX * SCALE);
  int eyeY = y + (character->eyeY * SCALE);
  int ew = character->eyeW * SCALE;
  int eh = character->eyeH * SCALE;
  bool isKiro = (character == &CHAR_KIRO);

  // Use drawSleepEyes to close the eyes (same effect, no Zzz)
  drawSleepEyes(tft, leftEyeX, rightEyeX, eyeY, ew, eh, character->color, isKiro);
}

// Forward declaration of AppState enum (defined in main .ino)
enum AppState {
  STATE_START,
  STATE_IDLE,
  STATE_THINKING,
  STATE_PLANNING,
  STATE_WORKING,
  STATE_NOTIFICATION,
  STATE_DONE,
  STATE_SLEEP
};

// Get background color for state (enum version - efficient)
uint16_t getBackgroundColorEnum(AppState state) {
  switch (state) {
    case STATE_START: return COLOR_BG_SESSION;
    case STATE_IDLE: return COLOR_BG_IDLE;
    case STATE_THINKING: return COLOR_BG_THINKING;
    case STATE_PLANNING: return COLOR_BG_PLANNING;
    case STATE_WORKING: return COLOR_BG_WORKING;
    case STATE_NOTIFICATION: return COLOR_BG_NOTIFY;
    case STATE_DONE: return COLOR_BG_DONE;
    case STATE_SLEEP: return COLOR_BG_SLEEP;
    default: return COLOR_BG_IDLE;
  }
}

// Get eye type for state (enum version - efficient)
EyeType getEyeTypeEnum(AppState state) {
  switch (state) {
    case STATE_START: return EYE_SPARKLE;
    case STATE_IDLE: return EYE_NORMAL;
    case STATE_THINKING: return EYE_THINKING;
    case STATE_PLANNING: return EYE_THINKING;
    case STATE_WORKING: return EYE_FOCUSED;
    case STATE_NOTIFICATION: return EYE_ALERT;
    case STATE_DONE: return EYE_HAPPY;
    case STATE_SLEEP: return EYE_SLEEP;
    default: return EYE_NORMAL;
  }
}

// Get text color for state (enum version - efficient)
uint16_t getTextColorEnum(AppState state) {
  switch (state) {
    case STATE_START: return TFT_BLACK;
    case STATE_NOTIFICATION: return TFT_BLACK;
    default: return COLOR_TEXT_WHITE;
  }
}

// Helper to lowercase a string in place
void toLowerStr(char* str) {
  for (int i = 0; str[i]; i++) {
    if (str[i] >= 'A' && str[i] <= 'Z') {
      str[i] = str[i] + 32;
    }
  }
}

// Get working text based on tool (writes to buffer, no String allocation)
void getWorkingTextBuf(const char* tool, char* buf, size_t bufSize) {
  int idx = random(3);
  char toolLower[32];
  strncpy(toolLower, tool, sizeof(toolLower) - 1);
  toolLower[sizeof(toolLower) - 1] = '\0';
  toLowerStr(toolLower);

  const char* result = DEFAULT_TEXTS[idx];
  if (strcmp(toolLower, "bash") == 0) result = BASH_TEXTS[idx];
  else if (strcmp(toolLower, "read") == 0) result = READ_TEXTS[idx];
  else if (strcmp(toolLower, "edit") == 0) result = EDIT_TEXTS[idx];
  else if (strcmp(toolLower, "write") == 0) result = WRITE_TEXTS[idx];
  else if (strcmp(toolLower, "grep") == 0) result = GREP_TEXTS[idx];
  else if (strcmp(toolLower, "glob") == 0) result = GLOB_TEXTS[idx];
  else if (strcmp(toolLower, "task") == 0) result = TASK_TEXTS[idx];
  else if (strcmp(toolLower, "webfetch") == 0) result = WEBFETCH_TEXTS[idx];
  else if (strcmp(toolLower, "websearch") == 0) result = WEBSEARCH_TEXTS[idx];

  strncpy(buf, result, bufSize - 1);
  buf[bufSize - 1] = '\0';
}

// Get status text for state (enum version, writes to buffer)
void getStatusTextEnum(AppState state, const char* tool, char* buf, size_t bufSize) {
  switch (state) {
    case STATE_START:
      strncpy(buf, "Hello!", bufSize - 1);
      break;
    case STATE_IDLE:
      strncpy(buf, "Ready", bufSize - 1);
      break;
    case STATE_THINKING:
      strncpy(buf, THINKING_TEXTS[random(3)], bufSize - 1);
      break;
    case STATE_PLANNING:
      strncpy(buf, PLANNING_TEXTS[random(3)], bufSize - 1);
      break;
    case STATE_WORKING:
      getWorkingTextBuf(tool, buf, bufSize);
      return;  // Already null-terminated
    case STATE_NOTIFICATION:
      strncpy(buf, "Input?", bufSize - 1);
      break;
    case STATE_DONE:
      strncpy(buf, "Done!", bufSize - 1);
      break;
    case STATE_SLEEP:
      strncpy(buf, "Zzz...", bufSize - 1);
      break;
    default:
      strncpy(buf, "Ready", bufSize - 1);
      break;
  }
  buf[bufSize - 1] = '\0';
}

// Legacy String versions for compatibility
uint16_t getBackgroundColor(String state) {
  if (state == "start") return COLOR_BG_SESSION;
  if (state == "idle") return COLOR_BG_IDLE;
  if (state == "thinking") return COLOR_BG_THINKING;
  if (state == "planning") return COLOR_BG_PLANNING;
  if (state == "working") return COLOR_BG_WORKING;
  if (state == "notification") return COLOR_BG_NOTIFY;
  if (state == "done") return COLOR_BG_DONE;
  if (state == "sleep") return COLOR_BG_SLEEP;
  return COLOR_BG_IDLE;
}

EyeType getEyeType(String state) {
  if (state == "start") return EYE_SPARKLE;
  if (state == "idle") return EYE_NORMAL;
  if (state == "thinking") return EYE_THINKING;
  if (state == "planning") return EYE_THINKING;
  if (state == "working") return EYE_FOCUSED;
  if (state == "notification") return EYE_ALERT;
  if (state == "done") return EYE_HAPPY;
  if (state == "sleep") return EYE_SLEEP;
  return EYE_NORMAL;
}

String getWorkingText(String tool) {
  char buf[32];
  getWorkingTextBuf(tool.c_str(), buf, sizeof(buf));
  return String(buf);
}

String getThinkingText() {
  return THINKING_TEXTS[random(3)];
}

String getPlanningText() {
  return PLANNING_TEXTS[random(3)];
}

String getStatusText(String state, String tool = "") {
  if (state == "start") return "Hello!";
  if (state == "idle") return "Ready";
  if (state == "thinking") return getThinkingText();
  if (state == "planning") return getPlanningText();
  if (state == "working") return getWorkingText(tool);
  if (state == "notification") return "Input?";
  if (state == "done") return "Done!";
  if (state == "sleep") return "Zzz...";
  return state;
}

uint16_t getTextColor(String state) {
  if (state == "start") return TFT_BLACK;
  if (state == "notification") return TFT_BLACK;
  return COLOR_TEXT_WHITE;
}

// Draw folder icon (📂) - 8x7 pixels
void drawFolderIcon(TFT_eSPI &tft, int x, int y, uint16_t color) {
  // Folder tab (top)
  tft.fillRect(x, y, 3, 1, color);
  // Folder body
  tft.fillRect(x, y + 1, 8, 6, color);
  // Inner fold line
  tft.fillRect(x + 1, y + 2, 6, 1, 0x0000);
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
  tft.fillRect(x + 4, y + 1, 1, 5, 0x0000);
  // Top bumps
  tft.fillRect(x + 2, y, 1, 1, 0x0000);
  tft.fillRect(x + 5, y, 1, 1, 0x0000);
}

// =============================================================================
// Sprite versions of drawing functions (for double buffering - no flickering)
// =============================================================================

// Draw matrix stream to sprite
void drawMatrixStreamMovieToSprite(TFT_eSprite &sprite, int x, int y, int frame, int offset, int height, int speed, int tailLen, int seed) {
  if (height < 4) return;
  int pos = (frame * speed + offset) % height;

  // Head: bright white/green (flicker effect)
  bool flicker = ((frame + seed) % 3) == 0;
  uint16_t headColor = flicker ? COLOR_MATRIX_WHITE : COLOR_MATRIX_BRIGHT;
  sprite.fillRect(x, y + (pos * SCALE), 2 * SCALE, 2 * SCALE, headColor);

  // Tail with gradient
  if (pos >= 2) sprite.fillRect(x, y + ((pos - 2) * SCALE), 2 * SCALE, 2 * SCALE, COLOR_MATRIX_BRIGHT);
  if (pos >= 4) sprite.fillRect(x, y + ((pos - 4) * SCALE), 2 * SCALE, 2 * SCALE, COLOR_MATRIX_MID);
  if (pos >= 6) sprite.fillRect(x, y + ((pos - 6) * SCALE), 2 * SCALE, 2 * SCALE, COLOR_MATRIX_MID);
  if (tailLen >= 8 && pos >= 8) sprite.fillRect(x, y + ((pos - 8) * SCALE), 2 * SCALE, 2 * SCALE, COLOR_MATRIX_DIM);
  if (tailLen >= 8 && pos >= 10) sprite.fillRect(x, y + ((pos - 10) * SCALE), 2 * SCALE, 2 * SCALE, COLOR_MATRIX_DARK);
}

// Draw matrix background to sprite
void drawMatrixBackgroundToSprite(TFT_eSprite &sprite, int frame, int size, int bodyX, int bodyY, int bodyW, int bodyH) {
  for (int i = 0; i < size / 4; i++) {
    int seed = i * 23 + 7;
    if (pseudoRandom(seed + 100) > 0.7) continue;
    int colX = i * 4 * SCALE;
    int offset = (int)(pseudoRandom(seed) * size);
    int speed = 1 + (int)(pseudoRandom(seed + 1) * 6);
    int tailLen = speed > 3 ? 8 : 6;
    drawMatrixStreamMovieToSprite(sprite, colX, 0, frame, offset, size, speed, tailLen, seed);
  }
}

// Draw sleep eyes to sprite
void drawSleepEyesToSprite(TFT_eSprite &sprite, int leftEyeX, int rightEyeX, int eyeY, int ew, int eh, uint16_t bodyColor, bool isKiro = false) {
  int lensW, lensH, lensY, leftLensX, rightLensX;
  getEyeCoverPosition(leftEyeX, rightEyeX, eyeY, ew, eh, isKiro, lensW, lensH, lensY, leftLensX, rightLensX);

  sprite.fillRect(leftLensX, lensY, lensW, lensH, bodyColor);
  sprite.fillRect(rightLensX, lensY, lensW, lensH, bodyColor);

  int closedEyeY = lensY + lensH / 2;
  int closedEyeH = 2 * SCALE;
  sprite.fillRect(leftLensX + SCALE, closedEyeY, lensW - (2 * SCALE), closedEyeH, COLOR_EYE);
  sprite.fillRect(rightLensX + SCALE, closedEyeY, lensW - (2 * SCALE), closedEyeH, COLOR_EYE);
}

// Draw happy eyes to sprite
void drawHappyEyesToSprite(TFT_eSprite &sprite, int leftEyeX, int rightEyeX, int eyeY, int ew, int eh, uint16_t bodyColor, bool isKiro = false) {
  int lensW, lensH, lensY, leftLensX, rightLensX;
  getEyeCoverPosition(leftEyeX, rightEyeX, eyeY, ew, eh, isKiro, lensW, lensH, lensY, leftLensX, rightLensX);

  sprite.fillRect(leftLensX, lensY, lensW, lensH, bodyColor);
  sprite.fillRect(rightLensX, lensY, lensW, lensH, bodyColor);

  int centerY = lensY + lensH / 2;
  int leftCenterX = leftLensX + lensW / 2;
  int rightCenterX = rightLensX + lensW / 2;

  // Draw > for left eye
  sprite.fillRect(leftCenterX - (2 * SCALE), centerY - (2 * SCALE), 2 * SCALE, 2 * SCALE, COLOR_EYE);
  sprite.fillRect(leftCenterX, centerY, 2 * SCALE, 2 * SCALE, COLOR_EYE);
  sprite.fillRect(leftCenterX - (2 * SCALE), centerY + (2 * SCALE), 2 * SCALE, 2 * SCALE, COLOR_EYE);

  // Draw < for right eye
  sprite.fillRect(rightCenterX + SCALE, centerY - (2 * SCALE), 2 * SCALE, 2 * SCALE, COLOR_EYE);
  sprite.fillRect(rightCenterX - SCALE, centerY, 2 * SCALE, 2 * SCALE, COLOR_EYE);
  sprite.fillRect(rightCenterX + SCALE, centerY + (2 * SCALE), 2 * SCALE, 2 * SCALE, COLOR_EYE);
}

// Draw sunglasses to sprite
void drawSunglassesToSprite(TFT_eSprite &sprite, int leftEyeX, int rightEyeX, int eyeY, int ew, int eh, bool isKiro = false) {
  int lensW, lensH, lensY, leftLensX, rightLensX;
  getEyeCoverPosition(leftEyeX, rightEyeX, eyeY, ew, eh, isKiro, lensW, lensH, lensY, leftLensX, rightLensX);

  // Left lens
  sprite.fillRect(leftLensX, lensY, lensW, lensH, COLOR_SUNGLASSES_LENS);
  sprite.fillRect(leftLensX + SCALE, lensY + SCALE, 2 * SCALE, SCALE, COLOR_SUNGLASSES_SHINE);

  // Right lens
  sprite.fillRect(rightLensX, lensY, lensW, lensH, COLOR_SUNGLASSES_LENS);
  sprite.fillRect(rightLensX + SCALE, lensY + SCALE, 2 * SCALE, SCALE, COLOR_SUNGLASSES_SHINE);

  // Frame
  sprite.fillRect(leftLensX - SCALE, lensY - SCALE, lensW + (2 * SCALE), SCALE, COLOR_SUNGLASSES_FRAME);
  sprite.fillRect(rightLensX - SCALE, lensY - SCALE, lensW + (2 * SCALE), SCALE, COLOR_SUNGLASSES_FRAME);
  sprite.fillRect(leftLensX - SCALE, lensY + lensH, lensW + (2 * SCALE), SCALE, COLOR_SUNGLASSES_FRAME);
  sprite.fillRect(rightLensX - SCALE, lensY + lensH, lensW + (2 * SCALE), SCALE, COLOR_SUNGLASSES_FRAME);
  sprite.fillRect(leftLensX - SCALE, lensY, SCALE, lensH, COLOR_SUNGLASSES_FRAME);
  sprite.fillRect(leftLensX + lensW, lensY, SCALE, lensH, COLOR_SUNGLASSES_FRAME);
  sprite.fillRect(rightLensX - SCALE, lensY, SCALE, lensH, COLOR_SUNGLASSES_FRAME);
  sprite.fillRect(rightLensX + lensW, lensY, SCALE, lensH, COLOR_SUNGLASSES_FRAME);

  // Bridge
  int bridgeY = lensY + lensH / 2;
  sprite.fillRect(leftLensX + lensW, bridgeY, rightLensX - leftLensX - lensW, SCALE, COLOR_SUNGLASSES_FRAME);
}

// Draw sparkle to sprite
void drawSparkleToSprite(TFT_eSprite &sprite, int x, int y, uint16_t sparkleColor = COLOR_TEXT_WHITE) {
  int frame = animFrame % 4;
  sprite.fillRect(x + (2 * SCALE), y + (2 * SCALE), 2 * SCALE, 2 * SCALE, sparkleColor);

  if (frame == 0 || frame == 2) {
    sprite.fillRect(x + (2 * SCALE), y, 2 * SCALE, 2 * SCALE, sparkleColor);
    sprite.fillRect(x + (2 * SCALE), y + (4 * SCALE), 2 * SCALE, 2 * SCALE, sparkleColor);
    sprite.fillRect(x, y + (2 * SCALE), 2 * SCALE, 2 * SCALE, sparkleColor);
    sprite.fillRect(x + (4 * SCALE), y + (2 * SCALE), 2 * SCALE, 2 * SCALE, sparkleColor);
  } else {
    sprite.fillRect(x, y, 2 * SCALE, 2 * SCALE, sparkleColor);
    sprite.fillRect(x + (4 * SCALE), y, 2 * SCALE, 2 * SCALE, sparkleColor);
    sprite.fillRect(x, y + (4 * SCALE), 2 * SCALE, 2 * SCALE, sparkleColor);
    sprite.fillRect(x + (4 * SCALE), y + (4 * SCALE), 2 * SCALE, 2 * SCALE, sparkleColor);
  }
}

// Draw question mark to sprite
void drawQuestionMarkToSprite(TFT_eSprite &sprite, int x, int y) {
  uint16_t color = TFT_BLACK;
  sprite.fillRect(x + (1 * SCALE), y, 4 * SCALE, 2 * SCALE, color);
  sprite.fillRect(x + (4 * SCALE), y + (2 * SCALE), 2 * SCALE, 2 * SCALE, color);
  sprite.fillRect(x + (2 * SCALE), y + (4 * SCALE), 2 * SCALE, 2 * SCALE, color);
  sprite.fillRect(x + (2 * SCALE), y + (6 * SCALE), 2 * SCALE, 2 * SCALE, color);
  sprite.fillRect(x + (2 * SCALE), y + (10 * SCALE), 2 * SCALE, 2 * SCALE, color);
}

// Draw Zzz to sprite
void drawZzzToSprite(TFT_eSprite &sprite, int x, int y, int frame, uint16_t color = COLOR_TEXT_WHITE) {
  if ((frame % 20) < 10) {
    sprite.fillRect(x, y, 6 * SCALE, 1 * SCALE, color);
    sprite.fillRect(x + (4 * SCALE), y + (1 * SCALE), 2 * SCALE, 1 * SCALE, color);
    sprite.fillRect(x + (3 * SCALE), y + (2 * SCALE), 2 * SCALE, 1 * SCALE, color);
    sprite.fillRect(x + (2 * SCALE), y + (3 * SCALE), 2 * SCALE, 1 * SCALE, color);
    sprite.fillRect(x + (1 * SCALE), y + (4 * SCALE), 2 * SCALE, 1 * SCALE, color);
    sprite.fillRect(x, y + (5 * SCALE), 6 * SCALE, 1 * SCALE, color);
  }
}

// Draw thought bubble to sprite
void drawThoughtBubbleToSprite(TFT_eSprite &sprite, int x, int y, int frame, uint16_t color = COLOR_TEXT_WHITE) {
  sprite.fillRect(x, y + (6 * SCALE), 2 * SCALE, 2 * SCALE, color);
  sprite.fillRect(x + (2 * SCALE), y + (3 * SCALE), 2 * SCALE, 2 * SCALE, color);

  if ((frame % 12) < 6) {
    sprite.fillRect(x + (3 * SCALE), y - (2 * SCALE), 6 * SCALE, 2 * SCALE, color);
    sprite.fillRect(x + (2 * SCALE), y, 8 * SCALE, 3 * SCALE, color);
    sprite.fillRect(x + (3 * SCALE), y + (3 * SCALE), 6 * SCALE, 1 * SCALE, color);
  } else {
    sprite.fillRect(x + (4 * SCALE), y - (1 * SCALE), 4 * SCALE, 2 * SCALE, color);
    sprite.fillRect(x + (3 * SCALE), y + (1 * SCALE), 6 * SCALE, 2 * SCALE, color);
  }
}

// Draw eyes to sprite based on eye type
void drawEyesToSprite(TFT_eSprite &sprite, EyeType eyeType, const CharacterGeometry* character = &CHAR_CLAWD) {
  int leftEyeX = character->eyeLeftX * SCALE;
  int rightEyeX = character->eyeRightX * SCALE;
  int eyeY = character->eyeY * SCALE;
  int ew = character->eyeW * SCALE;
  int eh = character->eyeH * SCALE;
  bool isKiro = (character == &CHAR_KIRO);

  uint16_t effectColor = isKiro ? COLOR_EFFECT_ALT : COLOR_TEXT_WHITE;
  int effectX = rightEyeX + ew + (2 * SCALE);
  int effectY = eyeY - (18 * SCALE);

  switch (eyeType) {
    case EYE_FOCUSED:
      drawSunglassesToSprite(sprite, leftEyeX, rightEyeX, eyeY, ew, eh, isKiro);
      break;
    case EYE_ALERT:
      drawQuestionMarkToSprite(sprite, effectX, effectY);
      break;
    case EYE_SPARKLE:
      drawSparkleToSprite(sprite, effectX, effectY + (2 * SCALE), effectColor);
      break;
    case EYE_THINKING:
      drawThoughtBubbleToSprite(sprite, effectX, effectY, animFrame, effectColor);
      break;
    case EYE_SLEEP:
      drawSleepEyesToSprite(sprite, leftEyeX, rightEyeX, eyeY, ew, eh, character->color, isKiro);
      drawZzzToSprite(sprite, effectX, effectY, animFrame, effectColor);
      break;
    case EYE_BLINK:
      drawSleepEyesToSprite(sprite, leftEyeX, rightEyeX, eyeY, ew, eh, character->color, isKiro);
      break;
    case EYE_HAPPY:
      drawHappyEyesToSprite(sprite, leftEyeX, rightEyeX, eyeY, ew, eh, character->color, isKiro);
      break;
    default:
      break;
  }
}

#endif // SPRITES_H
