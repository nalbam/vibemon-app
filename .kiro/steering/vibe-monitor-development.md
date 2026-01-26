---
inclusion: always
---

# Vibe Monitor 개발 가이드

이 스티어링 파일은 Vibe Monitor 프로젝트의 개발 표준과 패턴을 정의합니다.

## 프로젝트 개요

Vibe Monitor는 AI 코딩 어시스턴트(Claude Code, Kiro IDE)의 실시간 상태를 모니터링하는 픽셀 아트 캐릭터 기반 시스템입니다.

### 지원 플랫폼
- **Desktop App** (Electron): 시스템 트레이 앱, 일상 사용 권장
- **ESP32 Hardware**: 전용 LCD 디스플레이 (172×320, ST7789V2)
- **Web Simulator**: 브라우저 기반 테스트 환경

### 핵심 기능
- 6가지 상태 표시: `start`, `idle`, `working`, `notification`, `done`, `sleep`
- 2개 캐릭터: `clawd` (오렌지), `kiro` (흰색 고스트)
- 실시간 애니메이션: 부유 효과, 깜빡임, 로딩 도트
- IDE 통합: 훅 시스템을 통한 자동 상태 업데이트

## 아키텍처 패턴

### 1. 상태 기반 렌더링
모든 플랫폼에서 동일한 상태 시스템을 사용합니다:

```javascript
// shared/config.js - 단일 진실 소스
export const states = {
  start: { bgColor: '#00CCCC', eyeType: 'sparkle', textColor: '#000000' },
  idle: { bgColor: '#00AA00', eyeType: 'normal', textColor: '#FFFFFF' },
  working: { bgColor: '#0066CC', eyeType: 'focused', textColor: '#FFFFFF' },
  // ...
};
```

### 2. 캐릭터 시스템
확장 가능한 캐릭터 구조:

```javascript
// 새 캐릭터 추가 시 이 구조를 따르세요
export const CHARACTER_CONFIG = {
  character_name: {
    name: 'character_name',
    displayName: 'Display Name',
    color: '#HEXCOLOR',
    body: { x, y, w, h },
    eyes: { left: {x, y}, right: {x, y}, w, h },
    isGhost: boolean  // 스프라이트 기반 렌더링 여부
  }
};
```

### 3. 크로스 플랫폼 호환성
- **ESP32**: C++ 구현, sprites.h에서 픽셀 단위 렌더링
- **Desktop/Web**: JavaScript 구현, Canvas API 사용
- **공통**: 64×64 기본 크기, 2배 스케일링으로 128×128

## 코딩 표준

### 1. 파일 구조
```
vibe-monitor/
├── shared/           # 공통 로직 (Desktop/Web)
│   ├── config.js     # 상태/캐릭터 설정
│   ├── character.js  # 캐릭터 렌더링
│   ├── effects.js    # 애니메이션 효과
│   └── sprites.js    # 스프라이트 데이터
├── desktop/          # Electron 앱
├── simulator/        # 웹 시뮬레이터
├── hooks/            # IDE 훅 스크립트
├── vibe-monitor.ino  # ESP32 펌웨어
└── sprites.h         # ESP32 스프라이트
```

### 2. 네이밍 컨벤션
- **상태**: snake_case (`start`, `done`)
- **캐릭터**: 소문자 (`clawd`, `kiro`)
- **색상**: RGB565 (ESP32), HEX (Web/Desktop)
- **함수**: camelCase (JS), snake_case (C++)

### 3. 애니메이션 패턴
```javascript
// 100ms 간격 애니메이션 프레임
animFrame++;

// 부유 효과 (3.2초 주기)
const angle = (animFrame % 32) * (2.0 * Math.PI / 32.0);
const offsetX = Math.cos(angle) * FLOAT_AMPLITUDE_X;
const offsetY = Math.sin(angle) * FLOAT_AMPLITUDE_Y;

// 깜빡임 효과 (프레임 기반)
const shouldShow = (animFrame % 20) < 10;
```

### 4. HTTP API 표준
```bash
# 상태 업데이트
POST /status
{
  "state": "working",
  "event": "PreToolUse",
  "tool": "Bash",
  "project": "my-project",
  "model": "opus",
  "memory": "45%",
  "character": "clawd"
}

# 상태 조회
GET /status

# 헬스 체크
GET /health
```

## 개발 워크플로우

### 1. 새 상태 추가
1. `shared/config.js`에 상태 정의 추가
2. `sprites.h`에 C++ 매핑 추가
3. 필요시 새 eye type 구현
4. 모든 플랫폼에서 테스트

### 2. 새 캐릭터 추가
1. `CHARACTER_CONFIG`에 캐릭터 정의
2. 스프라이트 기반이면 `sprites.js`에 데이터 추가
3. ESP32용 `sprites.h`에 렌더링 로직 추가
4. 시스템 트레이 아이콘 렌더링 업데이트

### 3. 테스트 방법
```bash
# 웹 시뮬레이터 (하드웨어 불필요)
open simulator/index.html

# 데스크톱 앱
cd desktop && npm start

# ESP32 하드웨어 테스트
echo '{"state":"working","tool":"Bash"}' > /dev/cu.usbmodem1101
```

## 성능 최적화

### 1. 렌더링 최적화
- **부분 업데이트**: 변경된 영역만 다시 그리기
- **아이콘 캐싱**: 시스템 트레이 아이콘 메모리 캐시
- **프레임 제한**: 100ms 간격으로 애니메이션 업데이트

### 2. 메모리 관리
- ESP32: 스프라이트 데이터를 PROGMEM에 저장
- Desktop: 아이콘 캐시로 Canvas 생성 비용 절약
- 불필요한 재렌더링 방지

### 3. 통신 최적화
- HTTP 타임아웃: 연결 1초, 전체 5초
- 직렬 통신: 115200 baud rate
- 에러 처리: 실패 시 조용히 무시

## 디버깅 가이드

### 1. 로그 활성화
```bash
# 훅 스크립트 디버그
echo '{"hook_event_name":"SessionStart","cwd":"/path/to/project"}' | DEBUG=1 python3 config/claude/hooks/vibe-monitor.py

# ESP32 시리얼 모니터
screen /dev/cu.usbmodem1101 115200
```

### 2. 일반적인 문제
- **ESP32 디스플레이 안됨**: `User_Setup.h` 복사 확인
- **데스크톱 앱 안보임**: 시스템 트레이 확인 또는 `/show` API 호출
- **훅 작동 안함**: 스크립트 실행 권한 및 환경변수 확인

### 3. 개발 도구
```bash
# API 테스트
curl -X POST http://127.0.0.1:19280/status -d '{"state":"working"}'

# 디스플레이 정보
curl http://127.0.0.1:19280/debug

# 포트 사용 확인
lsof -i :19280
```

## 확장성 고려사항

### 1. 새 플랫폼 추가
- `shared/` 로직 재사용
- 플랫폼별 렌더링 구현
- HTTP API 호환성 유지

### 2. 새 IDE 지원
- 훅 이벤트 매핑 추가
- 캐릭터 자동 감지 로직
- 환경변수 설정 가이드

### 3. 국제화
- 상태 텍스트 다국어 지원
- 폰트 렌더링 고려
- 문자 인코딩 처리

이 가이드를 따라 일관성 있고 확장 가능한 코드를 작성하세요.
