# Claude Monitor Desktop App

A frameless desktop app for real-time monitoring of Claude Code status.

## Features

- **Frameless Window**: Clean floating design
- **Always on Top**: Always displayed above other windows
- **System Tray**: Quick control from the menu bar
- **HTTP API**: Easy integration with Claude Code hooks
- **Draggable**: Move the window to any position

## Installation

```bash
cd desktop
npm install
```

## Usage

### Run the App

```bash
npm start
```

### Update Status via HTTP API

```bash
# Change to working state
curl -X POST http://127.0.0.1:19280/status \
  -H "Content-Type: application/json" \
  -d '{"state":"working","tool":"Bash","project":"my-project"}'

# Check current status
curl http://127.0.0.1:19280/status
```

### Claude Code Hooks Integration

Desktop App support is integrated into `hooks/claude-monitor.sh` in the [claude-config](https://github.com/nalbam/claude-config) repository.

Order in which the hook sends status updates:
1. **Desktop App** (`http://127.0.0.1:19280`) - Always attempted
2. **ESP32 USB Serial** - If configured
3. **ESP32 HTTP** - If configured

Run the Desktop app and use Claude Code to automatically update the status.

## States

| State | Background | Description |
|-------|------------|-------------|
| `idle` | Green | Ready/Standby |
| `working` | Blue | Work in progress |
| `notification` | Yellow | Input requested |
| `session_start` | Cyan | Session started |
| `tool_done` | Green | Tool completed |

## API

### POST /status

Update status

```json
{
  "state": "working",
  "event": "PreToolUse",
  "tool": "Bash",
  "project": "claude-monitor"
}
```

### GET /status

Get current status

```json
{
  "state": "idle"
}
```

### GET /health

Health check endpoint

```json
{
  "status": "ok"
}
```

### POST /show

Show window and position to top-right corner

```json
{
  "success": true
}
```

## Build

Build for macOS:

```bash
npm run build:mac
```

Build for Windows:

```bash
npm run build:win
```

Build for Linux:

```bash
npm run build:linux
```

Build for all platforms:

```bash
npm run build:all
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

(Can be changed via `HTTP_PORT` constant in main.js)
