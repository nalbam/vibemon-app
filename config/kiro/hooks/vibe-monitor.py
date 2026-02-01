#!/usr/bin/env python3
"""
Vibe Monitor Hook for Kiro IDE
Desktop App + ESP32 (USB Serial / HTTP)
"""

from __future__ import annotations

import fcntl
import glob
import json
import os
import subprocess
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

# ============================================================================
# Environment Loading
# ============================================================================

def load_env() -> None:
    """Load environment variables from .env.local file."""
    env_file = Path.home() / ".kiro" / ".env.local"
    if not env_file.exists():
        return

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
ERR_NO_TARGET = '{"error":"No monitor target available. Set VIBEMON_HTTP_URLS or VIBEMON_SERIAL_PORT"}'
ERR_NO_ESP32 = '{"error":"No ESP32 target available. Set VIBEMON_HTTP_URLS (with ESP32 URL) or VIBEMON_SERIAL_PORT"}'
ERR_INVALID_MODE = '{"error":"Invalid mode: %s. Valid modes: first-project, on-thinking"}'

VALID_LOCK_MODES = frozenset(["first-project", "on-thinking"])

# Serial configuration
SERIAL_DEBOUNCE_MS = 100
SERIAL_LOCK_MAX_RETRIES = 10
SERIAL_LOCK_RETRY_INTERVAL = 0.05
SERIAL_BAUD_RATE = "115200"

# HTTP configuration
HTTP_TIMEOUT_SECONDS = 5

# Desktop launch configuration
DESKTOP_LAUNCH_WAIT_SECONDS = 3

# Character configuration
CHARACTER = "kiro"


@dataclass(frozen=True)
class Config:
    """Immutable configuration container."""

    http_urls: tuple[str, ...]
    serial_port: str | None
    auto_launch: bool
    vibemon_url: str | None
    vibemon_token: str | None


# Cached configuration (computed once)
_config: Config | None = None


def parse_http_urls(urls_str: str | None) -> tuple[str, ...]:
    """Parse comma-separated HTTP URLs."""
    if not urls_str:
        return ()
    return tuple(url.strip() for url in urls_str.split(",") if url.strip())


def get_config() -> Config:
    """Get configuration from environment variables (cached)."""
    global _config
    if _config is None:
        _config = Config(
            http_urls=parse_http_urls(os.environ.get("VIBEMON_HTTP_URLS")),
            serial_port=os.environ.get("VIBEMON_SERIAL_PORT"),
            auto_launch=os.environ.get("VIBEMON_AUTO_LAUNCH", "0") == "1",
            vibemon_url=os.environ.get("VIBEMON_URL"),
            vibemon_token=os.environ.get("VIBEMON_TOKEN"),
        )
    return _config


# ============================================================================
# Utility Functions
# ============================================================================

def debug_log(msg: str) -> None:
    """Print debug message to stderr."""
    if DEBUG:
        print(f"[DEBUG] {msg}", file=sys.stderr)


def resolve_serial_port(port_pattern: str | None) -> str | None:
    """Resolve serial port pattern with wildcard support."""
    if not port_pattern:
        return None

    if "*" in port_pattern:
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

# Event to state mapping (immutable) - Kiro IDE specific
EVENT_STATE_MAP: dict[str, str] = {
    "agentSpawn": "start",
    "promptSubmit": "thinking",
    "userPromptSubmit": "thinking",
    "fileCreated": "working",
    "fileDeleted": "working",
    "fileEdited": "working",
    "preToolUse": "working",
    "preCompact": "packing",
    "agentStop": "done",
    "stop": "done",
}


def get_state(event_type: str) -> str:
    """Map event type to state."""
    return EVENT_STATE_MAP.get(event_type, "working")


def build_payload(state: str, project: str, event: str | None = None) -> dict[str, Any]:
    """Build payload dict for sending to monitor."""
    payload: dict[str, Any] = {
        "state": state,
        "project": project,
        "character": CHARACTER,
        "tool": event or "",
        "model": "",
        "memory": 0,
    }
    return payload


# ============================================================================
# Low-Level Send Functions
# ============================================================================

def _get_serial_lock_path(port: str) -> str:
    """Get lock file path for serial port."""
    return f"/tmp/vibe-monitor-serial-{port.replace('/', '_')}.lock"


def _get_serial_debounce_path(port: str) -> str:
    """Get debounce file path for serial port."""
    return f"/tmp/vibe-monitor-serial-{port.replace('/', '_')}.debounce"


def _get_serial_debounce_lock_path(port: str) -> str:
    """Get debounce lock file path for serial port."""
    return f"/tmp/vibe-monitor-serial-{port.replace('/', '_')}.dlock"


def _acquire_lock(lock_fd: int, max_retries: int = SERIAL_LOCK_MAX_RETRIES) -> bool:
    """Try to acquire file lock with retries."""
    for attempt in range(max_retries):
        try:
            fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return True
        except BlockingIOError:
            if attempt < max_retries - 1:
                time.sleep(SERIAL_LOCK_RETRY_INTERVAL)
    return False


def send_serial_raw(port: str, data: str) -> bool:
    """Send data via serial port with file locking (internal use)."""
    if not os.path.exists(port):
        return False

    lock_path = _get_serial_lock_path(port)
    lock_fd = None

    try:
        lock_fd = os.open(lock_path, os.O_CREAT | os.O_RDWR)

        if not _acquire_lock(lock_fd):
            debug_log(f"Failed to acquire serial lock after {SERIAL_LOCK_MAX_RETRIES} attempts")
            return False

        try:
            # Configure serial port
            flag = "-f" if sys.platform == "darwin" else "-F"
            subprocess.run(
                ["stty", flag, port, SERIAL_BAUD_RATE],
                check=False,
                capture_output=True,
            )

            # Write data
            with open(port, "w") as f:
                f.write(data + "\n")
                f.flush()

            time.sleep(SERIAL_LOCK_RETRY_INTERVAL)
            return True
        finally:
            fcntl.flock(lock_fd, fcntl.LOCK_UN)

    except (IOError, OSError) as e:
        debug_log(f"Serial send error: {e}")
        return False
    finally:
        if lock_fd is not None:
            try:
                os.close(lock_fd)
            except OSError:
                pass


def send_serial(port: str, data: str) -> bool:
    """Send data via serial port with debouncing.

    Uses a debounce file to coalesce rapid updates. Only the last update
    within the debounce window is actually sent to the serial port.
    """
    if not os.path.exists(port):
        return False

    debounce_path = _get_serial_debounce_path(port)
    lock_path = _get_serial_debounce_lock_path(port)
    my_id = str(uuid.uuid4())

    lock_fd = None
    try:
        # Write our payload to the debounce file (with lock)
        lock_fd = os.open(lock_path, os.O_CREAT | os.O_RDWR)
        fcntl.flock(lock_fd, fcntl.LOCK_EX)
        try:
            with open(debounce_path, "w") as f:
                json.dump({"id": my_id, "data": data, "time": time.time()}, f)
        finally:
            fcntl.flock(lock_fd, fcntl.LOCK_UN)
            os.close(lock_fd)
            lock_fd = None

        # Wait for debounce period
        time.sleep(SERIAL_DEBOUNCE_MS / 1000.0)

        # Check if we're still the latest (with lock)
        lock_fd = os.open(lock_path, os.O_CREAT | os.O_RDWR)
        fcntl.flock(lock_fd, fcntl.LOCK_EX)
        try:
            with open(debounce_path) as f:
                state = json.load(f)

            if state["id"] != my_id:
                debug_log("Serial debounce: skipped (newer update exists)")
                return True  # Another process will send

            debug_log("Serial debounce: sending (we have latest)")
            return send_serial_raw(port, state["data"])
        finally:
            fcntl.flock(lock_fd, fcntl.LOCK_UN)
            os.close(lock_fd)
            lock_fd = None

    except (IOError, OSError, json.JSONDecodeError) as e:
        debug_log(f"Serial debounce error: {e}, falling back to direct send")
        return send_serial_raw(port, data)
    finally:
        if lock_fd is not None:
            try:
                os.close(lock_fd)
            except OSError:
                pass


def send_http_post(url: str, endpoint: str, data: str | None = None) -> tuple[bool, str | None]:
    """Send HTTP POST request."""
    try:
        full_url = f"{url}{endpoint}"
        if data:
            req = Request(
                full_url,
                data=data.encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
        else:
            req = Request(full_url, method="POST")

        with urlopen(req, timeout=HTTP_TIMEOUT_SECONDS) as response:
            return True, response.read().decode("utf-8")
    except (URLError, TimeoutError, OSError):
        return False, None


def send_http_get(url: str, endpoint: str) -> tuple[bool, str | None]:
    """Send HTTP GET request."""
    try:
        with urlopen(f"{url}{endpoint}", timeout=HTTP_TIMEOUT_SECONDS) as response:
            return True, response.read().decode("utf-8")
    except (URLError, TimeoutError, OSError):
        return False, None


def send_vibemon_api(url: str, token: str, payload: dict[str, Any]) -> bool:
    """Send status to VibeMon API with Bearer token authentication.

    API: POST /status
    Headers: Authorization: Bearer <token>, Content-Type: application/json
    Body: { state, project, tool, model, memory, character }
    """
    try:
        api_url = f"{url.rstrip('/')}/status"
        api_payload = json.dumps({
            "state": payload.get("state", ""),
            "project": payload.get("project", ""),
            "tool": payload.get("tool", ""),
            "model": payload.get("model", ""),
            "memory": payload.get("memory", 0),
            "character": payload.get("character", CHARACTER),
        })

        req = Request(
            api_url,
            data=api_payload.encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}",
            },
            method="POST",
        )

        with urlopen(req, timeout=HTTP_TIMEOUT_SECONDS) as response:
            debug_log(f"VibeMon API response: {response.status}")
            return response.status == 200
    except (URLError, TimeoutError, OSError) as e:
        debug_log(f"VibeMon API error: {e}")
        return False


# ============================================================================
# Target Resolution
# ============================================================================

def _send_http_request(
    url: str, endpoint: str, data: str | None, method: str
) -> tuple[bool, str | None]:
    """Send HTTP request with specified method."""
    if method == "POST":
        return send_http_post(url, endpoint, data)
    return send_http_get(url, endpoint)


def is_localhost_url(url: str) -> bool:
    """Check if URL is localhost (Desktop App)."""
    return "127.0.0.1" in url or "localhost" in url


def try_http_targets(
    endpoint: str,
    data: str | None = None,
    method: str = "POST",
    include_localhost: bool = True,
) -> tuple[bool, str | None]:
    """Try HTTP targets in order.

    Returns: (success, result_text)
    """
    config = get_config()

    for url in config.http_urls:
        if not include_localhost and is_localhost_url(url):
            continue
        debug_log(f"Trying HTTP: {url}")
        success, result = _send_http_request(url, endpoint, data, method)
        if success:
            return True, result

    return False, None


def try_serial_target(command_data: str) -> tuple[bool, str | None]:
    """Try Serial target.

    Returns: (success, resolved_port)
    """
    config = get_config()

    if not config.serial_port:
        return False, None

    resolved_port = resolve_serial_port(config.serial_port)
    if not resolved_port:
        return False, None

    debug_log(f"Trying Serial: {resolved_port}")
    if send_serial(resolved_port, command_data):
        return True, resolved_port

    return False, None


def try_all_targets(
    endpoint: str,
    http_data: str | None,
    serial_command: str,
    include_localhost: bool = True,
) -> tuple[bool, str | None]:
    """Try all targets: HTTP → Serial.

    Returns: (success, result_text or None)
    """
    # Try HTTP targets first
    success, result = try_http_targets(endpoint, http_data, "POST", include_localhost)
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

def _print_result(result: str | None, fallback: str) -> None:
    """Print result or fallback message."""
    print(result if result else fallback)


def send_lock(project: str) -> bool:
    """Lock the monitor to a specific project."""
    debug_log(f"Locking project: {project}")

    http_data = json.dumps({"project": project})
    serial_data = json.dumps({"command": "lock", "project": project})

    success, result = try_all_targets("/lock", http_data, serial_data)

    if success:
        _print_result(result, f'{{"success":true,"locked":"{project}"}}')
        return True

    debug_log("No monitor target available")
    print(ERR_NO_TARGET)
    return False


def send_unlock() -> bool:
    """Unlock the monitor."""
    debug_log("Unlocking")

    serial_data = json.dumps({"command": "unlock"})
    success, result = try_all_targets("/unlock", None, serial_data)

    if success:
        _print_result(result, '{"success":true,"locked":null}')
        return True

    debug_log("No monitor target available")
    print(ERR_NO_TARGET)
    return False


def get_status() -> bool:
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


def get_lock_mode() -> bool:
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


def set_lock_mode(mode: str) -> bool:
    """Set lock mode on monitor."""
    if mode not in VALID_LOCK_MODES:
        print(ERR_INVALID_MODE % mode)
        return False

    debug_log(f"Setting lock mode: {mode}")

    http_data = json.dumps({"mode": mode})
    serial_data = json.dumps({"command": "lock-mode", "mode": mode})

    success, result = try_all_targets("/lock-mode", http_data, serial_data)

    if success:
        _print_result(result, f'{{"success":true,"lockMode":"{mode}"}}')
        return True

    debug_log("No monitor target available")
    print(ERR_NO_TARGET)
    return False


def send_reboot() -> bool:
    """Reboot the ESP32 device."""
    debug_log("Rebooting ESP32")

    serial_data = json.dumps({"command": "reboot"})

    # ESP32 only - don't include localhost (Desktop)
    success, result = try_all_targets("/reboot", None, serial_data, include_localhost=False)

    if success:
        _print_result(result, '{"success":true,"rebooting":true}')
        return True

    debug_log("No ESP32 target available")
    print(ERR_NO_ESP32)
    return False


# ============================================================================
# Send to All Targets (for status updates)
# ============================================================================

def is_monitor_running(url: str) -> bool:
    """Check if monitor is running."""
    success, _ = send_http_get(url, "/health")
    return success


def show_monitor_window(url: str) -> None:
    """Show the monitor window."""
    send_http_post(url, "/show")


def get_user_shell() -> str:
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


def launch_desktop() -> None:
    """Launch Desktop App via npx."""
    debug_log("Launching Desktop App via npx")
    try:
        shell = get_user_shell()
        debug_log(f"Using shell: {shell}")
        subprocess.Popen(
            [shell, "-l", "-c", "npx vibe-monitor@latest"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        time.sleep(DESKTOP_LAUNCH_WAIT_SECONDS)
    except Exception as e:
        debug_log(f"Failed to launch Desktop App: {e}")


def get_desktop_url(http_urls: tuple[str, ...]) -> str | None:
    """Get first localhost URL (Desktop App) from HTTP URLs."""
    for url in http_urls:
        if is_localhost_url(url):
            return url
    return None


def send_to_all(payload: dict[str, Any], is_start: bool = False) -> None:
    """Send payload to all configured targets concurrently."""
    config = get_config()

    # Launch Desktop App if not running (on start) - must be sequential
    desktop_url = get_desktop_url(config.http_urls)
    if desktop_url and is_start and config.auto_launch:
        if not is_monitor_running(desktop_url):
            debug_log("Desktop App not running, launching...")
            launch_desktop()
        show_monitor_window(desktop_url)

    # Convert to JSON string once for HTTP/Serial targets
    payload_str = json.dumps(payload)

    # Resolve serial port once
    resolved_port: str | None = None
    if config.serial_port:
        resolved_port = resolve_serial_port(config.serial_port)
        if not resolved_port:
            debug_log(f"No serial port found for pattern: {config.serial_port}")

    # Build list of tasks to run in parallel
    tasks: list[tuple[str, Any]] = []

    for url in config.http_urls:
        # Capture url in closure
        u = url
        label = "Desktop App" if is_localhost_url(url) else f"HTTP ({url})"
        tasks.append((label, lambda u=u: send_http_post(u, "/status", payload_str)[0]))

    if resolved_port:
        # Capture resolved_port in closure
        port = resolved_port
        tasks.append(("USB serial", lambda p=port: send_serial(p, payload_str)))

    # Add VibeMon API target if configured
    if config.vibemon_url and config.vibemon_token and payload.get("project"):
        tasks.append((
            "VibeMon API",
            lambda: send_vibemon_api(config.vibemon_url, config.vibemon_token, payload)
        ))

    if not tasks:
        return

    # Execute all tasks concurrently
    with ThreadPoolExecutor(max_workers=len(tasks)) as executor:
        future_to_name = {executor.submit(task): name for name, task in tasks}
        for future in as_completed(future_to_name):
            name = future_to_name[future]
            try:
                success = future.result()
                debug_log(f"Sent to {name}" if success else f"{name} failed")
            except Exception as e:
                debug_log(f"{name} failed with error: {e}")


# ============================================================================
# Command Handlers
# ============================================================================

# Command handler mapping
COMMAND_HANDLERS: dict[str, Any] = {
    "--lock": lambda args: send_lock(args[0] if args else os.path.basename(os.getcwd())),
    "--unlock": lambda args: send_unlock(),
    "--status": lambda args: get_status(),
    "--lock-mode": lambda args: set_lock_mode(args[0]) if args else get_lock_mode(),
    "--reboot": lambda args: send_reboot(),
}


def handle_command(cmd: str, args: list[str]) -> bool | None:
    """Handle CLI command."""
    handler = COMMAND_HANDLERS.get(cmd)
    if handler:
        return handler(args)
    return None


# ============================================================================
# Main
# ============================================================================

def main() -> None:
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
    project_name = os.path.basename(os.getcwd().rstrip("/")) or "default"

    debug_log(f"Event: {event_type}, State: {state}, Project: {project_name}")

    # Build payload (include event as tool)
    payload = build_payload(state, project_name, event_type)
    debug_log(f"Payload: {json.dumps(payload)}")

    # Check if start event (promptSubmit is typically the first event)
    is_start = event_type == "promptSubmit"

    send_to_all(payload, is_start)


if __name__ == "__main__":
    main()
    sys.exit(0)
