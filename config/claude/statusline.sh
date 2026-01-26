#!/bin/bash

# Claude Code Statusline Hook
# Displays minimal status line: project, model, memory

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

read_input() {
  cat
}

parse_json_field() {
  local input="$1"
  local field="$2"
  local default="${3:-}"
  echo "$input" | jq -r "$field // \"$default\"" 2>/dev/null
}

# ============================================================================
# Context Window Functions
# ============================================================================

get_context_usage() {
  local input="$1"

  # Try pre-calculated percentage first
  local used_pct
  used_pct=$(parse_json_field "$input" '.context_window.used_percentage' '0')

  if [ -n "$used_pct" ] && [ "$used_pct" != "null" ] && [ "$used_pct" != "0" ]; then
    printf "%.0f%%" "$used_pct"
    return
  fi

  # Fallback: calculate from current_usage
  local context_size current_tokens
  context_size=$(parse_json_field "$input" '.context_window.context_window_size' '0')

  if [ "$context_size" -gt 0 ] 2>/dev/null; then
    local input_tokens cache_creation cache_read
    input_tokens=$(parse_json_field "$input" '.context_window.current_usage.input_tokens' '0')
    cache_creation=$(parse_json_field "$input" '.context_window.current_usage.cache_creation_input_tokens' '0')
    cache_read=$(parse_json_field "$input" '.context_window.current_usage.cache_read_input_tokens' '0')

    current_tokens=$((input_tokens + cache_creation + cache_read))
    if [ "$current_tokens" -gt 0 ]; then
      echo "$((current_tokens * 100 / context_size))%"
      return
    fi
  fi

  echo ""
}

# ============================================================================
# VibeMon Cache Functions
# ============================================================================

VIBE_MONITOR_CACHE="${VIBE_MONITOR_CACHE:-$HOME/.claude/.vibe-monitor.json}"
# Expand ~ to $HOME (tilde is not expanded when sourced from .env files)
VIBE_MONITOR_CACHE="${VIBE_MONITOR_CACHE/#\~/$HOME}"
VIBE_MONITOR_MAX_PROJECTS=10

save_to_cache() {
  local project="$1"
  local model="$2"
  local memory="$3"

  # Only save if project is set
  [ -z "$project" ] && return

  local cache_dir
  cache_dir=$(dirname "$VIBE_MONITOR_CACHE")

  # Ensure cache directory exists
  if [ ! -d "$cache_dir" ]; then
    mkdir -p "$cache_dir" 2>/dev/null || return
  fi

  local lockfile="${VIBE_MONITOR_CACHE}.lock"
  local tmpfile="${VIBE_MONITOR_CACHE}.tmp.$$"
  local timestamp
  timestamp=$(date +%s)

  # Simple file-based locking (wait up to 5 seconds)
  local wait_count=0
  while [ -f "$lockfile" ] && [ "$wait_count" -lt 50 ]; do
    sleep 0.1
    wait_count=$((wait_count + 1))
  done

  # Create lock file
  echo $$ > "$lockfile" 2>/dev/null

  # Read existing cache or create empty object
  local cache="{}"
  if [ -f "$VIBE_MONITOR_CACHE" ]; then
    # Validate existing cache is valid JSON
    local existing
    existing=$(cat "$VIBE_MONITOR_CACHE" 2>/dev/null)
    if echo "$existing" | jq empty 2>/dev/null; then
      cache="$existing"
    fi
  fi

  # Update cache with new project data (with timestamp)
  # Then keep only the most recent N projects
  local new_cache
  new_cache=$(echo "$cache" | jq \
    --arg project "$project" \
    --arg model "$model" \
    --arg memory "$memory" \
    --argjson ts "$timestamp" \
    --argjson max "$VIBE_MONITOR_MAX_PROJECTS" \
    '.[$project] = {model: $model, memory: $memory, ts: $ts} |
     to_entries | sort_by(.value.ts) | reverse | .[:$max] | from_entries' 2>/dev/null)

  # Only write if jq succeeded and produced valid JSON
  if [ -n "$new_cache" ] && echo "$new_cache" | jq empty 2>/dev/null; then
    # Atomic write: write to temp file, then move
    echo "$new_cache" > "$tmpfile" 2>/dev/null && mv "$tmpfile" "$VIBE_MONITOR_CACHE" 2>/dev/null
  fi

  # Clean up temp file if still exists
  rm -f "$tmpfile" 2>/dev/null

  # Remove lock file
  rm -f "$lockfile" 2>/dev/null
}

# ============================================================================
# ANSI Colors
# ============================================================================

C_RESET='\033[0m'
C_GREEN='\033[32m'
C_YELLOW='\033[33m'
C_RED='\033[31m'
C_MAGENTA='\033[35m'
C_BLUE='\033[34m'

# ============================================================================
# Progress Bar Functions
# ============================================================================

build_progress_bar() {
  local percent="$1"
  local width="${2:-10}"

  # Remove % sign if present
  percent="${percent%\%}"

  # Handle empty or invalid input
  if [ -z "$percent" ] || ! [[ "$percent" =~ ^[0-9]+$ ]]; then
    echo ""
    return
  fi

  local filled=$((percent * width / 100))
  local empty=$((width - filled))

  # Color based on usage level
  local color="$C_GREEN"
  if [ "$percent" -ge 90 ]; then
    color="$C_RED"
  elif [ "$percent" -ge 75 ]; then
    color="$C_YELLOW"
  fi

  # Build the bar
  local bar=""
  for ((i=0; i<filled; i++)); do
    bar="${bar}━"
  done
  for ((i=0; i<empty; i++)); do
    bar="${bar}╌"
  done

  printf "%b%s%b %s%%" "$color" "$bar" "$C_RESET" "$percent"
}

# ============================================================================
# Statusline Output
# ============================================================================

build_statusline() {
  local model="$1"
  local dir_name="$2"
  local context_usage="$3"

  local SEP=" │ "
  local status_line=""

  # Directory (📂 icon)
  status_line="${status_line}${C_BLUE}📂 ${dir_name}${C_RESET}"

  # Model (🤖 icon) - remove "Claude " prefix, keep version
  local short_model="${model#Claude }"
  status_line="${status_line}${SEP}${C_MAGENTA}🤖 ${short_model}${C_RESET}"

  # Context usage with progress bar (🧠 icon)
  if [ -n "$context_usage" ]; then
    local progress_bar
    progress_bar=$(build_progress_bar "$context_usage")
    if [ -n "$progress_bar" ]; then
      status_line="${status_line}${SEP}🧠 ${progress_bar}"
    fi
  fi

  printf "%b" "$status_line"
}

# ============================================================================
# Main
# ============================================================================

main() {
  local input
  input=$(read_input)

  # Parse input fields
  local model_display current_dir
  model_display=$(parse_json_field "$input" '.model.display_name' 'Claude')
  current_dir=$(parse_json_field "$input" '.workspace.current_dir' '')

  local dir_name
  dir_name=$(basename "$current_dir")

  # Get context usage
  local context_usage
  context_usage=$(get_context_usage "$input")

  # Save project metadata to cache (vibe-monitor.sh will read this)
  save_to_cache "$dir_name" "$model_display" "$context_usage" &

  # Output statusline
  build_statusline "$model_display" "$dir_name" "$context_usage"
}

main
