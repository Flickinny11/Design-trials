#!/bin/bash
cd /Users/loganbaird/Prototype_Prism/Design-trials || exit 1
unset NODE_ENV
LOG=guidedtips-debug.log
echo "=== MANUAL DEBUG LAUNCH start $(date +%H:%M:%S) ===" >> "$LOG"
/Users/loganbaird/.local/bin/claude -p "$(cat GUIDED-TIPS-PROMPT.md)" --model claude-opus-4-8 --permission-mode bypassPermissions --output-format text >> "$LOG" 2>&1
RC=$?
echo "=== MANUAL DEBUG end EXIT_CODE=$RC at $(date +%H:%M:%S) ===" >> "$LOG"
