#!/bin/bash
# run-surface-v2.sh — adaptive-model sentinel (founder-directed 2026-07-04).
# Same interface, markers, notifications, and latches as run-surface.sh, plus:
#   * Model resolved PER LAUNCH ATTEMPT from $D/.harness-model
#       values: claude-fable-5 | claude-opus-4-8 | auto
#       auto = try fable-5 first, fall to opus-4-8 (Max auto-1M) the moment
#       fable's window closes — no multi-day wait.
#   * Mid-run switch: `echo <value> > .harness-model && touch .harness-switch`
#       → current agent is TERMed (resume protocol proven: F-3), next launch
#       uses the new model. Progress carries via commits + report, as designed.
#   * Pinned model that hits a closed window: waits 900s cycles (wait-not-burn),
#       honoring the pin. Credits are governed by the ACCOUNT (extra-usage
#       toggle + balance), never silently by this script.
# Args: NAME PROMPT REPORT COMPLETE_MARKER BLOCKED_MARKER
# Exit: 0=complete, 1=blocked, 2=chain-stop, 3=cap-without-marker
set -u
D=/Users/loganbaird/Prototype_Prism/Design-trials
cd "$D" || exit 1
CLAUDE=/Users/loganbaird/.local/bin/claude
NAME="$1"; PROMPT="$2"; REPORT="$3"; CMARK="$4"; BMARK="$5"
COUNTER="$D/kid-kode-landing/notes/realagents-editorchain.sh"
FEED="$D/kid-kode-landing/notes/MONITOR-FEED.md"
LIVE="$D/kid-kode-landing/notes/SENTINEL-LIVE.md"
STATUS="$D/chain-status.txt"
RUNLOG="$D/chain-$NAME-run.log"
WEBHOOK_FILE="$D/.notify-webhook"
PREFLIGHT="$D/kid-kode-landing/scripts/prism-autonomy-preflight.mjs"
WORKSPACE_SPEC="$D/kid-kode-landing/docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md"
MODEL_FILE="$D/.harness-model"; SWITCH_FILE="$D/.harness-switch"
PIDFILE="$D/.agent-$NAME.pid"
FABLE="claude-fable-5"; OPUS="claude-opus-4-8"
MAXRESUMES=10; RESUMES=0; SEEN_COMPLETE=0; SEEN_BLOCKED=0; HB=0
CUR_MODEL=""
START_EPOCH=$(date +%s)
ts(){ date +%H:%M:%S; }
elapsed(){ echo $(( ($(date +%s) - START_EPOCH) / 60 ))m; }
agents(){ bash "$COUNTER" 2>/dev/null || echo 0; }
head_subj(){ git -C "$D" log -1 --pretty=%s 2>/dev/null | cut -c1-72; }
head_hash(){ git -C "$D" rev-parse --short HEAD 2>/dev/null; }
ncommits(){ git -C "$D" rev-list --count HEAD 2>/dev/null || echo "?"; }
notify(){
  local msg="$1"; local sound="${2:-Glass}"
  echo "[$(ts)] CHAIN/$NAME: $msg" >> "$FEED"
  echo "[$(ts)] $NAME · $(elapsed) · agent=$(agents) · $msg" >> "$LIVE"
  echo "[$(ts)] $NAME: $msg" > "$STATUS"
  ( osascript -e "display notification \"$msg\" with title \"Prism · $NAME\" sound name \"$sound\"" >/dev/null 2>&1 < /dev/null || true ) &
  [ -f "$WEBHOOK_FILE" ] && curl -s -m 5 -d "[$NAME] $msg" "$(cat "$WEBHOOK_FILE")" >/dev/null 2>&1
  return 0
}
cmark(){ { [ -f "$REPORT" ] && grep -qF "$CMARK" "$REPORT" 2>/dev/null; } || { [ -f "$RUNLOG" ] && grep -qF "$CMARK" "$RUNLOG" 2>/dev/null; }; }
bmark(){ { [ -f "$REPORT" ] && grep -qF "$BMARK" "$REPORT" 2>/dev/null; } || { [ -f "$RUNLOG" ] && grep -qF "$BMARK" "$RUNLOG" 2>/dev/null; }; }
terminal(){ cmark || bmark; }
probe(){ local m="$1"; local p; p=$(unset NODE_ENV; cd /tmp && "$CLAUDE" -p "Say OK" --model "$m" --output-format text < /dev/null 2>&1 | tail -1); echo "$p" | grep -q "OK"; }
# resolve_model: returns the model to use for THIS launch attempt, or "" if
# nothing is open right now. Notifies on any change of active model.
resolve_model(){
  local pref; pref=$(cat "$MODEL_FILE" 2>/dev/null | tr -d '[:space:]')
  [ -z "$pref" ] && pref="auto"
  case "$pref" in
    auto)
      if probe "$FABLE"; then echo "$FABLE"; return 0; fi
      if probe "$OPUS";  then echo "$OPUS";  return 0; fi
      echo ""; return 1 ;;
    *)
      if probe "$pref"; then echo "$pref"; return 0; fi
      echo ""; return 1 ;;
  esac
}
preflight(){
  [ -f "$PREFLIGHT" ] || return 0
  local args=(--prompt "$PROMPT")
  case "$(basename "$PROMPT")" in
    PRISM-WS-W3-PROMPT.md|PRISM-WS-W4-PROMPT.md|PRISM-WS-W5-PROMPT.md)
      [ -f "$WORKSPACE_SPEC" ] && args+=(--spec "$WORKSPACE_SPEC")
      ;;
  esac
  node "$PREFLIGHT" "${args[@]}" > "$RUNLOG.preflight" 2>&1
}
launch(){
  local m="$1"
  if ! preflight; then
    notify "PREFLIGHT BLOCKED launch. See $RUNLOG.preflight" "Basso"
    return 99
  fi
  unset NODE_ENV
  ( nohup "$CLAUDE" -p "$(cat "$PROMPT")" --model "$m" --permission-mode bypassPermissions --output-format text < /dev/null > "$RUNLOG" 2>&1 & echo $! > "$PIDFILE" )
  if [ -n "$CUR_MODEL" ] && [ "$m" != "$CUR_MODEL" ]; then
    notify "MODEL SWITCH: $CUR_MODEL → $m (resume #$RESUMES). Progress carries via commits + resume protocol." "Submarine"
  else
    notify "launched build agent on $m (resume #$RESUMES)"
  fi
  CUR_MODEL="$m"
}
handle_switch(){
  [ -f "$SWITCH_FILE" ] || return 0
  rm -f "$SWITCH_FILE"
  local newpref; newpref=$(cat "$MODEL_FILE" 2>/dev/null | tr -d '[:space:]')
  notify "FOUNDER SWITCH requested → '$newpref'. Cycling agent for clean handoff." "Submarine"
  if [ -f "$PIDFILE" ]; then
    local pid; pid=$(cat "$PIDFILE" 2>/dev/null)
    [ -n "$pid" ] && kill -TERM "$pid" 2>/dev/null
  fi
  # resume protocol takes it from here: agent quiet → resolve_model → relaunch
}
{ echo ""; echo "## $NAME run — started $(date '+%Y-%m-%d %H:%M:%S') (adaptive v2)"; echo "complete marker: '$CMARK'"; } >> "$LIVE"
notify "ARMED v2 — watching $NAME. Model policy: $(cat "$MODEL_FILE" 2>/dev/null || echo auto). Pinging on every commit, heartbeat, switch, stop, and finish." "Submarine"
LAST_HEAD="$(head_hash)"
while true; do
  [ -f "$D/CHAIN-STOP" ] && { notify "CHAIN-STOP seen — stopping." "Basso"; exit 2; }
  handle_switch
  cmark && SEEN_COMPLETE=1
  bmark && SEEN_BLOCKED=1
  if [ "$SEEN_COMPLETE" -eq 1 ] && [ "$(agents)" -eq 0 ]; then notify "COMPLETE — marker confirmed, agent quiet. Frames ready to review." "Hero"; exit 0; fi
  if [ "$SEEN_BLOCKED" -eq 1 ] && [ "$(agents)" -eq 0 ]; then notify "BLOCKED — needs founder. See report." "Basso"; exit 1; fi
  NH="$(head_hash)"
  if [ "$NH" != "$LAST_HEAD" ]; then notify "commit $NH — $(head_subj)"; LAST_HEAD="$NH"; fi
  sleep 30
  if [ "$(agents)" -ne 0 ]; then HB=$((HB+1)); [ $((HB % 7)) -eq 0 ] && notify "still building · $(elapsed) elapsed · agent up · $(ncommits) commits · last: $(head_subj)" "Tink"; continue; fi
  sleep 15; [ "$(agents)" -ne 0 ] && continue
  { [ "$SEEN_COMPLETE" -eq 1 ] || [ "$SEEN_BLOCKED" -eq 1 ] || terminal; } && continue
  if [ "$RESUMES" -ge "$MAXRESUMES" ]; then notify "cap ($MAXRESUMES) reached without terminal marker — exiting." "Sosumi"; exit 3; fi
  M="$(resolve_model)"
  if [ -n "$M" ]; then
    RESUMES=$((RESUMES+1))
    launch "$M" || exit 1
  else
    notify "no model window open (policy: $(cat "$MODEL_FILE" 2>/dev/null || echo auto)) — waiting 900s" "Tink"; sleep 900
  fi
done
