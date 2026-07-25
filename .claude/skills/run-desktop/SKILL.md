---
name: run-desktop
description: Run and drive the VibeMon Electron app — launch it, put a character on screen, switch between the 2D and 3D engines, and screenshot the window. Use when asked to start the app, take a screenshot of it, check a rendering change in the real app, or interact with its windows.
---

VibeMon is a tray-only Electron app: `pnpm start` shows no window, because the
character window is created on demand by a `POST /status` to its local HTTP
server. For agent use, drive it through the Playwright REPL at
`.claude/skills/run-desktop/driver.mjs`.

The driver always launches with an isolated `--user-data-dir`, so a run never
touches the developer's real settings in `~/Library/Application Support/vibemon`.

## Prerequisites

`playwright-core` is not a project dependency — install it into this skill
directory (kept out of the app's `package.json` and lockfile):

```bash
npm install --prefix .claude/skills/run-desktop --no-save playwright-core
```

Also make sure the real app is not already running — it owns port 19280 and
the launch will collide with it:

```bash
pgrep -fl "VibeMon.app" || echo "clear"
```

## Run (agent path)

```bash
tmux new-session -d -s vibemon -x 200 -y 50
tmux send-keys -t vibemon 'node .claude/skills/run-desktop/driver.mjs' Enter
sleep 2
tmux send-keys -t vibemon 'launch 3d' Enter        # or: launch 2d
sleep 8
tmux send-keys -t vibemon 'lock codex' Enter       # pin the character — see Gotchas
sleep 2
tmux send-keys -t vibemon 'status working' Enter   # creates the character window
sleep 5
tmux send-keys -t vibemon 'ss codex-3d' Enter
sleep 4
tmux capture-pane -t vibemon -p -S -40 | grep -v '^$' | tail -10
```

Then **open the PNG and look at it.** Screenshots land in `/tmp/vibemon-shots/`
(override with `SCREENSHOT_DIR`).

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
| `logs` | renderer console + uncaught errors since launch (empty is the good result) |
| `quit` | close the app and exit |

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

- **Render mode is persisted state, not a flag.** It lives in electron-store
  (`<userData>/config.json`), read when the character window is created.
  `launch` seeds it before boot; switching modes means `quit` then
  `launch <mode>`.

- **The window is transparent and frameless.** A raw screenshot is hard to
  read against a dark reviewer background, so `ss` injects an opaque backdrop
  and reverts it. Use `ss-raw` when the transparency itself is what you're
  checking.

- **macOS has no `timeout(1)`.** The tmux waits above use `sleep`; if you want
  a real poll, write a `for i in $(seq 1 40); do ... done` loop.

- **`tmux capture-pane -p` looks empty.** The pane is mostly blank lines —
  pipe it through `-S -30 | grep -v '^$' | tail -N`.

## Troubleshooting

- **`launch` times out waiting for the HTTP server** — the real app (or a
  previous driver run) still holds 19280. `pgrep -fl Electron` and kill it.
- **`status` times out waiting for the character window** — check `logs`; a
  renderer crash (bad vendored engine, CSP violation) shows up there.
- **3D shows the default purple monster for every character** — the registry
  entry lost its `theme`; check `src/shared/data/characters.json` and re-sync
  with `pnpm check:registry -- --fix`.
- **Stale tmux session** — `tmux kill-session -t vibemon`.
