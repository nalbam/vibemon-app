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
// ✅ 단일 책임 원칙 (SRP)
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

// ✅ 불변성 유지 (Immutability)
function updateWindowState(projectId, newState) {
  const entry = this.windows.get(projectId);
  if (!entry) return false;

  // 새 객체 생성으로 불변성 유지
  entry.state = { ...newState };
  return true;
}

// ✅ 조기 반환 (Early Return)
function validatePayload(data) {
  if (!data) return { valid: false, error: 'No data' };
  if (!data.state) return { valid: false, error: 'State required' };
  if (!VALID_STATES.includes(data.state)) {
    return { valid: false, error: 'Invalid state' };
  }
  return { valid: true, data };
}
```

#### 4. 모듈 패턴
```javascript
// ✅ 클래스 기반 모듈 (CommonJS)
class StateManager {
  constructor() {
    this.stateTimeoutTimers = new Map();
    this.windowCloseTimers = new Map();
    this.onStateTimeout = null;
    this.onWindowCloseTimeout = null;
  }

  clearStateTimeout(projectId) {
    const timer = this.stateTimeoutTimers.get(projectId);
    if (timer) {
      clearTimeout(timer);
      this.stateTimeoutTimers.delete(projectId);
    }
  }

  cleanup() {
    for (const [, timer] of this.stateTimeoutTimers) {
      clearTimeout(timer);
    }
    this.stateTimeoutTimers.clear();
  }
}

module.exports = { StateManager };

// ✅ ES Module 내보내기
export function drawCharacter(eyeType, currentState, currentCharacter, animFrame) {
  // 렌더링 로직
}

export function initRenderer(canvasCtx) {
  // 초기화 로직
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
    await exec('npx vibe-monitor');
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

// ✅ 타이머 정리
class StateManager {
  cleanupProject(projectId) {
    this.clearStateTimeout(projectId);
    this.clearWindowCloseTimer(projectId);
  }

  cleanup() {
    // 모든 타이머 정리
    for (const [, timer] of this.stateTimeoutTimers) {
      clearTimeout(timer);
    }
    this.stateTimeoutTimers.clear();

    for (const [, timer] of this.windowCloseTimers) {
      clearTimeout(timer);
    }
    this.windowCloseTimers.clear();
  }
}

// ✅ 윈도우 재사용 (단일 모드)
createWindow(projectId) {
  // 기존 윈도우 재사용
  if (this.windows.size > 0) {
    const [oldProjectId, entry] = this.windows.entries().next().value;

    // 타이머 정리
    this.clearAlwaysOnTopTimer(oldProjectId);
    const snapTimer = this.snapTimers.get(oldProjectId);
    if (snapTimer) {
      clearTimeout(snapTimer);
      this.snapTimers.delete(oldProjectId);
    }

    // 윈도우 재사용
    this.windows.delete(oldProjectId);
    this.windows.set(projectId, entry);
    entry.currentProjectId = projectId;
    entry.state = { project: projectId };

    return { window: entry.window, switchedProject: oldProjectId };
  }
}
```

### 4. Rate Limiting
```javascript
// ✅ IP 기반 Rate Limiting
class HttpServer {
  constructor() {
    this.requestCounts = new Map();  // IP -> { count, resetTime }
  }

  checkRateLimit(ip) {
    const now = Date.now();
    const record = this.requestCounts.get(ip);

    if (!record || now > record.resetTime) {
      // 새 윈도우 또는 만료 - 카운터 리셋
      this.requestCounts.set(ip, {
        count: 1,
        resetTime: now + RATE_WINDOW_MS
      });
      return true;
    }

    if (record.count >= RATE_LIMIT) {
      return false;  // Rate limited
    }

    record.count++;
    return true;
  }
}
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
    'UserPromptSubmit': 'thinking',
    'PreToolUse': 'working',
    'Notification': 'notification',
    'Stop': 'done',
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

// ✅ 콜백 패턴으로 모듈 간 결합도 낮추기
class StateManager {
  constructor() {
    this.onStateTimeout = null;      // 콜백
    this.onWindowCloseTimeout = null; // 콜백
  }
}

// main.js에서 콜백 설정
stateManager.onStateTimeout = (projectId, newState) => {
  const existingState = windowManager.getState(projectId);
  if (!existingState) return;

  const stateData = { ...existingState, state: newState };
  windowManager.updateState(projectId, stateData);
  windowManager.sendToWindow(projectId, 'state-update', stateData);
};
```

### 3. 입력 검증
```javascript
// ✅ 페이로드 검증 함수
function validateStatusPayload(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid data format' };
  }

  // 필드별 검증
  if (data.project && data.project.length > 100) {
    return { valid: false, error: 'Project name too long' };
  }

  if (data.tool && data.tool.length > 50) {
    return { valid: false, error: 'Tool name too long' };
  }

  if (data.memory && !/^\d+%$/.test(data.memory)) {
    return { valid: false, error: 'Invalid memory format' };
  }

  if (data.state && !VALID_STATES.includes(data.state)) {
    return { valid: false, error: 'Invalid state' };
  }

  return { valid: true };
}

// ✅ 터미널 ID 검증 (보안)
function validateTerminalId(terminalId) {
  const parts = terminalId.split(':');
  if (parts.length < 2) return false;

  const terminalType = parts[0];

  if (terminalType === 'iterm2') {
    const uuid = parts.length === 3 ? parts[2] : parts[1];
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return UUID_REGEX.test(uuid);
  } else if (terminalType === 'ghostty') {
    const pid = parts[1];
    return /^\d+$/.test(pid);
  }

  return false;
}
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
 *   "tool": "Bash",          // 선택: 도구 이름
 *   "project": "my-project", // 선택: 프로젝트 이름
 *   "character": "clawd",    // 선택: 캐릭터
 *   "model": "opus",         // 선택: 모델 이름
 *   "memory": "45%",         // 선택: 메모리 사용량
 *   "terminalId": "iterm2:w0t4p0:UUID" // 선택: 터미널 ID
 * }
 *
 * Response: { "success": true, "state": "working", "windowCount": 1 }
 */
```

### 4. 모듈 문서화
```javascript
/**
 * Multi-window management for Vibe Monitor
 *
 * Manages multiple windows, one per project
 * Supports both multi-window and single-window modes
 *
 * Window Modes:
 * - multi: One window per project (max 5)
 * - single: One window with project lock support
 *
 * Lock Modes (single mode only):
 * - first-project: First incoming project is automatically locked
 * - on-thinking: Lock when entering thinking state
 *
 * Always on Top Modes:
 * - active-only: Only active states stay on top (default)
 * - all: All windows stay on top
 * - disabled: No windows stay on top
 */
class MultiWindowManager {
  // ...
}
```

## 보안 고려사항

### 1. 입력 검증 및 살균
```javascript
// ✅ UUID 형식 검증 (Command Injection 방지)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_REGEX.test(uuid)) {
  return { success: false, reason: 'invalid-uuid-format' };
}

// ✅ AppleScript 문자열 이스케이프
const script = `tell application "iTerm2"
  activate
  // ...
end tell`;
exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, callback);

// ✅ 페이로드 크기 제한
const MAX_PAYLOAD_SIZE = 10 * 1024; // 10KB

async function parseJsonBody(req, maxSize) {
  let body = '';
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxSize) {
      return { error: 'Payload too large', statusCode: 413 };
    }
    body += chunk;
  }

  try {
    const data = JSON.parse(body);
    return { data };
  } catch (e) {
    return { error: 'Invalid JSON', statusCode: 400 };
  }
}
```

### 2. CORS 및 Rate Limiting
```javascript
// ✅ CORS 헤더 (localhost만 허용)
function setCorsHeaders(res, req) {
  const origin = req.headers.origin;
  if (origin && origin.startsWith('http://localhost')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:19280');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ✅ Rate Limiting
const RATE_LIMIT = 100;       // Max requests per window
const RATE_WINDOW_MS = 60000; // 1 minute

if (!this.checkRateLimit(ip)) {
  sendError(res, 429, 'Too many requests');
  return;
}
```

### 3. 리소스 제한
```javascript
// ✅ 최대 윈도우 수 제한
const MAX_WINDOWS = 5;

if (this.windows.size >= MAX_WINDOWS) {
  return { window: null, blocked: false };
}

// ✅ 프로젝트 목록 크기 제한 (LRU)
const MAX_PROJECT_LIST = 10;

addProjectToList(project) {
  // LRU 방식으로 관리
  const existingIndex = this.projectList.indexOf(project);
  if (existingIndex !== -1) {
    this.projectList.splice(existingIndex, 1);
  }

  this.projectList.push(project);

  // 최대 크기 제한
  while (this.projectList.length > MAX_PROJECT_LIST) {
    this.projectList.shift();
  }
}
```

## 테스트 작성 가이드

### 1. 단위 테스트
```javascript
// ✅ Jest 테스트 예제
describe('validators', () => {
  describe('validateStatusPayload', () => {
    it('should accept valid payload', () => {
      const payload = {
        state: 'working',
        project: 'test',
        tool: 'Bash'
      };
      const result = validateStatusPayload(payload);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid state', () => {
      const payload = { state: 'invalid' };
      const result = validateStatusPayload(payload);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid state');
    });

    it('should reject too long project name', () => {
      const payload = {
        state: 'working',
        project: 'a'.repeat(101)
      };
      const result = validateStatusPayload(payload);
      expect(result.valid).toBe(false);
    });
  });
});
```

### 2. 통합 테스트
```javascript
// ✅ HTTP API 테스트
describe('HTTP Server', () => {
  let server;

  beforeAll(() => {
    server = new HttpServer(stateManager, windowManager, app);
    server.start();
  });

  afterAll(() => {
    server.stop();
  });

  it('should update status', async () => {
    const response = await fetch('http://127.0.0.1:19280/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'working', project: 'test' })
    });

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.state).toBe('working');
  });
});
```

이러한 표준을 따라 일관성 있고 유지보수 가능한 코드를 작성하세요.
