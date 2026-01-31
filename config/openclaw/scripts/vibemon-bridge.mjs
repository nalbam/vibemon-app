#!/usr/bin/env node
/**
 * ESP32-C6 LCD status bridge for OpenClaw
 *
 * - Watches OpenClaw gateway JSONL log file(s)
 * - Derives high-level state (thinking/planning/working/done)
 * - Writes newline-delimited JSON to the first USB serial device
 *   - Linux: /dev/ttyACM*
 *   - macOS: /dev/cu.usbmodem*
 *
 * Expected ESP32 input example:
 *   {"state":"working","tool":"exec","project":"OpenClaw","character":"claw"}\n
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const LOG_DIR = process.env.OPENCLAW_LOG_DIR ?? "/tmp/openclaw";
const DEBUG = process.env.DEBUG === "1" || process.env.DEBUG === "true";

const PROJECT = process.env.PROJECT_NAME ?? "OpenClaw";
const CHARACTER = "claw";

// Debug logging helper
function debug(...args) {
  if (DEBUG) console.error("[DEBUG]", ...args);
}

function listTtys() {
  try {
    const devices = fs.readdirSync("/dev");
    // Linux: /dev/ttyACM*, macOS: /dev/cu.usbmodem*
    return devices
      .filter((n) => n.startsWith("ttyACM") || n.startsWith("cu.usbmodem"))
      .map((n) => path.join("/dev", n))
      .sort();
  } catch {
    return [];
  }
}

function pickTty() {
  const ttys = listTtys();
  return ttys[0] ?? null;
}

function todayLogPath() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return path.join(LOG_DIR, `openclaw-${yyyy}-${mm}-${dd}.log`);
}

function safeJsonParse(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function writeJsonLine(stream, obj) {
  stream.write(JSON.stringify(obj) + "\n");
}

function nowIso() {
  return new Date().toISOString();
}

// --- state machine ---
let currentState = null; // last emitted state
let activeRuns = 0; // count of active embedded runs

function setState(stream, nextState, extra = {}) {
  if (nextState === currentState && Object.keys(extra).length === 0) return;
  currentState = nextState;

  debug(`setState: ${nextState}, activeRuns=${activeRuns}`, extra);
  writeJsonLine(stream, {
    state: nextState,
    project: PROJECT,
    character: CHARACTER,
    ts: nowIso(),
    ...extra,
  });
}

// --- Multi-pattern matchers for log format resilience ---

// Tool execution patterns (ordered by priority)
const TOOL_PATTERNS = [
  // Current format: embedded run tool start: runId=... tool=exec toolCallId=...
  {
    name: "embedded_run_tool",
    regex: /embedded run tool (start|end):.*?\btool=([a-zA-Z0-9_:-]+)/,
    extract: (m) => ({ phase: m[1], tool: m[2] }),
  },
  // Alternative: tool_call start tool=exec
  {
    name: "tool_call",
    regex: /tool[_\s]?call\s+(start|end|started|ended|begin|finish).*?\btool[=:\s]+([a-zA-Z0-9_:-]+)/i,
    extract: (m) => ({ phase: m[1].replace(/ed$/, "").replace("begin", "start").replace("finish", "end"), tool: m[2] }),
  },
  // Alternative: executing tool: exec
  {
    name: "executing_tool",
    regex: /(executing|finished|starting|completed)\s+tool[:\s]+([a-zA-Z0-9_:-]+)/i,
    extract: (m) => ({
      phase: ["executing", "starting"].includes(m[1].toLowerCase()) ? "start" : "end",
      tool: m[2],
    }),
  },
  // Alternative: [tool:exec] start
  {
    name: "bracketed_tool",
    regex: /\[tool[:\s]*([a-zA-Z0-9_:-]+)\]\s*(start|end|begin|finish)/i,
    extract: (m) => ({ phase: m[2].replace("begin", "start").replace("finish", "end"), tool: m[1] }),
  },
];

// Session state patterns (ordered by priority)
const SESSION_STATE_PATTERNS = [
  // Current format: session state: sessionId=... prev=idle new=processing
  {
    name: "session_state_kv",
    test: (line) => line.includes("session state:") || line.includes("session_state:"),
    extract: (line) => {
      const prev = line.match(/\bprev[=:\s]+([a-zA-Z_]+)/i)?.[1] ?? null;
      const next = line.match(/\bnew[=:\s]+([a-zA-Z_]+)/i)?.[1] ?? null;
      const reason = line.match(/\breason[=:\s]*"?([^"\s]+)"?/i)?.[1] ?? null;
      return prev || next ? { prev, next, reason } : null;
    },
  },
  // Alternative: state changed: idle -> processing
  {
    name: "state_changed_arrow",
    test: (line) => /state\s*(changed|transition)/i.test(line),
    extract: (line) => {
      const m = line.match(/([a-zA-Z_]+)\s*(?:->|=>|to)\s*([a-zA-Z_]+)/i);
      return m ? { prev: m[1], next: m[2], reason: null } : null;
    },
  },
  // Alternative: session.state = processing
  {
    name: "state_assignment",
    test: (line) => /session\.?state/i.test(line),
    extract: (line) => {
      const m = line.match(/session\.?state\s*[=:]\s*([a-zA-Z_]+)/i);
      return m ? { prev: null, next: m[1], reason: null } : null;
    },
  },
  // Alternative: {"state": "processing", "previous": "idle"}
  {
    name: "state_json",
    test: (line) => line.includes('"state"'),
    extract: (line) => {
      const stateMatch = line.match(/"state"\s*:\s*"([a-zA-Z_]+)"/);
      const prevMatch = line.match(/"(?:prev|previous|from)"\s*:\s*"([a-zA-Z_]+)"/);
      return stateMatch ? { prev: prevMatch?.[1] ?? null, next: stateMatch[1], reason: null } : null;
    },
  },
];

// Run lifecycle patterns
const RUN_LIFECYCLE_PATTERNS = {
  start: [
    /embedded run start:/i,
    /run[_\s]?started/i,
    /agent[_\s]?run[_\s]?begin/i,
    /starting[_\s]?run/i,
    /\brun\b.*\bstart/i,
  ],
  done: [
    /embedded run done:/i,
    /run[_\s]?(?:ended|finished|completed|done)/i,
    /agent[_\s]?run[_\s]?(?:end|finish|complete)/i,
    /\brun\b.*\b(?:end|done|complete)/i,
  ],
  promptStart: [
    /embedded run prompt start/i,
    /prompt[_\s]?(?:start|begin)/i,
    /starting[_\s]?prompt/i,
  ],
  promptEnd: [
    /embedded run prompt end/i,
    /prompt[_\s]?(?:end|finish|done)/i,
    /finished[_\s]?prompt/i,
  ],
  delivered: [
    /delivered reply to/i,
    /reply[_\s]?delivered/i,
    /response[_\s]?sent/i,
    /message[_\s]?delivered/i,
  ],
};

// Subsystem patterns for matching log sources
const SUBSYSTEM_PATTERNS = {
  diagnostic: [/diagnostic/i, /diag/i, /session/i],
  agent: [/agent\/embedded/i, /embedded/i, /agent/i],
  gateway: [/gateway\/channels/i, /gateway/i, /channel/i],
};

function parseEmbeddedTool(line) {
  for (const pattern of TOOL_PATTERNS) {
    const m = line.match(pattern.regex);
    if (m) {
      const result = pattern.extract(m);
      debug(`Tool matched [${pattern.name}]:`, result);
      return result;
    }
  }
  return null;
}

function parseSessionState(line) {
  for (const pattern of SESSION_STATE_PATTERNS) {
    if (pattern.test(line)) {
      const result = pattern.extract(line);
      if (result) {
        debug(`Session state matched [${pattern.name}]:`, result);
        return result;
      }
    }
  }
  return null;
}

function matchesAnyPattern(text, patterns) {
  return patterns.some((p) => p.test(text));
}

function matchesSubsystem(text, type) {
  const patterns = SUBSYSTEM_PATTERNS[type];
  return patterns ? matchesAnyPattern(text, patterns) : false;
}

// Extract message and subsystem from various JSON log formats
function extractLogFields(obj) {
  // Format 1: {"0": "{\"subsystem\":...}", "1": "message"}
  if (typeof obj?.["0"] === "string" && typeof obj?.["1"] === "string") {
    return { subsystem: obj["0"], msg: obj["1"] };
  }

  // Format 2: {"subsystem": "...", "message": "..."}
  if (typeof obj?.subsystem === "string" && typeof obj?.message === "string") {
    return { subsystem: obj.subsystem, msg: obj.message };
  }

  // Format 3: {"sub": "...", "msg": "..."}
  if (typeof obj?.sub === "string" && typeof obj?.msg === "string") {
    return { subsystem: obj.sub, msg: obj.msg };
  }

  // Format 4: {"level": "...", "msg": "...", "module": "..."}
  if (typeof obj?.msg === "string") {
    return { subsystem: obj.module ?? obj.logger ?? obj.source ?? "", msg: obj.msg };
  }

  // Format 5: {"text": "..."} or {"log": "..."}
  if (typeof obj?.text === "string") {
    return { subsystem: "", msg: obj.text };
  }
  if (typeof obj?.log === "string") {
    return { subsystem: "", msg: obj.log };
  }

  // Format 6: Array format [subsystem, message]
  if (Array.isArray(obj) && obj.length >= 2) {
    return { subsystem: String(obj[0] ?? ""), msg: String(obj[1] ?? "") };
  }

  return null;
}

function handleLogLine(stream, obj) {
  const fields = extractLogFields(obj);
  if (!fields || !fields.msg) {
    debug("Skipping unrecognized log format:", JSON.stringify(obj).slice(0, 100));
    return;
  }

  const { subsystem, msg } = fields;
  debug("Processing:", { subsystem: subsystem.slice(0, 50), msg: msg.slice(0, 80) });

  // Session state transitions (for starting work, not for completion)
  if (matchesSubsystem(subsystem, "diagnostic") || msg.toLowerCase().includes("session")) {
    const s = parseSessionState(msg);
    if (s) {
      const nextState = s.next?.toLowerCase();
      if (nextState === "processing" || nextState === "running" || nextState === "active") {
        debug("State -> thinking (session processing)");
        setState(stream, "thinking");
        return;
      }
      // NOTE: session idle is NOT used for done transition
      // It fires too early, before the actual reply is delivered
    }
  }

  // Run lifecycle events
  if (matchesSubsystem(subsystem, "agent") || msg.toLowerCase().includes("run")) {
    // Run start -> increment counter and set thinking
    if (matchesAnyPattern(msg, RUN_LIFECYCLE_PATTERNS.start)) {
      activeRuns++;
      debug(`Run start: activeRuns=${activeRuns}`);
      setState(stream, "thinking");
      return;
    }

    // Run done -> decrement counter, check if all runs completed
    if (matchesAnyPattern(msg, RUN_LIFECYCLE_PATTERNS.done)) {
      activeRuns = Math.max(0, activeRuns - 1);
      debug(`Run done: activeRuns=${activeRuns}`);
      // Don't transition to done here - wait for delivered reply
      return;
    }

    // Prompt start -> planning
    if (matchesAnyPattern(msg, RUN_LIFECYCLE_PATTERNS.promptStart)) {
      debug("State -> planning (prompt start)");
      setState(stream, "planning");
      return;
    }

    // Prompt end -> thinking (if still in planning)
    if (matchesAnyPattern(msg, RUN_LIFECYCLE_PATTERNS.promptEnd)) {
      if (currentState === "planning") {
        debug("State -> thinking (prompt end, was planning)");
        setState(stream, "thinking");
      }
      return;
    }

    // Tool activity
    const t = parseEmbeddedTool(msg);
    if (t) {
      if (t.phase === "start") {
        debug("State -> working:", t.tool);
        setState(stream, "working", { tool: t.tool });
        return;
      }
      if (t.phase === "end") {
        if (currentState !== "done") {
          debug("State -> thinking (tool end)");
          setState(stream, "thinking");
        }
        return;
      }
    }
  }

  // Delivery marker - only transition to done if no active runs
  if (matchesSubsystem(subsystem, "gateway") || matchesAnyPattern(msg, RUN_LIFECYCLE_PATTERNS.delivered)) {
    if (matchesAnyPattern(msg, RUN_LIFECYCLE_PATTERNS.delivered)) {
      debug(`Reply delivered: activeRuns=${activeRuns}`);
      // Only go to done if no other runs are active
      if (activeRuns === 0) {
        debug("State -> done (all runs completed, reply delivered)");
        setState(stream, "done");
      } else {
        debug(`Skipping done: ${activeRuns} runs still active`);
      }
      return;
    }
  }
}

function ensureDeviceReady(dev) {
  try {
    fs.accessSync(dev, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  let dev = pickTty();
  if (!dev) {
    console.error("No USB serial device found. Plug ESP32-C6 and retry.");
    console.error("  Linux: /dev/ttyACM*");
    console.error("  macOS: /dev/cu.usbmodem*");
    process.exit(2);
  }

  if (!ensureDeviceReady(dev)) {
    console.error(`Found ${dev} but not writable.`);
    console.error("  Linux: Check permissions (dialout group) or run as root.");
    console.error("  macOS: No additional permissions needed.");
  }

  const ttyStream = fs.createWriteStream(dev, { flags: "w" });
  ttyStream.on("error", (e) => {
    console.error("TTY stream error:", e?.message ?? e);
    process.exit(3);
  });

  // Startup marker - show "Hello!" on ESP32
  setState(ttyStream, "start", { note: "bridge_started" });

  const logPath = todayLogPath();
  console.error("=".repeat(50));
  console.error("VibeMon Bridge for OpenClaw");
  console.error("=".repeat(50));
  console.error("Using tty:", dev);
  console.error("Tailing log:", logPath);
  console.error("Debug mode:", DEBUG ? "ON" : "OFF (set DEBUG=1 to enable)");
  console.error("Supported patterns:");
  console.error("  - Tool patterns:", TOOL_PATTERNS.length);
  console.error("  - Session state patterns:", SESSION_STATE_PATTERNS.length);
  console.error("  - JSON formats: 6 variants");
  console.error("=".repeat(50));

  // If the log file doesn't exist yet, wait for it.
  const waitStart = Date.now();
  while (!fs.existsSync(logPath)) {
    if (Date.now() - waitStart > 15000) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  const tail = spawn("tail", ["-n", "0", "-F", logPath], { stdio: ["ignore", "pipe", "pipe"] });

  tail.stderr.on("data", (buf) => {
    const s = buf.toString("utf8").trim();
    if (s) console.error("tail:", s);
  });

  let carry = "";
  tail.stdout.on("data", (buf) => {
    carry += buf.toString("utf8");
    while (true) {
      const idx = carry.indexOf("\n");
      if (idx === -1) break;
      const line = carry.slice(0, idx);
      carry = carry.slice(idx + 1);

      const obj = safeJsonParse(line);
      if (!obj) continue;
      handleLogLine(ttyStream, obj);
    }
  });

  // Re-scan device periodically in case of reconnect.
  setInterval(() => {
    const next = pickTty();
    if (next && next !== dev) {
      console.error(`TTY changed: ${dev} -> ${next}`);
      dev = next;
      // Note: we keep the old stream; for robustness we would reopen.
      // Keeping it simple for v1; if you see reconnect issues, we can add reopen logic.
    }
  }, 5000).unref();

  // Check for log file rotation at midnight
  let currentLogPath = logPath;
  setInterval(() => {
    const newLogPath = todayLogPath();
    if (newLogPath !== currentLogPath) {
      console.error(`Log file rotated: ${currentLogPath} -> ${newLogPath}`);
      console.error("Restarting bridge to follow new log file...");
      // Kill tail and let the process exit, systemd/launchd will restart us
      tail.kill("SIGTERM");
    }
  }, 60000).unref(); // Check every minute

  tail.on("exit", (code, sig) => {
    console.error(`tail exited code=${code} sig=${sig}`);
    process.exit(code ?? 1);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
