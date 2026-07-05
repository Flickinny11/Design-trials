#!/bin/bash
# ORRERY autonomous chain: F5.5-POLISH -> F6-WORLD-WEAVE -> F7-RESPONSIVE-PERF.
# Each phase: launch -> wait for its unique completion marker + agent-quiet -> on death auto-resume
# (NO cap, with a session-window probe so 5-hour limits are absorbed) -> fall through to next phase.
# The operator never says "go" between phases. Stop with: touch CHAIN-STOP
D=/Users/loganbaird/Prototype_Prism/Design-trials
cd "$D" || exit 1
CLAUDE=/Users/loganbaird/.local/bin/claude
FEED="$D/kid-kode-landing/notes/MONITOR-FEED.md"
STATUS="$D/chain-orrery-status.txt"
MODEL_PRIMARY="claude-fable-5"     # preferred; auto-falls back to opus if unavailable
MODEL_FALLBACK="claude-opus-4-8"

ts(){ date +%H:%M; }
realagents(){ bash /tmp/realagents.sh 2>/dev/null || echo 0; }
note(){
  echo "[$(ts)] CHAIN-ORRERY: $1" >> "$FEED"
  echo "[$(ts)] $1" > "$STATUS"
  osascript -e "display notification \"$1\" with title \"ORRERY Chain\"" >/dev/null 2>&1
}

# Pick a model that has an open session window. Probes Fable first, falls back to Opus.
# Returns empty string if NO window is open (caller should wait + retry).
pick_model(){
  local p
  p=$(unset NODE_ENV; cd /tmp && "$CLAUDE" -p "Say OK" --model "$MODEL_PRIMARY" --output-format text < /dev/null 2>&1 | tail -1)
  if echo "$p" | grep -q "OK"; then echo "$MODEL_PRIMARY"; return; fi
  p=$(unset NODE_ENV; cd /tmp && "$CLAUDE" -p "Say OK" --model "$MODEL_FALLBACK" --output-format text < /dev/null 2>&1 | tail -1)
  if echo "$p" | grep -q "OK"; then echo "$MODEL_FALLBACK"; return; fi
  echo ""
}

launch(){
  # $1 = prompt file (relative to D), $2 = runtag (for run.log name)
  local model
  # Wait for an open session window (absorbs 5-hour limits), retry every 15 min.
  while true; do
    [ -f "$D/CHAIN-STOP" ] && { note "CHAIN-STOP seen during launch wait, exiting"; exit 0; }
    model=$(pick_model)
    [ -n "$model" ] && break
    note "session limit — retrying launch of $2 in 15 min"
    sleep 900
  done
  note "launching $2 on $model"
  unset NODE_ENV
  ( nohup "$CLAUDE" -p "$(cat "$D/$1")" --model "$model" --permission-mode bypassPermissions --output-format text > "$D/$2-run.log" 2>&1 & )
}

run_until_done(){
  # $1=prompt  $2=runtag  $3=report-relpath  $4=marker
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
      note "$2 stopped without marker -> resume"
      launch "$1" "$2"
      sleep 100
    fi
    sleep 60
  done
}

note "CHAIN ARMED: F5.5-POLISH -> F6-WORLD-WEAVE -> F7-RESPONSIVE-PERF (serial, auto-resume, no go needed)"
run_until_done ORRERY-F5_5-PROMPT.md orr-f55 kid-kode-landing/notes/ORRERY-F5_5-REPORT.md "ORRERY-F5.5: RUN COMPLETE"
run_until_done ORRERY-F6-PROMPT.md orr-f6 kid-kode-landing/notes/ORRERY-F6-REPORT.md "ORRERY-F6: RUN COMPLETE"
run_until_done ORRERY-F7-PROMPT.md orr-f7 kid-kode-landing/notes/ORRERY-F7-REPORT.md "ORRERY-F7: RUN COMPLETE"
note "✅ ALL ORRERY PHASES COMPLETE (F5.5 + F6 + F7). Tell Claude: check"
