# ESP32 Status Bridge Setup Guide

`vibemon-bridge.mjs` is a bridge that tails **OpenClaw Gateway logs (JSONL)** and streams the current status to **ESP32-C6 (USB Serial, `/dev/ttyACM*`)** as **NDJSON (JSON + `\n`)**.

- Input (what the bridge reads): OpenClaw log file (`/tmp/openclaw/openclaw-YYYY-MM-DD.log`)
- Output (what goes to ESP32): `/dev/ttyACM0` (Linux) or `/dev/cu.usbmodem*` (macOS)
- Output example:
```json
{"state":"working","tool":"exec","project":"OpenClaw","character":"claw"}
```

> Note: The `done → idle` transition is handled by **VibeMon**. The bridge only sends **thinking/planning/working/done**.

---

## 1) File Structure

- `scripts/vibemon-bridge.mjs`: Bridge script (Node.js)
- `scripts/vibemon-bridge.plist`: launchd service (macOS)
- `scripts/vibemon-bridge.service`: systemd system service (Linux)
- `scripts/vibemon-bridge.user.service`: systemd user service (Linux)

---

## 2) Prerequisites

### 2.1 Connect ESP32 via USB

**macOS:**
```bash
ls /dev/cu.usbmodem*
```

**Linux:**
```bash
ls -la /dev/ttyACM*
dmesg | tail -n 50
```

### 2.2 Serial Permissions

**macOS:** No additional permissions needed.

**Linux:** Add your user to the `dialout` group:
```bash
sudo usermod -aG dialout $USER
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
node scripts/vibemon-bridge.mjs
```

If working correctly, you'll see logs on stderr:
- `Using tty: /dev/ttyACM0` (Linux) or `/dev/cu.usbmodem*` (macOS)
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
node scripts/vibemon-bridge.mjs
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

## 6) Running as a Service

### 6.1 macOS (launchd)

```bash
# Copy plist to LaunchAgents
cp ~/.openclaw/workspace/scripts/vibemon-bridge.plist ~/Library/LaunchAgents/

# Load the service
launchctl load ~/Library/LaunchAgents/vibemon-bridge.plist

# Check status
launchctl list | grep vibemon

# View logs
tail -f ~/.openclaw/logs/vibemon-bridge.log
tail -f ~/.openclaw/logs/vibemon-bridge.error.log

# Unload (stop) the service
launchctl unload ~/Library/LaunchAgents/vibemon-bridge.plist
```

### 6.2 Linux (systemd) - System Service

> **Note:** If you used `install.py`, the username and paths are already configured automatically.

1) Copy the unit file
```bash
sudo cp ~/.openclaw/workspace/scripts/vibemon-bridge.service /etc/systemd/system/vibemon-bridge.service
```

2) Reload systemd
```bash
sudo systemctl daemon-reload
```

3) Enable and start
```bash
sudo systemctl enable --now vibemon-bridge.service
```

4) Check status/logs
```bash
sudo systemctl status vibemon-bridge.service -n 50
sudo journalctl -u vibemon-bridge.service -f
```

### 6.3 Linux (systemd) - User Service (Optional)

Use this if you want to run as a user service in a GUI login session.

```bash
mkdir -p ~/.config/systemd/user
cp ~/.openclaw/workspace/scripts/vibemon-bridge.user.service ~/.config/systemd/user/vibemon-bridge.service
systemctl --user daemon-reload
systemctl --user enable --now vibemon-bridge.service
journalctl --user -u vibemon-bridge.service -f
```

---

## 7) Troubleshooting

### 7.1 No USB Device Found

**macOS:**
- Check `ls /dev/cu.usbmodem*`
- Try different USB ports
- Verify cable supports data transfer

**Linux:**
- Check `ls /dev/ttyACM*`
- Check recognition logs with `dmesg | tail`
- Verify board reset/boot mode

### 7.2 Write Permission Denied (Linux)
- Verify the group is `dialout` with `ls -la /dev/ttyACM0`
- Confirm your user is in the `dialout` group:
```bash
groups $USER
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
