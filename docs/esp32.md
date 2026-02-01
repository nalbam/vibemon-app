# ESP32 Setup

## Hardware

- **Board**: ESP32-C6-LCD-1.47 (172x320, ST7789V2)
- **Connection**: USB-C (Serial) or WiFi

## Arduino IDE Setup

### 1. Add ESP32 Board Manager

File → Preferences → Additional Board Manager URLs:
```
https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
```

### 2. Install ESP32 Board

Tools → Board → Boards Manager → Search "esp32" → Install

### 3. Install Libraries

Tools → Manage Libraries:
- `LovyanGFX` by lovyan03
- `ArduinoJson` by Benoit Blanchon

> **Note:** TFT_eSPI is NOT required. The project uses LovyanGFX with a configuration file (`LGFX_ESP32C6.hpp`).

### 4. Upload

- Tools → Board → ESP32C6 Dev Module
- Tools → Port → /dev/cu.usbmodem* (or appropriate port)
- Click Upload

## WiFi Mode (Optional)

### 1. Create credentials file

```bash
cp credentials.h.example credentials.h
```

### 2. Edit `credentials.h`

```cpp
// Uncomment to enable WiFi mode
#define USE_WIFI

#define WIFI_SSID "YOUR_SSID"
#define WIFI_PASSWORD "YOUR_PASSWORD"
```

## WiFi HTTP Endpoints

When WiFi is enabled, the ESP32 runs an HTTP server on port 80:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/status` | POST | Update monitor status |
| `/status` | GET | Get current status |
| `/health` | GET | Health check |
| `/lock` | POST | Lock to project |
| `/unlock` | POST | Unlock project |
| `/lock-mode` | GET | Get lock mode |
| `/lock-mode` | POST | Set lock mode |
| `/reboot` | POST | Reboot device |

Example:

```bash
# Update status
curl -X POST http://192.168.0.185/status \
  -H "Content-Type: application/json" \
  -d '{"state":"working","tool":"Bash","project":"my-project"}'

# Get current status
curl http://192.168.0.185/status
```

## Serial Port Check

```bash
# macOS
ls /dev/cu.*

# Linux
ls /dev/ttyUSB* /dev/ttyACM*
```

## Testing

### Character

```bash
echo '{"state":"idle","project":"my-project","character":"clawd"}' > /dev/cu.usbmodem1101 && sleep 1
echo '{"state":"idle","project":"my-project","character":"kiro"}' > /dev/cu.usbmodem1101 && sleep 1
echo '{"state":"idle","project":"my-project","character":"claw"}' > /dev/cu.usbmodem1101
```

### macOS

```bash
echo '{"state":"start","project":"my-project"}' > /dev/cu.usbmodem1101 && sleep 1
echo '{"state":"idle","project":"my-project"}' > /dev/cu.usbmodem1101 && sleep 1
echo '{"state":"thinking","project":"my-project"}' > /dev/cu.usbmodem1101 && sleep 1
echo '{"state":"planning","project":"my-project"}' > /dev/cu.usbmodem1101 && sleep 1
echo '{"state":"working","tool":"Bash","project":"my-project","model":"Opus 4.5","memory":"55%"}' > /dev/cu.usbmodem1101 && sleep 1
echo '{"state":"packing","project":"my-project"}' > /dev/cu.usbmodem1101 && sleep 1
echo '{"state":"notification","project":"my-project"}' > /dev/cu.usbmodem1101 && sleep 1
echo '{"state":"done","project":"my-project"}' > /dev/cu.usbmodem1101
```

### Raspberry Pi / Linux

On Linux, you need to set the baud rate before serial communication.

```bash
# Set baud rate first (required, only once per session)
stty -F /dev/ttyACM0 115200

# Test states
echo '{"state":"start","project":"my-project"}' > /dev/ttyACM0 && sleep 1
echo '{"state":"idle","project":"my-project"}' > /dev/ttyACM0 && sleep 1
echo '{"state":"thinking","project":"my-project"}' > /dev/ttyACM0 && sleep 1
echo '{"state":"planning","project":"my-project"}' > /dev/ttyACM0 && sleep 1
echo '{"state":"working","tool":"Bash","project":"my-project","model":"Opus 4.5","memory":"55%"}' > /dev/ttyACM0 && sleep 1
echo '{"state":"packing","project":"my-project"}' > /dev/ttyACM0 && sleep 1
echo '{"state":"notification","project":"my-project"}' > /dev/ttyACM0 && sleep 1
echo '{"state":"done","project":"my-project"}' > /dev/ttyACM0
```

> **Note:** The `stty` command only needs to be run once per session. You'll need to set it again if you close the terminal or reconnect the device.

## Serial Commands

ESP32 supports JSON commands via serial:

```bash
# Lock current project
echo '{"command":"lock"}' > /dev/cu.usbmodem1101

# Lock specific project
echo '{"command":"lock","project":"my-project"}' > /dev/cu.usbmodem1101

# Unlock
echo '{"command":"unlock"}' > /dev/cu.usbmodem1101

# Get status
echo '{"command":"status"}' > /dev/cu.usbmodem1101

# Get/Set lock mode
echo '{"command":"lock-mode"}' > /dev/cu.usbmodem1101
echo '{"command":"lock-mode","mode":"first-project"}' > /dev/cu.usbmodem1101

# Reboot device
echo '{"command":"reboot"}' > /dev/cu.usbmodem1101
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Display not working | Verify LovyanGFX library is installed and board is ESP32C6 Dev Module |
| Serial connection failed | Check port permissions: `sudo chmod 666 /dev/ttyUSB0` |
| Serial not responding (Linux) | Set baud rate first: `stty -F /dev/ttyACM0 115200` |
| JSON parsing error | Ensure JSON ends with LF (`\n`) |
| WiFi not connecting | Check `credentials.h` exists and has correct SSID/password |
