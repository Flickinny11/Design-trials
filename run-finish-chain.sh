#!/bin/bash
# run-finish-chain.sh — FINISH chain F1→F4 via run-surface.sh (Fable 5, sequential)
# Halts on: BLOCKED marker, CHAIN-STOP file, or a phase ending without its marker.
set -u
cd "$(dirname "$0")"
export HARNESS_MODEL="${HARNESS_MODEL:-claude-fable-5}"
NOTES="kid-kode-landing/notes"
FEED="$NOTES/SENTINEL-LIVE.md"

declare -a NAMES=(FINISH-F1 FINISH-F2 FINISH-F3 FINISH-F4)
declare -a PROMPTS=(FINISH-F1-KEYFRAME-PROMPT.md FINISH-F2-PARITY-PROMPT.md FINISH-F3-SHIPPABLE-PROMPT.md FINISH-F4-CERTIFICATION-PROMPT.md)
declare -a REPORTS=("$NOTES/FINISH-F1-KEYFRAME-REPORT.md" "$NOTES/FINISH-F2-PARITY-REPORT.md" "$NOTES/FINISH-F3-SHIPPABLE-REPORT.md" "$NOTES/FINISH-F4-CERTIFICATION-REPORT.md")

note() { echo "[$(date +%H:%M:%S)] FINISH-CHAIN: $*" | tee -a "$FEED"; }

note "ARMED — F1 keyframe premium → F2 parity → F3 shippable → F4 certification (model=$HARNESS_MODEL)"
for i in 0 1 2 3; do
  NAME="${NAMES[$i]}"; PROMPT="$PWD/${PROMPTS[$i]}"; REPORT="$PWD/${REPORTS[$i]}"
  DONE_MARK="PRISM-${NAME}: RUN COMPLETE"; BLOCK_MARK="PRISM-${NAME}: BLOCKED-NEEDS-FOUNDER"
  if [[ -f CHAIN-STOP ]]; then note "CHAIN-STOP present — halting before $NAME."; exit 2; fi
  note "launching $NAME"
  ./run-surface.sh "$NAME" "$PROMPT" "$REPORT" "$DONE_MARK" "$BLOCK_MARK" >> "sentinel-${NAME}.out" 2>&1
  if [[ -f "$REPORT" ]] && grep -qF "$BLOCK_MARK" "$REPORT"; then
    note "$NAME BLOCKED — founder decision needed. Chain halted."
    osascript -e "display notification \"$NAME blocked — founder decision needed\" with title \"Prism FINISH chain\" sound name \"Basso\"" 2>/dev/null
    exit 3
  fi
  if [[ ! -f "$REPORT" ]] || ! grep -qF "$DONE_MARK" "$REPORT"; then
    note "$NAME ended WITHOUT its complete marker — halting for review."
    osascript -e "display notification \"$NAME ended without completion — review\" with title \"Prism FINISH chain\" sound name \"Basso\"" 2>/dev/null
    exit 4
  fi
  note "$NAME COMPLETE ✓"
done
note "ALL FINISH PHASES COMPLETE — F1..F4 done. Certification + merge prep ready for founder review."
osascript -e 'display notification "FINISH chain complete — F1..F4 all green. Review certification." with title "Prism FINISH chain" sound name "Glass"' 2>/dev/null
exit 0
