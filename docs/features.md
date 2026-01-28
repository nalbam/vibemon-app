# Features

## Characters

| Character | Color | Description | Auto-selected for |
|-----------|-------|-------------|-------------------|
| `clawd` | Orange | Default character with arms and legs | Claude Code |
| `kiro` | White | Ghost character with wavy tail | Kiro |

Character is **auto-detected** based on the IDE hook events. You can also manually change it via the system tray menu.

## States

| State | Background | Eyes | Text | Trigger |
|-------|------------|------|------|---------|
| `start` | Cyan | ■ ■ + ✦ | Hello! | Session begins |
| `idle` | Green | ■ ■ | Ready | Waiting for input |
| `thinking` | Purple | ▀ ▀ + 💭 | Thinking | User submits prompt |
| `planning` | Teal | ▀ ▀ + 💭 | Planning | Plan mode active |
| `working` | Blue | 🕶️ (sunglasses) | (tool-based) | Tool executing |
| `notification` | Yellow | ● ● + ? | Input? | User input needed |
| `done` | Green | > < | Done! | Tool completed |
| `sleep` | Navy | ─ ─ + Z | Zzz... | 5min inactivity |

### Working State Text

The `working` state displays context-aware text based on the active tool:

| Tool | Possible Text |
|------|---------------|
| Bash | Running, Executing, Processing |
| Read | Reading, Scanning, Checking |
| Edit | Editing, Modifying, Fixing |
| Write | Writing, Creating, Saving |
| Grep | Searching, Finding, Looking |
| Glob | Scanning, Browsing, Finding |
| Task | Thinking, Working, Planning |
| WebFetch | Fetching, Loading, Getting |
| WebSearch | Searching, Googling, Looking |
| Default | Working, Busy, Coding |

### State Timeout

| From State | Timeout | To State |
|------------|---------|----------|
| `start`, `done` | 1 minute | `idle` |
| `idle`, `notification` | 5 minutes | `sleep` |

**Desktop only:** After 10 minutes in sleep state, the window automatically closes.

## Animations

- **Floating**: Gentle motion (±3px horizontal, ±5px vertical, ~3.2s cycle)
- **Blink**: Idle state blinks every 3 seconds
- **Loading dots**: Thinking/working states show animated progress dots
- **Matrix rain**: Working state shows falling green code effect
- **Sunglasses**: Working state character wears Matrix-style sunglasses
- **Sparkle**: Session start shows rotating sparkle effect
- **Thought bubble**: Thinking state shows animated thought bubble
- **Zzz**: Sleep state shows blinking Z animation

## Window Mode

The Desktop App supports two window modes:

| Mode | Description |
|------|-------------|
| `multi` | One window per project (max 5) - **Default** |
| `single` | One window with project lock support |

### Multi-Window Mode (Default)

- Each project gets its own window
- Windows arranged right-to-left from screen corner
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
python3 ~/.claude/hooks/vibe-monitor.py --lock

# Lock specific project
python3 ~/.claude/hooks/vibe-monitor.py --lock my-project

# Unlock
python3 ~/.claude/hooks/vibe-monitor.py --unlock

# Get current status
python3 ~/.claude/hooks/vibe-monitor.py --status

# Get/Set lock mode
python3 ~/.claude/hooks/vibe-monitor.py --lock-mode
python3 ~/.claude/hooks/vibe-monitor.py --lock-mode on-thinking
```

## Desktop App Features

- **Frameless window**: Clean floating design
- **Always on Top**: Stays visible above other windows
- **System Tray**: Quick access from menubar/taskbar
- **Draggable**: Move window anywhere on screen
- **Snap to corner**: Auto-snaps to screen corners (30px threshold)
- **Click to focus terminal**: Click window to switch to iTerm2 tab (macOS only)

### Click to Focus Terminal (macOS)

When running Claude Code in multiple iTerm2 tabs, clicking a Vibe Monitor window automatically switches to the corresponding terminal tab.

**Requirements:**
- macOS only (uses AppleScript)
- iTerm2 terminal

### System Tray Menu

- View active windows and their states
- Manually change state (per window)
- Switch character (Clawd/Kiro)
- Toggle window mode (Multi/Single)
- Project lock (in single mode)
- Toggle Always on Top
- Quit

## Build

```bash
cd desktop

npm run build:mac     # macOS (DMG, ZIP)
npm run build:win     # Windows (NSIS, Portable)
npm run build:linux   # Linux (AppImage, DEB)
npm run build:all     # All platforms
```
