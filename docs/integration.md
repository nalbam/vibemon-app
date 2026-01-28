# Integration Guide

Vibe Monitor receives status updates from AI coding assistants through their hook systems.

## Quick Install (Recommended)

```bash
curl -fsSL https://nalbam.github.io/vibe-monitor/install.py | python3
```

The script will:
1. Ask which tool to configure (Claude Code, Kiro, or both)
2. Download and copy hook scripts and configuration files
3. Optionally create `.env.local` from example
4. Merge hooks into `settings.json` (Claude Code only)

---

## Claude Code Setup (Manual)

Claude Code uses **hooks** and **statusline** to send data to Vibe Monitor.

| Source | Data Provided | JSON Fields |
|--------|---------------|-------------|
| **Hook** | state, event, tool, project | `.hook_event_name`, `.tool_name`, `.cwd` |
| **Statusline** | model, memory | `.model.display_name`, `.context_window.used_percentage` |

### 1. Copy scripts

```bash
mkdir -p ~/.claude/hooks

cp config/claude/hooks/vibe-monitor.py ~/.claude/hooks/
chmod +x ~/.claude/hooks/vibe-monitor.py

cp config/claude/statusline.py ~/.claude/statusline.py
chmod +x ~/.claude/statusline.py
```

### 2. Configure environment variables

```bash
cp config/claude/.env.example ~/.claude/.env.local
```

Edit `~/.claude/.env.local`:

```bash
# Debug mode (optional, 1: enabled, 0: disabled)
# export DEBUG=1

# Cache file for project metadata (model, memory)
export VIBE_MONITOR_CACHE="~/.claude/statusline-cache.json"

# Desktop App URL (auto-launches via npx if not running)
export VIBE_MONITOR_URL="http://127.0.0.1:19280"

# ESP32 USB Serial port (optional)
# export ESP32_SERIAL_PORT="/dev/cu.usbmodem1101"

# ESP32 WiFi HTTP (optional)
# export ESP32_HTTP_URL="http://192.168.1.100"
```

### 3. Register in `~/.claude/settings.json`

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "python3 ~/.claude/hooks/vibe-monitor.py" }] }
    ],
    "UserPromptSubmit": [
      { "hooks": [{ "type": "command", "command": "python3 ~/.claude/hooks/vibe-monitor.py" }] }
    ],
    "PreToolUse": [
      { "hooks": [{ "type": "command", "command": "python3 ~/.claude/hooks/vibe-monitor.py" }] }
    ],
    "Notification": [
      { "hooks": [{ "type": "command", "command": "python3 ~/.claude/hooks/vibe-monitor.py" }] }
    ],
    "Stop": [
      { "hooks": [{ "type": "command", "command": "python3 ~/.claude/hooks/vibe-monitor.py" }] }
    ]
  },
  "statusLine": {
    "type": "command",
    "command": "python3 ~/.claude/statusline.py"
  }
}
```

### 4. Statusline Display

Claude Code statusline shows project, model, and memory usage:

```
📂 vibe-monitor │ 🤖 Opus 4.5 │ 🧠 ━━━━━━━━╌╌ 80%
```

### Claude Code Hook Events

| Event | Vibe Monitor State | Description |
|-------|-------------------|-------------|
| `SessionStart` | `start` | Session begins |
| `UserPromptSubmit` | `thinking` | User submits prompt |
| `PreToolUse` | `working` | Tool execution starts |
| `Notification` | `notification` | User input needed |
| `Stop` | `done` | Agent turn ends |

---

## Kiro Setup (Manual)

Kiro uses `.kiro.hook` files that call the `vibe-monitor.py` script.

### 1. Copy scripts

```bash
mkdir -p ~/.kiro/hooks

cp config/kiro/hooks/vibe-monitor.py ~/.kiro/hooks/
chmod +x ~/.kiro/hooks/vibe-monitor.py

cp config/kiro/hooks/*.kiro.hook ~/.kiro/hooks/
```

### 2. Configure environment (Optional)

```bash
cp config/kiro/.env.example ~/.kiro/.env.local
```

Edit `~/.kiro/.env.local`:

```bash
# Desktop App URL (auto-launches via npx if not running)
export VIBE_MONITOR_URL="http://127.0.0.1:19280"

# ESP32 USB Serial port (optional)
# export ESP32_SERIAL_PORT="/dev/cu.usbmodem1101"
```

### Kiro Hook Events

| Hook File | Event | State |
|-----------|-------|-------|
| `vibe-monitor-prompt-submit.kiro.hook` | `promptSubmit` | `thinking` |
| `vibe-monitor-file-created.kiro.hook` | `fileCreated` | `working` |
| `vibe-monitor-file-edited.kiro.hook` | `fileSaved` | `working` |
| `vibe-monitor-file-deleted.kiro.hook` | `fileDeleted` | `working` |
| `vibe-monitor-agent-stop.kiro.hook` | `agentStop` | `done` |

---

## Hook Priority

The hook sends status updates in order:
1. **Desktop App** - if `VIBE_MONITOR_URL` is set
2. **ESP32 USB Serial** - if `ESP32_SERIAL_PORT` is set
3. **ESP32 HTTP** - if `ESP32_HTTP_URL` is set

---

## Event Mapping Comparison

| Action | Claude Code | Kiro | State |
|--------|-------------|------|-------|
| User input | `UserPromptSubmit` | `promptSubmit` | `thinking` |
| File operations | `PreToolUse` | `fileCreated/fileSaved/fileDeleted` | `working` |
| Agent done | `Stop` | `agentStop` | `done` |
| Notification | `Notification` | - | `notification` |
