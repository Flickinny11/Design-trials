#!/bin/bash
# Sentinel v3: status pings + death confirmation + AUTO-RESUME after session limits + completion alert.
# Stop manually: touch ./SENTINEL-STOP
cd /Users/loganbaird/Prototype_Prism/Design-trials || exit 1
NAME="Physics-Fluid Pack"; REPORT="kid-kode-landing/notes/PHYSICS-FLUID-REPORT.md"
LEDGER="kid-kode-landing/notes/verification/PHYSICS-FLUID-PROGRESS.md"
PROMPT="./PHYSICS-FLUID-RESUME-COMBINED.md"; RUNLOG="./physics-fluid-run.log"
MAXRESUMES=6; RESUMES=0; TICK=0
notify(){ osascript -e "display notification \"$1\" with title \"Prism · $NAME\" sound name \"$2\"" 2>/dev/null; }
agents(){ c=0; for p in $(pgrep -f 'claude -p' 2>/dev/null); do case "$(ps -p $p -o comm= 2>/dev/null)" in *claude) c=$((c+1));; esac; done; echo $c; }
launch(){ unset NODE_ENV; nohup /Users/loganbaird/.local/bin/claude -p "$(cat $PROMPT)" --model claude-opus-4-8 --permission-mode bypassPermissions --output-format text > "$RUNLOG" 2>&1 & echo "$(date) launched $!" >> ./sentinel.log; }
notify "Sentinel v3 armed: status pings, auto-resume on session limits." "Tink"
while true; do
  [ -f ./SENTINEL-STOP ] && notify "Sentinel stopped by STOP file." "Tink" && exit 0
  [ -f "$REPORT" ] && notify "✅ COMPLETE — report ready. Tell Claude: check" "Glass" && exit 0
  if [ "$(agents)" = "0" ]; then
    sleep 30; [ "$(agents)" != "0" ] && continue
    sleep 30; [ "$(agents)" != "0" ] && continue
    [ -f "$REPORT" ] && continue
    if [ $RESUMES -ge $MAXRESUMES ]; then notify "⚠️ Max auto-resumes reached. Tell Claude: check" "Basso"; exit 0; fi
    PROBE=$(unset NODE_ENV; cd /tmp && /Users/loganbaird/.local/bin/claude -p "Say OK" --model claude-opus-4-8 --output-format text < /dev/null 2>&1 | tail -1)
    if echo "$PROBE" | grep -q "OK"; then
      RESUMES=$((RESUMES+1)); cd /Users/loganbaird/Prototype_Prism/Design-trials
      launch; notify "🔄 Auto-resumed (#$RESUMES) after interruption." "Submarine"; sleep 120
    else
      notify "⏸ Session limit active — will retry every 15 min and auto-resume." "Pop"; sleep 900
    fi
    continue
  fi
  TICK=$((TICK+30))
  if [ $TICK -ge 1200 ]; then TICK=0; S=$(grep -iE 'phase|wave|ckpt|status' "$LEDGER" 2>/dev/null | tail -1 | cut -c1-110); [ -z "$S" ] && S="working… ($(agents) agents)"; notify "$S" "Pop"; fi
  sleep 30
done
