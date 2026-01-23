#!/bin/bash

# Claude Monitor Desktop App Startup Script
# Runs the Electron app in background

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if app is already running
is_desktop_running() {
    curl -s "http://127.0.0.1:19280/health" \
        --connect-timeout 1 \
        --max-time 1 \
        > /dev/null 2>&1
    return $?
}

if is_desktop_running; then
    echo "Claude Monitor Desktop is already running"
    exit 0
fi

# Check if node_modules exists, if not run npm install
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "Failed to install dependencies"
        exit 1
    fi
fi

# Run the app in background
echo "Starting Claude Monitor Desktop..."
nohup npm start > /dev/null 2>&1 &

echo "Claude Monitor Desktop started (PID: $!)"
