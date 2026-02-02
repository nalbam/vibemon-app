# VibeMon Engine Visual Guide

## How It Works

### Simple Flow
```
┌─────────────────┐
│  State Update   │ (e.g., user action, IPC message)
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  engine.setState({      │
│    state: 'working',    │
│    tool: 'Bash',        │
│    project: 'demo'      │
│  })                     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│   engine.render()       │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  All UI Updates! ✨     │
│  - Background color     │
│  - Character animation  │
│  - Status text          │
│  - Info displays        │
│  - Memory bar           │
└─────────────────────────┘
```

## Rendering Pipeline

```
engine.render()
    │
    ├─► renderBackground()     → Updates display background color
    │
    ├─► renderTitle()          → Updates window title
    │
    ├─► renderStatusText()     → Updates status message
    │
    ├─► renderLoadingDots()    → Shows/hides loading animation
    │
    ├─► renderInfoLines()      → Updates project, tool, model, memory
    │
    ├─► renderMemoryBar()      → Updates memory usage bar
    │
    ├─► renderIcons()          → Draws pixel art or emoji icons
    │
    └─► renderCharacter()      → Draws character on canvas
```

## Animation System

```
startAnimation()
    │
    └─► requestAnimationFrame(animationLoop)
            │
            ├─► updateFloatingPosition()  → Smooth floating effect
            │
            ├─► updateLoadingDots()       → Animated dots
            │
            ├─► drawCharacter()           → Canvas rendering
            │       │
            │       ├─► State: 'idle'     → Blinking eyes
            │       ├─► State: 'thinking' → Thought bubble
            │       ├─► State: 'working'  → Matrix effect + sunglasses
            │       ├─► State: 'sleep'    → ZZZ effect
            │       └─► State: 'start'    → Sparkle effect
            │
            └─► requestAnimationFrame(animationLoop) → Loop continues
```

## State Flow Example

### Working State Transition

```
1. User calls engine.setState()
   ┌──────────────────────────────┐
   │ {                            │
   │   state: 'working',          │
   │   tool: 'Bash',              │
   │   project: 'my-project',     │
   │   memory: 75                 │
   │ }                            │
   └──────────────────────────────┘
                │
                ▼
2. Engine updates internal state
   ┌──────────────────────────────┐
   │ this.currentState = 'working'│
   │ this.currentTool = 'Bash'    │
   │ this.currentProject = '...'  │
   │ this.currentMemory = 75      │
   └──────────────────────────────┘
                │
                ▼
3. User calls engine.render()
   ┌──────────────────────────────────────┐
   │ renderBackground()                   │
   │   → Blue background (working state)  │
   ├──────────────────────────────────────┤
   │ renderTitle()                        │
   │   → "my-project"                     │
   ├──────────────────────────────────────┤
   │ renderStatusText()                   │
   │   → "Executing Bash..."              │
   ├──────────────────────────────────────┤
   │ renderLoadingDots()                  │
   │   → Show animated dots               │
   ├──────────────────────────────────────┤
   │ renderInfoLines()                    │
   │   → Tool: Bash (visible)             │
   │   → Project: my-project              │
   │   → Memory: 75%                      │
   ├──────────────────────────────────────┤
   │ renderMemoryBar()                    │
   │   → Yellow bar at 75%                │
   ├──────────────────────────────────────┤
   │ renderCharacter()                    │
   │   → Clawd with sunglasses            │
   │   → Matrix rain effect               │
   │   → Focused eyes                     │
   └──────────────────────────────────────┘
                │
                ▼
4. Result: Complete UI update! 🎨
```

## Character + Effect Combinations

```
State: idle
├─ Eyes: normal (blinking)
└─ Effect: none

State: start
├─ Eyes: normal
└─ Effect: sparkle ✨

State: thinking
├─ Eyes: normal
└─ Effect: thinking 💭

State: planning
├─ Eyes: normal
└─ Effect: thinking 💭

State: working
├─ Eyes: focused 😎
└─ Effect: matrix 🟩 (with sunglasses)

State: packing
├─ Eyes: normal
└─ Effect: thinking 💭

State: sleep
├─ Eyes: blink (closed)
└─ Effect: zzz 💤

State: notification
├─ Eyes: normal
└─ Effect: alert ⚠️

State: done
├─ Eyes: happy 😊
└─ Effect: none
```

## Memory Bar States

```
 0-74%  → Green gradient    🟢
75-89%  → Yellow gradient   🟡
90-100% → Red gradient      🔴

Example at 75%:
┌─────────────────────────────────┐
│████████████████████▓▓▓▓▓▓▓▓▓▓▓▓ │
└─────────────────────────────────┘
 ◄──── Yellow gradient ────►
```

## Complete Integration Example

```javascript
// 1. Setup
const canvas = document.getElementById('character-canvas');
const dom = {
  display: document.getElementById('display'),
  titleText: document.getElementById('title-text'),
  // ... other elements
};

// 2. Create engine
const engine = createVibeMonEngine(canvas, dom, {
  useEmoji: platform === 'darwin'
});

// 3. Initialize (loads images)
await engine.init();

// 4. Set initial state
engine.setState({
  state: 'idle',
  character: 'clawd',
  project: '-',
  model: '-',
  memory: 0
});

// 5. Render
engine.render();

// 6. Start animation
engine.startAnimation();

// 7. Handle updates
ipcRenderer.on('state-update', (data) => {
  engine.setState(data);    // Update state
  engine.render();          // Re-render
});

// 8. Cleanup on exit
window.onunload = () => {
  engine.cleanup();
};
```

## Benefits Visualization

```
Before Refactoring:
┌────────────────────────────────────┐
│         renderer.js                │
│  ┌──────────────────────────────┐  │
│  │ 🔴 Tightly Coupled           │  │
│  │ 🔴 Hard to Test              │  │
│  │ 🔴 Complex Dependencies      │  │
│  │ 🔴 Mixed Concerns            │  │
│  │ 🔴 Global State Everywhere   │  │
│  └──────────────────────────────┘  │
│           299 lines                │
└────────────────────────────────────┘

After Refactoring:
┌──────────────────────┐  ┌───────────────────────────┐
│   renderer.js        │  │  vibemon-engine.js       │
│  ┌────────────────┐  │  │  ┌─────────────────────┐  │
│  │ ✅ Clean       │  │  │  │ ✅ Encapsulated     │  │
│  │ ✅ Simple      │  │  │  │ ✅ Testable         │  │
│  │ ✅ Focused     │  │  │  │ ✅ Reusable         │  │
│  └────────────────┘  │  │  │ ✅ Well-Documented  │  │
│      105 lines       │  │  └─────────────────────┘  │
└──────────────────────┘  │       382 lines           │
                          └───────────────────────────┘
```

## Performance

```
Rendering:
- Only redraws when needed (needsAnimationRedraw)
- Throttled animation loop (~100ms intervals)
- Efficient DOM updates (cached elements)
- Smart animation based on state

Animation States:
- idle:     Blink every ~3 seconds
- thinking: Slow dots + thought bubble
- planning: Slow dots + thought bubble
- working:  Fast dots + matrix + sunglasses
- packing:  Slow dots + thought bubble
- sleep:    ZZZ effect only
- start:    Sparkle effect
```

## Summary

The VibeMon Engine provides:

1. **Simple API**: `setState()` → `render()` → Done
2. **Complete Abstraction**: All rendering in one place
3. **Reusable**: Use anywhere with any DOM
4. **Maintainable**: Clear structure and documentation
5. **Performant**: Smart rendering and animation
6. **Extensible**: Easy to add new states or effects

```
┌─────────────────────────────────────┐
│  Declare → Initialize → Render      │
│  ─────────────────────────────      │
│  One module, complete control 🎨    │
└─────────────────────────────────────┘
```
