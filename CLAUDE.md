# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Real-time status and usage monitor for Claude Code with pixel art character. Displays state, project, tool, model, and memory usage. Supports 6 states: session_start, idle, working, notification, tool_done, and sleep.

**Platforms:**
- Desktop App (Electron) - Primary, recommended for daily use
- ESP32 Hardware (172×320 LCD) - Dedicated display device
- Web Simulator - Browser-based testing

## Development Environment

### Desktop App
```bash
cd desktop
npm install
npm start
```

### ESP32 Firmware
1. Install Arduino IDE
2. Add ESP32 board manager: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
3. Install libraries: `TFT_eSPI` (Bodmer), `ArduinoJson` (Benoit Blanchon)
4. Copy `User_Setup.h` to library folder:
   ```bash
   cp User_Setup.h ~/Documents/Arduino/libraries/TFT_eSPI/User_Setup.h
   ```
5. Upload via Arduino IDE (ESP32C6 Dev Module)

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

- **vibe-monitor.ino**: Main loop, communication (Serial/WiFi), state management
- **sprites.h**: Rendering logic - character, eyes, animations, color/text mapping

### Desktop App Architecture

```
┌─────────────────────────────────────────────────────┐
│                  main.js (Electron)                 │
│  ┌─────────────┐  ┌────────────┐  ┌─────────────┐  │
│  │ HTTP Server │→│ updateState│→│   IPC Send   │  │
│  │  (19280)    │  └────────────┘  └──────┬──────┘  │
│  └─────────────┘                         │        │
│  ┌─────────────┐                         ↓        │
│  │ System Tray │  ┌─────────────────────────────┐  │
│  │ (canvas)    │  │    index.html (Renderer)    │  │
│  └─────────────┘  │  state → canvas → animation │  │
│                   └─────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

- **main.js**: HTTP server, window management, system tray (uses `canvas` for tray icons)
- **index.html**: Character rendering, animations (mirrors simulator logic)

### Key Patterns
- State-based rendering: `state` value determines color, eyeType, text
- Animation: `animFrame % N` approach (100ms tick, frame-independent)
- Floating animation: Cosine/Sine wave based offset (X: ±3px, Y: ±5px, ~3.2s cycle) via `getFloatOffsetX()` and `getFloatOffsetY()`
- Working state text: Tool-based random selection via `getWorkingText(tool)` - case-insensitive tool matching, each tool has 3 possible text variants
- JSON communication: Fields `{"state", "event", "tool", "project", "model", "memory"}`

## Testing

### Web Simulator (No hardware required)
```bash
open simulator/index.html
# Or: https://nalbam.github.io/vibe-monitor/simulator/
```

### Hardware Testing (USB Serial)
```bash
# Test idle state
echo '{"state":"idle","event":"Stop","tool":"","project":"test","model":"opus","memory":"45%"}' > /dev/cu.usbmodem1101

# Test working state
echo '{"state":"working","event":"PreToolUse","tool":"Bash","project":"test","model":"opus","memory":"50%"}' > /dev/cu.usbmodem1101
```

## Important Notes

- `User_Setup.h` must be copied to TFT_eSPI library folder (project file is ignored)
- JSON payload must end with LF (`\n`)
- WiFi mode: Uncomment `#define USE_WIFI` in .ino file and set SSID/Password
