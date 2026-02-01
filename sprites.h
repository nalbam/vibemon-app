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
#include "img_claw.h"

// Character colors (RGB565)
#define COLOR_CLAUDE      0xDBAA  // #D97757 Claude orange (217,119,87)
#define COLOR_KIRO        0xFFFF  // #FFFFFF White ghost
#define COLOR_CLAW        0xDA28  // #DD4444 Claw red (221,68,68)
#define COLOR_EYE         0x0000  // #000000 Black
#define COLOR_TRANSPARENT 0x0000  // Transparent (same as background)
#define COLOR_EFFECT_ALT  0xFD20  // #FFA500 Orange for white character effects

// Transparent color marker for pushImage (magenta 0xF81F is common convention)
#define COLOR_TRANSPARENT_MARKER 0xF81F

// Helper function to draw PROGMEM image with transparency to TFT
// Optimized: Uses pushImage instead of pixel-by-pixel drawing (100x faster)
void drawImageToTFT(TFT_eSPI &tft, int offsetX, int offsetY, const uint16_t* img, int width, int height, uint16_t transparentColor) {
  // LovyanGFX pushImage with transparent color support
  // This sends the entire image in one SPI transaction, skipping transparent pixels
  tft.pushImage(offsetX, offsetY, width, height, img, transparentColor);
}

// Draw character image from RGB565 array (128x128) with transparency
void drawClawdImage(TFT_eSPI &tft, int x, int y) {
  drawImageToTFT(tft, x, y, IMG_CLAWD, IMG_CLAWD_WIDTH, IMG_CLAWD_HEIGHT, COLOR_TRANSPARENT_MARKER);
}

void drawKiroImage(TFT_eSPI &tft, int x, int y) {
  drawImageToTFT(tft, x, y, IMG_KIRO, IMG_KIRO_WIDTH, IMG_KIRO_HEIGHT, COLOR_TRANSPARENT_MARKER);
}

void drawClawImage(TFT_eSPI &tft, int x, int y) {
  drawImageToTFT(tft, x, y, IMG_CLAW, IMG_CLAW_WIDTH, IMG_CLAW_HEIGHT, COLOR_TRANSPARENT_MARKER);
}

// Helper function to draw PROGMEM image with transparency to sprite
// Optimized: Uses pushImage instead of pixel-by-pixel drawing (100x faster)
void drawImageWithTransparency(TFT_eSprite &sprite, const uint16_t* img, int width, int height, uint16_t transparentColor) {
  // LovyanGFX pushImage with transparent color support
  // Transparent pixels (0xF81F magenta) are skipped, preserving the background
  sprite.pushImage(0, 0, width, height, img, transparentColor);
}

// Sprite versions for double buffering
void drawClawdImageToSprite(TFT_eSprite &sprite) {
  drawImageWithTransparency(sprite, IMG_CLAWD, IMG_CLAWD_WIDTH, IMG_CLAWD_HEIGHT, COLOR_TRANSPARENT_MARKER);
}

void drawKiroImageToSprite(TFT_eSprite &sprite) {
  drawImageWithTransparency(sprite, IMG_KIRO, IMG_KIRO_WIDTH, IMG_KIRO_HEIGHT, COLOR_TRANSPARENT_MARKER);
}

void drawClawImageToSprite(TFT_eSprite &sprite) {
  drawImageWithTransparency(sprite, IMG_CLAW, IMG_CLAW_WIDTH, IMG_CLAW_HEIGHT, COLOR_TRANSPARENT_MARKER);
}

// Character geometry structure
typedef struct {
  const char* name;
  uint16_t color;
  // Eyes
  int eyeLeftX, eyeRightX, eyeY, eyeW, eyeH;
  // Effect position (sparkle, thought bubble, zzz, etc.)
  int effectX, effectY;
} CharacterGeometry;

// Character definitions
const CharacterGeometry CHAR_CLAWD = {
  "clawd",
  COLOR_CLAUDE,
  // Eyes (leftX, rightX, y, w, h)
  14, 44, 22, 6, 6,
  // Effect position (effectX, effectY)
  52, 4
};

const CharacterGeometry CHAR_KIRO = {
  "kiro",
  COLOR_KIRO,
  // Eyes (leftX, rightX, y, w, h) - tall vertical eyes
  30, 39, 21, 5, 8,
  // Effect position (effectX, effectY)
  50, 3
};

const CharacterGeometry CHAR_CLAW = {
  "claw",
  COLOR_CLAW,
  // Eyes (leftX, rightX, y, w, h)
  21, 38, 16, 6, 6,
  // Effect position (effectX, effectY)
  49, 4
};

// Character array for dynamic lookup
// To add a new character, add to this array and define the CharacterGeometry above
const CharacterGeometry* ALL_CHARACTERS[] = {
  &CHAR_CLAWD,
  &CHAR_KIRO,
  &CHAR_CLAW
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
// DEPRECATED: Use getCharacterByName(const char*) to avoid heap allocation
const CharacterGeometry* getCharacter(String name) {
  return getCharacterByName(name.c_str());
}

// DEPRECATED: Use isValidCharacter(const char*) to avoid heap allocation
bool isValidCharacter(String name) {
  return isValidCharacter(name.c_str());
}

// Background colors by state (RGB565)
#define COLOR_BG_SESSION  0x0679  // #00CCCC Cyan
#define COLOR_BG_IDLE     0x0540  // #00AA00 Green
#define COLOR_BG_THINKING 0xA997  // #AA33BB Purple
#define COLOR_BG_PLANNING 0x0451  // #008888 Teal
#define COLOR_BG_WORKING  0x0339  // #0066CC Blue
#define COLOR_BG_PACKING  0xAD55  // #AAAAAA Gray
#define COLOR_BG_NOTIFY   0xFE60  // #FFCC00 Yellow
#define COLOR_BG_DONE     0x0540  // #00AA00 Green
#define COLOR_BG_SLEEP    0x1088  // #111144 Navy blue

// Text colors
#define COLOR_TEXT_WHITE  0xFFFF
#define COLOR_TEXT_DIM    0x7BEF

// Character dimensions (128x128, doubled from 64x64)
#define CHAR_WIDTH  128
#define CHAR_HEIGHT 128
#define SCALE       2    // Scale factor from original design

// Eye types (visual appearance of eyes)
enum EyeType {
  EYE_NORMAL,      // Normal square eyes (default)
  EYE_BLINK,       // Closed eyes (horizontal lines)
  EYE_HAPPY,       // Happy eyes (> <)
  EYE_FOCUSED      // Sunglasses (Matrix style)
};

// Effect types (visual effects around character)
enum EffectType {
  EFFECT_NONE,     // No effect
  EFFECT_SPARKLE,  // Sparkle effect (start state)
  EFFECT_THINKING, // Thought bubble (thinking/planning state)
  EFFECT_ALERT,    // Question mark (notification state)
  EFFECT_MATRIX,   // Matrix rain background (working state)
  EFFECT_ZZZ       // Zzz animation (sleep state)
};

// Legacy EyeType values for backward compatibility
// DEPRECATED: Use EyeType + EffectType separately
#define EYE_SPARKLE_LEGACY  100  // Maps to EYE_NORMAL + EFFECT_SPARKLE
#define EYE_THINKING_LEGACY 101  // Maps to EYE_NORMAL + EFFECT_THINKING
#define EYE_ALERT_LEGACY    102  // Maps to EYE_NORMAL + EFFECT_ALERT
#define EYE_SLEEP_LEGACY    103  // Maps to EYE_BLINK + EFFECT_ZZZ

// Animation frame counter
extern int animFrame;

// Forward declarations for functions called before definition
void drawMatrixBackground(TFT_eSPI &tft, int x, int y, int frame, int size);
void drawEyeType(TFT_eSPI &tft, int x, int y, EyeType eyeType, const CharacterGeometry* character);
void drawEffectType(TFT_eSPI &tft, int x, int y, EffectType effectType, const CharacterGeometry* character);
void drawQuestionMark(TFT_eSPI &tft, int x, int y);
void drawSparkle(TFT_eSPI &tft, int x, int y, uint16_t sparkleColor);
void drawThoughtBubble(TFT_eSPI &tft, int x, int y, int frame, uint16_t color);
void drawZzz(TFT_eSPI &tft, int x, int y, int frame, uint16_t color);

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
void drawMatrixBackgroundToSprite(TFT_eSprite &sprite, int frame, int size);
void drawEyeTypeToSprite(TFT_eSprite &sprite, EyeType eyeType, const CharacterGeometry* character);
void drawEffectTypeToSprite(TFT_eSprite &sprite, EffectType effectType, const CharacterGeometry* character);

// Draw the Claude character to sprite buffer (128x128) - NO FLICKERING
// New API: separate eyeType and effectType
void drawCharacterToSprite(TFT_eSprite &sprite, EyeType eyeType, EffectType effectType, uint16_t bgColor, const CharacterGeometry* character = &CHAR_CLAWD) {
  // Clear sprite with background color
  sprite.fillSprite(bgColor);

  // Draw matrix background for matrix effect (behind character)
  if (effectType == EFFECT_MATRIX) {
    drawMatrixBackgroundToSprite(sprite, animFrame, CHAR_WIDTH / SCALE);
  }

  // Draw body using images
  if (character == &CHAR_CLAWD) {
    drawClawdImageToSprite(sprite);
  } else if (character == &CHAR_KIRO) {
    drawKiroImageToSprite(sprite);
  } else if (character == &CHAR_CLAW) {
    drawClawImageToSprite(sprite);
  }

  // Draw eye type (normal, blink, happy, focused)
  drawEyeTypeToSprite(sprite, eyeType, character);

  // Draw effect (sparkle, thinking, alert, zzz)
  // Note: matrix effect is drawn above as background
  drawEffectTypeToSprite(sprite, effectType, character);
}

// Legacy: Draw the Claude character at specified position (128x128) - direct to screen
// New API: separate eyeType and effectType
void drawCharacter(TFT_eSPI &tft, int x, int y, EyeType eyeType, EffectType effectType, uint16_t bgColor, const CharacterGeometry* character = &CHAR_CLAWD) {
  // Clear background area
  tft.fillRect(x, y, CHAR_WIDTH, CHAR_HEIGHT, bgColor);

  // Draw matrix background for matrix effect (behind character)
  if (effectType == EFFECT_MATRIX) {
    drawMatrixBackground(tft, x, y, animFrame, CHAR_WIDTH / SCALE);
  }

  // Draw character image
  if (character == &CHAR_CLAWD) {
    drawClawdImage(tft, x, y);
  } else if (character == &CHAR_KIRO) {
    drawKiroImage(tft, x, y);
  } else if (character == &CHAR_CLAW) {
    drawClawImage(tft, x, y);
  }

  // Draw eye type
  drawEyeType(tft, x, y, eyeType, character);

  // Draw effect
  drawEffectType(tft, x, y, effectType, character);
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
// Template version: works with both TFT_eSPI (LGFX) and TFT_eSprite (LGFX_Sprite)
template<typename T>
void drawSleepEyesT(T &canvas, int leftEyeX, int rightEyeX, int eyeY, int ew, int eh, uint16_t bodyColor, bool isKiro = false) {
  int lensW, lensH, lensY, leftLensX, rightLensX;
  getEyeCoverPosition(leftEyeX, rightEyeX, eyeY, ew, eh, isKiro, lensW, lensH, lensY, leftLensX, rightLensX);

  // Cover original eyes with body color (same area as sunglasses)
  canvas.fillRect(leftLensX, lensY, lensW, lensH, bodyColor);
  canvas.fillRect(rightLensX, lensY, lensW, lensH, bodyColor);

  // Draw closed eyes (horizontal lines in the middle)
  int closedEyeY = lensY + lensH / 2;
  int closedEyeH = 2 * SCALE;  // 2px thick line (scaled)
  canvas.fillRect(leftLensX + SCALE, closedEyeY, lensW - (2 * SCALE), closedEyeH, COLOR_EYE);
  canvas.fillRect(rightLensX + SCALE, closedEyeY, lensW - (2 * SCALE), closedEyeH, COLOR_EYE);
}

// Legacy wrapper for TFT
inline void drawSleepEyes(TFT_eSPI &tft, int leftEyeX, int rightEyeX, int eyeY, int ew, int eh, uint16_t bodyColor, bool isKiro = false) {
  drawSleepEyesT(tft, leftEyeX, rightEyeX, eyeY, ew, eh, bodyColor, isKiro);
}

// Draw happy eyes (> < style for done state)
template<typename T>
void drawHappyEyesT(T &canvas, int leftEyeX, int rightEyeX, int eyeY, int ew, int eh, uint16_t bodyColor, bool isKiro = false) {
  int lensW, lensH, lensY, leftLensX, rightLensX;
  getEyeCoverPosition(leftEyeX, rightEyeX, eyeY, ew, eh, isKiro, lensW, lensH, lensY, leftLensX, rightLensX);

  // Cover original eyes with body color
  canvas.fillRect(leftLensX, lensY, lensW, lensH, bodyColor);
  canvas.fillRect(rightLensX, lensY, lensW, lensH, bodyColor);

  // Center position for drawing > <
  int centerY = lensY + lensH / 2;
  int leftCenterX = leftLensX + lensW / 2;
  int rightCenterX = rightLensX + lensW / 2;

  // Draw > for left eye (pointing right)
  canvas.fillRect(leftCenterX - (2 * SCALE), centerY - (2 * SCALE), 2 * SCALE, 2 * SCALE, COLOR_EYE);
  canvas.fillRect(leftCenterX, centerY, 2 * SCALE, 2 * SCALE, COLOR_EYE);
  canvas.fillRect(leftCenterX - (2 * SCALE), centerY + (2 * SCALE), 2 * SCALE, 2 * SCALE, COLOR_EYE);

  // Draw < for right eye (pointing left)
  canvas.fillRect(rightCenterX + SCALE, centerY - (2 * SCALE), 2 * SCALE, 2 * SCALE, COLOR_EYE);
  canvas.fillRect(rightCenterX - SCALE, centerY, 2 * SCALE, 2 * SCALE, COLOR_EYE);
  canvas.fillRect(rightCenterX + SCALE, centerY + (2 * SCALE), 2 * SCALE, 2 * SCALE, COLOR_EYE);
}

inline void drawHappyEyes(TFT_eSPI &tft, int leftEyeX, int rightEyeX, int eyeY, int ew, int eh, uint16_t bodyColor, bool isKiro = false) {
  drawHappyEyesT(tft, leftEyeX, rightEyeX, eyeY, ew, eh, bodyColor, isKiro);
}

// Draw sunglasses (Matrix style)
template<typename T>
void drawSunglassesT(T &canvas, int leftEyeX, int rightEyeX, int eyeY, int ew, int eh, bool isKiro = false) {
  int lensW, lensH, lensY, leftLensX, rightLensX;
  getEyeCoverPosition(leftEyeX, rightEyeX, eyeY, ew, eh, isKiro, lensW, lensH, lensY, leftLensX, rightLensX);

  // Left lens (dark green tint)
  canvas.fillRect(leftLensX, lensY, lensW, lensH, COLOR_SUNGLASSES_LENS);
  // Left lens shine
  canvas.fillRect(leftLensX + SCALE, lensY + SCALE, 2 * SCALE, SCALE, COLOR_SUNGLASSES_SHINE);

  // Right lens (dark green tint)
  canvas.fillRect(rightLensX, lensY, lensW, lensH, COLOR_SUNGLASSES_LENS);
  // Right lens shine
  canvas.fillRect(rightLensX + SCALE, lensY + SCALE, 2 * SCALE, SCALE, COLOR_SUNGLASSES_SHINE);

  // Frame - top
  canvas.fillRect(leftLensX - SCALE, lensY - SCALE, lensW + (2 * SCALE), SCALE, COLOR_SUNGLASSES_FRAME);
  canvas.fillRect(rightLensX - SCALE, lensY - SCALE, lensW + (2 * SCALE), SCALE, COLOR_SUNGLASSES_FRAME);

  // Frame - bottom
  canvas.fillRect(leftLensX - SCALE, lensY + lensH, lensW + (2 * SCALE), SCALE, COLOR_SUNGLASSES_FRAME);
  canvas.fillRect(rightLensX - SCALE, lensY + lensH, lensW + (2 * SCALE), SCALE, COLOR_SUNGLASSES_FRAME);

  // Frame - sides
  canvas.fillRect(leftLensX - SCALE, lensY, SCALE, lensH, COLOR_SUNGLASSES_FRAME);
  canvas.fillRect(leftLensX + lensW, lensY, SCALE, lensH, COLOR_SUNGLASSES_FRAME);
  canvas.fillRect(rightLensX - SCALE, lensY, SCALE, lensH, COLOR_SUNGLASSES_FRAME);
  canvas.fillRect(rightLensX + lensW, lensY, SCALE, lensH, COLOR_SUNGLASSES_FRAME);

  // Bridge (connects two lenses)
  int bridgeY = lensY + lensH / 2;
  canvas.fillRect(leftLensX + lensW, bridgeY, rightLensX - leftLensX - lensW, SCALE, COLOR_SUNGLASSES_FRAME);
}

inline void drawSunglasses(TFT_eSPI &tft, int leftEyeX, int rightEyeX, int eyeY, int ew, int eh, bool isKiro = false) {
  drawSunglassesT(tft, leftEyeX, rightEyeX, eyeY, ew, eh, isKiro);
}

// Draw eye type only (normal, blink, happy, focused)
// EyeType: EYE_NORMAL | EYE_BLINK | EYE_HAPPY | EYE_FOCUSED
void drawEyeType(TFT_eSPI &tft, int x, int y, EyeType eyeType, const CharacterGeometry* character = &CHAR_CLAWD) {
  // Eye base positions (scaled 2x)
  int leftEyeX = x + (character->eyeLeftX * SCALE);
  int rightEyeX = x + (character->eyeRightX * SCALE);
  int eyeY = y + (character->eyeY * SCALE);
  int ew = character->eyeW * SCALE;
  int eh = character->eyeH * SCALE;
  bool isKiro = (character == &CHAR_KIRO);

  switch (eyeType) {
    case EYE_FOCUSED:
      // Sunglasses (Matrix style)
      drawSunglasses(tft, leftEyeX, rightEyeX, eyeY, ew, eh, isKiro);
      break;

    case EYE_BLINK:
      // Closed eyes (horizontal lines)
      drawSleepEyes(tft, leftEyeX, rightEyeX, eyeY, ew, eh, character->color, isKiro);
      break;

    case EYE_HAPPY:
      // Happy eyes (> <)
      drawHappyEyes(tft, leftEyeX, rightEyeX, eyeY, ew, eh, character->color, isKiro);
      break;

    case EYE_NORMAL:
    default:
      // Normal eyes - already in character image, no additional drawing needed
      break;
  }
}

// Draw effect only (sparkle, thinking, alert, zzz)
// EffectType: EFFECT_NONE | EFFECT_SPARKLE | EFFECT_THINKING | EFFECT_ALERT | EFFECT_MATRIX | EFFECT_ZZZ
void drawEffectType(TFT_eSPI &tft, int x, int y, EffectType effectType, const CharacterGeometry* character = &CHAR_CLAWD) {
  bool isKiro = (character == &CHAR_KIRO);
  uint16_t effectColor = isKiro ? COLOR_EFFECT_ALT : COLOR_TEXT_WHITE;

  // Effect position (from character config)
  int effectX = x + (character->effectX * SCALE);
  int effectY = y + (character->effectY * SCALE);

  switch (effectType) {
    case EFFECT_SPARKLE:
      // Sparkle effect
      drawSparkle(tft, effectX, effectY + (2 * SCALE), effectColor);
      break;

    case EFFECT_THINKING:
      // Thought bubble effect
      drawThoughtBubble(tft, effectX, effectY, animFrame, effectColor);
      break;

    case EFFECT_ALERT:
      // Question mark effect
      drawQuestionMark(tft, effectX, effectY);
      break;

    case EFFECT_ZZZ:
      // Zzz sleep effect
      drawZzz(tft, effectX, effectY, animFrame, effectColor);
      break;

    case EFFECT_MATRIX:
      // Matrix rain - handled separately in drawCharacter (background effect)
      break;

    case EFFECT_NONE:
    default:
      // No effect
      break;
  }
}

// Draw sparkle effect (scaled 2x)
template<typename T>
void drawSparkleT(T &canvas, int x, int y, uint16_t sparkleColor = COLOR_TEXT_WHITE) {
  // 4-point star sparkle
  int frame = animFrame % 4;

  // Center dot (2x2 -> 4x4)
  canvas.fillRect(x + (2 * SCALE), y + (2 * SCALE), 2 * SCALE, 2 * SCALE, sparkleColor);

  // Rays (rotating based on frame)
  if (frame == 0 || frame == 2) {
    // Vertical and horizontal
    canvas.fillRect(x + (2 * SCALE), y, 2 * SCALE, 2 * SCALE, sparkleColor);
    canvas.fillRect(x + (2 * SCALE), y + (4 * SCALE), 2 * SCALE, 2 * SCALE, sparkleColor);
    canvas.fillRect(x, y + (2 * SCALE), 2 * SCALE, 2 * SCALE, sparkleColor);
    canvas.fillRect(x + (4 * SCALE), y + (2 * SCALE), 2 * SCALE, 2 * SCALE, sparkleColor);
  } else {
    // Diagonal
    canvas.fillRect(x, y, 2 * SCALE, 2 * SCALE, sparkleColor);
    canvas.fillRect(x + (4 * SCALE), y, 2 * SCALE, 2 * SCALE, sparkleColor);
    canvas.fillRect(x, y + (4 * SCALE), 2 * SCALE, 2 * SCALE, sparkleColor);
    canvas.fillRect(x + (4 * SCALE), y + (4 * SCALE), 2 * SCALE, 2 * SCALE, sparkleColor);
  }
}

inline void drawSparkle(TFT_eSPI &tft, int x, int y, uint16_t sparkleColor = COLOR_TEXT_WHITE) {
  drawSparkleT(tft, x, y, sparkleColor);
}

// Draw question mark effect (scaled 2x)
template<typename T>
void drawQuestionMarkT(T &canvas, int x, int y) {
  uint16_t color = TFT_BLACK;  // Dark on yellow background
  canvas.fillRect(x + (1 * SCALE), y, 4 * SCALE, 2 * SCALE, color);              // Top curve
  canvas.fillRect(x + (4 * SCALE), y + (2 * SCALE), 2 * SCALE, 2 * SCALE, color); // Right side
  canvas.fillRect(x + (2 * SCALE), y + (4 * SCALE), 2 * SCALE, 2 * SCALE, color); // Middle
  canvas.fillRect(x + (2 * SCALE), y + (6 * SCALE), 2 * SCALE, 2 * SCALE, color); // Lower middle
  canvas.fillRect(x + (2 * SCALE), y + (10 * SCALE), 2 * SCALE, 2 * SCALE, color); // Dot
}

inline void drawQuestionMark(TFT_eSPI &tft, int x, int y) {
  drawQuestionMarkT(tft, x, y);
}

// Draw Zzz animation for sleep state (scaled 2x)
template<typename T>
void drawZzzT(T &canvas, int x, int y, int frame, uint16_t color = COLOR_TEXT_WHITE) {
  // Blink effect: show Z for 10 frames, hide for 10 frames (2 second cycle)
  if ((frame % 20) < 10) {
    canvas.fillRect(x, y, 6 * SCALE, 1 * SCALE, color);              // Top
    canvas.fillRect(x + (4 * SCALE), y + (1 * SCALE), 2 * SCALE, 1 * SCALE, color); // Upper diagonal 1
    canvas.fillRect(x + (3 * SCALE), y + (2 * SCALE), 2 * SCALE, 1 * SCALE, color); // Upper diagonal 2
    canvas.fillRect(x + (2 * SCALE), y + (3 * SCALE), 2 * SCALE, 1 * SCALE, color); // Lower diagonal 1
    canvas.fillRect(x + (1 * SCALE), y + (4 * SCALE), 2 * SCALE, 1 * SCALE, color); // Lower diagonal 2
    canvas.fillRect(x, y + (5 * SCALE), 6 * SCALE, 1 * SCALE, color); // Bottom
  }
}

inline void drawZzz(TFT_eSPI &tft, int x, int y, int frame, uint16_t color = COLOR_TEXT_WHITE) {
  drawZzzT(tft, x, y, frame, color);
}

// Draw thought bubble animation for thinking state (scaled 2x)
template<typename T>
void drawThoughtBubbleT(T &canvas, int x, int y, int frame, uint16_t color = COLOR_TEXT_WHITE) {
  // Small dots leading to bubble (always visible)
  canvas.fillRect(x, y + (6 * SCALE), 2 * SCALE, 2 * SCALE, color);
  canvas.fillRect(x + (2 * SCALE), y + (3 * SCALE), 2 * SCALE, 2 * SCALE, color);

  // Main bubble (animated size)
  if ((frame % 12) < 6) {
    // Larger bubble
    canvas.fillRect(x + (3 * SCALE), y - (2 * SCALE), 6 * SCALE, 2 * SCALE, color);
    canvas.fillRect(x + (2 * SCALE), y, 8 * SCALE, 3 * SCALE, color);
    canvas.fillRect(x + (3 * SCALE), y + (3 * SCALE), 6 * SCALE, 1 * SCALE, color);
  } else {
    // Smaller bubble
    canvas.fillRect(x + (4 * SCALE), y - (1 * SCALE), 4 * SCALE, 2 * SCALE, color);
    canvas.fillRect(x + (3 * SCALE), y + (1 * SCALE), 6 * SCALE, 2 * SCALE, color);
  }
}

inline void drawThoughtBubble(TFT_eSPI &tft, int x, int y, int frame, uint16_t color = COLOR_TEXT_WHITE) {
  drawThoughtBubbleT(tft, x, y, frame, color);
}

// Matrix rain colors (green shades - movie style)
#define COLOR_MATRIX_WHITE  0xCFF9  // #CCFFCC
#define COLOR_MATRIX_BRIGHT 0x07E0  // #00FF00
#define COLOR_MATRIX_MID    0x05E0  // #00BB00
#define COLOR_MATRIX_DIM    0x0440  // #008800
#define COLOR_MATRIX_DARK   0x0220  // #004400

// Fast integer-based pseudo-random (5-10x faster than sin-based)
// Returns 0-255 for consistent randomness without floating point
uint8_t fastRandom(uint16_t seed) {
  uint16_t x = seed * 0x9E37;
  x ^= x >> 8;
  x *= 0x5851;
  return (uint8_t)(x >> 8);
}

// Legacy: floating point version for compatibility (if needed)
float pseudoRandom(int seed) {
  return fastRandom((uint16_t)seed) / 255.0f;
}

// Draw matrix stream with movie-style effect
template<typename T>
void drawMatrixStreamMovieT(T &canvas, int x, int y, int frame, int offset, int height, int speed, int tailLen, int seed) {
  if (height < 4) return;
  int pos = (frame * speed + offset) % height;

  // Head: bright white/green (flicker effect)
  bool flicker = ((frame + seed) % 3) == 0;
  uint16_t headColor = flicker ? COLOR_MATRIX_WHITE : COLOR_MATRIX_BRIGHT;
  canvas.fillRect(x, y + (pos * SCALE), 2 * SCALE, 2 * SCALE, headColor);

  // Tail with gradient
  if (pos >= 2) canvas.fillRect(x, y + ((pos - 2) * SCALE), 2 * SCALE, 2 * SCALE, COLOR_MATRIX_BRIGHT);
  if (pos >= 4) canvas.fillRect(x, y + ((pos - 4) * SCALE), 2 * SCALE, 2 * SCALE, COLOR_MATRIX_MID);
  if (pos >= 6) canvas.fillRect(x, y + ((pos - 6) * SCALE), 2 * SCALE, 2 * SCALE, COLOR_MATRIX_MID);
  if (tailLen >= 8 && pos >= 8) canvas.fillRect(x, y + ((pos - 8) * SCALE), 2 * SCALE, 2 * SCALE, COLOR_MATRIX_DIM);
  if (tailLen >= 8 && pos >= 10) canvas.fillRect(x, y + ((pos - 10) * SCALE), 2 * SCALE, 2 * SCALE, COLOR_MATRIX_DARK);
}

inline void drawMatrixStreamMovie(TFT_eSPI &tft, int x, int y, int frame, int offset, int height, int speed, int tailLen, int seed) {
  drawMatrixStreamMovieT(tft, x, y, frame, offset, height, speed, tailLen, seed);
}

// Draw matrix background effect (full area, movie style)
// Template version with x, y offset support
template<typename T>
void drawMatrixBackgroundT(T &canvas, int x, int y, int frame, int size) {
  // Draw streams across entire area (character will be drawn on top)
  for (int i = 0; i < size / 4; i++) {
    uint16_t seed = i * 23 + 7;
    // Show ~70% of streams for dense matrix look (178/255 ≈ 0.70)
    if (fastRandom(seed + 100) > 178) continue;
    int colX = x + (i * 4 * SCALE);
    int offset = (fastRandom(seed) * size) >> 8;  // divide by 256
    // Variable speed: some fast, some slow (1-6)
    int speed = 1 + ((fastRandom(seed + 1) * 6) >> 8);
    // Variable tail length based on speed
    int tailLen = speed > 3 ? 8 : 6;
    drawMatrixStreamMovieT(canvas, colX, y, frame, offset, size, speed, tailLen, seed);
  }
}

inline void drawMatrixBackground(TFT_eSPI &tft, int x, int y, int frame, int size) {
  drawMatrixBackgroundT(tft, x, y, frame, size);
}

// Draw loading dots animation (slow = true for thinking state)
void drawLoadingDots(TFT_eSPI &tft, int centerX, int y, int frame, bool slow = false) {
  int dotRadius = 4;
  int dotSpacing = 16;
  // Use integer arithmetic: 1.5 * 16 = 24
  int startX = centerX - 24;
  int adjustedFrame = slow ? (frame / 3) : frame;

  for (int i = 0; i < 4; i++) {
    int dotX = startX + (i * dotSpacing);
    uint16_t color = (i == (adjustedFrame % 4)) ? COLOR_TEXT_WHITE : COLOR_TEXT_DIM;
    tft.fillCircle(dotX, y, dotRadius, color);
  }
}

// RGB565 color constants for gradient (matches Desktop/statusline.py)
#define COLOR_MEM_GREEN  0x0540  // #00AA00
#define COLOR_MEM_YELLOW 0xFE60  // #FFCC00
#define COLOR_MEM_RED    0xFA28  // #FF4444

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
// Thresholds: 0-74% Green, 75-89% Yellow, 90%+ Red (matches statusline.py)
uint16_t getGradientColor(int pos, int width, int percent) {
  // Calculate base color from percent (smooth transition)
  uint16_t baseStart, baseEnd;
  int baseRatio;

  if (percent < 75) {
    // Green to Yellow range (0-74%)
    baseStart = COLOR_MEM_GREEN;
    baseEnd = COLOR_MEM_YELLOW;
    baseRatio = (percent * 100) / 75;  // 0-100 for 0-75%
  } else if (percent < 90) {
    // Yellow to Orange range (75-89%)
    baseStart = COLOR_MEM_YELLOW;
    baseEnd = COLOR_MEM_RED;
    baseRatio = ((percent - 75) * 100) / 15;  // 0-100 for 75-90%
  } else {
    // Orange to Red range (90-100%)
    baseStart = COLOR_MEM_YELLOW;
    baseEnd = COLOR_MEM_RED;
    baseRatio = 50 + ((percent - 90) * 50) / 10;  // 50-100 for 90-100%
  }

  // Apply position-based gradient within the bar
  int posRatio = (pos * 30) / width;  // 0-30% variation across bar
  int totalRatio = min(100, max(0, baseRatio + posRatio));

  return lerpColor565(baseStart, baseEnd, totalRatio, 100);
}

// Draw memory bar with gradient
// Optimized: Uses segment-based rendering (8px segments) instead of per-pixel
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

  // Fill bar with gradient using segments (8px each for ~8x speedup)
  if (fillWidth > 2) {
    int barHeight = height - 2;
    int innerWidth = fillWidth - 2;
    int segmentSize = 8;

    for (int i = 0; i < innerWidth; i += segmentSize) {
      int segWidth = min(segmentSize, innerWidth - i);
      uint16_t color = getGradientColor(i, innerWidth, clampedPercent);
      tft.fillRect(x + 1 + i, y + 1, segWidth, barHeight, color);
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
  STATE_PACKING,
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
    case STATE_PACKING: return COLOR_BG_PACKING;
    case STATE_NOTIFICATION: return COLOR_BG_NOTIFY;
    case STATE_DONE: return COLOR_BG_DONE;
    case STATE_SLEEP: return COLOR_BG_SLEEP;
    default: return COLOR_BG_IDLE;
  }
}

// Get eye type for state (enum version - efficient)
// Get eye type for state (new API)
// EyeType: EYE_NORMAL | EYE_BLINK | EYE_HAPPY | EYE_FOCUSED
EyeType getEyeTypeEnum(AppState state) {
  switch (state) {
    case STATE_WORKING: return EYE_FOCUSED;
    case STATE_DONE: return EYE_HAPPY;
    case STATE_SLEEP: return EYE_BLINK;
    default: return EYE_NORMAL;
  }
}

// Get effect type for state (new API)
// EffectType: EFFECT_NONE | EFFECT_SPARKLE | EFFECT_THINKING | EFFECT_ALERT | EFFECT_MATRIX | EFFECT_ZZZ
EffectType getEffectTypeEnum(AppState state) {
  switch (state) {
    case STATE_START: return EFFECT_SPARKLE;
    case STATE_THINKING: return EFFECT_THINKING;
    case STATE_PLANNING: return EFFECT_THINKING;
    case STATE_PACKING: return EFFECT_THINKING;
    case STATE_WORKING: return EFFECT_MATRIX;
    case STATE_NOTIFICATION: return EFFECT_ALERT;
    case STATE_SLEEP: return EFFECT_ZZZ;
    default: return EFFECT_NONE;
  }
}

// Get text color for state (enum version - efficient)
uint16_t getTextColorEnum(AppState state) {
  switch (state) {
    case STATE_START: return TFT_BLACK;
    case STATE_PACKING: return TFT_BLACK;
    case STATE_NOTIFICATION: return TFT_BLACK;
    default: return COLOR_TEXT_WHITE;
  }
}

// Get status text for state (enum version, writes to buffer)
// Uses fixed text (no random) to match Desktop states.json
void getStatusTextEnum(AppState state, char* buf, size_t bufSize) {
  switch (state) {
    case STATE_START:
      strncpy(buf, "Hello!", bufSize - 1);
      break;
    case STATE_IDLE:
      strncpy(buf, "Ready", bufSize - 1);
      break;
    case STATE_THINKING:
      strncpy(buf, "Thinking", bufSize - 1);
      break;
    case STATE_PLANNING:
      strncpy(buf, "Planning", bufSize - 1);
      break;
    case STATE_WORKING:
      strncpy(buf, "Working", bufSize - 1);
      break;
    case STATE_PACKING:
      strncpy(buf, "Packing", bufSize - 1);
      break;
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
// DEPRECATED: Use enum versions (getBackgroundColorEnum, etc.) to avoid heap allocation
// These functions allocate memory on heap via String parameter - avoid in production
uint16_t getBackgroundColor(String state) {
  if (state == "start") return COLOR_BG_SESSION;
  if (state == "idle") return COLOR_BG_IDLE;
  if (state == "thinking") return COLOR_BG_THINKING;
  if (state == "planning") return COLOR_BG_PLANNING;
  if (state == "working") return COLOR_BG_WORKING;
  if (state == "packing") return COLOR_BG_PACKING;
  if (state == "notification") return COLOR_BG_NOTIFY;
  if (state == "done") return COLOR_BG_DONE;
  if (state == "sleep") return COLOR_BG_SLEEP;
  return COLOR_BG_IDLE;
}

// Get eye type for state (legacy String version)
EyeType getEyeType(String state) {
  if (state == "working") return EYE_FOCUSED;
  if (state == "done") return EYE_HAPPY;
  if (state == "sleep") return EYE_BLINK;
  return EYE_NORMAL;
}

// Get effect type for state (legacy String version)
EffectType getEffectType(String state) {
  if (state == "start") return EFFECT_SPARKLE;
  if (state == "thinking") return EFFECT_THINKING;
  if (state == "planning") return EFFECT_THINKING;
  if (state == "packing") return EFFECT_THINKING;
  if (state == "working") return EFFECT_MATRIX;
  if (state == "notification") return EFFECT_ALERT;
  if (state == "sleep") return EFFECT_ZZZ;
  return EFFECT_NONE;
}

String getStatusText(String state) {
  if (state == "start") return "Hello!";
  if (state == "idle") return "Ready";
  if (state == "thinking") return "Thinking";
  if (state == "planning") return "Planning";
  if (state == "working") return "Working";
  if (state == "packing") return "Packing";
  if (state == "notification") return "Input?";
  if (state == "done") return "Done!";
  if (state == "sleep") return "Zzz...";
  return state;
}

uint16_t getTextColor(String state) {
  if (state == "start") return TFT_BLACK;
  if (state == "packing") return TFT_BLACK;
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
// Sprite versions - inline wrappers calling template functions
// =============================================================================

inline void drawMatrixStreamMovieToSprite(TFT_eSprite &sprite, int x, int y, int frame, int offset, int height, int speed, int tailLen, int seed) {
  drawMatrixStreamMovieT(sprite, x, y, frame, offset, height, speed, tailLen, seed);
}

// Sprite version with no x,y offset (draws at 0,0)
inline void drawMatrixBackgroundToSprite(TFT_eSprite &sprite, int frame, int size) {
  drawMatrixBackgroundT(sprite, 0, 0, frame, size);
}

inline void drawSleepEyesToSprite(TFT_eSprite &sprite, int leftEyeX, int rightEyeX, int eyeY, int ew, int eh, uint16_t bodyColor, bool isKiro = false) {
  drawSleepEyesT(sprite, leftEyeX, rightEyeX, eyeY, ew, eh, bodyColor, isKiro);
}

inline void drawHappyEyesToSprite(TFT_eSprite &sprite, int leftEyeX, int rightEyeX, int eyeY, int ew, int eh, uint16_t bodyColor, bool isKiro = false) {
  drawHappyEyesT(sprite, leftEyeX, rightEyeX, eyeY, ew, eh, bodyColor, isKiro);
}

inline void drawSunglassesToSprite(TFT_eSprite &sprite, int leftEyeX, int rightEyeX, int eyeY, int ew, int eh, bool isKiro = false) {
  drawSunglassesT(sprite, leftEyeX, rightEyeX, eyeY, ew, eh, isKiro);
}

inline void drawSparkleToSprite(TFT_eSprite &sprite, int x, int y, uint16_t sparkleColor = COLOR_TEXT_WHITE) {
  drawSparkleT(sprite, x, y, sparkleColor);
}

inline void drawQuestionMarkToSprite(TFT_eSprite &sprite, int x, int y) {
  drawQuestionMarkT(sprite, x, y);
}

inline void drawZzzToSprite(TFT_eSprite &sprite, int x, int y, int frame, uint16_t color = COLOR_TEXT_WHITE) {
  drawZzzT(sprite, x, y, frame, color);
}

inline void drawThoughtBubbleToSprite(TFT_eSprite &sprite, int x, int y, int frame, uint16_t color = COLOR_TEXT_WHITE) {
  drawThoughtBubbleT(sprite, x, y, frame, color);
}

// Draw eyes to sprite based on eye type
// Draw eye type to sprite (normal, blink, happy, focused)
void drawEyeTypeToSprite(TFT_eSprite &sprite, EyeType eyeType, const CharacterGeometry* character = &CHAR_CLAWD) {
  int leftEyeX = character->eyeLeftX * SCALE;
  int rightEyeX = character->eyeRightX * SCALE;
  int eyeY = character->eyeY * SCALE;
  int ew = character->eyeW * SCALE;
  int eh = character->eyeH * SCALE;
  bool isKiro = (character == &CHAR_KIRO);

  switch (eyeType) {
    case EYE_FOCUSED:
      drawSunglassesT(sprite, leftEyeX, rightEyeX, eyeY, ew, eh, isKiro);
      break;
    case EYE_BLINK:
      drawSleepEyesT(sprite, leftEyeX, rightEyeX, eyeY, ew, eh, character->color, isKiro);
      break;
    case EYE_HAPPY:
      drawHappyEyesT(sprite, leftEyeX, rightEyeX, eyeY, ew, eh, character->color, isKiro);
      break;
    case EYE_NORMAL:
    default:
      // Normal eyes - already in character image
      break;
  }
}

// Draw effect to sprite (sparkle, thinking, alert, zzz)
void drawEffectTypeToSprite(TFT_eSprite &sprite, EffectType effectType, const CharacterGeometry* character = &CHAR_CLAWD) {
  bool isKiro = (character == &CHAR_KIRO);
  uint16_t effectColor = isKiro ? COLOR_EFFECT_ALT : COLOR_TEXT_WHITE;

  // Effect position (from character config)
  int effectX = character->effectX * SCALE;
  int effectY = character->effectY * SCALE;

  switch (effectType) {
    case EFFECT_SPARKLE:
      drawSparkleT(sprite, effectX, effectY + (2 * SCALE), effectColor);
      break;
    case EFFECT_THINKING:
      drawThoughtBubbleT(sprite, effectX, effectY, animFrame, effectColor);
      break;
    case EFFECT_ALERT:
      drawQuestionMarkT(sprite, effectX, effectY);
      break;
    case EFFECT_ZZZ:
      drawZzzT(sprite, effectX, effectY, animFrame, effectColor);
      break;
    case EFFECT_MATRIX:
      // Matrix rain - handled separately in drawCharacterToSprite
      break;
    case EFFECT_NONE:
    default:
      break;
  }
}

#endif // SPRITES_H
