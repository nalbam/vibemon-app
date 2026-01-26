#!/bin/bash

# Vibe Monitor Hook for Kiro IDE
# Desktop App + ESP32 (USB Serial / HTTP)

# ============================================================================
# Environment Loading
# ============================================================================

load_env() {
  local env_file="$HOME/.kiro/.env.local"

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

# ============================================================================
# State Functions
# ============================================================================

get_state() {
  local event_type="$1"

  case "$event_type" in
    "agentSpawn") echo "start" ;;
    "promptSubmit") echo "thinking" ;;
    "preToolUse") echo "working" ;;
    "agentStop") echo "done" ;;
    *) echo "working" ;;
  esac
}

build_payload() {
  local state="$1"
  local event="$2"

  jq -n \
    --arg state "$state" \
    --arg event "$event" \
    --arg character "kiro" \
    '{state: $state, event: $event, character: $character}'
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
    --max-time 5
}

send_unlock() {
  if [ -z "${VIBE_MONITOR_URL}" ]; then
    debug_log "VIBE_MONITOR_URL not set"
    return 1
  fi

  debug_log "Unlocking"
  curl -s -X POST "${VIBE_MONITOR_URL}/unlock" \
    --connect-timeout 2 \
    --max-time 5
}

get_status() {
  if [ -z "${VIBE_MONITOR_URL}" ]; then
    debug_log "VIBE_MONITOR_URL not set"
    return 1
  fi

  curl -s "${VIBE_MONITOR_URL}/status" \
    --connect-timeout 2 \
    --max-time 5
}

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
    --json)
      local payload="$2"
      if [ -z "$payload" ]; then
        debug_log "No payload provided with --json"
        exit 1
      fi
      debug_log "Direct JSON mode: $payload"
      send_to_all "$payload" "false"
      exit 0
      ;;
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

  local event_type="${1:-}"

  if [ -z "$event_type" ]; then
    debug_log "No event type provided"
    exit 0
  fi

  # Get state from event type
  local state
  state=$(get_state "$event_type")

  debug_log "Event: $event_type, State: $state"

  # Build payload
  local payload
  payload=$(build_payload "$state" "$event_type")

  debug_log "Payload: $payload"

  # Check if start event
  local is_start=false
  if [ "$event_type" = "agentSpawn" ]; then
    is_start=true
  fi

  send_to_all "$payload" "$is_start"
}

main "$@"
exit 0
