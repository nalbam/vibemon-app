#!/usr/bin/env python3
"""
Claude Code Statusline Hook
Displays minimal status line: project, model, memory
"""

import json
import os
import sys
import time
from pathlib import Path

# ============================================================================
# Environment Loading
# ============================================================================

def load_env():
    """Load environment variables from .env.local file."""
    env_file = Path.home() / ".claude" / ".env.local"
    if env_file.exists():
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

# ============================================================================
# Utility Functions
# ============================================================================

def read_input():
    """Read input from stdin."""
    return sys.stdin.read()

def parse_json_field(data, field, default=""):
    """Parse a field from JSON data safely."""
    try:
        obj = json.loads(data) if isinstance(data, str) else data
        keys = field.strip(".").split(".")
        for key in keys:
            if isinstance(obj, dict):
                obj = obj.get(key, default)
            else:
                return default
        return obj if obj is not None else default
    except (json.JSONDecodeError, TypeError):
        return default

# ============================================================================
# Context Window Functions
# ============================================================================

def get_context_usage(input_data):
    """Calculate context window usage percentage."""
    # Try pre-calculated percentage first
    used_pct = parse_json_field(input_data, "context_window.used_percentage", 0)

    if used_pct and used_pct != "null" and float(used_pct) > 0:
        return f"{int(float(used_pct))}%"

    # Fallback: calculate from current_usage
    context_size = parse_json_field(input_data, "context_window.context_window_size", 0)

    try:
        context_size = int(context_size)
        if context_size > 0:
            input_tokens = int(parse_json_field(input_data, "context_window.current_usage.input_tokens", 0) or 0)
            cache_creation = int(parse_json_field(input_data, "context_window.current_usage.cache_creation_input_tokens", 0) or 0)
            cache_read = int(parse_json_field(input_data, "context_window.current_usage.cache_read_input_tokens", 0) or 0)

            current_tokens = input_tokens + cache_creation + cache_read
            if current_tokens > 0:
                return f"{current_tokens * 100 // context_size}%"
    except (ValueError, TypeError):
        pass

    return ""

# ============================================================================
# VibeMon Cache Functions
# ============================================================================

def get_cache_path():
    """Get the cache file path."""
    cache_path = os.environ.get("VIBE_MONITOR_CACHE", str(Path.home() / ".claude" / "statusline-cache.json"))
    # Expand ~ to home directory
    if cache_path.startswith("~"):
        cache_path = str(Path.home()) + cache_path[1:]
    return cache_path

def save_to_cache(project, model, memory):
    """Save project metadata to cache file."""
    if not project:
        return

    cache_path = get_cache_path()
    cache_dir = os.path.dirname(cache_path)

    # Ensure cache directory exists
    os.makedirs(cache_dir, exist_ok=True)

    lockfile = f"{cache_path}.lock"
    timestamp = int(time.time())

    # Simple file-based locking
    wait_count = 0
    while os.path.exists(lockfile) and wait_count < 50:
        time.sleep(0.1)
        wait_count += 1

    try:
        # Create lock file
        with open(lockfile, "w") as f:
            f.write(str(os.getpid()))

        # Read existing cache or create empty object
        cache = {}
        if os.path.exists(cache_path):
            try:
                with open(cache_path) as f:
                    cache = json.load(f)
            except (json.JSONDecodeError, IOError):
                cache = {}

        # Update cache with new project data
        cache[project] = {
            "model": model,
            "memory": memory,
            "ts": timestamp
        }

        # Keep only the most recent N projects
        if len(cache) > VIBE_MONITOR_MAX_PROJECTS:
            # Sort by timestamp and keep only recent ones
            sorted_items = sorted(cache.items(), key=lambda x: x[1].get("ts", 0), reverse=True)
            cache = dict(sorted_items[:VIBE_MONITOR_MAX_PROJECTS])

        # Atomic write: write to temp file, then rename
        tmpfile = f"{cache_path}.tmp.{os.getpid()}"
        with open(tmpfile, "w") as f:
            json.dump(cache, f)
        os.rename(tmpfile, cache_path)

    except (IOError, OSError):
        pass
    finally:
        # Remove lock file
        try:
            os.remove(lockfile)
        except OSError:
            pass

# ============================================================================
# ANSI Colors
# ============================================================================

C_RESET = "\033[0m"
C_GREEN = "\033[32m"
C_YELLOW = "\033[33m"
C_RED = "\033[31m"
C_MAGENTA = "\033[35m"
C_BLUE = "\033[34m"

# ============================================================================
# Progress Bar Functions
# ============================================================================

def build_progress_bar(percent_str, width=10):
    """Build a colored progress bar."""
    # Remove % sign if present
    percent_str = percent_str.rstrip("%")

    # Handle empty or invalid input
    if not percent_str or not percent_str.isdigit():
        return ""

    percent = int(percent_str)
    filled = percent * width // 100
    empty = width - filled

    # Color based on usage level
    if percent >= 90:
        color = C_RED
    elif percent >= 75:
        color = C_YELLOW
    else:
        color = C_GREEN

    # Build the bar
    bar = "━" * filled + "╌" * empty

    return f"{color}{bar}{C_RESET} {percent}%"

# ============================================================================
# Statusline Output
# ============================================================================

def build_statusline(model, dir_name, context_usage):
    """Build the status line string."""
    SEP = " │ "
    parts = []

    # Directory (📂 icon)
    parts.append(f"{C_BLUE}📂 {dir_name}{C_RESET}")

    # Model (🤖 icon) - remove "Claude " prefix
    short_model = model.replace("Claude ", "") if model.startswith("Claude ") else model
    parts.append(f"{C_MAGENTA}🤖 {short_model}{C_RESET}")

    # Context usage with progress bar (🧠 icon)
    if context_usage:
        progress_bar = build_progress_bar(context_usage)
        if progress_bar:
            parts.append(f"🧠 {progress_bar}")

    return SEP.join(parts)

# ============================================================================
# Main
# ============================================================================

def main():
    """Main entry point."""
    input_data = read_input()

    # Parse input fields
    model_display = parse_json_field(input_data, "model.display_name", "Claude")
    current_dir = parse_json_field(input_data, "workspace.current_dir", "")

    dir_name = os.path.basename(current_dir) if current_dir else ""

    # Get context usage
    context_usage = get_context_usage(input_data)

    # Save project metadata to cache (vibe-monitor.py will read this)
    # Fork to background to avoid blocking
    pid = os.fork()
    if pid == 0:
        # Child process
        try:
            save_to_cache(dir_name, model_display, context_usage)
        except Exception:
            pass
        os._exit(0)

    # Output statusline
    print(build_statusline(model_display, dir_name, context_usage), end="")

if __name__ == "__main__":
    main()
