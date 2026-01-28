# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Real-time status monitor for AI coding assistants (Claude Code, Kiro IDE/CLI) with pixel art character.

**Platforms:**
- Desktop App (Electron) - Primary, recommended for daily use
- ESP32 Hardware (172×320 LCD) - Dedicated display device
- Web Simulator - Browser-based testing/debugging only (not for production)

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
│  HTTP Server (19280) → Multi-Window Manager         │
│        ↓                      ↓                     │
│  System Tray ←── IPC ──→ Multiple Windows (canvas)  │
└─────────────────────────────────────────────────────┘
```

### Key Files
- **ESP32**: `vibe-monitor.ino` (main), `sprites.h` (rendering)
- **Desktop**: `main.js` (server/tray), `multi-window-manager.cjs` (window management), `index.html` (renderer)
- **Shared**: `desktop/shared/` folder (config, character, animation, effects)
- **Config Data**: `desktop/shared/data/` folder (JSON files - single source of truth)
  - `constants.json`: Window dimensions, animation settings, limits
  - `states.json`: State colors, text, eyeType definitions
  - `characters.json`: Character body/eyes/limbs configuration
  - `texts.json`: Thinking/planning/tool status texts

## Key Patterns

- **State-based rendering**: `state` → color, eyeType, text
- **Animation**: `animFrame % N` approach (100ms tick)
- **Floating**: Cosine/Sine wave offset (X: ±3px, Y: ±5px, ~3.2s cycle)
- **Working text**: Tool-based random selection via `getWorkingText(tool)`
- **JSON fields**: `{"state", "event", "tool", "project", "model", "memory", "character", "terminalId"}`
- **Characters**: `clawd` (orange), `kiro` (white ghost)
- **Memory hidden on start**: Memory not displayed during `start` state
- **Project change resets**: Model/memory cleared when project changes
- **Matrix rain (working)**: Movie-style effect with flicker head, gradient tail, variable speed (1-6)
- **Sunglasses (working)**: Matrix-style dark green sunglasses with frame and shine
- **Loading dots speed**: Thinking state uses 3x slower animation than working state
- **Snap to corner**: Window snaps to screen corners when dragged within 30px of edges (150ms debounce)
- **Window close timer**: Desktop window auto-closes after 10min in sleep state; reopens on new status
- **Click to focus terminal**: Click window to switch to corresponding iTerm2 or Ghostty tab (macOS only, uses `terminalId` from `ITERM_SESSION_ID` or `GHOSTTY_PID`)
- **State-based always on top**: Active states (thinking, planning, working, notification) keep window on top; inactive states (start, idle, done, sleep) disable always on top to reduce screen obstruction

## Window Mode

Two modes available (`multi` or `single`):
- **Multi mode** (default): Each project gets own window (max 5)
- **Single mode**: One window, reused for each project; supports project lock

### Multi-Window Mode
- Windows arranged by state and name: active states (right) → inactive states (left), alphabetically within each group
- Max 5 windows (or screen limit)
- Auto-rearranges when state changes or window closes
- 10px gap between windows

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /status` | Create/update window for project |
| `GET /status` | Returns all windows' states |
| `GET /windows` | List all active windows |
| `POST /close` | Close specific project window |
| `POST /show` | Show window (Desktop only) |
| `GET /health` | Health check |
| `GET /window-mode` | Get current window mode (multi/single) |
| `POST /window-mode` | Set window mode |
| `POST /lock` | Lock to project (single mode only) |
| `POST /unlock` | Unlock project (single mode only) |
| `GET /lock-mode` | Get current lock mode |
| `POST /lock-mode` | Set lock mode |
| `GET /debug` | Window/display debug info (Desktop only) |
| `POST /quit` | Quit application (Desktop only) |
| `POST /reboot` | Reboot device (ESP32 only) |

## States

| State | Color | Description |
|-------|-------|-------------|
| `start` | Cyan | Session begins |
| `idle` | Green | Waiting for input |
| `thinking` | Purple | Processing prompt |
| `planning` | Teal | Plan mode active |
| `working` | Blue | Tool executing |
| `notification` | Yellow | User input needed |
| `done` | Green | Tool completed |
| `sleep` | Navy | 5min inactivity |

## Testing

```bash
# Test multiple windows
curl -X POST http://127.0.0.1:19280/status \
  -H "Content-Type: application/json" \
  -d '{"state":"working","project":"project-a"}'

curl -X POST http://127.0.0.1:19280/status \
  -H "Content-Type: application/json" \
  -d '{"state":"thinking","project":"project-b"}'

# List windows
curl http://127.0.0.1:19280/windows

# ESP32 Serial
echo '{"state":"working","tool":"Bash"}' > /dev/cu.usbmodem1101
```

## Important Notes

- ESP32: `User_Setup.h` must be copied to TFT_eSPI library folder
- JSON payload must end with LF (`\n`)
- WiFi mode: Uncomment `#define USE_WIFI` in .ino file
