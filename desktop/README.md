# Vibe Monitor

AI coding assistant status monitor with pixel art character.

![Demo](assets/demo.gif)

## Features

- **Frameless Window**: Clean floating design
- **Always on Top**: Always displayed above other windows
- **System Tray**: Quick control from the menu bar
- **HTTP API**: Easy integration with IDE hooks (Claude Code, Kiro)
- **Draggable**: Move the window to any position

## Quick Start

```bash
npx vibe-monitor@latest
```

### Stop

```bash
curl -X POST http://127.0.0.1:19280/quit

# or
pkill -f vibe-monitor
killall Electron
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

| State | Color | Description |
|-------|-------|-------------|
| `start` | Cyan | Session begins |
| `idle` | Green | Waiting for input |
| `thinking` | Purple | Processing prompt |
| `working` | Blue | Tool executing |
| `notification` | Yellow | User input needed |
| `done` | Green | Tool completed |
| `sleep` | Navy | 10min inactivity |

## Characters

- **clawd** (default): Orange pixel art character
- **kiro**: White ghost character

## IDE Integration

### Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST http://127.0.0.1:19280/status -H 'Content-Type: application/json' -d \"$(jq -nc --arg state working --arg event PreToolUse --arg tool \"$CLAUDE_TOOL_NAME\" --arg project \"$(basename $PWD)\" '{state: $state, event: $event, tool: $tool, project: $project}')\" > /dev/null 2>&1 || true"
          }
        ]
      }
    ]
  }
}
```

See [GitHub repository](https://github.com/nalbam/vibe-monitor) for full hook configuration.

### Kiro IDE

Copy hook files from the repository to `~/.kiro/hooks/`:

```bash
curl -sL https://raw.githubusercontent.com/nalbam/vibe-monitor/main/config/kiro/hooks/vibe-monitor-pre-tool-use.kiro.hook -o ~/.kiro/hooks/vibe-monitor-pre-tool-use.kiro.hook
```

## API

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
| `event` | `PreToolUse`, `PostToolUse`, etc. |
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

### GET /health

Health check:

```bash
curl http://127.0.0.1:19280/health
```

### POST /show

Show window:

```bash
curl -X POST http://127.0.0.1:19280/show
```

### POST /quit

Quit application:

```bash
curl -X POST http://127.0.0.1:19280/quit
```

## Tray Menu

Click the system tray icon to:
- Check current status
- Manually change status
- Toggle Always on Top
- Show/Hide window
- Quit

## Port

Default HTTP server port: `19280`

## Build

```bash
npm run build:mac     # macOS
npm run build:win     # Windows
npm run build:linux   # Linux
npm run build:all     # All platforms
```

## License

MIT
