#!/bin/bash
# CHAIN: auto-fires App Reality when 3D Text completes. Stop: touch ./CHAIN-STOP
cd /Users/loganbaird/Prototype_Prism/Design-trials || exit 1
CUR_REPORT="kid-kode-landing/notes/TEXT-3D-REPORT.md"
NEXT_NAME="App Reality"; NEXT_PROMPT="./APP-REALITY-PROMPT.md"
NEXT_REPORT="kid-kode-landing/notes/APP-REALITY-REPORT.md"; NEXT_LOG="./app-reality-run.log"
NEXT_SENTINEL="./run-sentinel-appreality.sh"
notify(){ osascript -e "display notification \"$1\" with title \"Prism · Chain\" sound name \"$2\"" 2>/dev/null; }
agents(){ c=0; for p in $(pgrep -f 'claude -p' 2>/dev/null); do case "$(ps -p $p -o comm= 2>/dev/null)" in *claude) c=$((c+1));; esac; done; echo $c; }
notify "Chain armed: App Reality fires when 3D Text completes." "Tink"
QUIET=0
while true; do
  [ -f ./CHAIN-STOP ] && notify "Chain stopped." "Tink" && exit 0
  [ -f "$NEXT_REPORT" ] && exit 0
  if [ -f "$CUR_REPORT" ] && [ "$(agents)" = "0" ]; then QUIET=$((QUIET+1)); else QUIET=0; fi
  [ $QUIET -ge 3 ] && break
  sleep 60
done
while true; do
  [ -f ./CHAIN-STOP ] && notify "Chain stopped." "Tink" && exit 0
  PROBE=$(unset NODE_ENV; cd /tmp && /Users/loganbaird/.local/bin/claude -p "Say OK" --model claude-opus-4-8 --output-format text < /dev/null 2>&1 | tail -1)
  echo "$PROBE" | grep -q "OK" && break
  notify "⏸ Session limit — chain retries in 15 min." "Pop"; sleep 900
done
cd /Users/loganbaird/Prototype_Prism/Design-trials
unset NODE_ENV
nohup /Users/loganbaird/.local/bin/claude -p "$(cat $NEXT_PROMPT)" --model claude-opus-4-8 --permission-mode bypassPermissions --output-format text > "$NEXT_LOG" 2>&1 &
echo "$(date) chain-fired $NEXT_NAME pid=$!" >> ./sentinel.log
sleep 10
nohup "$NEXT_SENTINEL" > ./sentinel-appreality-out.log 2>&1 &
notify "🚀 Auto-fired: App Reality (sentinel armed)." "Submarine"
exit 0
