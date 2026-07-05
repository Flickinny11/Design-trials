#!/bin/bash
# Sentinel (marker-based, v4-robust): status pings + death confirmation + UNLIMITED auto-resume after
# session limits + completion alert. Completion = the exact marker line in the report AND agents==0
# (NOT mere file existence — a limit-kill leaves no marker, so it can never false-complete). No resume cap.
# Stop manually: touch ./SENTINEL-STOP
cd /Users/loganbaird/Prototype_Prism/Design-trials || exit 1
NAME="Queue Prep"
REPORT="kid-kode-landing/notes/QUEUE-PREP-REPORT.md"
LEDGER="kid-kode-landing/notes/verification/QUEUE-PREP-PROGRESS.md"
PROMPT="./QUEUE-PREP-PROMPT.md"
RUNLOG="./queue-prep-run.log"
MARKER="QUEUE-PREP: RUN COMPLETE"
RESUMES=0; TICK=0
notify(){ osascript -e "display notification \"$1\" with title \"Prism · $NAME\" sound name \"$2\"" 2>/dev/null; }
agents(){ c=0; for p in $(pgrep -f 'claude -p' 2>/dev/null); do case "$(ps -p $p -o comm= 2>/dev/null)" in *claude) c=$((c+1));; esac; done; echo $c; }
done_marker(){ [ -f "$REPORT" ] && grep -q "$MARKER" "$REPORT" 2>/dev/null; }
launch(){ unset NODE_ENV; nohup /Users/loganbaird/.local/bin/claude -p "$(cat $PROMPT)" --model claude-opus-4-8 --permission-mode bypassPermissions --output-format text > "$RUNLOG" 2>&1 & echo "$(date) launched $!" >> ./sentinel.log; }
notify "Sentinel armed (marker-based, unlimited resume): Queue Prep." "Tink"
while true; do
  [ -f ./SENTINEL-STOP ] && notify "Sentinel stopped by STOP file." "Tink" && exit 0
  if done_marker && [ "$(agents)" = "0" ]; then notify "✅ PROD COMPLETE — report ready. Tell Claude: check" "Glass" && exit 0; fi
  if [ "$(agents)" = "0" ]; then
    sleep 30; [ "$(agents)" != "0" ] && continue
    sleep 30; [ "$(agents)" != "0" ] && continue
    done_marker && continue
    PROBE=$(unset NODE_ENV; cd /tmp && /Users/loganbaird/.local/bin/claude -p "Say OK" --model claude-opus-4-8 --output-format text < /dev/null 2>&1 | tail -1)
    cd /Users/loganbaird/Prototype_Prism/Design-trials
    if echo "$PROBE" | grep -q "OK"; then
      RESUMES=$((RESUMES+1)); launch; notify "🔄 Auto-resumed (#$RESUMES) after interruption." "Submarine"; sleep 120
    else
      notify "⏸ Session limit active — retrying every 10 min, then auto-resume." "Pop"; sleep 600
    fi
    continue
  fi
  TICK=$((TICK+30))
  if [ $TICK -ge 1200 ]; then TICK=0; S=$(grep -iE 'phase|wave|ckpt|status|pass|fail|defect' "$LEDGER" 2>/dev/null | tail -1 | cut -c1-110); [ -z "$S" ] && S="working… ($(agents) agents)"; notify "$S" "Pop"; fi
  sleep 30
done
