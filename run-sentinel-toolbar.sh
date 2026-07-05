#!/bin/bash
# ORRERY-TOOLBAR Sentinel (v4, clean rebuild).
# - Uses the CORRECTED build-agent counter (notes/realagents.sh).
# - Completion = marker STRING present in REPORT *AND* agents==0 (true v4 rule; NOT bare file-existence).
# - Confirmed-dead (two checks 30s apart) before any resume; generous cap so it can never storm.
# - Opus only (Fable-5 suspended) with a session-window probe to absorb 5-hour limits.
# Stop: touch ./TOOLBAR-STOP
set -u
D=/Users/loganbaird/Prototype_Prism/Design-trials
cd "$D" || exit 1
CLAUDE=/Users/loganbaird/.local/bin/claude
PROMPT="$D/PRISM-TOOLBAR-PROMPT.md"
REPORT="$D/kid-kode-landing/notes/TOOLBAR-REPORT.md"
LEDGER="$D/kid-kode-landing/notes/TOOLBAR-PROGRESS.md"
FEED="$D/kid-kode-landing/notes/MONITOR-FEED.md"
STATUS="$D/toolbar-status.txt"
RUNLOG="$D/prism-toolbar-run.log"
COUNTER="$D/kid-kode-landing/notes/realagents.sh"
MODEL="claude-opus-4-8"
MARKER="PRISM-TOOLBAR: RUN COMPLETE"
MAXRESUMES=10
RESUMES=0
TICK=0

ts(){ date +%H:%M; }
agents(){ bash "$COUNTER" 2>/dev/null || echo 0; }
note(){ echo "[$(ts)] TOOLBAR-SENTINEL: $1" >> "$FEED"; echo "[$(ts)] $1" > "$STATUS"; osascript -e "display notification \"$1\" with title \"Prism - ORRERY Toolbar\"" >/dev/null 2>&1; }
marker_present(){ [ -f "$REPORT" ] && [ "$(grep -c "$MARKER" "$REPORT" 2>/dev/null || echo 0)" -ge 1 ]; }

session_open(){
  local p
  p=$(unset NODE_ENV; cd /tmp && "$CLAUDE" -p "Say OK" --model "$MODEL" --output-format text < /dev/null 2>&1 | tail -1)
  echo "$p" | grep -q "OK"
}

launch(){
  unset NODE_ENV
  ( nohup "$CLAUDE" -p "$(cat "$PROMPT")" --model "$MODEL" --permission-mode bypassPermissions --output-format text < /dev/null > "$RUNLOG" 2>&1 & )
  note "launched TOOLBAR build agent on $MODEL (resume #$RESUMES)"
}

note "ARMED: ORRERY-TOOLBAR sentinel. v4 rule (marker+quiet), corrected counter, cap=$MAXRESUMES. Stop: touch TOOLBAR-STOP"

while true; do
  [ -f "$D/TOOLBAR-STOP" ] && { note "TOOLBAR-STOP seen - exiting (agents left as-is)."; exit 0; }

  if marker_present && [ "$(agents)" -eq 0 ]; then
    note "DONE: ORRERY-TOOLBAR COMPLETE (marker + quiet). Tell Claude: check"
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
    S=$(grep -iE 'hub|wave|gate|pass|fail|done|TOOLBAR' "$LEDGER" 2>/dev/null | tail -1 | cut -c1-120)
    [ -z "$S" ] && S="working... ($A build agents live)"
    note "$S"
  fi
  sleep 30
done
