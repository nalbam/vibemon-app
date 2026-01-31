#!/usr/bin/env node
/**
 * ESP32-C6 LCD status bridge for OpenClaw
 *
 * - Watches OpenClaw gateway JSONL log file(s)
 * - Derives high-level state (start/thinking/planning/working/done/idle)
 * - Writes newline-delimited JSON to the first /dev/ttyACM* device
 *
 * Expected ESP32 input example:
 *   {"state":"working","tool":"exec","project":"Sera"}\n
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PROJECT = process.env.SERA_PROJECT ?? "Sera";
const DONE_TO_IDLE_MS = Number.parseInt(process.env.SERA_DONE_TO_IDLE_MS ?? "10000", 10);
const LOG_DIR = process.env.OPENCLAW_LOG_DIR ?? "/tmp/openclaw";

function listTtys() {
  try {
    return fs
      .readdirSync("/dev")
      .filter((n) => n.startsWith("ttyACM"))
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
  const line = JSON.stringify(obj);
  stream.write(line + "\n");
}

function nowIso() {
  return new Date().toISOString();
}

// --- state machine ---
let currentState = "idle"; // what we last emitted
let doneTimer = null;

function setState(stream, nextState, extra = {}) {
  if (nextState === currentState && Object.keys(extra).length === 0) return;
  currentState = nextState;

  // Clear any pending done->idle timer if we move away from done/idle.
  if (doneTimer) {
    clearTimeout(doneTimer);
    doneTimer = null;
  }

  writeJsonLine(stream, {
    state: nextState,
    project: PROJECT,
    ts: nowIso(),
    ...extra,
  });

  if (nextState === "done") {
    doneTimer = setTimeout(() => {
      currentState = "idle";
      writeJsonLine(stream, { state: "idle", project: PROJECT, ts: nowIso() });
      doneTimer = null;
    }, DONE_TO_IDLE_MS);
  }
}

function parseEmbeddedTool(line) {
  // Example:
  // embedded run tool start: runId=... tool=exec toolCallId=...
  const m = line.match(/embedded run tool (start|end): .*? tool=([a-zA-Z0-9_:-]+)/);
  if (!m) return null;
  return { phase: m[1], tool: m[2] };
}

function parseSessionState(line) {
  // Example:
  // session state: sessionId=... prev=idle new=processing reason="run_started" ...
  if (!line.startsWith("session state:")) return null;
  const prev = line.match(/\sprev=([^\s]+)/)?.[1] ?? null;
  const next = line.match(/\snew=([^\s]+)/)?.[1] ?? null;
  const reason = line.match(/\sreason=\"([^\"]+)\"/)?.[1] ?? null;
  return { prev, next, reason };
}

function parsePromptPhase(line) {
  // embedded run prompt start/end
  const m = line.match(/embedded run prompt (start|end):/);
  if (!m) return null;
  return { phase: m[1] };
}

function handleLogLine(stream, obj) {
  // The OpenClaw JSONL file logs often look like:
  // {"0":"{\"subsystem\":\"diagnostic\"}","1":"session state: ...", ...}
  const subsystemRaw = typeof obj?.["0"] === "string" ? obj["0"] : "";
  const msg = typeof obj?.["1"] === "string" ? obj["1"] : "";

  // We only care about lines that have the message in field "1".
  if (!msg) return;

  // Session state transitions
  if (subsystemRaw.includes("diagnostic") && msg.startsWith("session state:")) {
    const s = parseSessionState(msg);
    if (!s) return;

    if (s.next === "processing") {
      // Start of a run
      setState(stream, "start");
      setState(stream, "thinking");
      return;
    }

    if (s.next === "idle") {
      // End of a run
      setState(stream, "done");
      return;
    }

    // If other states appear, reflect them best-effort
    if (s.next) {
      setState(stream, s.next);
    }
    return;
  }

  // Prompt boundaries (optional: map to planning)
  if (subsystemRaw.includes("agent/embedded") && msg.startsWith("embedded run prompt start")) {
    setState(stream, "planning");
    return;
  }

  // Tool activity
  if (subsystemRaw.includes("agent/embedded") && msg.startsWith("embedded run tool ")) {
    const t = parseEmbeddedTool(msg);
    if (!t) return;

    if (t.phase === "start") {
      setState(stream, "working", { tool: t.tool });
      return;
    }
    if (t.phase === "end") {
      // Go back to thinking while processing
      if (currentState !== "done" && currentState !== "idle") {
        setState(stream, "thinking");
      }
      return;
    }
  }
}

function ensureDeviceReady(dev) {
  // Basic permission sanity check (non-fatal)
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
    console.error("No /dev/ttyACM* device found. Plug ESP32-C6 and retry.");
    process.exit(2);
  }

  if (!ensureDeviceReady(dev)) {
    console.error(`Found ${dev} but not writable. Check permissions (dialout group) or run as root.`);
  }

  const ttyStream = fs.createWriteStream(dev, { flags: "w" });
  ttyStream.on("error", (e) => {
    console.error("TTY stream error:", e?.message ?? e);
    process.exit(3);
  });

  // Initial ping
  writeJsonLine(ttyStream, { state: "idle", project: PROJECT, ts: nowIso(), note: "bridge_started" });

  let logPath = todayLogPath();
  console.error("Using tty:", dev);
  console.error("Tailing log:", logPath);

  // If the log file doesn't exist yet, wait for it.
  const waitStart = Date.now();
  while (!fs.existsSync(logPath)) {
    if (Date.now() - waitStart > 15000) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  const tail = spawn("tail", ["-n", "0", "-F", logPath], { stdio: ["ignore", "pipe", "pipe"] });

  tail.stderr.on("data", (buf) => {
    // tail prints errors here; keep them visible for debugging
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

  tail.on("exit", (code, sig) => {
    console.error(`tail exited code=${code} sig=${sig}`);
    process.exit(code ?? 1);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
