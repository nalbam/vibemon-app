# Vibe Monitor

[![npm version](https://img.shields.io/npm/v/vibe-monitor.svg)](https://www.npmjs.com/package/vibe-monitor)
[![npm downloads](https://img.shields.io/npm/dm/vibe-monitor.svg)](https://www.npmjs.com/package/vibe-monitor)
[![license](https://img.shields.io/npm/l/vibe-monitor.svg)](https://github.com/nalbam/vibe-monitor/blob/main/LICENSE)

**Real-time status monitor for AI assistants with pixel art character display.**

See at a glance what your AI assistant is doing — thinking, working, or waiting for input. A cute pixel art character visually represents the current state.

![Demo](https://raw.githubusercontent.com/nalbam/vibe-monitor/main/screenshots/demo.gif)

## Supported Tools

- **[Claude Code](https://claude.ai/code)** - Anthropic's AI coding assistant
- **[Kiro](https://kiro.dev/)** - AWS's AI coding assistant
- **[OpenClaw](https://openclaw.ai/)** - Open-source computer use agent

## Features

- **Frameless Window** - Clean floating design
- **Always on Top** - Always displayed above other windows
- **System Tray** - Quick control from the menu bar
- **Multi-window** - One window per project (up to 5)
- **HTTP API** - Easy integration with hooks
- **Auto-launch** - Hook scripts auto-start via `npx vibe-monitor`

## Installation

### npx (Recommended)

```bash
npx vibe-monitor@latest
```

### Global Install

```bash
npm install -g vibe-monitor
vibe-monitor
```

## IDE Integration

### Quick Install (Recommended)

```bash
curl -fsSL https://nalbam.github.io/vibe-monitor/install.py | python3
```

This will configure hooks for Claude Code, Kiro, or OpenClaw automatically.

### Manual Setup

See the [full documentation](https://github.com/nalbam/vibe-monitor#integration) for manual setup instructions.

## Stop

```bash
curl -X POST http://127.0.0.1:19280/quit
```

## Links

- [Homepage](https://nalbam.github.io/vibe-monitor/)
- [GitHub Repository](https://github.com/nalbam/vibe-monitor)
- [Full Documentation](https://github.com/nalbam/vibe-monitor#readme)

## License

MIT
