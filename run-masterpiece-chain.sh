#!/bin/bash
# run-masterpiece-chain.sh — waits for the FINISH chain to complete VERIFIED,
# then runs M1 (editor masterpiece) → M2 (watch-app masterpiece + node cert).
# Never interrupts running work. Halts on BLOCKED / CHAIN-STOP / missing marker.
set -u
cd "$(dirname "$0")"
export HARNESS_MODEL="${HARNESS_MODEL:-claude-fable-5}"
NOTES="kid-kode-landing/notes"
FEED="$NOTES/SENTINEL-LIVE.md"
note() { echo "[$(date +%H:%M:%S)] MASTERPIECE-CHAIN: $*" | tee -a "$FEED"; }

# ---- WAIT: FINISH chain must exit AND report all-complete ----
note "QUEUED — waiting for FINISH chain (F1..F4) to complete verified before arming."
FPID=$(cat .finish-chain.pid 2>/dev/null || echo "")
while [[ -n "$FPID" ]] && ps -p "$FPID" >/dev/null 2>&1; do
  [[ -f CHAIN-STOP ]] && { note "CHAIN-STOP present while queued — masterpiece chain cancelled."; exit 2; }
  sleep 60
done
if ! grep -q "ALL FINISH PHASES COMPLETE" finish-chain.out 2>/dev/null; then
  note "FINISH chain ended WITHOUT full completion — masterpiece chain will NOT start. Founder review needed."
  osascript -e 'display notification "FINISH chain ended incomplete — masterpiece queued run cancelled" with title "Prism MASTERPIECE" sound name "Basso"' 2>/dev/null
  exit 3
fi
note "FINISH chain verified complete — arming MASTERPIECE M1 → M2."
osascript -e 'display notification "F1–F4 verified complete — MASTERPIECE chain starting (M1 editor)" with title "Prism MASTERPIECE" sound name "Glass"' 2>/dev/null

declare -a NAMES=(MASTERPIECE-M1 MASTERPIECE-M2)
declare -a PROMPTS=(MASTERPIECE-M1-EDITOR-PROMPT.md MASTERPIECE-M2-APP-PROMPT.md)
declare -a REPORTS=("$NOTES/MASTERPIECE-M1-REPORT.md" "$NOTES/MASTERPIECE-M2-REPORT.md")
for i in 0 1; do
  NAME="${NAMES[$i]}"; PROMPT="$PWD/${PROMPTS[$i]}"; REPORT="$PWD/${REPORTS[$i]}"
  DONE_MARK="PRISM-${NAME}: RUN COMPLETE"; BLOCK_MARK="PRISM-${NAME}: BLOCKED-NEEDS-FOUNDER"
  [[ -f CHAIN-STOP ]] && { note "CHAIN-STOP — halting before $NAME."; exit 2; }
  note "launching $NAME"
  ./run-surface.sh "$NAME" "$PROMPT" "$REPORT" "$DONE_MARK" "$BLOCK_MARK" >> "sentinel-${NAME}.out" 2>&1
  if [[ -f "$REPORT" ]] && grep -qF "$BLOCK_MARK" "$REPORT"; then
    note "$NAME BLOCKED — founder decision needed. Halted."
    osascript -e "display notification \"$NAME blocked — founder decision needed\" with title \"Prism MASTERPIECE\" sound name \"Basso\"" 2>/dev/null
    exit 3
  fi
  if [[ ! -f "$REPORT" ]] || ! grep -qF "$DONE_MARK" "$REPORT"; then
    note "$NAME ended WITHOUT its marker — halted for review."
    osascript -e "display notification \"$NAME ended without completion — review\" with title \"Prism MASTERPIECE\" sound name \"Basso\"" 2>/dev/null
    exit 4
  fi
  note "$NAME COMPLETE ✓"
done
note "MASTERPIECE COMPLETE — M1+M2 green. Prototype ready for founder review + merge + AI-builder integration."
osascript -e 'display notification "MASTERPIECE chain complete — editor + watch app certified. Ready to bring home." with title "Prism MASTERPIECE" sound name "Glass"' 2>/dev/null
exit 0
