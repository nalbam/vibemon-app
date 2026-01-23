# Claude Monitor Desktop App

macOS용 프레임 없는 데스크톱 앱으로, Claude Code의 상태를 실시간으로 모니터링합니다.

## Features

- **프레임 없는 창**: 깔끔한 floating 디자인
- **Always on Top**: 다른 창 위에 항상 표시
- **시스템 트레이**: 메뉴바에서 빠르게 제어
- **HTTP API**: Claude Code hooks와 쉽게 연동
- **드래그 가능**: 창을 원하는 위치로 이동

## Installation

```bash
cd desktop
npm install
```

## Usage

### 앱 실행

```bash
npm start
```

### HTTP API로 상태 업데이트

```bash
# Working 상태로 변경
curl -X POST http://127.0.0.1:19280/status \
  -H "Content-Type: application/json" \
  -d '{"state":"working","tool":"Bash","project":"my-project"}'

# 현재 상태 확인
curl http://127.0.0.1:19280/status
```

### Claude Code Hooks 연동

`claude-config/hooks/esp32-status.sh`에 Desktop App 지원이 통합되어 있습니다.

Hook이 상태 업데이트를 전송하는 순서:
1. **Desktop App** (`http://127.0.0.1:19280`) - 항상 시도
2. **ESP32 USB Serial** - 설정된 경우
3. **ESP32 HTTP** - 설정된 경우

Desktop 앱을 실행하고 Claude Code를 사용하면 자동으로 상태가 업데이트됩니다.

## States

| State | Background | Description |
|-------|------------|-------------|
| `idle` | Green | Ready/대기 상태 |
| `working` | Blue | 작업 진행 중 |
| `notification` | Yellow | 입력 요청 |
| `session_start` | Cyan | 세션 시작 |
| `tool_done` | Green | 도구 완료 |

## API

### POST /status

상태 업데이트

```json
{
  "state": "working",
  "event": "PreToolUse",
  "tool": "Bash",
  "project": "claude-monitor"
}
```

### GET /status

현재 상태 조회

```json
{
  "state": "idle"
}
```

### GET /health

Health check endpoint

```json
{
  "status": "ok"
}
```

### POST /show

창을 보이게 하고 우측 상단으로 이동

```json
{
  "success": true
}
```

## Build

macOS 앱으로 빌드:

```bash
npm run build:mac
```

## Tray Menu

시스템 트레이 아이콘을 클릭하면:
- 현재 상태 확인
- 상태 수동 변경
- Always on Top 토글
- 창 표시/숨기기
- 종료

## Port

기본 HTTP 서버 포트: `19280`

(main.js의 `HTTP_PORT` 상수로 변경 가능)
