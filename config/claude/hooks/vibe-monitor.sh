#!/bin/bash
#
# Vibe Monitor Hook for Claude Code
# Desktop App + ESP32 (USB Serial / HTTP)
#

set -euo pipefail

# ============================================================================
# Environment Loading
# ============================================================================

load_env() {
    local env_file="$HOME/.claude/.env.local"
    [[ -f "$env_file" ]] || return 0

    while IFS= read -r line || [[ -n "$line" ]]; do
        [[ -z "$line" || "$line" == \#* ]] && continue
        line="${line#export }"
        if [[ "$line" == *=* ]]; then
            local key="${line%%=*}"
            local value="${line#*=}"
            value="${value#\"}"
            value="${value%\"}"
            value="${value#\'}"
            value="${value%\'}"
            value="${value/#\~/$HOME}"
            export "${key}=${!key:-$value}" 2>/dev/null || true
        fi
    done < "$env_file"
}

load_env

# ============================================================================
# Configuration
# ============================================================================

DEBUG="${DEBUG:-0}"
VIBEMON_HTTP_URLS="${VIBEMON_HTTP_URLS:-}"
VIBEMON_SERIAL_PORT="${VIBEMON_SERIAL_PORT:-}"
VIBEMON_CACHE_DIR="${VIBEMON_CACHE_DIR:-$HOME/.claude/cache/vibemon}"
VIBEMON_AUTO_LAUNCH="${VIBEMON_AUTO_LAUNCH:-0}"
VIBEMON_URL="${VIBEMON_URL:-}"
VIBEMON_TOKEN="${VIBEMON_TOKEN:-}"

CHARACTER="clawd"
HTTP_TIMEOUT=5
SERIAL_BAUD_RATE=115200
SERIAL_DEBOUNCE_MS=100
DESKTOP_LAUNCH_WAIT=3

# Error messages
ERR_NO_TARGET='{"error":"No monitor target available. Set VIBEMON_HTTP_URLS or VIBEMON_SERIAL_PORT"}'
ERR_NO_ESP32='{"error":"No ESP32 target available. Set VIBEMON_HTTP_URLS (with ESP32 URL) or VIBEMON_SERIAL_PORT"}'
ERR_INVALID_MODE='{"error":"Invalid mode: %s. Valid modes: first-project, on-thinking"}'

# ============================================================================
# Utility Functions
# ============================================================================

debug_log() {
    [[ "$DEBUG" == "1" ]] && echo "[DEBUG] $1" >&2
}

# ============================================================================
# Serial Functions
# ============================================================================

resolve_serial_port() {
    local pattern="$1"
    [[ -z "$pattern" ]] && return 1

    if [[ "$pattern" == *"*"* ]]; then
        local matches
        matches=$(ls $pattern 2>/dev/null | head -n1)
        if [[ -n "$matches" ]]; then
            debug_log "Found serial port: $matches"
            echo "$matches"
            return 0
        fi
        debug_log "No serial port found matching: $pattern"
        return 1
    fi

    echo "$pattern"
}

send_serial() {
    local port="$1"
    local data="$2"

    [[ ! -e "$port" ]] && return 1

    local lock_file="/tmp/vibe-monitor-serial-${port//\//_}.lock"

    (
        flock -w 1 200 || exit 1

        # Configure serial port
        if [[ "$(uname)" == "Darwin" ]]; then
            stty -f "$port" "$SERIAL_BAUD_RATE" 2>/dev/null || true
        else
            stty -F "$port" "$SERIAL_BAUD_RATE" 2>/dev/null || true
        fi

        # Write data
        echo "$data" > "$port"
        sleep 0.05
    ) 200>"$lock_file"
}

send_serial_debounced() {
    local port="$1"
    local data="$2"

    [[ ! -e "$port" ]] && return 1

    local debounce_file="/tmp/vibe-monitor-serial-${port//\//_}.debounce"
    local my_id="$$-$RANDOM"

    # Write our data to debounce file
    echo "$my_id:$data" > "$debounce_file"

    # Wait for debounce period
    sleep "$(echo "scale=3; $SERIAL_DEBOUNCE_MS / 1000" | bc)"

    # Check if we're still the latest
    local current
    current=$(cat "$debounce_file" 2>/dev/null || echo "")

    if [[ "$current" == "$my_id:"* ]]; then
        debug_log "Serial debounce: sending (we have latest)"
        send_serial "$port" "$data"
    else
        debug_log "Serial debounce: skipped (newer update exists)"
    fi
}

# ============================================================================
# HTTP Functions
# ============================================================================

send_http_post() {
    local url="$1"
    local endpoint="$2"
    local data="${3:-}"

    local full_url="${url}${endpoint}"

    if [[ -n "$data" ]]; then
        curl -s -X POST "$full_url" \
            -H "Content-Type: application/json" \
            -d "$data" \
            --connect-timeout "$HTTP_TIMEOUT" \
            --max-time "$HTTP_TIMEOUT" 2>/dev/null
    else
        curl -s -X POST "$full_url" \
            --connect-timeout "$HTTP_TIMEOUT" \
            --max-time "$HTTP_TIMEOUT" 2>/dev/null
    fi
}

send_http_get() {
    local url="$1"
    local endpoint="$2"

    curl -s -X GET "${url}${endpoint}" \
        --connect-timeout "$HTTP_TIMEOUT" \
        --max-time "$HTTP_TIMEOUT" 2>/dev/null
}

send_vibemon_api() {
    local url="$1"
    local token="$2"
    local payload="$3"

    curl -s -X POST "${url%/}/status" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $token" \
        -d "$payload" \
        --connect-timeout "$HTTP_TIMEOUT" \
        --max-time "$HTTP_TIMEOUT" 2>/dev/null
}

is_localhost_url() {
    local url="$1"
    [[ "$url" == *"127.0.0.1"* || "$url" == *"localhost"* ]]
}

is_monitor_running() {
    local url="$1"
    curl -s -o /dev/null -w "%{http_code}" "${url}/health" \
        --connect-timeout 2 --max-time 2 2>/dev/null | grep -q "200"
}

# ============================================================================
# Cache Functions
# ============================================================================

get_project_metadata() {
    local project="$1"
    local cache_file="$VIBEMON_CACHE_DIR/$project.txt"

    [[ ! -f "$cache_file" ]] && return

    cat "$cache_file"
}

get_cache_value() {
    local project="$1"
    local key="$2"
    local default="${3:-}"

    local cache_file="$VIBEMON_CACHE_DIR/$project.txt"
    [[ ! -f "$cache_file" ]] && echo "$default" && return

    local value
    value=$(grep "^${key}=" "$cache_file" 2>/dev/null | cut -d= -f2-)
    echo "${value:-$default}"
}

# ============================================================================
# State Functions
# ============================================================================

get_state() {
    local event_name="$1"
    local permission_mode="${2:-default}"

    local state
    case "$event_name" in
        SessionStart) state="start" ;;
        UserPromptSubmit) state="thinking" ;;
        PreToolUse) state="working" ;;
        PreCompact) state="packing" ;;
        Notification) state="notification" ;;
        Stop) state="done" ;;
        *) state="working" ;;
    esac

    if [[ "$permission_mode" == "plan" && ("$state" == "thinking" || "$state" == "working") ]]; then
        state="planning"
    fi

    echo "$state"
}

get_project_name() {
    local cwd="$1"
    local transcript_path="$2"

    if [[ -n "$cwd" ]]; then
        local name
        name=$(basename "$cwd")
        [[ -n "$name" ]] && echo "$name" && return
    fi

    if [[ -n "$transcript_path" ]]; then
        local name
        name=$(basename "$(dirname "$transcript_path")")
        [[ -n "$name" ]] && echo "$name" && return
    fi

    basename "$(pwd)"
}

get_terminal_id() {
    if [[ -n "${ITERM_SESSION_ID:-}" ]]; then
        echo "iterm2:$ITERM_SESSION_ID"
    elif [[ -n "${GHOSTTY_PID:-}" ]]; then
        echo "ghostty:$GHOSTTY_PID"
    fi
}

# ============================================================================
# Payload Builder
# ============================================================================

build_payload() {
    local state="$1"
    local tool="$2"
    local project="$3"

    local model memory terminal_id
    model=$(get_cache_value "$project" "model" "")
    memory=$(get_cache_value "$project" "memory" "0")
    terminal_id=$(get_terminal_id)

    cat << EOF
{"state":"$state","tool":"$tool","project":"$project","model":"$model","memory":$memory,"character":"$CHARACTER","terminalId":"$terminal_id"}
EOF
}

build_api_payload() {
    local state="$1"
    local tool="$2"
    local project="$3"

    local model memory
    model=$(get_cache_value "$project" "model" "")
    memory=$(get_cache_value "$project" "memory" "0")

    cat << EOF
{"state":"$state","project":"$project","tool":"$tool","model":"$model","memory":$memory,"character":"$CHARACTER"}
EOF
}

# ============================================================================
# Send Functions
# ============================================================================

launch_desktop() {
    debug_log "Launching Desktop App via npx"
    local shell="${SHELL:-/bin/sh}"
    nohup "$shell" -l -c "npx vibe-monitor@latest" >/dev/null 2>&1 &
    sleep "$DESKTOP_LAUNCH_WAIT"
}

send_to_all() {
    local payload="$1"
    local is_start="${2:-false}"

    # Parse HTTP URLs (handle empty string)
    local urls=()
    if [[ -n "$VIBEMON_HTTP_URLS" ]]; then
        IFS=',' read -ra urls <<< "$VIBEMON_HTTP_URLS"
    fi

    # Find desktop URL and handle auto-launch
    local desktop_url=""
    for url in "${urls[@]+"${urls[@]}"}"; do
        url=$(echo "$url" | xargs)  # trim whitespace
        if is_localhost_url "$url"; then
            desktop_url="$url"
            break
        fi
    done

    if [[ -n "$desktop_url" && "$is_start" == "true" && "$VIBEMON_AUTO_LAUNCH" == "1" ]]; then
        if ! is_monitor_running "$desktop_url"; then
            debug_log "Desktop App not running, launching..."
            launch_desktop
        fi
        send_http_post "$desktop_url" "/show" &>/dev/null &
    fi

    # Send to all HTTP targets (parallel)
    for url in "${urls[@]+"${urls[@]}"}"; do
        url=$(echo "$url" | xargs)
        [[ -z "$url" ]] && continue
        debug_log "Sending to HTTP: $url"
        send_http_post "$url" "/status" "$payload" &>/dev/null &
    done

    # Send to serial (parallel)
    if [[ -n "$VIBEMON_SERIAL_PORT" ]]; then
        local resolved_port
        resolved_port=$(resolve_serial_port "$VIBEMON_SERIAL_PORT") || true
        if [[ -n "$resolved_port" ]]; then
            debug_log "Sending to Serial: $resolved_port"
            send_serial_debounced "$resolved_port" "$payload" &
        fi
    fi

    # Send to VibeMon API (parallel)
    if [[ -n "$VIBEMON_URL" && -n "$VIBEMON_TOKEN" ]]; then
        local project
        project=$(echo "$payload" | jq -r '.project // ""')
        if [[ -n "$project" ]]; then
            local api_payload
            api_payload=$(build_api_payload \
                "$(echo "$payload" | jq -r '.state')" \
                "$(echo "$payload" | jq -r '.tool')" \
                "$project")
            debug_log "Sending to VibeMon API: $VIBEMON_URL"
            send_vibemon_api "$VIBEMON_URL" "$VIBEMON_TOKEN" "$api_payload" &>/dev/null &
        fi
    fi

    # Wait for all background jobs
    wait
}

# ============================================================================
# Command Handlers
# ============================================================================

cmd_lock() {
    local project="${1:-$(basename "$(pwd)")}"
    debug_log "Locking project: $project"

    local http_data="{\"project\":\"$project\"}"
    local serial_data="{\"command\":\"lock\",\"project\":\"$project\"}"
    local success=false

    # Try HTTP targets
    IFS=',' read -ra urls <<< "$VIBEMON_HTTP_URLS"
    for url in "${urls[@]}"; do
        url=$(echo "$url" | xargs)
        [[ -z "$url" ]] && continue
        local result
        result=$(send_http_post "$url" "/lock" "$http_data") && success=true && echo "$result" && return 0
    done

    # Try serial
    if [[ -n "$VIBEMON_SERIAL_PORT" ]]; then
        local resolved_port
        resolved_port=$(resolve_serial_port "$VIBEMON_SERIAL_PORT") || true
        if [[ -n "$resolved_port" ]] && send_serial "$resolved_port" "$serial_data"; then
            success=true
            echo "{\"success\":true,\"locked\":\"$project\"}"
            return 0
        fi
    fi

    echo "$ERR_NO_TARGET"
    return 1
}

cmd_unlock() {
    debug_log "Unlocking"

    local serial_data='{"command":"unlock"}'
    local success=false

    # Try HTTP targets
    IFS=',' read -ra urls <<< "$VIBEMON_HTTP_URLS"
    for url in "${urls[@]}"; do
        url=$(echo "$url" | xargs)
        [[ -z "$url" ]] && continue
        local result
        result=$(send_http_post "$url" "/unlock") && success=true && echo "$result" && return 0
    done

    # Try serial
    if [[ -n "$VIBEMON_SERIAL_PORT" ]]; then
        local resolved_port
        resolved_port=$(resolve_serial_port "$VIBEMON_SERIAL_PORT") || true
        if [[ -n "$resolved_port" ]] && send_serial "$resolved_port" "$serial_data"; then
            success=true
            echo '{"success":true,"locked":null}'
            return 0
        fi
    fi

    echo "$ERR_NO_TARGET"
    return 1
}

cmd_status() {
    # Try HTTP targets
    IFS=',' read -ra urls <<< "$VIBEMON_HTTP_URLS"
    for url in "${urls[@]}"; do
        url=$(echo "$url" | xargs)
        [[ -z "$url" ]] && continue
        local result
        result=$(send_http_get "$url" "/status") && echo "$result" && return 0
    done

    # Try serial
    if [[ -n "$VIBEMON_SERIAL_PORT" ]]; then
        local resolved_port
        resolved_port=$(resolve_serial_port "$VIBEMON_SERIAL_PORT") || true
        if [[ -n "$resolved_port" ]] && send_serial "$resolved_port" '{"command":"status"}'; then
            echo '{"info":"Status command sent via serial. Check device output."}'
            return 0
        fi
    fi

    echo "$ERR_NO_TARGET"
    return 1
}

cmd_lock_mode() {
    local mode="${1:-}"

    if [[ -z "$mode" ]]; then
        # GET mode
        IFS=',' read -ra urls <<< "$VIBEMON_HTTP_URLS"
        for url in "${urls[@]}"; do
            url=$(echo "$url" | xargs)
            [[ -z "$url" ]] && continue
            local result
            result=$(send_http_get "$url" "/lock-mode") && echo "$result" && return 0
        done

        if [[ -n "$VIBEMON_SERIAL_PORT" ]]; then
            local resolved_port
            resolved_port=$(resolve_serial_port "$VIBEMON_SERIAL_PORT") || true
            if [[ -n "$resolved_port" ]] && send_serial "$resolved_port" '{"command":"lock-mode"}'; then
                echo '{"info":"Lock-mode command sent via serial. Check device output."}'
                return 0
            fi
        fi

        echo "$ERR_NO_TARGET"
        return 1
    fi

    # SET mode
    if [[ "$mode" != "first-project" && "$mode" != "on-thinking" ]]; then
        printf "$ERR_INVALID_MODE" "$mode"
        return 1
    fi

    debug_log "Setting lock mode: $mode"

    local http_data="{\"mode\":\"$mode\"}"
    local serial_data="{\"command\":\"lock-mode\",\"mode\":\"$mode\"}"

    IFS=',' read -ra urls <<< "$VIBEMON_HTTP_URLS"
    for url in "${urls[@]}"; do
        url=$(echo "$url" | xargs)
        [[ -z "$url" ]] && continue
        local result
        result=$(send_http_post "$url" "/lock-mode" "$http_data") && echo "$result" && return 0
    done

    if [[ -n "$VIBEMON_SERIAL_PORT" ]]; then
        local resolved_port
        resolved_port=$(resolve_serial_port "$VIBEMON_SERIAL_PORT") || true
        if [[ -n "$resolved_port" ]] && send_serial "$resolved_port" "$serial_data"; then
            echo "{\"success\":true,\"lockMode\":\"$mode\"}"
            return 0
        fi
    fi

    echo "$ERR_NO_TARGET"
    return 1
}

cmd_reboot() {
    debug_log "Rebooting ESP32"

    local serial_data='{"command":"reboot"}'

    # ESP32 only - exclude localhost
    IFS=',' read -ra urls <<< "$VIBEMON_HTTP_URLS"
    for url in "${urls[@]}"; do
        url=$(echo "$url" | xargs)
        [[ -z "$url" ]] && continue
        is_localhost_url "$url" && continue
        local result
        result=$(send_http_post "$url" "/reboot") && echo "$result" && return 0
    done

    if [[ -n "$VIBEMON_SERIAL_PORT" ]]; then
        local resolved_port
        resolved_port=$(resolve_serial_port "$VIBEMON_SERIAL_PORT") || true
        if [[ -n "$resolved_port" ]] && send_serial "$resolved_port" "$serial_data"; then
            echo '{"success":true,"rebooting":true}'
            return 0
        fi
    fi

    echo "$ERR_NO_ESP32"
    return 1
}

# ============================================================================
# Main
# ============================================================================

main() {
    # Handle CLI commands
    if [[ $# -gt 0 ]]; then
        case "$1" in
            --lock) cmd_lock "${2:-}" ; exit $? ;;
            --unlock) cmd_unlock ; exit $? ;;
            --status) cmd_status ; exit $? ;;
            --lock-mode) cmd_lock_mode "${2:-}" ; exit $? ;;
            --reboot) cmd_reboot ; exit $? ;;
        esac
    fi

    # Read stdin
    local input
    input=$(cat)

    local event_name tool_name cwd transcript_path permission_mode
    local project_name state

    # Check if jq is available
    if command -v jq &>/dev/null; then
        # Parse JSON with jq
        event_name=$(echo "$input" | jq -r '.hook_event_name // "Unknown"')
        tool_name=$(echo "$input" | jq -r '.tool_name // ""')
        cwd=$(echo "$input" | jq -r '.cwd // ""')
        transcript_path=$(echo "$input" | jq -r '.transcript_path // ""')
        permission_mode=$(echo "$input" | jq -r '.permission_mode // "default"')

        project_name=$(get_project_name "$cwd" "$transcript_path")
        state=$(get_state "$event_name" "$permission_mode")
    else
        # Fallback: use current directory and "working" state
        debug_log "jq not found, using fallback"
        event_name="Unknown"
        tool_name=""
        project_name=$(basename "$(pwd)")
        state="working"
    fi

    debug_log "Event: $event_name, Tool: $tool_name, Project: $project_name"

    local payload
    payload=$(build_payload "$state" "$tool_name" "$project_name")
    debug_log "Payload: $payload"

    local is_start="false"
    [[ "$event_name" == "SessionStart" ]] && is_start="true"

    send_to_all "$payload" "$is_start"
}

main "$@"
