#!/usr/bin/env bash
# PostToolUse Write|Edit — run prettier --check on TS/TSX/JS/MJS/JSX files.
# Exit 2 only on parse failure. Exit 0 on formatting drift (warning).
set -u

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.mjs|*.jsx|*.cjs) ;;
  *) exit 0 ;;
esac

[[ -f "$FILE_PATH" ]] || exit 0

OUTPUT=$(npx --yes prettier --check "$FILE_PATH" 2>&1) || STATUS=$?
STATUS=${STATUS:-0}

# Prettier exits 2 on parse error. Block.
if [[ $STATUS -eq 2 ]]; then
  echo "format-check: prettier could not parse $FILE_PATH" >&2
  echo "$OUTPUT" >&2
  exit 2
fi

# Exit 1 = style drift. Warn, do not block.
if [[ $STATUS -ne 0 ]]; then
  echo "format-check: formatting drift in $FILE_PATH (non-blocking). Run: npx prettier --write $FILE_PATH" >&2
fi

exit 0
