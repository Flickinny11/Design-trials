#!/usr/bin/env bash
# PostToolUse Edit|Write — migration-specific drift guard.
#
# Fires only when .ralph-migration-active marker exists. Two scopes:
#
# 1. After Phase 5 (PixiJS removed): the .ralph-phase5-pixi-removed marker
#    blocks any new `from 'pixi'` import in src/ or packages/.
#
# 2. Always-on for node modules under runtime/shared/nodes/, src/lib/prism/runtime/,
#    or any path matching /nodes/:
#    - `async function createNode` is forbidden (createNode must be sync per spec §8)
#    - `document.*` access is forbidden
#    - `window.*` access is forbidden EXCEPT `window.devicePixelRatio`
#
# Exit codes:
#   0 = ok / out of scope
#   2 = block (stderr shown to Claude)

set -uo pipefail

input=$(cat)

file_path=$(printf '%s' "$input" | /usr/bin/python3 -c '
import sys, json
try:
  d = json.load(sys.stdin)
  print((d.get("tool_input") or {}).get("file_path") or "")
except Exception:
  pass
' 2>/dev/null || echo "")

[[ -z "$file_path" ]] && exit 0
[[ ! -f "$file_path" ]] && exit 0

# Migration must be active
if [ ! -f "$CLAUDE_PROJECT_DIR/.ralph-migration-active" ] && \
   [ ! -f "$CLAUDE_PROJECT_DIR/kid-kode-landing/.ralph-migration-active" ]; then
  exit 0
fi

# Only run on JS/TS files
case "$file_path" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) ;;
  *) exit 0 ;;
esac

violations=()

# ---------------------------------------------------------------------------
# Phase 5 PixiJS removal guard
# ---------------------------------------------------------------------------
if [ -f "$CLAUDE_PROJECT_DIR/.ralph-phase5-pixi-removed" ] || \
   [ -f "$CLAUDE_PROJECT_DIR/kid-kode-landing/.ralph-phase5-pixi-removed" ]; then
  case "$file_path" in
    */src/*|*/packages/*)
      if grep -nE "from\s+['\"]pixi(\.js|-filters)?['\"]" "$file_path" 2>/dev/null | head -3 >&2; then
        violations+=("Phase 5 complete (.ralph-phase5-pixi-removed marker present) — PixiJS imports forbidden in $file_path")
      fi
      ;;
  esac
fi

# ---------------------------------------------------------------------------
# Node-module discipline (runtime/shared/nodes, /nodes/, prism/runtime/)
# ---------------------------------------------------------------------------
in_node_scope=0
case "$file_path" in
  */runtime/shared/nodes/*|*/prism/runtime/*|*/nodes/*) in_node_scope=1 ;;
esac

if [[ "$in_node_scope" -eq 1 ]]; then
  # async createNode forbidden
  if grep -nE "async[[:space:]]+function[[:space:]]+createNode|export[[:space:]]+default[[:space:]]+async[[:space:]]+function" "$file_path" >/dev/null 2>&1; then
    violations+=("$file_path: createNode must be synchronous (spec §8). Returns THREE.Object3D synchronously; async loading happens inside primitives via cached loaders.")
  fi
  # document.* forbidden
  if grep -nE "(^|[^a-zA-Z_])document\." "$file_path" 2>/dev/null | grep -v "^\s*//" >/dev/null; then
    violations+=("$file_path: document.* access forbidden in node modules (spec §10). Render via three/webgpu scene graph.")
  fi
  # window.* forbidden except devicePixelRatio
  matches=$(grep -nE "(^|[^a-zA-Z_])window\." "$file_path" 2>/dev/null | grep -v "window\.devicePixelRatio" | grep -v "^\s*//" || true)
  if [[ -n "$matches" ]]; then
    violations+=("$file_path: window.* access forbidden in node modules except window.devicePixelRatio (spec §10). Found:")
    while IFS= read -r m; do
      [[ -n "$m" ]] && violations+=("    $m")
    done <<< "$matches"
  fi
fi

if [[ ${#violations[@]} -gt 0 ]]; then
  echo "[migration-forbidden-patterns] BLOCK — drift detected:" >&2
  for v in "${violations[@]}"; do
    echo "  $v" >&2
  done
  echo "" >&2
  echo "Spec: kid-kode-landing/docs/prism/PRISM-RENDERER-MIGRATION-SPEC.md §8, §10" >&2
  exit 2
fi
exit 0
