# WiFi Provisioning Testing Guide

This guide explains how to test the WiFi provisioning feature on ESP32 hardware.

## Prerequisites

- ESP32-C6-LCD-1.47 device (or compatible ESP32 with display)
- Arduino IDE or PlatformIO
- Computer/phone with WiFi capability
- USB cable for programming

## Setup Instructions

### 1. Prepare the Firmware

```bash
cd vibemon-app
cp credentials.h.example credentials.h
```

Edit `credentials.h`:
```cpp
// Uncomment this line to enable WiFi
#define USE_WIFI

// Optional: Remove or comment out these lines to force provisioning mode
// #define WIFI_SSID "YOUR_SSID"
// #define WIFI_PASSWORD "YOUR_PASSWORD"
```

### 2. Flash the Firmware

**Using Arduino IDE:**
1. Open `vibemon-app.ino`
2. Select board: ESP32C6 Dev Module
3. Select port: Your ESP32 COM/USB port
4. Click Upload

**Using PlatformIO:**
```bash
pio run --target upload
```

## Test Cases

### Test 1: First Boot (No Credentials)

**Expected Behavior:**
1. Device starts in provisioning mode
2. LCD displays:
   ```
   Setup Mode
   SSID: VibeMon-Setup
   Password: vibemon123
   IP: 192.168.4.1
   ```
3. Access point `VibeMon-Setup` is visible in WiFi networks

**Steps:**
1. Flash firmware to device
2. Power on device
3. Check LCD display matches expected output
4. Verify AP is visible on phone/computer WiFi list

**Pass Criteria:**
- ✅ Display shows "Setup Mode"
- ✅ SSID "VibeMon-Setup" appears in WiFi scan
- ✅ Can connect to AP using password "vibemon123"

### Test 2: Captive Portal Access

**Expected Behavior:**
1. Captive portal opens automatically after connecting to AP
2. If not automatic, can access via http://192.168.4.1
3. Configuration page loads with network scan button

**Steps:**
1. Connect to "VibeMon-Setup" network (password: vibemon123)
2. Wait for captive portal to open (or navigate to 192.168.4.1)
3. Verify page displays "VibeMon WiFi Setup" header
4. Click "🔍 Scan Networks" button

**Pass Criteria:**
- ✅ Captive portal opens automatically OR
- ✅ Page accessible at 192.168.4.1
- ✅ Scan button clickable
- ✅ Networks list populates after scan

### Test 3: WiFi Network Scanning

**Expected Behavior:**
1. Scan detects available WiFi networks
2. Networks displayed with signal strength
3. Secure networks show lock icon

**Steps:**
1. Click "🔍 Scan Networks"
2. Wait for scan to complete
3. Verify your WiFi network appears in list

**Pass Criteria:**
- ✅ Scan completes within 10 seconds
- ✅ Known WiFi networks appear in dropdown
- ✅ Signal strength icons displayed
- ✅ Lock icon shows for WPA2/WPA3 networks

### Test 4: Save Credentials (Valid Network)

**Expected Behavior:**
1. Credentials saved to flash memory
2. Device reboots
3. Connects to specified WiFi network
4. HTTP server starts on connected IP

**Steps:**
1. Select your WiFi network from dropdown
2. Enter correct WiFi password
3. Click "💾 Save & Connect"
4. Wait for device to reboot (automatic)
5. Check LCD display for connection status

**Pass Criteria:**
- ✅ Success message displayed
- ✅ Device reboots within 2 seconds
- ✅ LCD shows "WiFi: OK"
- ✅ LCD displays assigned IP address
- ✅ Can access device at http://DEVICE_IP/health

### Test 5: Save Credentials (Invalid Password)

**Expected Behavior:**
1. Connection fails
2. Credentials cleared
3. Device returns to provisioning mode

**Steps:**
1. Select your WiFi network
2. Enter WRONG password
3. Click "💾 Save & Connect"
4. Wait for device to reboot and attempt connection
5. Verify device returns to provisioning mode

**Pass Criteria:**
- ✅ Device attempts connection
- ✅ Connection fails (as expected)
- ✅ Device returns to "Setup Mode"
- ✅ AP "VibeMon-Setup" available again

### Test 6: Credential Persistence

**Expected Behavior:**
1. Saved credentials persist after power cycle
2. Device connects automatically on boot

**Steps:**
1. Save valid WiFi credentials (Test 4)
2. Power off device (unplug)
3. Power on device
4. Verify connection without provisioning

**Pass Criteria:**
- ✅ Device connects without provisioning mode
- ✅ LCD shows "WiFi: OK" on boot
- ✅ Same IP address assigned (or new DHCP IP)

### Test 7: WiFi Reset Endpoint

**Expected Behavior:**
1. HTTP endpoint clears saved credentials
2. Device reboots to provisioning mode

**Steps:**
1. Ensure device is connected to WiFi (normal mode)
2. Note device IP address
3. Send reset command:
   ```bash
   curl -X POST http://DEVICE_IP/wifi-reset
   ```
4. Wait for device to reboot

**Pass Criteria:**
- ✅ HTTP response: `{"success":true,...}`
- ✅ Device reboots automatically
- ✅ Returns to provisioning mode
- ✅ AP "VibeMon-Setup" available

### Test 8: Default Credentials Fallback

**Expected Behavior:**
1. If credentials.h has WIFI_SSID defined
2. First boot uses these as defaults
3. No provisioning mode on first boot

**Steps:**
1. Edit `credentials.h`:
   ```cpp
   #define USE_WIFI
   #define WIFI_SSID "YourNetwork"
   #define WIFI_PASSWORD "YourPassword"
   ```
2. Flash firmware
3. Clear saved credentials (if any):
   ```bash
   # Send reset first or use fresh device
   ```
4. Power on device

**Pass Criteria:**
- ✅ Device attempts connection to defined SSID
- ✅ No provisioning mode (if credentials valid)
- ✅ Falls back to provisioning if credentials invalid

### Test 9: Serial Monitor Output

**Expected Behavior:**
1. Device logs provisioning events
2. JSON format logging

**Steps:**
1. Connect serial monitor at 115200 baud
2. Start provisioning mode
3. Monitor serial output

**Expected Output:**
```json
{"wifi":"provisioning_mode","ssid":"VibeMon-Setup"}
```

**Pass Criteria:**
- ✅ JSON formatted messages
- ✅ Provisioning mode logged
- ✅ No error messages

### Test 10: Multiple Devices

**Expected Behavior:**
1. Each device can be configured independently
2. Multiple devices can be in provisioning mode simultaneously

**Steps:**
1. Flash 2+ devices with same firmware
2. Power on all devices
3. Each should create AP with same SSID
4. Configure each device with different or same WiFi

**Pass Criteria:**
- ✅ All devices enter provisioning mode
- ✅ Can configure each independently
- ✅ All connect to respective WiFi networks

## Troubleshooting Tests

### Issue: Captive Portal Doesn't Open

**Debug Steps:**
1. Check mobile data is disabled
2. Try different device (iOS vs Android vs laptop)
3. Manually navigate to 192.168.4.1
4. Check DNS server logs in serial monitor

### Issue: Scan Shows No Networks

**Debug Steps:**
1. Verify WiFi antenna connected (if external)
2. Move device closer to router
3. Check serial monitor for scan errors
4. Try manual rescan

### Issue: Connection Fails with Correct Password

**Debug Steps:**
1. Verify SSID and password are correct
2. Check router supports 2.4GHz (ESP32-C6 limitation)
3. Disable MAC filtering temporarily
4. Check router logs

### Issue: Device Won't Enter Provisioning

**Debug Steps:**
1. Verify USE_WIFI is defined
2. Send /wifi-reset command
3. Manually clear NVS:
   ```bash
   # Use esptool.py to erase flash
   esptool.py --port COM_PORT erase_region 0x9000 0x6000
   ```

## Performance Benchmarks

Expected timings:
- **Boot to provisioning mode:** < 5 seconds
- **WiFi scan:** 3-8 seconds
- **Credential save + reboot:** < 3 seconds
- **Connection to WiFi:** 5-15 seconds
- **Total setup time:** < 30 seconds

## Security Testing

### Test: AP Password Protection

**Steps:**
1. Try connecting without password
2. Try with wrong password
3. Verify connection only works with "vibemon123"

### Test: Credential Storage

**Steps:**
1. Save credentials
2. Use esptool to dump NVS partition
3. Verify credentials stored (but not in plain text if possible)

## Regression Testing

After any code changes, re-run:
- Test 1 (First boot)
- Test 4 (Valid credentials)
- Test 6 (Persistence)
- Test 7 (Reset)

## Test Report Template

```markdown
## WiFi Provisioning Test Report

**Date:** YYYY-MM-DD
**Firmware Version:** vX.X.X
**Device:** ESP32-C6-LCD-1.47
**Tester:** Name

### Results

| Test | Status | Notes |
|------|--------|-------|
| Test 1: First Boot | ✅ PASS | |
| Test 2: Captive Portal | ✅ PASS | |
| Test 3: Network Scan | ✅ PASS | |
| Test 4: Save Credentials | ✅ PASS | |
| Test 5: Invalid Password | ✅ PASS | |
| Test 6: Persistence | ✅ PASS | |
| Test 7: WiFi Reset | ✅ PASS | |
| Test 8: Default Fallback | ✅ PASS | |
| Test 9: Serial Logging | ✅ PASS | |
| Test 10: Multiple Devices | ⏭️ SKIP | Only 1 device |

### Issues Found
- None / List issues here

### Performance
- Boot time: X seconds
- Scan time: X seconds
- Total setup: X seconds

### Conclusion
All tests passed / Issues need fixing
```

## Automated Testing

For CI/CD, consider:
- Arduino CLI syntax check
- PlatformIO build verification
- Static analysis with cppcheck

```bash
# Syntax check
arduino-cli compile --fqbn esp32:esp32:esp32c6 vibemon-app.ino

# Build check
pio run -e esp32-c6
```
