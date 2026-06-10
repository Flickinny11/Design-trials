#!/bin/bash
# Reusable long-run watcher: periodic status + completion notification (macOS).
# Usage: ./notify-watch.sh <run-name> <report-file> <ledger-file>
NAME="${1:-Prism run}"; REPORT="$2"; LEDGER="$3"; INTERVAL=1200  # 20 min
notify(){ osascript -e "display notification \"$2\" with title \"Prism · $NAME\" sound name \"$3\"" 2>/dev/null; }
notify "$NAME" "Watcher armed — status every 20 min, alert on completion." "Tink"
while true; do
  AGENTS=$(ps ax -o command | grep -E '\.local/bin/claude -p' | grep -v grep | wc -l | tr -d ' ')
  if [ -f "$REPORT" ]; then
    notify "$NAME" "✅ COMPLETE — report is ready. Tell Claude: check" "Glass"
    sleep 2; osascript -e "display notification \"Run finished. Open the chat and type: check\" with title \"Prism · $NAME\" sound name \"Glass\"" 2>/dev/null
    exit 0
  fi
  if [ "$AGENTS" = "0" ]; then
    notify "$NAME" "⚠️ Agent stopped but no report — likely session limit. Tell Claude: check" "Basso"
    exit 0
  fi
  STATUS=$(grep -E 'DONE|pending|Wave|STATUS' "$LEDGER" 2>/dev/null | grep -iE 'done|in.?progress|status' | tail -1 | cut -c1-110)
  [ -z "$STATUS" ] && STATUS="working… (agents: $AGENTS)"
  notify "$NAME" "$STATUS" "Pop"
  sleep $INTERVAL
done
