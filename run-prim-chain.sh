#!/bin/bash
# Primitive/Template System build chain — runs phases P1..P6 in sequence via the upgraded sentinel.
# Advances on a phase's RUN COMPLETE (exit 0); pauses + notifies on blocked(1)/cap(3); stops on CHAIN-STOP(2).
set -u
D=/Users/loganbaird/Prototype_Prism/Design-trials
cd "$D" || exit 1
LIVE="$D/kid-kode-landing/notes/SENTINEL-LIVE.md"
STATUS="$D/chain-status.txt"
WEBHOOK_FILE="$D/.notify-webhook"
ts(){ date +%H:%M:%S; }
chnotify(){
  local msg="$1"; local sound="${2:-Hero}"
  echo "[$(ts)] PRIM-CHAIN: $msg" >> "$LIVE"
  echo "[$(ts)] PRIM-CHAIN: $msg" > "$STATUS"
  osascript -e "display notification \"$msg\" with title \"Prism · PRIM-CHAIN\" sound name \"$sound\"" >/dev/null 2>&1
  [ -f "$WEBHOOK_FILE" ] && curl -s -m 5 -d "[PRIM-CHAIN] $msg" "$(cat "$WEBHOOK_FILE")" >/dev/null 2>&1
  return 0
}
PHASES=( P1 P2 P3 P4 P5 P6 )
chnotify "starting primitive/template system build — phases ${PHASES[*]}" "Submarine"
for PH in "${PHASES[@]}"; do
  [ -f "$D/CHAIN-STOP" ] && { chnotify "CHAIN-STOP — halting before $PH" "Basso"; exit 2; }
  chnotify "▶ phase $PH starting" "Submarine"
  ./run-surface.sh "PRIM-$PH" "$D/PRISM-PRIM-$PH-PROMPT.md" "$D/kid-kode-landing/notes/PRIM-$PH-REPORT.md" "PRISM-PRIM-$PH: RUN COMPLETE" "PRISM-PRIM-$PH: BLOCKED-NEEDS-FOUNDER"
  code=$?
  case "$code" in
    0) chnotify "✅ $PH COMPLETE — advancing" "Hero" ;;
    1) chnotify "⛔ $PH BLOCKED — needs founder. Chain paused." "Basso"; exit 1 ;;
    2) chnotify "■ stopped at $PH (CHAIN-STOP)" "Basso"; exit 2 ;;
    3) chnotify "⚠ $PH hit resume cap — needs founder. Chain paused." "Sosumi"; exit 3 ;;
    *) chnotify "? $PH exited $code — pausing." "Sosumi"; exit "$code" ;;
  esac
done
chnotify "🎉 ALL PHASES COMPLETE — full primitive/template system built. Review the routes." "Hero"
