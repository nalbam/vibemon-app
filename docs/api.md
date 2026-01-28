# HTTP API Reference

Both Desktop App (port 19280) and ESP32 WiFi mode (port 80) support the same API.

> **Note:** Desktop App has a 10KB payload size limit for security.

## Status

### POST /status

Update monitor status.

```bash
curl -X POST http://127.0.0.1:19280/status \
  -H "Content-Type: application/json" \
  -d '{"state":"working","tool":"Bash","project":"my-project"}'
```

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| `state` | string | `start`, `idle`, `thinking`, `planning`, `working`, `notification`, `done`, `sleep` |
| `event` | string | `SessionStart`, `PreToolUse`, `Stop`, etc. |
| `tool` | string | Tool name (e.g., `Bash`, `Read`, `Edit`) |
| `project` | string | Project name |
| `model` | string | Model name (e.g., `opus`, `sonnet`) |
| `memory` | string | Memory usage (e.g., `45%`) |
| `character` | string | `clawd` or `kiro` |
| `terminalId` | string | iTerm2 session ID for click-to-focus |

**Response:**
```json
{"success": true, "project": "my-project", "state": "working", "windowCount": 1}
```

### GET /status

Get all windows' status.

```bash
curl http://127.0.0.1:19280/status
```

**Response:**
```json
{
  "windowCount": 2,
  "projects": {
    "my-project": {"state": "working", "tool": "Bash", "model": "opus", "memory": "45%"},
    "other-project": {"state": "idle"}
  }
}
```

### GET /windows

List all active windows with their states and positions.

```bash
curl http://127.0.0.1:19280/windows
```

**Response:**
```json
{
  "windowCount": 2,
  "windows": [
    {"project": "my-project", "state": "working", "bounds": {"x": 1748, "y": 23, "width": 172, "height": 348}},
    {"project": "other-project", "state": "idle", "bounds": {"x": 1566, "y": 23, "width": 172, "height": 348}}
  ]
}
```

---

## Window Management

### POST /close

Close a specific project window.

```bash
curl -X POST http://127.0.0.1:19280/close \
  -H "Content-Type: application/json" \
  -d '{"project":"my-project"}'
```

### POST /show (Desktop only)

Show window and position to top-right corner.

```bash
curl -X POST http://127.0.0.1:19280/show
```

### GET /window-mode (Desktop only)

Get current window mode.

```bash
curl http://127.0.0.1:19280/window-mode
```

**Response:**
```json
{"mode": "multi", "windowCount": 2, "lockedProject": null}
```

### POST /window-mode (Desktop only)

Set window mode (`multi` or `single`).

```bash
curl -X POST http://127.0.0.1:19280/window-mode \
  -H "Content-Type: application/json" \
  -d '{"mode":"single"}'
```

---

## Project Lock

### POST /lock

Lock to a specific project (single-window mode only).

```bash
curl -X POST http://127.0.0.1:19280/lock \
  -H "Content-Type: application/json" \
  -d '{"project":"my-project"}'
```

**Response:**
```json
{"success": true, "lockedProject": "my-project"}
```

### POST /unlock

Unlock project.

```bash
curl -X POST http://127.0.0.1:19280/unlock
```

### GET /lock-mode

Get current lock mode.

```bash
curl http://127.0.0.1:19280/lock-mode
```

**Response:**
```json
{
  "mode": "on-thinking",
  "modes": {"first-project": "First Project", "on-thinking": "On Thinking"},
  "lockedProject": null,
  "windowMode": "single"
}
```

### POST /lock-mode

Set lock mode (`first-project` or `on-thinking`).

```bash
curl -X POST http://127.0.0.1:19280/lock-mode \
  -H "Content-Type: application/json" \
  -d '{"mode":"first-project"}'
```

---

## System

### GET /health

Health check endpoint.

```bash
curl http://127.0.0.1:19280/health
```

### GET /debug (Desktop only)

Get display and window debug information.

```bash
curl http://127.0.0.1:19280/debug
```

### POST /quit (Desktop only)

Quit the application.

```bash
curl -X POST http://127.0.0.1:19280/quit
```

### POST /reboot (ESP32 only)

Reboot the ESP32 device.

```bash
curl -X POST http://192.168.1.100/reboot
```
