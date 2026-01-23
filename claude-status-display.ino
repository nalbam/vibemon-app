/*
 * Claude Code Status Display
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
#define CHAR_X        22   // (172 - 128) / 2 = 22
#define CHAR_Y        20
#define STATUS_TEXT_Y 160
#define LOADING_Y     195
#define PROJECT_Y     235
#define TOOL_Y        255
#define BRAND_Y       295

// State
String currentState = "idle";
String previousState = "";
String currentProject = "";
String currentTool = "";
unsigned long lastUpdate = 0;
unsigned long lastBlink = 0;
int animFrame = 0;
bool needsRedraw = true;

void setup() {
  Serial.begin(115200);

  // TFT init
  tft.init();
  tft.setRotation(0);  // Portrait mode
  tft.fillScreen(TFT_BLACK);

  // Start screen
  drawStartScreen();

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

  // Redraw if state changed
  if (currentState != previousState) {
    needsRedraw = true;
    drawStatus();
  }
}

void drawStartScreen() {
  uint16_t bgColor = TFT_BLACK;
  tft.fillScreen(bgColor);

  // Draw character in idle state (128x128)
  drawCharacter(tft, CHAR_X, CHAR_Y, EYE_NORMAL, bgColor);

  // Title
  tft.setTextColor(COLOR_TEXT_WHITE);
  tft.setTextSize(2);
  tft.setCursor(20, STATUS_TEXT_Y);
  tft.println("Claude Code");

  tft.setTextSize(1);
  tft.setTextColor(COLOR_TEXT_DIM);
  tft.setCursor(30, STATUS_TEXT_Y + 30);
  tft.println("Status Display");

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
  String statusText = getStatusText(currentState);

  // Fill background
  tft.fillScreen(bgColor);

  // Draw character (128x128)
  drawCharacter(tft, CHAR_X, CHAR_Y, eyeType, bgColor);

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
    tft.setCursor(10, PROJECT_Y);
    tft.print("Project: ");

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
    tft.setCursor(10, TOOL_Y);
    tft.print("Tool: ");
    tft.println(currentTool);
  }

  // Brand
  tft.setTextColor(textColor);
  tft.setTextSize(1);
  int brandText = 10;
  tft.setCursor(brandText, BRAND_Y);
  tft.println("Claude Code Monitor");

  needsRedraw = false;
}

void updateAnimation() {
  if (currentState == "working") {
    // Update loading dots
    drawLoadingDots(tft, SCREEN_WIDTH / 2, LOADING_Y, animFrame);
  } else if (currentState == "session_start") {
    // Update sparkle animation
    uint16_t bgColor = getBackgroundColor(currentState);
    drawCharacter(tft, CHAR_X, CHAR_Y, EYE_SPARKLE, bgColor);
  }
}

void drawBlinkAnimation() {
  if (currentState != "idle") return;

  uint16_t bgColor = getBackgroundColor(currentState);

  // Close eyes (redraw body area with closed eyes)
  tft.fillRect(CHAR_X + (6 * SCALE), CHAR_Y + (8 * SCALE), 52 * SCALE, 30 * SCALE, COLOR_CLAUDE);
  drawBlinkEyes(tft, CHAR_X, CHAR_Y, 0);  // Closed

  delay(100);

  // Open eyes
  tft.fillRect(CHAR_X + (6 * SCALE), CHAR_Y + (8 * SCALE), 52 * SCALE, 30 * SCALE, COLOR_CLAUDE);
  drawBlinkEyes(tft, CHAR_X, CHAR_Y, 1);  // Open
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
