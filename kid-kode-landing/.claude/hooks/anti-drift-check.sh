#!/usr/bin/env bash
# PreToolUse hook for Write/Edit — blocks forbidden patterns from mock-spec §1.4.
# Reads hook JSON from stdin; exits 2 (= block + show stderr to Claude) on violations.
# Only enforces inside src/lib/prism/** and src/components/prism-player/** (the prism
# runtime + build code). Spec docs, notes, and the rest of the repo are not scanned.

set -euo pipefail

input=$(cat)

# Extract file_path and candidate content from tool input (Write → content; Edit → new_string).
file_path=$(printf '%s' "$input" | /usr/bin/python3 -c 'import sys,json; d=json.load(sys.stdin); print((d.get("tool_input") or {}).get("file_path") or "")')
content=$(printf '%s' "$input" | /usr/bin/python3 -c 'import sys,json; d=json.load(sys.stdin); ti=d.get("tool_input") or {}; print(ti.get("content") or ti.get("new_string") or "")')

# Editor-genericity check: writes to src/components/editor/** must NOT hardcode
# mock-app-specific nodeIds. Keeps the editor reusable across hubs/apps.
case "$file_path" in
  */src/components/editor/*.ts|*/src/components/editor/*.tsx|*/src/components/editor/**/*.ts|*/src/components/editor/**/*.tsx)
    if printf '%s' "$content" | grep -qE '"(hero-card-|navbar-(logo|link|signin|bg)|feature-card-|footer-(bg|logo|link|social|copyright)|stats-(card|live)|settings-section|notifications-toggle|theme-selector|hero-section|feature-grid|page-background)' ; then
      if ! printf '%s' "$content" | grep -q 'ALLOWED-HARDCODED-ID'; then
        printf '\n=== ANTI-DRIFT BLOCK — editor genericity ===\n' >&2
        printf 'File: %s\n' "$file_path" >&2
        printf '  - FORBIDDEN: hardcoded mock-app nodeId string literal in editor code. Editor must drive off window.__prism.graph.nodes generically. Add // ALLOWED-HARDCODED-ID: <reason> if intentional.\n' >&2
        exit 2
      fi
    fi
    exit 0
    ;;
esac

# Only scan prism runtime/build code. Mock app source JSON + notes + docs allowed unrestricted.
case "$file_path" in
  */src/lib/prism/player/*|*/src/lib/prism/artifact/*|*/src/lib/prism/local-backend/*|*/src/lib/prism/shr/*|*/src/components/prism-player/*|*/src/lib/prism/mock-app-source/nodes/*|*/src/lib/prism/mock-app-source/backends/*|*/src/lib/prism/mock-app-source/assets/*.mjs|*/src/lib/prism/mock-app-source/build-prism.mjs)
    ;;
  *)
    exit 0
    ;;
esac

violations=()

# Forbidden: PIXI.Text anywhere (success criterion §10.5 — "new PIXI.Text does not appear at all").
if printf '%s' "$content" | grep -qE '\bnew[[:space:]]+PIXI\.Text[[:space:]]*\('; then
  violations+=("FORBIDDEN: \`new PIXI.Text(...)\` — mock spec §1.4 prohibits PIXI.Text. Use sharp-svg (build time) or PIXI.BitmapText with MSDF (runtime dynamic data only).")
fi
if printf '%s' "$content" | grep -qE '\bPIXI\.Text\b'; then
  violations+=("FORBIDDEN: reference to \`PIXI.Text\` — §1.4 prohibits the class entirely. Replace with BitmapText + MSDF atlas.")
fi

# Forbidden: PIXI.Graphics used for visible UI elements.
# §1.4 allows Graphics ONLY for invisible hit areas, masks, or dev-mode debug overlays.
# Heuristic: block any Graphics usage in these dirs that does NOT mention hitArea|mask|debug|scissor on the same line
# or in the immediate surrounding (the file must opt-in with a literal comment containing ALLOWED-GRAPHICS).
if printf '%s' "$content" | grep -qE 'new[[:space:]]+PIXI\.Graphics[[:space:]]*\('; then
  if ! printf '%s' "$content" | grep -q 'ALLOWED-GRAPHICS'; then
    violations+=("SUSPECT: \`new PIXI.Graphics()\` without an \`// ALLOWED-GRAPHICS: <reason>\` comment in the file. §1.4 permits Graphics ONLY for invisible hit areas / masks / dev overlays. If this is one of those cases, add the marker comment.")
  fi
fi

# Forbidden: innerHTML / outerHTML / document.write with concatenated strings in prism code.
if printf '%s' "$content" | grep -qE '(innerHTML|outerHTML)[[:space:]]*=|document\.write\('; then
  violations+=("FORBIDDEN: DOM text injection (\`innerHTML=\`, \`outerHTML=\`, \`document.write\`) in Prism runtime code. Render via atlas images or MSDF BitmapText only.")
fi

# Forbidden: canvas 2D text APIs in prism player code.
if printf '%s' "$content" | grep -qE '\b(fillText|strokeText)[[:space:]]*\('; then
  violations+=("FORBIDDEN: Canvas 2D \`fillText\`/\`strokeText\`. Text is compiled to the atlas via Sharp+SVG at build time (§5.2) or rendered at runtime via MSDF BitmapText (§1.4 exception 1).")
fi

# Forbidden: CSS-based visible chrome rendering in prism player code (style injection of backgrounds/borders on visible elements).
if printf '%s' "$content" | grep -qE '\.style\.(background|border|boxShadow|backgroundImage)[[:space:]]*='; then
  violations+=("SUSPECT: direct DOM \`.style.background/.border/.boxShadow\` in Prism runtime. §1.4 forbids CSS for visible chrome — use atlas overlays instead. If this is for an invisible accessibility overlay, add \`// ALLOWED-DOM-STYLE: <reason>\` to bypass.")
  if ! printf '%s' "$content" | grep -q 'ALLOWED-DOM-STYLE'; then
    : # keep violation
  else
    # remove the last violation if opt-in comment present
    unset 'violations[${#violations[@]}-1]'
  fi
fi

if [ ${#violations[@]} -gt 0 ]; then
  printf '\n=== ANTI-DRIFT BLOCK — mock spec §1.4 ===\n' >&2
  printf 'File: %s\n' "$file_path" >&2
  for v in "${violations[@]}"; do printf '  - %s\n' "$v" >&2; done
  printf '\nIf this is a false positive, fix the hook at .claude/hooks/anti-drift-check.sh.\n' >&2
  exit 2
fi

exit 0
