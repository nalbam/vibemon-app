# Claude Monitor

Real-time status and usage monitor for Claude Code with pixel art character.

Monitor your Claude Code sessions at a glance - see what state it's in, which project and tool it's using, what model is active, and how much context memory is consumed.

## What It Monitors

| Field | Description | Example |
|-------|-------------|---------|
| **State** | Current Claude Code activity state | `working`, `idle`, `notification` |
| **Project** | Active project directory name | `claude-monitor` |
| **Tool** | Currently executing tool | `Bash`, `Read`, `Edit` |
| **Model** | Active Claude model | `Opus 4.5`, `Sonnet` |
| **Memory** | Context window usage percentage | `45%` |

## Platforms

| Platform | Description | Best For |
|----------|-------------|----------|
| **Desktop App** | Electron app with system tray | Daily use, always-visible monitoring |
| **ESP32 Hardware** | Dedicated LCD display device | Desk companion, hardware enthusiasts |
| **Web Simulator** | Browser-based preview | Testing, development, no installation |

## Preview

![Working State on macOS](screenshots/working.png)

```
┌────────────────────┐
│                    │
│    ┌──────────┐    │
│    │██████████│    │
│  ██│█ ■    ■ █│██  │  ← Claude character
│    │██████████│    │     (128x128 pixels)
│    └─┬─┬──┬─┬─┘    │
│      │█│  │█│      │
├────────────────────┤
│     Working        │  ← Status text
│     ● ● ● ○        │  ← Loading animation
├────────────────────┤
│ 📂 my-project      │  ← Project name
│ 🛠️ Bash            │  ← Current tool
│ 🤖 Opus 4.5        │  ← Model
│ 🧠 45%             │  ← Memory usage
│ ████████░░░░░░░░░░ │  ← Memory bar (gradient)
└────────────────────┘
```

## Quick Start

### Desktop App (Recommended)

```bash
cd desktop
npm install
npm start
```

The app runs in the system tray and listens on `http://127.0.0.1:19280`.

### Web Simulator

No installation required - just open in browser:

**Online**: https://nalbam.github.io/claude-monitor/simulator/

**Local**:
```bash
open simulator/index.html
```

### ESP32 Hardware

See [ESP32 Setup](#esp32-setup) section below.

## Claude Code Integration

Claude Monitor integrates with Claude Code through hooks.

### How It Works

```
Claude Code → Hooks → Claude Monitor
     │                      │
     └── Events ──────────→ Display
         (state, tool,      (Desktop App,
          project, etc.)     ESP32, or both)
```

### Hook Setup

**1. Copy hook script:**

```bash
cp hooks/claude-monitor.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/claude-monitor.sh
```

**2. Copy environment sample:**

```bash
cp hooks/.env.sample ~/.claude/.env.local
```

**3. Edit `~/.claude/.env.local`:**

```bash
# Desktop App path (auto-launches on SessionStart if not running)
export CLAUDE_MONITOR_DESKTOP="~/claude-monitor/desktop"

# Desktop App URL (sends status updates)
export CLAUDE_MONITOR_URL="http://127.0.0.1:19280"

# ESP32 USB Serial port (optional)
export ESP32_SERIAL_PORT="/dev/cu.usbmodem1101"

# ESP32 WiFi HTTP (optional)
# export ESP32_HTTP_URL="http://192.168.1.100"
```

**4. Register hook in `~/.claude/settings.json`:**

```json
{
  "hooks": {
    "SessionStart": [{ "command": "~/.claude/hooks/claude-monitor.sh" }],
    "PreToolUse": [{ "command": "~/.claude/hooks/claude-monitor.sh" }],
    "PostToolUse": [{ "command": "~/.claude/hooks/claude-monitor.sh" }],
    "Notification": [{ "command": "~/.claude/hooks/claude-monitor.sh" }],
    "Stop": [{ "command": "~/.claude/hooks/claude-monitor.sh" }]
  }
}
```

### Hook Priority

The hook sends status updates in order (only if configured):
1. **Desktop App** - if `CLAUDE_MONITOR_URL` is set (auto-launches via `CLAUDE_MONITOR_DESKTOP` on SessionStart)
2. **ESP32 USB Serial** - if `ESP32_SERIAL_PORT` is set
3. **ESP32 HTTP** - if `ESP32_HTTP_URL` is set

## State Display

| State | Background | Eyes | Text | Trigger |
|-------|------------|------|------|---------|
| `session_start` | Cyan | ■ ■ + ✦ | Hello! | Session begins |
| `idle` | Green | ■ ■ | Ready | Waiting for input |
| `working` | Blue | ▬ ▬ | (tool-based) | Tool executing |
| `notification` | Yellow | ● ● + ? | Input? | User input needed |
| `tool_done` | Green | ∨ ∨ | Done! | Tool completed |
| `sleep` | Navy | ─ ─ + Z | Zzz... | 10min inactivity |

### Working State Text

The `working` state displays context-aware text based on the active tool:

| Tool | Possible Text |
|------|---------------|
| Bash | Running, Executing, Processing |
| Read | Reading, Scanning, Checking |
| Edit | Editing, Modifying, Fixing |
| Write | Writing, Creating, Saving |
| Grep | Searching, Finding, Looking |
| Glob | Scanning, Browsing, Finding |
| Task | Thinking, Working, Planning |
| WebFetch | Fetching, Loading, Getting |
| WebSearch | Searching, Googling, Looking |
| Default | Working, Busy, Coding |

### Animations

- **Floating**: All states have gentle floating motion (±3px horizontal, ±5px vertical, ~3.2s cycle)
- **Blink**: Idle state blinks every 3 seconds
- **Loading dots**: Working state shows animated progress dots
- **Sparkle**: Session start shows rotating sparkle effect
- **Zzz**: Sleep state shows blinking Z animation

### Sleep Mode

Automatically transitions to `sleep` after 10 minutes of inactivity from `idle` or `tool_done`. Any new status update wakes the display.

## HTTP API

Both Desktop App (port 19280) and ESP32 WiFi mode (port 80) support the same API.

### POST /status

Update monitor status.

```bash
curl -X POST http://127.0.0.1:19280/status \
  -H "Content-Type: application/json" \
  -d '{"state":"working","tool":"Bash","project":"my-project","model":"opus","memory":"45%"}'
```

**Request Body:**
```json
{
  "state": "working",
  "event": "PreToolUse",
  "tool": "Bash",
  "project": "my-project",
  "model": "opus",
  "memory": "45%"
}
```

### GET /status

Get current status.

```bash
curl http://127.0.0.1:19280/status
```

**Response:**
```json
{
  "state": "working",
  "project": "my-project",
  "tool": "Bash",
  "model": "opus",
  "memory": "45%"
}
```

### GET /health

Health check endpoint.

```bash
curl http://127.0.0.1:19280/health
```

### POST /show (Desktop only)

Show window and position to top-right corner.

```bash
curl -X POST http://127.0.0.1:19280/show
```

### GET /debug (Desktop only)

Get display and window debug information.

```bash
curl http://127.0.0.1:19280/debug
```

## Desktop App

### Features

- **Frameless window**: Clean floating design
- **Always on Top**: Stays visible above other windows
- **System Tray**: Quick access from menubar/taskbar
- **Platform icons**: Emoji on macOS, pixel art on Windows/Linux
- **Draggable**: Move window anywhere on screen

### System Tray Menu

- View current state
- Manually change state
- Toggle Always on Top
- Show/Hide window
- Quit application

### Build

```bash
cd desktop

# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux

# All platforms
npm run build:all
```

See [desktop/README.md](desktop/README.md) for WSL setup and troubleshooting.

## ESP32 Setup

### Hardware

- **Board**: ESP32-C6-LCD-1.47 (172x320, ST7789V2)
- **Connection**: USB-C (Serial) or WiFi

### Arduino IDE Setup

1. **Add ESP32 Board Manager**
   - File → Preferences → Additional Board Manager URLs:
   - `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`

2. **Install ESP32 Board**
   - Tools → Board → Boards Manager → Search "esp32" → Install

3. **Install Libraries**
   - Tools → Manage Libraries:
   - `TFT_eSPI` by Bodmer
   - `ArduinoJson` by Benoit Blanchon

4. **Configure TFT_eSPI**
   - Copy `User_Setup.h` to Arduino library folder:
   - `cp User_Setup.h ~/Documents/Arduino/libraries/TFT_eSPI/User_Setup.h`

5. **Upload**
   - Tools → Board → ESP32C6 Dev Module
   - Tools → Port → /dev/cu.usbmodem* (or appropriate port)
   - Click Upload

### WiFi Mode (Optional)

Edit `claude-monitor.ino`:

```cpp
#define USE_WIFI
const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";
```

### Serial Port Check

```bash
# macOS
ls /dev/cu.*

# Linux
ls /dev/ttyUSB* /dev/ttyACM*
```

### Testing

```bash
# Test working state
echo '{"state":"working","tool":"Bash","project":"test","model":"opus","memory":"50%"}' > /dev/cu.usbmodem1101

# Test idle state
echo '{"state":"idle","project":"test","model":"opus","memory":"45%"}' > /dev/cu.usbmodem1101
```

## Troubleshooting

### Desktop App

| Issue | Solution |
|-------|----------|
| Window not appearing | Check system tray for app icon, or run `curl -X POST http://127.0.0.1:19280/show` |
| Port already in use | Another instance may be running. Check with `lsof -i :19280` |

### ESP32

| Issue | Solution |
|-------|----------|
| Display not working | Verify `User_Setup.h` is copied to TFT_eSPI library folder |
| Serial connection failed | Check port permissions: `sudo chmod 666 /dev/ttyUSB0` |
| JSON parsing error | Ensure JSON ends with LF (`\n`) |

## File Structure

```
claude-monitor/
├── README.md                   # This document
├── CLAUDE.md                   # AI development guidelines
├── claude-monitor.ino          # ESP32 main firmware
├── sprites.h                   # Character rendering
├── User_Setup.h                # TFT display configuration
├── hooks/                      # Claude Code hooks
│   ├── claude-monitor.sh       # Hook script
│   └── .env.sample             # Environment sample
├── desktop/                    # Desktop app
│   ├── main.js                 # Electron main process
│   ├── index.html              # Renderer
│   ├── preload.js              # IPC bridge
│   ├── package.json            # Dependencies
│   ├── README.md               # Desktop-specific docs
│   └── assets/                 # App icons
└── simulator/                  # Web simulator
    └── index.html              # Browser testing
```

## Version History

- **v2.1**: Desktop app with system tray, memory bar gradient
- **v2.0**: Pixel art character (128x128), web simulator
- **v1.0**: Circular status display
