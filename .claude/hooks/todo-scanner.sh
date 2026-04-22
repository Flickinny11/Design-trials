#!/usr/bin/env bash
# PostToolUse Write|Edit — flag TODO/FIXME/XXX/hack/temporary markers.
# Non-blocking: prints to stderr, exits 0.
set -u

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

[[ -f "$FILE_PATH" ]] || exit 0

HITS=$(grep -nE '\b(TODO|FIXME|XXX|HACK|hack|temporary|temp fix|stub|placeholder)\b' "$FILE_PATH" 2>/dev/null || true)
if [[ -n "$HITS" ]]; then
  echo "todo-scanner: markers present in $FILE_PATH (non-blocking):" >&2
  echo "$HITS" | head -20 >&2
fi

exit 0
