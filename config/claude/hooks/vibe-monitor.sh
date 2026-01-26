#!/bin/bash

# Vibe Monitor Hook for Claude Code
# Desktop App + ESP32 (USB Serial / HTTP)
# Note: Model and Memory are provided by statusline.sh

# ============================================================================
# Environment Loading
# ============================================================================

load_env() {
  local env_file="$HOME/.claude/.env.local"

  if [ -f "$env_file" ]; then
    # shellcheck source=/dev/null
    source "$env_file"
  fi
}

load_env

DEBUG="${DEBUG:-0}"

# ============================================================================
# Utility Functions
# ============================================================================

debug_log() {
  if [[ "$DEBUG" == "1" ]]; then
    echo "[DEBUG] $*" >&2
  fi
}

read_input() {
  # timeout may not be available on macOS, use read with timeout as fallback
  if command -v timeout > /dev/null 2>&1; then
    timeout 5 cat 2>/dev/null || cat
  else
    # macOS fallback: read with timeout
    local input=""
    while IFS= read -r -t 5 line; do
      input="${input}${line}"$'\n'
    done
    echo -n "$input"
  fi
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

VIBE_MONITOR_CACHE="${VIBE_MONITOR_CACHE:-$HOME/.claude/.vibe-monitor.json}"
# Expand ~ to $HOME (tilde is not expanded when sourced from .env files)
VIBE_MONITOR_CACHE="${VIBE_MONITOR_CACHE/#\~/$HOME}"

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
    "SessionStart") echo "start" ;;
    "UserPromptSubmit") echo "thinking" ;;
    "PreToolUse") echo "working" ;;
    "Stop") echo "done" ;;
    "Notification") echo "notification" ;;
    *) echo "working" ;;
  esac
}

get_project_metadata() {
  local project="$1"

  if [ -z "$project" ] || [ ! -f "$VIBE_MONITOR_CACHE" ]; then
    echo ""
    return
  fi

  jq -r --arg project "$project" '.[$project] // empty' "$VIBE_MONITOR_CACHE" 2>/dev/null
}

build_payload() {
  local state="$1"
  local event="$2"
  local tool="$3"
  local project="$4"

  # Get model/memory from cache
  local metadata model memory
  metadata=$(get_project_metadata "$project")

  if [ -n "$metadata" ]; then
    model=$(echo "$metadata" | jq -r '.model // empty' 2>/dev/null)
    memory=$(echo "$metadata" | jq -r '.memory // empty' 2>/dev/null)
  fi

  jq -n \
    --arg state "$state" \
    --arg event "$event" \
    --arg tool "$tool" \
    --arg project "$project" \
    --arg model "${model:-}" \
    --arg memory "${memory:-}" \
    --arg character "clawd" \
    '{state: $state, event: $event, tool: $tool, project: $project, model: $model, memory: $memory, character: $character}'
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
  debug_log "Launching Desktop App via npx"
  npx vibe-monitor@latest > /dev/null 2>&1 &
  sleep 2
}

# ============================================================================
# Lock/Unlock Functions (Desktop App only)
# ============================================================================

send_lock() {
  local project="$1"

  if [ -z "${VIBE_MONITOR_URL}" ]; then
    debug_log "VIBE_MONITOR_URL not set"
    return 1
  fi

  local payload
  payload=$(jq -n --arg project "$project" '{project: $project}')

  debug_log "Locking project: $project"
  curl -s -X POST "${VIBE_MONITOR_URL}/lock" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    --connect-timeout 2 \
    --max-time 5 \
    > /dev/null 2>&1
}

send_unlock() {
  if [ -z "${VIBE_MONITOR_URL}" ]; then
    debug_log "VIBE_MONITOR_URL not set"
    return 1
  fi

  debug_log "Unlocking"
  curl -s -X POST "${VIBE_MONITOR_URL}/unlock" \
    --connect-timeout 2 \
    --max-time 5 \
    > /dev/null 2>&1
}

get_status() {
  if [ -z "${VIBE_MONITOR_URL}" ]; then
    debug_log "VIBE_MONITOR_URL not set"
    return 1
  fi

  # Output status to stdout for user visibility
  curl -s "${VIBE_MONITOR_URL}/status" \
    --connect-timeout 2 \
    --max-time 5 2>/dev/null
}

# ============================================================================
# Main
# ============================================================================

# ============================================================================
# Send to All Targets
# ============================================================================

send_to_all() {
  local payload="$1"
  local is_start="${2:-false}"

  # Launch Desktop App if not running (on start)
  if [ -n "${VIBE_MONITOR_URL}" ] && [ "$is_start" = true ]; then
    if ! is_monitor_running "${VIBE_MONITOR_URL}"; then
      debug_log "Desktop App not running, launching..."
      launch_desktop
    fi
  fi

  # Send to Desktop App via HTTP
  if [ -n "${VIBE_MONITOR_URL}" ]; then
    debug_log "Trying Desktop App: ${VIBE_MONITOR_URL}"
    if [ "$is_start" = true ]; then
      show_monitor_window "${VIBE_MONITOR_URL}"
    fi
    if send_http "${VIBE_MONITOR_URL}" "$payload"; then
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

# ============================================================================
# Main
# ============================================================================

main() {
  # Check for command modes
  case "$1" in
    --lock)
      local project="${2:-$(basename "$(pwd)")}"
      send_lock "$project"
      exit $?
      ;;
    --unlock)
      send_unlock
      exit $?
      ;;
    --status)
      get_status
      exit $?
      ;;
  esac

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

  # Check if start event
  local is_start=false
  if [ "$event_name" = "SessionStart" ]; then
    is_start=true
  fi

  send_to_all "$payload" "$is_start"
}

main "$@"
exit 0
