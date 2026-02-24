# Features

## Characters

| Character | Color | Description | Auto-selected for |
|-----------|-------|-------------|-------------------|
| `apto` | Gray-Purple | Rounded character | Apto |
| `clawd` | Orange | Default character | Claude Code |
| `kiro` | White | Ghost character | Kiro |
| `claw` | Red | Antenna character | OpenClaw |

All characters use **image-based rendering** (128x128 PNG). Character is **auto-detected** based on the IDE hook events. You can also manually change it via the system tray menu.

## States

| State | Background | Eyes | Text | Trigger |
|-------|------------|------|------|---------|
| `start` | Cyan | ■ ■ + ✦ | Hello! | Session begins |
| `idle` | Green | ■ ■ | Ready | Waiting for input |
| `thinking` | Purple | ▀ ▀ + 💭 | Thinking | User submits prompt |
| `planning` | Teal | ▀ ▀ + 💭 | Planning | Plan mode active |
| `working` | Blue | 🕶️ (sunglasses) | (tool-based) | Tool executing |
| `packing` | Gray | ▀ ▀ + 💭 | Packing | Context compacting |
| `notification` | Yellow | ● ● + ? | Input? | User input needed |
| `done` | Green | > < | Done! | Tool completed |
| `sleep` | Navy | ─ ─ + Z | Zzz... | 5min inactivity |
| `alert` | Red | ■ ■ + ! | Alert | Critical error/failure |

### Working State Text

The `working` state displays fixed text based on the active tool:

| Tool | Text |
|------|------|
| Bash | Running |
| Read | Reading |
| Edit | Editing |
| Write | Writing |
| Grep / WebSearch | Searching |
| Glob | Scanning |
| WebFetch | Fetching |
| Task | Tasking |
| Default | Working |

### State Timeout

| From State | Timeout | To State |
|------------|---------|----------|
| `start`, `done` | 1 minute | `idle` |
| `planning`, `thinking`, `working`, `packing`, `notification`, `alert` | 5 minutes | `idle` |
| `idle` | 5 minutes | `sleep` |

**Desktop only:** After 10 minutes in sleep state, the window automatically closes.

### Display Behavior

- **Memory hidden on start**: Memory percentage is not displayed during `start` state
- **Project change resets**: Model and memory are cleared when switching to a different project

## Animations

- **Floating**: Gentle motion (±3px horizontal, ±5px vertical, ~3.2s cycle)
- **Blink**: Idle state blinks every 3.2 seconds
- **Loading dots**: Thinking/planning/packing/working states show animated progress dots
  - Thinking/planning/packing: 3x slower animation for contemplative feel
  - Working: Normal speed animation
- **Matrix rain**: Working state shows falling green code effect (Desktop only)
- **Sunglasses**: Working state character wears Matrix-style sunglasses
- **Sparkle**: Session start and working states show rotating sparkle effect
- **Thought bubble**: Thinking, planning, and packing states show animated thought bubble
- **Zzz**: Sleep state shows blinking Z animation
- **Memory bar**: Gradient colors based on usage thresholds:
  - 0-74%: Green
  - 75-89%: Yellow (warning)
  - 90-100%: Red (critical)

## Window Mode

The Desktop App supports two window modes:

| Mode | Description |
|------|-------------|
| `multi` | One window per project (max 5) - **Default** |
| `single` | One window with project lock support |

### Multi-Window Mode (Default)

- Each project gets its own window
- Windows arranged by state and name:
  - **Right side**: Active states (thinking, planning, working, packing, notification)
  - **Left side**: Inactive states (start, idle, done, sleep)
  - Within each group, sorted by project name (Z first = rightmost)
- Max 5 windows (or screen limit)
- 10px gap between windows

### Single-Window Mode

- Only one window at a time
- Project lock feature available
- When switching projects, the same window is reused

### Switching Modes

Use the system tray menu or API:

```bash
curl -X POST http://127.0.0.1:19280/window-mode \
  -H "Content-Type: application/json" \
  -d '{"mode":"single"}'
```

## Project Lock

Lock the monitor to a specific project to prevent display updates from other projects.

> **Note:** Project lock is only available in **single-window mode**.

### Lock Modes

| Mode | Description |
|------|-------------|
| `first-project` | First incoming project is automatically locked |
| `on-thinking` | Lock when entering thinking state (default) |

### CLI Commands

```bash
# Lock current project
python3 ~/.claude/hooks/vibemon.py --lock

# Lock specific project
python3 ~/.claude/hooks/vibemon.py --lock my-project

# Unlock
python3 ~/.claude/hooks/vibemon.py --unlock

# Get current status
python3 ~/.claude/hooks/vibemon.py --status

# Get/Set lock mode
python3 ~/.claude/hooks/vibemon.py --lock-mode
python3 ~/.claude/hooks/vibemon.py --lock-mode on-thinking

# Reboot ESP32 device
python3 ~/.claude/hooks/vibemon.py --reboot
```

## Desktop App Features

- **Single instance**: Only one app instance can run at a time
- **Frameless window**: Clean floating design
- **Always on Top**: Stays visible above other windows (configurable modes)
- **System Tray**: Quick access from menubar/taskbar
- **Draggable**: Move window anywhere on screen
- **Snap to corner**: Auto-snaps to screen corners (30px threshold)
- **Click to focus terminal**: Click window to switch to iTerm2/Ghostty tab (macOS only)

### Always on Top Modes

| Mode | Description |
|------|-------------|
| `active-only` | Only active states (thinking, planning, working, packing, notification) stay on top - **Default** |
| `all` | All windows stay on top regardless of state |
| `disabled` | No windows stay on top |

When `active-only` is selected:
- Active states (thinking, planning, working, packing, notification) immediately enable always on top
- Inactive states (start, idle, done, sleep) immediately disable always on top (prevents focus stealing)

Change via system tray menu: Always on Top → Select mode

### Click to Focus Terminal (macOS)

When running Claude Code in multiple terminal tabs, clicking a VibeMon window automatically switches to the corresponding terminal tab.

**Supported Terminals:**
- iTerm2 (full tab switching support)
- Ghostty (application activation)

**Requirements:**
- macOS only (uses AppleScript)
- iTerm2 or Ghostty terminal

### System Tray Menu

- View active windows and their states
- Manually change state (per window)
- Switch character (Apto/Clawd/Kiro/Claw)
- Rearrange windows (multi-window mode only)
- Toggle Always on Top
- Toggle window mode (Multi/Single)
- Open at Login toggle
- Project lock (in single mode)
- Claude Stats
- Quit

## Build

```bash
cd desktop

npm run build:mac     # macOS (DMG, ZIP)
npm run build:win     # Windows (NSIS, Portable)
npm run build:linux   # Linux (AppImage, DEB)
npm run build:all     # All platforms
```
