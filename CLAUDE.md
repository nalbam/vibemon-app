# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Real-time status monitor for AI assistants (Claude Code, Kiro, OpenClaw) with pixel art character.

**Platforms:**
- ESP32 Hardware (172×320 LCD) - Primary, always-on desk companion
- Desktop App (Electron) - Alternative for non-hardware users
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
- **Desktop**: `main.js` (entry point), `modules/*.cjs` (http-server, multi-window-manager, tray-manager, state-manager, validators, http-utils), `renderer.js` + `index.html` (renderer)
- **Shared**: `desktop/shared/` folder (config, character, animation, effects)
- **Config Data**: `desktop/shared/data/` folder (JSON files - single source of truth)
  - `constants.json`: Window dimensions, animation settings, limits
  - `states.json`: State colors, text, eyeType definitions
  - `characters.json`: Character eyes/effect configuration (image-based rendering)
  - `texts.json`: Thinking/planning/tool status texts
- **Documentation**: `README.md`, `CLAUDE.md`, `docs/*`, `desktop/README.md` (npm package)

## Key Patterns

- **State-based rendering**: `state` → color, eyeType, text
- **Animation**: `animFrame % N` approach (100ms tick)
- **Floating**: Cosine/Sine wave offset (X: ±3px, Y: ±5px, ~3.2s cycle)
- **Working text**: Tool-based random selection via `getWorkingText(tool)`
- **JSON fields**: `{"state", "tool", "project", "model", "memory", "character", "terminalId"}`
- **Characters**: `clawd` (orange), `kiro` (white ghost), `claw` (red)
- **Memory hidden on start**: Memory not displayed during `start` state
- **Project change resets**: Model/memory cleared when project changes
- **Matrix rain (working)**: Movie-style effect with flicker head, gradient tail, variable speed (1-6)
- **Sunglasses (working)**: Matrix-style dark green sunglasses with frame and shine
- **Loading dots speed**: Thinking state uses 3x slower animation than working state
- **Snap to corner**: Window snaps to screen corners when dragged within 30px of edges (150ms debounce)
- **Window close timer**: Desktop window auto-closes after 10min in sleep state; reopens on new status
- **Click to focus terminal**: Click window to switch to corresponding iTerm2 or Ghostty tab (macOS only, uses `terminalId` from `ITERM_SESSION_ID` or `GHOSTTY_PID`)
- **State-based always on top**: Active states (thinking, planning, working, packing, notification) keep window on top; inactive states (start, idle, done, sleep) disable always on top to reduce screen obstruction
- **Always on Top Modes**: `active-only` (default), `all`, `disabled` - configurable via system tray menu
- **Always on Top**: Active states enable on top immediately; inactive states disable on top immediately (no grace period, prevents focus stealing)

## Window Mode

Two modes available (`multi` or `single`):
- **Multi mode** (default): Each project gets own window (max 5)
- **Single mode**: One window, reused for each project; supports project lock

### Multi-Window Mode
- Windows arranged by state and name: active states (right) → inactive states (left), sorted by name descending (Z first = rightmost) within each group
- Max 5 windows (or screen limit)
- Auto-rearranges when state changes or window closes
- 10px gap between windows
- System tray shows up to 10 projects in menu

### API Endpoints

| Endpoint | Platform | Description |
|----------|----------|-------------|
| `POST /status` | All | Create/update window for project |
| `GET /status` | All | Returns current state |
| `GET /health` | All | Health check |
| `POST /lock` | All | Lock to project |
| `POST /unlock` | All | Unlock project |
| `GET /lock-mode` | All | Get current lock mode |
| `POST /lock-mode` | All | Set lock mode |
| `GET /windows` | Desktop | List all active windows |
| `POST /close` | Desktop | Close specific project window |
| `POST /show` | Desktop | Show window |
| `GET /window-mode` | Desktop | Get current window mode (multi/single) |
| `POST /window-mode` | Desktop | Set window mode |
| `GET /debug` | Desktop | Window/display debug info |
| `GET /stats` | Desktop | Stats dashboard page |
| `GET /stats/data` | Desktop | Stats data from cache |
| `POST /quit` | Desktop | Quit application |
| `POST /reboot` | ESP32 | Reboot device |

## States

| State | Color | Description |
|-------|-------|-------------|
| `start` | Cyan | Session begins |
| `idle` | Green | Waiting for input |
| `thinking` | Purple | Processing prompt |
| `planning` | Teal | Plan mode active |
| `working` | Blue | Tool executing |
| `packing` | Gray | Context compacting |
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

# ESP32 Serial (macOS)
echo '{"state":"working","tool":"Bash","project":"my-project"}' > /dev/cu.usbmodem1101

# ESP32 Serial (Raspberry Pi / Linux)
stty -F /dev/ttyACM0 115200  # Set baud rate first (required)
echo '{"state":"working","tool":"Bash","project":"my-project"}' > /dev/ttyACM0
```

## Important Notes

- ESP32: Uses LovyanGFX library with `LGFX_ESP32C6.hpp` configuration (TFT_eSPI not required)
- JSON payload must end with LF (`\n`)
- WiFi mode: Create `credentials.h` from example, uncomment `#define USE_WIFI` in credentials.h
