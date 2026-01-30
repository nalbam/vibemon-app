#!/usr/bin/env python3
"""
Vibe Monitor Hook for Claude Code
Desktop App + ESP32 (USB Serial / HTTP)
Note: Model and Memory are read from statusline.py's cache file
"""

import glob
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
                if not line or line.startswith("#"):
                    continue
                if line.startswith("export "):
                    line = line[7:]
                if "=" in line:
                    key, _, value = line.partition("=")
                    value = value.strip().strip('"').strip("'")
                    if value.startswith("~"):
                        value = str(Path.home()) + value[1:]
                    os.environ.setdefault(key.strip(), value)

load_env()

# ============================================================================
# Configuration
# ============================================================================

DEBUG = os.environ.get("DEBUG", "0") == "1"

# Error messages
ERR_NO_TARGET = '{"error":"No monitor target available. Set VIBEMON_DESKTOP_URL, VIBEMON_ESP32_URL, or VIBEMON_SERIAL_PORT"}'
ERR_NO_ESP32 = '{"error":"No ESP32 target available. Set VIBEMON_ESP32_URL or VIBEMON_SERIAL_PORT"}'
ERR_INVALID_MODE = '{"error":"Invalid mode: %s. Valid modes: first-project, on-thinking"}'

VALID_LOCK_MODES = ["first-project", "on-thinking"]

# ============================================================================
# Utility Functions
# ============================================================================

def debug_log(msg):
    """Print debug message to stderr."""
    if DEBUG:
        print(f"[DEBUG] {msg}", file=sys.stderr)

def get_config():
    """Get configuration from environment variables."""
    return {
        "desktop_url": os.environ.get("VIBEMON_DESKTOP_URL"),
        "esp32_url": os.environ.get("VIBEMON_ESP32_URL"),
        "serial_port": os.environ.get("VIBEMON_SERIAL_PORT"),
        "cache_path": os.path.expanduser(
            os.environ.get("VIBEMON_CACHE_PATH", "~/.claude/statusline-cache.json")
        ),
    }

def resolve_serial_port(port_pattern):
    """Resolve serial port pattern with wildcard support."""
    if not port_pattern:
        return None

    if '*' in port_pattern:
        matches = sorted(glob.glob(port_pattern))
        if matches:
            debug_log(f"Found serial ports: {matches}, using: {matches[0]}")
            return matches[0]
        debug_log(f"No serial port found matching: {port_pattern}")
        return None

    return port_pattern

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

def get_project_name(cwd, transcript_path):
    """Extract project name from cwd or transcript path."""
    if cwd:
        return os.path.basename(cwd)
    if transcript_path:
        return os.path.basename(os.path.dirname(transcript_path))
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

    if permission_mode == "plan" and state in ("thinking", "working"):
        return "planning"

    return state

def get_project_metadata(project):
    """Get model and memory from cache for a project."""
    if not project:
        return {}

    config = get_config()
    cache_path = config["cache_path"]

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

    terminal_id = ""
    iterm_session = os.environ.get("ITERM_SESSION_ID")
    ghostty_pid = os.environ.get("GHOSTTY_PID")

    if iterm_session:
        terminal_id = "iterm2:" + iterm_session
    elif ghostty_pid:
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
# Low-Level Send Functions
# ============================================================================

def send_serial(port, data):
    """Send data via serial port."""
    if not os.path.exists(port):
        return False

    try:
        flag = "-f" if sys.platform == "darwin" else "-F"
        subprocess.run(["stty", flag, port, "115200"], check=False, capture_output=True)

        with open(port, "w") as f:
            f.write(data + "\n")
        return True
    except (IOError, OSError):
        return False

def send_http_post(url, endpoint, data=None):
    """Send HTTP POST request."""
    try:
        full_url = f"{url}{endpoint}"
        if data:
            req = Request(
                full_url,
                data=data.encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
        else:
            req = Request(full_url, method="POST")

        with urlopen(req, timeout=5) as response:
            return True, response.read().decode("utf-8")
    except (URLError, TimeoutError, OSError):
        return False, None

def send_http_get(url, endpoint):
    """Send HTTP GET request."""
    try:
        with urlopen(f"{url}{endpoint}", timeout=5) as response:
            return True, response.read().decode("utf-8")
    except (URLError, TimeoutError, OSError):
        return False, None

# ============================================================================
# Target Resolution
# ============================================================================

def try_http_targets(endpoint, data=None, method="POST", include_desktop=True):
    """Try HTTP targets (Desktop → ESP32) in order.

    Returns: (success, result_text)
    """
    config = get_config()

    # Try Desktop App
    if include_desktop and config["desktop_url"]:
        debug_log(f"Trying Desktop App: {config['desktop_url']}")
        if method == "POST":
            success, result = send_http_post(config["desktop_url"], endpoint, data)
        else:
            success, result = send_http_get(config["desktop_url"], endpoint)
        if success:
            return True, result

    # Try ESP32 HTTP
    if config["esp32_url"]:
        debug_log(f"Trying ESP32 HTTP: {config['esp32_url']}")
        if method == "POST":
            success, result = send_http_post(config["esp32_url"], endpoint, data)
        else:
            success, result = send_http_get(config["esp32_url"], endpoint)
        if success:
            return True, result

    return False, None

def try_serial_target(command_data):
    """Try Serial target.

    Returns: (success, resolved_port)
    """
    config = get_config()

    if not config["serial_port"]:
        return False, None

    resolved_port = resolve_serial_port(config["serial_port"])
    if not resolved_port:
        return False, None

    debug_log(f"Trying Serial: {resolved_port}")
    if send_serial(resolved_port, command_data):
        return True, resolved_port

    return False, None

def try_all_targets(endpoint, http_data, serial_command, include_desktop=True):
    """Try all targets: Desktop → ESP32 HTTP → Serial.

    Returns: (success, result_text or None)
    """
    # Try HTTP targets first
    success, result = try_http_targets(endpoint, http_data, "POST", include_desktop)
    if success:
        return True, result

    # Try Serial
    success, _ = try_serial_target(serial_command)
    if success:
        return True, None  # Serial doesn't return response

    return False, None

# ============================================================================
# Command Functions
# ============================================================================

def send_lock(project):
    """Lock the monitor to a specific project."""
    debug_log(f"Locking project: {project}")

    http_data = json.dumps({"project": project})
    serial_data = json.dumps({"command": "lock", "project": project})

    success, result = try_all_targets("/lock", http_data, serial_data)

    if success:
        if result:
            print(result)
        else:
            print(f'{{"success":true,"locked":"{project}"}}')
        return True

    debug_log("No monitor target available")
    print(ERR_NO_TARGET)
    return False

def send_unlock():
    """Unlock the monitor."""
    debug_log("Unlocking")

    serial_data = json.dumps({"command": "unlock"})

    success, result = try_all_targets("/unlock", None, serial_data)

    if success:
        if result:
            print(result)
        else:
            print('{"success":true,"locked":null}')
        return True

    debug_log("No monitor target available")
    print(ERR_NO_TARGET)
    return False

def get_status():
    """Get current status from monitor."""
    # Try HTTP targets
    success, result = try_http_targets("/status", method="GET")
    if success:
        print(result)
        return True

    # Try Serial (can't read response)
    serial_data = json.dumps({"command": "status"})
    success, _ = try_serial_target(serial_data)
    if success:
        print('{"info":"Status command sent via serial. Check device output."}')
        return True

    debug_log("No monitor target available")
    print(ERR_NO_TARGET)
    return False

def get_lock_mode():
    """Get current lock mode from monitor."""
    # Try HTTP targets
    success, result = try_http_targets("/lock-mode", method="GET")
    if success:
        print(result)
        return True

    # Try Serial (can't read response)
    serial_data = json.dumps({"command": "lock-mode"})
    success, _ = try_serial_target(serial_data)
    if success:
        print('{"info":"Lock-mode command sent via serial. Check device output."}')
        return True

    debug_log("No monitor target available")
    print(ERR_NO_TARGET)
    return False

def set_lock_mode(mode):
    """Set lock mode on monitor."""
    if mode not in VALID_LOCK_MODES:
        print(ERR_INVALID_MODE % mode)
        return False

    debug_log(f"Setting lock mode: {mode}")

    http_data = json.dumps({"mode": mode})
    serial_data = json.dumps({"command": "lock-mode", "mode": mode})

    success, result = try_all_targets("/lock-mode", http_data, serial_data)

    if success:
        if result:
            print(result)
        else:
            print(f'{{"success":true,"lockMode":"{mode}"}}')
        return True

    debug_log("No monitor target available")
    print(ERR_NO_TARGET)
    return False

def send_reboot():
    """Reboot the ESP32 device."""
    debug_log("Rebooting ESP32")

    serial_data = json.dumps({"command": "reboot"})

    # ESP32 only - don't include Desktop
    success, result = try_all_targets("/reboot", None, serial_data, include_desktop=False)

    if success:
        if result:
            print(result)
        else:
            print('{"success":true,"rebooting":true}')
        return True

    debug_log("No ESP32 target available")
    print(ERR_NO_ESP32)
    return False

# ============================================================================
# Send to All Targets (for status updates)
# ============================================================================

def is_monitor_running(url):
    """Check if monitor is running."""
    success, _ = send_http_get(url, "/health")
    return success

def show_monitor_window(url):
    """Show the monitor window."""
    send_http_post(url, "/show")

def get_user_shell():
    """Get user's login shell."""
    shell = os.environ.get("SHELL")
    if shell:
        return shell

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

def send_to_all(payload, is_start=False):
    """Send payload to all configured targets."""
    config = get_config()

    # Launch Desktop App if not running (on start)
    if config["desktop_url"] and is_start:
        if not is_monitor_running(config["desktop_url"]):
            debug_log("Desktop App not running, launching...")
            launch_desktop()

    # Send to Desktop App via HTTP
    if config["desktop_url"]:
        debug_log(f"Trying Desktop App: {config['desktop_url']}")
        if is_start:
            show_monitor_window(config["desktop_url"])
        success, _ = send_http_post(config["desktop_url"], "/status", payload)
        debug_log("Sent to Desktop App" if success else "Desktop App failed")

    # Send to ESP32 USB Serial
    if config["serial_port"]:
        resolved_port = resolve_serial_port(config["serial_port"])
        if resolved_port:
            debug_log(f"Trying USB serial: {resolved_port}")
            if send_serial(resolved_port, payload):
                debug_log("Sent via USB serial")
            else:
                debug_log("USB serial failed")
        else:
            debug_log(f"No serial port found for pattern: {config['serial_port']}")

    # Send to ESP32 HTTP
    if config["esp32_url"]:
        debug_log(f"Trying ESP32 HTTP: {config['esp32_url']}")
        success, _ = send_http_post(config["esp32_url"], "/status", payload)
        debug_log("Sent via ESP32 HTTP" if success else "ESP32 HTTP failed")

# ============================================================================
# Main
# ============================================================================

def handle_command(cmd, args):
    """Handle CLI command."""
    if cmd == "--lock":
        project = args[0] if args else os.path.basename(os.getcwd())
        return send_lock(project)
    elif cmd == "--unlock":
        return send_unlock()
    elif cmd == "--status":
        return get_status()
    elif cmd == "--lock-mode":
        if args:
            return set_lock_mode(args[0])
        return get_lock_mode()
    elif cmd == "--reboot":
        return send_reboot()
    return None

def main():
    """Main entry point."""
    # Check for command modes
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        args = sys.argv[2:]
        result = handle_command(cmd, args)
        if result is not None:
            sys.exit(0 if result else 1)

    # Read and parse input
    input_data = read_input()

    event_name = parse_json_field(input_data, "hook_event_name", "Unknown")
    tool_name = parse_json_field(input_data, "tool_name", "")
    cwd = parse_json_field(input_data, "cwd", "")
    transcript_path = parse_json_field(input_data, "transcript_path", "")
    permission_mode = parse_json_field(input_data, "permission_mode", "default")

    project_name = get_project_name(cwd, transcript_path)
    state = get_state(event_name, permission_mode)

    debug_log(f"Event: {event_name}, Tool: {tool_name}, Project: {project_name}")

    payload = build_payload(state, tool_name, project_name)
    debug_log(f"Payload: {payload}")

    is_start = event_name == "SessionStart"
    send_to_all(payload, is_start)

if __name__ == "__main__":
    main()
    sys.exit(0)
