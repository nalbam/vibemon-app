# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ESP32 firmware that displays Claude Code's status in real-time using a pixel art character on a 172×320 LCD. Supports 5 states: idle, working, notification, session_start, and tool_done.

## Development Environment

### Prerequisites
1. Install Arduino IDE
2. Add ESP32 board manager: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
3. Install libraries: `TFT_eSPI` (Bodmer), `ArduinoJson` (Benoit Blanchon)
4. **Important**: Copy `User_Setup.h` to library folder:
   ```bash
   cp User_Setup.h ~/Documents/Arduino/libraries/TFT_eSPI/User_Setup.h
   ```

### Build & Upload
```bash
# In Arduino IDE:
# 1. Tools → Board → ESP32C6 Dev Module
# 2. Tools → Port → /dev/cu.usbmodem* (or appropriate port)
# 3. Click Upload button
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Main Loop (.ino)                  │
│  ┌─────────────┐  ┌────────────┐  ┌─────────────┐  │
│  │ Serial/WiFi │→│ JSON Parse │→│ State Update │  │
│  │   Input     │  │ (ArduinoJson)│  └──────┬──────┘  │
│  └─────────────┘  └────────────┘           │        │
│                                            ↓        │
│  ┌─────────────────────────────────────────────┐   │
│  │           sprites.h (Rendering)              │   │
│  │  state → color/eyeType/text → drawCharacter()│   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

- **claude-monitor.ino**: Main loop, communication (Serial/WiFi), state management
- **sprites.h**: Rendering logic - character, eyes, animations, color/text mapping

### Key Patterns
- State-based rendering: `state` value determines color, eyeType, text
- Animation: `animFrame % N` approach (100ms tick, frame-independent)
- JSON communication: Required fields `{"state", "event", "tool", "project"}`

## Testing

### Web Simulator (No hardware required)
```bash
open simulator/index.html
# Or: https://nalbam.github.io/claude-monitor/simulator/
```

### Hardware Testing (USB Serial)
```bash
# Test idle state
echo '{"state":"idle","event":"Stop","tool":"","project":"test"}' > /dev/cu.usbmodem1101

# Test working state
echo '{"state":"working","event":"PreToolUse","tool":"Bash","project":"test"}' > /dev/cu.usbmodem1101
```

## Important Notes

- `User_Setup.h` must be copied to TFT_eSPI library folder (project file is ignored)
- JSON payload must end with LF (`\n`)
- WiFi mode: Uncomment `#define USE_WIFI` in .ino file and set SSID/Password
