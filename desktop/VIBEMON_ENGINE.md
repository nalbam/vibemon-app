# VibeMon Engine Documentation

## Overview

The VibeMon Engine is a complete abstraction of all rendering logic for the Vibe Monitor desktop application. It separates all character, animation, and status rendering into a single, reusable module.

## Purpose

Previously, all rendering logic was embedded in `renderer.js`. This made it difficult to:
- Reuse rendering logic in different contexts
- Test rendering functionality
- Understand the separation between state management and display
- Modify rendering behavior without touching the main renderer

The new `VibeMonEngine` class completely encapsulates:
- **Character rendering** (canvas, images, animations)
- **Animation system** (floating effects, blinking, loading dots)
- **State display** (background colors, state text)
- **Info display** (project, tool, model, memory)
- **Memory bar** (with gradients)
- **Icon rendering**

## Architecture

### Before
```
renderer.js (299 lines)
├── Import 8 different modules
├── 30+ global variables
├── DOM manipulation mixed with state logic
├── Animation loop with embedded rendering
└── Tightly coupled update functions
```

### After
```
renderer.js (106 lines)
├── Import VibeMonEngine
├── Create engine instance
├── Pass state updates to engine
└── Engine handles ALL rendering

shared/vibemon-engine.js (380 lines)
├── VibeMonEngine class
├── Complete rendering abstraction
├── State management
├── Animation control
└── All render methods
```

## Usage

### Basic Setup

```javascript
import { createVibeMonEngine } from './shared/vibemon-engine.js';

// 1. Get DOM elements
const canvas = document.getElementById('character-canvas');
const domElements = {
  display: document.getElementById('display'),
  titleText: document.getElementById('title-text'),
  statusText: document.getElementById('status-text'),
  // ... all other elements
};

// 2. Create engine
const engine = createVibeMonEngine(canvas, domElements, {
  useEmoji: true // Platform-specific option
});

// 3. Initialize (async - loads images)
await engine.init();

// 4. Render and animate
engine.render();
engine.startAnimation();
```

### Updating State

```javascript
// Simple state update
engine.setState({
  state: 'working',
  tool: 'Bash',
  project: 'my-project',
  memory: 75
});

// Render the changes
engine.render();
```

### Animation Control

```javascript
// Start animation loop
engine.startAnimation();

// Stop animation loop
engine.stopAnimation();

// Cleanup (before unload)
engine.cleanup();
```

## API Reference

### Constructor

```javascript
new VibeMonEngine(canvas, domElements, options)
```

**Parameters:**
- `canvas` - HTML canvas element for character rendering
- `domElements` - Object containing all required DOM elements
- `options` - Optional configuration
  - `useEmoji` - Use emoji icons (default: false)

### Methods

#### `async init()`
Initialize the renderer. Loads character images asynchronously.

Returns: `Promise<this>`

#### `setState(data)`
Update the current state.

**Parameters:**
- `data.state` - State name ('start', 'idle', 'thinking', 'working', etc.)
- `data.character` - Character name ('clawd', 'kiro', 'claw')
- `data.project` - Project name
- `data.tool` - Tool name
- `data.model` - Model name
- `data.memory` - Memory percentage (0-100)

#### `render()`
Render all components. Calls all individual render methods.

#### Individual Render Methods

- `renderBackground()` - Update background color
- `renderTitle()` - Update window title
- `renderStatusText()` - Update status text
- `renderLoadingDots()` - Update loading dots visibility
- `renderInfoLines()` - Update project/tool/model/memory info
- `renderMemoryBar()` - Update memory bar
- `renderIcons()` - Update info icons
- `renderCharacter()` - Update character on canvas

#### Animation Methods

- `startAnimation()` - Start the animation loop
- `stopAnimation()` - Stop the animation loop
- `updateFloatingPosition()` - Update floating effect
- `updateLoadingDots(slow)` - Update loading dots animation

#### `getStateObject()`
Get current state as an object.

Returns: `{ state, character, project, tool, model, memory }`

#### `cleanup()`
Stop animation and cleanup resources.

## Benefits

### 1. **Complete Separation**
All rendering logic is isolated in one module. No rendering code leaks into the main renderer.

### 2. **Simple API**
Just three steps: `setState()`, `render()`, done. The engine handles all complexity.

### 3. **Reusable**
The engine can be used in:
- Main renderer window
- Stats dashboard
- Any future UI components
- Testing/simulation environments

### 4. **Maintainable**
- Single responsibility: rendering
- All rendering code in one place
- Easy to modify visual behavior
- Clear method names and documentation

### 5. **Testable**
- Can mock DOM elements
- Can test individual render methods
- Can verify state transitions
- Animation can be controlled programmatically

## Migration Guide

### Old Code
```javascript
// Global variables
let currentState = 'start';
let currentProject = '-';
// ... many more

// Update function
function updateDisplay() {
  const state = states[currentState];
  domCache.display.style.background = state.bgColor;
  domCache.statusText.textContent = state.text;
  // ... 50+ more lines
}

// Animation loop
function animationLoop(timestamp) {
  // Complex logic mixed with rendering
  animFrame++;
  updateFloatingPosition();
  // ... more animation logic
  drawCharacter(...);
  requestAnimationFrame(animationLoop);
}
```

### New Code
```javascript
// Create engine
const engine = createVibeMonEngine(canvas, domElements, options);
await engine.init();

// Update state
engine.setState({ state: 'working', project: 'test' });
engine.render();

// Animation
engine.startAnimation();
```

## File Structure

```
desktop/
├── renderer.js                    # Main renderer (simplified)
├── shared/
│   ├── vibemon-engine.js         # NEW: Complete rendering engine
│   ├── character.js               # Character rendering (used by engine)
│   ├── animation.js               # Animation utilities (used by engine)
│   ├── effects.js                 # Visual effects (used by engine)
│   ├── icons.js                   # Icon rendering (used by engine)
│   ├── utils.js                   # Text utilities (used by engine)
│   └── config.js                  # Configuration (used by engine)
└── VIBEMON_ENGINE_EXAMPLES.js    # Usage examples
```

## Examples

See `VIBEMON_ENGINE_EXAMPLES.js` for complete working examples including:
1. Basic usage
2. State updates
3. Character changes
4. State transitions
5. Individual component rendering
6. Animation control
7. Getting current state
8. Complete integration

## Testing

The renderer engine can be tested by:
1. Mocking the canvas and DOM elements
2. Verifying state updates
3. Checking render method calls
4. Testing animation lifecycle

Example:
```javascript
const mockCanvas = { getContext: () => mockCtx, style: {} };
const mockDom = { /* mock elements */ };
const engine = new VibeMonEngine(mockCanvas, mockDom);

engine.setState({ state: 'working' });
expect(engine.currentState).toBe('working');

engine.render();
// Verify DOM was updated
```

## Future Enhancements

Potential improvements:
1. **Headless mode** - Render without canvas for testing
2. **Event system** - Emit events on state changes
3. **Render queue** - Batch multiple updates
4. **Performance monitoring** - Track render times
5. **Custom themes** - Pluggable color schemes
6. **Effect plugins** - Custom visual effects

## Conclusion

The VibeMon Engine provides a clean, simple, and powerful abstraction for all rendering in Vibe Monitor. It makes the codebase more maintainable, testable, and extensible while keeping the API simple and intuitive.
