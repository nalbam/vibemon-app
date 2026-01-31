/**
 * VibeMon Bridge Plugin for OpenClaw
 *
 * Sends real-time agent status to VibeMon (ESP32/Desktop) via hooks.
 * This is more reliable than log-based monitoring.
 *
 * Hooks used:
 * - before_agent_start -> thinking
 * - before_tool_call -> working (with tool name)
 * - after_tool_call -> thinking
 * - message_sent -> done (with delay to prevent premature transition)
 * - gateway_start -> start
 *
 * Output:
 * - Serial: /dev/ttyACM* (Linux) or /dev/cu.usbmodem* (macOS)
 * - HTTP: POST to VibeMon Desktop (http://127.0.0.1:19280/status)
 */

import fs from "node:fs";
import { execSync } from "node:child_process";

// State management
let currentState = "idle";
let doneTimer = null;
let ttyPath = null;
let lastSendTime = 0;

// Configuration (set in register)
let config = {
  projectName: "OpenClaw",
  character: "claw",
  serialEnabled: true,
  httpEnabled: false,
  httpUrl: "http://127.0.0.1:19280/status",
  debug: false,
};

let logger = null;

// Delay before sending done (prevents premature done on multi-turn)
const DONE_DELAY_MS = 3000;

// Minimum interval between sends (debounce)
const MIN_SEND_INTERVAL_MS = 100;

/**
 * Debug logging helper
 */
function debug(message) {
  if (config.debug && logger) {
    logger.info?.(`[vibemon] ${message}`);
  }
}

/**
 * Find available TTY device for ESP32
 */
function findTtyDevice() {
  const platform = process.platform;

  // macOS: /dev/cu.usbmodem*
  if (platform === "darwin") {
    try {
      const devices = fs.readdirSync("/dev").filter((f) => f.startsWith("cu.usbmodem"));
      if (devices.length > 0) {
        const device = `/dev/${devices[0]}`;
        if (fs.existsSync(device)) {
          try {
            fs.accessSync(device, fs.constants.W_OK);
            return device;
          } catch {
            debug(`Found ${device} but not writable`);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // Linux: /dev/ttyACM*
  if (platform === "linux") {
    try {
      const devices = fs.readdirSync("/dev").filter((f) => f.startsWith("ttyACM"));
      if (devices.length > 0) {
        const device = `/dev/${devices[0]}`;
        if (fs.existsSync(device)) {
          try {
            fs.accessSync(device, fs.constants.W_OK);
            return device;
          } catch {
            debug(`Found ${device} but not writable (check dialout group)`);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Send status to ESP32 via serial
 */
function sendSerial(payload) {
  if (!config.serialEnabled) return;

  // Find TTY device if not found yet
  if (!ttyPath) {
    ttyPath = findTtyDevice();
    if (ttyPath) {
      debug(`Using TTY: ${ttyPath}`);
    }
  }

  if (!ttyPath) return;

  try {
    const json = JSON.stringify(payload) + "\n";
    fs.writeFileSync(ttyPath, json, { flag: "a" });
    debug(`Serial sent: ${json.trim()}`);
  } catch (err) {
    debug(`Serial write failed: ${err.message}`);
    // Reset TTY path to retry finding device
    ttyPath = null;
  }
}

/**
 * Send status to VibeMon Desktop via HTTP
 */
async function sendHttp(payload) {
  if (!config.httpEnabled) return;

  try {
    const response = await fetch(config.httpUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      debug(`HTTP failed: ${response.status}`);
    } else {
      debug(`HTTP sent: ${JSON.stringify(payload)}`);
    }
  } catch (err) {
    debug(`HTTP error: ${err.message}`);
  }
}

/**
 * Build status payload
 */
function buildPayload(state, extra = {}) {
  return {
    state,
    project: config.projectName,
    character: config.character,
    ts: new Date().toISOString(),
    ...extra,
  };
}

/**
 * Send status (debounced)
 */
function sendStatus(state, extra = {}) {
  const now = Date.now();
  if (now - lastSendTime < MIN_SEND_INTERVAL_MS && state === currentState) {
    return;
  }
  lastSendTime = now;
  currentState = state;

  const payload = buildPayload(state, extra);

  // Send to both serial and HTTP
  sendSerial(payload);
  sendHttp(payload);
}

/**
 * Cancel pending done timer
 */
function cancelDoneTimer() {
  if (doneTimer) {
    clearTimeout(doneTimer);
    doneTimer = null;
    debug("Done timer cancelled");
  }
}

/**
 * Schedule done state with delay
 */
function scheduleDone() {
  cancelDoneTimer();
  debug(`Scheduling done in ${DONE_DELAY_MS}ms`);

  doneTimer = setTimeout(() => {
    doneTimer = null;
    debug("Done timer fired -> done");
    sendStatus("done");
  }, DONE_DELAY_MS);
}

/**
 * Plugin definition
 */
const plugin = {
  id: "vibemon-bridge",
  name: "VibeMon Bridge",
  description: "Real-time status bridge for VibeMon (ESP32/Desktop)",
  version: "1.0.0",

  register(api) {
    logger = api.logger;

    // Merge plugin config
    const pluginConfig = api.pluginConfig || {};
    config = {
      ...config,
      projectName: pluginConfig.projectName ?? config.projectName,
      character: pluginConfig.character ?? config.character,
      serialEnabled: pluginConfig.serialEnabled ?? config.serialEnabled,
      httpEnabled: pluginConfig.httpEnabled ?? config.httpEnabled,
      httpUrl: pluginConfig.httpUrl ?? config.httpUrl,
      debug: pluginConfig.debug ?? config.debug,
    };

    api.logger.info(`[vibemon] Plugin loaded`);
    api.logger.info(`[vibemon] Project: ${config.projectName}, Character: ${config.character}`);
    api.logger.info(`[vibemon] Serial: ${config.serialEnabled}, HTTP: ${config.httpEnabled}`);

    // Find TTY device at startup
    if (config.serialEnabled) {
      ttyPath = findTtyDevice();
      if (ttyPath) {
        api.logger.info(`[vibemon] TTY device: ${ttyPath}`);
      } else {
        api.logger.warn(`[vibemon] No TTY device found (ESP32 not connected?)`);
      }
    }

    // Send start state on gateway start
    api.on("gateway_start", () => {
      debug("Gateway started -> start");
      sendStatus("start", { note: "gateway_started" });
    });

    // Before agent starts -> thinking
    api.on("before_agent_start", (event, ctx) => {
      cancelDoneTimer();
      debug(`Agent starting (prompt: ${event.prompt?.slice(0, 50)}...) -> thinking`);
      sendStatus("thinking");
    });

    // Before tool call -> working
    api.on("before_tool_call", (event, ctx) => {
      cancelDoneTimer();
      const toolName = event.toolName || ctx.toolName || "unknown";
      debug(`Tool call: ${toolName} -> working`);
      sendStatus("working", { tool: toolName });
    });

    // After tool call -> back to thinking
    api.on("after_tool_call", (event, ctx) => {
      // Don't cancel done timer here - we want to keep it if message was sent
      const toolName = event.toolName || ctx.toolName || "unknown";
      debug(`Tool done: ${toolName} -> thinking`);

      // Only go back to thinking if not waiting for done
      if (!doneTimer) {
        sendStatus("thinking");
      }
    });

    // Message sent -> schedule done
    api.on("message_sent", (event, ctx) => {
      debug(`Message sent to ${event.to} (success: ${event.success})`);

      if (event.success) {
        // Schedule done with delay
        scheduleDone();
      }
    });

    // Agent end -> schedule done (fallback)
    api.on("agent_end", (event, ctx) => {
      debug(`Agent ended (success: ${event.success})`);

      if (event.success && !doneTimer) {
        // Only schedule if not already scheduled by message_sent
        scheduleDone();
      }
    });

    // Session end -> done immediately
    api.on("session_end", (event, ctx) => {
      cancelDoneTimer();
      debug("Session ended -> done");
      sendStatus("done");
    });

    // Gateway stop -> done
    api.on("gateway_stop", () => {
      cancelDoneTimer();
      debug("Gateway stopped -> done");
      sendStatus("done", { note: "gateway_stopped" });
    });
  },
};

export default plugin;
