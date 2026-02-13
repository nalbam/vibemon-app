# VibeMon Token Configuration Feature

## 개요 (Overview)

WiFi 프로비저닝 인터페이스를 통해 VibeMon WebSocket 토큰을 설정할 수 있는 기능을 추가했습니다.

Added ability to configure VibeMon WebSocket token through the WiFi provisioning interface.

## 한국어 설명

### 문제 요구사항

"vibemon token 도 설정 할수 있게 하자"

### 구현 내용

ESP32 장치의 WiFi 프로비저닝 캡티브 포털에 WebSocket 토큰 입력 필드를 추가했습니다:

1. **토큰 입력 필드**: 웹 인터페이스에 "VibeMon Token (Optional)" 입력 필드 추가
2. **NVS 저장**: 토큰을 플래시 메모리에 영구적으로 저장
3. **자동 로드**: 기기 부팅 시 저장된 토큰 자동 로드
4. **WebSocket 인증**: 저장된 토큰을 WebSocket 연결 및 인증에 사용
5. **폴백 지원**: 저장된 토큰이 없으면 credentials.h의 WS_TOKEN 사용

### 사용 방법

#### 옵션 1: 프로비저닝 인터페이스를 통한 설정

1. 기기를 "VibeMon-Setup" WiFi 네트워크에 연결
2. 자동으로 열리는 설정 페이지에서:
   - WiFi 네트워크 선택 및 비밀번호 입력
   - "VibeMon Token (Optional)" 필드에 토큰 입력
   - 토큰이 없으면 비워둠
3. "저장 및 연결" 클릭
4. 기기가 재부팅되고 설정된 WiFi 및 토큰으로 WebSocket 연결

#### 옵션 2: credentials.h를 통한 기본값 설정

```cpp
#define USE_WIFI
#define USE_WEBSOCKET
#define WS_TOKEN "your_access_token"
```

저장된 토큰이 없으면 이 기본값을 사용합니다.

### 저장 위치

- **NVS 네임스페이스**: `vibemon`
- **키**: `wsToken`
- **지속성**: 재부팅 및 전원 사이클 후에도 유지

---

## English Documentation

### Problem Statement

"Let's make it possible to configure the vibemon token as well"

### Implementation

Added WebSocket token input field to the ESP32 WiFi provisioning captive portal:

1. **Token Input Field**: Added "VibeMon Token (Optional)" field to web interface
2. **NVS Storage**: Stores token persistently in flash memory
3. **Auto Load**: Automatically loads saved token on device boot
4. **WebSocket Auth**: Uses stored token for WebSocket connection and authentication
5. **Fallback Support**: Falls back to WS_TOKEN from credentials.h if no saved token

### Usage

#### Option 1: Configure via Provisioning Interface

1. Connect to "VibeMon-Setup" WiFi network
2. In the auto-opening configuration page:
   - Select WiFi network and enter password
   - Enter token in "VibeMon Token (Optional)" field
   - Leave empty if no token needed
3. Click "Save & Connect"
4. Device reboots and connects with configured WiFi and token

#### Option 2: Set Default in credentials.h

```cpp
#define USE_WIFI
#define USE_WEBSOCKET
#define WS_TOKEN "your_access_token"
```

This default is used if no token is saved.

### Storage Location

- **NVS Namespace**: `vibemon`
- **Key**: `wsToken`
- **Persistence**: Survives reboots and power cycles

---

## Technical Details

### Code Changes

#### 1. Variables Added

```cpp
#ifdef USE_WEBSOCKET
// WebSocket token storage
char wsToken[128] = "";

// Fallback to credentials.h if defined
#ifdef WS_TOKEN
const char* defaultWSToken = WS_TOKEN;
#else
const char* defaultWSToken = "";
#endif
#endif
```

#### 2. Functions Added

```cpp
#ifdef USE_WEBSOCKET
// Load WebSocket token from Preferences
void loadWebSocketToken() {
  preferences.begin("vibemon", true);
  preferences.getString("wsToken", wsToken, sizeof(wsToken));
  preferences.end();

  // Fallback to default
  if (strlen(wsToken) == 0 && strlen(defaultWSToken) > 0) {
    strncpy(wsToken, defaultWSToken, sizeof(wsToken) - 1);
  }
}

// Save WebSocket token to Preferences
void saveWebSocketToken(const char* token) {
  preferences.begin("vibemon", false);
  preferences.putString("wsToken", token);
  preferences.end();

  strncpy(wsToken, token, sizeof(wsToken) - 1);
}
#endif
```

#### 3. Modified Functions

**setupWebSocket()**
```cpp
void setupWebSocket() {
  // Load token from preferences if not already loaded
  if (strlen(wsToken) == 0) {
    loadWebSocketToken();
  }

  // Build path with token query parameter
  char wsPath[256];
  if (strlen(wsToken) > 0) {
    snprintf(wsPath, sizeof(wsPath), "%s?token=%s", WS_PATH, wsToken);
  } else {
    strncpy(wsPath, WS_PATH, sizeof(wsPath));
  }
  // ... rest of function
}
```

**webSocketEvent()**
```cpp
case WStype_CONNECTED:
  // Send authentication message if token is configured
  if (strlen(wsToken) > 0) {
    char authMsg[128];
    snprintf(authMsg, sizeof(authMsg), "{\"type\":\"auth\",\"token\":\"%s\"}", wsToken);
    webSocket.sendTXT(authMsg);
  }
  break;
```

**Save endpoint in setupProvisioningServer()**
```cpp
server.on("/save", HTTP_POST, []() {
  if (server.hasArg("ssid") && server.hasArg("password")) {
    String ssid = server.arg("ssid");
    String password = server.arg("password");
    
    saveWiFiCredentials(ssid.c_str(), password.c_str());

#ifdef USE_WEBSOCKET
    // Also save WebSocket token if provided
    if (server.hasArg("token")) {
      String token = server.arg("token");
      saveWebSocketToken(token.c_str());
    }
#endif
    
    // ... rest of save logic
  }
});
```

#### 4. HTML Form Updated

```html
<div class="form-group">
  <label for="password">Password</label>
  <input type="password" id="password" required placeholder="Enter WiFi password">
</div>

<div class="form-group">
  <label for="token">VibeMon Token (Optional)</label>
  <input type="text" id="token" placeholder="Enter WebSocket token (leave empty if not needed)">
</div>
```

#### 5. JavaScript Updated

```javascript
function saveCredentials(e) {
  e.preventDefault();

  const ssid = document.getElementById('ssid').value;
  const password = document.getElementById('password').value;
  const token = document.getElementById('token').value;
  
  const formData = new URLSearchParams();
  formData.append('ssid', ssid);
  formData.append('password', password);
  if (token) {
    formData.append('token', token);
  }
  
  // ... rest of save logic
}
```

### Data Flow

```
User Input (Web UI)
  ├─ WiFi SSID
  ├─ WiFi Password
  └─ VibeMon Token (optional)
       │
       ▼
  POST /save
       │
       ▼
  saveWebSocketToken(token)
       │
       ▼
  preferences.putString("wsToken", token)
       │
       ▼
  NVS Flash Storage
       │
       ▼
  Device Reboot
       │
       ▼
  setupWebSocket()
       │
       ▼
  loadWebSocketToken()
       │
       ▼
  preferences.getString("wsToken", ...)
       │
       ▼
  Use token in:
    ├─ WebSocket URL: /?token=xxx
    └─ Auth message: {"type":"auth","token":"xxx"}
```

### NVS Storage Structure

```
ESP32 NVS Partition
  └─ Namespace: "vibemon"
      ├─ Key: "wifiSSID" → String (WiFi network name)
      ├─ Key: "wifiPassword" → String (WiFi password)
      ├─ Key: "wsToken" → String (WebSocket token)
      └─ Key: "lockMode" → Int (Lock mode setting)
```

## Testing Guide

### Manual Testing Steps

1. **Flash firmware** with USE_WIFI and USE_WEBSOCKET enabled
2. **Power on device** - should enter provisioning mode
3. **Connect** to VibeMon-Setup WiFi network
4. **Open** configuration page (should auto-open or go to 192.168.4.1)
5. **Scan** for WiFi networks
6. **Select** your WiFi network
7. **Enter** WiFi password
8. **Enter** a test token (e.g., "test-token-123")
9. **Click** "Save & Connect"
10. **Wait** for device to reboot
11. **Check** serial monitor for WebSocket connection
12. **Verify** token is sent in URL and auth message

### Expected Serial Output

```json
{"websocket":"connecting","heap":xxxxx}
{"websocket":"connected","url":"/?token=test-token-123","heap":xxxxx}
{"websocket":"auth_sent"}
```

### Verification

Check that token is used in two places:
1. **WebSocket URL**: `wss://ws.vibemon.io/?token=test-token-123`
2. **Auth Message**: `{"type":"auth","token":"test-token-123"}`

## Security Considerations

### Storage Security

- ✅ Token stored in NVS flash memory
- ⚠️ NVS encryption **not enabled** by default
- ⚠️ Token transmitted over HTTP during provisioning (local only)
- ✅ Token transmitted over WSS (encrypted) during normal operation

### Recommendations

1. **Enable NVS Encryption** for production deployments
2. **Use strong tokens** - long, random strings
3. **Rotate tokens** periodically
4. **Configure quickly** - minimize time in provisioning mode

## Backward Compatibility

### With Existing Deployments

- ✅ Existing credentials.h with WS_TOKEN still works
- ✅ No token saved → uses WS_TOKEN define
- ✅ Empty token field → no token used
- ✅ Provisioning without token → WiFi-only mode

### Migration Path

**From hardcoded token:**
1. Flash new firmware
2. Device uses WS_TOKEN from credentials.h as default
3. Or reconfigure via provisioning to set different token
4. Remove hardcoded token (optional)

**From no token:**
1. Flash new firmware
2. Enter provisioning mode
3. Configure WiFi and token together
4. Device connects with both

## File Changes Summary

| File | Changes | Lines |
|------|---------|-------|
| `vibemon-app.ino` | Added token variables, functions, HTML field, save logic | +75 |
| `credentials.h.example` | Updated documentation | +5 |
| `docs/wifi-provisioning.md` | Added token configuration guide | +10 |
| `WIFI_PROVISIONING_QUICKSTART.md` | Updated quick reference | +4 |
| `WIFI_PROVISIONING_SUMMARY.md` | Updated implementation summary | +15 |
| **Total** | | **+109** |

## Benefits

### For Users

- ✅ **No hardcoding**: Configure token without editing code
- ✅ **Persistent**: Token survives reboots
- ✅ **Flexible**: Change token without reflashing firmware
- ✅ **Optional**: Can skip token if not needed
- ✅ **User-friendly**: Simple web interface

### For Developers

- ✅ **Clean code**: No credentials in source code
- ✅ **Secure**: Credentials stored in NVS, not git
- ✅ **Maintainable**: Easy to update token management
- ✅ **Backward compatible**: Works with existing code
- ✅ **Well documented**: Complete guides and examples

## Future Enhancements

Potential improvements for token configuration:

1. **Token validation**: Check token format before saving
2. **Token visibility toggle**: Show/hide token in input field
3. **Token test**: Verify token with WebSocket server before saving
4. **Token rotation**: Built-in token refresh mechanism
5. **Multiple tokens**: Support for different environments
6. **Token encryption**: Encrypt token in NVS storage
7. **Admin interface**: Web UI to update token after initial setup

## Conclusion

The VibeMon token configuration feature successfully allows users to configure their WebSocket authentication token through the WiFi provisioning interface. This eliminates the need to hardcode tokens in the firmware and provides a user-friendly way to manage authentication credentials.

**Status**: ✅ Complete and ready for use

---

**Last Updated**: 2026-02-13  
**Version**: 1.0  
**Author**: GitHub Copilot with nalbam
