#!/bin/zsh
# chain-W9A.sh — queued sentinel (B-chain pattern). Waits for W9 RUN COMPLETE,
# then arms SHELL-WBG on run-surface-v2. Founder-directed 2026-07-05.
set -u
D=/Users/loganbaird/Prototype_Prism/Design-trials
cd "$D" || exit 1
FEED="$D/kid-kode-landing/notes/MONITOR-FEED.md"
W9_REPORT="$D/kid-kode-landing/notes/SHELL-W2D-REPORT.md"
ts(){ date +%H:%M:%S; }
echo "[$(ts)] SHELL-CHAIN-WBG: QUEUED — waiting for PRISM-W2D: RUN COMPLETE." >> "$FEED"
while true; do
  [ -f "$D/CHAIN-STOP" ] && { echo "[$(ts)] SHELL-CHAIN-WBG: CHAIN-STOP — standing down." >> "$FEED"; exit 2; }
  if [ -f "$W9_REPORT" ] && grep -qF "PRISM-W2D: RUN COMPLETE" "$W9_REPORT" \
     && [ "$(bash "$D/kid-kode-landing/notes/realagents-editorchain.sh" 2>/dev/null || echo 1)" = "0" ]; then
    echo "[$(ts)] SHELL-CHAIN-WBG: W9 verified complete + agents quiet — arming SHELL-WBG." >> "$FEED"
    exec "$D/run-surface-v2.sh" "SHELL-WBG" "$D/SHELL-WBG-PROMPT.md" \
      "$D/kid-kode-landing/notes/SHELL-WBG-REPORT.md" \
      "PRISM-SHELL-WBG: RUN COMPLETE" "PRISM-SHELL-WBG: BLOCKED-NEEDS-FOUNDER"
  fi
  sleep 120
done
