# Claude Monitor

A pixel art status monitor for Claude Code, built for ESP32-C6-LCD-1.47

## Preview

```
┌────────────────────┐
│                    │
│    ┌──────────┐    │
│    │██████████│    │
│  ██│█ ■    ■ █│██  │  ← Claude character
│    │██████████│    │     (128x128 pixels)
│    └─┬─┬──┬─┬─┘    │
│      │█│  │█│      │
├────────────────────┤
│     Working        │  ← Status text
│     ● ● ● ○        │  ← Loading animation
├────────────────────┤
│ Project: dotfiles  │
│ Tool: Bash         │
├────────────────────┤
│ Claude Monitor     │
└────────────────────┘
```

## Hardware

- **Board**: ESP32-C6-LCD-1.47 (172x320, ST7789V2)
- **Connection**: USB-C (Serial communication)

## State Display

| State | Background | Eyes | Animation |
|-------|------------|------|-----------|
| `idle` | Green | ■ ■ Square | Blink every 3s |
| `working` | Blue | ▬ ▬ Focused | Loading dots |
| `notification` | Yellow | ● ● Round + ? | Question mark |
| `session_start` | Cyan | ■ ■ + ✦ | Rotating sparkle |
| `tool_done` | Green | ∨ ∨ Happy | - |

## Installation

### 1. Arduino IDE Setup

1. **Add ESP32 Board Manager**
   - File → Preferences → Additional Board Manager URLs:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```

2. **Install ESP32 Board**
   - Tools → Board → Boards Manager → Search "esp32" → Install

3. **Install Libraries**
   - Tools → Manage Libraries:
     - `TFT_eSPI` by Bodmer
     - `ArduinoJson` by Benoit Blanchon

### 2. TFT_eSPI Configuration

Copy `User_Setup.h` to Arduino library folder:

```bash
cp User_Setup.h ~/Documents/Arduino/libraries/TFT_eSPI/User_Setup.h
```

### 3. Upload

1. **Select Board**: Tools → Board → ESP32C6 Dev Module
2. **Select Port**: Tools → Port → /dev/cu.usbmodem* (or appropriate port)
3. **Upload**: Click Upload button

## Claude Monitor Configuration

### 1. Environment Variables

Edit `~/.claude/.env.local`:

```bash
# USB Serial port (auto-detection also available)
export ESP32_SERIAL_PORT="/dev/cu.usbmodem1101"

# HTTP fallback (optional, for WiFi mode)
# export ESP32_HTTP_URL="http://192.168.1.100"
```

### 2. Check Serial Port

```bash
# macOS
ls /dev/cu.*

# Linux
ls /dev/ttyUSB* /dev/ttyACM*
```

## File Structure

```
claude-monitor/
├── claude-monitor.ino          # Main firmware
├── sprites.h                   # Character drawing functions
├── User_Setup.h                # TFT display configuration
├── simulator/                  # Web simulator
│   └── index.html              # Browser testing
├── desktop/                    # Electron desktop app
│   ├── main.js                 # Main process
│   └── index.html              # Renderer
└── README.md                   # This document
```

## Simulator

Preview the display in browser without hardware.

**Web Simulator**: https://nalbam.github.io/claude-monitor/simulator/

```bash
# Run locally
open simulator/index.html
```

Simulator features:
- Switch between 5 states with buttons
- Input Project/Tool names
- JSON payload preview
- Real-time animations (blink, loading dots, sparkle)

## Desktop App (macOS)

Frameless desktop app for monitoring Claude Code status.

### Quick Start

```bash
cd desktop
npm install
npm start
```

### Features

- **Frameless window**: Clean floating design
- **Always on Top**: Stays above other windows
- **System Tray**: Quick control from menubar
- **HTTP API**: Easy integration with Claude Code hooks (port 19280)
- **Draggable**: Move window anywhere

### Claude Code Hooks Integration

Desktop app support is integrated into `claude-config/hooks/esp32-status.sh`.

The hook sends status updates to:
1. **Desktop App** (`http://127.0.0.1:19280`) - always attempted first
2. **ESP32 USB Serial** - if configured
3. **ESP32 HTTP** - if configured

Just run the desktop app and use Claude Code with the configured hooks.

### HTTP API

```bash
# Update status
curl -X POST http://127.0.0.1:19280/status \
  -H "Content-Type: application/json" \
  -d '{"state":"working","tool":"Bash","project":"my-project"}'

# Get current status
curl http://127.0.0.1:19280/status

# Health check
curl http://127.0.0.1:19280/health

# Show and position window
curl -X POST http://127.0.0.1:19280/show
```

## WiFi Mode (Optional)

To use WiFi instead of USB:

1. Uncomment `#define USE_WIFI` in code
2. Set WiFi SSID/Password
3. Set `ESP32_HTTP_URL` environment variable

```cpp
#define USE_WIFI
const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";
```

### HTTP API

```bash
# POST /status - Update status
curl -X POST http://192.168.1.100/status \
  -H "Content-Type: application/json" \
  -d '{"state":"working","event":"PreToolUse","tool":"Bash","project":"test"}'

# Response
{"ok":true}

# Error (no body)
{"error":"no body"}
```

## Testing

```bash
# USB Serial test - idle (green, square eyes)
echo '{"state":"idle","event":"Stop","tool":"","project":"test"}' > /dev/cu.usbmodem1101

# working (blue, focused eyes)
echo '{"state":"working","event":"PreToolUse","tool":"Bash","project":"dotfiles"}' > /dev/cu.usbmodem1101

# notification (yellow, round eyes)
echo '{"state":"notification","event":"Notification","tool":"","project":"test"}' > /dev/cu.usbmodem1101

# session_start (cyan, sparkle)
echo '{"state":"session_start","event":"SessionStart","tool":"","project":"test"}' > /dev/cu.usbmodem1101

# tool_done (green, happy eyes)
echo '{"state":"tool_done","event":"PostToolUse","tool":"Bash","project":"test"}' > /dev/cu.usbmodem1101
```

## Troubleshooting

### Display not working

- Verify `User_Setup.h` is in correct location
- Check pin configuration matches board
- Check backlight pin (TFT_BL)

### Serial connection failed

```bash
# Check port permissions (Linux)
sudo chmod 666 /dev/ttyUSB0

# Test with serial monitor
screen /dev/cu.usbmodem1101 115200
```

### JSON parsing error

Check serial monitor for "JSON parse error" message
→ Verify line ending (use LF only)

## Version History

- **v2.0**: Pixel art character version (Claude mascot, 128x128, web simulator)
- **v1.0**: Circular status display version
