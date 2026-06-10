#!/bin/bash
# Long-run watcher v2: pgrep-based detection + 3-strike death confirmation.
NAME="${1:-Prism run}"; REPORT="$2"; LEDGER="$3"; INTERVAL=1200
notify(){ osascript -e "display notification \"$2\" with title \"Prism · $NAME\" sound name \"$3\"" 2>/dev/null; }
agents(){ pgrep -f '\.local/bin/claude -p' 2>/dev/null | wc -l | tr -d ' '; }
notify "$NAME" "Watcher v2 armed — status every 20 min, alert on completion." "Tink"
MISSES=0; TICK=0
while true; do
  if [ -f "$REPORT" ]; then
    notify "$NAME" "✅ COMPLETE — report ready. Tell Claude: check" "Glass"; exit 0
  fi
  if [ "$(agents)" = "0" ]; then
    MISSES=$((MISSES+1))
    if [ $MISSES -ge 3 ]; then
      notify "$NAME" "⚠️ Agent stopped, no report (confirmed 3x). Tell Claude: check" "Basso"; exit 0
    fi
    sleep 30; continue
  fi
  MISSES=0; TICK=$((TICK+30))
  if [ $TICK -ge $INTERVAL ]; then
    TICK=0
    STATUS=$(grep -iE 'phase|wave|status|ckpt' "$LEDGER" 2>/dev/null | tail -1 | cut -c1-110)
    [ -z "$STATUS" ] && STATUS="working… (agents: $(agents))"
    notify "$NAME" "$STATUS" "Pop"
  fi
  sleep 30
done
