# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Real-time status monitor for AI coding assistants (Claude Code, Kiro IDE/CLI) with pixel art character.

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

### Web Simulator
```bash
open simulator/index.html
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              Main Loop (ESP32/.ino)                 │
│  Serial/WiFi → JSON Parse → State Update → Render   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│              Desktop App (Electron)                 │
│  HTTP Server (19280) → IPC → Renderer (canvas)      │
│  System Tray (canvas for icons)                     │
└─────────────────────────────────────────────────────┘
```

### Key Files
- **ESP32**: `vibe-monitor.ino` (main), `sprites.h` (rendering)
- **Desktop**: `main.js` (server/tray), `index.html` (renderer)
- **Shared**: `shared/` folder (config, character, sprites, effects)

## Key Patterns

- **State-based rendering**: `state` → color, eyeType, text
- **Animation**: `animFrame % N` approach (100ms tick)
- **Floating**: Cosine/Sine wave offset (X: ±3px, Y: ±5px, ~3.2s cycle)
- **Working text**: Tool-based random selection via `getWorkingText(tool)`
- **JSON fields**: `{"state", "event", "tool", "project", "model", "memory", "character"}`
- **Characters**: `clawd` (orange), `kiro` (white ghost)

## States

| State | Color | Description |
|-------|-------|-------------|
| `session_start` | Cyan | Session begins |
| `idle` | Green | Waiting for input |
| `thinking` | Purple | Processing prompt |
| `working` | Blue | Tool executing |
| `notification` | Yellow | User input needed |
| `tool_done` | Green | Tool completed |
| `sleep` | Navy | 10min inactivity |

## Testing

```bash
# Desktop App API
curl -X POST http://127.0.0.1:19280/status \
  -H "Content-Type: application/json" \
  -d '{"state":"working","tool":"Bash","project":"test"}'

# ESP32 Serial
echo '{"state":"working","tool":"Bash"}' > /dev/cu.usbmodem1101
```

## Important Notes

- ESP32: `User_Setup.h` must be copied to TFT_eSPI library folder
- JSON payload must end with LF (`\n`)
- WiFi mode: Uncomment `#define USE_WIFI` in .ino file
