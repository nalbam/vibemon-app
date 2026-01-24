#!/bin/bash

# Claude Monitor Hook
# Desktop App + ESP32 (USB Serial / HTTP)
# Note: Model and Memory are provided by statusline.sh (accurate data)

DEBUG="${DEBUG:-0}"

# ============================================================================
# Utility Functions
# ============================================================================

debug_log() {
  if [[ "$DEBUG" == "1" ]]; then
    echo "[DEBUG] $*" >&2
  fi
}

# ============================================================================
# Input Parsing Functions
# ============================================================================

read_input() {
  timeout 5 cat 2>/dev/null || cat
}

parse_json_field() {
  local input="$1"
  local field="$2"
  local default="${3:-}"
  jq -r "$field // \"$default\"" <<< "$input" 2>/dev/null
}

# ============================================================================
# State Functions
# ============================================================================

get_project_name() {
  local cwd="$1"
  local transcript_path="$2"

  if [ -n "$cwd" ]; then
    basename "$cwd"
  elif [ -n "$transcript_path" ]; then
    basename "$(dirname "$transcript_path")"
  fi
}

get_state() {
  local event_name="$1"

  case "$event_name" in
    "SessionStart") echo "session_start" ;;
    "PreToolUse"|"PostToolUse") echo "working" ;;
    "Stop") echo "tool_done" ;;
    "Notification") echo "notification" ;;
    *) echo "unknown" ;;
  esac
}

build_payload() {
  local state="$1"
  local event="$2"
  local tool="$3"
  local project="$4"

  jq -n \
    --arg state "$state" \
    --arg event "$event" \
    --arg tool "$tool" \
    --arg project "$project" \
    '{state: $state, event: $event, tool: $tool, project: $project}'
}

# ============================================================================
# Send Functions
# ============================================================================

send_serial() {
  local port="$1"
  local data="$2"

  if [ -c "$port" ]; then
    stty -f "$port" 115200 2>/dev/null || stty -F "$port" 115200 2>/dev/null
    echo "$data" > "$port" 2>/dev/null
    return $?
  fi
  return 1
}

send_http() {
  local url="$1"
  local data="$2"

  curl -s -X POST "$url/status" \
    -H "Content-Type: application/json" \
    -d "$data" \
    --connect-timeout 2 \
    --max-time 5 \
    > /dev/null 2>&1
}

is_monitor_running() {
  local url="$1"
  curl -s "$url/health" \
    --connect-timeout 1 \
    --max-time 1 \
    > /dev/null 2>&1
}

show_monitor_window() {
  local url="$1"
  curl -s -X POST "$url/show" \
    --connect-timeout 1 \
    --max-time 1 \
    > /dev/null 2>&1
}

launch_desktop() {
  local start_script="$CLAUDE_MONITOR_DESKTOP/start.sh"

  if [ -x "$start_script" ]; then
    debug_log "Launching Desktop App: $start_script"
    "$start_script" > /dev/null 2>&1 &
    sleep 2
  else
    debug_log "Desktop App start script not found: $start_script"
  fi
}

# ============================================================================
# Main
# ============================================================================

main() {
  # Read input
  local input
  input=$(read_input)

  # Parse input fields
  local event_name tool_name cwd transcript_path
  event_name=$(parse_json_field "$input" '.hook_event_name' 'Unknown')
  tool_name=$(parse_json_field "$input" '.tool_name' '')
  cwd=$(parse_json_field "$input" '.cwd' '')
  transcript_path=$(parse_json_field "$input" '.transcript_path' '')

  # Get project name and state
  local project_name state
  project_name=$(get_project_name "$cwd" "$transcript_path")
  state=$(get_state "$event_name")

  debug_log "Event: $event_name, Tool: $tool_name, Project: $project_name"

  # Build payload (model and memory are provided by statusline.sh)
  local payload
  payload=$(build_payload "$state" "$event_name" "$tool_name" "$project_name")

  debug_log "Payload: $payload"

  # Launch Desktop App if not running (on SessionStart)
  if [ -n "${CLAUDE_MONITOR_DESKTOP}" ] && [ -n "${CLAUDE_MONITOR_URL}" ] && [ "$event_name" = "SessionStart" ]; then
    if ! is_monitor_running "${CLAUDE_MONITOR_URL}"; then
      debug_log "Desktop App not running, launching..."
      launch_desktop
    fi
  fi

  # Send to Desktop App via HTTP
  if [ -n "${CLAUDE_MONITOR_URL}" ]; then
    debug_log "Trying Desktop App: ${CLAUDE_MONITOR_URL}"
    if [ "$event_name" = "SessionStart" ]; then
      show_monitor_window "${CLAUDE_MONITOR_URL}"
    fi
    if send_http "${CLAUDE_MONITOR_URL}" "$payload"; then
      debug_log "Sent to Desktop App"
    else
      debug_log "Desktop App failed"
    fi
  fi

  # Send to ESP32 USB Serial
  if [ -n "${ESP32_SERIAL_PORT}" ]; then
    debug_log "Trying USB serial: ${ESP32_SERIAL_PORT}"
    if send_serial "${ESP32_SERIAL_PORT}" "$payload"; then
      debug_log "Sent via USB serial"
    else
      debug_log "USB serial failed"
    fi
  fi

  # Send to ESP32 HTTP
  if [ -n "${ESP32_HTTP_URL}" ]; then
    debug_log "Trying ESP32 HTTP: ${ESP32_HTTP_URL}"
    if send_http "${ESP32_HTTP_URL}" "$payload"; then
      debug_log "Sent via ESP32 HTTP"
    else
      debug_log "ESP32 HTTP failed"
    fi
  fi
}

main
exit 0
