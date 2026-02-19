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
| `state` | - | One of valid states |
| `project` | 100 chars | String |
| `tool` | 50 chars | String |
| `model` | 50 chars | String |
| `memory` | - | Integer 0-100 |
| `character` | - | `apto`, `clawd`, `kiro`, or `claw` |
| `terminalId` | 100 chars | Terminal session ID with prefix: `iterm2:w0t0p0:UUID` (from `ITERM_SESSION_ID`) or `ghostty:12345` (from `GHOSTTY_PID`) |

---

## Platform Support

| Endpoint | Desktop | ESP32 WiFi |
|----------|---------|------------|
| POST/GET /status | ✓ | ✓ |
| GET /windows | ✓ | - |
| POST /close | ✓ | - |
| POST /show | ✓ | - |
| GET /health | ✓ | ✓ |
| GET /debug | ✓ | - |
| POST /quit | ✓ | - |
| POST /lock | ✓ | ✓ |
| POST /unlock | ✓ | ✓ |
| GET/POST /lock-mode | ✓ | ✓ |
| GET/POST /window-mode | ✓ | - |
| GET /stats | ✓ | - |
| GET /stats/data | ✓ | - |
| POST /reboot | - | ✓ |
| POST /wifi-reset | - | ✓ |

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
| `state` | string | `start`, `idle`, `thinking`, `planning`, `working`, `packing`, `notification`, `done`, `sleep` |
| `tool` | string | Tool name (e.g., `Bash`, `Read`, `Edit`) |
| `project` | string | Project name |
| `model` | string | Model name (e.g., `opus`, `sonnet`) |
| `memory` | number | Memory usage (0-100) |
| `character` | string | `apto`, `clawd`, `kiro`, or `claw` |
| `terminalId` | string | Terminal ID for click-to-focus (e.g., `iterm2:w0t0p0:UUID` or `ghostty:12345`) |

**Response:**
```json
{"success": true, "project": "my-project", "state": "working", "windowCount": 1}
```

### GET /status

Get current status.

```bash
curl http://127.0.0.1:19280/status
```

**Response (Desktop):**
```json
{
  "windowCount": 2,
  "projects": {
    "my-project": {"state": "working", "tool": "Bash", "model": "opus", "memory": 45},
    "other-project": {"state": "idle"}
  }
}
```

**Response (ESP32 WiFi):**
```json
{
  "state": "working",
  "project": "my-project",
  "locked": "my-project",
  "lockMode": "on-thinking",
  "projectCount": 1
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

**Response:**
```json
{
  "primaryDisplay": {"bounds": {"x": 0, "y": 0, "width": 1920, "height": 1080}, "workArea": {...}},
  "allDisplays": [...],
  "windows": [{"project": "my-project", "bounds": {...}, "isVisible": true}],
  "windowCount": 1,
  "maxWindows": 5,
  "alwaysOnTopMode": "active-only",
  "platform": "darwin"
}
```

### POST /quit (Desktop only)

Quit the application.

```bash
curl -X POST http://127.0.0.1:19280/quit
```

### POST /reboot (ESP32 only)

Reboot the ESP32 device.

```bash
curl -X POST http://192.168.0.185/reboot
```

### POST /wifi-reset (ESP32 only)

Clear saved WiFi credentials and return to provisioning mode.

```bash
curl -X POST http://192.168.0.185/wifi-reset
```

**Response:**
```json
{"success": true, "message": "WiFi credentials cleared. Rebooting..."}
```

**Behavior:**
- Clears `wifiSSID`, `wifiPassword` from NVS (WebSocket token is preserved)
- Device reboots automatically
- Enters provisioning mode (creates `VibeMon-Setup` AP)

See [ESP32 Setup Guide](esp32-setup.md#reset-wifi-settings) for details.

---

## HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `400` | Bad request (validation error) |
| `404` | Not found |
| `408` | Request timeout |
| `413` | Payload too large (>10KB) |
| `429` | Too many requests (rate limited) |
| `500` | Internal server error |

### Error Response Format

```json
{"error": "Error message description"}
```
