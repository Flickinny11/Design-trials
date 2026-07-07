#!/bin/zsh
# chain-W9A.sh — queued sentinel (B-chain pattern). Waits for W9 RUN COMPLETE,
# then arms SHELL-WTPL on run-surface-v2. Founder-directed 2026-07-05.
set -u
D=/Users/loganbaird/Prototype_Prism/Design-trials
cd "$D" || exit 1
FEED="$D/kid-kode-landing/notes/MONITOR-FEED.md"
W9_REPORT="$D/kid-kode-landing/notes/SHELL-WPHOTO-REPORT.md"
ts(){ date +%H:%M:%S; }
echo "[$(ts)] SHELL-CHAIN-WTPL: QUEUED — waiting for PRISM-WPHOTO: RUN COMPLETE." >> "$FEED"
while true; do
  [ -f "$D/CHAIN-STOP" ] && { echo "[$(ts)] SHELL-CHAIN-WTPL: CHAIN-STOP — standing down." >> "$FEED"; exit 2; }
  if [ -f "$W9_REPORT" ] && grep -qF "PRISM-WPHOTO: RUN COMPLETE" "$W9_REPORT" \
     && [ "$(bash "$D/kid-kode-landing/notes/realagents-editorchain.sh" 2>/dev/null || echo 1)" = "0" ]; then
    echo "[$(ts)] SHELL-CHAIN-WTPL: W9 verified complete + agents quiet — arming SHELL-WTPL." >> "$FEED"
    exec "$D/run-surface-v2.sh" "SHELL-WTPL" "$D/SHELL-WTPL-PROMPT.md" \
      "$D/kid-kode-landing/notes/SHELL-WTPL-REPORT.md" \
      "PRISM-SHELL-WTPL: RUN COMPLETE" "PRISM-SHELL-WTPL: BLOCKED-NEEDS-FOUNDER"
  fi
  sleep 120
done
