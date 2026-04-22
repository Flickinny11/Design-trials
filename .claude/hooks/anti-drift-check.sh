#!/usr/bin/env bash
# PreToolUse Write|Edit — reject §1.4 forbidden patterns inside Prism runtime/build code.
# Scope: src/lib/prism/** and src/components/prism-player/** only.
# Exit 2 = block the write with stderr shown to Claude as feedback.
set -u

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

case "$FILE_PATH" in
  */src/lib/prism/*|*/src/components/prism-player/*) ;;
  *) exit 0 ;;
esac

if [[ "$TOOL" == "Write" ]]; then
  CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // empty')
elif [[ "$TOOL" == "Edit" ]]; then
  CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_string // empty')
else
  exit 0
fi

violations=()

# PIXI.Text (excluding Texture, TextStyle, TextMetrics)
if echo "$CONTENT" | grep -E 'PIXI\.Text([^a-zA-Z]|$)' > /dev/null; then
  violations+=("PIXI.Text forbidden (§1.4) — use PIXI.BitmapText for dynamic text, composite static text in atlas")
fi

# PIXI.Graphics without ALLOWED-GRAPHICS comment within 3 lines
if echo "$CONTENT" | grep -E 'PIXI\.Graphics([^a-zA-Z]|$)' > /dev/null; then
  if ! echo "$CONTENT" | grep -B3 -A0 -E 'PIXI\.Graphics([^a-zA-Z]|$)' | grep -q 'ALLOWED-GRAPHICS'; then
    violations+=("PIXI.Graphics requires ALLOWED-GRAPHICS comment within 3 lines (§1.4 — masks/hit areas only)")
  fi
fi

# innerHTML / outerHTML / document.write
if echo "$CONTENT" | grep -E '(inner|outer)HTML[[:space:]]*=' > /dev/null; then
  violations+=("innerHTML/outerHTML assignment forbidden (§1.4) — no HTML for visible chrome")
fi
if echo "$CONTENT" | grep -E 'document\.write\(' > /dev/null; then
  violations+=("document.write forbidden (§1.4)")
fi

# fillText / strokeText
if echo "$CONTENT" | grep -E '\.?fillText\(|\.?strokeText\(' > /dev/null; then
  violations+=("fillText/strokeText forbidden (§1.4) — text is sharp-svg composite or MSDF BitmapText")
fi

# Inline CSS chrome writes
if echo "$CONTENT" | grep -E '\.style\.(background|border|boxShadow|backgroundImage)[[:space:]]*=' > /dev/null; then
  violations+=("Inline .style.{background,border,boxShadow,backgroundImage} forbidden (§1.4) — chrome is atlas-sourced")
fi

if [[ ${#violations[@]} -gt 0 ]]; then
  echo "anti-drift-check BLOCKED write to $FILE_PATH:" >&2
  for v in "${violations[@]}"; do
    echo "  - $v" >&2
  done
  echo "Fix the content. For legitimate mask/hit-area Graphics, add an 'ALLOWED-GRAPHICS:' comment within 3 lines of the call." >&2
  exit 2
fi

exit 0
