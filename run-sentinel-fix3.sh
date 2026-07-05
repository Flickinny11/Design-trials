#!/bin/bash
# ORRERY-FIX3 Sentinel (v4, clean rebuild).
# - Uses the CORRECTED build-agent counter (notes/realagents.sh).
# - Completion = marker STRING present in REPORT *AND* agents==0 (true v4 rule; NOT bare file-existence).
# - Confirmed-dead (two checks 30s apart) before any resume; generous cap so it can never storm.
# - Opus only (Fable-5 suspended) with a session-window probe to absorb 5-hour limits.
# Stop: touch ./FIX3-STOP
set -u
D=/Users/loganbaird/Prototype_Prism/Design-trials
cd "$D" || exit 1
CLAUDE=/Users/loganbaird/.local/bin/claude
PROMPT="$D/PRISM-FIX3-CLEAN-PROMPT.md"
REPORT="$D/kid-kode-landing/notes/FIX3-REPORT.md"
LEDGER="$D/kid-kode-landing/notes/FIX3-PROGRESS.md"
FEED="$D/kid-kode-landing/notes/MONITOR-FEED.md"
STATUS="$D/fix3-status.txt"
RUNLOG="$D/prism-fix3-run.log"
COUNTER="$D/kid-kode-landing/notes/realagents.sh"
MODEL="claude-opus-4-8"
MARKER="PRISM-FIX3-CLEAN: RUN COMPLETE"
MAXRESUMES=10
RESUMES=0
TICK=0

ts(){ date +%H:%M; }
agents(){ bash "$COUNTER" 2>/dev/null || echo 0; }
note(){ echo "[$(ts)] FIX3-SENTINEL: $1" >> "$FEED"; echo "[$(ts)] $1" > "$STATUS"; osascript -e "display notification \"$1\" with title \"Prism - ORRERY Fix 3\"" >/dev/null 2>&1; }
marker_present(){ [ -f "$REPORT" ] && [ "$(grep -c "$MARKER" "$REPORT" 2>/dev/null || echo 0)" -ge 1 ]; }

session_open(){
  local p
  p=$(unset NODE_ENV; cd /tmp && "$CLAUDE" -p "Say OK" --model "$MODEL" --output-format text < /dev/null 2>&1 | tail -1)
  echo "$p" | grep -q "OK"
}

launch(){
  unset NODE_ENV
  ( nohup "$CLAUDE" -p "$(cat "$PROMPT")" --model "$MODEL" --permission-mode bypassPermissions --output-format text < /dev/null > "$RUNLOG" 2>&1 & )
  note "launched FIX3 build agent on $MODEL (resume #$RESUMES)"
}

note "ARMED: ORRERY-FIX3 sentinel. v4 rule (marker+quiet), corrected counter, cap=$MAXRESUMES. Stop: touch FIX3-STOP"

while true; do
  [ -f "$D/FIX3-STOP" ] && { note "FIX3-STOP seen - exiting (agents left as-is)."; exit 0; }

  if marker_present && [ "$(agents)" -eq 0 ]; then
    note "DONE: ORRERY-FIX3 COMPLETE (marker + quiet). Tell Claude: check"
    exit 0
  fi

  A=$(agents)
  if [ "${A:-0}" -eq 0 ]; then
    sleep 30; [ "$(agents)" -ne 0 ] && continue
    marker_present && continue
    if [ $RESUMES -ge $MAXRESUMES ]; then
      note "WARN: hit resume cap ($MAXRESUMES) without completion marker. Tell Claude: check"
      exit 0
    fi
    if session_open; then
      RESUMES=$((RESUMES+1))
      launch
      sleep 120
    else
      note "PAUSE: session window closed (5h limit?) - retrying in 15 min, will auto-resume."
      sleep 900
    fi
    continue
  fi

  TICK=$((TICK+30))
  if [ $TICK -ge 1200 ]; then
    TICK=0
    S=$(grep -iE 'hub|wave|gate|pass|fail|done|FIX3' "$LEDGER" 2>/dev/null | tail -1 | cut -c1-120)
    [ -z "$S" ] && S="working... ($A build agents live)"
    note "$S"
  fi
  sleep 30
done
