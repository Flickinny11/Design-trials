#!/bin/bash
# run-sentinel-constellation.sh -- CONSTELLATION (metered mixed-model) Sentinel.
# Faithful clone of the marker-based, unlimited-resume sentinel, but routes:
#   orchestrator  -> Opus 4.8       (anthropic/claude-opus-4.8)  -- the boss
#   ALL subagents -> Qwen3.7-Plus   (multimodal: codes + reads frames; via --settings)
#   small/fast    -> DeepSeek-v4-flash
# Everything through OpenRouter (metered -> NO weekly wall). Adds a low-balance alert.
# Default (Anthropic subscription) mode is NOT affected by this file.
#
# Usage:
#   ./run-sentinel-constellation.sh "<NAME>" "<PROMPT.md>" "<REPORT.md>" "<MARKER>" ["<LEDGER.md>"]
# Stop manually:  touch ./CONSTELLATION-STOP
set +e
export PATH=/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH
ROOT=/Users/loganbaird/Prototype_Prism/Design-trials
cd "$ROOT" || exit 1
CFG="$ROOT/.constellation"
SETTINGS="$CFG/constellation-settings.json"
ORKEY=$(cat "$CFG/.or_key")
MM=anthropic/claude-opus-4.8
NAME=${1:-Constellation}
PROMPT=${2:?need PROMPT file}
REPORT=${3:?need REPORT file}
MARKER=${4:?need MARKER string}
LEDGER=${5:-$REPORT}
RUNLOG="$ROOT/constellation-run.log"
STOP="$ROOT/CONSTELLATION-STOP"
LB=0; RESUMES=0; TICK=0

N(){ osascript -e "display notification \"$1\" with title \"Prism CONSTELLATION\" sound name \"$2\"" 2>/dev/null; }
AG(){ c=0; for p in $(pgrep -f 'claude -p' 2>/dev/null); do case "$(ps -p "$p" -o comm= 2>/dev/null)" in *claude) c=$((c+1));; esac; done; echo "$c"; }
DONEM(){ [ -f "$REPORT" ] && grep -q "$MARKER" "$REPORT" 2>/dev/null; }
BAL(){ curl -s --max-time 20 https://openrouter.ai/api/v1/credits -H "Authorization: Bearer $ORKEY" | jq -r '((.data.total_credits)-(.data.total_usage))' 2>/dev/null; }
LAUNCH(){ unset NODE_ENV; nohup /Users/loganbaird/.local/bin/claude -p "$(cat "$PROMPT")" --settings "$SETTINGS" --mcp-config "$CFG/morph-mcp.json" --model "$MM" --permission-mode bypassPermissions --output-format text > "$RUNLOG" 2>&1 & echo "$(date) launched $! (constellation)" >> "$ROOT/sentinel.log"; }

N "CONSTELLATION armed (metered, unlimited resume): $NAME" Tink
LAUNCH
N "Launched $NAME -- Opus boss + Qwen subagents (metered)" Submarine
sleep 90
while true; do
  [ -f "$STOP" ] && N "CONSTELLATION stopped by STOP file." Tink && exit 0
  if DONEM && [ "$(AG)" = 0 ]; then N "DONE: $NAME complete -- report ready. Tell Claude: check" Glass && exit 0; fi
  if [ "$(AG)" = 0 ]; then
    sleep 30; [ "$(AG)" != 0 ] && continue
    sleep 30; [ "$(AG)" != 0 ] && continue
    DONEM && continue
    P=$(unset NODE_ENV; cd /tmp && /Users/loganbaird/.local/bin/claude -p 'Say OK' --settings "$SETTINGS" --model "$MM" --output-format text < /dev/null 2>&1 | tail -1)
    cd "$ROOT"
    if echo "$P" | grep -q OK; then
      RESUMES=$((RESUMES+1)); LAUNCH; N "Auto-resumed #$RESUMES after interruption." Submarine; sleep 120
    else
      B=$(BAL); N "Paused: calls failing (credits/limit?). Balance ~\$$B. Retrying every 10 min; auto-resumes when restored." Pop; sleep 600
    fi
    continue
  fi
  TICK=$((TICK+30))
  if [ "$TICK" -ge 1200 ]; then
    TICK=0; B=$(BAL)
    if [ -n "$B" ] && awk -v b="$B" 'BEGIN{exit !(b+0<3)}'; then
      [ "$LB" = 0 ] && N "LOW BALANCE ~\$$B -- add OpenRouter credits to avoid interruption." Sosumi && LB=1
    else LB=0; fi
    S=$(grep -iE 'phase|wave|ckpt|status|pass|fail|defect' "$LEDGER" 2>/dev/null | tail -1 | cut -c1-90); [ -z "$S" ] && S="working ($(AG) agents)"
    N "$S | bal ~\$$B" Pop
  fi
  sleep 30
done
