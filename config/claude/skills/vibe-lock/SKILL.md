---
name: vibe-lock
description: Use when you want to lock vibe-monitor to current project, preventing display updates from other projects
---

# Vibe Lock

Lock vibe-monitor to the current project.

## Usage

Run the following command to lock the current project:

```bash
~/.claude/hooks/vibe-monitor.sh --lock
```

## Related Commands

```bash
# Unlock
~/.claude/hooks/vibe-monitor.sh --unlock

# Check status
~/.claude/hooks/vibe-monitor.sh --status | jq

# Lock specific project
~/.claude/hooks/vibe-monitor.sh --lock "project-name"
```

## When Locked

- Display updates from other projects are ignored
- Other projects still get added to the project list
- Use Tray menu → Project Lock to switch or unlock
