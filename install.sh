#!/bin/bash
#
# Vibe Monitor Installation Script (Shell Version)
# Installs shell script hooks (.sh) and configuration for Claude Code, Kiro IDE, or OpenClaw.
#
# For Python version, use: install.py
#
# Usage:
#   # Online install (recommended)
#   curl -fsSL https://nalbam.github.io/vibe-monitor/install.sh | bash
#
#   # Local install (from cloned repo)
#   ./install.sh
#

set -euo pipefail

# GitHub raw content base URL
GITHUB_RAW_BASE="https://raw.githubusercontent.com/nalbam/vibe-monitor/main"

# Colors
C_RESET="\033[0m"
C_RED="\033[91m"
C_GREEN="\033[92m"
C_YELLOW="\033[93m"
C_CYAN="\033[96m"

# ============================================================================
# Utility Functions
# ============================================================================

colored() {
    local text="$1"
    local color="$2"
    case "$color" in
        red) echo -e "${C_RED}${text}${C_RESET}" ;;
        green) echo -e "${C_GREEN}${text}${C_RESET}" ;;
        yellow) echo -e "${C_YELLOW}${text}${C_RESET}" ;;
        cyan) echo -e "${C_CYAN}${text}${C_RESET}" ;;
        *) echo "$text" ;;
    esac
}

ask_yes_no() {
    local question="$1"
    local default="${2:-y}"
    local suffix="[Y/n]"
    [[ "$default" == "n" ]] && suffix="[y/N]"

    while true; do
        read -rp "$question $suffix: " answer
        answer="${answer:-$default}"
        case "${answer,,}" in
            y|yes) return 0 ;;
            n|no) return 1 ;;
            *) echo "Please answer 'y' or 'n'" ;;
        esac
    done
}

# ============================================================================
# File Functions
# ============================================================================

# Determine if running locally or online
SCRIPT_DIR=""
IS_ONLINE=true

if [[ -f "${BASH_SOURCE[0]}" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [[ -d "$SCRIPT_DIR/config" ]]; then
        IS_ONLINE=false
    fi
fi

get_file() {
    local path="$1"
    if [[ "$IS_ONLINE" == "true" ]]; then
        curl -fsSL "${GITHUB_RAW_BASE}/${path}"
    else
        cat "${SCRIPT_DIR}/${path}"
    fi
}

write_file() {
    local dst="$1"
    local content="$2"
    local description="$3"
    local executable="${4:-false}"

    mkdir -p "$(dirname "$dst")"
    echo "$content" > "$dst"
    [[ "$executable" == "true" ]] && chmod +x "$dst"
    echo -e "  $(colored '✓' green) $description"
}

write_file_with_diff() {
    local dst="$1"
    local content="$2"
    local description="$3"
    local executable="${4:-false}"

    mkdir -p "$(dirname "$dst")"

    if [[ -f "$dst" ]]; then
        local old_content
        old_content=$(cat "$dst")

        if [[ "$old_content" == "$content" ]]; then
            echo -e "  $(colored '✓' green) $description (no changes)"
            return 0
        fi

        echo -e "\n  $(colored '!' yellow) $description already exists"

        # Show diff
        echo -e "  $(colored 'Diff:' yellow)"
        diff -u "$dst" <(echo "$content") | head -30 | while IFS= read -r line; do
            case "$line" in
                +*) echo -e "    $(colored "$line" green)" ;;
                -*) echo -e "    $(colored "$line" red)" ;;
                @@*) echo -e "    $(colored "$line" cyan)" ;;
                *) echo "    $line" ;;
            esac
        done

        if ask_yes_no "  Overwrite $description?"; then
            echo "$content" > "$dst"
            [[ "$executable" == "true" ]] && chmod +x "$dst"
            echo -e "  $(colored '✓' green) $description (updated)"
            return 0
        else
            echo -e "  $(colored '!' yellow) $description (skipped)"
            return 1
        fi
    else
        echo "$content" > "$dst"
        [[ "$executable" == "true" ]] && chmod +x "$dst"
        echo -e "  $(colored '✓' green) $description"
        return 0
    fi
}

# ============================================================================
# Install Functions
# ============================================================================

install_claude() {
    # Install Vibe Monitor for Claude Code (Shell version)
    echo -e "\n$(colored 'Installing Vibe Monitor for Claude Code...' cyan)\n"

    local claude_home="$HOME/.claude"
    mkdir -p "$claude_home/hooks" "$claude_home/skills"

    echo "Copying files:"

    # statusline.sh
    local content
    content=$(get_file "config/claude/statusline.sh")
    write_file_with_diff "$claude_home/statusline.sh" "$content" "statusline.sh" "true"

    # hooks/vibe-monitor.sh
    content=$(get_file "config/claude/hooks/vibe-monitor.sh")
    write_file_with_diff "$claude_home/hooks/vibe-monitor.sh" "$content" "hooks/vibe-monitor.sh" "true"

    # skills
    for skill in vibemon-lock vibemon-mode; do
        content=$(get_file "config/claude/skills/$skill/SKILL.md")
        mkdir -p "$claude_home/skills/$skill"
        write_file "$claude_home/skills/$skill/SKILL.md" "$content" "skills/$skill/SKILL.md"
    done

    # settings.json (shell version)
    echo -e "\nConfiguring settings.json:"
    local settings_file="$claude_home/settings.json"
    local new_settings
    new_settings=$(get_file "config/claude/settings-sh.json")

    if [[ -f "$settings_file" ]]; then
        echo -e "  $(colored '!' yellow) settings.json exists - manual merge may be needed"
        if ask_yes_no "  Show new settings.json content?"; then
            echo "$new_settings"
        fi
        if ask_yes_no "  Overwrite settings.json?"; then
            echo "$new_settings" > "$settings_file"
            echo -e "  $(colored '✓' green) settings.json (updated)"
        else
            echo -e "  $(colored '!' yellow) settings.json (skipped)"
        fi
    else
        echo "$new_settings" > "$settings_file"
        echo -e "  $(colored '✓' green) settings.json created"
    fi

    # .env.local
    local env_content
    env_content=$(get_file "config/claude/.env.example")
    local env_local="$claude_home/.env.local"

    echo ""
    if [[ ! -f "$env_local" ]]; then
        if ask_yes_no "Create .env.local from .env.example?"; then
            write_file "$env_local" "$env_content" ".env.local"
        fi
    else
        write_file_with_diff "$env_local" "$env_content" ".env.local"
    fi

    echo -e "\n$(colored 'Claude Code installation complete!' green)"
}

install_kiro() {
    # Install Vibe Monitor for Kiro IDE (Shell version)
    echo -e "\n$(colored 'Installing Vibe Monitor for Kiro IDE...' cyan)\n"

    local kiro_home="$HOME/.kiro"
    mkdir -p "$kiro_home/hooks" "$kiro_home/agents"

    echo "Copying files:"

    # Hook files
    local hook_files=(
        "vibe-monitor-prompt-submit.kiro.hook"
        "vibe-monitor-file-created.kiro.hook"
        "vibe-monitor-file-edited.kiro.hook"
        "vibe-monitor-file-deleted.kiro.hook"
        "vibe-monitor-agent-stop.kiro.hook"
    )

    local content
    for hook_file in "${hook_files[@]}"; do
        content=$(get_file "config/kiro/hooks/$hook_file")
        write_file "$kiro_home/hooks/$hook_file" "$content" "hooks/$hook_file"
    done

    # vibe-monitor.sh
    content=$(get_file "config/kiro/hooks/vibe-monitor.sh")
    write_file_with_diff "$kiro_home/hooks/vibe-monitor.sh" "$content" "hooks/vibe-monitor.sh" "true"

    # agents/default.json (shell version)
    content=$(get_file "config/kiro/agents/default-sh.json")
    write_file_with_diff "$kiro_home/agents/default.json" "$content" "agents/default.json"

    # .env.local
    local env_content
    env_content=$(get_file "config/kiro/.env.example")
    local env_local="$kiro_home/.env.local"

    echo ""
    if [[ ! -f "$env_local" ]]; then
        if ask_yes_no "Create .env.local from .env.example?"; then
            write_file "$env_local" "$env_content" ".env.local"
        fi
    else
        write_file_with_diff "$env_local" "$env_content" ".env.local"
    fi

    echo -e "\n$(colored 'Kiro IDE installation complete!' green)"
}

install_openclaw() {
    echo -e "\n$(colored 'Installing VibeMon Plugin for OpenClaw...' cyan)\n"

    local plugin_dir="$HOME/.openclaw/extensions/vibemon-bridge"
    mkdir -p "$plugin_dir"

    echo "Copying plugin files:"

    # openclaw.plugin.json
    local content
    content=$(get_file "config/openclaw/extensions/openclaw.plugin.json")
    write_file_with_diff "$plugin_dir/openclaw.plugin.json" "$content" "openclaw.plugin.json"

    # index.mjs
    content=$(get_file "config/openclaw/extensions/index.mjs")
    write_file_with_diff "$plugin_dir/index.mjs" "$content" "index.mjs"

    echo -e "\n$(colored 'OpenClaw installation complete!' green)"
    echo -e "\n$(colored 'Next steps:' yellow)"
    echo "  1. Enable plugin in OpenClaw config (~/.openclaw/openclaw.json):"
    echo -e "     $(colored '"plugins": {
       "entries": {
         "vibemon-bridge": {
           "enabled": true,
           "config": {
             "serialEnabled": false,
             "httpEnabled": false,
             "httpUrls": ["http://127.0.0.1:19280"],
             "autoLaunch": false,
             "vibemonUrl": "https://vibemon.io",
             "vibemonToken": ""
           }
         }
       }
     }' cyan)"
    echo -e "\n$(colored 'Config options:' yellow)"
    echo "  • serialEnabled: true to send status to ESP32 via USB"
    echo "  • httpEnabled:   true to send status to Desktop App"
    echo "  • vibemonUrl:    VibeMon cloud service URL"
    echo "  • vibemonToken:  Get your token from https://vibemon.io/dashboard"
    echo ""
    echo "  2. Restart OpenClaw Gateway: openclaw gateway restart"
    echo "  3. Check logs for: [vibemon] Plugin loaded"
}

# ============================================================================
# Main
# ============================================================================

main() {
    # Reopen stdin from /dev/tty for interactive input when piped
    if [[ ! -t 0 ]]; then
        exec < /dev/tty || {
            echo "Error: Cannot open /dev/tty for interactive input."
            echo "Please run: ./install.sh"
            exit 1
        }
    fi

    local mode="online"
    [[ "$IS_ONLINE" == "false" ]] && mode="local"

    echo -e "\n$(colored '╔════════════════════════════════════════╗' cyan)"
    echo -e "$(colored '║' cyan)   Vibe Monitor Installation Script    $(colored '║' cyan)"
    echo -e "$(colored '╚════════════════════════════════════════╝' cyan)"
    echo -e "  Mode: $(colored "$mode" yellow)"

    echo -e "\nSelect platform to install:"
    echo -e "  $(colored '1)' cyan) Claude Code"
    echo -e "  $(colored '2)' cyan) Kiro IDE"
    echo -e "  $(colored '3)' cyan) OpenClaw"
    echo -e "  $(colored '4)' cyan) All"
    echo -e "  $(colored 'q)' cyan) Quit"

    while true; do
        read -rp $'\nYour choice [1/2/3/4/q]: ' choice
        case "${choice,,}" in
            1|claude)
                install_claude
                break
                ;;
            2|kiro)
                install_kiro
                break
                ;;
            3|openclaw)
                install_openclaw
                break
                ;;
            4|all)
                install_claude
                install_kiro
                install_openclaw
                break
                ;;
            q|quit|exit)
                echo -e "\nInstallation cancelled."
                exit 0
                ;;
            *)
                echo "Please enter 1, 2, 3, 4, or q"
                ;;
        esac
    done

    echo -e "\n$(colored 'Done!' green) Restart your IDE to apply changes.\n"
}

main "$@"
