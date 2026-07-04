#!/usr/bin/env bash
# PILLAR 4 — blocking COMPLETION GATE (Stop / SubagentStop hook).
# A human-in-the-loop blocking layer: refuses to let a session "complete" while a
# crash-class REMOTE-ASSET dependency sits in changed editor/scene code. Re-arms the
# blocking stop layer that was softened away before the 2026-06-29 drift.
# Honors stop_hook_active so it blocks AT MOST once per stop cycle (never loops).
# Reads hook JSON from stdin; exit 2 = block the stop.
set -uo pipefail

input=$(cat)
active=$(printf '%s' "$input" | /usr/bin/python3 -c 'import sys,json; d=json.load(sys.stdin); print("1" if d.get("stop_hook_active") else "0")' 2>/dev/null || echo 0)
[ "$active" = "1" ] && exit 0

REPO="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
command -v git >/dev/null 2>&1 || exit 0
git -C "$REPO" rev-parse --git-dir >/dev/null 2>&1 || exit 0

changed=$(git -C "$REPO" status --porcelain -- 'kid-kode-landing/src' 2>/dev/null | awk '{print $NF}' | grep -E '\.(ts|tsx|js|jsx)$' || true)
[ -z "$changed" ] && exit 0

bad=""
while IFS= read -r f; do
  [ -z "$f" ] && continue
  full="$REPO/$f"
  [ -f "$full" ] || continue
  if grep -qE '<Environment[^>]*\bpreset[[:space:]]*=|raw\.githack\.com|polyhaven\.org|files[[:space:]]*=[[:space:]]*["'"'"'`]https?://|https?://[^"'"'"'`[:space:]]+\.(hdr|exr|ktx2|glb|gltf)' "$full" 2>/dev/null; then
    grep -q 'ALLOWED-REMOTE-ASSET' "$full" 2>/dev/null || bad="$bad
   • $f"
  fi
done <<< "$changed"

if [ -n "$bad" ]; then
  {
    echo "⛔ COMPLETION GATE — do NOT stop yet. A REMOTE-ASSET dependency is present in changed editor/scene code:"
    printf '%s\n' "$bad"
    echo ""
    echo "This is the crash class (drei <Environment preset> / CDN HDRI) that took the canvas"
    echo "down on 2026-06-29. Replace it with a LOCAL asset (StudioEnv / Lightformer env) and"
    echo "verify in a REAL GPU browser (docs/prism/VERIFICATION-STANDARD.md) before completing."
  } >&2
  exit 2
fi
exit 0
