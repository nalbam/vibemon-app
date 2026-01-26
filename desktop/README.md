# Vibe Monitor

AI coding assistant status monitor with pixel art character.

Monitor your **Claude Code** or **Kiro IDE** sessions at a glance - see what state it's in, which project and tool it's using, what model is active, and how much context memory is consumed.

![Demo](https://raw.githubusercontent.com/nalbam/vibe-monitor/main/screenshots/demo.gif)

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
- **Project Lock**: Lock to a specific project to ignore updates from others
- **HTTP API**: Easy integration with IDE hooks (Claude Code, Kiro)
- **Draggable**: Move the window to any position
- **Auto-launch**: Hook scripts auto-start via `npx vibe-monitor` if not running

## Prerequisites

| Tool | Required | Install |
|------|----------|---------|
| **jq** | Yes | `brew install jq` (macOS) / `apt install jq` (Ubuntu) |
| **curl** | Yes | Built-in on macOS / `apt install curl` (Ubuntu) |
| **Node.js** | Yes | `brew install node` (macOS) / `apt install nodejs npm` (Ubuntu) |

## Quick Start

```bash
npx vibe-monitor@latest
```

### Stop

```bash
curl -X POST http://127.0.0.1:19280/quit

# or
pkill -f vibe-monitor
```

## Installation

### From npm

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

## States

| State | Color | Eyes | Description |
|-------|-------|------|-------------|
| `start` | Cyan | ■ ■ + ✦ | Session begins |
| `idle` | Green | ■ ■ | Waiting for input |
| `thinking` | Purple | ▀ ▀ + 💭 | Processing prompt |
| `working` | Blue | 🕶️ | Tool executing |
| `notification` | Yellow | ● ● + ? | User input needed |
| `done` | Green | ∨ ∨ | Done! |
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
| Task | Thinking, Working, Planning |

### Animations

- **Floating**: Gentle motion (±3px horizontal, ±5px vertical, ~3.2s cycle)
- **Matrix rain**: Working state shows falling green code effect
- **Sunglasses**: Working state character wears Matrix-style sunglasses
- **Thought bubble**: Thinking state shows animated thought bubble

## Characters

| Character | Color | Description | Auto-selected for |
|-----------|-------|-------------|-------------------|
| **clawd** | Orange | Default character | Claude Code |
| **kiro** | White | Ghost character | Kiro IDE |

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
curl -sL https://raw.githubusercontent.com/nalbam/vibe-monitor/main/config/claude/hooks/vibe-monitor.sh \
  -o ~/.claude/hooks/vibe-monitor.sh
chmod +x ~/.claude/hooks/vibe-monitor.sh

# Download statusline script
curl -sL https://raw.githubusercontent.com/nalbam/vibe-monitor/main/config/claude/statusline.sh \
  -o ~/.claude/statusline.sh
chmod +x ~/.claude/statusline.sh

# Download environment sample
curl -sL https://raw.githubusercontent.com/nalbam/vibe-monitor/main/config/claude/.env.sample \
  -o ~/.claude/.env.local
```

#### 2. Add to `~/.claude/settings.json`

```json
{
  "hooks": {
    "SessionStart": [{ "command": "~/.claude/hooks/vibe-monitor.sh" }],
    "UserPromptSubmit": [{ "command": "~/.claude/hooks/vibe-monitor.sh" }],
    "PreToolUse": [{ "command": "~/.claude/hooks/vibe-monitor.sh" }],
    "Notification": [{ "command": "~/.claude/hooks/vibe-monitor.sh" }],
    "Stop": [{ "command": "~/.claude/hooks/vibe-monitor.sh" }]
  },
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh"
  }
}
```

#### 3. Configure environment

Edit `~/.claude/.env.local`:

```bash
# Desktop App URL (auto-launches via npx if not running)
export VIBE_MONITOR_URL="http://127.0.0.1:19280"

# ESP32 USB Serial port (optional)
# export ESP32_SERIAL_PORT="/dev/cu.usbmodem1101"
```

### Kiro IDE

```bash
# Create directory
mkdir -p ~/.kiro/hooks

# Download hook script
curl -sL https://raw.githubusercontent.com/nalbam/vibe-monitor/main/config/kiro/hooks/vibe-monitor.sh \
  -o ~/.kiro/hooks/vibe-monitor.sh
chmod +x ~/.kiro/hooks/vibe-monitor.sh

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
| `state` | `start`, `idle`, `thinking`, `working`, `notification`, `done`, `sleep` |
| `event` | `SessionStart`, `PreToolUse`, `Stop`, etc. |
| `tool` | Tool name (e.g., `Bash`, `Read`, `Edit`) |
| `project` | Project name |
| `model` | Model name (e.g., `opus`, `sonnet`) |
| `memory` | Memory usage (e.g., `45%`) |
| `character` | `clawd` or `kiro` |

### GET /status

Get current status:

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
  "memory": "45%",
  "locked": "my-project",
  "projects": ["my-project", "other-project"]
}
```

### POST /lock

Lock to a specific project:

```bash
curl -X POST http://127.0.0.1:19280/lock \
  -H "Content-Type: application/json" \
  -d '{"project":"my-project"}'
```

### POST /unlock

Unlock project:

```bash
curl -X POST http://127.0.0.1:19280/unlock
```

### GET /health

Health check:

```bash
curl http://127.0.0.1:19280/health
```

### POST /show

Show window and position to top-right corner:

```bash
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
- View current state and project
- Manually change state
- Switch character (Clawd/Kiro)
- **Project Lock** - Lock/unlock to specific project
- Toggle Always on Top
- Show/Hide window
- Quit

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Window not appearing | Check system tray icon, or run `curl -X POST http://127.0.0.1:19280/show` |
| Port already in use | Check with `lsof -i :19280` and kill existing process |
| Hook not working | Verify `jq` and `curl` are installed: `jq --version && curl --version` |

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
- [ESP32 Hardware Setup](https://github.com/nalbam/vibe-monitor#esp32-setup)

## License

MIT
