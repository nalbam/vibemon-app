# Claude Monitor

ESP32-C6-LCD-1.47 보드를 사용한 Claude Monitor 상태 표시기 (픽셀 아트 버전)

## 미리보기

```
┌────────────────────┐
│                    │
│    ┌──────────┐    │
│    │██████████│    │
│  ██│█ ■    ■ █│██  │  ← Claude 캐릭터
│    │██████████│    │     (64x64 픽셀)
│    └─┬─┬──┬─┬─┘    │
│      │█│  │█│      │
├────────────────────┤
│     Working        │  ← 상태 텍스트
│     ● ● ● ○        │  ← 로딩 애니메이션
├────────────────────┤
│ Project: dotfiles  │
│ Tool: Bash         │
├────────────────────┤
│ Claude Monitor     │
└────────────────────┘
```

## 하드웨어

- **보드**: ESP32-C6-LCD-1.47 (172x320, ST7789V2)
- **연결**: USB-C (시리얼 통신)

## 상태별 표시

| 상태 | 배경색 | 눈 모양 | 애니메이션 |
|------|--------|--------|-----------|
| `idle` | 🟢 녹색 | ■ ■ 사각 | 3초마다 깜빡임 |
| `working` | 🔵 파란색 | ▬ ▬ 집중 | 로딩 점 |
| `notification` | 🟡 노란색 | ● ● 둥근 | - |
| `session_start` | 🔵 시안 | ■ ■ + ✦ | 반짝이 회전 |
| `tool_done` | 🟢 녹색 | ∨ ∨ 웃음 | - |

## 설치

### 1. Arduino IDE 설정

1. **ESP32 보드 매니저 추가**
   - File → Preferences → Additional Board Manager URLs:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```

2. **ESP32 보드 설치**
   - Tools → Board → Boards Manager → "esp32" 검색 → 설치

3. **라이브러리 설치**
   - Tools → Manage Libraries:
     - `TFT_eSPI` by Bodmer
     - `ArduinoJson` by Benoit Blanchon

### 2. TFT_eSPI 설정

`User_Setup.h` 파일을 Arduino 라이브러리 폴더로 복사:

```bash
cp User_Setup.h ~/Documents/Arduino/libraries/TFT_eSPI/User_Setup.h
```

### 3. 업로드

1. **보드 선택**: Tools → Board → ESP32C6 Dev Module
2. **포트 선택**: Tools → Port → /dev/cu.usbmodem* (또는 해당 포트)
3. **업로드**: Upload 버튼 클릭

## Claude Monitor 설정

### 1. 환경 변수 설정

`~/.claude/.env.local` 파일 편집:

```bash
# USB 시리얼 포트 설정 (자동 감지도 가능)
export ESP32_SERIAL_PORT="/dev/cu.usbmodem1101"

# HTTP fallback (선택사항, WiFi 사용 시)
# export ESP32_HTTP_URL="http://192.168.1.100"
```

### 2. 시리얼 포트 확인

```bash
# macOS
ls /dev/cu.*

# Linux
ls /dev/ttyUSB* /dev/ttyACM*
```

## 파일 구조

```
claude-monitor/
├── claude-monitor.ino          # 메인 코드
├── sprites.h                   # 캐릭터 그리기 함수
├── User_Setup.h                # TFT 디스플레이 설정
├── simulator/                  # 웹 시뮬레이터
│   └── index.html              # 브라우저에서 테스트
└── README.md                   # 이 문서
```

## 시뮬레이터

하드웨어 없이 브라우저에서 디스플레이를 미리 볼 수 있습니다.

**웹 시뮬레이터**: https://nalbam.github.io/claude-monitor/simulator/

```bash
# 로컬에서 실행
open simulator/index.html
```

시뮬레이터 기능:
- 5가지 상태 버튼으로 전환 테스트
- Project/Tool 이름 입력
- JSON 페이로드 미리보기
- 실시간 애니메이션 (깜빡임, 로딩 점, 반짝이)

## WiFi 모드 (선택사항)

USB 없이 WiFi로 사용하려면:

1. 코드에서 `#define USE_WIFI` 주석 해제
2. WiFi SSID/Password 설정
3. `ESP32_HTTP_URL` 환경 변수 설정

```cpp
#define USE_WIFI
const char* ssid = "YOUR_SSID";
const char* password = "YOUR_PASSWORD";
```

### HTTP API

```bash
# POST /status - 상태 업데이트
curl -X POST http://192.168.1.100/status \
  -H "Content-Type: application/json" \
  -d '{"state":"working","event":"PreToolUse","tool":"Bash","project":"test"}'

# 응답
{"ok":true}

# 오류 (body 없음)
{"error":"no body"}
```

## 테스트

```bash
# USB 시리얼 테스트 - idle (녹색, 사각 눈)
echo '{"state":"idle","event":"Stop","tool":"","project":"test"}' > /dev/cu.usbmodem1101

# working (파란색, 집중 눈)
echo '{"state":"working","event":"PreToolUse","tool":"Bash","project":"dotfiles"}' > /dev/cu.usbmodem1101

# notification (노란색, 둥근 눈)
echo '{"state":"notification","event":"Notification","tool":"","project":"test"}' > /dev/cu.usbmodem1101

# session_start (시안, 반짝이)
echo '{"state":"session_start","event":"SessionStart","tool":"","project":"test"}' > /dev/cu.usbmodem1101

# tool_done (녹색, 웃는 눈)
echo '{"state":"tool_done","event":"PostToolUse","tool":"Bash","project":"test"}' > /dev/cu.usbmodem1101
```

## 트러블슈팅

### 화면이 안 나와요

- `User_Setup.h`가 올바른 위치에 있는지 확인
- 핀 설정이 보드와 맞는지 확인
- 백라이트 핀(TFT_BL) 확인

### 시리얼 연결 안 됨

```bash
# 포트 권한 확인 (Linux)
sudo chmod 666 /dev/ttyUSB0

# 시리얼 모니터로 테스트
screen /dev/cu.usbmodem1101 115200
```

### JSON 파싱 오류

시리얼 모니터에서 "JSON parse error" 메시지 확인
→ 줄바꿈 문자 확인 (LF만 사용)

## 버전 히스토리

- **v2.0**: 픽셀 아트 캐릭터 버전 (Claude 마스코트, 128x128, 웹 시뮬레이터)
- **v1.0**: 원형 상태 표시 버전
