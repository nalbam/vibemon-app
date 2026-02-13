# VibeMon

[![npm version](https://img.shields.io/npm/v/vibemon.svg)](https://www.npmjs.com/package/vibemon)
[![npm downloads](https://img.shields.io/npm/dm/vibemon.svg)](https://www.npmjs.com/package/vibemon)
[![license](https://img.shields.io/npm/l/vibemon.svg)](https://github.com/nalbam/vibemon-app/blob/main/LICENSE)

**Real-time status monitor for AI assistants with pixel art character display.**

See at a glance what your AI assistant is doing — thinking, working, or waiting for input. A cute pixel art character visually represents the current state.

## Supported Tools

| Tool | Description |
|------|-------------|
| **[Claude Code](https://claude.ai/code)** | Anthropic's official AI coding assistant |
| **[Kiro](https://kiro.dev/)** | AWS's AI coding assistant |
| **[OpenClaw](https://openclaw.ai/)** | Open-source computer use agent |

## What It Monitors

| Field | Description | Example |
|-------|-------------|---------|
| **State** | Current activity state | `working`, `idle`, `notification` |
| **Project** | Active project directory | `vibemon-app` |
| **Tool** | Currently executing tool | `Bash`, `Read`, `Edit` |
| **Model** | Active model | `Opus 4.5`, `Sonnet` |
| **Memory** | Context window usage | `45%` |

## Platforms

| Platform | Description | Best For |
|----------|-------------|----------|
| **ESP32 Hardware** | Dedicated LCD display (172×320) | Primary, always-on desk companion |
| **Desktop App** | Electron app with system tray | Alternative for non-hardware users |

## Preview

![VibeMon Demo](screenshots/demo.gif)

## Documentation

For installation and setup instructions, visit **[vibemon.io/docs](https://vibemon.io/docs)**.

## States

| State | Color | Description |
|-------|-------|-------------|
| `start` | Cyan | Session begins |
| `idle` | Green | Waiting for input |
| `thinking` | Purple | Processing prompt |
| `planning` | Teal | Plan mode active |
| `working` | Blue | Tool executing |
| `packing` | Gray | Context compacting |
| `notification` | Yellow | User input needed |
| `done` | Green | Tool completed |
| `sleep` | Navy | 5min inactivity |

See [Features](docs/features.md) for animations, working state text, and more.

## Characters

| Character | Color | Auto-selected for |
|-----------|-------|-------------------|
| `apto` | Gray-Purple | Apto |
| `clawd` | Orange | Claude Code |
| `kiro` | White | Kiro |
| `claw` | Red | OpenClaw |

## HTTP API

Default port: `19280`

### POST /status

Update monitor status:

```bash
curl -X POST http://127.0.0.1:19280/status \
  -H "Content-Type: application/json" \
  -d '{"state":"working","tool":"Bash","project":"my-project"}'
```

### GET /status

Get all windows' status:

```bash
curl http://127.0.0.1:19280/status
```

### POST /quit

Stop the application:

```bash
curl -X POST http://127.0.0.1:19280/quit
```

See [API Reference](docs/api.md) for all endpoints.

## Window Mode

| Mode | Description |
|------|-------------|
| `multi` | One window per project (max 5) - **Default** |
| `single` | One window with project lock support |

Switch via system tray menu or API:

```bash
curl -X POST http://127.0.0.1:19280/window-mode \
  -H "Content-Type: application/json" \
  -d '{"mode":"single"}'
```

## Project Lock

Lock the monitor to a specific project (single-window mode only):

```bash
# Lock
python3 ~/.claude/hooks/vibemon.py --lock

# Unlock
python3 ~/.claude/hooks/vibemon.py --unlock
```

See [Features](docs/features.md) for lock modes and CLI commands.

## Desktop App Features

- **Frameless window** - Clean floating design
- **Always on Top** - Stays visible above other windows
- **System Tray** - Quick access from menubar
- **Multi-window** - One window per project (up to 5)
- **Snap to corner** - Auto-snaps near screen edges
- **Click to focus** - Switch to iTerm2/Ghostty tab (macOS)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Window not appearing | Check system tray, or run `curl -X POST http://127.0.0.1:19280/show` |
| Port already in use | Check with `lsof -i :19280` |
| Hook not working | Verify Python 3: `python3 --version` |

## Documentation

- [Features](docs/features.md) - States, animations, window modes
- [API Reference](docs/api.md) - All HTTP endpoints
- [WiFi Provisioning](docs/wifi-provisioning.md) - ESP32 WiFi setup guide
- [Desktop App (npm)](desktop/README.md) - npm package README

## Version History

- **v1.5**: WebSocket support, new apto character, static engine CDN
- **v1.4**: New claw character, ESP32 claw support, image-based character rendering
- **v1.3**: Multi-window mode, window mode API, enhanced lock modes
- **v1.2**: Project lock, modular architecture, npx support
- **v1.1**: Desktop app, system tray, memory bar gradient
- **v1.0**: Pixel art character, web simulator

## License

MIT
