---
inclusion: always
---

# Vibe Monitor 코드 품질 표준

## 코드 스타일 가이드

### JavaScript/Node.js (Desktop App, Shared)

#### 1. 변수 및 함수 명명
```javascript
// ✅ 좋은 예
const currentState = 'idle';
const CHARACTER_CONFIG = { /* ... */ };
function updateTrayIcon() { /* ... */ }
function createTrayIcon(state, character) { /* ... */ }

// ❌ 나쁜 예
const s = 'idle';
const config = { /* ... */ };
function update() { /* ... */ }
function create(a, b) { /* ... */ }
```

#### 2. 상수 정의
```javascript
// ✅ 모든 상수는 대문자와 언더스코어 사용
const HTTP_PORT = 19280;
const CHAR_SIZE = 128;
const FLOAT_AMPLITUDE_X = 3;

// ✅ 색상 상수는 의미있는 이름 사용
const COLOR_CLAUDE = '#D97757';
const COLOR_KIRO = '#FFFFFF';
const COLOR_BG_WORKING = '#0066CC';
```

#### 3. 함수 구조
```javascript
// ✅ 단일 책임 원칙
function createTrayIcon(state, character = 'clawd') {
  const cacheKey = `${state}-${character}`;

  if (trayIconCache.has(cacheKey)) {
    return trayIconCache.get(cacheKey);
  }

  // 아이콘 생성 로직
  const icon = generateIcon(state, character);
  trayIconCache.set(cacheKey, icon);

  return icon;
}

// ✅ 에러 처리 포함
function updateState(data) {
  try {
    if (data.state !== undefined) {
      currentState = data.state;
      // 상태 업데이트 로직
    }

    if (mainWindow) {
      mainWindow.webContents.send('state-update', data);
    }
  } catch (error) {
    console.error('State update failed:', error);
  }
}
```

### C++ (ESP32 Firmware)

#### 1. 헤더 가드 및 인클루드
```cpp
#ifndef SPRITES_H
#define SPRITES_H

#include <Arduino.h>
#include <TFT_eSPI.h>

// 상수 정의
#define CHAR_WIDTH  128
#define CHAR_HEIGHT 128
#define SCALE       2
```

#### 2. 구조체 및 열거형
```cpp
// ✅ 명확한 구조체 정의
typedef struct {
  const char* name;
  uint16_t color;
  int bodyX, bodyY, bodyW, bodyH;
  bool isGhost;
  // ... 기타 필드
} CharacterGeometry;

// ✅ 열거형 사용
enum EyeType {
  EYE_SPARKLE,
  EYE_NORMAL,
  EYE_FOCUSED,
  EYE_ALERT,
  EYE_HAPPY,
  EYE_SLEEP
};
```

#### 3. 함수 명명 및 구조
```cpp
// ✅ 명확한 함수 이름과 매개변수
void drawCharacter(TFT_eSPI &tft, int x, int y, EyeType eyeType,
                   uint16_t bgColor, const CharacterGeometry* character = &CHAR_CLAWD);

// ✅ 헬퍼 함수 분리
int getFloatOffsetX() {
  float angle = (animFrame % 32) * (2.0 * PI / 32.0);
  return (int)(cos(angle) * FLOAT_AMPLITUDE_X);
}

// ✅ 상태 매핑 함수
uint16_t getBackgroundColor(String state) {
  if (state == "start") return COLOR_BG_SESSION;
  if (state == "idle") return COLOR_BG_IDLE;
  // ...
  return COLOR_BG_IDLE;  // 기본값
}
```

### Shell Script (Hooks)

#### 1. 함수 구조
```bash
# ✅ 명확한 함수 이름과 지역 변수
get_project_name() {
  local cwd="$1"
  local transcript_path="$2"

  if [ -n "$cwd" ]; then
    basename "$cwd"
  elif [ -n "$transcript_path" ]; then
    basename "$(dirname "$transcript_path")"
  fi
}

# ✅ 에러 처리
send_http() {
  local url="$1"
  local data="$2"

  curl -s -X POST "$url/status" \
    -H "Content-Type: application/json" \
    -d "$data" \
    --connect-timeout 2 \
    --max-time 5 \
    > /dev/null 2>&1
}
```

## 에러 처리 패턴

### 1. JavaScript 에러 처리
```javascript
// ✅ HTTP 서버 에러 처리
httpServer = http.createServer((req, res) => {
  try {
    // 요청 처리 로직
    const data = JSON.parse(body);
    updateState(data);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON' }));
  }
});

// ✅ 비동기 에러 처리
async function launchDesktop() {
  try {
    await exec(`${VIBE_MONITOR_DESKTOP}/start.sh`);
  } catch (error) {
    console.warn('Failed to launch desktop app:', error.message);
  }
}
```

### 2. C++ 에러 처리
```cpp
// ✅ JSON 파싱 에러 처리
void processInput(String input) {
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, input);

  if (error) {
    Serial.println("JSON parse error");
    return;
  }

  // 안전한 필드 접근
  currentState = doc["state"].as<String>();
  if (currentState.length() == 0) {
    currentState = "idle";  // 기본값
  }
}

// ✅ 하드웨어 초기화 에러 처리
void setup() {
  Serial.begin(115200);

  if (!tft.init()) {
    Serial.println("TFT init failed");
    return;
  }

  // 초기화 성공 시에만 계속 진행
  drawStartScreen();
}
```

### 3. Shell Script 에러 처리
```bash
# ✅ 명령어 실행 결과 확인
send_serial() {
  local port="$1"
  local data="$2"

  if [ -c "$port" ]; then
    stty -f "$port" 115200 2>/dev/null || stty -F "$port" 115200 2>/dev/null
    echo "$data" > "$port" 2>/dev/null
    return $?
  fi
  return 1
}

# ✅ 조건부 실행
if [ -n "${VIBE_MONITOR_URL}" ]; then
  if send_http "${VIBE_MONITOR_URL}" "$payload"; then
    debug_log "Sent to Desktop App"
  else
    debug_log "Desktop App failed"
  fi
fi
```

## 성능 최적화 패턴

### 1. 캐싱 전략
```javascript
// ✅ 메모리 캐시 사용
const trayIconCache = new Map();

function createTrayIcon(state, character) {
  const cacheKey = `${state}-${character}`;

  if (trayIconCache.has(cacheKey)) {
    return trayIconCache.get(cacheKey);
  }

  const icon = generateIcon(state, character);
  trayIconCache.set(cacheKey, icon);
  return icon;
}
```

### 2. 부분 업데이트
```cpp
// ✅ 변경된 부분만 업데이트
void updateAnimation() {
  int newCharX = CHAR_X_BASE + getFloatOffsetX();
  int newCharY = CHAR_Y_BASE + getFloatOffsetY();

  // 위치가 변경된 경우에만 다시 그리기
  if (newCharX != lastCharX || newCharY != lastCharY) {
    tft.fillRect(lastCharX, lastCharY, CHAR_WIDTH, CHAR_HEIGHT, bgColor);
    drawCharacter(tft, newCharX, newCharY, eyeType, bgColor, character);
    lastCharX = newCharX;
    lastCharY = newCharY;
  }
}
```

### 3. 리소스 관리
```javascript
// ✅ 서버 종료 시 리소스 정리
app.on('before-quit', () => {
  if (httpServer) {
    httpServer.close();
  }

  // 캐시 정리
  trayIconCache.clear();
});
```

## 테스트 가능한 코드 작성

### 1. 순수 함수 선호
```javascript
// ✅ 순수 함수 - 테스트하기 쉬움
function getWorkingText(tool) {
  const toolTexts = {
    'bash': ['Running', 'Executing', 'Processing'],
    'read': ['Reading', 'Scanning', 'Checking'],
    // ...
  };

  const texts = toolTexts[tool.toLowerCase()] || toolTexts.default;
  return texts[Math.floor(Math.random() * texts.length)];
}

// ✅ 상태 변환 함수
function mapEventToState(eventName) {
  const eventMap = {
    'SessionStart': 'start',
    'PreToolUse': 'working',
    'PostToolUse': 'done',
    // ...
  };

  return eventMap[eventName] || 'working';
}
```

### 2. 의존성 주입
```javascript
// ✅ 의존성을 매개변수로 받기
function createHttpServer(port, updateStateCallback) {
  return http.createServer((req, res) => {
    // ...
    updateStateCallback(data);
    // ...
  });
}

// 사용
const server = createHttpServer(HTTP_PORT, updateState);
```

## 문서화 표준

### 1. 함수 문서화
```javascript
/**
 * 시스템 트레이 아이콘을 생성합니다.
 * @param {string} state - 현재 상태 ('idle', 'working', 등)
 * @param {string} character - 캐릭터 이름 ('clawd', 'kiro')
 * @returns {nativeImage} Electron nativeImage 객체
 */
function createTrayIcon(state, character = 'clawd') {
  // ...
}
```

### 2. 복잡한 로직 주석
```cpp
// 부유 애니메이션: 코사인 파형을 사용하여 부드러운 수평 움직임 생성
// 주기: 약 3.2초 (100ms 간격으로 32프레임)
int getFloatOffsetX() {
  float angle = (animFrame % 32) * (2.0 * PI / 32.0);
  return (int)(cos(angle) * FLOAT_AMPLITUDE_X);
}
```

### 3. API 문서화
```javascript
/**
 * POST /status - 모니터 상태 업데이트
 *
 * Request Body:
 * {
 *   "state": "working",      // 필수: 상태
 *   "event": "PreToolUse",   // 선택: 이벤트 이름
 *   "tool": "Bash",          // 선택: 도구 이름
 *   "project": "my-project", // 선택: 프로젝트 이름
 *   "character": "clawd"     // 선택: 캐릭터
 * }
 *
 * Response: { "success": true, "state": "working" }
 */
```

이러한 표준을 따라 일관성 있고 유지보수 가능한 코드를 작성하세요.
