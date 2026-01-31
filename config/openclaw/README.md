# ESP32 Status Bridge Setup Guide

`esp32-status-bridge.mjs` is a bridge that tails **OpenClaw Gateway logs (JSONL)** and streams the current status to **ESP32-C6 (USB Serial, `/dev/ttyACM*`)** as **NDJSON (JSON + `\n`)**.

- Input (what the bridge reads): OpenClaw log file (`/tmp/openclaw/openclaw-YYYY-MM-DD.log`)
- Output (what goes to ESP32): `/dev/ttyACM0` etc.
- Output example:
```json
{"state":"working","tool":"exec","project":"OpenClaw","character":"claw"}
```

> Note: The `done → idle` transition is handled by **VibeMon**. The bridge only sends **thinking/planning/working/done**.

---

## 1) File Structure

- `scripts/esp32-status-bridge.mjs`: Bridge script (Node.js)
- `scripts/sera-esp32-bridge.service`: systemd (system) service unit (recommended for Raspberry Pi/servers)
- `scripts/sera-esp32-bridge.user.service`: systemd (user) service unit (optional)

---

## 2) Prerequisites

### 2.1 Connect ESP32 via USB
- When you connect the ESP32-C6 board via USB, it typically appears as a device like `/dev/ttyACM0`.
- Verify:
```bash
ls -la /dev/ttyACM*
dmesg | tail -n 50
```

### 2.2 Serial Permissions (dialout)
The bridge needs write access to the TTY device.

- Add your user (e.g., `pi`) to the `dialout` group:
```bash
sudo usermod -aG dialout pi
# Logout/reboot may be required for changes to take effect
```

If permissions are missing, you'll see a warning like:
- `Found /dev/ttyACM0 but not writable. Check permissions (dialout group) ...`

### 2.3 Verify OpenClaw Logs Exist
The bridge tails the following log by default:
- `OPENCLAW_LOG_DIR=/tmp/openclaw`
- File pattern: `openclaw-YYYY-MM-DD.log`

Verify:
```bash
ls -la /tmp/openclaw
```

> If the log path is different, set the `OPENCLAW_LOG_DIR` environment variable accordingly.

---

## 3) Quick Start (Manual Testing)

Before setting up as a service, test manually first.

```bash
cd ~/.openclaw/workspace
node scripts/esp32-status-bridge.mjs
```

If working correctly, you'll see logs on stderr:
- `Using tty: /dev/ttyACM0`
- `Tailing log: /tmp/openclaw/openclaw-YYYY-MM-DD.log`

Verify that JSON lines are being received on the ESP32.

---

## 4) Environment Variables

The bridge uses the following environment variables:

- `PROJECT_NAME` (default: `OpenClaw`)
  - Project name displayed on ESP32
- `OPENCLAW_LOG_DIR` (default: `/tmp/openclaw`)
  - OpenClaw log directory

Example:
```bash
PROJECT_NAME=OpenClaw \
OPENCLAW_LOG_DIR=/tmp/openclaw \
node scripts/esp32-status-bridge.mjs
```

---

## 5) State Specification (ESP32 Input Protocol)

The bridge sends only these states:

- `thinking`: User submitted prompt (run started) / generating response
- `planning`: Prompt interpretation/planning phase (based on embedded run prompt start/end)
- `working`: Tool execution in progress (includes `tool` field)
- `done`: Task completed (reply delivered or run ended)

Additional fields for `working` state:
- `tool`: e.g., `exec`, `web_search`, `browser`, ...

Common fields:
- `project`: `PROJECT_NAME` (default: `OpenClaw`)
- `character`: `claw` (fixed)
- `ts`: ISO timestamp

---

## 6) Running with systemd (Recommended)

### 6.1 Install as System Service
Example for `pi` user.

1) Copy the unit file
```bash
sudo cp ~/.openclaw/workspace/scripts/sera-esp32-bridge.service /etc/systemd/system/sera-esp32-bridge.service
```

2) Reload systemd
```bash
sudo systemctl daemon-reload
```

3) Enable and start
```bash
sudo systemctl enable --now sera-esp32-bridge.service
```

4) Check status/logs
```bash
sudo systemctl status sera-esp32-bridge.service -n 50
sudo journalctl -u sera-esp32-bridge.service -f
```

### 6.2 Install as User Service (Optional)
Use this only if you want to run as a user service in a GUI login session.

```bash
mkdir -p ~/.config/systemd/user
cp ~/.openclaw/workspace/scripts/sera-esp32-bridge.user.service ~/.config/systemd/user/sera-esp32-bridge.service
systemctl --user daemon-reload
systemctl --user enable --now sera-esp32-bridge.service
journalctl --user -u sera-esp32-bridge.service -f
```

---

## 7) Troubleshooting

### 7.1 No `/dev/ttyACM*` Found
- Check cable (must support data transfer)
- Check recognition logs with `dmesg | tail`
- Verify board reset/boot mode

### 7.2 Write Permission Denied
- Verify the group is `dialout` with `ls -la /dev/ttyACM0`
- Confirm `pi` is in the `dialout` group:
```bash
groups pi
```

### 7.3 OpenClaw Log File Not Found
- The bridge only watches **today's** file: `openclaw-YYYY-MM-DD.log`
- Verify `OPENCLAW_LOG_DIR` matches the actual log path
- Confirm Gateway is writing logs to that location

---

## 8) Future Improvements

Current v1 only detects TTY changes but does **not reopen** the stream.
If USB reconnects are frequent, consider these improvements:
- Close existing stream and open new one when `/dev/ttyACM*` changes
- Send periodic heartbeat/ping to ESP32
