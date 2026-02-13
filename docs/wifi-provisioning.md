# WiFi Provisioning

VibeMon ESP32 devices support automatic WiFi provisioning through a captive portal interface. This makes it easy to configure WiFi credentials without hardcoding them in the firmware.

## How It Works

When the ESP32 device has no saved WiFi credentials, it automatically enters **Provisioning Mode**:

1. **Access Point Created**: The device creates its own WiFi network
   - SSID: `VibeMon-Setup`
   - Password: `vibemon123`

2. **Captive Portal**: Connect to the network and a configuration page opens automatically
   - If it doesn't open, navigate to: `http://192.168.4.1`

3. **Configure WiFi**: 
   - Scan for available networks
   - Select your WiFi network
   - Enter the password
   - Click "Save & Connect"

4. **Automatic Connection**: Device saves credentials and reboots to connect to your WiFi

## First-Time Setup

### Option 1: Provisioning Mode (Recommended)

1. Flash the firmware with `USE_WIFI` enabled in `credentials.h`
2. Power on the device
3. Look for the WiFi network `VibeMon-Setup`
4. Connect using password `vibemon123`
5. Follow the captive portal instructions

### Option 2: Hardcoded Credentials

1. Copy `credentials.h.example` to `credentials.h`
2. Uncomment `#define USE_WIFI`
3. Set `WIFI_SSID` and `WIFI_PASSWORD`
4. Flash the firmware
5. Device will connect automatically

## Display Information

In provisioning mode, the LCD displays:
```
Setup Mode
SSID: VibeMon-Setup
Password: vibemon123
IP: 192.168.4.1
```

After successful connection:
```
WiFi: OK
IP: 192.168.x.x
```

## WiFi Management

### Reset WiFi Credentials

To clear saved credentials and restart provisioning:

```bash
curl -X POST http://DEVICE_IP/wifi-reset
```

The device will:
1. Clear saved WiFi credentials from flash memory
2. Reboot into provisioning mode
3. Create the `VibeMon-Setup` access point again

### Check Connection Status

```bash
curl http://DEVICE_IP/health
```

Returns:
```json
{
  "status": "ok"
}
```

## Credential Storage

WiFi credentials are stored in the ESP32's NVS (Non-Volatile Storage) flash memory and persist across:
- Device reboots
- Power cycles
- Firmware updates (if not doing a full flash erase)

Storage location:
- Namespace: `vibemon`
- Keys: `wifiSSID`, `wifiPassword`

## Security Considerations

1. **Default AP Password**: The provisioning access point uses a default password (`vibemon123`). This is only active during initial setup.

2. **HTTPS**: The configuration page uses HTTP (not HTTPS) since it's served locally from the device.

3. **Credential Storage**: WiFi passwords are stored in flash memory. While ESP32's NVS has encryption support, it's not enabled by default in this implementation.

4. **Network Security**: Once connected to your WiFi, ensure your network has WPA2/WPA3 encryption enabled.

## Troubleshooting

### Captive Portal Doesn't Open

1. Manually navigate to `http://192.168.4.1`
2. Disable mobile data on your phone
3. Try a different device

### Connection Fails

If the device can't connect to your WiFi:
1. It will automatically clear credentials
2. Reboot into provisioning mode
3. Try again with correct credentials

### Scan Shows No Networks

1. Click "🔍 Scan Networks" again
2. Move device closer to WiFi router
3. Ensure WiFi router is powered on

### Device Won't Enter Provisioning Mode

1. Flash the firmware with `USE_WIFI` enabled
2. Use `/wifi-reset` endpoint to clear credentials
3. Power cycle the device

## Technical Details

### Libraries Used

- `WiFi.h` - ESP32 WiFi driver
- `WebServer.h` - HTTP server
- `DNSServer.h` - DNS server for captive portal
- `Preferences.h` - NVS storage

### Code Flow

```
setup()
  └─> setupWiFi()
      ├─> loadWiFiCredentials()
      ├─> if (no credentials) → startProvisioningMode()
      │   ├─> WiFi.softAP()
      │   ├─> dnsServer.start()
      │   └─> setupProvisioningServer()
      └─> else → WiFi.begin(ssid, password)
          ├─> if connected → setup HTTP server
          └─> if failed → restart provisioning

loop()
  └─> if provisioningMode
      └─> dnsServer.processNextRequest()
```

### API Endpoints (Provisioning Mode)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/*` | GET | Configuration page (captive portal) |
| `/scan` | GET | Scan and list WiFi networks |
| `/save` | POST | Save credentials and reboot |

### API Endpoints (Normal Mode)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/wifi-reset` | POST | Clear credentials and reboot to provisioning |
| All other endpoints | - | Standard VibeMon API |

## Example: Automated Setup

For production deployments, you can pre-configure devices:

```bash
# Set credentials via API (requires device to be in provisioning mode)
curl -X POST http://192.168.4.1/save \
  -d "ssid=MyNetwork&password=MyPassword"
```

Or use default credentials in `credentials.h` for initial deployment, then update via provisioning as needed.
