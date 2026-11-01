#!/usr/bin/env bash
# Quick launcher for VeloPulse Desktop App
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

APPIMAGE="$DIR/VeloPulse.AppImage"
if [ ! -f "$APPIMAGE" ]; then
    APPIMAGE="$DIR/VeloPulse-x86_64.AppImage"
fi

if [ -f "$APPIMAGE" ]; then
    "$APPIMAGE" "$@" 2>/dev/null || "$APPIMAGE" --appimage-extract-and-run "$@"
elif [ -f "$DIR/release/linux-unpacked/velopulse" ]; then
    "$DIR/release/linux-unpacked/velopulse" "$@"
else
    cd "$DIR" && npm start
fi
