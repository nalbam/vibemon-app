/*
 * VibeMon
 * ESP32-C6-LCD-1.47 (172x320, ST7789V2)
 *
 * Pixel art character (128x128) with animated states
 * USB Serial + HTTP support
 */

// =============================================================================
// SECTION 1: Includes & Libraries
// =============================================================================

// Use LovyanGFX instead of TFT_eSPI for ESP32-C6 compatibility
#include "TFT_Compat.h"
#include <ArduinoJson.h>
#include <Preferences.h>
#include "sprites.h"

// WiFi configuration (create credentials.h from credentials.h.example)
#if __has_include("credentials.h")
#include "credentials.h"
#endif

// WiFi (HTTP fallback, optional)
#ifdef USE_WIFI
#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>

// WebSocket client (optional, requires USE_WIFI)
#ifdef USE_WEBSOCKET
#include <WebSocketsClient.h>
#endif
#endif

// =============================================================================
// SECTION 2: Constants & Macros
// =============================================================================

// Version string
#define VERSION "v1.8.0"

// Screen size
#define SCREEN_WIDTH  172
#define SCREEN_HEIGHT 320

// Layout positions (adjusted for 128x128 character on 172x320 screen)
#define CHAR_X_BASE   22   // (172 - 128) / 2 = 22
#define CHAR_Y_BASE   18   // Base Y position (float ±5px → 13~23)
#define FLOAT_AMPLITUDE_X 3  // Floating animation amplitude X (pixels)
#define FLOAT_AMPLITUDE_Y 5  // Floating animation amplitude Y (pixels)
#define STATUS_TEXT_Y 160  // size 3 (24px) → bottom 184
#define LOADING_Y     190  // dots after status text (gap 6px) → bottom ~198
#define PROJECT_Y     204  // info rows: 25px spacing (+1px from previous 24px)
#define TOOL_Y        229
#define MODEL_Y       254
#define MEMORY_Y      279  // font ~14px → bottom 293
#define MEMORY_BAR_X  10
#define MEMORY_BAR_Y  299  // 5px gap after memory text
#define MEMORY_BAR_W  152
#define MEMORY_BAR_H  6    // bar bottom 303 → 17px bottom margin
#define BRAND_Y       308  // start screen only (size 1, 8px)

// Animation timing
#define BLINK_INTERVAL       3200  // Blink interval in idle state (ms)
#define BLINK_DURATION        100  // Blink closed-eye hold duration (ms)

// State timeouts
#define IDLE_TIMEOUT 60000            // 1 minute (start/done -> idle)
#define SLEEP_TIMEOUT 300000          // 5 minutes (idle -> sleep)

// JSON buffer size for StaticJsonDocument
// Increased from 256 to 512 for complex payloads with all fields
#define JSON_BUFFER_SIZE 512

// Project lock modes
#define LOCK_MODE_FIRST_PROJECT 0
#define LOCK_MODE_ON_THINKING 1
#define MAX_PROJECTS 10

// WiFi connection
#define WIFI_CONNECT_ATTEMPTS  20  // Max connection attempts before giving up
#define WIFI_CONNECT_DELAY_MS 500  // Delay between each attempt (ms)
#define WIFI_FAIL_RESTART_MS 2000  // Delay before reboot on connection failure (ms)

// Safe string copy: always null-terminates, requires array (not pointer) as dst
#define safeCopyStr(dst, src) do { strncpy(dst, src, sizeof(dst)-1); dst[sizeof(dst)-1]='\0'; } while(0)

// =============================================================================
// SECTION 3: Global Variables
// =============================================================================

// Persistent storage for settings
Preferences preferences;

// tft instance is defined in TFT_Compat.h

// Sprite buffer for double buffering (prevents flickering)
TFT_eSprite charSprite(&tft);
bool spriteInitialized = false;

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
int currentMemory = 0;
unsigned long lastUpdate = 0;
unsigned long lastBlink = 0;
int animFrame = 0;
bool needsRedraw = true;
int lastCharX = CHAR_X_BASE;  // Track last character X for efficient redraw
int lastCharY = CHAR_Y_BASE;  // Track last character Y for efficient redraw

// Project lock
char projectList[MAX_PROJECTS][32];  // List of incoming projects
int projectCount = 0;
char lockedProject[32] = "";  // Locked project name (empty = unlocked)
int lockMode = LOCK_MODE_ON_THINKING;  // Default: on-thinking

// Dirty rect tracking for efficient redraws
bool dirtyCharacter = true;
bool dirtyStatus = true;
bool dirtyInfo = true;

// State timeouts
unsigned long lastActivityTime = 0;

// Serial input buffer (avoid String allocation)
char serialBuffer[512];
int serialBufferPos = 0;

// WiFi variables (conditional)
#ifdef USE_WIFI
bool provisioningMode = false;
const char* AP_SSID = "VibeMon-Setup";
const char* AP_PASSWORD = "vibemon123";
DNSServer dnsServer;
const byte DNS_PORT = 53;

char wifiSSID[64] = "";
char wifiPassword[64] = "";

// Fallback to credentials.h if defined
#ifdef WIFI_SSID
const char* defaultSSID = WIFI_SSID;
const char* defaultPassword = WIFI_PASSWORD;
#else
const char* defaultSSID = "";
const char* defaultPassword = "";
#endif

WebServer server(80);

const unsigned long WIFI_CHECK_INTERVAL = 10000;  // Check every 10 seconds
unsigned long lastWifiCheck = 0;
bool wifiWasConnected = false;

#ifdef USE_WEBSOCKET
WebSocketsClient webSocket;
bool wsConnected = false;

char wsToken[128] = "";

// Fallback to credentials.h if defined
#ifdef WS_TOKEN
const char* defaultWSToken = WS_TOKEN;
#else
const char* defaultWSToken = "";
#endif

// Exponential backoff for reconnection (server-friendly)
const unsigned long WS_RECONNECT_INITIAL = 5000;   // 5 seconds
const unsigned long WS_RECONNECT_MAX = 60000;       // 60 seconds
const float WS_RECONNECT_MULTIPLIER = 1.5;
unsigned long wsReconnectDelay = WS_RECONNECT_INITIAL;

// Heartbeat to detect stale connections
const unsigned long WS_HEARTBEAT_INTERVAL = 15000;  // Ping every 15s
const unsigned long WS_HEARTBEAT_TIMEOUT = 3000;    // Pong timeout 3s
const uint8_t WS_HEARTBEAT_FAILURES = 2;            // Disconnect after 2 missed
#endif
#endif

// =============================================================================
// SECTION 4: State & Utility Helpers
// =============================================================================

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
  if (strcmp(stateStr, "alert") == 0) return STATE_ALERT;
  return STATE_IDLE;  // default
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
    case STATE_ALERT: return "alert";
    default: return "idle";
  }
}

// Helper: True for states that show slow loading dots (thought bubble)
bool isLoadingState(AppState state) {
  return state == STATE_THINKING || state == STATE_PLANNING || state == STATE_PACKING;
}

// Helper: True for all active states that auto-timeout to idle after 5 minutes
bool isActiveState(AppState state) {
  return state == STATE_THINKING || state == STATE_PLANNING || state == STATE_WORKING ||
         state == STATE_NOTIFICATION || state == STATE_PACKING || state == STATE_ALERT;
}

// Helper: Transition to newState and trigger full redraw
// resetTimer: reset lastActivityTime (false only for idle->sleep transition)
void transitionToState(AppState newState, bool resetTimer = true);  // forward declaration

// Check state timeouts for auto-transitions
void checkSleepTimer() {
  unsigned long now = millis();

  // start/done -> idle after 1 minute
  if (currentState == STATE_START || currentState == STATE_DONE) {
    if (now - lastActivityTime >= IDLE_TIMEOUT) {
      transitionToState(STATE_IDLE);
      return;
    }
  }

  // active states -> idle after 5 minutes
  if (isActiveState(currentState)) {
    if (now - lastActivityTime >= SLEEP_TIMEOUT) {
      transitionToState(STATE_IDLE);
      return;
    }
  }

  // idle -> sleep after 5 minutes
  if (currentState == STATE_IDLE) {
    if (now - lastActivityTime >= SLEEP_TIMEOUT) {
      transitionToState(STATE_SLEEP, false);
    }
  }
}

// =============================================================================
// SECTION 5: Project Lock Functions
// =============================================================================

// Check if project exists in list
bool projectExists(const char* project) {
  for (int i = 0; i < projectCount; i++) {
    if (strcmp(projectList[i], project) == 0) {
      return true;
    }
  }
  return false;
}

// Add project to list (if not exists, max 10)
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
  safeCopyStr(projectList[projectCount], project);
  projectCount++;
}

// Forward declaration for drawStatus (defined in Section 7)
void drawStatus();

// Lock to a specific project
void lockProject(const char* project) {
  if (strlen(project) > 0) {
    bool changed = (strcmp(lockedProject, project) != 0);
    addProjectToList(project);
    safeCopyStr(lockedProject, project);

    // Transition to idle state when lock changes
    if (changed) {
      previousState = currentState;
      currentState = STATE_IDLE;
      safeCopyStr(currentProject, project);
      currentTool[0] = '\0';
      currentModel[0] = '\0';
      currentMemory = 0;
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

// Unlock project
void unlockProject() {
  lockedProject[0] = '\0';
  Serial.println("{\"locked\":null}");
}

// Set lock mode
void setLockMode(int mode) {
  if (mode == LOCK_MODE_FIRST_PROJECT || mode == LOCK_MODE_ON_THINKING) {
    lockMode = mode;
    lockedProject[0] = '\0';  // Reset lock when mode changes

    // Persist to flash storage
    preferences.begin("vibemon", false);  // Read-write mode
    preferences.putInt("lockMode", lockMode);
    preferences.end();

    Serial.print("{\"lockMode\":\"");
    Serial.print(mode == LOCK_MODE_FIRST_PROJECT ? "first-project" : "on-thinking");
    Serial.println("\",\"locked\":null}");
  }
}

// Get lock mode string
const char* getLockModeString() {
  return lockMode == LOCK_MODE_FIRST_PROJECT ? "first-project" : "on-thinking";
}

// Parse lock mode string
int parseLockMode(const char* modeStr) {
  if (strcmp(modeStr, "first-project") == 0) return LOCK_MODE_FIRST_PROJECT;
  if (strcmp(modeStr, "on-thinking") == 0) return LOCK_MODE_ON_THINKING;
  return -1;  // Invalid mode
}

// Check if locked to different project
bool isLockedToDifferentProject(const char* project) {
  if (strlen(lockedProject) == 0) return false;  // Not locked
  if (strlen(project) == 0) return false;  // No project specified
  return strcmp(lockedProject, project) != 0;
}

// =============================================================================
// SECTION 6: Status & Input Processing
// =============================================================================

// Build status JSON into buffer (shared by Serial command handler and HTTP handler)
void buildStatusJson(char* buf, size_t size) {
  if (strlen(lockedProject) > 0) {
    snprintf(buf, size,
      "{\"state\":\"%s\",\"project\":\"%s\",\"locked\":\"%s\",\"lockMode\":\"%s\",\"projectCount\":%d}",
      getStateString(currentState), currentProject, lockedProject, getLockModeString(), projectCount);
  } else {
    snprintf(buf, size,
      "{\"state\":\"%s\",\"project\":\"%s\",\"locked\":null,\"lockMode\":\"%s\",\"projectCount\":%d}",
      getStateString(currentState), currentProject, getLockModeString(), projectCount);
  }
}

// Handle command-type input (lock/unlock/reboot/status/lock-mode)
// Returns true if the command was handled
bool handleCommand(const char* command, JsonObject doc) {
  if (strcmp(command, "lock") == 0) {
    const char* projectToLock = doc["project"] | currentProject;
    if (strlen(projectToLock) > 0) {
      lockProject(projectToLock);
    } else {
      Serial.println("{\"error\":\"No project to lock\"}");
    }
    return true;
  }
  if (strcmp(command, "unlock") == 0) {
    unlockProject();
    return true;
  }
  if (strcmp(command, "reboot") == 0) {
    Serial.println("{\"ok\":true,\"rebooting\":true}");
    delay(100);  // Allow serial output to complete
    ESP.restart();
    return true;
  }
  if (strcmp(command, "status") == 0) {
    char buf[256];
    buildStatusJson(buf, sizeof(buf));
    Serial.println(buf);
    return true;
  }
  if (strcmp(command, "lock-mode") == 0) {
    const char* modeStr = doc["mode"] | "";
    if (strlen(modeStr) > 0) {
      int newMode = parseLockMode(modeStr);
      if (newMode >= 0) {
        setLockMode(newMode);
      } else {
        Serial.println("{\"error\":\"Invalid mode. Valid modes: first-project, on-thinking\"}");
      }
    } else {
      Serial.print("{\"lockMode\":\"");
      Serial.print(getLockModeString());
      Serial.println("\"}");
    }
    return true;
  }
  return false;
}

// Forward declaration for processStatusData (defined below)
void processStatusData(JsonObject doc);

// Handle WebSocket message-type input (authenticated/error/status)
// Returns true if the message was handled
bool handleWebSocketMessage(const char* msgType, JsonObject doc) {
  if (strcmp(msgType, "authenticated") == 0) {
    Serial.println("{\"websocket\":\"authenticated\"}");
    return true;
  }
  if (strcmp(msgType, "error") == 0) {
    const char* errMsg = doc["message"] | "unknown";
    Serial.print("{\"websocket\":\"error\",\"message\":\"");
    Serial.print(errMsg);
    Serial.println("\"}");
    return true;
  }
  if (strcmp(msgType, "status") == 0 && doc.containsKey("data")) {
    JsonObject data = doc["data"];
    if (data.isNull()) {
      Serial.println("{\"error\":\"Invalid status data\"}");
      return true;
    }
    processStatusData(data);
    return true;
  }
  return false;
}

void processInput(const char* input) {
  StaticJsonDocument<JSON_BUFFER_SIZE> doc;
  DeserializationError error = deserializeJson(doc, input);

  if (error) {
    Serial.println("{\"error\":\"JSON parse error\"}");
    return;
  }

  JsonObject obj = doc.as<JsonObject>();

  // Handle command (lock/unlock/reboot/status/lock-mode)
  const char* command = doc["command"] | "";
  if (strlen(command) > 0 && handleCommand(command, obj)) return;

  // Handle WebSocket message types (server sends {type: "status", data: {...}})
  const char* msgType = doc["type"] | "";
  if (strlen(msgType) > 0 && handleWebSocketMessage(msgType, obj)) return;

  // Direct format: {state: "...", project: "...", ...}
  processStatusData(obj);
}

void processStatusData(JsonObject doc) {
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
      safeCopyStr(lockedProject, incomingProject);
    }
  } else if (lockMode == LOCK_MODE_ON_THINKING) {
    // Lock on thinking state
    const char* stateStr = doc["state"] | "";
    if (strcmp(stateStr, "thinking") == 0 && strlen(incomingProject) > 0) {
      safeCopyStr(lockedProject, incomingProject);
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
    currentMemory = 0;
    currentTool[0] = '\0';
    infoChanged = true;
    safeCopyStr(currentProject, newProject);
  }

  // Parse tool
  const char* toolStr = doc["tool"] | "";
  if (strlen(toolStr) > 0 && strcmp(toolStr, currentTool) != 0) {
    safeCopyStr(currentTool, toolStr);
    infoChanged = true;
    // Tool change affects status text in working state
    if (currentState == STATE_WORKING) {
      dirtyStatus = true;
    }
  }

  // Parse model
  const char* modelStr = doc["model"] | "";
  if (strlen(modelStr) > 0 && strcmp(modelStr, currentModel) != 0) {
    safeCopyStr(currentModel, modelStr);
    infoChanged = true;
  }

  // Parse memory (number 0-100)
  int memoryVal = doc["memory"] | -1;
  if (memoryVal >= 0 && memoryVal != currentMemory) {
    currentMemory = memoryVal;
    infoChanged = true;
  }

  // Parse character (use isValidCharacter() for dynamic validation)
  const char* charInput = doc["character"] | "";
  if (strlen(charInput) > 0 && isValidCharacter(charInput) && strcmp(charInput, currentCharacter) != 0) {
    safeCopyStr(currentCharacter, charInput);
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

// =============================================================================
// SECTION 7: Graphics & Display Functions
// =============================================================================

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
    int textWidth = strlen(statusText) * 18;
    int textX = (SCREEN_WIDTH - textWidth) / 2;
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
      needsCharRedraw = (animFrame % 12 == 0);  // Thought bubble animation
    } else if (currentState == STATE_START || currentState == STATE_WORKING) {
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
  if (isLoadingState(currentState)) {
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

// =============================================================================
// SECTION 8: Transition Helper (defined after drawStatus)
// =============================================================================

void transitionToState(AppState newState, bool resetTimer) {
  previousState = currentState;
  currentState = newState;
  if (resetTimer) lastActivityTime = millis();
  needsRedraw = true;
  dirtyCharacter = true;
  dirtyStatus = true;
  drawStatus();
}

// =============================================================================
// SECTION 9: setup() & loop()
// =============================================================================

void setup() {
  Serial.begin(115200);

  // Load settings from persistent storage
  preferences.begin("vibemon", true);  // Read-only mode
  lockMode = preferences.getInt("lockMode", LOCK_MODE_ON_THINKING);
  preferences.end();

  // Validate loaded lockMode (flash corruption safety)
  if (lockMode != LOCK_MODE_FIRST_PROJECT && lockMode != LOCK_MODE_ON_THINKING) {
    lockMode = LOCK_MODE_ON_THINKING;
    preferences.begin("vibemon", false);
    preferences.putInt("lockMode", lockMode);
    preferences.end();
  }

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
  if (provisioningMode) {
    dnsServer.processNextRequest();
  }
  checkWiFiConnection();
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

// =============================================================================
// SECTION 10: WiFi Functions (conditional)
// =============================================================================

#ifdef USE_WIFI

// Load WiFi credentials from Preferences
void loadWiFiCredentials() {
  preferences.begin("vibemon", true);  // Read-only
  preferences.getString("wifiSSID", wifiSSID, sizeof(wifiSSID));
  preferences.getString("wifiPassword", wifiPassword, sizeof(wifiPassword));
  preferences.end();

  // If no saved credentials, try using default from credentials.h
  if (strlen(wifiSSID) == 0 && strlen(defaultSSID) > 0) {
    safeCopyStr(wifiSSID, defaultSSID);
    safeCopyStr(wifiPassword, defaultPassword);
  }
}

// Save WiFi credentials to Preferences
void saveWiFiCredentials(const char* ssid, const char* password) {
  preferences.begin("vibemon", false);  // Read-write
  preferences.putString("wifiSSID", ssid);
  preferences.putString("wifiPassword", password);
  preferences.end();

  safeCopyStr(wifiSSID, ssid);
  safeCopyStr(wifiPassword, password);
}

#ifdef USE_WEBSOCKET
// Load WebSocket token from Preferences
void loadWebSocketToken() {
  preferences.begin("vibemon", true);  // Read-only
  preferences.getString("wsToken", wsToken, sizeof(wsToken));
  preferences.end();

  // If no saved token, try using default from credentials.h
  if (strlen(wsToken) == 0 && strlen(defaultWSToken) > 0) {
    safeCopyStr(wsToken, defaultWSToken);
  }
}

// Save WebSocket token to Preferences
void saveWebSocketToken(const char* token) {
  preferences.begin("vibemon", false);  // Read-write
  preferences.putString("wsToken", token);
  preferences.end();

  safeCopyStr(wsToken, token);
}
#endif

// Start Access Point for WiFi provisioning
void startProvisioningMode() {
  provisioningMode = true;

  // Display setup information starting from Y=230 for better visibility
  int setupY = 230;
  tft.setCursor(10, setupY);
  tft.setTextColor(COLOR_TEXT_DIM);
  tft.setTextSize(1);
  tft.println("Setup Mode");

  // Start Access Point
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASSWORD);

  tft.setCursor(10, setupY + 18);
  tft.print("SSID: ");
  tft.println(AP_SSID);
  tft.setCursor(10, setupY + 36);
  tft.print("Password: ");
  tft.println(AP_PASSWORD);
  tft.setCursor(10, setupY + 54);
  tft.print("IP: ");
  tft.println(WiFi.softAPIP());

  // Start DNS server for captive portal
  dnsServer.start(DNS_PORT, "*", WiFi.softAPIP());

  // Setup web server for configuration
  setupProvisioningServer();

  Serial.println("{\"wifi\":\"provisioning_mode\",\"ssid\":\"" + String(AP_SSID) + "\"}");
}

// Setup web server endpoints for provisioning
void setupProvisioningServer() {
  // Captive portal - serve config page for all requests
  server.onNotFound([]() {
    server.send(200, "text/html", getConfigPage());
  });

  // WiFi scan endpoint
  server.on("/scan", HTTP_GET, []() {
    String json = "{\"networks\":[";
    int n = WiFi.scanNetworks();
    for (int i = 0; i < n; i++) {
      if (i > 0) json += ",";
      // Escape SSID for JSON (replace " with \")
      String ssid = WiFi.SSID(i);
      ssid.replace("\\", "\\\\");  // Escape backslashes first
      ssid.replace("\"", "\\\"");  // Escape quotes
      json += "{\"ssid\":\"" + ssid + "\",\"rssi\":" + String(WiFi.RSSI(i)) + ",\"secure\":" + String(WiFi.encryptionType(i) != WIFI_AUTH_OPEN ? "true" : "false") + "}";
    }
    json += "]}";
    server.send(200, "application/json", json);
  });

  // Save credentials endpoint
  server.on("/save", HTTP_POST, []() {
    if (server.hasArg("ssid") && server.hasArg("password")) {
      String ssid = server.arg("ssid");
      String password = server.arg("password");

      saveWiFiCredentials(ssid.c_str(), password.c_str());

#ifdef USE_WEBSOCKET
      // Also save WebSocket token if provided
      if (server.hasArg("token")) {
        String token = server.arg("token");
        saveWebSocketToken(token.c_str());
      }
#endif

      server.send(200, "application/json", "{\"success\":true,\"message\":\"Credentials saved. Rebooting...\"}");

      delay(1000);
      ESP.restart();
    } else {
      server.send(400, "application/json", "{\"success\":false,\"message\":\"Missing SSID or password\"}");
    }
  });

  server.begin();
}

// HTML page for WiFi configuration
String getConfigPage() {
  String html = R"HTML(
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VibeMon WiFi Setup</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 30px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 24px;
    }
    .subtitle {
      color: #666;
      margin-bottom: 25px;
      font-size: 14px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      color: #555;
      font-weight: 500;
      margin-bottom: 8px;
      font-size: 14px;
    }
    select, input {
      width: 100%;
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.3s;
    }
    select:focus, input:focus {
      outline: none;
      border-color: #667eea;
    }
    button {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    }
    button:hover {
      transform: translateY(-2px);
    }
    button:active {
      transform: translateY(0);
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .scan-btn {
      background: linear-gradient(135deg, #42a5f5 0%, #1976d2 100%);
      margin-bottom: 15px;
    }
    .status {
      margin-top: 15px;
      padding: 12px;
      border-radius: 8px;
      text-align: center;
      font-size: 14px;
      display: none;
    }
    .status.success {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    .status.error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
    .loading {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid #f3f3f3;
      border-top: 2px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-right: 8px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🌐 VibeMon WiFi Setup</h1>
    <p class="subtitle">Connect your VibeMon to WiFi</p>

    <button class="scan-btn" onclick="scanNetworks()">
      <span id="scan-text">🔍 Scan Networks</span>
    </button>

    <form onsubmit="saveCredentials(event)">
      <div class="form-group">
        <label for="ssid">WiFi Network</label>
        <select id="ssid" required>
          <option value="">Select a network...</option>
        </select>
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" required placeholder="Enter WiFi password" autocapitalize="none" autocorrect="off" spellcheck="false">
      </div>

      <div class="form-group">
        <label for="token">VibeMon Token (Optional)</label>
        <input type="text" id="token" placeholder="Enter WebSocket token (leave empty if not needed)" autocapitalize="none" autocorrect="off" spellcheck="false">
      </div>

      <button type="submit" id="save-btn">💾 Save & Connect</button>
    </form>

    <div class="status" id="status"></div>
  </div>

  <script>
    function showStatus(message, isError = false) {
      const status = document.getElementById('status');
      status.textContent = message;
      status.className = 'status ' + (isError ? 'error' : 'success');
      status.style.display = 'block';
    }

    function scanNetworks() {
      const scanBtn = document.querySelector('.scan-btn');
      const scanText = document.getElementById('scan-text');
      scanBtn.disabled = true;
      scanText.innerHTML = '<span class="loading"></span>Scanning...';

      fetch('/scan')
        .then(res => res.json())
        .then(data => {
          const select = document.getElementById('ssid');
          select.innerHTML = '<option value="">Select a network...</option>';

          data.networks.forEach(network => {
            const option = document.createElement('option');
            option.value = network.ssid;
            const signal = network.rssi > -50 ? '▰▰▰▰' : network.rssi > -60 ? '▰▰▰▱' : network.rssi > -70 ? '▰▰▱▱' : '▰▱▱▱';
            const lock = network.secure ? '🔒' : "";
            option.textContent = signal + ' ' + network.ssid + ' ' + lock;
            select.appendChild(option);
          });

          showStatus('Found ' + data.networks.length + ' networks');
          setTimeout(() => {
            document.getElementById('status').style.display = 'none';
          }, 3000);
        })
        .catch(err => {
          showStatus('Scan failed: ' + err.message, true);
        })
        .finally(() => {
          scanBtn.disabled = false;
          scanText.innerHTML = '🔍 Scan Networks';
        });
    }

    function saveCredentials(e) {
      e.preventDefault();

      const ssid = document.getElementById('ssid').value;
      const password = document.getElementById('password').value;
      const token = document.getElementById('token').value;
      const saveBtn = document.getElementById('save-btn');

      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="loading"></span>Connecting...';

      const formData = new URLSearchParams();
      formData.append('ssid', ssid);
      formData.append('password', password);
      if (token) {
        formData.append('token', token);
      }

      fetch('/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            showStatus(data.message);
          } else {
            showStatus(data.message, true);
            saveBtn.disabled = false;
            saveBtn.innerHTML = '💾 Save & Connect';
          }
        })
        .catch(err => {
          showStatus('Failed: ' + err.message, true);
          saveBtn.disabled = false;
          saveBtn.innerHTML = '💾 Save & Connect';
        });
    }

    // Auto-scan on load
    window.addEventListener('load', () => {
      setTimeout(scanNetworks, 500);
    });
  </script>
</body>
</html>
)HTML";
  return html;
}

void setupWiFi() {
  // Load saved WiFi credentials
  loadWiFiCredentials();

  // Check if we have credentials
  if (strlen(wifiSSID) == 0) {
    // No credentials - start provisioning mode
    startProvisioningMode();
    return;
  }

  // Try to connect to WiFi
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(wifiSSID, wifiPassword);

  // Display WiFi status at Y=230 for better visibility
  int wifiY = 230;
  tft.setCursor(10, wifiY);
  tft.setTextColor(COLOR_TEXT_DIM);
  tft.setTextSize(1);
  tft.print("WiFi: ");

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < WIFI_CONNECT_ATTEMPTS) {
    delay(WIFI_CONNECT_DELAY_MS);
    tft.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    tft.println("OK");
    tft.setCursor(10, wifiY + 18);
    tft.print("IP: ");
    tft.println(WiFi.localIP());
    wifiWasConnected = true;

    // Disable WiFi power saving for stable WebSocket connection
    WiFi.setSleep(false);

    // HTTP server setup
    server.on("/status", HTTP_POST, handleStatus);
    server.on("/status", HTTP_GET, handleStatusGet);
    server.on("/health", HTTP_GET, handleHealth);
    server.on("/lock", HTTP_POST, handleLock);
    server.on("/unlock", HTTP_POST, handleUnlock);
    server.on("/lock-mode", HTTP_GET, handleLockModeGet);
    server.on("/lock-mode", HTTP_POST, handleLockModePost);
    server.on("/reboot", HTTP_POST, handleReboot);

    // Add WiFi reset endpoint
    server.on("/wifi-reset", HTTP_POST, []() {
      preferences.begin("vibemon", false);
      preferences.remove("wifiSSID");
      preferences.remove("wifiPassword");
      preferences.end();
      server.send(200, "application/json", "{\"success\":true,\"message\":\"WiFi credentials cleared. Rebooting...\"}");
      delay(1000);
      ESP.restart();
    });

    server.begin();
  } else {
    tft.println("Failed");

    // Connection failed - clear credentials and start provisioning
    tft.setCursor(10, wifiY + 18);
    tft.println("Starting setup...");
    delay(WIFI_FAIL_RESTART_MS);

    preferences.begin("vibemon", false);
    preferences.remove("wifiSSID");
    preferences.remove("wifiPassword");
    preferences.end();

    ESP.restart();
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
  buildStatusJson(response, sizeof(response));
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

// Monitor WiFi connection and recover if dropped
void checkWiFiConnection() {
  unsigned long now = millis();
  if (now - lastWifiCheck < WIFI_CHECK_INTERVAL) return;
  lastWifiCheck = now;

  bool currentlyConnected = (WiFi.status() == WL_CONNECTED);

  if (!currentlyConnected && wifiWasConnected) {
    // WiFi just dropped
    wifiWasConnected = false;
    drawConnectionIndicator();
    Serial.print("{\"wifi\":\"disconnected\",\"heap\":");
    Serial.print(ESP.getFreeHeap());
    Serial.println("}");
  } else if (currentlyConnected && !wifiWasConnected) {
    // WiFi recovered
    wifiWasConnected = true;
    drawConnectionIndicator();
    Serial.print("{\"wifi\":\"reconnected\",\"ip\":\"");
    Serial.print(WiFi.localIP());
    Serial.print("\",\"heap\":");
    Serial.print(ESP.getFreeHeap());
    Serial.println("}");
#ifdef USE_WEBSOCKET
    // Reset backoff and restart WebSocket after WiFi recovery
    wsReconnectDelay = WS_RECONNECT_INITIAL;
    webSocket.disconnect();
    setupWebSocket();
#endif
  }
}

#ifdef USE_WEBSOCKET
void setupWebSocket() {
  // Load token from preferences if not already loaded
  if (strlen(wsToken) == 0) {
    loadWebSocketToken();
  }

  // Build path with token query parameter for API Gateway authentication
  char wsPath[256];
  if (strlen(wsToken) > 0) {
    snprintf(wsPath, sizeof(wsPath), "%s?token=%s", WS_PATH, wsToken);
  } else {
    safeCopyStr(wsPath, WS_PATH);
  }

  // Connect to WebSocket server
#if WS_USE_SSL
  webSocket.beginSSL(WS_HOST, WS_PORT, wsPath);
#else
  webSocket.begin(WS_HOST, WS_PORT, wsPath);
#endif

  // Set event handler
  webSocket.onEvent(webSocketEvent);

  // Set initial reconnect interval (adjusted by exponential backoff)
  webSocket.setReconnectInterval(wsReconnectDelay);

  // Enable heartbeat to detect stale connections
  // Ping every 15s, timeout after 3s, disconnect after 2 missed pongs
  webSocket.enableHeartbeat(WS_HEARTBEAT_INTERVAL, WS_HEARTBEAT_TIMEOUT, WS_HEARTBEAT_FAILURES);

  Serial.print("{\"websocket\":\"connecting\",\"heap\":");
  Serial.print(ESP.getFreeHeap());
  Serial.println("}");
}

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      wsConnected = false;
      drawConnectionIndicator();
      // Exponential backoff: increase delay for next reconnection
      {
        unsigned long newDelay = (unsigned long)(wsReconnectDelay * WS_RECONNECT_MULTIPLIER);
        wsReconnectDelay = (newDelay > WS_RECONNECT_MAX) ? WS_RECONNECT_MAX : newDelay;
      }
      webSocket.setReconnectInterval(wsReconnectDelay);
      Serial.print("{\"websocket\":\"disconnected\",\"nextRetry\":");
      Serial.print(wsReconnectDelay);
      Serial.print(",\"heap\":");
      Serial.print(ESP.getFreeHeap());
      Serial.println("}");
      break;

    case WStype_CONNECTED:
      wsConnected = true;
      drawConnectionIndicator();
      // Reset backoff on successful connection
      wsReconnectDelay = WS_RECONNECT_INITIAL;
      webSocket.setReconnectInterval(wsReconnectDelay);
      Serial.print("{\"websocket\":\"connected\",\"url\":\"");
      Serial.print((char*)payload);
      Serial.print("\",\"heap\":");
      Serial.print(ESP.getFreeHeap());
      Serial.println("}");

      // Send authentication message if token is configured
      if (strlen(wsToken) > 0) {
        char authMsg[128];
        snprintf(authMsg, sizeof(authMsg), "{\"type\":\"auth\",\"token\":\"%s\"}", wsToken);
        webSocket.sendTXT(authMsg);
        Serial.println("{\"websocket\":\"auth_sent\"}");
      }
      break;

    case WStype_TEXT:
      // Process received message (same as Serial/HTTP input)
      processInput((char*)payload);
      break;

    case WStype_ERROR:
      Serial.print("{\"websocket\":\"error\",\"heap\":");
      Serial.print(ESP.getFreeHeap());
      Serial.println("}");
      break;

    default:
      break;
  }
}
#endif
#endif
