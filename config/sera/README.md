# OpenClaw(세라) 재설정/복구 가이드

이 문서는 **세라(OpenClaw 에이전트)**를 다른 머신/새 SD카드/재설치 상황에서 **빠르게 원상복구**하기 위한 체크리스트입니다.

> 목표: “파일/토큰/설정 백업 → OpenClaw 설치 → 설정 복원 → Gateway 기동 → Slack 연결 확인”

---

## 0) 용어 정리

- **Gateway**: OpenClaw 백엔드 데몬(채널 연결, 도구 실행, 세션 관리)
- **Workspace**: 에이전트의 성격/규칙/기억 파일이 들어있는 폴더 (이 리포지토리)
- **Config**: Gateway 설정(채널 토큰, 라우팅, 도구 키 등)

---

## 1) 반드시 백업할 것(가장 중요)

아래 경로들을 통째로 백업해두면 “거의 그대로” 복원됩니다.

### 1.1 핵심 설정/토큰
- `~/.openclaw/openclaw.json`  ← **Gateway 메인 설정 파일**
- `~/.openclaw/.env`           ← 환경변수(토큰/키를 env로 넣었으면 중요)

### 1.2 인증/자격 증명
- `~/.openclaw/credentials/`   ← OAuth/세션 등(사용 중인 경우)
- `~/.openclaw/agents/`        ← 에이전트별 auth profile 등

### 1.3 데이터/상태(선택이지만 있으면 편함)
- `~/.openclaw/cron/`          ← 크론(리마인더/정기 작업)
- `~/.openclaw/memory/`        ← 런타임 메모리/상태 파일

### 1.4 Workspace(세라의 성격/규칙/기억)
- `~/.openclaw/workspace/`     ← **이 폴더 자체**
  - `SOUL.md`, `USER.md`, `MEMORY.md`, `memory/*.md` 등이 여기 있습니다.

> 팁: 가장 안전한 백업 단위는 `~/.openclaw/` 전체입니다.

---

## 2) 새 환경 준비(Prereqs)

- Node.js **>= 22**
- (권장) `pnpm`은 소스 빌드 시에만 필요

버전 확인:
```bash
node -v
```

---

## 3) OpenClaw 설치

### 3.1 권장: 설치 스크립트
```bash
curl -fsSL https://openclaw.bot/install.sh | bash
```

### 3.2 대안: npm 글로벌 설치
```bash
npm install -g openclaw@latest
```

설치 확인:
```bash
openclaw --help
```

---

## 4) 설정 복원(백업에서 되돌리기)

1) 백업해둔 `~/.openclaw/`를 새 머신에 복사합니다.
   - 최소: `openclaw.json`, `.env`, `workspace/`
2) 권한이 꼬였으면(특히 `.env`, `openclaw.json`):
```bash
chmod 600 ~/.openclaw/openclaw.json ~/.openclaw/.env || true
```

---

## 5) Slack 연결(이 환경 기준)

현재 세라는 Slack `#sandbox` 채널에서 동작합니다.

### 5.1 Socket Mode(기본) 토큰
Slack Socket Mode는 보통 아래 2개가 필요합니다.
- **App Token**: `xapp-...`
- **Bot Token**: `xoxb-...`

토큰을 env로 쓰는 경우(권장):
```bash
export SLACK_APP_TOKEN="xapp-..."
export SLACK_BOT_TOKEN="xoxb-..."
```

또는 `~/.openclaw/.env`에 넣어도 됩니다.

Slack 앱 설정 방법(공식 문서):
- 로컬 문서: `/home/pi/.npm-global/lib/node_modules/openclaw/docs/channels/slack.md`
- 핵심: Socket Mode 활성화 + `connections:write` app token + bot scope 설정

---

## 6) Gateway 실행/재시작

### 6.1 서비스(데몬)로 실행 중이면
```bash
openclaw gateway status
openclaw gateway restart
```

### 6.2 포그라운드로 수동 실행(테스트용)
```bash
openclaw gateway --port 18789 --verbose
```

대시보드/Control UI(로컬):
- `http://127.0.0.1:18789/`

---

## 7) 동작 확인(2분 점검)

```bash
openclaw status
openclaw health
openclaw channels status
```

Slack이 제대로 붙었는지 확인:
```bash
openclaw channels capabilities --channel slack
```

---

## 8) “세라” 워크스페이스 확인 체크리스트

이 폴더(`~/.openclaw/workspace`)에 아래가 있어야 “성격/기억”이 유지됩니다.

- `SOUL.md` : 말투/규칙(존댓말 등)
- `USER.md` : 사용자 정보(호칭: 날밤님 등)
- `MEMORY.md` : 장기 기억
- `memory/YYYY-MM-DD.md` : 일지/로그
- `HEARTBEAT.md` : 주기 작업(비어있으면 heartbeat 스킵)

---

## 9) 문제 해결(자주 겪는 증상)

### 9.1 Slack에서 반응이 없어요
- Gateway가 떠있는지: `openclaw gateway status`
- 토큰이 맞는지: `SLACK_APP_TOKEN`, `SLACK_BOT_TOKEN`
- Slack 앱에서 Socket Mode 켰는지
- 봇을 채널에 초대했는지

### 9.2 설정 파일 위치가 헷갈려요
- 이 환경에서 메인 설정은: `~/.openclaw/openclaw.json`
- 워크스페이스는: `~/.openclaw/workspace/`

---

## 10) 재설정 원칙(추천)

- **백업 우선순위 1순위:** `~/.openclaw/openclaw.json` + `~/.openclaw/workspace/`
- 외부 노출 방지: 토큰은 가능하면 `.env`/권한 600으로 관리
- 큰 변경(채널 추가/라우팅 변경)은 한 번에 하지 말고, 변경 후 `openclaw health`로 확인

---

## 참고 문서(로컬)

- Getting Started: `/home/pi/.npm-global/lib/node_modules/openclaw/docs/start/getting-started.md`
- Slack: `/home/pi/.npm-global/lib/node_modules/openclaw/docs/channels/slack.md`
- `openclaw config` CLI: `/home/pi/.npm-global/lib/node_modules/openclaw/docs/cli/config.md`
- `openclaw channels` CLI: `/home/pi/.npm-global/lib/node_modules/openclaw/docs/cli/channels.md`
