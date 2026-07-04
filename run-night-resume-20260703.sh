#!/bin/bash
# run-night-resume-20260703.sh — founder-authorized 2026-07-03 resume.
# F1/F2 verified COMPLETE (markers present). Runs F3 (resume) -> F4 only,
# then emits the exact FINISH completion line so run-masterpiece-chain.sh
# (queued separately) arms M1 -> M2. Halts on BLOCKED / CHAIN-STOP / no marker.
set -u
cd "$(dirname "$0")"
export HARNESS_MODEL="${HARNESS_MODEL:-claude-fable-5}"
NOTES="kid-kode-landing/notes"
FEED="$NOTES/SENTINEL-LIVE.md"
echo $$ > .finish-chain.pid
note() { echo "[$(date +%H:%M:%S)] FINISH-CHAIN: $*" | tee -a "$FEED" | tee -a finish-chain.out; }

declare -a NAMES=(FINISH-F3 FINISH-F4)
declare -a PROMPTS=(FINISH-F3-SHIPPABLE-PROMPT.md FINISH-F4-CERTIFICATION-PROMPT.md)
declare -a REPORTS=("$NOTES/FINISH-F3-SHIPPABLE-REPORT.md" "$NOTES/FINISH-F4-CERTIFICATION-REPORT.md")

note "RESUME ARMED (founder 2026-07-03) — F3 resume -> F4 certification (model=$HARNESS_MODEL). F1/F2 markers verified present."
for i in 0 1; do
  NAME="${NAMES[$i]}"; PROMPT="$PWD/${PROMPTS[$i]}"; REPORT="$PWD/${REPORTS[$i]}"
  DONE_MARK="PRISM-${NAME}: RUN COMPLETE"; BLOCK_MARK="PRISM-${NAME}: BLOCKED-NEEDS-FOUNDER"
  if [[ -f CHAIN-STOP ]]; then note "CHAIN-STOP present — halting before $NAME."; exit 2; fi
  note "launching $NAME"
  ./run-surface.sh "$NAME" "$PROMPT" "$REPORT" "$DONE_MARK" "$BLOCK_MARK" >> "sentinel-${NAME}.out" 2>&1
  if [[ -f "$REPORT" ]] && grep -qF "$BLOCK_MARK" "$REPORT"; then
    note "$NAME BLOCKED — founder decision needed. Chain halted."
    osascript -e "display notification \"$NAME blocked — founder decision needed\" with title \"Prism FINISH resume\" sound name \"Basso\"" 2>/dev/null
    exit 3
  fi
  if [[ ! -f "$REPORT" ]] || ! grep -qF "$DONE_MARK" "$REPORT"; then
    note "$NAME ended WITHOUT its complete marker — halting for review."
    osascript -e "display notification \"$NAME ended without completion — review\" with title \"Prism FINISH resume\" sound name \"Basso\"" 2>/dev/null
    exit 4
  fi
  note "$NAME COMPLETE ✓"
done
note "ALL FINISH PHASES COMPLETE — F1..F4 done. Certification + merge prep ready for founder review."
osascript -e 'display notification "FINISH chain complete — F1..F4 all green." with title "Prism FINISH resume" sound name "Glass"' 2>/dev/null
exit 0
