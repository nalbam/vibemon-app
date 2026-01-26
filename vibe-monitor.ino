/*
 * Vibe Monitor
 * ESP32-C6-LCD-1.47 (172x320, ST7789V2)
 *
 * Pixel art character (128x128) with animated states
 * USB Serial + HTTP support
 */

#include <TFT_eSPI.h>
#include <ArduinoJson.h>
#include "sprites.h"

// WiFi (HTTP fallback, optional)
#ifdef USE_WIFI
#include <WiFi.h>
#include <WebServer.h>
const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";
WebServer server(80);
#endif

TFT_eSPI tft = TFT_eSPI();

// Screen size
#define SCREEN_WIDTH  172
#define SCREEN_HEIGHT 320

// Layout positions (adjusted for 128x128 character)
#define CHAR_X_BASE   22   // (172 - 128) / 2 = 22
#define CHAR_Y_BASE   20   // Base Y position
#define FLOAT_AMPLITUDE_X 3  // Floating animation amplitude X (pixels)
#define FLOAT_AMPLITUDE_Y 5  // Floating animation amplitude Y (pixels)
#define STATUS_TEXT_Y 160
#define LOADING_Y     190
#define PROJECT_Y     220
#define TOOL_Y        235
#define MODEL_Y       250
#define MEMORY_Y      265
#define MEMORY_BAR_X  10
#define MEMORY_BAR_Y  285
#define MEMORY_BAR_W  152
#define MEMORY_BAR_H  8
#define BRAND_Y       300

// State variables (char arrays instead of String for memory efficiency)
// Note: AppState enum is defined in sprites.h
AppState currentState = STATE_START;
AppState previousState = STATE_START;
char currentCharacter[16] = "clawd";  // "clawd" or "kiro"
char currentProject[32] = "";
char currentTool[32] = "";
char currentModel[32] = "";
char currentMemory[16] = "";
unsigned long lastUpdate = 0;
unsigned long lastBlink = 0;
int animFrame = 0;
bool needsRedraw = true;
int lastCharX = CHAR_X_BASE;  // Track last character X for efficient redraw
int lastCharY = CHAR_Y_BASE;  // Track last character Y for efficient redraw

// Dirty rect tracking for efficient redraws
bool dirtyCharacter = true;
bool dirtyStatus = true;
bool dirtyInfo = true;

// State timeouts
#define IDLE_TIMEOUT 60000            // 1 minute (start/done -> idle)
#define SLEEP_TIMEOUT 300000          // 5 minutes (idle -> sleep)
unsigned long lastActivityTime = 0;

// JSON buffer size for StaticJsonDocument
#define JSON_BUFFER_SIZE 256

// Helper: Parse state string to enum
AppState parseState(const char* stateStr) {
  if (strcmp(stateStr, "start") == 0) return STATE_START;
  if (strcmp(stateStr, "idle") == 0) return STATE_IDLE;
  if (strcmp(stateStr, "thinking") == 0) return STATE_THINKING;
  if (strcmp(stateStr, "working") == 0) return STATE_WORKING;
  if (strcmp(stateStr, "notification") == 0) return STATE_NOTIFICATION;
  if (strcmp(stateStr, "done") == 0) return STATE_DONE;
  if (strcmp(stateStr, "sleep") == 0) return STATE_SLEEP;
  return STATE_IDLE;  // default
}

void setup() {
  Serial.begin(115200);

  // TFT init
  tft.init();
  tft.setRotation(0);  // Portrait mode
  tft.fillScreen(TFT_BLACK);

  // Start screen
  drawStartScreen();

  // Initialize sleep timer
  lastActivityTime = millis();

#ifdef USE_WIFI
  setupWiFi();
#endif
}

// Serial input buffer (avoid String allocation)
char serialBuffer[512];
int serialBufferPos = 0;

void loop() {
  // USB Serial check (using char buffer instead of String)
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      serialBuffer[serialBufferPos] = '\0';
      if (serialBufferPos > 0) {
        processInput(serialBuffer);
      }
      serialBufferPos = 0;
    } else if (serialBufferPos < (int)sizeof(serialBuffer) - 1) {
      serialBuffer[serialBufferPos++] = c;
    }
  }

#ifdef USE_WIFI
  server.handleClient();
#endif

  // Animation update (100ms interval)
  if (millis() - lastUpdate > 100) {
    lastUpdate = millis();
    animFrame++;
    updateAnimation();
  }

  // Idle blink (every 3 seconds)
  if (currentState == STATE_IDLE && millis() - lastBlink > 3000) {
    lastBlink = millis();
    drawBlinkAnimation();
  }

  // Check sleep timer (only from start, idle or done)
  checkSleepTimer();
}

// Check state timeouts for auto-transitions
void checkSleepTimer() {
  unsigned long now = millis();

  // start/done -> idle after 1 minute
  if (currentState == STATE_START || currentState == STATE_DONE) {
    if (now - lastActivityTime >= IDLE_TIMEOUT) {
      previousState = currentState;
      currentState = STATE_IDLE;
      lastActivityTime = now;
      needsRedraw = true;
      dirtyCharacter = true;
      dirtyStatus = true;
      drawStatus();
      return;
    }
  }

  // idle -> sleep after 5 minutes
  if (currentState == STATE_IDLE) {
    if (now - lastActivityTime >= SLEEP_TIMEOUT) {
      previousState = currentState;
      currentState = STATE_SLEEP;
      needsRedraw = true;
      dirtyCharacter = true;
      dirtyStatus = true;
      drawStatus();
    }
  }
}

void processInput(const char* input) {
  StaticJsonDocument<JSON_BUFFER_SIZE> doc;
  DeserializationError error = deserializeJson(doc, input);

  if (error) {
    Serial.println("JSON parse error");
    return;
  }

  previousState = currentState;

  // Parse state
  const char* stateStr = doc["state"] | "";
  if (strlen(stateStr) > 0) {
    currentState = parseState(stateStr);
  }

  // Clear model and memory when project changes
  const char* newProject = doc["project"] | "";
  if (strlen(newProject) > 0 && strcmp(newProject, currentProject) != 0) {
    currentModel[0] = '\0';
    currentMemory[0] = '\0';
  }
  if (strlen(newProject) > 0) {
    strncpy(currentProject, newProject, sizeof(currentProject) - 1);
    currentProject[sizeof(currentProject) - 1] = '\0';
  }

  // Parse tool
  const char* toolStr = doc["tool"] | "";
  if (strlen(toolStr) > 0) {
    strncpy(currentTool, toolStr, sizeof(currentTool) - 1);
    currentTool[sizeof(currentTool) - 1] = '\0';
  }

  // Parse model
  const char* modelStr = doc["model"] | "";
  if (strlen(modelStr) > 0) {
    strncpy(currentModel, modelStr, sizeof(currentModel) - 1);
    currentModel[sizeof(currentModel) - 1] = '\0';
  }

  // Parse memory
  const char* memoryStr = doc["memory"] | "";
  if (strlen(memoryStr) > 0) {
    strncpy(currentMemory, memoryStr, sizeof(currentMemory) - 1);
    currentMemory[sizeof(currentMemory) - 1] = '\0';
  }

  // Parse character (use isValidCharacter() for dynamic validation)
  const char* charInput = doc["character"] | "";
  if (strlen(charInput) > 0 && isValidCharacter(charInput)) {
    strncpy(currentCharacter, charInput, sizeof(currentCharacter) - 1);
    currentCharacter[sizeof(currentCharacter) - 1] = '\0';
  }

  // Reset activity timer on any input
  lastActivityTime = millis();

  // Redraw if state changed
  if (currentState != previousState) {
    needsRedraw = true;
    dirtyCharacter = true;
    dirtyStatus = true;
    dirtyInfo = true;
    drawStatus();
  }
}

// Calculate floating X offset using cosine wave
int getFloatOffsetX() {
  // Use cosine wave for smooth horizontal floating (period ~3.2 seconds at 100ms intervals)
  float angle = (animFrame % 32) * (2.0 * PI / 32.0);
  return (int)(cos(angle) * FLOAT_AMPLITUDE_X);
}

// Calculate floating Y offset using sine wave
int getFloatOffsetY() {
  // Use sine wave for smooth vertical floating (period ~3.2 seconds at 100ms intervals)
  float angle = (animFrame % 32) * (2.0 * PI / 32.0);
  return (int)(sin(angle) * FLOAT_AMPLITUDE_Y);
}

void drawStartScreen() {
  uint16_t bgColor = TFT_BLACK;
  tft.fillScreen(bgColor);

  // Draw character in idle state (128x128)
  const CharacterGeometry* character = getCharacter(currentCharacter);
  drawCharacter(tft, CHAR_X_BASE, CHAR_Y_BASE, EYE_NORMAL, bgColor, character);

  // Title
  tft.setTextColor(COLOR_TEXT_WHITE);
  tft.setTextSize(2);
  tft.setCursor(20, STATUS_TEXT_Y);
  tft.println("Claude");

  tft.setTextSize(1);
  tft.setTextColor(COLOR_TEXT_DIM);
  tft.setCursor(30, STATUS_TEXT_Y + 30);
  tft.println("Monitor");

  tft.setCursor(30, PROJECT_Y);
  tft.println("Waiting for");
  tft.setCursor(30, PROJECT_Y + 15);
  tft.println("connection...");

  // Brand
  tft.setCursor(40, BRAND_Y);
  tft.println("v2.0 Pixel Art");
}

void drawStatus() {
  uint16_t bgColor = getBackgroundColorEnum(currentState);
  uint16_t textColor = getTextColorEnum(currentState);
  EyeType eyeType = getEyeTypeEnum(currentState);
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

  // Draw character (128x128)
  if (dirtyCharacter || needsRedraw) {
    drawCharacter(tft, charX, charY, eyeType, bgColor, character);
  }

  // Status text (color based on background)
  if (dirtyStatus || needsRedraw) {
    char statusText[32];
    getStatusTextEnum(currentState, currentTool, statusText, sizeof(statusText));

    tft.setTextColor(textColor);
    tft.setTextSize(3);
    int textWidth = strlen(statusText) * 18;
    int textX = (SCREEN_WIDTH - textWidth) / 2;
    tft.setCursor(textX, STATUS_TEXT_Y);
    tft.println(statusText);
  }

  // Loading dots (thinking and working states)
  if (currentState == STATE_THINKING) {
    drawLoadingDots(tft, SCREEN_WIDTH / 2, LOADING_Y, animFrame, true);  // Slow
  } else if (currentState == STATE_WORKING) {
    drawLoadingDots(tft, SCREEN_WIDTH / 2, LOADING_Y, animFrame, false);  // Normal
  }

  // Project name
  if (dirtyInfo || needsRedraw) {
    if (strlen(currentProject) > 0) {
      tft.setTextColor(textColor);
      tft.setTextSize(1);
      drawFolderIcon(tft, 10, PROJECT_Y, textColor);
      tft.setCursor(20, PROJECT_Y);

      char displayProject[20];
      if (strlen(currentProject) > 16) {
        strncpy(displayProject, currentProject, 13);
        displayProject[13] = '\0';
        strcat(displayProject, "...");
      } else {
        strcpy(displayProject, currentProject);
      }
      tft.println(displayProject);
    }

    // Tool name (working state only)
    if (strlen(currentTool) > 0 && currentState == STATE_WORKING) {
      tft.setTextColor(textColor);
      tft.setTextSize(1);
      drawToolIcon(tft, 10, TOOL_Y, textColor);
      tft.setCursor(20, TOOL_Y);
      tft.println(currentTool);
    }

    // Model name
    if (strlen(currentModel) > 0) {
      tft.setTextColor(textColor);
      tft.setTextSize(1);
      drawRobotIcon(tft, 10, MODEL_Y, textColor);
      tft.setCursor(20, MODEL_Y);

      char displayModel[20];
      if (strlen(currentModel) > 14) {
        strncpy(displayModel, currentModel, 11);
        displayModel[11] = '\0';
        strcat(displayModel, "...");
      } else {
        strcpy(displayModel, currentModel);
      }
      tft.println(displayModel);
    }

    // Memory usage (hide on start state)
    if (strlen(currentMemory) > 0 && currentState != STATE_START) {
      tft.setTextColor(textColor);
      tft.setTextSize(1);
      drawBrainIcon(tft, 10, MEMORY_Y, textColor);
      tft.setCursor(20, MEMORY_Y);
      tft.println(currentMemory);

      // Memory bar (below percentage)
      int memoryPercent = atoi(currentMemory);
      drawMemoryBar(tft, MEMORY_BAR_X, MEMORY_BAR_Y, MEMORY_BAR_W, MEMORY_BAR_H, memoryPercent, bgColor);
    }
  }

  needsRedraw = false;
  dirtyCharacter = false;
  dirtyStatus = false;
  dirtyInfo = false;
}

void updateAnimation() {
  uint16_t bgColor = getBackgroundColorEnum(currentState);
  EyeType eyeType = getEyeTypeEnum(currentState);
  const CharacterGeometry* character = getCharacterByName(currentCharacter);

  // Calculate new floating position
  int newCharX = CHAR_X_BASE + getFloatOffsetX();
  int newCharY = CHAR_Y_BASE + getFloatOffsetY();

  // Only redraw character if position changed (dirty rect optimization)
  bool positionChanged = (newCharX != lastCharX || newCharY != lastCharY);
  if (positionChanged) {
    // Clear previous character area
    tft.fillRect(lastCharX, lastCharY, CHAR_WIDTH, CHAR_HEIGHT, bgColor);
    // Draw character at new position
    drawCharacter(tft, newCharX, newCharY, eyeType, bgColor, character);
    lastCharX = newCharX;
    lastCharY = newCharY;
  }

  // State-specific animations (only redraw if needed)
  if (currentState == STATE_THINKING) {
    // Update loading dots (slow) and thinking animation
    drawLoadingDots(tft, SCREEN_WIDTH / 2, LOADING_Y, animFrame, true);
    if (!positionChanged) {
      // Only redraw character for animation if position didn't change
      drawCharacter(tft, newCharX, newCharY, EYE_THINKING, bgColor, character);
    }
  } else if (currentState == STATE_WORKING) {
    // Update loading dots and matrix effect
    drawLoadingDots(tft, SCREEN_WIDTH / 2, LOADING_Y, animFrame, false);
    if (!positionChanged) {
      drawCharacter(tft, newCharX, newCharY, EYE_FOCUSED, bgColor, character);
    }
  } else if (currentState == STATE_START) {
    // Update sparkle animation (redraw for sparkle effect)
    if (!positionChanged) {
      drawCharacter(tft, newCharX, newCharY, EYE_SPARKLE, bgColor, character);
    }
  } else if (currentState == STATE_SLEEP) {
    // Update Zzz animation (redraw for blink effect)
    if (!positionChanged) {
      drawCharacter(tft, newCharX, newCharY, EYE_SLEEP, bgColor, character);
    }
  }
}

void drawBlinkAnimation() {
  if (currentState != STATE_IDLE) return;

  uint16_t bgColor = getBackgroundColorEnum(currentState);
  const CharacterGeometry* character = getCharacterByName(currentCharacter);
  int charX = lastCharX;  // Use current floating position
  int charY = lastCharY;

  // Close eyes (redraw body area with closed eyes)
  tft.fillRect(charX + (character->bodyX * SCALE), charY + (character->bodyY * SCALE),
               character->bodyW * SCALE, 30 * SCALE, character->color);
  drawBlinkEyes(tft, charX, charY, 0, character);  // Closed

  delay(100);

  // Open eyes
  tft.fillRect(charX + (character->bodyX * SCALE), charY + (character->bodyY * SCALE),
               character->bodyW * SCALE, 30 * SCALE, character->color);
  drawBlinkEyes(tft, charX, charY, 1, character);  // Open
}

#ifdef USE_WIFI
void setupWiFi() {
  WiFi.begin(ssid, password);

  tft.setCursor(10, BRAND_Y - 30);
  tft.setTextColor(COLOR_TEXT_DIM);
  tft.setTextSize(1);
  tft.print("WiFi: ");

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    tft.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    tft.println("OK");
    tft.setCursor(10, BRAND_Y - 15);
    tft.print("IP: ");
    tft.println(WiFi.localIP());

    // HTTP server setup
    server.on("/status", HTTP_POST, handleStatus);
    server.begin();
  } else {
    tft.println("Failed");
  }
}

void handleStatus() {
  if (server.hasArg("plain")) {
    String body = server.arg("plain");
    processInput(body.c_str());
    server.send(200, "application/json", "{\"ok\":true}");
  } else {
    server.send(400, "application/json", "{\"error\":\"no body\"}");
  }
}
#endif
