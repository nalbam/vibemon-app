---
name: run-desktop
description: Run and drive the VibeMon Electron app — launch it, put a character on screen, switch between the 2D and 3D engines, and screenshot the window. Use when asked to start the app, take a screenshot of it, check a rendering change in the real app, or interact with its windows.
---

VibeMon is a tray-only Electron app: `pnpm start` shows no window, because the
character window is created on demand by a `POST /status` to its local HTTP
server. For agent use, drive it through
`.claude/skills/run-desktop/driver.mjs` — a zero-dependency driver that speaks
the Chrome DevTools Protocol over Node's built-in WebSocket (Node >= 22, no
npm install, no tmux).

The driver always launches with an isolated `--user-data-dir`, so a run never
touches the developer's real settings in `~/Library/Application Support/vibemon`.

## Run (agent path)

One shot: pass the commands as arguments. They run in order, the app is closed
at the end, and the exit code is non-zero if any command failed.

```bash
node .claude/skills/run-desktop/driver.mjs \
  "launch 3d" "lock codex" "status working" "engine" "ss codex-3d" "logs"
```

Then **open the PNG and look at it.** Screenshots land in `/tmp/vibemon-shots/`
(override with `SCREENSHOT_DIR`).

Run it with no arguments for an interactive `driver>` REPL instead (same
commands, `quit` to exit).

The real app must not be running — it owns port 19280, and `launch` fails fast
with a clear error if the port is taken.

### Commands

| command | what it does |
|---|---|
| `launch [2d\|3d]` | seed the render mode, boot the app, wait for its HTTP server |
| `status <state> [character] [project]` | `POST /status` → creates/updates the character window, waits for it |
| `lock <character\|auto>` | `POST /character-lock` — pins the character against other bridges |
| `focus` | what the window is *actually* showing (focused project / character / state) |
| `ss [name]` | screenshot over an opaque backdrop, prints `focus` alongside |
| `ss-raw [name]` | screenshot the true transparent frame |
| `engine` | which engine booted: `vibemon-canvas` (2D) vs `vibemon-canvas-3d` (WebGL) |
| `page <character\|bubble>` | retarget commands at the character window or the speech bubble |
| `windows` | list open windows |
| `eval <js>` / `text [sel]` | evaluate in the page / dump innerText |
| `wait <ms>` | pause the sequence (e.g. to let an animation settle) |
| `logs` | renderer console, uncaught errors, CSP violations, and main-process output since launch |
| `quit` | close the app (implicit at the end of a one-shot run) |

States: `start`, `idle`, `thinking`, `planning`, `working`, `packing`,
`notification`, `done`, `sleep`, `alert`. Characters: `vibemon`, `clawd`,
`codex`, `kiro`, `claw`, `daangni`.

## Run (human path)

```bash
pnpm start    # tray icon only; POST a status to see the character window
curl -X POST http://127.0.0.1:19280/status -H 'Content-Type: application/json' \
  -d '{"state":"working","character":"codex","project":"manual"}'
```

## Gotchas

- **Launching gives you no window.** The dock icon is hidden and the character
  window is created by `POST /status` (port 19280). `launch` alone proves only
  that the main process booted — always follow it with `status`.

- **Another VibeMon bridge will steal the window.** A developer machine
  usually has the Claude Code hook posting real statuses to the same port, so
  the window follows *their* project, not yours — the `/status` reply then
  says `"skipped": true`. Two defenses, use both: `lock <character>` pins the
  character regardless of which project has focus, and `ss` prints `focus`
  next to every screenshot so an image that surprises you is explainable
  rather than mysterious.

- **The window's first update races renderer init.** The main process sends
  the initial state at `ready-to-show`, before the renderer's async init
  (registry IPC + character image preload) registers its listener — on a cold
  cache the update is lost and the default character stays on screen. `status`
  self-heals: when it creates the window it waits for the engine to boot and
  re-drives the state (via a different-state nudge, because an identical
  re-POST is deduped). Expect the extra `/status` pair in the app's logs.

- **Render mode is persisted state, not a flag.** It lives in electron-store
  (`<userData>/config.json`), read when the character window is created.
  `launch` seeds it before boot; switching modes means `quit` then
  `launch <mode>`.

- **The window is transparent and frameless.** A raw screenshot is hard to
  read against a dark reviewer background, so `ss` injects an opaque backdrop
  and reverts it. Use `ss-raw` when the transparency itself is what you're
  checking.

- **Screenshots are in device pixels.** On a retina display the PNG is 2x the
  window's logical size (e.g. 268x276 for a 134x138 window).

## Troubleshooting

- **`launch` fails with "port 19280 is already in use"** — the real app (or a
  previous driver run) still holds it: `lsof -nP -iTCP:19280 -sTCP:LISTEN`
  and kill that PID.
- **`status` times out waiting for the character window** — check `logs`; a
  renderer crash (bad vendored engine, CSP violation) shows up there.
- **3D shows the default purple monster for every character** — the registry
  entry lost its `theme`; check `src/shared/data/characters.json` and re-sync
  with `pnpm check:registry -- --fix`.
