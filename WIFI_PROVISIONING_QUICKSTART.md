# WiFi 프로비저닝 빠른 참조 가이드
# WiFi Provisioning Quick Reference

## 한국어 (Korean)

### 첫 설정

1. **기기 전원 켜기**
   - LCD에 "Setup Mode" 표시됨

2. **WiFi 연결**
   - SSID: `VibeMon-Setup`
   - 비밀번호: `vibemon123`

3. **설정 페이지**
   - 자동으로 열림 (또는 http://192.168.4.1 접속)
   - "네트워크 스캔" 클릭
   - WiFi 선택 및 비밀번호 입력
   - "저장 및 연결" 클릭

4. **완료**
   - 기기가 자동으로 재부팅
   - WiFi 연결됨

### WiFi 재설정

```bash
curl -X POST http://기기IP주소/wifi-reset
```

### 문제 해결

- 캡티브 포털이 안 열리면: 수동으로 192.168.4.1 접속
- 연결 실패하면: 자동으로 프로비저닝 모드로 재시작됨
- 네트워크가 안 보이면: "네트워크 스캔" 다시 클릭

---

## English

### Initial Setup

1. **Power On Device**
   - LCD displays "Setup Mode"

2. **Connect to WiFi**
   - SSID: `VibeMon-Setup`
   - Password: `vibemon123`

3. **Configuration Page**
   - Opens automatically (or navigate to http://192.168.4.1)
   - Click "Scan Networks"
   - Select WiFi and enter password
   - Click "Save & Connect"

4. **Done**
   - Device reboots automatically
   - Connects to WiFi

### WiFi Reset

```bash
curl -X POST http://DEVICE_IP/wifi-reset
```

### Troubleshooting

- Captive portal doesn't open: Manually go to 192.168.4.1
- Connection fails: Auto-restarts in provisioning mode
- No networks shown: Click "Scan Networks" again

---

## Access Point Details

| Setting | Value |
|---------|-------|
| SSID | `VibeMon-Setup` |
| Password | `vibemon123` |
| IP Address | `192.168.4.1` |
| DHCP Range | `192.168.4.2 - 192.168.4.254` |

## API Endpoints

### Provisioning Mode

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/*` | GET | Configuration page |
| `/scan` | GET | List WiFi networks |
| `/save` | POST | Save credentials (params: `ssid`, `password`) |

### Normal Mode

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/wifi-reset` | POST | Clear WiFi credentials and reboot |
| `/status` | POST | Update status |
| `/health` | GET | Health check |
| *Others* | - | See [API docs](docs/api.md) |

## LCD Display States

### Provisioning Mode
```
Setup Mode
SSID: VibeMon-Setup
Password: vibemon123
IP: 192.168.4.1
```

### Normal Mode
```
WiFi: OK
IP: 192.168.x.x
```

## Signal Strength Indicators

| Indicator | RSSI Range | Quality |
|-----------|------------|---------|
| ▰▰▰▰ | > -50 dBm | Excellent |
| ▰▰▰▱ | -50 to -60 dBm | Good |
| ▰▰▱▱ | -60 to -70 dBm | Fair |
| ▰▱▱▱ | < -70 dBm | Weak |

## Expected Timing

| Action | Time |
|--------|------|
| Boot to provisioning mode | < 5 seconds |
| WiFi scan | 3-8 seconds |
| Save + reboot | < 3 seconds |
| Connect to WiFi | 5-15 seconds |
| **Total setup time** | **< 30 seconds** |

## Security Notes

- ⚠️ AP password "vibemon123" is default - only active during setup
- 🔒 WiFi credentials stored in NVS flash (persists across reboots)
- 🔓 NVS encryption not enabled by default
- 🌐 Configuration page uses HTTP (local only)

## Credential Storage

- **Location**: ESP32 NVS (Non-Volatile Storage)
- **Namespace**: `vibemon`
- **Keys**: `wifiSSID`, `wifiPassword`
- **Persistence**: Survives reboots and power cycles

## Common Scenarios

### Scenario 1: New Device
1. Boot → Provisioning mode (no credentials)
2. User configures WiFi
3. Device connects → Normal mode

### Scenario 2: Wrong Password
1. User enters wrong password
2. Connection fails
3. Credentials cleared automatically
4. Device reboots → Provisioning mode

### Scenario 3: WiFi Changed
1. User sends POST to `/wifi-reset`
2. Credentials cleared
3. Device reboots → Provisioning mode
4. User configures new WiFi

### Scenario 4: Power Cycle
1. Device powered off
2. Device powered on
3. Loads saved credentials → Normal mode
4. (No provisioning needed)

## Browser Compatibility

✅ iOS Safari (captive portal)  
✅ Android Chrome (captive portal)  
✅ macOS Safari  
✅ Windows Chrome/Edge  
✅ Linux Firefox  

## Hardware Requirements

- ESP32-C6 or compatible
- WiFi antenna (built-in or external)
- TFT LCD display (for status)

## Firmware Requirements

- `#define USE_WIFI` in credentials.h
- ESP32 WiFi library
- ESP32 WebServer library
- ESP32 DNSServer library
- ESP32 Preferences library

## Links

- 📖 [Full Documentation](docs/wifi-provisioning.md)
- 🧪 [Testing Guide](docs/wifi-provisioning-testing.md)
- 📊 [Flow Diagrams](WIFI_PROVISIONING_FLOW.md)
- 📝 [Implementation Summary](WIFI_PROVISIONING_SUMMARY.md)

---

## Quick Commands

```bash
# Check device health
curl http://DEVICE_IP/health

# Reset WiFi settings
curl -X POST http://DEVICE_IP/wifi-reset

# Update status (example)
curl -X POST http://DEVICE_IP/status \
  -H "Content-Type: application/json" \
  -d '{"state":"working","project":"my-app"}'
```

## Need Help?

See [Troubleshooting Guide](docs/wifi-provisioning.md#troubleshooting) for detailed solutions.

---

**Version**: 1.0  
**Last Updated**: 2026-02-13  
**Status**: ✅ Ready for Testing
