# Vibe Monitor

[![npm version](https://img.shields.io/npm/v/vibe-monitor.svg)](https://www.npmjs.com/package/vibe-monitor)
[![npm downloads](https://img.shields.io/npm/dm/vibe-monitor.svg)](https://www.npmjs.com/package/vibe-monitor)
[![license](https://img.shields.io/npm/l/vibe-monitor.svg)](https://github.com/nalbam/vibe-monitor/blob/main/LICENSE)

**Real-time status monitor for AI coding assistants with pixel art character display.**

See at a glance what your AI coding assistant is doing — thinking, writing code, or waiting for input. A cute pixel art character visually represents the current state.

![Demo](https://raw.githubusercontent.com/nalbam/vibe-monitor/main/screenshots/demo.gif)

## Supported Tools

- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** - Anthropic's AI coding assistant
- **[Kiro](https://kiro.dev/)** - AWS's AI coding assistant

## What It Monitors

| Field | Description | Example |
|-------|-------------|---------|
| **State** | Current activity state | `working`, `idle`, `notification` |
| **Project** | Active project directory | `vibe-monitor` |
| **Tool** | Currently executing tool | `Bash`, `Read`, `Edit` |
| **Model** | Active model | `Opus 4.5`, `Sonnet` |
| **Memory** | Context window usage | `45%` |

## Features

- **Frameless Window**: Clean floating design
- **Always on Top**: Always displayed above other windows
- **System Tray**: Quick control from the menu bar
- **Multi-window**: One window per project (up to 5 simultaneous)
- **HTTP API**: Easy integration with hooks
- **Draggable**: Move the window to any position
- **Auto-launch**: Hook scripts auto-start via `npx vibe-monitor` if not running

## Installation

### npx (Recommended)

Run directly without installation:

```bash
npx vibe-monitor@latest
```

### Global Install

```bash
npm install -g vibe-monitor
vibe-monitor
```

### From Source

```bash
git clone https://github.com/nalbam/vibe-monitor.git
cd vibe-monitor/desktop
npm install
npm start
```

## Prerequisites

| Tool | Required | Install |
|------|----------|---------|
| **Python 3** | Yes | Built-in on macOS and most Linux |
| **Node.js** | Yes | `brew install node` (macOS) / `apt install nodejs npm` (Ubuntu) |

## Stop

```bash
curl -X POST http://127.0.0.1:19280/quit

# or
pkill -f vibe-monitor
```

## States

| State | Color | Eyes | Description |
|-------|-------|------|-------------|
| `start` | Cyan | ■ ■ + ✦ | Session begins |
| `idle` | Green | ■ ■ | Waiting for input |
| `thinking` | Purple | ▀ ▀ + 💭 | Processing prompt |
| `planning` | Teal | ▀ ▀ + 💭 | Plan mode active |
| `working` | Blue | 🕶️ | Tool executing |
| `notification` | Yellow | ● ● + ? | User input needed |
| `done` | Green | > < | Done! |
| `sleep` | Navy | ─ ─ + Z | 5min inactivity |

### State Timeout

| From State | Timeout | To State |
|------------|---------|----------|
| `start`, `done` | 1 minute | `idle` |
| `idle`, `notification` | 5 minutes | `sleep` |

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

- **Floating**: Gentle motion (±3px horizontal, ±5px vertical, ~3.2s cycle)
- **Matrix rain**: Working state shows falling green code effect
- **Sunglasses**: Working state character wears Matrix-style sunglasses
- **Thought bubble**: Thinking state shows animated thought bubble

## Characters

| Character | Color | Description | Auto-selected for |
|-----------|-------|-------------|-------------------|
| **clawd** | Orange | Default character | Claude Code |
| **kiro** | White | Ghost character | Kiro |

## IDE Integration

### Claude Code

Claude Code uses **hooks** and **statusline** to send data:

| Source | Data Provided | Description |
|--------|---------------|-------------|
| **Hook** | state, tool, project | Triggered on Claude Code events |
| **Statusline** | model, memory | Continuously updated status bar |

#### 1. Download scripts

```bash
# Create directories
mkdir -p ~/.claude/hooks

# Download hook script
curl -sL https://raw.githubusercontent.com/nalbam/vibe-monitor/main/config/claude/hooks/vibe-monitor.py \
  -o ~/.claude/hooks/vibe-monitor.py
chmod +x ~/.claude/hooks/vibe-monitor.py

# Download statusline script
curl -sL https://raw.githubusercontent.com/nalbam/vibe-monitor/main/config/claude/statusline.py \
  -o ~/.claude/statusline.py
chmod +x ~/.claude/statusline.py

# Download environment sample
curl -sL https://raw.githubusercontent.com/nalbam/vibe-monitor/main/config/claude/.env.sample \
  -o ~/.claude/.env.local
```

#### 2. Add to `~/.claude/settings.json`

```json
{
  "hooks": {
    "SessionStart": [{ "command": "python3 ~/.claude/hooks/vibe-monitor.py" }],
    "UserPromptSubmit": [{ "command": "python3 ~/.claude/hooks/vibe-monitor.py" }],
    "PreToolUse": [{ "command": "python3 ~/.claude/hooks/vibe-monitor.py" }],
    "Notification": [{ "command": "python3 ~/.claude/hooks/vibe-monitor.py" }],
    "Stop": [{ "command": "python3 ~/.claude/hooks/vibe-monitor.py" }]
  },
  "statusLine": {
    "type": "command",
    "command": "python3 ~/.claude/statusline.py"
  }
}
```

#### 3. Configure environment

Edit `~/.claude/.env.local`:

```bash
# Cache file for project metadata (model, memory) - optional
# Default: ~/.claude/statusline-cache.json
# export VIBE_MONITOR_CACHE="~/.claude/statusline-cache.json"

# Desktop App URL (auto-launches via npx if not running)
export VIBE_MONITOR_URL="http://127.0.0.1:19280"

# ESP32 USB Serial port (optional)
# export ESP32_SERIAL_PORT="/dev/cu.usbmodem1101"

# ESP32 WiFi HTTP (optional)
# export ESP32_HTTP_URL="http://192.168.1.100"
```

### Kiro

```bash
# Create directory
mkdir -p ~/.kiro/hooks

# Download hook script
curl -sL https://raw.githubusercontent.com/nalbam/vibe-monitor/main/config/kiro/hooks/vibe-monitor.py \
  -o ~/.kiro/hooks/vibe-monitor.py
chmod +x ~/.kiro/hooks/vibe-monitor.py

# Download hook files
for hook in agent-spawn agent-stop pre-tool-use prompt-submit; do
  curl -sL "https://raw.githubusercontent.com/nalbam/vibe-monitor/main/config/kiro/hooks/vibe-monitor-${hook}.kiro.hook" \
    -o ~/.kiro/hooks/vibe-monitor-${hook}.kiro.hook
done

# Download environment sample (optional)
curl -sL https://raw.githubusercontent.com/nalbam/vibe-monitor/main/config/kiro/.env.sample \
  -o ~/.kiro/.env.local
```

## API

Default HTTP server port: `19280`

### POST /status

Update status:

```bash
curl -X POST http://127.0.0.1:19280/status \
  -H "Content-Type: application/json" \
  -d '{"state":"working","tool":"Bash","project":"my-project"}'
```

**Fields:**

| Field | Description |
|-------|-------------|
| `state` | `start`, `idle`, `thinking`, `planning`, `working`, `notification`, `done`, `sleep` |
| `event` | `SessionStart`, `PreToolUse`, `Stop`, etc. |
| `tool` | Tool name (e.g., `Bash`, `Read`, `Edit`) |
| `project` | Project name |
| `model` | Model name (e.g., `opus`, `sonnet`) |
| `memory` | Memory usage (e.g., `45%`) |
| `character` | `clawd` or `kiro` |

### GET /status

Get all windows' status:

```bash
curl http://127.0.0.1:19280/status
```

**Response:**
```json
{
  "windowCount": 2,
  "projects": {
    "my-project": { "state": "working", "tool": "Bash", "model": "opus" },
    "other-project": { "state": "idle" }
  }
}
```

### GET /windows

List all active windows:

```bash
curl http://127.0.0.1:19280/windows
```

**Response:**
```json
{
  "windowCount": 2,
  "windows": [
    { "project": "my-project", "state": "working", "bounds": {"x": 1748, "y": 23, "width": 172, "height": 348} },
    { "project": "other-project", "state": "idle", "bounds": {"x": 1566, "y": 23, "width": 172, "height": 348} }
  ]
}
```

### POST /close

Close a specific project window:

```bash
curl -X POST http://127.0.0.1:19280/close \
  -H "Content-Type: application/json" \
  -d '{"project":"my-project"}'
```

### GET /health

Health check:

```bash
curl http://127.0.0.1:19280/health
```

### POST /show

Show a specific project window (or first window if no project specified):

```bash
# Show specific project window
curl -X POST http://127.0.0.1:19280/show \
  -H "Content-Type: application/json" \
  -d '{"project":"my-project"}'

# Show first available window
curl -X POST http://127.0.0.1:19280/show
```

### GET /debug

Get display and window debug information:

```bash
curl http://127.0.0.1:19280/debug
```

### POST /quit

Quit application:

```bash
curl -X POST http://127.0.0.1:19280/quit
```

## Tray Menu

Click the system tray icon to:
- View active windows and their states
- Manually change state (per window)
- Switch character (Clawd/Kiro)
- Close individual project windows
- Toggle Always on Top
- Show/Hide windows
- Quit

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Window not appearing | Check system tray icon, or run `curl -X POST http://127.0.0.1:19280/show` |
| Port already in use | Check with `lsof -i :19280` and kill existing process |
| Hook not working | Verify Python 3 is installed: `python3 --version` |

## Build

```bash
npm run build:mac     # macOS (DMG, ZIP)
npm run build:win     # Windows (NSIS, Portable)
npm run build:linux   # Linux (AppImage, DEB)
npm run build:all     # All platforms
```

## Links

- [GitHub Repository](https://github.com/nalbam/vibe-monitor)
- [Web Simulator](https://nalbam.github.io/vibe-monitor/simulator/)
- [ESP32 Hardware Setup (Experimental)](https://github.com/nalbam/vibe-monitor#esp32-setup-experimental)

## License

MIT
