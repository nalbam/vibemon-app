# VibeMon Bridge for OpenClaw

Two methods are available to connect OpenClaw to VibeMon:

| Method | Reliability | Setup | Recommended |
|--------|-------------|-------|-------------|
| **Plugin (hooks)** | High | Easy | Yes |
| **Log-based** | Medium | Complex | Legacy |

---

## Method 1: Plugin-based (Recommended)

The plugin uses OpenClaw's hook system for reliable state detection.

### 1.1 Installation

```bash
# Copy plugin to OpenClaw plugins directory
mkdir -p ~/.openclaw/workspace/plugins
cp -r plugins/vibemon-bridge ~/.openclaw/workspace/plugins/
```

### 1.2 Enable Plugin

Add to your OpenClaw config (`~/.openclaw/config.json` or workspace config):

```json
{
  "plugins": {
    "vibemon-bridge": {
      "enabled": true,
      "config": {
        "projectName": "OpenClaw",
        "character": "claw",
        "serialEnabled": true,
        "httpEnabled": false,
        "debug": false
      }
    }
  }
}
```

### 1.3 Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `projectName` | `OpenClaw` | Project name on VibeMon display |
| `character` | `claw` | Character: `clawd`, `kiro`, `claw` |
| `serialEnabled` | `true` | Send to ESP32 via USB serial |
| `httpEnabled` | `false` | Send to VibeMon Desktop app |
| `httpUrl` | `http://127.0.0.1:19280/status` | Desktop app endpoint |
| `debug` | `false` | Enable verbose logging |

### 1.4 Hooks Used

| Hook | VibeMon State |
|------|---------------|
| `gateway_start` | `start` |
| `before_agent_start` | `thinking` |
| `before_tool_call` | `working` (with tool name) |
| `after_tool_call` | `thinking` |
| `message_sent` | `done` (3s delay) |
| `agent_end` | `done` (fallback) |
| `session_end` | `done` |
| `gateway_stop` | `done` |

### 1.5 Verify

Check OpenClaw logs for plugin loading:
```
[vibemon] Plugin loaded
[vibemon] Project: OpenClaw, Character: claw
[vibemon] Serial: true, HTTP: false
[vibemon] TTY device: /dev/ttyACM0
```

---

## Method 2: Log-based (Legacy)

`scripts/vibemon-bridge.mjs` tails OpenClaw Gateway logs (JSONL) and streams status to ESP32.

- Input: OpenClaw log file (`/tmp/openclaw/openclaw-YYYY-MM-DD.log`)
- Output: `/dev/ttyACM0` (Linux) or `/dev/cu.usbmodem*` (macOS)

### 2.1 File Structure

- `scripts/vibemon-bridge.mjs`: Bridge script (Node.js)
- `scripts/vibemon-bridge.plist`: launchd user service (macOS)
- `scripts/vibemon-bridge.service`: systemd user service (Linux)

### 2.2 Quick Start

```bash
cd ~/.openclaw/workspace
node scripts/vibemon-bridge.mjs
```

For debugging:
```bash
DEBUG=1 node scripts/vibemon-bridge.mjs
```

### 2.3 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PROJECT_NAME` | `OpenClaw` | Project name |
| `OPENCLAW_LOG_DIR` | `/tmp/openclaw` | Log directory |
| `DEBUG` | `false` | Debug mode |

### 2.4 Running as User Service

**macOS (launchd):**
```bash
cp ~/.openclaw/workspace/scripts/vibemon-bridge.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/vibemon-bridge.plist
launchctl list | grep vibemon
```

**Linux (systemd):**
```bash
mkdir -p ~/.config/systemd/user
cp ~/.openclaw/workspace/scripts/vibemon-bridge.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now vibemon-bridge.service
```

---

## Prerequisites

### Connect ESP32 via USB

**macOS:**
```bash
ls /dev/cu.usbmodem*
```

**Linux:**
```bash
ls -la /dev/ttyACM*
```

### Serial Permissions (Linux only)

```bash
sudo usermod -aG dialout $USER
# Logout/reboot required
```

---

## State Protocol

States sent to VibeMon:

| State | Color | Description |
|-------|-------|-------------|
| `start` | Cyan | Gateway/session started |
| `thinking` | Purple | Processing user prompt |
| `working` | Blue | Tool executing (includes `tool` field) |
| `done` | Green | Task completed |

Output format (NDJSON):
```json
{"state":"working","tool":"exec","project":"OpenClaw","character":"claw","ts":"2026-01-31T12:00:00Z"}
```

> Note: The `done → idle → sleep` transitions are handled by VibeMon device/app.

---

## Troubleshooting

### No USB Device Found

- **macOS:** `ls /dev/cu.usbmodem*`
- **Linux:** `ls /dev/ttyACM*`, `dmesg | tail`
- Try different USB port / cable

### Write Permission Denied (Linux)

```bash
groups $USER  # Should include 'dialout'
ls -la /dev/ttyACM0  # Check group
```

### Plugin Not Loading

- Check config JSON syntax
- Verify plugin directory: `~/.openclaw/workspace/plugins/vibemon-bridge/`
- Check OpenClaw logs for errors

### Log-based Bridge Issues

- Verify log directory: `ls -la /tmp/openclaw`
- Check log format: `tail -f /tmp/openclaw/openclaw-*.log`
