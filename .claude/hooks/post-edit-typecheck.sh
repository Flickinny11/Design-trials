#!/usr/bin/env bash
# PostToolUse Edit|Write|MultiEdit — run a fast TypeScript check after every
# code edit during the renderer migration. Only fires on .ts/.tsx files inside
# kid-kode-landing/. Exit 2 on type errors so Claude sees the failure and fixes
# it before claiming the task is done.
#
# Skipped (exit 0) when:
#   - The edited file is not in kid-kode-landing/
#   - The edited file is not .ts or .tsx
#   - Migration marker is absent (treat as out of scope; the project uses
#     `npm run verify:prism` as its primary check)

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

# Out-of-scope file types
case "$file_path" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# Out-of-scope paths
case "$file_path" in
  */kid-kode-landing/*) ;;
  *) exit 0 ;;
esac

# Migration must be active
if [ ! -f "$CLAUDE_PROJECT_DIR/.ralph-migration-active" ] && \
   [ ! -f "$CLAUDE_PROJECT_DIR/kid-kode-landing/.ralph-migration-active" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR/kid-kode-landing" || exit 0

LOG=/tmp/ralph-tsc.log
if ! npx --no tsc --noEmit > "$LOG" 2>&1; then
  echo "[post-edit-typecheck] BLOCK — TypeScript errors after editing $(basename "$file_path"):" >&2
  tail -40 "$LOG" >&2
  echo "" >&2
  echo "Full log: $LOG" >&2
  echo "Fix the errors before re-attempting the edit; do NOT mark the task done with type errors." >&2
  exit 2
fi
exit 0
