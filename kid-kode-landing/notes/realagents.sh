#!/bin/bash
# Robust v4 build-agent counter. Build agent runs as: claude -p "<prompt>" ...
# pgrep -f matches it reliably; (ps|grep fails because the multi-line prompt arg breaks line matching).
# claude-mem zombies run as `claude --output-format stream-json` -> no "claude -p" -> naturally excluded.
# Subtract the transient "Say OK" session probe so it can never miscount as a live agent.
T=$(pgrep -f '\.local/bin/claude -p' 2>/dev/null | wc -l | tr -d ' ')
P=$(pgrep -f 'claude.*Say OK' 2>/dev/null | wc -l | tr -d ' ')
echo $(( ${T:-0} - ${P:-0} ))
