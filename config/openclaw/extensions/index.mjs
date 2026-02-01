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
 * - HTTP: POST to multiple URLs (array in config)
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

// Character configuration
const CHARACTER = "claw";

// State management
let currentState = "idle";
let doneTimer = null;
let ttyPath = null;
let lastSendTime = 0;
let cachedModel = null;

// Configuration (set in register)
let config = {
  projectName: "OpenClaw",
  character: CHARACTER,
  serialEnabled: false,
  httpEnabled: false,
  httpUrls: ["http://127.0.0.1:19280"],
  autoLaunch: false,
  debug: false,
  vibemonUrl: null,
  vibemonToken: null,
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
 * Read model from ~/.openclaw/openclaw.json
 */
function readModelFromConfig() {
  if (cachedModel) return cachedModel;

  try {
    const configPath = path.join(os.homedir(), ".openclaw", "openclaw.json");
    if (!fs.existsSync(configPath)) {
      debug("openclaw.json not found");
      return null;
    }

    const content = fs.readFileSync(configPath, "utf-8");
    const json = JSON.parse(content);

    // Get model from agents.defaults.model.primary
    const model = json?.agents?.defaults?.model?.primary;
    if (model) {
      // Extract short name (e.g., "openai/gpt-5.2" -> "gpt-5.2")
      cachedModel = model.includes("/") ? model.split("/").pop() : model;
      debug(`Model from config: ${cachedModel}`);
      return cachedModel;
    }
  } catch (err) {
    debug(`Failed to read model: ${err.message}`);
  }

  return null;
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
 * Get Desktop App URL from config (localhost or 127.0.0.1)
 */
function getDesktopAppUrl() {
  return config.httpUrls.find((url) => url.includes("127.0.0.1") || url.includes("localhost"));
}

/**
 * Check if Desktop App is running
 */
async function isDesktopRunning() {
  const desktopUrl = getDesktopAppUrl();
  if (!desktopUrl) return false;

  try {
    const response = await fetch(`${desktopUrl}/health`, { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Launch Desktop App via npx
 */
function launchDesktop() {
  debug("Launching Desktop App via npx...");

  try {
    const shell = process.env.SHELL || "/bin/sh";
    const child = spawn(shell, ["-l", "-c", "npx vibe-monitor@latest"], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    debug("Desktop App launch command sent");
  } catch (err) {
    debug(`Failed to launch Desktop App: ${err.message}`);
  }
}

/**
 * Auto-launch Desktop App if not running
 */
async function autoLaunchDesktop() {
  if (!config.autoLaunch || !config.httpEnabled) return;

  // Only auto-launch if Desktop App URL is configured
  const desktopUrl = getDesktopAppUrl();
  if (!desktopUrl) return;

  const running = await isDesktopRunning();
  if (!running) {
    debug("Desktop App not running, launching...");
    launchDesktop();
    // Wait for Desktop App to start
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

/**
 * Send status to a single HTTP URL
 */
async function sendHttpToUrl(url, payload) {
  try {
    const response = await fetch(`${url}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      debug(`HTTP failed (${url}): ${response.status}`);
      return false;
    }
    debug(`HTTP sent (${url}): ${JSON.stringify(payload)}`);
    return true;
  } catch (err) {
    debug(`HTTP error (${url}): ${err.message}`);
    return false;
  }
}

/**
 * Send status to all VibeMon targets via HTTP (parallel)
 */
async function sendHttp(payload) {
  if (!config.httpEnabled || config.httpUrls.length === 0) return;

  // Send to all URLs in parallel
  const promises = config.httpUrls.map((url) => sendHttpToUrl(url, payload));
  await Promise.allSettled(promises);
}

/**
 * Send status to VibeMon API with Bearer token authentication
 */
async function sendVibeMonApi(payload) {
  // Check if VibeMon API is configured
  if (!config.vibemonUrl || !config.vibemonToken) {
    debug(`VibeMon API skipped: url=${config.vibemonUrl ? "set" : "empty"}, token=${config.vibemonToken ? "set" : "empty"}`);
    return false;
  }

  const project = payload.project || config.projectName;
  if (!project) {
    debug("VibeMon API skipped: no project name");
    return false;
  }

  // Build API URL (strip trailing slash)
  const baseUrl = config.vibemonUrl.replace(/\/+$/, "");
  const apiUrl = `${baseUrl}/status`;

  const apiPayload = {
    state: payload.state || "",
    project: project,
    tool: payload.tool || "",
    model: payload.model || "",
    memory: 0, // OpenClaw doesn't have memory info
    character: payload.character || CHARACTER,
  };

  debug(`VibeMon API request: ${apiUrl}`);
  debug(`VibeMon API payload: ${JSON.stringify(apiPayload)}`);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.vibemonToken}`,
      },
      body: JSON.stringify(apiPayload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      debug(`VibeMon API failed: ${response.status} - ${responseText}`);
      if (logger) {
        logger.warn?.(`[vibemon] VibeMon API error: ${response.status} - ${responseText}`);
      }
      return false;
    }

    debug(`VibeMon API success: ${response.status} - ${responseText}`);
    return true;
  } catch (err) {
    debug(`VibeMon API error: ${err.message}`);
    if (logger) {
      logger.error?.(`[vibemon] VibeMon API error: ${err.message}`);
    }
    return false;
  }
}

/**
 * Build status payload
 */
function buildPayload(state, extra = {}) {
  const payload = {
    state,
    project: config.projectName,
    character: config.character,
    ...extra,
  };

  // Add model if available
  const model = readModelFromConfig();
  if (model) {
    payload.model = model;
  }

  return payload;
}

/**
 * Send status (debounced) - sends to all configured targets
 */
function sendStatus(state, extra = {}) {
  const now = Date.now();
  if (now - lastSendTime < MIN_SEND_INTERVAL_MS && state === currentState) {
    return;
  }
  lastSendTime = now;
  currentState = state;

  const payload = buildPayload(state, extra);

  // Send to serial (synchronous)
  sendSerial(payload);

  // Send to HTTP and VibeMon API (async, fire-and-forget with error logging)
  const asyncTasks = [];

  if (config.httpEnabled && config.httpUrls.length > 0) {
    asyncTasks.push(sendHttp(payload));
  }

  if (config.vibemonUrl && config.vibemonToken) {
    asyncTasks.push(sendVibeMonApi(payload));
  }

  // Execute all async tasks in parallel
  if (asyncTasks.length > 0) {
    Promise.allSettled(asyncTasks).then((results) => {
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          debug(`Async send failed: ${result.reason}`);
        }
      });
    });
  }
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
      httpUrls: pluginConfig.httpUrls ?? config.httpUrls,
      autoLaunch: pluginConfig.autoLaunch ?? config.autoLaunch,
      debug: pluginConfig.debug ?? config.debug,
      vibemonUrl: pluginConfig.vibemonUrl ?? process.env.VIBEMON_URL ?? config.vibemonUrl,
      vibemonToken: pluginConfig.vibemonToken ?? process.env.VIBEMON_TOKEN ?? config.vibemonToken,
    };

    api.logger.info(`[vibemon] Plugin loaded`);
    api.logger.info(`[vibemon] Project: ${config.projectName}, Character: ${config.character}`);
    api.logger.info(`[vibemon] Serial: ${config.serialEnabled}, HTTP: ${config.httpEnabled} (${config.httpUrls.length} URLs), AutoLaunch: ${config.autoLaunch}`);
    if (config.httpEnabled && config.httpUrls.length > 0) {
      api.logger.info(`[vibemon] HTTP URLs: ${config.httpUrls.join(", ")}`);
    }
    // Log VibeMon API configuration
    if (config.vibemonUrl && config.vibemonToken) {
      api.logger.info(`[vibemon] VibeMon API: ${config.vibemonUrl} (token: ${config.vibemonToken.slice(0, 8)}...)`);
    } else {
      api.logger.info(`[vibemon] VibeMon API: disabled (url: ${config.vibemonUrl || "not set"}, token: ${config.vibemonToken ? "set" : "not set"})`);
    }

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
    api.on("gateway_start", async () => {
      debug("Gateway started -> start");
      await autoLaunchDesktop();
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
