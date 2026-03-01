/*
 * VibeMon
 * ESP32-C6-LCD-1.47 (172x320, ST7789V2)
 *
 * Pixel art character (128x128) with animated states
 * USB Serial + HTTP support
 */

// =============================================================================
// External Libraries
// =============================================================================

// Use LovyanGFX instead of TFT_eSPI for ESP32-C6 compatibility
#include "TFT_Compat.h"
#include <ArduinoJson.h>
#include <Preferences.h>

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
// App Modules (order matters: dependency chain)
// =============================================================================

#include "config.h"
#include "sprites.h"
#include "ui_elements.h"
#include "state.h"
#include "display.h"
#include "project_lock.h"
#include "input.h"

#ifdef USE_WIFI
#include "wifi_portal.h"
#include "wifi_manager.h"
#endif

// =============================================================================
// setup() & loop()
// =============================================================================

void setup() {
  Serial.begin(115200);

  // Reduce CPU frequency to 80MHz (sufficient for animation/WiFi, reduces heat)
  setCpuFrequencyMhz(80);

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
  // === INPUT PROCESSING ===

  // USB Serial check (using char buffer instead of String)
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      if (serialOverflow) {
        Serial.println("{\"error\":\"input too long\"}");
        serialOverflow = false;
      } else {
        serialBuffer[serialBufferPos] = '\0';
        if (serialBufferPos > 0) {
          processInput(serialBuffer);
        }
      }
      serialBufferPos = 0;
    } else if (serialBufferPos < (int)sizeof(serialBuffer) - 1) {
      serialBuffer[serialBufferPos++] = c;
    } else {
      serialOverflow = true;
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

  // === STATE MANAGEMENT ===

  // Check sleep timer (may set dirty flags via transitionToState)
  checkSleepTimer();

  // === RENDERING ===

  // Full screen redraw if state/info changed (centralized rendering)
  if (needsRedraw || dirtyCharacter || dirtyStatus || dirtyInfo) {
    drawStatus();
  }

  // Animation update (100ms interval)
  if (millis() - lastUpdate > 100) {
    lastUpdate = millis();
    animFrame = (animFrame + 1) % ANIM_FRAME_WRAP;
    updateAnimation();
  }

  // Idle blink (non-blocking state machine)
  updateBlink();

  // Yield to FreeRTOS: prevents 100% CPU spin, dramatically reduces heat.
  // Sleep state uses longer delay since updates are infrequent.
  delay(currentState == STATE_SLEEP ? 20 : 5);
}
