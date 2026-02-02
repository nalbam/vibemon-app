# VibeMon Engine - Complete Guide

## Overview

**VibeMon Engine** is a standalone, self-contained rendering engine for the Vibe Monitor desktop and simulator applications. Everything you need is in one file: `vibemon-engine-standalone.js`.

## Features

✅ **Complete character rendering** (clawd, kiro, claw)  
✅ **All animations** (matrix rain, sparkles, thinking bubbles, zzz, blinking)  
✅ **Pixel art icons** (project, tool, model, memory)  
✅ **Memory bar** with color-coded gradients (green/yellow/red)  
✅ **9 states** with unique colors and effects  
✅ **Single file** - no external dependencies except character images  
✅ **~30KB** uncompressed, 908 lines  

## Quick Start

### 1. Basic Usage

```javascript
import { createVibeMonEngine } from './shared/vibemon-engine-standalone.js';

// Get canvas and DOM elements
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
  // ... other elements (see HTML structure below)
};

// Create and initialize engine
const engine = createVibeMonEngine(canvas, domElements, {
  useEmoji: true  // or false for pixel art icons
});
await engine.init();

// Set state and render
engine.setState({
  state: 'working',
  character: 'clawd',
  project: 'my-project',
  tool: 'Bash',
  model: 'claude-3',
  memory: 75
});
engine.render();
engine.startAnimation();
```

### 2. Update State

```javascript
// Change state
engine.setState({ state: 'thinking' });
engine.render();

// Update multiple properties
engine.setState({
  state: 'working',
  tool: 'Python',
  memory: 85
});
engine.render();
```

### 3. Cleanup

```javascript
engine.cleanup();  // Stop animation and free resources
```

## Required HTML Structure

```html
<!-- Canvas for character -->
<canvas id="character-canvas" width="128" height="128"></canvas>

<!-- Display container -->
<div id="display">
  <!-- Status text -->
  <div id="status-text"></div>
  
  <!-- Loading dots -->
  <div id="loading-dots">
    <div class="dot"></div>
    <div class="dot"></div>
    <div class="dot"></div>
    <div class="dot"></div>
  </div>
  
  <!-- Info lines -->
  <div id="project-line">
    <span class="emoji-icon">📂 </span>
    <canvas class="pixel-icon" id="icon-project" width="8" height="8"></canvas>
    <span id="project-value"></span>
  </div>
  
  <div id="tool-line">
    <span class="emoji-icon">🛠️ </span>
    <canvas class="pixel-icon" id="icon-tool" width="8" height="8"></canvas>
    <span id="tool-value"></span>
  </div>
  
  <div id="model-line">
    <span class="emoji-icon">🤖 </span>
    <canvas class="pixel-icon" id="icon-model" width="8" height="8"></canvas>
    <span id="model-value"></span>
  </div>
  
  <div id="memory-line">
    <span class="emoji-icon">🧠 </span>
    <canvas class="pixel-icon" id="icon-memory" width="8" height="8"></canvas>
    <span id="memory-value"></span>
  </div>
  
  <!-- Memory bar -->
  <div id="memory-bar-container">
    <div id="memory-bar"></div>
  </div>
</div>
```

## Character Images

The engine loads character images automatically from the VibeMon static server:
- `https://static.vibemon.io/characters/clawd.png` (Orange cat)
- `https://static.vibemon.io/characters/kiro.png` (White ghost)
- `https://static.vibemon.io/characters/claw.png` (Red cat)

These images are loaded by default, so the engine works out of the box with no local files needed.

To use custom paths or local images:
```javascript
const engine = createVibeMonEngine(canvas, domElements, {
  characterImageUrls: {
    clawd: './path/to/clawd.png',
    kiro: './path/to/kiro.png',
    claw: './path/to/claw.png'
  }
});
```

## States

| State | Color | Description | Effect |
|-------|-------|-------------|--------|
| `start` | Cyan | Session begins | Sparkle ✨ |
| `idle` | Green | Ready, waiting | Blinking |
| `thinking` | Purple | Processing | Thought bubble 💭 |
| `planning` | Teal | Planning | Thought bubble 💭 |
| `working` | Blue | Executing tool | Matrix rain 🟩 + sunglasses |
| `packing` | Gray | Compacting | Thought bubble 💭 |
| `notification` | Yellow | User input needed | Alert ⚠️ |
| `done` | Green | Task complete | Happy eyes 😊 |
| `sleep` | Dark blue | Inactive 5min+ | ZZZ 💤 |

## Characters

| Character | Color | Description |
|-----------|-------|-------------|
| `clawd` | Orange | Cat (default) |
| `kiro` | White | Ghost |
| `claw` | Red | Cat |

## API Reference

### createVibeMonEngine(canvas, domElements, options)

Creates a new VibeMon Engine instance.

**Parameters:**
- `canvas` - HTML canvas element (128x128)
- `domElements` - Object with DOM element references (see structure above)
- `options` - Optional configuration:
  - `useEmoji` - Boolean, use emoji icons (default: false)
  - `characterImageUrls` - Object mapping character names to image URLs

**Returns:** `VibeMonEngine` instance

### engine.init()

Initialize the engine and load character images.

**Returns:** `Promise` that resolves when images are loaded

### engine.setState(data)

Update engine state.

**Parameters:**
- `data.state` - State name: 'start' | 'idle' | 'thinking' | 'planning' | 'working' | 'packing' | 'notification' | 'done' | 'sleep'
- `data.character` - Character name: 'clawd' | 'kiro' | 'claw'
- `data.project` - Project name (string)
- `data.tool` - Tool name (string)
- `data.model` - Model name (string)
- `data.memory` - Memory percentage (number 0-100)

### engine.render()

Render all UI elements based on current state.

### engine.startAnimation()

Start the animation loop (floating, blinking, effects).

### engine.stopAnimation()

Stop the animation loop.

### engine.cleanup()

Stop animation and cleanup resources.

### engine.getStateObject()

Get current state as an object.

**Returns:** `{ state, character, project, tool, model, memory }`

## Exported Constants

The standalone file also exports these for external use:

```javascript
import { 
  states,              // All state configurations
  CHARACTER_CONFIG,    // Character configurations
  CHARACTER_NAMES,     // Array of character names
  DEFAULT_CHARACTER,   // Default character name
  CONSTANTS            // All constants (sizes, colors, timings)
} from './vibemon-engine-standalone.js';
```

## Animation System

The engine includes several animation effects:

### Matrix Rain (working state)
- Green "falling" characters
- Flicker effect on lead character
- Variable speed streams
- Rendered behind character

### Sparkle (start state)
- Twinkling stars
- 4-frame animation
- Orange/character color

### Thinking Bubble (thinking/planning/packing states)
- White thought cloud
- Smaller bubbles leading to main bubble

### ZZZ Effect (sleep state)
- Rising "Z" letters
- 3 levels of Z's
- Animated upward movement

### Blinking (idle state)
- Periodic eye blinks every ~3 seconds
- Smooth open/close animation

### Happy Eyes (done state)
- > < eye shape
- Indicates successful completion

### Sunglasses (working state)
- Matrix-style dark green lenses
- Black frame with shine effect
- Worn when "focused"

## Memory Bar Colors

The memory bar changes color based on usage:

- **0-74%**: Green gradient 🟢
- **75-89%**: Yellow gradient 🟡  
- **90-100%**: Red gradient 🔴

## Use in Other Projects

This file is completely standalone! To use VibeMon Engine in another project:

1. Copy `vibemon-engine-standalone.js`
2. Create the required HTML structure
3. Import and initialize:

```javascript
import { createVibeMonEngine } from './vibemon-engine-standalone.js';
const engine = createVibeMonEngine(canvas, domElements, { useEmoji: true });
await engine.init();
engine.setState({ state: 'working', tool: 'Coding' });
engine.render();
engine.startAnimation();
```

That's it! The engine loads character images from `https://static.vibemon.io/characters/` by default, so no local files needed. If you want to use custom images, pass `characterImageUrls` in options.

## File Size

- **Uncompressed**: ~30 KB
- **Lines**: 908
- **Gzipped**: ~8 KB (estimated)

## Browser Compatibility

Works in all modern browsers supporting:
- ES6 modules (`import`/`export`)
- Canvas API
- `requestAnimationFrame`
- `Promise`/`async`-`await`

## Performance

- Throttled animation loop (~100ms intervals)
- Smart redraw (only when needed)
- Cached DOM elements
- Efficient canvas rendering

## Examples

### Desktop App Integration
```javascript
// Desktop app (Electron renderer)
const engine = createVibeMonEngine(canvas, domElements, {
  useEmoji: platform === 'darwin'  // macOS uses emoji
});

await engine.init();
engine.render();
engine.startAnimation();

// Listen for IPC updates
ipcRenderer.on('state-update', (data) => {
  engine.setState(data);
  engine.render();
});
```

### Simulator Integration
```javascript
// Simulator (web-based testing)
const engine = createVibeMonEngine(canvas, domElements, {
  useEmoji: iconType === 'emoji'
});

await engine.init();

// Button handlers
button.onclick = () => {
  engine.setState({ state: 'working' });
  engine.render();
};
```

### Custom Integration
```javascript
// Your own project
const engine = createVibeMonEngine(canvas, domElements, {
  useEmoji: false,
  characterImageUrls: {
    clawd: 'https://example.com/clawd.png',
    kiro: 'https://example.com/kiro.png',
    claw: 'https://example.com/claw.png'
  }
});

await engine.init();

// Update on events
socket.on('status', (data) => {
  engine.setState(data);
  engine.render();
});
```

## Troubleshooting

**Images not loading?**
- Default images load from `https://static.vibemon.io/characters/`
- Check network connectivity if images fail to load
- For custom images, verify the `characterImageUrls` paths
- Ensure custom images are accessible (CORS, network, etc.)
- Check browser console for errors

**Animation not working?**
- Call `engine.startAnimation()` after init
- Check that canvas element exists
- Verify `requestAnimationFrame` is supported

**DOM elements not updating?**
- Verify all required elements exist in HTML
- Check element IDs match exactly
- Call `engine.render()` after `setState()`

**Icons not showing?**
- Check `useEmoji` option
- Verify `.emoji-icon` and `.pixel-icon` elements exist
- Ensure canvas elements for icons are 8x8

## License

Same as the main Vibe Monitor project.

## Credits

Part of the Vibe Monitor project - a real-time status monitor for AI assistants.
