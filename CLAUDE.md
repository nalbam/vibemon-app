# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ESP32 기반 Claude Monitor 펌웨어. 172×320 픽셀 LCD에 픽셀 아트 Claude 캐릭터로 5가지 상태(idle, working, notification, session_start, tool_done)를 실시간 표시.

## Development Environment

### Prerequisites
1. Arduino IDE 설치
2. ESP32 보드 매니저 추가: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
3. 라이브러리 설치: `TFT_eSPI` (Bodmer), `ArduinoJson` (Benoit Blanchon)
4. **중요**: `User_Setup.h`를 라이브러리 폴더로 복사:
   ```bash
   cp User_Setup.h ~/Documents/Arduino/libraries/TFT_eSPI/User_Setup.h
   ```

### Build & Upload
```bash
# Arduino IDE에서:
# 1. Tools → Board → ESP32C6 Dev Module
# 2. Tools → Port → /dev/cu.usbmodem* (또는 해당 포트)
# 3. Upload 버튼 클릭
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Main Loop (.ino)                  │
│  ┌─────────────┐  ┌────────────┐  ┌─────────────┐  │
│  │ Serial/WiFi │→│ JSON Parse │→│ State Update │  │
│  │   Input     │  │ (ArduinoJson)│  └──────┬──────┘  │
│  └─────────────┘  └────────────┘           │        │
│                                            ↓        │
│  ┌─────────────────────────────────────────────┐   │
│  │           sprites.h (Rendering)              │   │
│  │  state → color/eyeType/text → drawCharacter()│   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

- **claude-monitor.ino**: 메인 루프, 통신(Serial/WiFi), 상태 관리
- **sprites.h**: 렌더링 로직 분리 - 캐릭터, 눈, 애니메이션, 색상/텍스트 매핑

### Key Patterns
- 상태 기반 렌더링: `state` 값으로 color, eyeType, text 결정
- 애니메이션: `animFrame % N` 방식 (100ms 틱, 프레임 독립적)
- JSON 통신: 필수 필드 `{"state", "event", "tool", "project"}`

## Testing

### Web Simulator (하드웨어 불필요)
```bash
open simulator/index.html
# 또는: https://nalbam.github.io/claude-monitor/simulator/
```

### Hardware Testing (USB Serial)
```bash
# idle 상태 테스트
echo '{"state":"idle","event":"Stop","tool":"","project":"test"}' > /dev/cu.usbmodem1101

# working 상태 테스트
echo '{"state":"working","event":"PreToolUse","tool":"Bash","project":"test"}' > /dev/cu.usbmodem1101
```

## Important Notes

- `User_Setup.h`는 TFT_eSPI 라이브러리 폴더에 복사 필수 (프로젝트 내 파일은 무시됨)
- JSON 페이로드는 LF(`\n`) 종료 필수
- WiFi 모드: `.ino` 파일에서 `#define USE_WIFI` 주석 해제 후 SSID/Password 설정
