#!/usr/bin/env python3
"""
Claude Code Statusline Hook
Displays status line and sends context usage to VibeMon
"""

from __future__ import annotations

import fcntl
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

# ============================================================================
# Environment Loading
# ============================================================================

def load_env() -> None:
    """Load environment variables from .env.local file."""
    env_file = Path.home() / ".claude" / ".env.local"
    if not env_file.exists():
        return

    with open(env_file) as f:
        for line in f:
            line = line.strip()
            # Skip comments and empty lines
            if not line or line.startswith("#"):
                continue
            # Remove 'export ' prefix if present
            if line.startswith("export "):
                line = line[7:]
            if "=" in line:
                key, _, value = line.partition("=")
                # Remove quotes if present
                value = value.strip().strip('"').strip("'")
                # Expand ~ to home directory
                if value.startswith("~"):
                    value = str(Path.home()) + value[1:]
                os.environ.setdefault(key.strip(), value)

load_env()

DEBUG = os.environ.get("DEBUG", "0") == "1"
VIBE_MONITOR_MAX_PROJECTS = 10

# Lock file timeout constants
LOCK_TIMEOUT_SECONDS = 5
LOCK_RETRY_INTERVAL = 0.05

# ============================================================================
# Utility Functions
# ============================================================================

def read_input() -> str:
    """Read input from stdin."""
    return sys.stdin.read()

def parse_json(data: str) -> dict[str, Any]:
    """Parse JSON string to dictionary."""
    try:
        return json.loads(data)
    except (json.JSONDecodeError, TypeError):
        return {}

def get_nested_value(obj: dict[str, Any], field: str, default: Any = "") -> Any:
    """Get nested value from dictionary using dot notation."""
    keys = field.strip(".").split(".")
    for key in keys:
        if isinstance(obj, dict):
            obj = obj.get(key, default)
        else:
            return default
    return obj if obj is not None else default

# ============================================================================
# Git Functions
# ============================================================================

# Branch emoji mapping based on branch name prefix
BRANCH_EMOJIS = {
    "main": "🌿",
    "master": "🌿",
    "develop": "🌱",
    "development": "🌱",
    "dev": "🌱",
    "feature": "✨",
    "feat": "✨",
    "fix": "🐛",
    "bugfix": "🐛",
    "hotfix": "🔥",
    "release": "📦",
    "chore": "🧹",
    "refactor": "♻️",
    "docs": "📝",
    "doc": "📝",
    "test": "🧪",
    "experiment": "🧪",
    "exp": "🧪",
}

def get_branch_emoji(branch: str) -> str:
    """Get emoji for branch based on name or prefix."""
    if not branch:
        return "🌿"

    branch_lower = branch.lower()

    # Check exact match first (main, master, develop, etc.)
    if branch_lower in BRANCH_EMOJIS:
        return BRANCH_EMOJIS[branch_lower]

    # Check prefix match (feature/xxx, fix/xxx, etc.)
    if "/" in branch_lower:
        prefix = branch_lower.split("/", 1)[0]
        if prefix in BRANCH_EMOJIS:
            return BRANCH_EMOJIS[prefix]

    # Default emoji
    return "🌿"

def get_git_info(directory: str) -> str:
    """Get git branch and status information.

    Optimized to use single git command with status --porcelain --branch
    which provides both branch name and change status in one call.
    """
    if not directory:
        return ""

    try:
        # Single git command: get branch and status in one call
        # --porcelain=v1 --branch gives: "## branch...tracking" as first line
        # followed by changed files (if any)
        result = subprocess.run(
            ["git", "-C", directory, "status", "--porcelain=v1", "--branch"],
            capture_output=True,
            text=True,
            timeout=2
        )
        if result.returncode != 0:
            return ""

        lines = result.stdout.splitlines()
        if not lines:
            return ""

        # Parse branch from first line: "## branch" or "## branch...origin/branch"
        header = lines[0]
        if not header.startswith("## "):
            return ""

        branch_part = header[3:]  # Remove "## "
        # Handle "branch...origin/branch [ahead 1]" format
        branch = branch_part.split("...")[0].split()[0]

        if not branch or branch == "HEAD":
            # Detached HEAD state
            return ""

        # Check if there are any changes (lines after the header)
        has_changes = len(lines) > 1

        if has_changes:
            return f" git:({branch} *)"
        return f" git:({branch})"

    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return ""

# ============================================================================
# Context Window Functions
# ============================================================================

def get_context_usage(data: dict[str, Any]) -> str:
    """Calculate context window usage percentage.

    Args:
        data: Pre-parsed JSON dictionary
    """
    context_window = data.get("context_window", {})
    if not isinstance(context_window, dict):
        return ""

    # Try pre-calculated percentage first
    used_pct = context_window.get("used_percentage", 0)

    if used_pct and used_pct != "null":
        try:
            pct = float(used_pct)
            if pct > 0:
                return f"{int(pct)}%"
        except (ValueError, TypeError):
            pass

    # Fallback: calculate from current_usage
    try:
        context_size = int(context_window.get("context_window_size", 0) or 0)
        if context_size <= 0:
            return ""

        current_usage = context_window.get("current_usage", {})
        if not isinstance(current_usage, dict):
            return ""

        input_tokens = int(current_usage.get("input_tokens", 0) or 0)
        cache_creation = int(current_usage.get("cache_creation_input_tokens", 0) or 0)
        cache_read = int(current_usage.get("cache_read_input_tokens", 0) or 0)

        current_tokens = input_tokens + cache_creation + cache_read
        if current_tokens > 0:
            return f"{current_tokens * 100 // context_size}%"
    except (ValueError, TypeError):
        pass

    return ""

# ============================================================================
# VibeMon Cache Functions
# ============================================================================

def get_cache_path() -> str:
    """Get the cache file path."""
    cache_path = os.environ.get("VIBEMON_CACHE_PATH", "~/.claude/statusline-cache.json")
    return os.path.expanduser(cache_path)

def save_to_cache(project: str, model: str, memory: int) -> None:
    """Save project metadata to cache file.

    Uses fcntl for proper file locking to avoid race conditions.
    """
    if not project:
        return

    cache_path = get_cache_path()
    cache_dir = os.path.dirname(cache_path)

    # Ensure cache directory exists
    os.makedirs(cache_dir, exist_ok=True)

    lockfile = f"{cache_path}.lock"
    timestamp = int(time.time())
    lock_fd = None

    try:
        # Use fcntl for proper file locking (atomic, no race condition)
        lock_fd = os.open(lockfile, os.O_CREAT | os.O_WRONLY, 0o644)

        # Try to acquire lock with timeout
        start_time = time.monotonic()
        while True:
            try:
                fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break  # Lock acquired
            except (IOError, OSError):
                if time.monotonic() - start_time > LOCK_TIMEOUT_SECONDS:
                    return  # Timeout - skip cache update
                time.sleep(LOCK_RETRY_INTERVAL)

        # Read existing cache or create empty object
        cache: dict[str, Any] = {}
        if os.path.exists(cache_path):
            try:
                with open(cache_path) as f:
                    cache = json.load(f)
            except (json.JSONDecodeError, IOError):
                cache = {}

        # If new project and cache is full, remove oldest to make room
        if project not in cache and len(cache) >= VIBE_MONITOR_MAX_PROJECTS:
            # Sort by timestamp and remove oldest
            sorted_items = sorted(
                cache.items(),
                key=lambda x: x[1].get("ts", 0) if isinstance(x[1], dict) else 0,
                reverse=True
            )
            cache = dict(sorted_items[:VIBE_MONITOR_MAX_PROJECTS - 1])

        # Update cache with new project data
        cache[project] = {
            "model": model,
            "memory": memory,
            "ts": timestamp
        }

        # Atomic write: write to temp file, then rename
        tmpfile = f"{cache_path}.tmp.{os.getpid()}"
        with open(tmpfile, "w") as f:
            json.dump(cache, f)
        os.replace(tmpfile, cache_path)  # os.replace is atomic on POSIX

    except (IOError, OSError):
        pass
    finally:
        if lock_fd is not None:
            try:
                fcntl.flock(lock_fd, fcntl.LOCK_UN)
                os.close(lock_fd)
            except OSError:
                pass

# ============================================================================
# ANSI Colors
# ============================================================================

C_RESET = "\033[0m"
C_BOLD = "\033[1m"
C_DIM = "\033[2m"
C_CYAN = "\033[36m"
C_GREEN = "\033[32m"
C_YELLOW = "\033[33m"
C_RED = "\033[31m"
C_MAGENTA = "\033[35m"
C_BLUE = "\033[34m"
C_ORANGE = "\033[38;5;208m"

# ============================================================================
# Formatting Functions
# ============================================================================

def format_number(num: int | float | str | None) -> str:
    """Format number with K/M suffix."""
    if num is None or num == "null" or num == 0:
        return "0"

    try:
        num_float = float(num)
        int_num = int(num_float)

        if int_num >= 1_000_000:
            return f"{num_float / 1_000_000:.1f}M"
        if int_num >= 1_000:
            return f"{num_float / 1_000:.1f}K"
        return str(int_num)
    except (ValueError, TypeError):
        return "0"


def format_duration(ms: int | float | str | None) -> str:
    """Format duration in milliseconds to human readable format."""
    if ms is None or ms == "null" or ms == 0:
        return "0s"

    try:
        total_seconds = int(ms) // 1000
        hours, remainder = divmod(total_seconds, 3600)
        minutes, seconds = divmod(remainder, 60)

        if hours > 0:
            return f"{hours}h{minutes}m"
        if minutes > 0:
            return f"{minutes}m{seconds}s"
        return f"{seconds}s"
    except (ValueError, TypeError):
        return "0s"


def format_cost(cost: float | str | None) -> str:
    """Format cost in USD."""
    if cost is None or cost == "null":
        return "$0.00"

    try:
        return f"${float(cost):.2f}"
    except (ValueError, TypeError):
        return "$0.00"

# ============================================================================
# Progress Bar Functions
# ============================================================================

def build_progress_bar(percent_str: str | int | float, width: int = 10) -> str:
    """Build a colored progress bar.

    Args:
        percent_str: Percentage value (can be "85%", "85", 85, or 85.5)
        width: Bar width in characters
    """
    # Remove % sign if present and convert to string
    cleaned = str(percent_str).rstrip("%").strip()

    if not cleaned:
        return ""

    # Parse as float first to handle "12.5", then convert to int
    try:
        percent = int(float(cleaned))
    except (ValueError, TypeError):
        return ""

    # Clamp to valid range
    percent = max(0, min(100, percent))

    filled = percent * width // 100
    empty = width - filled

    # Color based on usage level
    if percent >= 90:
        color = C_RED
    elif percent >= 75:
        color = C_YELLOW
    else:
        color = C_GREEN

    # Build the bar - filled in color, empty in dim
    filled_bar = "━" * filled
    empty_bar = "╌" * empty

    return f"{color}{filled_bar}{C_RESET}{C_DIM}{empty_bar}{C_RESET} {percent}%"

# ============================================================================
# Statusline Output
# ============================================================================

def build_statusline(
    model: str,
    dir_name: str,
    git_info: str,
    context_usage: str,
    input_tokens: int | str,
    output_tokens: int | str,
    cost: float | str,
    duration: int | str,
    lines_added: int | str,
    lines_removed: int | str,
) -> str:
    """Build the status line string."""
    SEP = " │ "
    parts: list[str] = []

    # Directory (📂 icon)
    parts.append(f"{C_BLUE}📂 {dir_name}{C_RESET}")

    # Git info (emoji based on branch type)
    if git_info:
        # Extract branch and status from " git:(branch *)" format
        branch_info = git_info.replace(" git:(", "").rstrip(")")
        # Get branch name without status indicator for emoji lookup
        branch_name = branch_info.rstrip(" *")
        emoji = get_branch_emoji(branch_name)
        parts.append(f"{C_GREEN}{emoji} {branch_info}{C_RESET}")

    # Model (🤖 icon) - remove "Claude " prefix
    short_model = model.removeprefix("Claude ")
    parts.append(f"{C_MAGENTA}🤖 {short_model}{C_RESET}")

    # Token usage (📥 in / 📤 out)
    if input_tokens and str(input_tokens) != "0":
        in_fmt = format_number(input_tokens)
        out_fmt = format_number(output_tokens)
        parts.append(f"{C_CYAN}📥 {in_fmt} 📤 {out_fmt}{C_RESET}")

    # Cost (💰 icon)
    if cost and str(cost) != "0" and cost != "null":
        cost_fmt = format_cost(cost)
        parts.append(f"{C_YELLOW}💰 {cost_fmt}{C_RESET}")

    # Duration (⏱️ icon)
    if duration and str(duration) != "0" and duration != "null":
        duration_fmt = format_duration(duration)
        parts.append(f"{C_DIM}⏱️ {duration_fmt}{C_RESET}")

    # Lines changed (+/-)
    if lines_added and str(lines_added) != "0":
        lines_part = f"{C_GREEN}+{lines_added}{C_RESET}"
        if lines_removed and str(lines_removed) != "0":
            lines_part += f" {C_RED}-{lines_removed}{C_RESET}"
        parts.append(lines_part)

    # Context usage with progress bar (🧠 icon)
    if context_usage:
        progress_bar = build_progress_bar(context_usage)
        if progress_bar:
            parts.append(f"🧠 {progress_bar}")

    return SEP.join(parts)

# ============================================================================
# Background Cache Save
# ============================================================================

def save_cache_background(project: str, model: str, memory: int) -> None:
    """Save to cache in background process.

    Uses fork on POSIX systems for efficiency, falls back to synchronous
    save on Windows or if fork fails.
    """
    # Check if fork is available (not on Windows)
    if not hasattr(os, "fork"):
        save_to_cache(project, model, memory)
        return

    try:
        pid = os.fork()
        if pid == 0:
            # Child process - save cache and exit
            try:
                save_to_cache(project, model, memory)
            except Exception:
                pass
            os._exit(0)
        # Parent process continues immediately
    except OSError:
        # Fork failed - save synchronously
        save_to_cache(project, model, memory)


# ============================================================================
# Main
# ============================================================================

def main() -> None:
    """Main entry point."""
    input_raw = read_input()

    # Parse JSON once and reuse
    data = parse_json(input_raw)

    # Extract model info
    model_data = data.get("model", {})
    model_display = model_data.get("display_name", "Claude") if isinstance(model_data, dict) else "Claude"

    # Extract workspace info
    workspace_data = data.get("workspace", {})
    current_dir = workspace_data.get("current_dir", "") if isinstance(workspace_data, dict) else ""
    dir_name = os.path.basename(current_dir) if current_dir else ""

    # Get additional info
    git_info = get_git_info(current_dir)
    context_usage = get_context_usage(data)

    # Extract context window data
    context_window = data.get("context_window", {})
    if isinstance(context_window, dict):
        input_tokens = context_window.get("total_input_tokens", 0)
        output_tokens = context_window.get("total_output_tokens", 0)
    else:
        input_tokens = output_tokens = 0

    # Extract cost data
    cost_data = data.get("cost", {})
    if isinstance(cost_data, dict):
        cost = cost_data.get("total_cost_usd", 0)
        duration = cost_data.get("total_duration_ms", 0)
        lines_added = cost_data.get("total_lines_added", 0)
        lines_removed = cost_data.get("total_lines_removed", 0)
    else:
        cost = duration = lines_added = lines_removed = 0

    # Save project metadata to cache in background
    # Convert "85%" to 85, "" to 0
    memory_int = int(context_usage.rstrip("%")) if context_usage else 0
    save_cache_background(dir_name, model_display, memory_int)

    # Output statusline
    print(
        build_statusline(
            model_display,
            dir_name,
            git_info,
            context_usage,
            input_tokens,
            output_tokens,
            cost,
            duration,
            lines_added,
            lines_removed,
        ),
        end="",
    )


if __name__ == "__main__":
    main()
