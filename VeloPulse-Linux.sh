#!/usr/bin/env bash
# VeloPulse Universal Linux Launcher
# Handles modern Linux environments (FUSE 3 / missing libfuse2 and unprivileged user namespace restrictions)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPIMAGE="$SCRIPT_DIR/release/VeloPulse-linux-x86_64.AppImage"
UNPACKED="$SCRIPT_DIR/release/linux-unpacked/velopulse"

if [ -f "$APPIMAGE" ]; then
    chmod +x "$APPIMAGE" 2>/dev/null
    exec "$APPIMAGE" --appimage-extract-and-run --no-sandbox "$@"
elif [ -f "$UNPACKED" ]; then
    chmod +x "$UNPACKED" 2>/dev/null
    exec "$UNPACKED" --no-sandbox "$@"
else
    echo "Errore: binario VeloPulse non trovato in release/"
    exit 1
fi
