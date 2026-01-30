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
- `TFT_eSPI` by Bodmer
- `ArduinoJson` by Benoit Blanchon
- `LovyanGFX` by lovyan03

### 4. Configure TFT_eSPI

Copy `User_Setup.h` to Arduino library folder:
```bash
cp User_Setup.h ~/Documents/Arduino/libraries/TFT_eSPI/User_Setup.h
```

### 5. Upload

- Tools → Board → ESP32C6 Dev Module
- Tools → Port → /dev/cu.usbmodem* (or appropriate port)
- Click Upload

## WiFi Mode (Optional)

Edit `vibe-monitor.ino`:

```cpp
#define USE_WIFI
const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";
```

## Serial Port Check

```bash
# macOS
ls /dev/cu.*

# Linux
ls /dev/ttyUSB* /dev/ttyACM*
```

## Testing

```bash
# Test working state
echo '{"state":"working","tool":"Bash","project":"test"}' > /dev/cu.usbmodem1101

# Test idle state
echo '{"state":"idle","project":"test"}' > /dev/cu.usbmodem1101
```

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
| Display not working | Verify `User_Setup.h` is copied to TFT_eSPI library folder |
| Serial connection failed | Check port permissions: `sudo chmod 666 /dev/ttyUSB0` |
| JSON parsing error | Ensure JSON ends with LF (`\n`) |
