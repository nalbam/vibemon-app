# VibeMon Engine

Vibe Monitor 캐릭터 렌더링 엔진. `vibemon-engine-standalone.js` 하나로 모든 렌더링 가능.

## 사용법

### 1. 초기화

```javascript
import { createVibeMonEngine } from './vibemon-engine-standalone.js';

const canvas = document.getElementById('character-canvas');
const domElements = {
  display: document.getElementById('display'),
  statusText: document.getElementById('status-text'),
  loadingDots: document.getElementById('loading-dots'),
  projectValue: document.getElementById('project-value'),
  toolValue: document.getElementById('tool-value'),
  modelValue: document.getElementById('model-value'),
  memoryValue: document.getElementById('memory-value'),
  memoryBar: document.getElementById('memory-bar'),
  memoryBarContainer: document.getElementById('memory-bar-container'),
};

const engine = createVibeMonEngine(canvas, domElements);
await engine.init();
engine.startAnimation();
```

### 2. 상태 업데이트

```javascript
engine.setState({
  state: 'working',
  character: 'clawd',
  project: 'my-project',
  tool: 'Bash',
  model: 'opus',
  memory: 75
});
engine.render();
```

### 3. 종료

```javascript
engine.cleanup();
```

## 상태 (States)

| State | Color | Effect |
|-------|-------|--------|
| `start` | Cyan | Sparkle |
| `idle` | Green | Blinking |
| `thinking` | Purple | Thinking bubble |
| `planning` | Teal | Thinking bubble |
| `working` | Blue | Sparkle + Sunglasses |
| `packing` | Gray | Thinking bubble |
| `notification` | Yellow | Question mark |
| `done` | Green | Happy eyes |
| `sleep` | Navy | Zzz |

## 캐릭터 (Characters)

| Character | Color |
|-----------|-------|
| `clawd` | Orange (default) |
| `kiro` | White |
| `claw` | Red |

## 텍스트 (Working Tool)

| Tool | Text |
|------|------|
| `bash` | Running |
| `read` | Reading |
| `edit` | Editing |
| `write` | Writing |
| `grep` | Searching |
| `glob` | Scanning |
| `task` | Working |
| `webfetch` | Fetching |
| `websearch` | Searching |
| default | Working |

## 캐릭터 이미지

기본적으로 `https://static.vibemon.io/characters/`에서 로드됨.

커스텀 이미지 사용:
```javascript
const engine = createVibeMonEngine(canvas, domElements, {
  characterImageUrls: {
    clawd: './images/clawd.png',
    kiro: './images/kiro.png',
    claw: './images/claw.png'
  }
});
```

## 옵션

| Option | Default | Description |
|--------|---------|-------------|
| `useEmoji` | false | 아이콘에 이모지 사용 |
| `characterImageUrls` | (static server) | 캐릭터 이미지 경로 |
