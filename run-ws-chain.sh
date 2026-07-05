#!/bin/bash
# Workspace Completion build chain — phases W3..W5 in sequence via the sentinel.
# Advances on a phase's RUN COMPLETE (0); pauses+notifies on blocked(1)/cap(3); stops on CHAIN-STOP(2).
set -u
D=/Users/loganbaird/Prototype_Prism/Design-trials
cd "$D" || exit 1
LIVE="$D/kid-kode-landing/notes/SENTINEL-LIVE.md"
STATUS="$D/chain-status.txt"
WEBHOOK_FILE="$D/.notify-webhook"
PREFLIGHT="$D/kid-kode-landing/scripts/prism-autonomy-preflight.mjs"
WORKSPACE_SPEC="$D/kid-kode-landing/docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md"
ts(){ date +%H:%M:%S; }
chnotify(){
  local msg="$1"; local sound="${2:-Hero}"
  echo "[$(ts)] WS-CHAIN: $msg" >> "$LIVE"
  echo "[$(ts)] WS-CHAIN: $msg" > "$STATUS"
  ( osascript -e "display notification \"$msg\" with title \"Prism · WS-CHAIN\" sound name \"$sound\"" >/dev/null 2>&1 < /dev/null || true ) &
  [ -f "$WEBHOOK_FILE" ] && curl -s -m 5 -d "[WS-CHAIN] $msg" "$(cat "$WEBHOOK_FILE")" >/dev/null 2>&1
  return 0
}
preflight_phase(){
  local ph="$1"
  [ -f "$PREFLIGHT" ] || return 0
  node "$PREFLIGHT" --prompt "$D/PRISM-WS-$ph-PROMPT.md" --spec "$WORKSPACE_SPEC" > "$D/chain-WS-$ph-preflight.log" 2>&1
}
PHASES=( W3 W4 W5 )
chnotify "starting workspace completion — phases ${PHASES[*]}" "Submarine"
for PH in "${PHASES[@]}"; do
  [ -f "$D/CHAIN-STOP" ] && { chnotify "CHAIN-STOP — halting before $PH" "Basso"; exit 2; }
  chnotify "phase $PH starting" "Submarine"
  if ! preflight_phase "$PH"; then
    chnotify "$PH PREFLIGHT BLOCKED — see chain-WS-$PH-preflight.log. Chain paused." "Basso"
    exit 1
  fi
  ./run-surface.sh "WS-$PH" "$D/PRISM-WS-$PH-PROMPT.md" "$D/kid-kode-landing/notes/WS-$PH-REPORT.md" "PRISM-WS-$PH: RUN COMPLETE" "PRISM-WS-$PH: BLOCKED-NEEDS-FOUNDER"
  code=$?
  case "$code" in
    0) chnotify "$PH COMPLETE — advancing" "Hero" ;;
    1) chnotify "$PH BLOCKED — needs founder. Chain paused." "Basso"; exit 1 ;;
    2) chnotify "stopped at $PH (CHAIN-STOP)" "Basso"; exit 2 ;;
    3) chnotify "$PH hit resume cap — needs founder. Chain paused." "Sosumi"; exit 3 ;;
    *) chnotify "$PH exited $code — pausing." "Sosumi"; exit "$code" ;;
  esac
done
chnotify "ALL WORKSPACE PHASES COMPLETE — W-1..W-5 done. The workspace is finished. Review it." "Hero"
