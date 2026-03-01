/*
 * VibeMon Display
 * Graphics rendering, animation, and screen update functions
 */

#ifndef DISPLAY_H
#define DISPLAY_H

// =============================================================================
// Floating Animation
// =============================================================================

// Precomputed lookup tables for floating animation (10-20x faster than sin/cos)
// Values: cos(i * 2π/32) * 3 and sin(i * 2π/32) * 5, rounded to nearest integer
const int8_t FLOAT_TABLE_X[ANIM_FLOAT_TABLE_SIZE] = {3, 3, 3, 2, 2, 2, 1, 1, 0, -1, -1, -2, -2, -2, -3, -3, -3, -3, -3, -2, -2, -2, -1, -1, 0, 1, 1, 2, 2, 2, 3, 3};
const int8_t FLOAT_TABLE_Y[ANIM_FLOAT_TABLE_SIZE] = {0, 1, 2, 3, 4, 4, 5, 5, 5, 5, 5, 4, 4, 3, 2, 1, 0, -1, -2, -3, -4, -4, -5, -5, -5, -5, -5, -4, -4, -3, -2, -1};

// Calculate floating X offset using lookup table
int getFloatOffsetX() {
  return FLOAT_TABLE_X[animFrame % ANIM_FLOAT_TABLE_SIZE];
}

// Calculate floating Y offset using lookup table
int getFloatOffsetY() {
  return FLOAT_TABLE_Y[animFrame % ANIM_FLOAT_TABLE_SIZE];
}

// =============================================================================
// Connection Indicator
// =============================================================================

// Draw server connection indicator (green dot at top center)
void drawConnectionIndicator() {
#ifdef USE_WIFI
  uint16_t bgColor = getBackgroundColorEnum(currentState);
  bool connected = false;
#ifdef USE_WEBSOCKET
  connected = wsConnected;
#else
  connected = (WiFi.status() == WL_CONNECTED);
#endif
  int cx = SCREEN_WIDTH / 2;
  int cy = 5;
  int r = 3;
  if (!connected) {
    tft.fillCircle(cx, cy, r, TFT_RED);  // Red when disconnected
  } else {
    tft.fillCircle(cx, cy, r, bgColor);  // Clear when connected
  }
#endif
}

// =============================================================================
// Start Screen
// =============================================================================

void drawStartScreen() {
  uint16_t bgColor = TFT_BLACK;
  tft.fillScreen(bgColor);

  // Set random character for start screen (esp_random: hardware RNG)
  const CharacterGeometry* character = ALL_CHARACTERS[esp_random() % CHARACTER_COUNT];
  safeCopyStr(currentCharacter, character->name);

  // Draw character slightly higher for better balance
  int startCharY = 15;
  if (spriteInitialized) {
    drawCharacterToSprite(charSprite, EYE_NORMAL, EFFECT_NONE, bgColor, character);
    charSprite.pushSprite(CHAR_X_BASE, startCharY);
  } else {
    drawCharacter(tft, CHAR_X_BASE, startCharY, EYE_NORMAL, EFFECT_NONE, bgColor, character);
  }

  // Title (centered, below character with reasonable gap)
  int titleY = startCharY + 128 + 15;  // Character height (128) + 15px gap
  tft.setTextColor(COLOR_TEXT_WHITE);
  tft.setTextSize(2);
  int titleX = (SCREEN_WIDTH - 7 * 12) / 2;  // "VibeMon" = 7 chars * 12px (size 2)
  tft.setCursor(titleX, titleY);
  tft.println("VibeMon");

  // "Waiting..." below title with moderate gap
  int waitY = titleY + 16 + 25;  // Title height (16) + 25px gap
  tft.setTextSize(1);
  tft.setTextColor(COLOR_TEXT_DIM);
  int waitX = (SCREEN_WIDTH - 10 * 6) / 2;  // "Waiting..." = 10 chars * 6px (size 1)
  tft.setCursor(waitX, waitY);
  tft.println("Waiting...");

  // Brand (centered at bottom)
  tft.setTextSize(1);
  int verX = (SCREEN_WIDTH - strlen(VERSION) * 6) / 2;
  tft.setCursor(verX, BRAND_Y);
  tft.println(VERSION);

  // Connection indicator
  drawConnectionIndicator();
}

// =============================================================================
// Text & Info Row Helpers
// =============================================================================

// Helper: Truncate text to maxLen chars, appending "..." if too long
void truncateText(const char* src, char* dst, size_t dstSize, int maxLen, int truncLen) {
  if ((int)strlen(src) > maxLen) {
    strncpy(dst, src, truncLen);
    dst[truncLen] = '\0';
    strncat(dst, "...", dstSize - strlen(dst) - 1);
  } else {
    strncpy(dst, src, dstSize - 1);
    dst[dstSize - 1] = '\0';
  }
}

// Helper: Draw icon + truncated text as a single info row
// FreeSans9pt7b ~14px height; icon scale=1 (10px), centered at y+2; text at x=24
void drawInfoRow(int y, void (*iconFn)(TFT_eSPI&, int, int, uint16_t, int, uint16_t), const char* text, uint16_t textColor, uint16_t bgColor) {
  tft.setTextColor(textColor);
  tft.setFont(&fonts::FreeSans9pt7b);
  tft.setTextSize(1);
  iconFn(tft, 10, y + 2, textColor, 1, bgColor);
  tft.setCursor(24, y);
  char display[20];
  truncateText(text, display, sizeof(display), 15, 12);
  tft.print(display);
  tft.setFont(nullptr);
}

// =============================================================================
// Main Status Drawing
// =============================================================================

void drawStatus() {
  uint16_t bgColor = getBackgroundColorEnum(currentState);
  uint16_t textColor = getTextColorEnum(currentState);
  EyeType eyeType = getEyeTypeEnum(currentState);
  EffectType effectType = getEffectTypeEnum(currentState);
  const CharacterGeometry* character = getCharacterByName(currentCharacter);

  // Fill background (only if dirty)
  if (needsRedraw) {
    tft.fillScreen(bgColor);
  }

  // Calculate floating position
  int charX = CHAR_X_BASE + getFloatOffsetX();
  int charY = CHAR_Y_BASE + getFloatOffsetY();
  lastCharX = charX;
  lastCharY = charY;

  // Draw character using sprite buffer (no flickering)
  if (dirtyCharacter || needsRedraw) {
    if (spriteInitialized) {
      drawCharacterToSprite(charSprite, eyeType, effectType, bgColor, character);
      charSprite.pushSprite(charX, charY);
    } else {
      // Fallback to direct drawing
      drawCharacter(tft, charX, charY, eyeType, effectType, bgColor, character);
    }
  }

  // Status text (color based on background)
  if (dirtyStatus || needsRedraw) {
    // Clear status text region when only status changed (not full redraw)
    // This prevents text overlap/ghosting
    if (dirtyStatus && !needsRedraw) {
      tft.fillRect(0, STATUS_TEXT_Y, SCREEN_WIDTH, LOADING_Y - STATUS_TEXT_Y, bgColor);
    }

    char statusText[32];
    if (currentState == STATE_WORKING) {
      getWorkingText(currentTool, statusText, sizeof(statusText));
    } else {
      getStatusTextEnum(currentState, statusText, sizeof(statusText));
    }

    tft.setTextColor(textColor);
    tft.setTextSize(3);
    int textX = (SCREEN_WIDTH - tft.textWidth(statusText)) / 2;
    tft.setCursor(textX, STATUS_TEXT_Y);
    tft.println(statusText);
  }

  // Loading dots (thinking, planning, packing and working states)
  if (isLoadingState(currentState)) {
    drawLoadingDots(tft, SCREEN_WIDTH / 2, LOADING_Y, animFrame, true);  // Slow
  } else if (currentState == STATE_WORKING) {
    drawLoadingDots(tft, SCREEN_WIDTH / 2, LOADING_Y, animFrame, false);  // Normal
  }

  // Project name, tool, model, memory info
  if (dirtyInfo || needsRedraw) {
    // Clear info region when only info changed (not full redraw)
    // This prevents text overlap/ghosting
    if (dirtyInfo && !needsRedraw) {
      tft.fillRect(0, PROJECT_Y, SCREEN_WIDTH, SCREEN_HEIGHT - PROJECT_Y, bgColor);
    }

    if (strlen(currentProject) > 0) {
      drawInfoRow(PROJECT_Y, drawFolderIcon, currentProject, textColor, bgColor);
    }

    // Tool name (working state only)
    if (strlen(currentTool) > 0 && currentState == STATE_WORKING) {
      drawInfoRow(TOOL_Y, drawToolIcon, currentTool, textColor, bgColor);
    }

    // Model name
    if (strlen(currentModel) > 0) {
      drawInfoRow(MODEL_Y, drawRobotIcon, currentModel, textColor, bgColor);
    }

    // Memory usage (hide on start state)
    if (currentMemory > 0 && currentState != STATE_START) {
      tft.setTextColor(textColor);
      tft.setFont(&fonts::FreeSans9pt7b);
      tft.setTextSize(1);
      drawBrainIcon(tft, 10, MEMORY_Y + 2, textColor, 1, bgColor);
      tft.setCursor(24, MEMORY_Y);
      tft.print(currentMemory);
      tft.print("%");
      tft.setFont(nullptr);

      // Memory bar (below percentage)
      drawMemoryBar(tft, MEMORY_BAR_X, MEMORY_BAR_Y, MEMORY_BAR_W, MEMORY_BAR_H, currentMemory, bgColor);
    }
  }

  // Connection indicator
  drawConnectionIndicator();

  needsRedraw = false;
  dirtyCharacter = false;
  dirtyStatus = false;
  dirtyInfo = false;
}

// =============================================================================
// Animation Update
// =============================================================================

// Clear only the non-overlapping edges when position changes (no flickering)
void clearPreviousEdges(int oldX, int oldY, int newX, int newY, int w, int h, uint16_t bgColor) {
  int dx = newX - oldX;
  int dy = newY - oldY;

  // Clear left or right edge
  if (dx > 0) {
    // Moved right: clear left edge of old position
    tft.fillRect(oldX, oldY, dx, h, bgColor);
  } else if (dx < 0) {
    // Moved left: clear right edge of old position
    tft.fillRect(oldX + w + dx, oldY, -dx, h, bgColor);
  }

  // Clear top or bottom edge
  if (dy > 0) {
    // Moved down: clear top edge of old position
    tft.fillRect(oldX, oldY, w, dy, bgColor);
  } else if (dy < 0) {
    // Moved up: clear bottom edge of old position
    tft.fillRect(oldX, oldY + h + dy, w, -dy, bgColor);
  }
}

void updateAnimation() {
  uint16_t bgColor = getBackgroundColorEnum(currentState);
  EyeType eyeType = getEyeTypeEnum(currentState);
  EffectType effectType = getEffectTypeEnum(currentState);
  const CharacterGeometry* character = getCharacterByName(currentCharacter);

  // Calculate new floating position
  int newCharX = CHAR_X_BASE + getFloatOffsetX();
  int newCharY = CHAR_Y_BASE + getFloatOffsetY();

  // Check if position changed
  bool positionChanged = (newCharX != lastCharX || newCharY != lastCharY);

  // Determine if we need to redraw character based on state and animation frame
  bool needsCharRedraw = positionChanged;
  if (!needsCharRedraw) {
    if (isLoadingState(currentState)) {
      needsCharRedraw = (animFrame % ANIM_THOUGHT_PERIOD == 0);
    } else if (currentState == STATE_START || currentState == STATE_WORKING) {
      needsCharRedraw = (animFrame % ANIM_SPARKLE_PERIOD == 0);
    } else if (currentState == STATE_SLEEP) {
      needsCharRedraw = (animFrame % ANIM_ZZZ_PERIOD == 0);
    }
  }

  // Redraw character using sprite buffer (no flickering)
  if (needsCharRedraw) {
    if (spriteInitialized) {
      // Clear only non-overlapping edges (prevents flickering)
      if (positionChanged) {
        clearPreviousEdges(lastCharX, lastCharY, newCharX, newCharY, CHAR_WIDTH, CHAR_HEIGHT, bgColor);
      }
      // Draw to sprite and push to screen in one operation
      drawCharacterToSprite(charSprite, eyeType, effectType, bgColor, character);
      charSprite.pushSprite(newCharX, newCharY);
    } else {
      // Fallback to direct drawing
      if (positionChanged) {
        clearPreviousEdges(lastCharX, lastCharY, newCharX, newCharY, CHAR_WIDTH, CHAR_HEIGHT, bgColor);
      }
      drawCharacter(tft, newCharX, newCharY, eyeType, effectType, bgColor, character);
    }
    lastCharX = newCharX;
    lastCharY = newCharY;
  }

  // Update loading dots for thinking/planning/packing/working states
  if (isLoadingState(currentState)) {
    drawLoadingDots(tft, SCREEN_WIDTH / 2, LOADING_Y, animFrame, true);  // Slow
  } else if (currentState == STATE_WORKING) {
    drawLoadingDots(tft, SCREEN_WIDTH / 2, LOADING_Y, animFrame, false);  // Fast
  }
}

// =============================================================================
// Blink Animation
// =============================================================================

// Non-blocking blink animation using state machine
void updateBlink() {
  // Only blink in idle state
  if (currentState != STATE_IDLE) {
    blinkPhase = BLINK_NONE;
    return;
  }

  unsigned long now = millis();
  uint16_t bgColor = getBackgroundColorEnum(currentState);
  const CharacterGeometry* character = getCharacterByName(currentCharacter);
  int charX = lastCharX;
  int charY = lastCharY;

  switch (blinkPhase) {
    case BLINK_NONE:
      // Check if it's time to blink
      if (now - lastBlink > BLINK_INTERVAL) {
        // Start blink: draw closed eyes
        if (spriteInitialized) {
          drawCharacterToSprite(charSprite, EYE_BLINK, EFFECT_NONE, bgColor, character);
          charSprite.pushSprite(charX, charY);
        } else {
          drawCharacter(tft, charX, charY, EYE_BLINK, EFFECT_NONE, bgColor, character);
        }
        blinkPhase = BLINK_CLOSED;
        blinkPhaseStart = now;
      }
      break;

    case BLINK_CLOSED:
      // Check if blink duration has elapsed
      if (now - blinkPhaseStart >= BLINK_DURATION) {
        // End blink: draw open eyes
        if (spriteInitialized) {
          drawCharacterToSprite(charSprite, EYE_NORMAL, EFFECT_NONE, bgColor, character);
          charSprite.pushSprite(charX, charY);
        } else {
          drawCharacter(tft, charX, charY, EYE_NORMAL, EFFECT_NONE, bgColor, character);
        }
        blinkPhase = BLINK_NONE;
        lastBlink = now;
      }
      break;
  }
}

#endif // DISPLAY_H
