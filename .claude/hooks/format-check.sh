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

# Resolve prettier from a local install only. Never download in the hook —
# `npx --yes` in a cold cloud sandbox can hang or balloon stderr, and after a
# few Write/Edit calls that breaks the API stream. If prettier isn't already
# installed in this repo, skip silently.
PRETTIER_BIN=""
DIR=$(dirname "$FILE_PATH")
while [[ "$DIR" != "/" && "$DIR" != "." ]]; do
  if [[ -x "$DIR/node_modules/.bin/prettier" ]]; then
    PRETTIER_BIN="$DIR/node_modules/.bin/prettier"
    break
  fi
  DIR=$(dirname "$DIR")
done
[[ -n "$PRETTIER_BIN" ]] || exit 0

# Hard 5s wall-clock cap. Cap captured output to 2KB so a pathological parse
# error can never flood Claude's context.
OUTPUT=$(timeout 5s "$PRETTIER_BIN" --check "$FILE_PATH" 2>&1 | head -c 2048) || STATUS=$?
STATUS=${STATUS:-0}

# timeout(1) returns 124 when it killed the child; treat as soft-skip.
if [[ $STATUS -eq 124 ]]; then
  echo "format-check: prettier timed out on $FILE_PATH (skipped)" >&2
  exit 0
fi

# Prettier exits 2 on parse error. Block.
if [[ $STATUS -eq 2 ]]; then
  echo "format-check: prettier could not parse $FILE_PATH" >&2
  echo "$OUTPUT" >&2
  exit 2
fi

# Exit 1 = style drift. Block — drift gates exist to catch it now, not later.
if [[ $STATUS -ne 0 ]]; then
  echo "format-check BLOCKED: formatting drift in $FILE_PATH" >&2
  echo "$OUTPUT" >&2
  echo "Fix with: $PRETTIER_BIN --write $FILE_PATH" >&2
  exit 2
fi

exit 0
