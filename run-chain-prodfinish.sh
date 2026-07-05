#!/bin/bash
cd /Users/loganbaird/Prototype_Prism/Design-trials || exit 1
CUR=kid-kode-landing/notes/PROD-FINISH-REPORT.md
MARK='PROD-FINISH: RUN COMPLETE'
NEXTREP=kid-kode-landing/notes/NODE-EDITOR-REPORT.md
agents(){ c=0; for p in $(pgrep -f 'claude -p'); do case "$(ps -p $p -o comm=)" in *claude) c=$((c+1));; esac; done; echo $c; }
QUIET=0
while true; do
  [ -f ./CHAIN-STOP ] && exit 0
  [ -f "$NEXTREP" ] && exit 0
  if grep -qF "$MARK" "$CUR" 2>/dev/null && [ "$(agents)" = 0 ]; then QUIET=$((QUIET+1)); else QUIET=0; fi
  [ $QUIET -ge 3 ] && break
  sleep 60
done
while true; do
  [ -f ./CHAIN-STOP ] && exit 0
  P=$(cd /tmp && /Users/loganbaird/.local/bin/claude -p 'Say OK' --model claude-opus-4-8 --output-format text </dev/null 2>&1 | tail -1)
  echo "$P" | grep -q OK && break
  sleep 600
done
cd /Users/loganbaird/Prototype_Prism/Design-trials
unset NODE_ENV
nohup /Users/loganbaird/.local/bin/claude -p "$(cat ./NODE-EDITOR-PROMPT.md)" --model claude-opus-4-8 --permission-mode bypassPermissions --output-format text > ./node-editor-run.log 2>&1 &
echo "$(date) chain-fired Node Editor pid=$!" >> ./sentinel.log
sleep 10
nohup bash ./run-sentinel-nodeeditor.sh > ./sentinel-nodeeditor-out.log 2>&1 </dev/null &
osascript -e 'display notification "Auto-fired Node Editor (sentinel armed)" with title "Prism Chain" sound name "Submarine"' 2>/dev/null
exit 0
