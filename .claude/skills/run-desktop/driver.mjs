// REPL driver for the VibeMon Electron app.
// Designed for agents: wrap in tmux, send-keys commands, capture-pane output.
//
//   node .claude/skills/run-desktop/driver.mjs
//   driver> launch 3d
//   driver> lock codex
//   driver> status working
//   driver> ss codex-3d
//
// Launch always uses an isolated --user-data-dir, so the developer's real
// settings under ~/Library/Application Support/vibemon are never touched.
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

let electron;
try {
  ({ _electron: electron } = await import('playwright-core'));
} catch {
  console.error('playwright-core is missing. Install it into this skill directory:');
  console.error('  npm install --prefix .claude/skills/run-desktop --no-save playwright-core');
  process.exit(1);
}

const APP_DIR = path.resolve(import.meta.dirname, '../../..');
const HTTP = 'http://127.0.0.1:19280';
const SHOT_DIR = process.env.SCREENSHOT_DIR || path.join(os.tmpdir(), 'vibemon-shots');
const USER_DATA_ROOT = process.env.VIBEMON_TEST_USER_DATA || path.join(os.tmpdir(), 'vibemon-userdata');

fs.mkdirSync(SHOT_DIR, { recursive: true });

const electronBin = process.platform === 'darwin'
  ? path.join(APP_DIR, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')
  : path.join(APP_DIR, 'node_modules/electron/dist/electron');

let app = null;
let page = null;          // the window commands act on (character by default)
const logs = [];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(label, fn, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn().catch(() => null);
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await sleep(250);
  }
}

async function post(route, body) {
  const res = await fetch(`${HTTP}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return `${res.status} ${(await res.text()).slice(0, 200)}`;
}

function windowByKind(kind) {
  const suffix = kind === 'bubble' ? 'bubble.html' : 'index.html';
  return app?.windows().find((w) => w.url().endsWith(suffix)) ?? null;
}

const COMMANDS = {
  // launch [2d|3d] — seeds the render mode, then boots the app.
  async launch(arg) {
    if (app) return console.log('already launched — quit first');
    const mode = arg.trim() === '3d' ? '3d' : '2d';
    const userData = path.join(USER_DATA_ROOT, mode);
    fs.mkdirSync(userData, { recursive: true });
    // electron-store keeps settings in <userData>/config.json; the character
    // window reads renderMode at creation, so seed it before launching.
    const configFile = path.join(userData, 'config.json');
    const config = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf8')) : {};
    fs.writeFileSync(configFile, JSON.stringify({ ...config, renderMode: mode }, null, 2));

    app = await electron.launch({
      executablePath: electronBin,
      args: [APP_DIR, `--user-data-dir=${userData}`],
      cwd: APP_DIR,
      timeout: 30_000
    });
    app.on('window', (w) => {
      w.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
      w.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    });

    // Ready signal: the HTTP server is up. There is no window yet — the
    // character window is created on demand by POST /status.
    await until('http server', async () => (await fetch(`${HTTP}/health`)).ok, 30_000);
    console.log(`launched in ${mode} mode (userData: ${userData})`);
    console.log('no window yet — run "status working" to create the character window');
  },

  // status <state> [character] [project] — POST /status, then wait for the window.
  async status(args) {
    const [state = 'working', character = 'vibemon', project = 'driver'] = args.trim().split(/\s+/);
    console.log(await post('/status', { state, character, project }));
    page = await until('character window', async () => windowByKind('character'));
    await sleep(1500);   // let images load / the rig build and animate
    console.log('character window ready:', page.url().split('/').pop());
  },

  // lock <character|auto> — pin the character. Use this before screenshots:
  // any other VibeMon bridge on this machine posts to the same port and can
  // retarget the window (the /status reply then says "skipped": true).
  async lock(character) {
    console.log(await post('/character-lock', { character: character.trim() || 'auto' }));
    await sleep(1000);
  },

  // focus — what the window is actually showing right now. The window follows
  // the focused project, and any other VibeMon bridge on this machine (a
  // Claude Code hook, say) can retarget it between your POST and your
  // screenshot. Trust this over the status you sent.
  async focus() {
    const res = await fetch(`${HTTP}/status`);
    const data = await res.json();
    const entry = data.projects?.[data.focusedProject];
    console.log(entry
      ? `focused=${data.focusedProject} character=${entry.character} state=${entry.state}`
      : `focused=${data.focusedProject} (no entry)`);
  },

  // ss [name] — screenshot over an opaque backdrop (the window is transparent,
  // so a raw shot is hard to read in review). Use ss-raw for the real frame.
  // Prints the focused project alongside, so the image is self-describing.
  async ss(name) {
    if (!page) return console.log('ERROR: no window — run "status" first');
    await page.evaluate(() => { document.documentElement.style.background = '#2b2b33'; });
    await sleep(300);
    const file = path.join(SHOT_DIR, `${name.trim() || `ss-${Date.now()}`}.png`);
    await page.screenshot({ path: file });
    await page.evaluate(() => { document.documentElement.style.background = ''; });
    console.log('screenshot:', file);
    await COMMANDS.focus();
  },

  async 'ss-raw'(name) {
    if (!page) return console.log('ERROR: no window — run "status" first');
    const file = path.join(SHOT_DIR, `${name.trim() || `raw-${Date.now()}`}.png`);
    await page.screenshot({ path: file, omitBackground: true });
    console.log('screenshot:', file);
  },

  // page <character|bubble> — retarget subsequent commands.
  async page(kind) {
    const found = windowByKind(kind.trim() || 'character');
    if (!found) return console.log('not open:', kind);
    page = found;
    console.log('now driving:', page.url().split('/').pop());
  },

  async windows() {
    if (!app) return console.log('ERROR: launch first');
    for (const w of app.windows()) console.log(' ', w.url());
  },

  // engine — which renderer actually booted (2D canvas vs WebGL canvas).
  async engine() {
    if (!page) return console.log('ERROR: no window — run "status" first');
    console.log(JSON.stringify(await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return c ? { className: c.className, width: c.width, height: c.height } : null;
    })));
  },

  async eval(expr) {
    if (!page) return console.log('ERROR: no window — run "status" first');
    try { console.log(JSON.stringify(await page.evaluate(expr))); }
    catch (e) { console.log('ERROR:', e.message); }
  },

  async text(sel) {
    if (!page) return console.log('ERROR: no window — run "status" first');
    console.log(await page.evaluate(
      (s) => (s ? document.querySelector(s) : document.body)?.innerText ?? '(null)',
      sel.trim() || null));
  },

  // logs — renderer console + uncaught errors collected since launch. Empty
  // is the expected result; CSP violations and failed imports show up here.
  logs() {
    console.log(logs.length ? logs.join('\n') : '(none)');
  },

  async quit() {
    if (app) await app.close().catch(() => {});
    app = null; page = null;
  },

  help() {
    console.log('commands:', Object.keys(COMMANDS).join(', '));
    console.log('typical: launch 3d → lock codex → status working → engine → ss codex-3d → logs');
    console.log('a screenshot that surprises you: run "focus" — another bridge probably retargeted the window');
  }
};

// Electron steals stdin — read the raw fd instead.
const stdin = fs.createReadStream(null, { fd: fs.openSync('/dev/stdin', 'r') });
const rl = readline.createInterface({ input: stdin, output: process.stdout, prompt: 'driver> ' });

rl.on('line', async (line) => {
  const [cmd, ...rest] = line.trim().split(/\s+/);
  if (!cmd) return rl.prompt();
  const fn = COMMANDS[cmd];
  if (!fn) { console.log('unknown:', cmd, '— try: help'); return rl.prompt(); }
  try { await fn(rest.join(' ')); } catch (e) { console.log('ERROR:', e.message); }
  if (cmd === 'quit') { rl.close(); process.exit(0); }
  rl.prompt();
});
rl.on('close', async () => { await COMMANDS.quit(); process.exit(0); });

console.log('VibeMon driver — "help" for commands, "launch [2d|3d]" to start');
rl.prompt();
