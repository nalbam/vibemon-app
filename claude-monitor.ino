/*
 * Claude Monitor
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
#define MEMORY_BAR_Y  280
#define MEMORY_BAR_W  152
#define MEMORY_BAR_H  8

// State
String currentState = "idle";
String previousState = "";
String currentProject = "";
String currentTool = "";
String currentModel = "";
String currentMemory = "";
unsigned long lastUpdate = 0;
unsigned long lastBlink = 0;
int animFrame = 0;
bool needsRedraw = true;
int lastCharX = CHAR_X_BASE;  // Track last character X for efficient redraw
int lastCharY = CHAR_Y_BASE;  // Track last character Y for efficient redraw

// Sleep timer (10 minutes = 600000 ms)
#define SLEEP_TIMEOUT 600000
unsigned long lastActivityTime = 0;

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

void loop() {
  // USB Serial check
  if (Serial.available()) {
    String input = Serial.readStringUntil('\n');
    processInput(input);
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
  if (currentState == "idle" && millis() - lastBlink > 3000) {
    lastBlink = millis();
    drawBlinkAnimation();
  }

  // Check sleep timer (only from idle or tool_done)
  checkSleepTimer();
}

// Check if should transition to sleep state
void checkSleepTimer() {
  if (currentState == "idle" || currentState == "tool_done") {
    if (millis() - lastActivityTime >= SLEEP_TIMEOUT) {
      previousState = currentState;
      currentState = "sleep";
      needsRedraw = true;
      drawStatus();
    }
  }
}

void processInput(String input) {
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, input);

  if (error) {
    Serial.println("JSON parse error");
    return;
  }

  previousState = currentState;
  currentState = doc["state"].as<String>();
  currentProject = doc["project"].as<String>();
  currentTool = doc["tool"].as<String>();
  currentModel = doc["model"].as<String>();
  currentMemory = doc["memory"].as<String>();

  // Reset sleep timer on any input
  lastActivityTime = millis();

  // Redraw if state changed
  if (currentState != previousState) {
    needsRedraw = true;
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
  drawCharacter(tft, CHAR_X_BASE, CHAR_Y_BASE, EYE_NORMAL, bgColor);

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
  uint16_t bgColor = getBackgroundColor(currentState);
  uint16_t textColor = getTextColor(currentState);
  EyeType eyeType = getEyeType(currentState);
  String statusText = getStatusText(currentState, currentTool);

  // Fill background
  tft.fillScreen(bgColor);

  // Calculate floating position
  int charX = CHAR_X_BASE + getFloatOffsetX();
  int charY = CHAR_Y_BASE + getFloatOffsetY();
  lastCharX = charX;
  lastCharY = charY;

  // Draw character (128x128)
  drawCharacter(tft, charX, charY, eyeType, bgColor);

  // Status text (color based on background)
  tft.setTextColor(textColor);
  tft.setTextSize(3);
  int textWidth = statusText.length() * 18;
  int textX = (SCREEN_WIDTH - textWidth) / 2;
  tft.setCursor(textX, STATUS_TEXT_Y);
  tft.println(statusText);

  // Loading dots (working state only)
  if (currentState == "working") {
    drawLoadingDots(tft, SCREEN_WIDTH / 2, LOADING_Y, animFrame);
  }

  // Project name
  if (currentProject.length() > 0) {
    tft.setTextColor(textColor);
    tft.setTextSize(1);
    drawFolderIcon(tft, 10, PROJECT_Y, textColor);
    tft.setCursor(20, PROJECT_Y);

    String displayProject = currentProject;
    if (displayProject.length() > 16) {
      displayProject = displayProject.substring(0, 13) + "...";
    }
    tft.println(displayProject);
  }

  // Tool name (working state only)
  if (currentTool.length() > 0 && currentState == "working") {
    tft.setTextColor(textColor);
    tft.setTextSize(1);
    drawToolIcon(tft, 10, TOOL_Y, textColor);
    tft.setCursor(20, TOOL_Y);
    tft.println(currentTool);
  }

  // Model name
  if (currentModel.length() > 0) {
    tft.setTextColor(textColor);
    tft.setTextSize(1);
    drawRobotIcon(tft, 10, MODEL_Y, textColor);
    tft.setCursor(20, MODEL_Y);

    String displayModel = currentModel;
    if (displayModel.length() > 14) {
      displayModel = displayModel.substring(0, 11) + "...";
    }
    tft.println(displayModel);
  }

  // Memory usage
  if (currentMemory.length() > 0) {
    tft.setTextColor(textColor);
    tft.setTextSize(1);
    drawBrainIcon(tft, 10, MEMORY_Y, textColor);
    tft.setCursor(20, MEMORY_Y);
    tft.println(currentMemory);

    // Memory bar (below percentage)
    int memoryPercent = currentMemory.toInt();
    drawMemoryBar(tft, MEMORY_BAR_X, MEMORY_BAR_Y, MEMORY_BAR_W, MEMORY_BAR_H, memoryPercent, bgColor);
  }

  needsRedraw = false;
}

void updateAnimation() {
  uint16_t bgColor = getBackgroundColor(currentState);
  EyeType eyeType = getEyeType(currentState);

  // Calculate new floating position
  int newCharX = CHAR_X_BASE + getFloatOffsetX();
  int newCharY = CHAR_Y_BASE + getFloatOffsetY();

  // Only redraw character if position changed
  if (newCharX != lastCharX || newCharY != lastCharY) {
    // Clear previous character area
    tft.fillRect(lastCharX, lastCharY, CHAR_WIDTH, CHAR_HEIGHT, bgColor);
    // Draw character at new position
    drawCharacter(tft, newCharX, newCharY, eyeType, bgColor);
    lastCharX = newCharX;
    lastCharY = newCharY;
  }

  // State-specific animations
  if (currentState == "working") {
    // Update loading dots
    drawLoadingDots(tft, SCREEN_WIDTH / 2, LOADING_Y, animFrame);
  } else if (currentState == "session_start") {
    // Update sparkle animation (redraw for sparkle effect)
    drawCharacter(tft, newCharX, newCharY, EYE_SPARKLE, bgColor);
  } else if (currentState == "sleep") {
    // Update Zzz animation (redraw for blink effect)
    drawCharacter(tft, newCharX, newCharY, EYE_SLEEP, bgColor);
  }
}

void drawBlinkAnimation() {
  if (currentState != "idle") return;

  uint16_t bgColor = getBackgroundColor(currentState);
  int charX = lastCharX;  // Use current floating position
  int charY = lastCharY;

  // Close eyes (redraw body area with closed eyes)
  tft.fillRect(charX + (6 * SCALE), charY + (8 * SCALE), 52 * SCALE, 30 * SCALE, COLOR_CLAUDE);
  drawBlinkEyes(tft, charX, charY, 0);  // Closed

  delay(100);

  // Open eyes
  tft.fillRect(charX + (6 * SCALE), charY + (8 * SCALE), 52 * SCALE, 30 * SCALE, COLOR_CLAUDE);
  drawBlinkEyes(tft, charX, charY, 1);  // Open
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
    processInput(server.arg("plain"));
    server.send(200, "application/json", "{\"ok\":true}");
  } else {
    server.send(400, "application/json", "{\"error\":\"no body\"}");
  }
}
#endif
