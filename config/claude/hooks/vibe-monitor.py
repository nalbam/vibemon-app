#!/usr/bin/env python3
"""
Vibe Monitor Hook for Claude Code
Desktop App + ESP32 (USB Serial / HTTP)
Note: Model and Memory are read from statusline.py's cache file
"""

import json
import os
import sys
import subprocess
import time
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError

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

# ============================================================================
# Utility Functions
# ============================================================================

def debug_log(msg):
    """Print debug message to stderr."""
    if DEBUG:
        print(f"[DEBUG] {msg}", file=sys.stderr)

def read_input():
    """Read input from stdin with timeout handling."""
    try:
        return sys.stdin.read()
    except Exception:
        return ""

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
# State Functions
# ============================================================================

def get_cache_path():
    """Get the cache file path."""
    cache_path = os.environ.get("VIBE_MONITOR_CACHE", str(Path.home() / ".claude" / "statusline-cache.json"))
    # Expand ~ to home directory
    if cache_path.startswith("~"):
        cache_path = str(Path.home()) + cache_path[1:]
    return cache_path

def get_project_name(cwd, transcript_path):
    """Extract project name from cwd or transcript path."""
    if cwd:
        return os.path.basename(cwd)
    if transcript_path:
        return os.path.basename(os.path.dirname(transcript_path))
    # Fallback to current working directory
    return os.path.basename(os.getcwd())

def get_state(event_name, permission_mode="default"):
    """Map event name to state, considering permission mode."""
    state_map = {
        "SessionStart": "start",
        "UserPromptSubmit": "thinking",
        "PreToolUse": "working",
        "Notification": "notification",
        "Stop": "done",
    }
    state = state_map.get(event_name, "working")

    # Override to planning state when in plan mode
    if permission_mode == "plan" and state in ("thinking", "working"):
        return "planning"

    return state

def get_project_metadata(project):
    """Get model and memory from cache for a project."""
    if not project:
        return {}

    cache_path = get_cache_path()
    if not os.path.exists(cache_path):
        return {}

    try:
        with open(cache_path) as f:
            cache = json.load(f)
        return cache.get(project, {})
    except (json.JSONDecodeError, IOError):
        return {}

def build_payload(state, tool, project):
    """Build JSON payload for sending to monitor."""
    metadata = get_project_metadata(project)
    model = metadata.get("model", "")
    memory = metadata.get("memory", "")

    # Terminal session ID (iTerm2 or Ghostty)
    terminal_id = ""
    iterm_session = os.environ.get("ITERM_SESSION_ID")
    ghostty_pid = os.environ.get("GHOSTTY_PID")

    if iterm_session:
        # iTerm2 session ID format: w0t4p0:UUID
        terminal_id = "iterm2:" + iterm_session
    elif ghostty_pid:
        # Ghostty process ID
        terminal_id = "ghostty:" + ghostty_pid

    return json.dumps({
        "state": state,
        "tool": tool,
        "project": project,
        "model": model,
        "memory": memory,
        "character": "clawd",
        "terminalId": terminal_id
    })

# ============================================================================
# Send Functions
# ============================================================================

def send_serial(port, data):
    """Send data via serial port."""
    if not os.path.exists(port):
        return False

    try:
        # Set baud rate using stty
        if sys.platform == "darwin":
            subprocess.run(["stty", "-f", port, "115200"], check=False, capture_output=True)
        else:
            subprocess.run(["stty", "-F", port, "115200"], check=False, capture_output=True)

        with open(port, "w") as f:
            f.write(data + "\n")
        return True
    except (IOError, OSError):
        return False

def send_http(url, data):
    """Send data via HTTP POST."""
    try:
        req = Request(
            f"{url}/status",
            data=data.encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urlopen(req, timeout=5) as response:
            return response.status == 200
    except (URLError, TimeoutError, OSError):
        return False

def is_monitor_running(url):
    """Check if monitor is running."""
    try:
        with urlopen(f"{url}/health", timeout=1):
            return True
    except (URLError, TimeoutError, OSError):
        return False

def show_monitor_window(url):
    """Show the monitor window."""
    try:
        req = Request(f"{url}/show", method="POST")
        with urlopen(req, timeout=1):
            pass
    except (URLError, TimeoutError, OSError):
        pass

def get_user_shell():
    """Get user's login shell from /etc/passwd or SHELL env."""
    # Try SHELL environment variable first
    shell = os.environ.get("SHELL")
    if shell:
        return shell

    # Fallback: read from /etc/passwd
    try:
        import pwd
        return pwd.getpwuid(os.getuid()).pw_shell
    except Exception:
        pass

    return "/bin/sh"

def launch_desktop():
    """Launch Desktop App via npx."""
    debug_log("Launching Desktop App via npx")
    try:
        shell = get_user_shell()
        debug_log(f"Using shell: {shell}")
        subprocess.Popen(
            [shell, "-l", "-c", "npx vibe-monitor@latest"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True
        )
        time.sleep(3)
    except Exception as e:
        debug_log(f"Failed to launch Desktop App: {e}")

# ============================================================================
# Lock/Unlock Functions (Desktop App only)
# ============================================================================

def send_lock(project):
    """Lock the monitor to a specific project."""
    url = os.environ.get("VIBE_MONITOR_URL")
    if not url:
        debug_log("VIBE_MONITOR_URL not set")
        return False

    debug_log(f"Locking project: {project}")
    try:
        data = json.dumps({"project": project})
        req = Request(
            f"{url}/lock",
            data=data.encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urlopen(req, timeout=5):
            return True
    except (URLError, TimeoutError, OSError):
        return False

def send_unlock():
    """Unlock the monitor."""
    url = os.environ.get("VIBE_MONITOR_URL")
    if not url:
        debug_log("VIBE_MONITOR_URL not set")
        return False

    debug_log("Unlocking")
    try:
        req = Request(f"{url}/unlock", method="POST")
        with urlopen(req, timeout=5):
            return True
    except (URLError, TimeoutError, OSError):
        return False

def get_status():
    """Get current status from monitor."""
    url = os.environ.get("VIBE_MONITOR_URL")
    if not url:
        debug_log("VIBE_MONITOR_URL not set")
        return False

    try:
        with urlopen(f"{url}/status", timeout=5) as response:
            print(response.read().decode("utf-8"))
            return True
    except (URLError, TimeoutError, OSError):
        return False

def get_lock_mode():
    """Get current lock mode from monitor."""
    url = os.environ.get("VIBE_MONITOR_URL")
    if not url:
        debug_log("VIBE_MONITOR_URL not set")
        return False

    try:
        with urlopen(f"{url}/lock-mode", timeout=5) as response:
            print(response.read().decode("utf-8"))
            return True
    except (URLError, TimeoutError, OSError):
        return False

def set_lock_mode(mode):
    """Set lock mode on monitor."""
    url = os.environ.get("VIBE_MONITOR_URL")
    if not url:
        debug_log("VIBE_MONITOR_URL not set")
        return False

    valid_modes = ["first-project", "on-thinking"]
    if mode not in valid_modes:
        print(f"Invalid mode: {mode}. Valid modes: {', '.join(valid_modes)}")
        return False

    debug_log(f"Setting lock mode: {mode}")
    try:
        data = json.dumps({"mode": mode})
        req = Request(
            f"{url}/lock-mode",
            data=data.encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urlopen(req, timeout=5) as response:
            print(response.read().decode("utf-8"))
            return True
    except (URLError, TimeoutError, OSError):
        return False

# ============================================================================
# Send to All Targets
# ============================================================================

def send_to_all(payload, is_start=False):
    """Send payload to all configured targets."""
    url = os.environ.get("VIBE_MONITOR_URL")
    serial_port = os.environ.get("ESP32_SERIAL_PORT")
    esp32_url = os.environ.get("ESP32_HTTP_URL")

    # Launch Desktop App if not running (on start)
    if url and is_start:
        if not is_monitor_running(url):
            debug_log("Desktop App not running, launching...")
            launch_desktop()

    # Send to Desktop App via HTTP
    if url:
        debug_log(f"Trying Desktop App: {url}")
        if is_start:
            show_monitor_window(url)
        if send_http(url, payload):
            debug_log("Sent to Desktop App")
        else:
            debug_log("Desktop App failed")

    # Send to ESP32 USB Serial
    if serial_port:
        debug_log(f"Trying USB serial: {serial_port}")
        if send_serial(serial_port, payload):
            debug_log("Sent via USB serial")
        else:
            debug_log("USB serial failed")

    # Send to ESP32 HTTP
    if esp32_url:
        debug_log(f"Trying ESP32 HTTP: {esp32_url}")
        if send_http(esp32_url, payload):
            debug_log("Sent via ESP32 HTTP")
        else:
            debug_log("ESP32 HTTP failed")

# ============================================================================
# Main
# ============================================================================

def main():
    """Main entry point."""
    # Check for command modes
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "--lock":
            project = sys.argv[2] if len(sys.argv) > 2 else os.path.basename(os.getcwd())
            sys.exit(0 if send_lock(project) else 1)
        elif cmd == "--unlock":
            sys.exit(0 if send_unlock() else 1)
        elif cmd == "--status":
            sys.exit(0 if get_status() else 1)
        elif cmd == "--lock-mode":
            if len(sys.argv) > 2:
                sys.exit(0 if set_lock_mode(sys.argv[2]) else 1)
            else:
                sys.exit(0 if get_lock_mode() else 1)

    # Read and parse input
    input_data = read_input()

    event_name = parse_json_field(input_data, "hook_event_name", "Unknown")
    tool_name = parse_json_field(input_data, "tool_name", "")
    cwd = parse_json_field(input_data, "cwd", "")
    transcript_path = parse_json_field(input_data, "transcript_path", "")
    permission_mode = parse_json_field(input_data, "permission_mode", "default")

    # Get project name and state
    project_name = get_project_name(cwd, transcript_path)
    state = get_state(event_name, permission_mode)

    debug_log(f"Event: {event_name}, Tool: {tool_name}, Project: {project_name}")

    # Build payload
    payload = build_payload(state, tool_name, project_name)
    debug_log(f"Payload: {payload}")

    # Check if start event
    is_start = event_name == "SessionStart"

    send_to_all(payload, is_start)

if __name__ == "__main__":
    main()
    sys.exit(0)
