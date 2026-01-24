---
inclusion: fileMatch
fileMatchPattern: "*.ino|*.h|desktop/*|shared/*|simulator/*|hooks/*"
---

# 플랫폼별 개발 가이드라인

## ESP32 펌웨어 개발 (Arduino)

### 1. 하드웨어 제약사항
```cpp
// ✅ 메모리 효율적인 스프라이트 저장
const char* KIRO_SPRITE[64] PROGMEM = {
  "0000000000000000000000000001111111111111000000000000000000000000",
  // ... 스프라이트 데이터
};

// ✅ 스택 오버플로우 방지 - 큰 배열은 전역으로
uint16_t frameBuffer[CHAR_WIDTH * CHAR_HEIGHT];

// ❌ 피해야 할 패턴 - 스택에 큰 배열
void badFunction() {
  uint16_t largeArray[1000];  // 스택 오버플로우 위험
}
```

### 2. 디스플레이 최적화
```cpp
// ✅ 부분 업데이트로 성능 향상
void updateAnimation() {
  // 변경된 영역만 다시 그리기
  if (newCharX != lastCharX || newCharY != lastCharY) {
    tft.fillRect(lastCharX, lastCharY, CHAR_WIDTH, CHAR_HEIGHT, bgColor);
    drawCharacter(tft, newCharX, newCharY, eyeType, bgColor, character);
  }
}

// ✅ 색상 보간으로 부드러운 그라데이션
uint16_t lerpColor565(uint16_t color1, uint16_t color2, int ratio, int maxRatio) {
  int r1 = (color1 >> 11) & 0x1F;
  int g1 = (color1 >> 5) & 0x3F;
  int b1 = color1 & 0x1F;
  // ... 보간 로직
  return (r << 11) | (g << 5) | b;
}
```

### 3. 통신 처리
```cpp
// ✅ 비블로킹 시리얼 읽기
void loop() {
  if (Serial.available()) {
    String input = Serial.readStringUntil('\n');
    processInput(input);
  }

  // 다른 작업들...
  updateAnimation();
}

// ✅ WiFi 연결 타임아웃 처리
void setupWiFi() {
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    attempts++;
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi connection failed");
    return;
  }
}
```

### 4. 전력 관리
```cpp
// ✅ 슬립 모드 구현
void checkSleepTimer() {
  if (currentState == "idle" || currentState == "tool_done") {
    if (millis() - lastActivityTime >= SLEEP_TIMEOUT) {
      // 디스플레이 밝기 감소 또는 슬립 모드
      tft.writecommand(ST7789_SLPIN);
    }
  }
}
```

## Electron 데스크톱 앱

### 1. 윈도우 관리
```javascript
// ✅ 플랫폼별 윈도우 설정
function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();

  mainWindow = new BrowserWindow({
    width: 172,
    height: 348,
    x: workArea.x + workArea.width - 172,
    y: workArea.y,
    frame: false,
    transparent: true,
    alwaysOnTop: isAlwaysOnTop,
    skipTaskbar: process.platform !== 'darwin',  // macOS에서는 Dock에 표시
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false  // 보안을 위해 비활성화
    }
  });
}

// ✅ 멀티 디스플레이 지원
function showAndPositionWindow() {
  if (mainWindow) {
    const { workArea } = screen.getPrimaryDisplay();
    mainWindow.setPosition(workArea.x + workArea.width - 172, workArea.y);
    mainWindow.showInactive();  // 포커스 훔치지 않기
  }
}
```

### 2. 시스템 트레이 최적화
```javascript
// ✅ 플랫폼별 아이콘 크기
const getTrayIconSize = () => {
  switch (process.platform) {
    case 'darwin': return 22;   // macOS
    case 'win32': return 16;    // Windows
    default: return 22;         // Linux
  }
};

// ✅ 고해상도 디스플레이 지원
function createTrayIcon(state, character) {
  const size = getTrayIconSize();
  const scaleFactor = screen.getPrimaryDisplay().scaleFactor;
  const canvas = createCanvas(size * scaleFactor, size * scaleFactor);

  // 고해상도로 그리기
  const ctx = canvas.getContext('2d');
  ctx.scale(scaleFactor, scaleFactor);

  // ... 아이콘 그리기
}
```

### 3. IPC 보안
```javascript
// ✅ preload.js에서 안전한 API 노출
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  closeWindow: () => ipcRenderer.send('close-window'),
  onStateUpdate: (callback) => ipcRenderer.on('state-update', callback),
  // 필요한 API만 선별적으로 노출
});

// ✅ 메인 프로세스에서 입력 검증
ipcMain.on('update-state', (event, data) => {
  // 입력 검증
  if (typeof data.state !== 'string' || !VALID_STATES.includes(data.state)) {
    console.warn('Invalid state received:', data.state);
    return;
  }

  updateState(data);
});
```

## 웹 시뮬레이터

### 1. Canvas 최적화
```javascript
// ✅ 오프스크린 캔버스 사용
const offscreenCanvas = new OffscreenCanvas(CHAR_SIZE, CHAR_SIZE);
const offscreenCtx = offscreenCanvas.getContext('2d');

function renderCharacter() {
  // 오프스크린에서 렌더링
  drawCharacter(offscreenCtx, eyeType, currentState, currentCharacter, animFrame);

  // 메인 캔버스에 복사
  mainCtx.drawImage(offscreenCanvas, 0, 0);
}

// ✅ requestAnimationFrame 사용
function animate() {
  updateAnimation();
  renderCharacter();
  requestAnimationFrame(animate);
}
```

### 2. 반응형 디자인
```css
/* ✅ 다양한 화면 크기 지원 */
.monitor-container {
  width: 172px;
  height: 348px;
  max-width: 90vw;
  max-height: 90vh;
  margin: 0 auto;
}

@media (max-width: 480px) {
  .monitor-container {
    transform: scale(0.8);
  }
}
```

## 훅 스크립트 (Shell)

### 1. 크로스 플랫폼 호환성
```bash
# ✅ macOS/Linux 호환 시리얼 설정
send_serial() {
  local port="$1"
  local data="$2"

  if [ -c "$port" ]; then
    # macOS: -f, Linux: -F
    stty -f "$port" 115200 2>/dev/null || stty -F "$port" 115200 2>/dev/null
    echo "$data" > "$port" 2>/dev/null
    return $?
  fi
  return 1
}

# ✅ 포터블한 JSON 파싱
parse_json_field() {
  local input="$1"
  local field="$2"
  local default="${3:-}"

  # jq가 없으면 기본값 반환
  if ! command -v jq >/dev/null 2>&1; then
    echo "$default"
    return
  fi

  jq -r "$field // \"$default\"" <<< "$input" 2>/dev/null
}
```

### 2. 에러 복구
```bash
# ✅ 네트워크 실패 시 재시도
send_with_retry() {
  local url="$1"
  local data="$2"
  local max_attempts=3
  local attempt=1

  while [ $attempt -le $max_attempts ]; do
    if send_http "$url" "$data"; then
      return 0
    fi

    debug_log "Attempt $attempt failed, retrying..."
    attempt=$((attempt + 1))
    sleep 1
  done

  return 1
}

# ✅ 프로세스 존재 확인
is_process_running() {
  local process_name="$1"
  pgrep -f "$process_name" >/dev/null 2>&1
}
```

### 3. 디버깅 지원
```bash
# ✅ 조건부 디버그 로깅
debug_log() {
  if [[ "$DEBUG" == "1" ]]; then
    echo "[DEBUG $(date '+%H:%M:%S')] $*" >&2
  fi
}

# ✅ 환경 정보 수집
collect_debug_info() {
  debug_log "Environment:"
  debug_log "  VIBE_MONITOR_URL: ${VIBE_MONITOR_URL:-unset}"
  debug_log "  ESP32_SERIAL_PORT: ${ESP32_SERIAL_PORT:-unset}"
  debug_log "  PWD: $PWD"
  debug_log "  Script: ${BASH_SOURCE[0]}"
}
```

## 공통 베스트 프랙티스

### 1. 설정 관리
```javascript
// ✅ 환경별 설정 분리
const config = {
  development: {
    httpPort: 19280,
    logLevel: 'debug',
    animationInterval: 100
  },
  production: {
    httpPort: 19280,
    logLevel: 'error',
    animationInterval: 100
  }
};

const currentConfig = config[process.env.NODE_ENV || 'development'];
```

### 2. 버전 호환성
```javascript
// ✅ API 버전 체크
const API_VERSION = '2.1';

function handleStatusUpdate(req, res) {
  const clientVersion = req.headers['x-api-version'];

  if (clientVersion && !isCompatibleVersion(clientVersion, API_VERSION)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'API version mismatch',
      required: API_VERSION,
      provided: clientVersion
    }));
    return;
  }

  // 정상 처리
}
```

### 3. 로깅 표준
```javascript
// ✅ 구조화된 로깅
const logger = {
  info: (msg, data = {}) => console.log(JSON.stringify({ level: 'info', msg, ...data, timestamp: new Date().toISOString() })),
  warn: (msg, data = {}) => console.warn(JSON.stringify({ level: 'warn', msg, ...data, timestamp: new Date().toISOString() })),
  error: (msg, error = {}) => console.error(JSON.stringify({ level: 'error', msg, error: error.message, timestamp: new Date().toISOString() }))
};

// 사용
logger.info('State updated', { state: 'working', character: 'clawd' });
logger.error('HTTP server failed', error);
```

### 4. 테스트 지원
```javascript
// ✅ 테스트 가능한 구조
class VibeMonitor {
  constructor(dependencies = {}) {
    this.httpClient = dependencies.httpClient || require('http');
    this.serialPort = dependencies.serialPort || require('serialport');
    this.logger = dependencies.logger || console;
  }

  async updateState(state) {
    try {
      await this.sendToTargets(state);
      this.logger.info('State updated successfully');
    } catch (error) {
      this.logger.error('State update failed', error);
    }
  }
}

// 테스트에서 모킹 가능
const mockMonitor = new VibeMonitor({
  httpClient: mockHttpClient,
  logger: mockLogger
});
```

이러한 가이드라인을 따라 각 플랫폼의 특성을 살린 최적화된 코드를 작성하세요.
