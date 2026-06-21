#!/bin/bash
# Serial chain: POLISH -> 3D-BACKGROUNDS -> GUIDED-TIPS
# Each run: launch, monitor for its completion marker + quiet, auto-resume on death (NO cap).
# SERIAL (one agent at a time) deliberately avoids: GPU-perf interference during 60Hz verification,
# GraphScene merge conflicts, and the global-agent-counter masking that hurts concurrent sentinels.
# Stop with: touch CHAIN-STOP
D=/Users/loganbaird/Prototype_Prism/Design-trials
cd "$D" || exit 1
CLAUDE=/Users/loganbaird/.local/bin/claude
FEED="$D/kid-kode-landing/notes/MONITOR-FEED.md"
STATUS="$D/chain-status.txt"

ts(){ date +%H:%M; }
realagents(){ bash /tmp/realagents.sh 2>/dev/null || echo 0; }
note(){
  echo "[$(ts)] CHAIN: $1" >> "$FEED"
  echo "[$(ts)] $1" > "$STATUS"
  osascript -e "display notification \"$1\" with title \"Prism Chain\"" >/dev/null 2>&1
}

launch(){
  # $1 = prompt file (relative to D), $2 = runtag (for run.log name)
  unset NODE_ENV
  ( nohup "$CLAUDE" -p "$(cat "$D/$1")" --model claude-opus-4-8 --permission-mode bypassPermissions --output-format text > "$D/$2-run.log" 2>&1 & )
}

run_until_done(){
  # $1=prompt  $2=runtag  $3=report-relpath  $4=marker
  note "launching $2"
  launch "$1" "$2"
  sleep 100
  while true; do
    [ -f "$D/CHAIN-STOP" ] && { note "CHAIN-STOP seen, exiting"; exit 0; }
    M=$(grep -c "$4" "$D/$3" 2>/dev/null || echo 0)
    A=$(realagents)
    if [ "${M:-0}" -ge 1 ] && [ "${A:-0}" -eq 0 ]; then
      note "$2 COMPLETE (marker + quiet)"
      return 0
    fi
    if [ "${A:-0}" -eq 0 ]; then
      note "$2 stopped without marker -> resume (no cap)"
      launch "$1" "$2"
      sleep 100
    fi
    sleep 60
  done
}

run_until_done POLISH-PROMPT.md polish kid-kode-landing/notes/POLISH-REPORT.md "POLISH: RUN COMPLETE"
run_until_done THREE-D-BACKGROUNDS-PROMPT.md threedbg kid-kode-landing/notes/THREE-D-BACKGROUNDS-REPORT.md "THREE-D-BACKGROUNDS: RUN COMPLETE"
run_until_done GUIDED-TIPS-PROMPT.md guidedtips kid-kode-landing/notes/GUIDED-TIPS-REPORT.md "GUIDED-TIPS: RUN COMPLETE"
note "ALL THREE COMPLETE -- polish + 3D-backgrounds + guided-tips done"
