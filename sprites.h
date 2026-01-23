/*
 * Claude Code Character Sprites
 * 128x128 pixel art for ESP32-C6-LCD-1.47
 * (Doubled from 64x64 original design)
 */

#ifndef SPRITES_H
#define SPRITES_H

#include <Arduino.h>

// Character colors (RGB565)
#define COLOR_CLAUDE      0xEB66  // #E07B39 Claude orange
#define COLOR_EYE         0x0000  // #000000 Black
#define COLOR_TRANSPARENT 0x0000  // Transparent (same as background)

// Background colors by state (RGB565)
#define COLOR_BG_IDLE     0x0540  // #00AA00 Green
#define COLOR_BG_WORKING  0x0339  // #0066CC Blue
#define COLOR_BG_NOTIFY   0xFE60  // #FFCC00 Yellow
#define COLOR_BG_SESSION  0x0666  // #00CCCC Cyan
#define COLOR_BG_DONE     0x0540  // #00AA00 Green

// Text colors
#define COLOR_TEXT_WHITE  0xFFFF
#define COLOR_TEXT_DIM    0x7BEF

// Character dimensions (128x128, doubled from 64x64)
#define CHAR_WIDTH  128
#define CHAR_HEIGHT 128
#define SCALE       2    // Scale factor from original design

// Eye types
enum EyeType {
  EYE_NORMAL,      // idle: square eyes
  EYE_FOCUSED,     // working: horizontal flat eyes
  EYE_ALERT,       // notification: round eyes
  EYE_SPARKLE,     // session_start: normal + sparkle
  EYE_HAPPY        // done: curved happy eyes
};

// Animation frame counter
extern int animFrame;

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
void drawCharacter(TFT_eSPI &tft, int x, int y, EyeType eyeType, uint16_t bgColor) {
  // Clear background area
  tft.fillRect(x, y, CHAR_WIDTH, CHAR_HEIGHT, bgColor);

  // All coordinates are scaled 2x from original 64x64 design
  // Main body (wider: 52x36)
  int bodyX = x + (6 * SCALE);
  int bodyY = y + (8 * SCALE);
  int bodyW = 52 * SCALE;
  int bodyH = 36 * SCALE;
  tft.fillRect(bodyX, bodyY, bodyW, bodyH, COLOR_CLAUDE);

  // Draw arms (attached to body: 6x10)
  int armY = y + (22 * SCALE);
  int armH = 10 * SCALE;
  int armW = 6 * SCALE;
  // Left arm (ends at 6, body starts at 6)
  tft.fillRect(x, armY, armW, armH, COLOR_CLAUDE);
  // Right arm (starts at 58, body ends at 58)
  tft.fillRect(x + (58 * SCALE), armY, armW, armH, COLOR_CLAUDE);

  // Draw legs (4 legs: shorter, thinner, wider gap between pairs)
  int legY = y + (44 * SCALE);
  int legH = 12 * SCALE;
  int legW = 6 * SCALE;
  // Left pair
  tft.fillRect(x + (10 * SCALE), legY, legW, legH, COLOR_CLAUDE);
  tft.fillRect(x + (18 * SCALE), legY, legW, legH, COLOR_CLAUDE);
  // Right pair (wider gap from left pair)
  tft.fillRect(x + (40 * SCALE), legY, legW, legH, COLOR_CLAUDE);
  tft.fillRect(x + (48 * SCALE), legY, legW, legH, COLOR_CLAUDE);

  // Draw eyes based on type
  drawEyes(tft, x, y, eyeType);
}

// Draw eyes based on eye type (scaled 2x)
void drawEyes(TFT_eSPI &tft, int x, int y, EyeType eyeType) {
  // Eye base positions (scaled 2x)
  int leftEyeX = x + (14 * SCALE);
  int rightEyeX = x + (44 * SCALE);
  int eyeY = y + (22 * SCALE);

  switch (eyeType) {
    case EYE_NORMAL:
      // Square eyes (6x6 -> 12x12)
      tft.fillRect(leftEyeX, eyeY, 6 * SCALE, 6 * SCALE, COLOR_EYE);
      tft.fillRect(rightEyeX, eyeY, 6 * SCALE, 6 * SCALE, COLOR_EYE);
      break;

    case EYE_FOCUSED:
      // Horizontal flat eyes (6x3 -> 12x6)
      tft.fillRect(leftEyeX, eyeY + (2 * SCALE), 6 * SCALE, 3 * SCALE, COLOR_EYE);
      tft.fillRect(rightEyeX, eyeY + (2 * SCALE), 6 * SCALE, 3 * SCALE, COLOR_EYE);
      break;

    case EYE_ALERT:
      // Round eyes (6x6 with rounded corners simulation, scaled)
      tft.fillRect(leftEyeX + (1 * SCALE), eyeY, 4 * SCALE, 6 * SCALE, COLOR_EYE);
      tft.fillRect(leftEyeX, eyeY + (1 * SCALE), 6 * SCALE, 4 * SCALE, COLOR_EYE);
      tft.fillRect(rightEyeX + (1 * SCALE), eyeY, 4 * SCALE, 6 * SCALE, COLOR_EYE);
      tft.fillRect(rightEyeX, eyeY + (1 * SCALE), 6 * SCALE, 4 * SCALE, COLOR_EYE);
      break;

    case EYE_SPARKLE:
      // Normal eyes + sparkle
      tft.fillRect(leftEyeX, eyeY, 6 * SCALE, 6 * SCALE, COLOR_EYE);
      tft.fillRect(rightEyeX, eyeY, 6 * SCALE, 6 * SCALE, COLOR_EYE);
      // Sparkle (animated position)
      drawSparkle(tft, x + (50 * SCALE), y + (8 * SCALE));
      break;

    case EYE_HAPPY:
      // Curved happy eyes (arch shape, scaled)
      // Left eye - upward curve
      tft.fillRect(leftEyeX, eyeY + (4 * SCALE), 6 * SCALE, 2 * SCALE, COLOR_EYE);
      tft.fillRect(leftEyeX, eyeY + (2 * SCALE), 2 * SCALE, 2 * SCALE, COLOR_EYE);
      tft.fillRect(leftEyeX + (4 * SCALE), eyeY + (2 * SCALE), 2 * SCALE, 2 * SCALE, COLOR_EYE);
      // Right eye - upward curve
      tft.fillRect(rightEyeX, eyeY + (4 * SCALE), 6 * SCALE, 2 * SCALE, COLOR_EYE);
      tft.fillRect(rightEyeX, eyeY + (2 * SCALE), 2 * SCALE, 2 * SCALE, COLOR_EYE);
      tft.fillRect(rightEyeX + (4 * SCALE), eyeY + (2 * SCALE), 2 * SCALE, 2 * SCALE, COLOR_EYE);
      break;
  }
}

// Draw sparkle effect (scaled 2x)
void drawSparkle(TFT_eSPI &tft, int x, int y) {
  uint16_t sparkleColor = COLOR_TEXT_WHITE;

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

// Draw blink animation (for idle state)
void drawBlinkEyes(TFT_eSPI &tft, int x, int y, int frame) {
  int leftEyeX = x + (14 * SCALE);
  int rightEyeX = x + (44 * SCALE);
  int eyeY = y + (22 * SCALE);

  if (frame == 0) {
    // Eyes closed (thin line, 6x2 -> 12x4)
    tft.fillRect(leftEyeX, eyeY + (2 * SCALE), 6 * SCALE, 2 * SCALE, COLOR_EYE);
    tft.fillRect(rightEyeX, eyeY + (2 * SCALE), 6 * SCALE, 2 * SCALE, COLOR_EYE);
  } else {
    // Eyes open (normal, 6x6 -> 12x12)
    tft.fillRect(leftEyeX, eyeY, 6 * SCALE, 6 * SCALE, COLOR_EYE);
    tft.fillRect(rightEyeX, eyeY, 6 * SCALE, 6 * SCALE, COLOR_EYE);
  }
}

// Get background color for state
uint16_t getBackgroundColor(String state) {
  if (state == "idle") return COLOR_BG_IDLE;
  if (state == "working") return COLOR_BG_WORKING;
  if (state == "notification") return COLOR_BG_NOTIFY;
  if (state == "session_start") return COLOR_BG_SESSION;
  if (state == "tool_done") return COLOR_BG_DONE;
  return COLOR_BG_IDLE;  // default
}

// Get eye type for state
EyeType getEyeType(String state) {
  if (state == "idle") return EYE_NORMAL;
  if (state == "working") return EYE_FOCUSED;
  if (state == "notification") return EYE_ALERT;
  if (state == "session_start") return EYE_SPARKLE;
  if (state == "tool_done") return EYE_HAPPY;
  return EYE_NORMAL;  // default
}

// Get status text for state
String getStatusText(String state) {
  if (state == "idle") return "Ready";
  if (state == "working") return "Working";
  if (state == "notification") return "Input?";
  if (state == "session_start") return "Hello!";
  if (state == "tool_done") return "Done!";
  return state;
}

// Get text color for state (dark text on bright backgrounds)
uint16_t getTextColor(String state) {
  if (state == "notification") return TFT_BLACK;   // Dark on yellow
  if (state == "session_start") return TFT_BLACK;  // Dark on cyan
  return COLOR_TEXT_WHITE;  // White on dark backgrounds
}

#endif // SPRITES_H
