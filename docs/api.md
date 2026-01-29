# HTTP API Reference

Default port: Desktop App `19280`, ESP32 WiFi `80`

## Security & Limits

| Limit | Value | Description |
|-------|-------|-------------|
| Payload size | 10KB | Maximum request body size |
| Rate limit | 100 req/min | Per IP address |
| Request timeout | 30 sec | Prevents Slowloris attacks |
| CORS | localhost only | Only allows localhost origins |

### Input Validation

| Field | Max Length | Format |
|-------|------------|--------|
| `project` | 100 chars | String |
| `tool` | 50 chars | String |
| `model` | 50 chars | String |
| `memory` | - | `N%` where N is 0-100 |
| `state` | - | One of valid states |
| `character` | - | `clawd` or `kiro` |
| `terminalId` | - | String (terminal session ID) |

---

## Platform Support

| Endpoint | Desktop | ESP32 WiFi |
|----------|---------|------------|
| POST/GET /status | ✓ | ✓ |
| GET /windows | ✓ | - |
| POST /close | ✓ | - |
| POST /show | ✓ | - |
| GET /health | ✓ | - |
| GET /debug | ✓ | - |
| POST /quit | ✓ | - |
| POST /lock, /unlock | ✓ | ✓ |
| GET/POST /lock-mode | ✓ | ✓ |
| GET/POST /window-mode | ✓ | - |
| GET /stats | ✓ | - |
| GET /stats/data | ✓ | - |
| POST /reboot | - | ✓ |

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
| `tool` | string | Tool name (e.g., `Bash`, `Read`, `Edit`) |
| `project` | string | Project name |
| `model` | string | Model name (e.g., `opus`, `sonnet`) |
| `memory` | string | Memory usage (e.g., `45%`) |
| `character` | string | `clawd` or `kiro` |
| `terminalId` | string | Terminal ID for click-to-focus (iTerm2 session ID or Ghostty PID) |

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
# Show first window
curl -X POST http://127.0.0.1:19280/show

# Show specific project window
curl -X POST http://127.0.0.1:19280/show \
  -H "Content-Type: application/json" \
  -d '{"project":"my-project"}'
```

**Request Body (optional):**

| Field | Type | Description |
|-------|------|-------------|
| `project` | string | Project name to show (defaults to first window) |

**Response:**
```json
{"success": true, "project": "my-project"}
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

## Statistics (Desktop only)

### GET /stats

Serve the stats dashboard HTML page.

```bash
# Open in browser
open http://127.0.0.1:19280/stats
```

### GET /stats/data

Get stats data from `~/.claude/stats-cache.json`.

```bash
curl http://127.0.0.1:19280/stats/data
```

**Response:**
```json
{
  "sessions": [...],
  "totalTokens": 12345,
  "lastUpdated": "2026-01-29T12:00:00Z"
}
```

---

## System

### GET /health

Health check endpoint.

```bash
curl http://127.0.0.1:19280/health
```

**Response:**
```json
{"status": "ok"}
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
