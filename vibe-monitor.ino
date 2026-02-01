/*
 * Vibe Monitor
 * ESP32-C6-LCD-1.47 (172x320, ST7789V2)
 *
 * Pixel art character (128x128) with animated states
 * USB Serial + HTTP support
 */

// Use LovyanGFX instead of TFT_eSPI for ESP32-C6 compatibility
#include "TFT_Compat.h"
#include <ArduinoJson.h>
#include <Preferences.h>
#include "sprites.h"

// Persistent storage for settings
Preferences preferences;

// WiFi configuration (create credentials.h from credentials.h.example)
#if __has_include("credentials.h")
#include "credentials.h"
#endif

// WiFi (HTTP fallback, optional)
#ifdef USE_WIFI
#include <WiFi.h>
#include <WebServer.h>
const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;
WebServer server(80);

// WebSocket client (optional, requires USE_WIFI)
#ifdef USE_WEBSOCKET
#include <WebSocketsClient.h>
WebSocketsClient webSocket;
bool wsConnected = false;
unsigned long lastWsReconnect = 0;
const unsigned long WS_RECONNECT_INTERVAL = 5000;  // 5 seconds
#endif
#endif

// tft instance is defined in TFT_Compat.h

// Sprite buffer for double buffering (prevents flickering)
TFT_eSprite charSprite(&tft);
bool spriteInitialized = false;

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
#define PROJECT_Y     224
#define TOOL_Y        240
#define MODEL_Y       256
#define MEMORY_Y      272
#define MEMORY_BAR_X  10
#define MEMORY_BAR_Y  288
#define MEMORY_BAR_W  152
#define MEMORY_BAR_H  8
#define BRAND_Y       300

// State variables (char arrays instead of String for memory efficiency)
// Note: AppState enum is defined in sprites.h
AppState currentState = STATE_START;
AppState previousState = STATE_START;

// Blink animation state machine (non-blocking)
enum BlinkPhase { BLINK_NONE, BLINK_CLOSED };
BlinkPhase blinkPhase = BLINK_NONE;
unsigned long blinkPhaseStart = 0;
char currentCharacter[16] = "clawd";  // "clawd", "kiro", or "claw"
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

// Project lock feature
#define MAX_PROJECTS 10
char projectList[MAX_PROJECTS][32];  // List of incoming projects
int projectCount = 0;
char lockedProject[32] = "";  // Locked project name (empty = unlocked)

// Lock mode: 0 = first-project, 1 = on-thinking
#define LOCK_MODE_FIRST_PROJECT 0
#define LOCK_MODE_ON_THINKING 1
int lockMode = LOCK_MODE_ON_THINKING;  // Default: on-thinking

// Dirty rect tracking for efficient redraws
bool dirtyCharacter = true;
bool dirtyStatus = true;
bool dirtyInfo = true;

// State timeouts
#define IDLE_TIMEOUT 60000            // 1 minute (start/done -> idle)
#define SLEEP_TIMEOUT 300000          // 5 minutes (idle -> sleep)
unsigned long lastActivityTime = 0;

// JSON buffer size for StaticJsonDocument
// Increased from 256 to 512 for complex payloads with all fields
#define JSON_BUFFER_SIZE 512

// Helper: Parse state string to enum
AppState parseState(const char* stateStr) {
  if (strcmp(stateStr, "start") == 0) return STATE_START;
  if (strcmp(stateStr, "idle") == 0) return STATE_IDLE;
  if (strcmp(stateStr, "thinking") == 0) return STATE_THINKING;
  if (strcmp(stateStr, "planning") == 0) return STATE_PLANNING;
  if (strcmp(stateStr, "working") == 0) return STATE_WORKING;
  if (strcmp(stateStr, "packing") == 0) return STATE_PACKING;
  if (strcmp(stateStr, "notification") == 0) return STATE_NOTIFICATION;
  if (strcmp(stateStr, "done") == 0) return STATE_DONE;
  if (strcmp(stateStr, "sleep") == 0) return STATE_SLEEP;
  return STATE_IDLE;  // default
}

// Project lock helper: Check if project exists in list
bool projectExists(const char* project) {
  for (int i = 0; i < projectCount; i++) {
    if (strcmp(projectList[i], project) == 0) {
      return true;
    }
  }
  return false;
}

// Project lock helper: Add project to list (if not exists, max 10)
void addProjectToList(const char* project) {
  if (strlen(project) == 0) return;
  if (projectExists(project)) return;
  if (projectCount >= MAX_PROJECTS) {
    // Remove oldest project (shift array)
    for (int i = 0; i < MAX_PROJECTS - 1; i++) {
      strcpy(projectList[i], projectList[i + 1]);
    }
    projectCount = MAX_PROJECTS - 1;
  }
  strncpy(projectList[projectCount], project, sizeof(projectList[0]) - 1);
  projectList[projectCount][sizeof(projectList[0]) - 1] = '\0';
  projectCount++;
}

// Project lock helper: Lock to a specific project
void lockProject(const char* project) {
  if (strlen(project) > 0) {
    bool changed = (strcmp(lockedProject, project) != 0);
    addProjectToList(project);
    strncpy(lockedProject, project, sizeof(lockedProject) - 1);
    lockedProject[sizeof(lockedProject) - 1] = '\0';

    // Transition to idle state when lock changes
    if (changed) {
      previousState = currentState;
      currentState = STATE_IDLE;
      strncpy(currentProject, project, sizeof(currentProject) - 1);
      currentProject[sizeof(currentProject) - 1] = '\0';
      currentTool[0] = '\0';
      currentModel[0] = '\0';
      currentMemory[0] = '\0';
      lastActivityTime = millis();
      needsRedraw = true;
      dirtyCharacter = true;
      dirtyStatus = true;
      dirtyInfo = true;
      drawStatus();
    }

    Serial.print("{\"locked\":\"");
    Serial.print(lockedProject);
    Serial.println("\",\"state\":\"idle\"}");
  }
}

// Project lock helper: Unlock project
void unlockProject() {
  lockedProject[0] = '\0';
  Serial.println("{\"locked\":null}");
}

// Project lock helper: Set lock mode
void setLockMode(int mode) {
  if (mode == LOCK_MODE_FIRST_PROJECT || mode == LOCK_MODE_ON_THINKING) {
    lockMode = mode;
    lockedProject[0] = '\0';  // Reset lock when mode changes

    // Persist to flash storage
    preferences.begin("vibe-monitor", false);  // Read-write mode
    preferences.putInt("lockMode", lockMode);
    preferences.end();

    Serial.print("{\"lockMode\":\"");
    Serial.print(mode == LOCK_MODE_FIRST_PROJECT ? "first-project" : "on-thinking");
    Serial.println("\",\"locked\":null}");
  }
}

// Project lock helper: Get lock mode string
const char* getLockModeString() {
  return lockMode == LOCK_MODE_FIRST_PROJECT ? "first-project" : "on-thinking";
}

// Project lock helper: Parse lock mode string
int parseLockMode(const char* modeStr) {
  if (strcmp(modeStr, "first-project") == 0) return LOCK_MODE_FIRST_PROJECT;
  if (strcmp(modeStr, "on-thinking") == 0) return LOCK_MODE_ON_THINKING;
  return -1;  // Invalid mode
}

// Project lock helper: Check if locked to different project
bool isLockedToDifferentProject(const char* project) {
  if (strlen(lockedProject) == 0) return false;  // Not locked
  if (strlen(project) == 0) return false;  // No project specified
  return strcmp(lockedProject, project) != 0;
}

// Helper: Get state string from enum
const char* getStateString(AppState state) {
  switch (state) {
    case STATE_START: return "start";
    case STATE_IDLE: return "idle";
    case STATE_THINKING: return "thinking";
    case STATE_PLANNING: return "planning";
    case STATE_WORKING: return "working";
    case STATE_PACKING: return "packing";
    case STATE_NOTIFICATION: return "notification";
    case STATE_DONE: return "done";
    case STATE_SLEEP: return "sleep";
    default: return "idle";
  }
}

void setup() {
  Serial.begin(115200);

  // Load settings from persistent storage
  preferences.begin("vibe-monitor", true);  // Read-only mode
  lockMode = preferences.getInt("lockMode", LOCK_MODE_ON_THINKING);
  preferences.end();

  // TFT init
  tft.init();
  tft.setRotation(0);  // Portrait mode
  tft.setSwapBytes(true);  // Swap bytes for pushImage (ESP32 little-endian)
  tft.fillScreen(TFT_BLACK);

  // Initialize sprite buffer for character (128x128)
  charSprite.setColorDepth(16);
  charSprite.setSwapBytes(true);  // Swap bytes for sprite pushImage
  if (charSprite.createSprite(CHAR_WIDTH, CHAR_HEIGHT)) {
    spriteInitialized = true;
    Serial.println("{\"sprite\":\"initialized\",\"size\":\"128x128\"}");
  } else {
    Serial.println("{\"sprite\":\"failed\",\"error\":\"memory\"}");
  }

  // Start screen
  drawStartScreen();

  // Initialize sleep timer
  lastActivityTime = millis();

#ifdef USE_WIFI
  setupWiFi();
#ifdef USE_WEBSOCKET
  setupWebSocket();
#endif
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
#ifdef USE_WEBSOCKET
  webSocket.loop();
#endif
#endif

  // Animation update (100ms interval)
  if (millis() - lastUpdate > 100) {
    lastUpdate = millis();
    // Reset animFrame at 4800 to prevent overflow (LCM of 32,12,20,4 = 480)
    animFrame = (animFrame + 1) % 4800;
    updateAnimation();
  }

  // Idle blink (non-blocking state machine)
  updateBlink();

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

  // planning/thinking/working/notification/packing -> idle after 5 minutes
  if (currentState == STATE_PLANNING || currentState == STATE_THINKING ||
      currentState == STATE_WORKING || currentState == STATE_NOTIFICATION ||
      currentState == STATE_PACKING) {
    if (now - lastActivityTime >= SLEEP_TIMEOUT) {
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
    Serial.println("{\"error\":\"JSON parse error\"}");
    return;
  }

  // Handle command (lock/unlock)
  const char* command = doc["command"] | "";
  if (strlen(command) > 0) {
    if (strcmp(command, "lock") == 0) {
      const char* projectToLock = doc["project"] | currentProject;
      if (strlen(projectToLock) > 0) {
        lockProject(projectToLock);
      } else {
        Serial.println("{\"error\":\"No project to lock\"}");
      }
      return;
    } else if (strcmp(command, "unlock") == 0) {
      unlockProject();
      return;
    } else if (strcmp(command, "reboot") == 0) {
      Serial.println("{\"ok\":true,\"rebooting\":true}");
      delay(100);  // Allow serial output to complete
      ESP.restart();
      return;
    } else if (strcmp(command, "status") == 0) {
      // Return current status
      Serial.print("{\"state\":\"");
      Serial.print(getStateString(currentState));
      Serial.print("\",\"project\":\"");
      Serial.print(currentProject);
      Serial.print("\",\"locked\":");
      if (strlen(lockedProject) > 0) {
        Serial.print("\"");
        Serial.print(lockedProject);
        Serial.print("\"");
      } else {
        Serial.print("null");
      }
      Serial.print(",\"lockMode\":\"");
      Serial.print(getLockModeString());
      Serial.print("\",\"projectCount\":");
      Serial.print(projectCount);
      Serial.println("}");
      return;
    } else if (strcmp(command, "lock-mode") == 0) {
      // Get or set lock mode
      const char* modeStr = doc["mode"] | "";
      if (strlen(modeStr) > 0) {
        int newMode = parseLockMode(modeStr);
        if (newMode >= 0) {
          setLockMode(newMode);
        } else {
          Serial.println("{\"error\":\"Invalid mode. Valid modes: first-project, on-thinking\"}");
        }
      } else {
        // Return current lock mode
        Serial.print("{\"lockMode\":\"");
        Serial.print(getLockModeString());
        Serial.println("\"}");
      }
      return;
    }
  }

  // Get incoming project
  const char* incomingProject = doc["project"] | "";

  // Add incoming project to list
  if (strlen(incomingProject) > 0) {
    addProjectToList(incomingProject);
  }

  // Auto-lock based on lockMode
  if (lockMode == LOCK_MODE_FIRST_PROJECT) {
    // First project gets locked automatically
    if (strlen(incomingProject) > 0 && projectCount == 1 && strlen(lockedProject) == 0) {
      strncpy(lockedProject, incomingProject, sizeof(lockedProject) - 1);
      lockedProject[sizeof(lockedProject) - 1] = '\0';
    }
  } else if (lockMode == LOCK_MODE_ON_THINKING) {
    // Lock on thinking state
    const char* stateStr = doc["state"] | "";
    if (strcmp(stateStr, "thinking") == 0 && strlen(incomingProject) > 0) {
      strncpy(lockedProject, incomingProject, sizeof(lockedProject) - 1);
      lockedProject[sizeof(lockedProject) - 1] = '\0';
    }
  }

  // Check if update should be blocked due to project lock
  if (isLockedToDifferentProject(incomingProject)) {
    // Silently ignore update from different project
    Serial.println("{\"ok\":true,\"blocked\":true}");
    return;
  }

  previousState = currentState;

  // Track if info fields changed (for redraw when state is same)
  // IMPORTANT: Must be declared BEFORE processing any fields
  bool infoChanged = false;

  // Parse state
  const char* stateStr = doc["state"] | "";
  if (strlen(stateStr) > 0) {
    AppState newState = parseState(stateStr);
    // Clear tool when state changes (tool is only relevant for working state)
    if (newState != currentState) {
      currentTool[0] = '\0';
    }
    currentState = newState;
  }

  // Parse project - check for change and clear dependent fields
  const char* newProject = doc["project"] | "";
  if (strlen(newProject) > 0 && strcmp(newProject, currentProject) != 0) {
    // Project changed - clear model/memory and trigger redraw
    currentModel[0] = '\0';
    currentMemory[0] = '\0';
    currentTool[0] = '\0';
    infoChanged = true;
    strncpy(currentProject, newProject, sizeof(currentProject) - 1);
    currentProject[sizeof(currentProject) - 1] = '\0';
  }

  // Parse tool
  const char* toolStr = doc["tool"] | "";
  if (strlen(toolStr) > 0 && strcmp(toolStr, currentTool) != 0) {
    strncpy(currentTool, toolStr, sizeof(currentTool) - 1);
    currentTool[sizeof(currentTool) - 1] = '\0';
    infoChanged = true;
  }

  // Parse model
  const char* modelStr = doc["model"] | "";
  if (strlen(modelStr) > 0 && strcmp(modelStr, currentModel) != 0) {
    strncpy(currentModel, modelStr, sizeof(currentModel) - 1);
    currentModel[sizeof(currentModel) - 1] = '\0';
    infoChanged = true;
  }

  // Parse memory
  const char* memoryStr = doc["memory"] | "";
  if (strlen(memoryStr) > 0 && strcmp(memoryStr, currentMemory) != 0) {
    strncpy(currentMemory, memoryStr, sizeof(currentMemory) - 1);
    currentMemory[sizeof(currentMemory) - 1] = '\0';
    infoChanged = true;
  }

  // Parse character (use isValidCharacter() for dynamic validation)
  const char* charInput = doc["character"] | "";
  if (strlen(charInput) > 0 && isValidCharacter(charInput) && strcmp(charInput, currentCharacter) != 0) {
    strncpy(currentCharacter, charInput, sizeof(currentCharacter) - 1);
    currentCharacter[sizeof(currentCharacter) - 1] = '\0';
    infoChanged = true;
  }

  // Reset activity timer on any input
  lastActivityTime = millis();

  // Redraw if state or info changed
  if (currentState != previousState) {
    needsRedraw = true;
    dirtyCharacter = true;
    dirtyStatus = true;
    dirtyInfo = true;
    drawStatus();
  } else if (infoChanged) {
    // Same state but info changed - only redraw info section
    dirtyInfo = true;
    drawStatus();
  }
}

// Precomputed lookup tables for floating animation (10-20x faster than sin/cos)
// Values: cos(i * 2π/32) * 3 and sin(i * 2π/32) * 5, rounded to nearest integer
const int8_t FLOAT_TABLE_X[32] = {3, 3, 3, 2, 2, 2, 1, 1, 0, -1, -1, -2, -2, -2, -3, -3, -3, -3, -3, -2, -2, -2, -1, -1, 0, 1, 1, 2, 2, 2, 3, 3};
const int8_t FLOAT_TABLE_Y[32] = {0, 1, 2, 3, 4, 4, 5, 5, 5, 5, 5, 4, 4, 3, 2, 1, 0, -1, -2, -3, -4, -4, -5, -5, -5, -5, -5, -4, -4, -3, -2, -1};

// Calculate floating X offset using lookup table
int getFloatOffsetX() {
  return FLOAT_TABLE_X[animFrame % 32];
}

// Calculate floating Y offset using lookup table
int getFloatOffsetY() {
  return FLOAT_TABLE_Y[animFrame % 32];
}

void drawStartScreen() {
  uint16_t bgColor = TFT_BLACK;
  tft.fillScreen(bgColor);

  // Draw character in idle state (128x128) using sprite buffer
  const CharacterGeometry* character = getCharacter(currentCharacter);
  if (spriteInitialized) {
    drawCharacterToSprite(charSprite, EYE_NORMAL, EFFECT_NONE, bgColor, character);
    charSprite.pushSprite(CHAR_X_BASE, CHAR_Y_BASE);
  } else {
    drawCharacter(tft, CHAR_X_BASE, CHAR_Y_BASE, EYE_NORMAL, EFFECT_NONE, bgColor, character);
  }

  // Title
  tft.setTextColor(COLOR_TEXT_WHITE);
  tft.setTextSize(2);
  tft.setCursor(30, STATUS_TEXT_Y);
  tft.println("VibeMon");

  tft.setTextSize(1);
  tft.setTextColor(COLOR_TEXT_DIM);
  tft.setCursor(30, PROJECT_Y);
  tft.println("Waiting...");

  // Brand
  tft.setCursor(40, BRAND_Y);
  tft.println("v1.4.0");
}

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
    char statusText[32];
    getStatusTextEnum(currentState, statusText, sizeof(statusText));

    tft.setTextColor(textColor);
    tft.setTextSize(3);
    int textWidth = strlen(statusText) * 18;
    int textX = (SCREEN_WIDTH - textWidth) / 2;
    tft.setCursor(textX, STATUS_TEXT_Y);
    tft.println(statusText);
  }

  // Loading dots (thinking, planning and working states)
  if (currentState == STATE_THINKING || currentState == STATE_PLANNING) {
    drawLoadingDots(tft, SCREEN_WIDTH / 2, LOADING_Y, animFrame, true);  // Slow
  } else if (currentState == STATE_WORKING) {
    drawLoadingDots(tft, SCREEN_WIDTH / 2, LOADING_Y, animFrame, false);  // Normal
  }

  // Project name, tool, model, memory info
  if (dirtyInfo || needsRedraw) {
    // Clear info region when only info changed (not full redraw)
    // This prevents text overlap/ghosting
    if (dirtyInfo && !needsRedraw) {
      tft.fillRect(0, PROJECT_Y, SCREEN_WIDTH, BRAND_Y - PROJECT_Y, bgColor);
    }

    if (strlen(currentProject) > 0) {
      tft.setTextColor(textColor);
      tft.setTextSize(1.3);
      drawFolderIcon(tft, 10, PROJECT_Y, textColor);
      tft.setCursor(24, PROJECT_Y);

      char displayProject[20];
      size_t maxDisplay = sizeof(displayProject) - 1;
      if (strlen(currentProject) > 15) {
        strncpy(displayProject, currentProject, 12);
        displayProject[12] = '\0';
        strncat(displayProject, "...", maxDisplay - strlen(displayProject));
      } else {
        strncpy(displayProject, currentProject, maxDisplay);
        displayProject[maxDisplay] = '\0';
      }
      tft.println(displayProject);
    }

    // Tool name (working state only)
    if (strlen(currentTool) > 0 && currentState == STATE_WORKING) {
      tft.setTextColor(textColor);
      tft.setTextSize(1.3);
      drawToolIcon(tft, 10, TOOL_Y, textColor);
      tft.setCursor(24, TOOL_Y);
      tft.println(currentTool);
    }

    // Model name
    if (strlen(currentModel) > 0) {
      tft.setTextColor(textColor);
      tft.setTextSize(1.3);
      drawRobotIcon(tft, 10, MODEL_Y, textColor);
      tft.setCursor(24, MODEL_Y);

      char displayModel[20];
      size_t maxModel = sizeof(displayModel) - 1;
      if (strlen(currentModel) > 15) {
        strncpy(displayModel, currentModel, 12);
        displayModel[12] = '\0';
        strncat(displayModel, "...", maxModel - strlen(displayModel));
      } else {
        strncpy(displayModel, currentModel, maxModel);
        displayModel[maxModel] = '\0';
      }
      tft.println(displayModel);
    }

    // Memory usage (hide on start state)
    if (strlen(currentMemory) > 0 && currentState != STATE_START) {
      tft.setTextColor(textColor);
      tft.setTextSize(1.3);
      drawBrainIcon(tft, 10, MEMORY_Y, textColor);
      tft.setCursor(24, MEMORY_Y);
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
    if (currentState == STATE_THINKING || currentState == STATE_PLANNING || currentState == STATE_PACKING) {
      needsCharRedraw = (animFrame % 12 == 0);  // Thought bubble animation
    } else if (currentState == STATE_WORKING) {
      needsCharRedraw = (animFrame % 2 == 0);   // Matrix rain animation
    } else if (currentState == STATE_START) {
      needsCharRedraw = (animFrame % 4 == 0);   // Sparkle animation
    } else if (currentState == STATE_SLEEP) {
      needsCharRedraw = (animFrame % 20 == 0);  // Zzz animation
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
  if (currentState == STATE_THINKING || currentState == STATE_PLANNING || currentState == STATE_PACKING) {
    drawLoadingDots(tft, SCREEN_WIDTH / 2, LOADING_Y, animFrame, true);  // Slow
  } else if (currentState == STATE_WORKING) {
    drawLoadingDots(tft, SCREEN_WIDTH / 2, LOADING_Y, animFrame, false);  // Fast
  }
}

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
      // Check if it's time to blink (every 3.2 seconds)
      if (now - lastBlink > 3200) {
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
      // Check if blink duration (100ms) has elapsed
      if (now - blinkPhaseStart >= 100) {
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

#ifdef USE_WIFI
void setupWiFi() {
  WiFi.begin(ssid, password);

  tft.setCursor(10, BRAND_Y - 35);
  tft.setTextColor(COLOR_TEXT_DIM);
  tft.setTextSize(1.3);
  tft.print("WiFi: ");

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    tft.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    tft.println("OK");
    tft.setCursor(10, BRAND_Y - 20);
    tft.print("IP: ");
    tft.println(WiFi.localIP());

    // HTTP server setup
    server.on("/status", HTTP_POST, handleStatus);
    server.on("/status", HTTP_GET, handleStatusGet);
    server.on("/health", HTTP_GET, handleHealth);
    server.on("/lock", HTTP_POST, handleLock);
    server.on("/unlock", HTTP_POST, handleUnlock);
    server.on("/lock-mode", HTTP_GET, handleLockModeGet);
    server.on("/lock-mode", HTTP_POST, handleLockModePost);
    server.on("/reboot", HTTP_POST, handleReboot);
    server.begin();
  } else {
    tft.println("Failed");
  }
}

void handleStatus() {
  if (server.hasArg("plain")) {
    // Use const reference to avoid String copy (heap allocation)
    const String& body = server.arg("plain");
    processInput(body.c_str());
    server.send(200, "application/json", "{\"ok\":true}");
  } else {
    server.send(400, "application/json", "{\"error\":\"no body\"}");
  }
}

void handleStatusGet() {
  char response[256];
  if (strlen(lockedProject) > 0) {
    snprintf(response, sizeof(response),
      "{\"state\":\"%s\",\"project\":\"%s\",\"locked\":\"%s\",\"lockMode\":\"%s\",\"projectCount\":%d}",
      getStateString(currentState), currentProject, lockedProject, getLockModeString(), projectCount);
  } else {
    snprintf(response, sizeof(response),
      "{\"state\":\"%s\",\"project\":\"%s\",\"locked\":null,\"lockMode\":\"%s\",\"projectCount\":%d}",
      getStateString(currentState), currentProject, getLockModeString(), projectCount);
  }
  server.send(200, "application/json", response);
}

void handleHealth() {
  server.send(200, "application/json", "{\"status\":\"ok\"}");
}

void handleLock() {
  char response[128];
  if (server.hasArg("plain")) {
    StaticJsonDocument<128> doc;
    // Use const reference to avoid String copy
    const String& body = server.arg("plain");
    DeserializationError error = deserializeJson(doc, body);
    if (!error) {
      const char* projectToLock = doc["project"] | currentProject;
      if (strlen(projectToLock) > 0) {
        lockProject(projectToLock);
        snprintf(response, sizeof(response), "{\"success\":true,\"locked\":\"%s\"}", lockedProject);
        server.send(200, "application/json", response);
        return;
      }
    }
  }
  // No body or no project - lock current project
  if (strlen(currentProject) > 0) {
    lockProject(currentProject);
    snprintf(response, sizeof(response), "{\"success\":true,\"locked\":\"%s\"}", lockedProject);
    server.send(200, "application/json", response);
  } else {
    server.send(400, "application/json", "{\"error\":\"No project to lock\"}");
  }
}

void handleUnlock() {
  unlockProject();
  server.send(200, "application/json", "{\"success\":true,\"locked\":null}");
}

void handleLockModeGet() {
  char response[192];
  snprintf(response, sizeof(response),
    "{\"lockMode\":\"%s\",\"modes\":{\"first-project\":\"First project auto-lock\",\"on-thinking\":\"Lock on thinking\"}}",
    getLockModeString());
  server.send(200, "application/json", response);
}

void handleLockModePost() {
  if (server.hasArg("plain")) {
    StaticJsonDocument<128> doc;
    // Use const reference to avoid String copy
    const String& body = server.arg("plain");
    DeserializationError error = deserializeJson(doc, body);
    if (!error) {
      const char* modeStr = doc["mode"] | "";
      if (strlen(modeStr) > 0) {
        int newMode = parseLockMode(modeStr);
        if (newMode >= 0) {
          setLockMode(newMode);
          char response[64];
          snprintf(response, sizeof(response), "{\"success\":true,\"lockMode\":\"%s\"}", getLockModeString());
          server.send(200, "application/json", response);
          return;
        }
      }
    }
  }
  server.send(400, "application/json", "{\"error\":\"Invalid mode. Valid modes: first-project, on-thinking\"}");
}

void handleReboot() {
  server.send(200, "application/json", "{\"ok\":true,\"rebooting\":true}");
  delay(100);  // Allow HTTP response to complete
  ESP.restart();
}

#ifdef USE_WEBSOCKET
void setupWebSocket() {
  // Connect to WebSocket server
#if WS_USE_SSL
  webSocket.beginSSL(WS_HOST, WS_PORT, WS_PATH);
#else
  webSocket.begin(WS_HOST, WS_PORT, WS_PATH);
#endif

  // Set event handler
  webSocket.onEvent(webSocketEvent);

  // Set reconnect interval
  webSocket.setReconnectInterval(WS_RECONNECT_INTERVAL);

  Serial.println("{\"websocket\":\"connecting\"}");
}

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      wsConnected = false;
      Serial.println("{\"websocket\":\"disconnected\"}");
      break;

    case WStype_CONNECTED:
      wsConnected = true;
      Serial.print("{\"websocket\":\"connected\",\"url\":\"");
      Serial.print((char*)payload);
      Serial.println("\"}");

      // Send authentication message if token is configured
      if (strlen(WS_TOKEN) > 0) {
        char authMsg[128];
        snprintf(authMsg, sizeof(authMsg), "{\"type\":\"auth\",\"token\":\"%s\"}", WS_TOKEN);
        webSocket.sendTXT(authMsg);
        Serial.println("{\"websocket\":\"auth_sent\"}");
      }
      break;

    case WStype_TEXT:
      // Process received message (same as Serial/HTTP input)
      processInput((char*)payload);
      break;

    case WStype_ERROR:
      Serial.println("{\"websocket\":\"error\"}");
      break;

    default:
      break;
  }
}
#endif
#endif
