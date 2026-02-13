# ESP32 WiFi & WebSocket Setup

VibeMon ESP32 devices support automatic WiFi and WebSocket token configuration through a captive portal web interface. No need to hardcode credentials in the firmware!

## Quick Start

### First-Time Setup (Recommended)

1. **Flash Firmware**
   ```bash
   cp credentials.h.example credentials.h
   # Flash to ESP32 (WiFi and WebSocket enabled by default)
   ```

2. **Connect to Setup Network**
   - SSID: `VibeMon-Setup`
   - Password: `vibemon123`

3. **Configure via Web Interface**
   - Captive portal opens automatically (or go to `http://192.168.4.1`)
   - Scan and select your WiFi network
   - Enter WiFi password
   - (Optional) Enter VibeMon WebSocket token
   - Click "Save & Connect"

4. **Done!**
   - Device reboots and connects to your WiFi
   - Settings persist across reboots

## How It Works

### Provisioning Mode

When the device has no saved WiFi credentials, it automatically enters **Provisioning Mode**:

```
┌─────────────────────────────────────────┐
│  No WiFi credentials detected           │
│         ↓                                │
│  Create Access Point                    │
│  - SSID: VibeMon-Setup                  │
│  - Password: vibemon123                 │
│  - IP: 192.168.4.1                      │
│         ↓                                │
│  DNS Server (Captive Portal)            │
│         ↓                                │
│  User connects & configures             │
│         ↓                                │
│  Save to NVS Flash → Reboot             │
│         ↓                                │
│  Connect to configured WiFi             │
└─────────────────────────────────────────┘
```

### Web Configuration Interface

**Features:**
- 📡 WiFi network scanning with signal strength
- 🔒 Security indicator for protected networks
- 🎨 Responsive design (works on phones & computers)
- 🔑 Optional WebSocket token configuration
- ✅ Form validation and error handling

**Fields:**
1. **WiFi Network** - Dropdown list of scanned networks
2. **Password** - WiFi password (required)
3. **VibeMon Token** - WebSocket token (optional)

### Data Storage

Credentials are stored in ESP32's **NVS (Non-Volatile Storage)**:

| Key | Type | Description |
|-----|------|-------------|
| `wifiSSID` | String | WiFi network name |
| `wifiPassword` | String | WiFi password |
| `wsToken` | String | WebSocket authentication token |

**Persistence:**
- ✅ Survives reboots
- ✅ Survives power cycles
- ✅ Survives firmware updates (if not doing full erase)

## Setup Options

### Option 1: Provisioning Mode (Recommended)

**Best for:** New devices, easy setup, changing WiFi networks

```bash
# 1. Copy credentials template
cp credentials.h.example credentials.h

# 2. Flash firmware (USE_WIFI and USE_WEBSOCKET enabled by default)

# 3. Power on device → Automatically enters provisioning mode

# 4. Connect to VibeMon-Setup and configure via web
```

### Option 2: Hardcoded Credentials

**Best for:** Production deployments, known WiFi networks

```cpp
// credentials.h
#define USE_WIFI
#define USE_WEBSOCKET

#define WIFI_SSID "MyNetwork"
#define WIFI_PASSWORD "MyPassword"
#define WS_TOKEN "my-secret-token"  // Optional
```

These are used as **defaults** if no saved credentials exist.

## LCD Display States

### Provisioning Mode
```
┌─────────────────────┐
│  Setup Mode         │
│  SSID: VibeMon-Setup│
│  Password: vibemon123│
│  IP: 192.168.4.1   │
│                     │
│  [Character]        │
└─────────────────────┘
```

### Normal Mode
```
┌─────────────────────┐
│  WiFi: OK           │
│  IP: 192.168.1.42   │
│                     │
│  [Character]        │
│  Status: working    │
└─────────────────────┘
```

## WiFi Management

### Reset WiFi Settings

Clear saved credentials and return to provisioning mode:

```bash
curl -X POST http://DEVICE_IP/wifi-reset
```

Device will:
1. Clear `wifiSSID`, `wifiPassword`, `wsToken` from NVS
2. Reboot automatically
3. Enter provisioning mode

### Check Connection

```bash
curl http://DEVICE_IP/health
# Returns: {"status":"ok"}
```

## WebSocket Token Configuration

### What is the WebSocket Token?

The token is used for **authentication** when connecting to VibeMon WebSocket servers:
- Added to WebSocket URL: `wss://ws.vibemon.io/?token=YOUR_TOKEN`
- Sent in auth message: `{"type":"auth","token":"YOUR_TOKEN"}`

### Setting the Token

**Via Provisioning Interface:**
1. Enter token in "VibeMon Token (Optional)" field
2. Leave empty if not needed
3. Token saved to NVS flash

**Via credentials.h:**
```cpp
#define WS_TOKEN "your_access_token"
```

**Priority:** Saved token in NVS > WS_TOKEN define

## Troubleshooting

### Captive Portal Doesn't Open

**Solutions:**
1. Manually navigate to `http://192.168.4.1`
2. Disable mobile data on your phone
3. Try a different device (iOS/Android/laptop)

### WiFi Connection Fails

**What happens:**
1. Device attempts to connect with provided credentials
2. If connection fails after 20 attempts
3. Credentials automatically cleared from NVS
4. Device reboots into provisioning mode

**Check:**
- Correct WiFi password
- WiFi network uses 2.4GHz (ESP32 doesn't support 5GHz)
- Router is powered on and in range

### No Networks in Scan

**Solutions:**
1. Click "🔍 Scan Networks" again
2. Move device closer to WiFi router
3. Ensure WiFi router is broadcasting SSID

### Device Won't Enter Provisioning Mode

**Solutions:**
1. Ensure `USE_WIFI` is defined in `credentials.h`
2. Use `/wifi-reset` endpoint to clear credentials
3. Power cycle the device
4. Manually erase NVS:
   ```bash
   esptool.py --port /dev/ttyUSB0 erase_region 0x9000 0x6000
   ```

## Technical Details

### API Endpoints

**Provisioning Mode:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/*` | GET | Configuration page (HTML) |
| `/scan` | GET | WiFi networks list (JSON) |
| `/save` | POST | Save WiFi + token, reboot |

**Normal Mode:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/wifi-reset` | POST | Clear credentials, restart provisioning |
| `/status` | POST | Update device status |
| `/health` | GET | Health check |

### Signal Strength Indicators

| Indicator | RSSI Range | Quality |
|-----------|------------|---------|
| ▰▰▰▰ | > -50 dBm | Excellent |
| ▰▰▰▱ | -50 to -60 dBm | Good |
| ▰▰▱▱ | -60 to -70 dBm | Fair |
| ▰▱▱▱ | < -70 dBm | Weak |

### Code Flow

```cpp
void setup() {
  // Load WiFi credentials from NVS
  loadWiFiCredentials();
  
  if (strlen(wifiSSID) == 0) {
    // No credentials → Start provisioning
    startProvisioningMode();
  } else {
    // Try to connect
    WiFi.begin(wifiSSID, wifiPassword);
    
    if (connection fails) {
      // Clear NVS and restart provisioning
      clearCredentials();
      ESP.restart();
    }
  }
}

void setupWebSocket() {
  // Load token from NVS (or use WS_TOKEN define as fallback)
  loadWebSocketToken();
  
  // Add token to WebSocket URL
  snprintf(wsPath, "/?token=%s", wsToken);
  
  // Connect to WebSocket server
  webSocket.beginSSL(WS_HOST, WS_PORT, wsPath);
}
```

### Security Considerations

**Security Measures:**
- ✅ SSID values escaped to prevent JSON injection
- ✅ Input validation on server side
- ✅ Provisioning only active during setup (temporary)

**Security Limitations:**
- ⚠️ Default AP password (`vibemon123`) is known - configure quickly!
- ⚠️ Configuration page uses HTTP (local only, acceptable for captive portal)
- ⚠️ Credentials stored in NVS without encryption (ESP32 supports NVS encryption but not enabled by default)
- ⚠️ WiFi password visible during provisioning

**Recommendations:**
1. Connect to provisioning AP quickly to minimize exposure
2. Use strong WiFi password with WPA2/WPA3
3. Use strong WebSocket tokens
4. Consider enabling NVS encryption for production

## Advanced Configuration

### Disable WiFi/WebSocket

To disable features, edit `credentials.h`:

```cpp
// Disable WiFi
// #define USE_WIFI

// Disable WebSocket (WiFi still works)
// #define USE_WEBSOCKET
```

### Custom Access Point Settings

To change the provisioning AP name/password, edit `vibemon-app.ino`:

```cpp
const char* AP_SSID = "MyCustomSSID";
const char* AP_PASSWORD = "MyCustomPassword";
```

### Multiple Devices

Each device can be configured independently:
1. Flash same firmware to multiple devices
2. Each enters provisioning mode on first boot
3. Configure each with same or different WiFi/tokens
4. All work independently

## Performance

**Expected Timing:**
- Boot to provisioning mode: < 5 seconds
- WiFi scan: 3-8 seconds
- Credential save + reboot: < 3 seconds
- Connect to WiFi: 5-15 seconds
- **Total setup time: < 30 seconds**

## Related Documentation

- [Main README](../README.md) - Project overview
- [API Reference](api.md) - Complete HTTP API documentation
- [Features](features.md) - Device features and states
