/**
 * VibeMon Engine - Complete rendering abstraction for Vibe Monitor
 *
 * This module encapsulates ALL rendering logic:
 * - Character rendering (canvas, images, animations)
 * - State display (background color, state text, loading dots)
 * - Info display (project, tool, model, memory)
 * - Memory bar rendering
 * - Icon rendering
 *
 * Usage:
 *   const engine = new VibeMonEngine(canvasElement, domElements);
 *   await engine.init();
 *   engine.render(state);
 *   engine.startAnimation();
 */

import {
  states, CHARACTER_CONFIG, DEFAULT_CHARACTER,
  CHAR_X_BASE, CHAR_Y_BASE,
  FRAME_INTERVAL, LOADING_DOT_COUNT, THINKING_ANIMATION_SLOWDOWN,
  BLINK_START_FRAME, BLINK_END_FRAME,
  PROJECT_NAME_MAX_LENGTH, PROJECT_NAME_TRUNCATE_AT,
  MODEL_NAME_MAX_LENGTH, MODEL_NAME_TRUNCATE_AT
} from './config.js';
import { getThinkingText, getPlanningText, getWorkingText, updateMemoryBar } from './utils.js';
import { initRenderer, drawCharacter } from './character.js';
import { drawInfoIcons } from './icons.js';
import { getFloatOffsetX, getFloatOffsetY, needsAnimationRedraw } from './animation.js';

/**
 * VibeMonEngine class - Complete rendering system
 */
export class VibeMonEngine {
  constructor(canvas, domElements, options = {}) {
    // Canvas and context
    this.canvas = canvas;
    this.ctx = canvas?.getContext('2d');

    // DOM elements (required)
    this.dom = domElements;

    // Options
    this.useEmoji = options.useEmoji || false;

    // Current state
    this.currentState = 'start';
    this.currentCharacter = 'clawd';
    this.currentProject = '-';
    this.currentTool = '-';
    this.currentModel = '-';
    this.currentMemory = 0;

    // Animation state
    this.animFrame = 0;
    this.blinkFrame = 0;
    this.lastFrameTime = 0;
    this.animationRunning = false;
    this.animationFrameId = null;
  }

  /**
   * Initialize the renderer (async - loads character images)
   */
  async init() {
    if (this.ctx) {
      await initRenderer(this.ctx);
    }
    return this;
  }

  /**
   * Update state data
   */
  setState(data) {
    if (!data || typeof data !== 'object') return;

    const prevState = this.currentState;
    if (data.state !== undefined) this.currentState = data.state;
    if (data.character !== undefined) {
      this.currentCharacter = CHARACTER_CONFIG[data.character] ? data.character : DEFAULT_CHARACTER;
    }
    if (data.project !== undefined) this.currentProject = data.project || '-';
    if (data.tool !== undefined) this.currentTool = data.tool || '-';
    if (data.model !== undefined) this.currentModel = data.model || '-';
    if (data.memory !== undefined) this.currentMemory = data.memory || 0;

    // Reset blinkFrame when transitioning to idle state
    if (this.currentState === 'idle' && prevState !== 'idle') {
      this.blinkFrame = 0;
    }
  }

  /**
   * Get current state object
   */
  getStateObject() {
    return {
      state: this.currentState,
      character: this.currentCharacter,
      project: this.currentProject,
      tool: this.currentTool,
      model: this.currentModel,
      memory: this.currentMemory
    };
  }

  /**
   * Render everything (main render function)
   */
  render() {
    this.renderBackground();
    this.renderTitle();
    this.renderStatusText();
    this.renderLoadingDots();
    this.renderInfoLines();
    this.renderMemoryBar();
    this.renderIcons();
    this.renderCharacter();
  }

  /**
   * Render background color
   */
  renderBackground() {
    const state = states[this.currentState] || states.idle;
    if (this.dom.display) {
      this.dom.display.style.background = state.bgColor;
    }
  }

  /**
   * Render title (project name or default)
   */
  renderTitle() {
    if (!this.dom.titleText) return;

    const titleProject = this.currentProject && this.currentProject !== '-' ? this.currentProject : 'VibeMon';
    const displayTitle = titleProject.length > PROJECT_NAME_MAX_LENGTH
      ? titleProject.substring(0, PROJECT_NAME_TRUNCATE_AT) + '...'
      : titleProject;
    this.dom.titleText.textContent = displayTitle;
  }

  /**
   * Render status text
   */
  renderStatusText() {
    if (!this.dom.statusText) return;

    const state = states[this.currentState] || states.idle;

    if (this.currentState === 'thinking') {
      this.dom.statusText.textContent = getThinkingText();
    } else if (this.currentState === 'planning') {
      this.dom.statusText.textContent = getPlanningText();
    } else if (this.currentState === 'working') {
      this.dom.statusText.textContent = getWorkingText(this.currentTool);
    } else {
      this.dom.statusText.textContent = state.text;
    }
    this.dom.statusText.style.color = state.textColor;
  }

  /**
   * Render loading dots
   */
  renderLoadingDots() {
    if (!this.dom.loadingDots) return;

    const state = states[this.currentState] || states.idle;
    this.dom.loadingDots.style.display = state.showLoading ? 'flex' : 'none';
  }

  /**
   * Update loading dots animation
   */
  updateLoadingDots(slow = false) {
    if (!this.dom.dots) return;

    const frame = slow ? Math.floor(this.animFrame / THINKING_ANIMATION_SLOWDOWN) : this.animFrame;
    const activeIndex = frame % LOADING_DOT_COUNT;
    this.dom.dots.forEach((dot, i) => {
      dot.classList.toggle('dim', i !== activeIndex);
    });
  }

  /**
   * Render info lines (project, tool, model, memory)
   */
  renderInfoLines() {
    const state = states[this.currentState] || states.idle;

    // Tool line visibility
    if (this.dom.toolLine) {
      this.dom.toolLine.style.display = this.currentState === 'working' ? 'block' : 'none';
    }

    // Update values
    const displayProject = this.currentProject.length > PROJECT_NAME_MAX_LENGTH
      ? this.currentProject.substring(0, PROJECT_NAME_TRUNCATE_AT) + '...'
      : this.currentProject;
    if (this.dom.projectValue) this.dom.projectValue.textContent = displayProject;
    if (this.dom.toolValue) this.dom.toolValue.textContent = this.currentTool;

    const displayModel = this.currentModel.length > MODEL_NAME_MAX_LENGTH
      ? this.currentModel.substring(0, MODEL_NAME_TRUNCATE_AT) + '...'
      : this.currentModel;
    if (this.dom.modelValue) this.dom.modelValue.textContent = displayModel;
    if (this.dom.memoryValue) {
      this.dom.memoryValue.textContent = this.currentMemory > 0 ? this.currentMemory + '%' : '-';
    }

    // Visibility based on state
    const showProject = this.currentProject && this.currentProject !== '-';
    if (this.dom.projectLine) {
      this.dom.projectLine.style.display = showProject ? 'block' : 'none';
    }
    if (this.dom.modelLine) {
      this.dom.modelLine.style.display = this.currentModel && this.currentModel !== '-' ? 'block' : 'none';
    }
    const showMemory = this.currentState !== 'start' && this.currentMemory > 0;
    if (this.dom.memoryLine) {
      this.dom.memoryLine.style.display = showMemory ? 'block' : 'none';
    }

    // Update text colors
    if (this.dom.infoTexts) {
      this.dom.infoTexts.forEach(el => el.style.color = state.textColor);
    }
    if (this.dom.infoLabels) {
      this.dom.infoLabels.forEach(el => el.style.color = state.textColor);
    }
    if (this.dom.infoValues) {
      this.dom.infoValues.forEach(el => el.style.color = state.textColor);
    }
  }

  /**
   * Render memory bar
   */
  renderMemoryBar() {
    const state = states[this.currentState] || states.idle;
    const showMemory = this.currentState !== 'start' && this.currentMemory > 0;

    updateMemoryBar(showMemory ? this.currentMemory : null, state.bgColor, {
      memoryBar: this.dom.memoryBar,
      memoryBarContainer: this.dom.memoryBarContainer
    });
  }

  /**
   * Render icons
   */
  renderIcons() {
    const state = states[this.currentState] || states.idle;
    drawInfoIcons(state.textColor, state.bgColor, this.useEmoji);
  }

  /**
   * Render character on canvas
   */
  renderCharacter() {
    if (!this.ctx) return;

    const state = states[this.currentState] || states.idle;
    drawCharacter(state.eyeType, state.effect, this.currentState, this.currentCharacter, this.animFrame);
  }

  /**
   * Update floating position
   */
  updateFloatingPosition() {
    if (!this.canvas) return;

    const offsetX = getFloatOffsetX(this.animFrame);
    const offsetY = getFloatOffsetY(this.animFrame);
    this.canvas.style.left = (CHAR_X_BASE + offsetX) + 'px';
    this.canvas.style.top = (CHAR_Y_BASE + offsetY) + 'px';
  }

  /**
   * Animation loop
   */
  _animationLoop(timestamp) {
    if (!this.animationRunning) return;

    // Throttle to ~100ms intervals
    if (timestamp - this.lastFrameTime < FRAME_INTERVAL) {
      this.animationFrameId = requestAnimationFrame(this._animationLoop.bind(this));
      return;
    }
    this.lastFrameTime = timestamp;
    this.animFrame++;

    this.updateFloatingPosition();

    // Increment blinkFrame for idle state
    if (this.currentState === 'idle') {
      this.blinkFrame++;
      if (this.blinkFrame > BLINK_END_FRAME) {
        this.blinkFrame = 0;
      }
    }

    // Only redraw when necessary
    if (needsAnimationRedraw(this.currentState, this.animFrame, this.blinkFrame)) {
      if (this.currentState === 'start') {
        drawCharacter('normal', 'sparkle', this.currentState, this.currentCharacter, this.animFrame);
      }

      if (this.currentState === 'thinking') {
        this.updateLoadingDots(true);
        drawCharacter('normal', 'thinking', this.currentState, this.currentCharacter, this.animFrame);
      }

      if (this.currentState === 'planning') {
        this.updateLoadingDots(true);
        drawCharacter('normal', 'thinking', this.currentState, this.currentCharacter, this.animFrame);
      }

      if (this.currentState === 'working') {
        this.updateLoadingDots(false);
        drawCharacter('focused', 'matrix', this.currentState, this.currentCharacter, this.animFrame);
      }

      if (this.currentState === 'packing') {
        this.updateLoadingDots(true);
        drawCharacter('normal', 'thinking', this.currentState, this.currentCharacter, this.animFrame);
      }

      if (this.currentState === 'idle') {
        if (this.blinkFrame === BLINK_START_FRAME) {
          drawCharacter('blink', 'none', this.currentState, this.currentCharacter, this.animFrame);
        } else if (this.blinkFrame === BLINK_END_FRAME) {
          drawCharacter('normal', 'none', this.currentState, this.currentCharacter, this.animFrame);
        }
      }

      if (this.currentState === 'sleep') {
        drawCharacter('blink', 'zzz', this.currentState, this.currentCharacter, this.animFrame);
      }
    }

    this.animationFrameId = requestAnimationFrame(this._animationLoop.bind(this));
  }

  /**
   * Start animation loop
   */
  startAnimation() {
    if (this.animationRunning) return;
    this.animationRunning = true;
    this.animationFrameId = requestAnimationFrame(this._animationLoop.bind(this));
  }

  /**
   * Stop animation loop
   */
  stopAnimation() {
    this.animationRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.stopAnimation();
  }
}

/**
 * Factory function for creating a VibeMon engine
 */
export function createVibeMonEngine(canvas, domElements, options = {}) {
  return new VibeMonEngine(canvas, domElements, options);
}
