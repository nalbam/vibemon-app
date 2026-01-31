# esp32-status-bridge 설정/운영 가이드

`esp32-status-bridge.mjs`는 **OpenClaw Gateway 로그(JSONL)**를 tail 하면서,
현재 동작 상태를 **ESP32-C6(USB Serial, `/dev/ttyACM*`)**로 **NDJSON 한 줄(JSON + `\n`)** 형태로 흘려보내는 브릿지입니다.

- 입력(브릿지가 읽는 것): OpenClaw 로그 파일 (`/tmp/openclaw/openclaw-YYYY-MM-DD.log`)
- 출력(ESP32로 쓰는 것): `/dev/ttyACM0` 등
- 출력 예시:
  ```json
  {"state":"working","tool":"exec","project":"Sera","ts":"2026-01-31T04:12:33.123Z"}
  ```

> 참고: `done → idle` 전환은 **VibeMon**이 담당합니다. 브릿지는 **thinking/planning/working/done**만 보냅니다.

---

## 1) 파일 구성

- `scripts/esp32-status-bridge.mjs` : 브릿지 본체(Node.js)
- `scripts/sera-esp32-bridge.service` : systemd (system) 서비스 유닛(권장: 라즈베리파이/서버)
- `scripts/sera-esp32-bridge.user.service` : systemd (user) 서비스 유닛(선택)

---

## 2) 사전 준비(필수)

### 2.1 ESP32를 USB로 연결
- ESP32-C6 보드를 USB로 연결하면 보통 `/dev/ttyACM0` 같은 디바이스로 잡힙니다.
- 확인:
```bash
ls -la /dev/ttyACM*
dmesg | tail -n 50
```

### 2.2 시리얼 권한(dialout)
브릿지는 해당 TTY에 write 해야 합니다.

- 현재 사용자(예: `pi`)를 `dialout`에 추가:
```bash
sudo usermod -aG dialout pi
# 적용을 위해 로그아웃/재부팅 필요할 수 있음
```

권한이 없으면 브릿지에서 아래와 유사한 경고가 뜹니다.
- `Found /dev/ttyACM0 but not writable. Check permissions (dialout group) ...`

### 2.3 OpenClaw 로그가 생성되는지 확인
브릿지는 기본으로 아래 로그를 tail 합니다.
- `OPENCLAW_LOG_DIR=/tmp/openclaw`
- 파일 패턴: `openclaw-YYYY-MM-DD.log`

확인:
```bash
ls -la /tmp/openclaw
```

> 만약 로그 경로가 다르면 `OPENCLAW_LOG_DIR` 환경변수로 맞춰주셔야 합니다.

---

## 3) 빠른 실행(수동 테스트)

서비스로 올리기 전에, 먼저 수동으로 테스트하는 게 제일 안전합니다.

```bash
cd ~/.openclaw/workspace
node scripts/esp32-status-bridge.mjs
```

정상이라면 stderr에 이런 로그가 나옵니다.
- `Using tty: /dev/ttyACM0`
- `Tailing log: /tmp/openclaw/openclaw-YYYY-MM-DD.log`

ESP32 쪽에서 JSON 라인이 수신되는지 확인하세요.

---

## 4) 환경변수(설정값)

브릿지는 아래 환경변수를 사용합니다.

- `SERA_PROJECT` (기본: `Sera`)
  - ESP32 디스플레이에 찍을 프로젝트/이름 구분용
- `OPENCLAW_LOG_DIR` (기본: `/tmp/openclaw`)
  - OpenClaw 로그 디렉토리

예:
```bash
SERA_PROJECT=Sera \
OPENCLAW_LOG_DIR=/tmp/openclaw \
node scripts/esp32-status-bridge.mjs
```

---

## 5) 상태(state) 스펙(ESP32 입력 프로토콜)

브릿지는 아래 상태들만 보냅니다.

- `thinking` : 사용자가 프롬프트 전달(런 시작) / 응답 생성 중
- `planning` : 프롬프트 해석/계획 단계(embedded run prompt start/end 기반)
- `working` : tool 실행 중 (`tool` 필드 포함)
- `done` : 작업 완료(답변 deliver 또는 run 종료 감지)

`working`일 때는 추가 필드가 붙습니다.
- `tool`: 예) `exec`, `web_search`, `browser`, ...

공통 필드:
- `project`: `SERA_PROJECT`
- `ts`: ISO timestamp

---

## 6) systemd로 상시 실행(권장)

### 6.1 (system) 서비스로 설치
`pi` 유저 기준 예시입니다.

1) 유닛 파일 복사
```bash
sudo cp ~/.openclaw/workspace/scripts/sera-esp32-bridge.service /etc/systemd/system/sera-esp32-bridge.service
```

2) systemd 리로드
```bash
sudo systemctl daemon-reload
```

3) 활성화 + 시작
```bash
sudo systemctl enable --now sera-esp32-bridge.service
```

4) 상태/로그 확인
```bash
sudo systemctl status sera-esp32-bridge.service -n 50
sudo journalctl -u sera-esp32-bridge.service -f
```

### 6.2 (user) 서비스로 설치(선택)
GUI 로그인 세션/유저 서비스로 돌리고 싶을 때만 사용하세요.

```bash
mkdir -p ~/.config/systemd/user
cp ~/.openclaw/workspace/scripts/sera-esp32-bridge.user.service ~/.config/systemd/user/sera-esp32-bridge.service
systemctl --user daemon-reload
systemctl --user enable --now sera-esp32-bridge.service
journalctl --user -u sera-esp32-bridge.service -f
```

---

## 7) 트러블슈팅

### 7.1 `/dev/ttyACM*`가 없어요
- 케이블(데이터 지원) 확인
- `dmesg | tail`로 인식 로그 확인
- 보드 리셋/부트모드 확인

### 7.2 권한 문제로 쓰기 실패
- `ls -la /dev/ttyACM0`에서 그룹이 `dialout`인지 확인
- `pi`가 `dialout` 그룹에 포함됐는지 확인:
```bash
groups pi
```

### 7.3 OpenClaw 로그 파일이 없다고 나와요
- 브릿지는 **오늘 날짜** 파일만 봅니다: `openclaw-YYYY-MM-DD.log`
- `OPENCLAW_LOG_DIR`가 실제 로그 경로와 일치하는지 확인
- Gateway가 로그를 그 위치에 쓰고 있는지 확인

---

## 8) 개선 아이디어(필요 시)

현재 v1은 “TTY 변경 감지”만 하고 **재오픈(reopen)**은 하지 않습니다.
USB 재연결이 잦다면 아래 개선을 권장합니다.
- `/dev/ttyACM*` 변경 시 기존 stream 종료 + 새 stream open
- ESP32로 heartbeat/ping 주기 전송
