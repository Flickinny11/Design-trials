#!/bin/bash
# ORRERY Atelier Sentinel — status pings + death confirmation + AUTO-RESUME after session limits + completion alert.
# Stop manually: touch ./SENTINEL-STOP
cd /Users/loganbaird/Prototype_Prism/Design-trials || exit 1

NAME="ORRERY Atelier F5.3"
REPORT="kid-kode-landing/notes/ORRERY-ATELIER-REPORT.md"
LEDGER="kid-kode-landing/notes/ORRERY-ATELIER-PROGRESS.md"
PROMPT="./ORRERY-ATELIER-RESUME-COMBINED.md"
RUNLOG="./orrery-atelier-run.log"

# Try Fable 5 first; if unavailable, fall back to Opus 4.8
MODEL_PRIMARY="claude-fable-5"
MODEL_FALLBACK="claude-opus-4-8"

MAXRESUMES=6
RESUMES=0
TICK=0

notify(){ osascript -e "display notification \"$1\" with title \"Prism · $NAME\" sound name \"$2\"" 2>/dev/null; }
agents(){ pgrep -f '\.local/bin/claude -p' 2>/dev/null | wc -l | tr -d ' '; }

pick_model(){
  # Probe Fable 5 first
  PROBE=$(unset NODE_ENV; cd /tmp && /Users/loganbaird/.local/bin/claude -p "Say OK" --model "$MODEL_PRIMARY" --output-format text < /dev/null 2>&1 | tail -1)
  if echo "$PROBE" | grep -q "OK"; then
    echo "$MODEL_PRIMARY"
  else
    echo "$MODEL_FALLBACK"
  fi
}

launch(){
  MODEL=$(pick_model)
  echo "$(date) launching with $MODEL" >> ./sentinel.log
  unset NODE_ENV
  nohup /Users/loganbaird/.local/bin/claude -p "$(cat $PROMPT)" \
    --model "$MODEL" \
    --permission-mode bypassPermissions \
    --output-format text > "$RUNLOG" 2>&1 &
  echo "$(date) launched pid=$! model=$MODEL" >> ./sentinel.log
}

notify "ORRERY Sentinel armed: $NAME. Auto-resume on limits, up to $MAXRESUMES times." "Tink"

while true; do
  [ -f ./SENTINEL-STOP ] && notify "Sentinel stopped by STOP file." "Tink" && exit 0
  [ -f "$REPORT" ] && notify "✅ ORRERY ATELIER COMPLETE — report ready. Tell Claude: check" "Glass" && exit 0

  if [ "$(agents)" = "0" ]; then
    sleep 30; [ "$(agents)" != "0" ] && continue
    sleep 30; [ "$(agents)" != "0" ] && continue
    [ -f "$REPORT" ] && continue

    if [ $RESUMES -ge $MAXRESUMES ]; then
      notify "⚠️ Max auto-resumes ($MAXRESUMES) reached. Tell Claude: check" "Basso"
      exit 0
    fi

    # Probe for available session window
    PROBE=$(unset NODE_ENV; cd /tmp && /Users/loganbaird/.local/bin/claude -p "Say OK" --model "$MODEL_FALLBACK" --output-format text < /dev/null 2>&1 | tail -1)
    if echo "$PROBE" | grep -q "OK"; then
      RESUMES=$((RESUMES+1))
      cd /Users/loganbaird/Prototype_Prism/Design-trials
      launch
      notify "🔄 Auto-resumed (#$RESUMES) after interruption." "Submarine"
      sleep 120
    else
      notify "⏸ Session limit active — will retry every 15 min and auto-resume." "Pop"
      sleep 900
    fi
    continue
  fi

  TICK=$((TICK+30))
  if [ $TICK -ge 1200 ]; then
    TICK=0
    S=$(grep -iE 'wave|phase|done|error|pass|fail' "$LEDGER" 2>/dev/null | tail -1 | cut -c1-110)
    [ -z "$S" ] && S="working… ($(agents) agents running)"
    notify "$S" "Pop"
  fi
  sleep 30
done
