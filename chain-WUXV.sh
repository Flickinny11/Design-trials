#!/bin/zsh
# chain-W9A.sh — queued sentinel (B-chain pattern). Waits for W9 RUN COMPLETE,
# then arms SHELL-WUXV on run-surface-v2. Founder-directed 2026-07-05.
set -u
D=/Users/loganbaird/Prototype_Prism/Design-trials
cd "$D" || exit 1
FEED="$D/kid-kode-landing/notes/MONITOR-FEED.md"
W9_REPORT="$D/kid-kode-landing/notes/SHELL-WBG-REPORT.md"
ts(){ date +%H:%M:%S; }
echo "[$(ts)] SHELL-CHAIN-WUXV: QUEUED — waiting for PRISM-WBG: RUN COMPLETE." >> "$FEED"
while true; do
  [ -f "$D/CHAIN-STOP" ] && { echo "[$(ts)] SHELL-CHAIN-WUXV: CHAIN-STOP — standing down." >> "$FEED"; exit 2; }
  if [ -f "$W9_REPORT" ] && grep -qF "PRISM-WBG: RUN COMPLETE" "$W9_REPORT" \
     && [ "$(bash "$D/kid-kode-landing/notes/realagents-editorchain.sh" 2>/dev/null || echo 1)" = "0" ]; then
    echo "[$(ts)] SHELL-CHAIN-WUXV: W9 verified complete + agents quiet — arming SHELL-WUXV." >> "$FEED"
    exec "$D/run-surface-v2.sh" "SHELL-WUXV" "$D/SHELL-WUXV-PROMPT.md" \
      "$D/kid-kode-landing/notes/SHELL-WUXV-REPORT.md" \
      "PRISM-SHELL-WUXV: RUN COMPLETE" "PRISM-SHELL-WUXV: BLOCKED-NEEDS-FOUNDER"
  fi
  sleep 120
done
