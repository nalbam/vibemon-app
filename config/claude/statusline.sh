#!/bin/bash
#
# Claude Code Statusline Hook
# Displays status line and sends context usage to VibeMon
#

set -euo pipefail

# ============================================================================
# Environment Loading
# ============================================================================

load_env() {
    local env_file="$HOME/.claude/.env.local"
    [[ -f "$env_file" ]] || return 0

    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip comments and empty lines
        [[ -z "$line" || "$line" == \#* ]] && continue
        # Remove 'export ' prefix
        line="${line#export }"
        # Parse key=value
        if [[ "$line" == *=* ]]; then
            local key="${line%%=*}"
            local value="${line#*=}"
            # Remove quotes
            value="${value#\"}"
            value="${value%\"}"
            value="${value#\'}"
            value="${value%\'}"
            # Expand ~
            value="${value/#\~/$HOME}"
            # Set if not already set
            export "${key}=${!key:-$value}" 2>/dev/null || true
        fi
    done < "$env_file"
}

load_env

DEBUG="${DEBUG:-0}"
VIBEMON_CACHE_DIR="${VIBEMON_CACHE_DIR:-$HOME/.claude/cache/vibemon}"
VIBE_MONITOR_MAX_PROJECTS=10

# ============================================================================
# ANSI Colors
# ============================================================================

C_RESET="\033[0m"
C_BOLD="\033[1m"
C_DIM="\033[2m"
C_CYAN="\033[36m"
C_GREEN="\033[32m"
C_YELLOW="\033[33m"
C_RED="\033[31m"
C_MAGENTA="\033[35m"
C_BLUE="\033[34m"

# ============================================================================
# Utility Functions
# ============================================================================

debug_log() {
    [[ "$DEBUG" == "1" ]] && echo "[DEBUG] $1" >&2
}

# ============================================================================
# Git Functions
# ============================================================================

get_branch_emoji() {
    local branch="$1"
    local branch_lower
    branch_lower=$(echo "$branch" | tr '[:upper:]' '[:lower:]')

    case "$branch_lower" in
        main|master) echo "🌿" ;;
        develop|development|dev) echo "🌱" ;;
        feature/*|feat/*) echo "✨" ;;
        fix/*|bugfix/*) echo "🐛" ;;
        hotfix/*) echo "🔥" ;;
        release/*) echo "📦" ;;
        chore/*) echo "🧹" ;;
        refactor/*) echo "♻️" ;;
        docs/*|doc/*) echo "📝" ;;
        test/*|experiment/*|exp/*) echo "🧪" ;;
        *) echo "🌿" ;;
    esac
}

get_git_info() {
    local directory="$1"
    [[ -z "$directory" ]] && return

    local result
    result=$(git -C "$directory" status --porcelain=v1 --branch 2>/dev/null) || return

    [[ -z "$result" ]] && return

    local header
    header=$(echo "$result" | head -n1)
    [[ "$header" != "## "* ]] && return

    # Parse branch from "## branch" or "## branch...origin/branch"
    local branch_part="${header#\#\# }"
    local branch="${branch_part%%...*}"
    branch="${branch%% *}"

    [[ -z "$branch" || "$branch" == "HEAD" ]] && return

    # Check for changes (lines after header)
    local line_count
    line_count=$(echo "$result" | wc -l)

    if [[ $line_count -gt 1 ]]; then
        echo " git:($branch *)"
    else
        echo " git:($branch)"
    fi
}

# ============================================================================
# Formatting Functions
# ============================================================================

format_number() {
    local num="$1"
    [[ -z "$num" || "$num" == "null" || "$num" == "0" ]] && echo "0" && return

    if (( num >= 1000000 )); then
        printf "%.1fM" "$(echo "scale=1; $num / 1000000" | bc)"
    elif (( num >= 1000 )); then
        printf "%.1fK" "$(echo "scale=1; $num / 1000" | bc)"
    else
        echo "$num"
    fi
}

format_duration() {
    local ms="$1"
    [[ -z "$ms" || "$ms" == "null" || "$ms" == "0" ]] && echo "0s" && return

    local total_seconds=$((ms / 1000))
    local hours=$((total_seconds / 3600))
    local minutes=$(((total_seconds % 3600) / 60))
    local seconds=$((total_seconds % 60))

    if (( hours > 0 )); then
        echo "${hours}h${minutes}m"
    elif (( minutes > 0 )); then
        echo "${minutes}m${seconds}s"
    else
        echo "${seconds}s"
    fi
}

format_cost() {
    local cost="$1"
    [[ -z "$cost" || "$cost" == "null" ]] && echo "\$0.00" && return
    printf "\$%.2f" "$cost"
}

# ============================================================================
# Progress Bar
# ============================================================================

build_progress_bar() {
    local percent_str="$1"
    local width="${2:-10}"

    # Remove % sign
    local cleaned="${percent_str%\%}"
    [[ -z "$cleaned" ]] && return

    local percent="${cleaned%.*}"
    (( percent < 0 )) && percent=0
    (( percent > 100 )) && percent=100

    local filled=$((percent * width / 100))
    local empty=$((width - filled))

    # Color based on usage
    local color
    if (( percent >= 90 )); then
        color="$C_RED"
    elif (( percent >= 75 )); then
        color="$C_YELLOW"
    else
        color="$C_GREEN"
    fi

    # Build bar
    local filled_bar=""
    local empty_bar=""
    for ((i=0; i<filled; i++)); do filled_bar+="━"; done
    for ((i=0; i<empty; i++)); do empty_bar+="╌"; done

    echo -e "${color}${filled_bar}${C_RESET}${C_DIM}${empty_bar}${C_RESET} ${percent}%"
}

# ============================================================================
# Cache Functions
# ============================================================================

save_to_cache() {
    local project="$1"
    local model="$2"
    local memory="$3"

    [[ -z "$project" ]] && return

    mkdir -p "$VIBEMON_CACHE_DIR"

    local cache_file="$VIBEMON_CACHE_DIR/$project.txt"
    local timestamp
    timestamp=$(date +%s)

    # Write cache file
    cat > "$cache_file" << EOF
model=$model
memory=$memory
ts=$timestamp
EOF

    # Cleanup old cache files (keep only MAX_PROJECTS)
    local file_count
    file_count=$(find "$VIBEMON_CACHE_DIR" -name "*.txt" -type f 2>/dev/null | wc -l)

    if (( file_count > VIBE_MONITOR_MAX_PROJECTS )); then
        # Remove oldest files
        find "$VIBEMON_CACHE_DIR" -name "*.txt" -type f -printf '%T@ %p\n' 2>/dev/null | \
            sort -n | head -n $((file_count - VIBE_MONITOR_MAX_PROJECTS)) | \
            cut -d' ' -f2- | xargs rm -f 2>/dev/null || true
    fi
}

# ============================================================================
# Main
# ============================================================================

main() {
    # Read stdin
    local input
    input=$(cat)

    local model_display dir_name current_dir git_info
    local context_usage input_tokens output_tokens
    local cost duration lines_added lines_removed

    # Check if jq is available
    if command -v jq &>/dev/null; then
        # Parse JSON with jq
        model_display=$(echo "$input" | jq -r '.model.display_name // "Claude"')
        current_dir=$(echo "$input" | jq -r '.workspace.current_dir // ""')
        dir_name=$(basename "$current_dir" 2>/dev/null || echo "")

        # Context window
        local used_pct context_size curr_input cache_creation cache_read
        used_pct=$(echo "$input" | jq -r '.context_window.used_percentage // 0')
        context_size=$(echo "$input" | jq -r '.context_window.context_window_size // 0')
        curr_input=$(echo "$input" | jq -r '.context_window.current_usage.input_tokens // 0')
        cache_creation=$(echo "$input" | jq -r '.context_window.current_usage.cache_creation_input_tokens // 0')
        cache_read=$(echo "$input" | jq -r '.context_window.current_usage.cache_read_input_tokens // 0')

        # Calculate context usage
        if [[ -n "$used_pct" && "$used_pct" != "0" && "$used_pct" != "null" ]]; then
            context_usage="${used_pct%.*}%"
        elif [[ "$context_size" != "0" && "$context_size" != "null" ]]; then
            local current_tokens=$((curr_input + cache_creation + cache_read))
            if (( current_tokens > 0 )); then
                context_usage="$((current_tokens * 100 / context_size))%"
            else
                context_usage=""
            fi
        else
            context_usage=""
        fi

        # Token counts
        input_tokens=$(echo "$input" | jq -r '.context_window.total_input_tokens // 0')
        output_tokens=$(echo "$input" | jq -r '.context_window.total_output_tokens // 0')

        # Cost data
        cost=$(echo "$input" | jq -r '.cost.total_cost_usd // 0')
        duration=$(echo "$input" | jq -r '.cost.total_duration_ms // 0')
        lines_added=$(echo "$input" | jq -r '.cost.total_lines_added // 0')
        lines_removed=$(echo "$input" | jq -r '.cost.total_lines_removed // 0')

        # Git info
        git_info=""
        [[ -n "$current_dir" ]] && git_info=$(get_git_info "$current_dir")
    else
        # Fallback: use current directory, no detailed stats
        model_display="Claude"
        current_dir=$(pwd)
        dir_name=$(basename "$current_dir")
        context_usage=""
        input_tokens=""
        output_tokens=""
        cost=""
        duration=""
        lines_added=""
        lines_removed=""
        git_info=$(get_git_info "$current_dir")
    fi

    # Save to cache (background)
    local memory_int="${context_usage%\%}"
    memory_int="${memory_int:-0}"
    save_to_cache "$dir_name" "$model_display" "$memory_int" &

    # Build statusline
    local SEP=" │ "
    local parts=()

    # Directory
    parts+=("${C_BLUE}📂 ${dir_name}${C_RESET}")

    # Git info
    if [[ -n "$git_info" ]]; then
        local branch_info="${git_info# git:(}"
        branch_info="${branch_info%)}"
        local branch_name="${branch_info% \*}"
        local emoji
        emoji=$(get_branch_emoji "$branch_name")
        parts+=("${C_GREEN}${emoji} ${branch_info}${C_RESET}")
    fi

    # Model (remove "Claude " prefix)
    local short_model="${model_display#Claude }"
    parts+=("${C_MAGENTA}🤖 ${short_model}${C_RESET}")

    # Token usage
    if [[ -n "$input_tokens" && "$input_tokens" != "0" && "$input_tokens" != "null" ]]; then
        local in_fmt out_fmt
        in_fmt=$(format_number "$input_tokens")
        out_fmt=$(format_number "$output_tokens")
        parts+=("${C_CYAN}📥 ${in_fmt} 📤 ${out_fmt}${C_RESET}")
    fi

    # Cost
    if [[ -n "$cost" && "$cost" != "0" && "$cost" != "null" ]]; then
        local cost_fmt
        cost_fmt=$(format_cost "$cost")
        parts+=("${C_YELLOW}💰 ${cost_fmt}${C_RESET}")
    fi

    # Duration
    if [[ -n "$duration" && "$duration" != "0" && "$duration" != "null" ]]; then
        local duration_fmt
        duration_fmt=$(format_duration "$duration")
        parts+=("${C_DIM}⏱️ ${duration_fmt}${C_RESET}")
    fi

    # Lines changed
    if [[ -n "$lines_added" && "$lines_added" != "0" && "$lines_added" != "null" ]]; then
        local lines_part="${C_GREEN}+${lines_added}${C_RESET}"
        if [[ -n "$lines_removed" && "$lines_removed" != "0" && "$lines_removed" != "null" ]]; then
            lines_part+=" ${C_RED}-${lines_removed}${C_RESET}"
        fi
        parts+=("$lines_part")
    fi

    # Context usage with progress bar
    if [[ -n "$context_usage" ]]; then
        local progress_bar
        progress_bar=$(build_progress_bar "$context_usage")
        [[ -n "$progress_bar" ]] && parts+=("🧠 ${progress_bar}")
    fi

    # Join parts with separator
    local output=""
    for i in "${!parts[@]}"; do
        if (( i > 0 )); then
            output+="$SEP"
        fi
        output+="${parts[$i]}"
    done

    echo -ne "$output"
}

main
