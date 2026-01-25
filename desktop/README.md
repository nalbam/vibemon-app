# Vibe Monitor Desktop App

Electron-based desktop app for real-time monitoring of AI coding assistants (Claude Code, Kiro IDE/CLI) with pixel art character.

## Features

- **Frameless Window**: Clean floating design
- **Always on Top**: Always displayed above other windows
- **System Tray**: Quick control from the menu bar
- **HTTP API**: Easy integration with IDE hooks (Claude Code, Kiro)
- **Draggable**: Move the window to any position

## Installation

```bash
cd desktop
npm install
```

## Usage

### Run the App

```bash
npm start
```

### Update Status via HTTP API

```bash
# Change to working state
curl -X POST http://127.0.0.1:19280/status \
  -H "Content-Type: application/json" \
  -d '{"state":"working","tool":"Bash","project":"my-project","model":"opus","memory":"45%"}'

# Check current status
curl http://127.0.0.1:19280/status
```

### IDE Hooks Integration

#### Claude Code

Uses `hooks/vibe-monitor.sh` - see [main README](../README.md#claude-code-setup) for setup.

#### Kiro IDE

Copy hook files to `~/.kiro/hooks/` (or your project's `.kiro/hooks/` folder):

```bash
# Global installation (recommended)
mkdir -p ~/.kiro/hooks
cp config/kiro/hooks/*.kiro.hook ~/.kiro/hooks/

# Or project-level installation
# cp config/kiro/hooks/*.kiro.hook your-project/.kiro/hooks/
```

**Hook files:**
- `vibe-monitor-agent-spawn.kiro.hook` - Sends `start` on `agentSpawn`
- `vibe-monitor-prompt-submit.kiro.hook` - Sends `working` on `promptSubmit`
- `vibe-monitor-pre-tool-use.kiro.hook` - Sends `working` on `preToolUse`
- `vibe-monitor-agent-stop.kiro.hook` - Sends `idle` on `agentStop`

## Supported IDEs

| IDE | Hook System | Status |
|-----|-------------|--------|
| **Claude Code** | Shell hooks via `settings.json` | ✅ Supported |
| **Kiro IDE** | `.kiro.hook` files in `.kiro/hooks/` | ✅ Supported |

## States & Characters

See [main README](../README.md#state-display) for details on states, animations, and characters.

## API

### POST /status

Update status

```json
{
  "state": "working",
  "event": "PreToolUse",
  "tool": "Bash",
  "project": "vibe-monitor",
  "model": "opus",
  "memory": "45%",
  "character": "clawd"
}
```

### GET /status

Get current status

```json
{
  "state": "working",
  "project": "vibe-monitor",
  "tool": "Bash",
  "model": "opus",
  "memory": "45%"
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

Show window and position to top-right corner

```json
{
  "success": true
}
```

### GET /debug

Get display and window debug information (useful for troubleshooting positioning issues)

```json
{
  "primaryDisplay": {
    "bounds": { "x": 0, "y": 0, "width": 1920, "height": 1080 },
    "workArea": { "x": 0, "y": 0, "width": 1920, "height": 1040 },
    "scaleFactor": 1
  },
  "window": { "x": 1748, "y": 0, "width": 172, "height": 348 },
  "platform": "darwin"
}
```

## WSL (Windows Subsystem for Linux)

Running the Electron app on WSL requires WSLg (Windows 11) and additional dependencies.

### Prerequisites

1. **Windows 11** with WSLg support
2. **Update WSL**:
   ```bash
   wsl --update
   ```

### Install Dependencies

Electron requires several system libraries that are not installed by default on WSL:

```bash
# Ubuntu 24.04 (Noble) or later
sudo apt-get update && sudo apt-get install -y \
  libasound2t64 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnss3 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  libxshmfence1 \
  libglu1-mesa

# Ubuntu 22.04 (Jammy) or earlier
sudo apt-get update && sudo apt-get install -y \
  libasound2 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnss3 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2
```

### Run

```bash
cd desktop
npm install
npm start
```

### Troubleshooting

**Error: `libasound.so.2: cannot open shared object file`**

Install the audio library:
```bash
# Ubuntu 24.04+
sudo apt-get install -y libasound2t64

# Ubuntu 22.04 or earlier
sudo apt-get install -y libasound2
```

**GPU process errors (can be ignored)**

WSL may show GPU-related warnings like:
```
Exiting GPU process due to errors during initialization
```
These warnings don't affect app functionality.

**Window not appearing**

Ensure WSLg is working:
```bash
# Test with a simple GUI app
sudo apt-get install -y x11-apps
xclock
```

If xclock doesn't appear, WSLg may need to be enabled or updated.

## Build

Build for macOS:

```bash
npm run build:mac
```

Build DMG only:

```bash
npm run build:dmg
```

Build for Windows:

```bash
npm run build:win
```

Build for Linux:

```bash
npm run build:linux
```

Build for all platforms:

```bash
npm run build:all
```

## Tray Menu

Click the system tray icon to:
- Check current status
- Manually change status
- Toggle Always on Top
- Show/Hide window
- Quit

## Port

Default HTTP server port: `19280`

(Can be changed via `HTTP_PORT` constant in main.js)
