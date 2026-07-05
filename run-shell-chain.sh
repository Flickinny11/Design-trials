#!/bin/bash
# run-shell-chain.sh — SHELL W1→W8 on the adaptive launcher (v2).
# Founder-authorized 2026-07-04. Halts on BLOCKED / CHAIN-STOP / missing marker.
# Model policy lives in .harness-model (fable|opus|auto) — switchable any time.
set -u
cd "$(dirname "$0")"
NOTES="kid-kode-landing/notes"
FEED="$NOTES/SENTINEL-LIVE.md"
note() { echo "[$(date +%H:%M:%S)] SHELL-CHAIN: $*" | tee -a "$FEED" | tee -a shell-chain.out; }

declare -a NAMES=(SHELL-W1 SHELL-W1A SHELL-W2 SHELL-W3 SHELL-W4 SHELL-W5 SHELL-W6 SHELL-W7 SHELL-W8)
declare -a PROMPTS=(SHELL-W1-BUILDER-SHELL-PROMPT.md SHELL-W1A-ACCOUNTS-TENANCY-PROMPT.md SHELL-W2-INTAKE-PROMPT.md SHELL-W3-INTEGRATIONS-PROMPT.md SHELL-W4-DASHBOARD-PROMPT.md SHELL-W5-CONDUCTOR-DEPLOY-PROMPT.md SHELL-W6-LANDING-PROMPT.md SHELL-W7-COLLAB-SETTINGS-PROMPT.md SHELL-W8-SR-BENCHMARK-PROMPT.md)

note "SHELL CHAIN ARMED — W1..W8 sequential on run-surface-v2 (policy: $(cat .harness-model 2>/dev/null || echo auto)). W0 verified COMPLETE."
for i in "${!NAMES[@]}"; do
  NAME="${NAMES[$i]}"; PROMPT="$PWD/${PROMPTS[$i]}"
  REPORT="$PWD/$NOTES/${NAME}-REPORT.md"
  DONE_MARK="PRISM-${NAME}: RUN COMPLETE"; BLOCK_MARK="PRISM-${NAME}: BLOCKED-NEEDS-FOUNDER"
  if [[ -f CHAIN-STOP ]]; then note "CHAIN-STOP present — halting before $NAME."; exit 2; fi
  if [[ -f "$REPORT" ]] && grep -qF "$DONE_MARK" "$REPORT"; then note "$NAME already COMPLETE — skipping."; continue; fi
  note "launching $NAME"
  ./run-surface-v2.sh "$NAME" "$PROMPT" "$REPORT" "$DONE_MARK" "$BLOCK_MARK" >> "sentinel-${NAME}.out" 2>&1
  RC=$?
  if [[ $RC -eq 2 ]]; then note "CHAIN-STOP during $NAME — halting."; exit 2; fi
  if [[ -f "$REPORT" ]] && grep -qF "$BLOCK_MARK" "$REPORT"; then
    note "$NAME BLOCKED — founder decision needed. Chain halted."
    osascript -e "display notification \"$NAME blocked — founder decision needed\" with title \"Prism SHELL chain\" sound name \"Basso\"" 2>/dev/null
    exit 3
  fi
  if [[ ! -f "$REPORT" ]] || ! grep -qF "$DONE_MARK" "$REPORT"; then
    note "$NAME ended WITHOUT its complete marker (rc=$RC) — halting for review."
    osascript -e "display notification \"$NAME ended without completion — review\" with title \"Prism SHELL chain\" sound name \"Basso\"" 2>/dev/null
    exit 4
  fi
  note "$NAME COMPLETE ✓"
done
note "SHELL CHAIN COMPLETE — W1..W8 all green. The AI app builder UI is built, verified, and ready for founder review."
osascript -e 'display notification "SHELL chain complete — W1..W8 all green." with title "Prism SHELL chain" sound name "Glass"' 2>/dev/null
exit 0
