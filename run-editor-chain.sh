#!/bin/bash
# Editor-chrome chain: toolbar-iterate -> node-editor -> keyframe.
# Advances ONLY on a surface's COMPLETE marker (sentinel rc=0). Pauses + notifies on blocked/stuck.
set -u
D=/Users/loganbaird/Prototype_Prism/Design-trials
cd "$D" || exit 1
FEED="$D/kid-kode-landing/notes/MONITOR-FEED.md"
STATUS="$D/chain-status.txt"
ts(){ date +%H:%M; }
cnote(){ echo "[$(ts)] CHAIN: $1" >> "$FEED"; echo "[$(ts)] CHAIN: $1" > "$STATUS"; osascript -e "display notification \"$1\" with title \"Prism Editor-Chrome CHAIN\" sound name \"Glass\"" >/dev/null 2>&1; }
run_surface(){
  local name="$1" prompt="$2" report="$3" cmark="$4" bmark="$5"
  cnote "STARTING surface: $name"
  bash "$D/run-surface.sh" "$name" "$prompt" "$report" "$cmark" "$bmark"
  local rc=$?
  if [ "$rc" -ne 0 ]; then cnote "PAUSED at $name (rc=$rc; 1=blocked 2=stop 3=cap). Chain halted - tell Claude: check"; exit "$rc"; fi
  if ! grep -qF "$cmark" "$report" 2>/dev/null; then cnote "PAUSED at $name (no completion marker). Tell Claude: check"; exit 10; fi
  cnote "$name COMPLETE + verified. Advancing."
}
cnote "Editor-chrome chain START: toolbar-iterate -> node-editor -> keyframe."
run_surface "TBITER"   "$D/PRISM-TBITER-PROMPT.md"   "$D/kid-kode-landing/notes/TBITER-REPORT.md"   "PRISM-TBITER: RUN COMPLETE"   "PRISM-TBITER: BLOCKED-NEEDS-FOUNDER"
run_surface "NODEEDIT" "$D/PRISM-NODEEDIT-PROMPT.md" "$D/kid-kode-landing/notes/NODEEDIT-REPORT.md" "PRISM-NODEEDIT: RUN COMPLETE" "PRISM-NODEEDIT: BLOCKED-NEEDS-FOUNDER"
run_surface "KEYFRAME" "$D/PRISM-KEYFRAME-PROMPT.md" "$D/kid-kode-landing/notes/KEYFRAME-REPORT.md" "PRISM-KEYFRAME: RUN COMPLETE" "PRISM-KEYFRAME: BLOCKED-NEEDS-FOUNDER"
cnote "ALL EDITOR CHROME COMPLETE (toolbar + node editor + keyframe). Tell Claude: check"
