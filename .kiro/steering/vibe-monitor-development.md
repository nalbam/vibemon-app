---
inclusion: always
---

# Vibe Monitor 개발 가이드

이 스티어링 파일은 Vibe Monitor 프로젝트의 개발 표준과 패턴을 정의합니다.

## 프로젝트 개요

Vibe Monitor는 AI 코딩 어시스턴트(Claude Code, Kiro IDE)의 실시간 상태를 모니터링하는 픽셀 아트 캐릭터 기반 시스템입니다.

### 지원 플랫폼
- **Desktop App** (Electron): 시스템 트레이 앱, 일상 사용 권장
- **ESP32 Hardware**: 전용 LCD 디스플레이 (172×320, ST7789V2) - 실험적 지원
- **Web Simulator**: 브라우저 기반 테스트 환경

### 핵심 기능
- **8가지 상태**: `start`, `idle`, `thinking`, `planning`, `working`, `notification`, `done`, `sleep`
- **3개 캐릭터**: `clawd` (오렌지), `kiro` (흰색 고스트), `claw` (빨간색) - IDE별 자동 감지
- **실시간 애니메이션**: 부유 효과, 깜빡임, 로딩 도트, Matrix rain, 선글라스, 생각 버블
- **IDE 통합**: 훅 시스템을 통한 자동 상태 업데이트
- **멀티 윈도우**: 프로젝트별 독립 윈도우 (최대 5개)
- **프로젝트 잠금**: 단일 윈도우 모드에서 특정 프로젝트 고정
- **터미널 포커스**: 윈도우 클릭 시 iTerm2/Ghostty 탭 자동 전환 (macOS)
- **Always on Top 모드**: 상태별 윈도우 최상위 표시 제어 (active-only, all, disabled)
- **Claude Stats**: Claude Code 사용 통계 시각화 (모델별 토큰 사용량, 비용 등)

## 아키텍처 패턴

### 1. 모듈화 아키텍처 (Desktop App)
Desktop 앱은 명확한 책임 분리를 위해 모듈화되어 있습니다:

```
main.js                      # 오케스트레이터 - 모듈 연결 및 IPC 핸들러
├── StateManager             # 상태 및 타이머 관리 (프로젝트별)
│   ├── stateTimeoutTimers   # 상태 자동 전환 타이머 (start→idle, idle→sleep)
│   ├── windowCloseTimers    # sleep 상태 윈도우 자동 닫기 타이머
│   └── validateStateData    # 상태 데이터 검증 및 정규화
├── MultiWindowManager       # 멀티 윈도우 생성 및 관리
│   ├── windows Map          # projectId → {window, state, currentProjectId}
│   ├── windowMode           # 'multi' 또는 'single' 모드
│   ├── lockedProject        # 단일 모드에서 잠긴 프로젝트
│   ├── lockMode             # 'first-project' 또는 'on-thinking'
│   ├── alwaysOnTopMode      # 'active-only', 'all', 'disabled'
│   ├── projectList          # LRU 방식으로 관리되는 프로젝트 목록
│   └── arrangeWindowsByName # 상태 및 이름 기반 윈도우 정렬
├── TrayManager              # 시스템 트레이 아이콘 및 메뉴
│   ├── trayIconCache        # 상태별 아이콘 캐시 (성능 최적화)
│   ├── createTrayIcon       # Canvas 기반 동적 아이콘 생성
│   └── statsWindow          # Claude Stats 윈도우 관리
└── HttpServer               # HTTP API 서버 (포트 19280)
    ├── Rate Limiting        # IP별 요청 제한 (100 req/min)
    ├── CORS                 # localhost만 허용
    └── Payload Validation   # 10KB 제한, 입력 검증
```

**핵심 원칙:**
- 각 모듈은 단일 책임을 가짐 (SRP)
- 모듈 간 통신은 콜백을 통해 이루어짐 (느슨한 결합)
- 상태는 불변성을 유지하며 업데이트됨 (entry.state는 새 객체로 교체)
- 단일 인스턴스 보장 (app.requestSingleInstanceLock)
- 플랫폼별 최적화 (macOS: floating, Windows/Linux: screen-saver)

### 2. 상태 기반 렌더링
모든 플랫폼에서 동일한 상태 시스템을 사용합니다:

```javascript
// shared/data/states.json - 단일 진실 소스 (Single Source of Truth)
{
  "start": { "bgColor": "#00CCCC", "eyeType": "sparkle", "textColor": "#000000" },
  "idle": { "bgColor": "#00AA00", "eyeType": "normal", "textColor": "#FFFFFF" },
  "thinking": { "bgColor": "#AA33BB", "eyeType": "thinking", "textColor": "#FFFFFF" },
  "planning": { "bgColor": "#008888", "eyeType": "thinking", "textColor": "#FFFFFF" },
  "working": { "bgColor": "#0066CC", "eyeType": "focused", "textColor": "#FFFFFF" },
  "notification": { "bgColor": "#FFCC00", "eyeType": "alert", "textColor": "#000000" },
  "done": { "bgColor": "#00AA00", "eyeType": "happy", "textColor": "#FFFFFF" },
  "sleep": { "bgColor": "#111144", "eyeType": "sleep", "textColor": "#FFFFFF" }
}
```

**상태 전환 규칙:**
- `start`, `done` → `idle` (1분 후)
- `idle`, `notification` → `sleep` (5분 후)
- `sleep` → 윈도우 닫기 (10분 후, Desktop만)

**Always on Top 동작:**
- `active-only` 모드 (기본값):
  - Active 상태 (thinking, planning, working, notification): 즉시 최상위 활성화
  - Inactive 상태 (start, idle, done): 10초 유예 기간 후 비활성화
  - Sleep 상태: 즉시 비활성화 (유예 기간 없음)
- `all` 모드: 모든 윈도우 항상 최상위
- `disabled` 모드: 최상위 표시 안함

### 3. 캐릭터 시스템
확장 가능한 캐릭터 구조:

```javascript
// shared/data/characters.json - 캐릭터 정의
{
  "clawd": {
    "name": "clawd",
    "displayName": "Clawd",
    "color": "#D97757",
    "eyes": { "left": { "x": 14, "y": 22 }, "right": { "x": 44, "y": 22 }, "size": 6 },
    "effect": { "x": 52, "y": 4 }
  },
  "kiro": {
    "name": "kiro",
    "displayName": "Kiro",
    "color": "#FFFFFF",
    "eyes": { "left": { "x": 29, "y": 21 }, "right": { "x": 39, "y": 21 }, "w": 5, "h": 8 },
    "effect": { "x": 50, "y": 3 }
  },
  "claw": {
    "name": "claw",
    "displayName": "Claw",
    "color": "#DD4444",
    "eyes": { "left": { "x": 20, "y": 16 }, "right": { "x": 39, "y": 16 }, "size": 6 },
    "effect": { "x": 49, "y": 4 }
  }
}
```

**새 캐릭터 추가 시:**
1. `shared/data/characters.json`에 캐릭터 정의 추가
2. `desktop/assets/characters/`에 128×128 PNG 이미지 추가
3. 스프라이트 기반이면 `sprites.h`에 C++ 렌더링 로직 추가
4. 시스템 트레이 아이콘 렌더링 업데이트 (`tray-manager.cjs`)

**캐릭터 자동 감지:**
- Claude Code 훅 이벤트 → `clawd` 캐릭터
- Kiro 훅 이벤트 → `kiro` 캐릭터
- 수동 변경: 시스템 트레이 메뉴 또는 HTTP API

### 4. 크로스 플랫폼 호환성
- **ESP32**: C++ 구현, sprites.h에서 픽셀 단위 렌더링
- **Desktop/Web**: JavaScript 구현, Canvas API 사용
- **공통**: 64×64 기본 크기, 2배 스케일링으로 128×128

**데이터 공유 전략:**
- JSON 파일을 단일 진실 소스로 사용 (`shared/data/*.json`)
- CommonJS (`config.cjs`) 및 ES Module (`config.js`) 모두 지원
- ESP32는 C++ 헤더 파일로 수동 동기화 필요

### 5. 윈도우 관리 시스템

**멀티 윈도우 모드 (기본값):**
- 프로젝트당 하나의 윈도우 (최대 5개 또는 화면 너비 제한)
- 상태 및 이름 기반 자동 정렬:
  - 오른쪽: Active 상태 (thinking, planning, working, notification)
  - 왼쪽: Inactive 상태 (start, idle, done, sleep)
  - 각 그룹 내에서 프로젝트 이름 역순 정렬 (Z가 가장 오른쪽)
- 윈도우 간격: 10px

**단일 윈도우 모드:**
- 하나의 윈도우만 표시
- 프로젝트 잠금 기능 사용 가능
- 프로젝트 전환 시 동일 윈도우 재사용

**프로젝트 잠금 모드:**
- `first-project`: 첫 번째 프로젝트 자동 잠금
- `on-thinking`: thinking 상태 진입 시 잠금 (기본값)
- 잠긴 프로젝트는 다른 프로젝트 업데이트 차단
- 프로젝트 목록은 LRU 방식으로 최대 10개 유지

**윈도우 위치 관리:**
- 스냅 기능: 화면 가장자리 30px 이내에서 자동 정렬
- 디바운스: 드래그 종료 후 150ms 후 스냅 적용
- 모든 워크스페이스에서 표시 가능 (setVisibleOnAllWorkspaces)

## 코딩 표준

### 1. 파일 구조
```
vibe-monitor/
├── shared/                    # 공통 로직 (Desktop/Web)
│   ├── data/                  # JSON 데이터 (단일 진실 소스)
│   │   ├── states.json        # 상태 정의
│   │   ├── characters.json    # 캐릭터 정의
│   │   ├── constants.json     # 공통 상수
│   │   └── texts.json         # 텍스트 매핑
│   ├── config.cjs             # CommonJS 설정 (Node.js)
│   ├── config.js              # ES Module 설정 (Browser)
│   ├── constants.cjs          # 상수 정의
│   ├── character.js           # 캐릭터 렌더링
│   ├── effects.js             # 애니메이션 효과
│   ├── animation.js           # 애니메이션 유틸리티
│   └── utils.js               # 공통 유틸리티
├── desktop/                   # Electron 앱
│   ├── main.js                # 메인 프로세스
│   ├── renderer.js            # 렌더러 프로세스
│   ├── preload.js             # Preload 스크립트
│   ├── modules/               # 모듈 (CommonJS)
│   │   ├── state-manager.cjs
│   │   ├── multi-window-manager.cjs
│   │   ├── tray-manager.cjs
│   │   ├── http-server.cjs
│   │   ├── http-utils.cjs
│   │   └── validators.cjs
│   ├── assets/                # 리소스
│   │   ├── characters/        # 캐릭터 이미지 (128×128 PNG)
│   │   └── generators/        # 아이콘 생성 도구
│   └── tests/                 # 테스트 파일
├── simulator/                 # 웹 시뮬레이터
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── config/                    # IDE 통합 설정
│   ├── claude/                # Claude Code 훅
│   │   ├── hooks/
│   │   │   └── vibe-monitor.py
│   │   ├── statusline.py
│   │   └── .env.example
│   └── kiro/                  # Kiro 훅
│       ├── hooks/
│       │   ├── vibe-monitor.py
│       │   └── *.kiro.hook
│       └── .env.example
├── vibe-monitor.ino           # ESP32 펌웨어
├── sprites.h                  # ESP32 스프라이트
└── docs/                      # 문서
    ├── api.md
    ├── features.md
    ├── integration.md
    └── esp32.md
```

### 2. 네이밍 컨벤션
- **상태**: snake_case (`start`, `done`)
- **캐릭터**: 소문자 (`clawd`, `kiro`, `claw`)
- **색상**: RGB565 (ESP32), HEX (Web/Desktop)
- **함수**: camelCase (JS), snake_case (C++)

### 3. 애니메이션 패턴
```javascript
// 100ms 간격 애니메이션 프레임
animFrame++;

// 부유 효과 (3.2초 주기, 32프레임)
const angle = (animFrame % 32) * (2.0 * Math.PI / 32.0);
const offsetX = Math.cos(angle) * FLOAT_AMPLITUDE_X;  // ±3px
const offsetY = Math.sin(angle) * FLOAT_AMPLITUDE_Y;  // ±5px

// 깜빡임 효과 (2초 주기, 20프레임)
const shouldShow = (animFrame % 20) < 10;

// Matrix rain (working 상태)
// - 스트림 밀도: 0.7 (70% 확률로 표시)
// - 속도: 1-6 픽셀/프레임 (랜덤)
// - 꼬리 길이: 빠른 속도 8px, 느린 속도 6px
// - 깜빡임: 3프레임마다 헤드 색상 변경
```

**Eye Type별 효과:**
- `normal`: 기본 눈 (이미지에 포함)
- `focused`: 선글라스 (Matrix 스타일, working 상태)
- `alert`: 물음표 (notification 상태)
- `sparkle`: 회전하는 반짝임 (start 상태)
- `thinking`: 생각 버블 애니메이션 (thinking/planning 상태)
- `sleep`: 닫힌 눈 + Zzz 애니메이션 (sleep 상태)
- `blink`: 닫힌 눈만 (idle 상태 깜빡임)
- `happy`: > < 모양 눈 (done 상태)

### 4. HTTP API 표준
```bash
# 상태 업데이트 (POST /status)
curl -X POST http://127.0.0.1:19280/status \
  -H "Content-Type: application/json" \
  -d '{
    "state": "working",
    "tool": "Bash",
    "project": "my-project",
    "model": "opus",
    "memory": "45%",
    "character": "clawd",
    "terminalId": "iterm2:w0t4p0:UUID"
  }'

# 상태 조회 (GET /status)
curl http://127.0.0.1:19280/status

# 윈도우 목록 (GET /windows)
curl http://127.0.0.1:19280/windows

# 윈도우 모드 변경 (POST /window-mode)
curl -X POST http://127.0.0.1:19280/window-mode \
  -d '{"mode":"single"}'

# 프로젝트 잠금 (POST /lock)
curl -X POST http://127.0.0.1:19280/lock \
  -d '{"project":"my-project"}'

# 잠금 모드 변경 (POST /lock-mode)
curl -X POST http://127.0.0.1:19280/lock-mode \
  -d '{"mode":"on-thinking"}'

# 헬스 체크 (GET /health)
curl http://127.0.0.1:19280/health

# 앱 종료 (POST /quit)
curl -X POST http://127.0.0.1:19280/quit
```

**보안 및 제한:**
- 포트: 19280 (Desktop), 80 (ESP32 WiFi)
- CORS: localhost만 허용
- Rate Limiting: IP당 100 req/min
- Payload 크기: 최대 10KB
- Request 타임아웃: 30초
- 입력 검증: 필드별 최대 길이 및 형식 검사

## 개발 워크플로우

### 1. 새 상태 추가
1. `shared/data/states.json`에 상태 정의 추가
   ```json
   "new_state": {
     "bgColor": "#HEXCOLOR",
     "eyeType": "normal",
     "textColor": "#FFFFFF"
   }
   ```
2. `sprites.h`에 C++ 매핑 추가 (ESP32용)
3. 필요시 새 eye type 구현 (`effects.js`)
4. 상태 전환 로직 추가 (`state-manager.cjs`)
5. 모든 플랫폼에서 테스트 (Desktop, Web, ESP32)

### 2. 새 캐릭터 추가
1. `shared/data/characters.json`에 캐릭터 정의 추가
2. `desktop/assets/characters/`에 128×128 PNG 이미지 추가
3. 스프라이트 기반이면 `sprites.h`에 렌더링 로직 추가
4. 시스템 트레이 아이콘 렌더링 업데이트 (`tray-manager.cjs`)
5. 캐릭터 자동 감지 로직 추가 (훅 스크립트)

### 3. 새 애니메이션 효과 추가
1. `effects.js`에 효과 함수 구현
   ```javascript
   export function drawNewEffect(x, y, animFrame, drawRect, color) {
     // 애니메이션 로직
   }
   ```
2. `drawEyes` 함수에 새 eye type 케이스 추가
3. `states.json`에서 해당 상태의 `eyeType` 설정
4. ESP32용 C++ 구현 추가 (`sprites.h`)

### 4. 테스트 방법
```bash
# 웹 시뮬레이터 (하드웨어 불필요)
open simulator/index.html

# 데스크톱 앱 개발 모드
cd desktop && npm start

# 데스크톱 앱 테스트
npm test
npm run test:coverage

# 린트 검사
npm run lint
npm run lint:fix

# 빌드
npm run build:mac     # macOS (DMG, ZIP)
npm run build:win     # Windows (NSIS, Portable)
npm run build:linux   # Linux (AppImage, DEB)

# ESP32 하드웨어 테스트
echo '{"state":"working","tool":"Bash"}' > /dev/cu.usbmodem1101

# HTTP API 테스트
curl -X POST http://127.0.0.1:19280/status \
  -d '{"state":"working","project":"test"}'
```

### 5. IDE 통합 테스트
```bash
# Claude Code 훅 테스트
echo '{"hook_event_name":"SessionStart","cwd":"/path/to/project"}' | \
  python3 ~/.claude/hooks/vibe-monitor.py

# Kiro 훅 테스트
python3 ~/.kiro/hooks/vibe-monitor.py promptSubmit

# 디버그 모드
DEBUG=1 python3 ~/.claude/hooks/vibe-monitor.py
```

## 성능 최적화

### 1. 렌더링 최적화
- **부분 업데이트**: 변경된 영역만 다시 그리기
  ```javascript
  // 위치가 변경된 경우에만 다시 그리기
  if (newCharX !== lastCharX || newCharY !== lastCharY) {
    ctx.clearRect(lastCharX, lastCharY, CHAR_WIDTH, CHAR_HEIGHT);
    drawCharacter(newCharX, newCharY, eyeType, bgColor);
    lastCharX = newCharX;
    lastCharY = newCharY;
  }
  ```
- **아이콘 캐싱**: 시스템 트레이 아이콘 메모리 캐시 (Map 사용)
  ```javascript
  const trayIconCache = new Map();
  const cacheKey = `${state}-${character}`;
  if (trayIconCache.has(cacheKey)) {
    return trayIconCache.get(cacheKey);
  }
  ```
- **프레임 제한**: 100ms 간격으로 애니메이션 업데이트
- **이미지 프리로드**: 캐릭터 이미지 사전 로드 및 캐싱
- **조건부 렌더링**: 상태별 애니메이션 필요 여부 체크
  ```javascript
  function needsAnimationRedraw(state, animFrame, blinkFrame) {
    switch (state) {
      case 'start':
      case 'thinking':
      case 'planning':
      case 'working':
      case 'sleep':
        return true;  // 항상 애니메이션
      case 'idle':
        return blinkFrame === BLINK_START_FRAME || blinkFrame === BLINK_END_FRAME;
      default:
        return false;
    }
  }
  ```

### 2. 메모리 관리
- **ESP32**: 스프라이트 데이터를 PROGMEM에 저장
  ```cpp
  const uint16_t sprite_data[] PROGMEM = { /* ... */ };
  ```
- **Desktop**: 아이콘 캐시로 Canvas 생성 비용 절약
- **윈도우 재사용**: 단일 모드에서 윈도우 객체 재사용
  ```javascript
  // 프로젝트 전환 시 윈도우 재사용
  this.windows.delete(oldProjectId);
  this.windows.set(newProjectId, entry);
  entry.currentProjectId = newProjectId;
  ```
- **타이머 정리**: 윈도우 닫힐 때 모든 타이머 정리
- **LRU 프로젝트 목록**: 최대 10개로 제한

### 3. 통신 최적화
- **HTTP 타임아웃**: 연결 1초, 전체 5초
- **직렬 통신**: 115200 baud rate
- **에러 처리**: 실패 시 조용히 무시 (사용자 경험 방해 안함)
- **Rate Limiting**: IP당 100 req/min 제한
- **Payload 검증**: 10KB 제한으로 메모리 보호
- **디바운스**: 윈도우 이동 시 150ms 디바운스로 스냅 적용

### 4. 시스템 리소스 관리
- **단일 인스턴스**: `app.requestSingleInstanceLock()`으로 중복 실행 방지
- **백그라운드 실행**: 시스템 트레이에서 실행, 윈도우 닫혀도 앱 유지
- **자동 정리**: 앱 종료 시 모든 리소스 정리
  ```javascript
  app.on('before-quit', () => {
    stateManager.cleanup();
    windowManager.cleanup();
    trayManager.cleanup();
    httpServer.stop();
  });
  ```

## 디버깅 가이드

### 1. 로그 활성화
```bash
# 훅 스크립트 디버그 (Claude Code)
echo '{"hook_event_name":"SessionStart","cwd":"/path/to/project"}' | \
  DEBUG=1 python3 ~/.claude/hooks/vibe-monitor.py

# 훅 스크립트 디버그 (Kiro)
DEBUG=1 python3 ~/.kiro/hooks/vibe-monitor.py promptSubmit

# ESP32 시리얼 모니터
screen /dev/cu.usbmodem1101 115200

# Desktop 앱 개발자 도구
# Electron 앱 실행 후 Cmd+Option+I (macOS) 또는 Ctrl+Shift+I (Windows/Linux)
```

### 2. 일반적인 문제

| 문제 | 원인 | 해결 방법 |
|------|------|-----------|
| ESP32 디스플레이 안됨 | TFT_eSPI 설정 누락 | `User_Setup.h` 복사 확인 |
| 데스크톱 앱 안보임 | 시스템 트레이에 숨김 | 트레이 아이콘 클릭 또는 `/show` API 호출 |
| 훅 작동 안함 | 스크립트 권한 또는 환경변수 | 실행 권한 확인, `.env.local` 설정 확인 |
| 포트 충돌 (19280) | 다른 인스턴스 실행 중 | `lsof -i :19280`로 확인 후 종료 |
| 윈도우 생성 안됨 | 최대 윈도우 수 초과 | 기존 윈도우 닫기 또는 단일 모드 사용 |
| 프로젝트 잠금 안됨 | 멀티 윈도우 모드 | 단일 윈도우 모드로 전환 필요 |
| 터미널 포커스 안됨 | terminalId 누락 또는 잘못됨 | 훅 스크립트에서 terminalId 전송 확인 |
| Always on Top 안됨 | 모드가 disabled | 시스템 트레이에서 모드 변경 |

### 3. 개발 도구
```bash
# API 테스트
curl -X POST http://127.0.0.1:19280/status \
  -d '{"state":"working","project":"test"}'

# 디스플레이 정보
curl http://127.0.0.1:19280/debug

# 윈도우 목록
curl http://127.0.0.1:19280/windows

# 포트 사용 확인
lsof -i :19280

# 프로세스 확인
ps aux | grep vibe-monitor

# 로그 파일 확인 (Claude Code)
cat ~/.claude/statusline-cache.json
cat ~/.claude/stats-cache.json
```

### 4. 테스트 시나리오
```bash
# 1. 기본 상태 전환 테스트
curl -X POST http://127.0.0.1:19280/status -d '{"state":"start","project":"test"}'
sleep 2
curl -X POST http://127.0.0.1:19280/status -d '{"state":"thinking","project":"test"}'
sleep 2
curl -X POST http://127.0.0.1:19280/status -d '{"state":"working","tool":"Bash","project":"test"}'
sleep 2
curl -X POST http://127.0.0.1:19280/status -d '{"state":"done","project":"test"}'

# 2. 멀티 윈도우 테스트
curl -X POST http://127.0.0.1:19280/status -d '{"state":"working","project":"project-a"}'
curl -X POST http://127.0.0.1:19280/status -d '{"state":"thinking","project":"project-b"}'
curl -X POST http://127.0.0.1:19280/status -d '{"state":"idle","project":"project-c"}'
curl http://127.0.0.1:19280/windows

# 3. 프로젝트 잠금 테스트
curl -X POST http://127.0.0.1:19280/window-mode -d '{"mode":"single"}'
curl -X POST http://127.0.0.1:19280/lock -d '{"project":"my-project"}'
curl -X POST http://127.0.0.1:19280/status -d '{"state":"working","project":"other-project"}'
# 잠긴 프로젝트가 아니므로 차단됨

# 4. 캐릭터 전환 테스트
curl -X POST http://127.0.0.1:19280/status -d '{"state":"working","character":"clawd","project":"test"}'
sleep 2
curl -X POST http://127.0.0.1:19280/status -d '{"state":"working","character":"kiro","project":"test"}'
```

## 확장성 고려사항

### 1. 새 플랫폼 추가
- `shared/` 로직 재사용 (상태, 캐릭터, 애니메이션)
- 플랫폼별 렌더링 구현 (Canvas API, OpenGL, 등)
- HTTP API 호환성 유지 (동일한 엔드포인트 및 페이로드)
- JSON 데이터 파일을 단일 진실 소스로 사용

### 2. 새 IDE 지원
- 훅 이벤트 매핑 추가
  ```python
  # 이벤트 → 상태 매핑
  EVENT_STATE_MAP = {
    'SessionStart': 'start',
    'UserPromptSubmit': 'thinking',
    'PreToolUse': 'working',
    'Notification': 'notification',
    'Stop': 'done'
  }
  ```
- 캐릭터 자동 감지 로직
  ```python
  # IDE별 캐릭터 매핑
  if 'claude' in event_source:
    character = 'clawd'
  elif 'kiro' in event_source:
    character = 'kiro'
  ```
- 환경변수 설정 가이드 작성
- 터미널 ID 형식 정의 (click-to-focus 기능용)

### 3. 국제화 (i18n)
- 상태 텍스트 다국어 지원
  ```json
  // shared/data/texts.json
  {
    "en": {
      "working": ["Working", "Busy", "Coding"],
      "idle": ["Ready", "Waiting"]
    },
    "ko": {
      "working": ["작업 중", "바쁨", "코딩 중"],
      "idle": ["준비", "대기 중"]
    }
  }
  ```
- 폰트 렌더링 고려 (CJK 문자 지원)
- 문자 인코딩 처리 (UTF-8)
- 시스템 트레이 메뉴 다국어화

### 4. 플러그인 시스템
- 커스텀 상태 추가 API
- 커스텀 캐릭터 로딩
- 커스텀 애니메이션 효과
- 이벤트 훅 시스템 (상태 변경 시 콜백)

### 5. 클라우드 동기화
- 설정 동기화 (윈도우 모드, 잠금 모드, Always on Top 모드)
- 프로젝트 목록 동기화
- 통계 데이터 동기화
- 여러 머신 간 상태 공유

### 6. 고급 기능 아이디어
- **음성 알림**: 상태 변경 시 TTS 알림
- **통계 대시보드**: 프로젝트별 작업 시간, 상태 분포
- **타임라인 뷰**: 시간대별 상태 변화 시각화
- **알림 규칙**: 특정 상태 지속 시 알림 (예: working 30분 이상)
- **테마 시스템**: 색상 테마 커스터마이징
- **위젯 모드**: 데스크톱 위젯으로 표시
- **모바일 앱**: iOS/Android 원격 모니터링
- **브라우저 확장**: 웹 기반 모니터링

이 가이드를 따라 일관성 있고 확장 가능한 코드를 작성하세요.
