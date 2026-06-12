#!/bin/bash
# CHAIN-RUNNER: auto-fires the next queued run when the current one completes. Stop: touch ./CHAIN-STOP
cd /Users/loganbaird/Prototype_Prism/Design-trials || exit 1
CUR_REPORT="kid-kode-landing/notes/PRIMITIVES-EXPANSION-REPORT.md"
NEXT_NAME="Physics-Fluid Pack"; NEXT_PROMPT="./PHYSICS-FLUID-PACK-PROMPT.md"
NEXT_REPORT="kid-kode-landing/notes/PHYSICS-FLUID-REPORT.md"; NEXT_LOG="./physics-fluid-run.log"
NEXT_SENTINEL="./run-sentinel-physics.sh"
notify(){ osascript -e "display notification \"$1\" with title \"Prism · Chain\" sound name \"$2\"" 2>/dev/null; }
agents(){ c=0; for p in $(pgrep -f 'claude -p' 2>/dev/null); do case "$(ps -p $p -o comm= 2>/dev/null)" in *claude) c=$((c+1));; esac; done; echo $c; }
notify "Chain armed: will auto-fire $NEXT_NAME when the expansion run completes." "Tink"
# Phase A: wait for current run to truly finish (report exists AND agents quiet for 3 consecutive minutes)
QUIET=0
while true; do
  [ -f ./CHAIN-STOP ] && notify "Chain stopped by STOP file." "Tink" && exit 0
  [ -f "$NEXT_REPORT" ] && exit 0
  if [ -f "$CUR_REPORT" ] && [ "$(agents)" = "0" ]; then QUIET=$((QUIET+1)); else QUIET=0; fi
  [ $QUIET -ge 3 ] && break
  sleep 60
done
# Phase B: session-window probe loop, then fire
while true; do
  [ -f ./CHAIN-STOP ] && notify "Chain stopped." "Tink" && exit 0
  PROBE=$(unset NODE_ENV; cd /tmp && /Users/loganbaird/.local/bin/claude -p "Say OK" --model claude-fable-5 --output-format text < /dev/null 2>&1 | tail -1)
  echo "$PROBE" | grep -q "OK" && break
  notify "⏸ Session limit — chain retries in 15 min." "Pop"; sleep 900
done
cd /Users/loganbaird/Prototype_Prism/Design-trials
unset NODE_ENV
nohup /Users/loganbaird/.local/bin/claude -p "$(cat $NEXT_PROMPT)" --model claude-fable-5 --permission-mode bypassPermissions --output-format text > "$NEXT_LOG" 2>&1 &
echo "$(date) chain-fired $NEXT_NAME pid=$!" >> ./sentinel.log
sleep 10
nohup "$NEXT_SENTINEL" > ./sentinel-physics-out.log 2>&1 &
notify "🚀 Auto-fired: $NEXT_NAME (sentinel armed). Runway final leg." "Submarine"
exit 0
