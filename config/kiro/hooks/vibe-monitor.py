#!/usr/bin/env python3
"""
Vibe Monitor Hook for Kiro IDE
Desktop App + ESP32 (USB Serial / HTTP)
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
    env_file = Path.home() / ".kiro" / ".env.local"
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

# ============================================================================
# State Functions
# ============================================================================

def get_state(event_type):
    """Map event type to state."""
    state_map = {
        "agentSpawn": "start",
        "promptSubmit": "thinking",
        "userPromptSubmit": "thinking",
        "fileCreated": "working",
        "fileDeleted": "working",
        "fileEdited": "working",
        "preToolUse": "working",
        "agentStop": "done",
        "stop": "done",
    }
    return state_map.get(event_type, "working")

def build_payload(state, project, event=None):
    """Build JSON payload for sending to monitor."""
    payload = {
        "state": state,
        "project": project,
        "character": "kiro"
    }
    if event:
        payload["tool"] = event
    return json.dumps(payload)

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
    # Check for command modes (--lock, --unlock, etc.)
    if len(sys.argv) > 1 and sys.argv[1].startswith("--"):
        cmd = sys.argv[1]
        args = sys.argv[2:]
        result = handle_command(cmd, args)
        if result is not None:
            sys.exit(0 if result else 1)

    # Get event type from command line
    event_type = sys.argv[1] if len(sys.argv) > 1 else ""

    if not event_type:
        debug_log("No event type provided")
        sys.exit(0)

    # Get state from event type
    state = get_state(event_type)

    # Get project name from current directory
    project_name = os.path.basename(os.getcwd())

    debug_log(f"Event: {event_type}, State: {state}, Project: {project_name}")

    # Build payload (include event as tool)
    payload = build_payload(state, project_name, event_type)
    debug_log(f"Payload: {payload}")

    # Check if start event (promptSubmit is typically the first event)
    is_start = event_type == "promptSubmit"

    send_to_all(payload, is_start)

if __name__ == "__main__":
    main()
    sys.exit(0)
