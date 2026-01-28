#!/usr/bin/env python3
"""
Vibe Monitor Installation Script
Installs hooks and configuration for Claude Code or Kiro IDE.

Usage:
  # Online install (recommended)
  curl -fsSL https://raw.githubusercontent.com/nalbam/vibe-monitor/main/install.py | python3

  # Local install (from cloned repo)
  python3 install.py
"""

import difflib
import json
import sys
from pathlib import Path
from urllib.request import urlopen
from urllib.error import URLError

# GitHub raw content base URL
GITHUB_RAW_BASE = "https://raw.githubusercontent.com/nalbam/vibe-monitor/main"

# Files to download for each platform
CLAUDE_FILES = [
    "config/claude/statusline.py",
    "config/claude/hooks/vibe-monitor.py",
    "config/claude/settings.json",
    "config/claude/skills/vibemon-lock/SKILL.md",
    "config/claude/skills/vibemon-mode/SKILL.md",
]

KIRO_FILES = [
    "config/kiro/hooks/vibe-monitor.py",
    "config/kiro/hooks/vibe-monitor-prompt-submit.kiro.hook",
    "config/kiro/hooks/vibe-monitor-file-created.kiro.hook",
    "config/kiro/hooks/vibe-monitor-file-edited.kiro.hook",
    "config/kiro/hooks/vibe-monitor-file-deleted.kiro.hook",
    "config/kiro/hooks/vibe-monitor-agent-stop.kiro.hook",
]


def colored(text: str, color: str) -> str:
    """Return colored text for terminal output."""
    colors = {
        "red": "\033[91m",
        "green": "\033[92m",
        "yellow": "\033[93m",
        "blue": "\033[94m",
        "cyan": "\033[96m",
        "reset": "\033[0m",
    }
    return f"{colors.get(color, '')}{text}{colors['reset']}"


def ask_yes_no(question: str, default: bool = True) -> bool:
    """Ask a yes/no question and return the answer."""
    suffix = "[Y/n]" if default else "[y/N]"
    while True:
        answer = input(f"{question} {suffix}: ").strip().lower()
        if not answer:
            return default
        if answer in ("y", "yes"):
            return True
        if answer in ("n", "no"):
            return False
        print("Please answer 'y' or 'n'")


def download_file(url: str) -> str:
    """Download a file from URL and return its content."""
    try:
        with urlopen(url, timeout=30) as response:
            return response.read().decode("utf-8")
    except URLError as e:
        raise RuntimeError(f"Failed to download {url}: {e}")


def show_diff(old_content: str, new_content: str, filename: str) -> bool:
    """Show unified diff between old and new content. Returns True if different."""
    old_lines = old_content.splitlines(keepends=True)
    new_lines = new_content.splitlines(keepends=True)

    diff = list(difflib.unified_diff(
        old_lines, new_lines,
        fromfile=f"existing {filename}",
        tofile=f"new {filename}",
        lineterm=""
    ))

    if not diff:
        return False

    print(f"\n  {colored('Diff:', 'yellow')}")
    for line in diff[:50]:
        line = line.rstrip("\n")
        if line.startswith("+") and not line.startswith("+++"):
            print(f"    {colored(line, 'green')}")
        elif line.startswith("-") and not line.startswith("---"):
            print(f"    {colored(line, 'red')}")
        elif line.startswith("@@"):
            print(f"    {colored(line, 'cyan')}")
        else:
            print(f"    {line}")

    if len(diff) > 50:
        print(f"    {colored(f'... ({len(diff) - 50} more lines)', 'yellow')}")

    return True


def write_file(dst: Path, content: str, description: str) -> bool:
    """Write content to a file."""
    try:
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(content)
        print(f"  {colored('✓', 'green')} {description}")
        return True
    except Exception as e:
        print(f"  {colored('✗', 'red')} {description}: {e}")
        return False


def write_file_with_diff(dst: Path, content: str, description: str) -> bool:
    """Write content to a file, showing diff if it already exists."""
    try:
        dst.parent.mkdir(parents=True, exist_ok=True)

        if dst.exists():
            old_content = dst.read_text()

            if old_content == content:
                print(f"  {colored('✓', 'green')} {description} (no changes)")
                return True

            print(f"\n  {colored('!', 'yellow')} {description} already exists")
            has_diff = show_diff(old_content, content, dst.name)

            if has_diff:
                if ask_yes_no(f"  Overwrite {description}?"):
                    dst.write_text(content)
                    print(f"  {colored('✓', 'green')} {description} (updated)")
                    return True
                else:
                    print(f"  {colored('!', 'yellow')} {description} (skipped)")
                    return False
        else:
            dst.write_text(content)
            print(f"  {colored('✓', 'green')} {description}")
            return True

    except Exception as e:
        print(f"  {colored('✗', 'red')} {description}: {e}")
        return False


def get_hook_commands(hook_entries: list) -> set:
    """Extract all command strings from hook entries."""
    commands = set()
    for entry in hook_entries:
        if "hooks" in entry:
            for hook in entry.get("hooks", []):
                if "command" in hook:
                    commands.add(hook["command"])
        elif "command" in entry:
            commands.add(entry["command"])
    return commands


def merge_hooks(existing: dict, new_hooks: dict) -> dict:
    """Merge new hooks into existing hooks configuration."""
    result = {}

    for event, new_entries in new_hooks.items():
        if event not in existing:
            result[event] = new_entries
        else:
            existing_entries = existing[event]
            existing_cmds = get_hook_commands(existing_entries)
            result[event] = existing_entries.copy()

            for new_entry in new_entries:
                new_cmds = get_hook_commands([new_entry])
                if not new_cmds.intersection(existing_cmds):
                    result[event].append(new_entry)

    for event in existing:
        if event not in result:
            result[event] = existing[event]

    return result


class FileSource:
    """Abstract file source for local or remote files."""

    def __init__(self, local_dir: Path = None):
        self.local_dir = local_dir
        self.is_online = local_dir is None or not (local_dir / "config").exists()

    def get_file(self, path: str) -> str:
        """Get file content from local or remote source."""
        if self.is_online:
            url = f"{GITHUB_RAW_BASE}/{path}"
            return download_file(url)
        else:
            return (self.local_dir / path).read_text()


def install_claude(source: FileSource) -> bool:
    """Install Vibe Monitor for Claude Code."""
    print(f"\n{colored('Installing Vibe Monitor for Claude Code...', 'cyan')}\n")

    claude_home = Path.home() / ".claude"
    claude_home.mkdir(parents=True, exist_ok=True)
    (claude_home / "hooks").mkdir(parents=True, exist_ok=True)
    (claude_home / "skills").mkdir(parents=True, exist_ok=True)

    print("Copying files:")

    # statusline.py
    content = source.get_file("config/claude/statusline.py")
    write_file_with_diff(claude_home / "statusline.py", content, "statusline.py")

    # hooks/vibe-monitor.py
    content = source.get_file("config/claude/hooks/vibe-monitor.py")
    write_file_with_diff(claude_home / "hooks" / "vibe-monitor.py", content, "hooks/vibe-monitor.py")

    # skills
    for skill in ["vibemon-lock", "vibemon-mode"]:
        content = source.get_file(f"config/claude/skills/{skill}/SKILL.md")
        skill_dir = claude_home / "skills" / skill
        skill_dir.mkdir(parents=True, exist_ok=True)
        write_file(skill_dir / "SKILL.md", content, f"skills/{skill}/SKILL.md")

    # Handle .env.local
    env_content = source.get_file("config/claude/.env.example")
    env_local = claude_home / ".env.local"
    if not env_local.exists():
        print()
        if ask_yes_no("Create .env.local from .env.example?"):
            write_file(env_local, env_content, ".env.local")
    else:
        print()
        write_file_with_diff(env_local, env_content, ".env.local")

    # Handle settings.json
    print("\nConfiguring settings.json:")
    settings_file = claude_home / "settings.json"
    new_settings = json.loads(source.get_file("config/claude/settings.json"))

    if settings_file.exists():
        try:
            existing_settings = json.loads(settings_file.read_text())
        except json.JSONDecodeError:
            existing_settings = {}

        if "hooks" in existing_settings:
            existing_settings["hooks"] = merge_hooks(
                existing_settings["hooks"], new_settings["hooks"]
            )
        else:
            existing_settings["hooks"] = new_settings["hooks"]

        if "statusLine" in existing_settings:
            existing_cmd = existing_settings["statusLine"].get("command", "")
            new_cmd = new_settings["statusLine"].get("command", "")
            if existing_cmd != new_cmd:
                print(f"\n  Current statusLine: {colored(existing_cmd, 'yellow')}")
                print(f"  New statusLine:     {colored(new_cmd, 'cyan')}")
                if ask_yes_no("Replace statusLine?"):
                    existing_settings["statusLine"] = new_settings["statusLine"]
                    print(f"  {colored('✓', 'green')} statusLine updated")
                else:
                    print(f"  {colored('!', 'yellow')} statusLine unchanged")
            else:
                print(f"  {colored('✓', 'green')} statusLine already configured")
        else:
            existing_settings["statusLine"] = new_settings["statusLine"]
            print(f"  {colored('✓', 'green')} statusLine added")

        settings_file.write_text(json.dumps(existing_settings, indent=2) + "\n")
        print(f"  {colored('✓', 'green')} hooks merged into settings.json")
    else:
        settings_file.write_text(json.dumps(new_settings, indent=2) + "\n")
        print(f"  {colored('✓', 'green')} settings.json created")

    print(f"\n{colored('Claude Code installation complete!', 'green')}")
    return True


def install_kiro(source: FileSource) -> bool:
    """Install Vibe Monitor for Kiro IDE."""
    print(f"\n{colored('Installing Vibe Monitor for Kiro IDE...', 'cyan')}\n")

    kiro_home = Path.home() / ".kiro"
    kiro_home.mkdir(parents=True, exist_ok=True)
    (kiro_home / "hooks").mkdir(parents=True, exist_ok=True)

    print("Copying files:")

    # Hook files
    hook_files = [
        "vibe-monitor-prompt-submit.kiro.hook",
        "vibe-monitor-file-created.kiro.hook",
        "vibe-monitor-file-edited.kiro.hook",
        "vibe-monitor-file-deleted.kiro.hook",
        "vibe-monitor-agent-stop.kiro.hook",
    ]
    for hook_file in hook_files:
        content = source.get_file(f"config/kiro/hooks/{hook_file}")
        write_file(kiro_home / "hooks" / hook_file, content, f"hooks/{hook_file}")

    # vibe-monitor.py
    content = source.get_file("config/kiro/hooks/vibe-monitor.py")
    write_file_with_diff(kiro_home / "hooks" / "vibe-monitor.py", content, "hooks/vibe-monitor.py")

    # Handle .env.local
    env_content = source.get_file("config/kiro/.env.example")
    env_local = kiro_home / ".env.local"
    if not env_local.exists():
        print()
        if ask_yes_no("Create .env.local from .env.example?"):
            write_file(env_local, env_content, ".env.local")
    else:
        print()
        write_file_with_diff(env_local, env_content, ".env.local")

    print(f"\n{colored('Kiro IDE installation complete!', 'green')}")
    return True


def main():
    """Main entry point."""
    # Determine if running locally or online
    script_path = Path(__file__).parent.resolve() if "__file__" in dir() else None
    source = FileSource(script_path)

    mode = "online" if source.is_online else "local"

    print(f"\n{colored('╔════════════════════════════════════════╗', 'cyan')}")
    print(f"{colored('║', 'cyan')}   Vibe Monitor Installation Script    {colored('║', 'cyan')}")
    print(f"{colored('╚════════════════════════════════════════╝', 'cyan')}")
    print(f"  Mode: {colored(mode, 'yellow')}")

    # Select platform
    print("\nSelect platform to install:")
    print(f"  {colored('1)', 'cyan')} Claude Code")
    print(f"  {colored('2)', 'cyan')} Kiro IDE")
    print(f"  {colored('3)', 'cyan')} Both")
    print(f"  {colored('q)', 'cyan')} Quit")

    while True:
        choice = input("\nYour choice [1/2/3/q]: ").strip().lower()
        if choice in ("1", "claude"):
            install_claude(source)
            break
        elif choice in ("2", "kiro"):
            install_kiro(source)
            break
        elif choice in ("3", "both"):
            install_claude(source)
            install_kiro(source)
            break
        elif choice in ("q", "quit", "exit"):
            print("\nInstallation cancelled.")
            sys.exit(0)
        else:
            print("Please enter 1, 2, 3, or q")

    print(f"\n{colored('Done!', 'green')} Restart Claude Code or Kiro to apply changes.\n")


if __name__ == "__main__":
    main()
