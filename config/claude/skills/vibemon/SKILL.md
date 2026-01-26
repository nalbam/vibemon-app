---
name: vibemon
description: Use when you want to lock vibe-monitor to current project, preventing display updates from other projects
---

# Vibe Lock

Lock vibe-monitor to the current project.

## Usage

Run the following command to lock the current project:

```bash
python3 ~/.claude/hooks/vibe-monitor.py --lock
```

## Related Commands

```bash
# Unlock
python3 ~/.claude/hooks/vibe-monitor.py --unlock

# Check status
python3 ~/.claude/hooks/vibe-monitor.py --status

# Lock specific project
python3 ~/.claude/hooks/vibe-monitor.py --lock "project-name"
```

## When Locked

- Display updates from other projects are ignored
- Other projects still get added to the project list
- Use Tray menu → Project Lock to switch or unlock
