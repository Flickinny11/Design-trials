#!/bin/bash
# run-shell-chain-B.sh — queues W5B (Ship Anywhere) behind the main SHELL chain.
set -u
cd "$(dirname "$0")"
NOTES="kid-kode-landing/notes"
note(){ echo "[$(date +%H:%M:%S)] SHELL-CHAIN-B: $*" | tee -a "$NOTES/SENTINEL-LIVE.md" | tee -a shell-chain-B.out; }
note "QUEUED — waiting for SHELL CHAIN COMPLETE (W1..W8) before arming W5B."
while true; do
  [[ -f CHAIN-STOP ]] && { note "CHAIN-STOP seen — exiting queue."; exit 2; }
  grep -q "SHELL CHAIN COMPLETE" shell-chain.out 2>/dev/null && break
  sleep 120
done
note "Main chain verified complete — arming SHELL-W5B."
./run-surface-v2.sh SHELL-W5B "$PWD/SHELL-W5B-SHIP-ANYWHERE-PROMPT.md" "$PWD/$NOTES/SHELL-W5B-REPORT.md" "PRISM-SHELL-W5B: RUN COMPLETE" "PRISM-SHELL-W5B: BLOCKED-NEEDS-FOUNDER" >> sentinel-SHELL-W5B.out 2>&1
RC=$?
if [[ -f "$NOTES/SHELL-W5B-REPORT.md" ]] && grep -qF "PRISM-SHELL-W5B: RUN COMPLETE" "$NOTES/SHELL-W5B-REPORT.md"; then
  note "SHELL-W5B COMPLETE — Ship Anywhere landed. Full shippable pipeline done."
  osascript -e 'display notification "W5B complete — Ship Anywhere landed." with title "Prism SHELL chain B" sound name "Glass"' 2>/dev/null
  exit 0
fi
note "SHELL-W5B ended rc=$RC without complete marker — review."
osascript -e 'display notification "W5B needs review" with title "Prism SHELL chain B" sound name "Basso"' 2>/dev/null
exit 4
