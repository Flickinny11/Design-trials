#!/usr/bin/env bash
# PreToolUse Write|Edit — reject forbidden patterns.
# Two scopes:
#   1. Prism runtime/build code (§1.4 patterns; always active):
#      src/lib/prism/** and src/components/prism-player/**
#   2. Editor-build scope (PRISM-EDITOR-BUILD-SPEC.md FP-NN; active only when
#      .prism-editor-build-active marker exists at repo root): broader scope under
#      kid-kode-landing/src/** with per-FP path filters.
# Exit 2 = block the write with stderr shown to Claude as feedback.
set -u

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

ALWAYS_ACTIVE=0
case "$FILE_PATH" in
  */src/lib/prism/*|*/src/components/prism-player/*) ALWAYS_ACTIVE=1 ;;
esac

EDITOR_BUILD_ACTIVE=0
if [[ -f "$REPO_ROOT/.prism-editor-build-active" ]]; then
  case "$FILE_PATH" in
    */kid-kode-landing/src/*|*/kid-kode-landing/scripts/generate-*|*/kid-kode-landing/scripts/provision-*|*/kid-kode-landing/src/lib/prism/mock-app-source/assets/*)
      EDITOR_BUILD_ACTIVE=1 ;;
  esac
fi

if [[ $ALWAYS_ACTIVE -eq 0 && $EDITOR_BUILD_ACTIVE -eq 0 ]]; then
  exit 0
fi

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

# ---- Editor-build forbidden patterns (only when EDITOR_BUILD_ACTIVE=1) ----
# Per PRISM-EDITOR-BUILD-SPEC.md §8 (FP-01..FP-13).
if [[ $EDITOR_BUILD_ACTIVE -eq 1 ]]; then

  # FP-01: PixiJS imports anywhere under kid-kode-landing/src/**.
  if echo "$CONTENT" | grep -E "from[[:space:]]+['\"]pixi|import[[:space:]]+\*[[:space:]]+as[[:space:]]+PIXI\b" > /dev/null; then
    violations+=("FP-01: PixiJS import forbidden (INV-11) — runtime is Three.js WebGPU. See PRISM-EDITOR-BUILD-SPEC.md §8.")
  fi

  # FP-02: THREE.TextGeometry forbidden.
  if echo "$CONTENT" | grep -E '\bnew[[:space:]]+THREE\.TextGeometry[[:space:]]*\(' > /dev/null; then
    violations+=("FP-02: THREE.TextGeometry forbidden (INV-13) — text uses MSDF via three-msdf-text-webgpu.")
  fi

  # FP-04: destructive position writes inside compile/organize/preview function bodies.
  if echo "$CONTENT" | grep -E '^[[:space:]]*(function[[:space:]]+|const[[:space:]]+|export[[:space:]]+(default[[:space:]]+)?(function[[:space:]]+|async[[:space:]]+function[[:space:]]+)?)(compile|organize|previewHub|previewApp)[A-Za-z_0-9]*\b' > /dev/null; then
    # Only flag if same content also has destructive writes to position fields.
    if echo "$CONTENT" | grep -E '\.(scenePosition|editorTransform|canvasTransform|compiledTransform)\.(x|y|z)[[:space:]]*=[^=]' > /dev/null; then
      violations+=("FP-04: destructive position write inside compile/organize/preview function (INV-17) — compile is non-destructive. Clone the data; do not mutate source positions.")
    fi
  fi

  # FP-05: document.* / window.* in runtime modules (window.devicePixelRatio allowed).
  case "$FILE_PATH" in
    */kid-kode-landing/src/lib/prism/runtime/*|*/kid-kode-landing/src/lib/prism/mock-app-source/nodes/*|*/kid-kode-landing/src/components/prism-player/*)
      if echo "$CONTENT" | grep -E '\bdocument\.[a-zA-Z]' > /dev/null; then
        violations+=("FP-05: document.* forbidden in runtime/node modules (INV-15).")
      fi
      if echo "$CONTENT" | grep -E '\bwindow\.(?!devicePixelRatio\b)[a-zA-Z]' -P > /dev/null 2>&1; then
        violations+=("FP-05: window.* forbidden in runtime/node modules — only window.devicePixelRatio is allowed (INV-15).")
      fi
      ;;
  esac

  # FP-06: raw secret string literals. (Character class: dash placed at end to avoid range parse.)
  if echo "$CONTENT" | grep -E -i "(api[_-]?key|secret|token|password|client[_-]?secret)[[:space:]]*[:=][[:space:]]*[\"'][A-Za-z0-9_./+=-]{16,}[\"']" > /dev/null; then
    violations+=("FP-06: raw secret string literal forbidden (INV-19) — use capability references; resolve via server-only vault.")
  fi

  # FP-07: process.env.*_SECRET / *_KEY / *_TOKEN outside src/server/** or server-only files.
  case "$FILE_PATH" in
    */kid-kode-landing/src/server/*) ;;
    *)
      if echo "$CONTENT" | grep -E 'process\.env\.[A-Z_]*(SECRET|KEY|TOKEN|PASSWORD)' > /dev/null; then
        # Allow when first 5 lines contain a 'server-only' import.
        if ! echo "$CONTENT" | head -5 | grep -q "import[[:space:]]\+['\"]server-only['\"]"; then
          violations+=("FP-07: process.env secret access outside src/server/** or server-only module (INV-19).")
        fi
      fi
      ;;
  esac

  # FP-08: keyframe object literal missing coordinateSpace.
  # Heuristic: a multi-line block containing 't:' AND ('params:' or 'values:') without 'coordinateSpace'.
  if echo "$CONTENT" | grep -qE '^[[:space:]]*\{[[:space:]]*$|keyframes?[[:space:]]*[:=][[:space:]]*\['; then
    if echo "$CONTENT" | grep -qE '\bt[[:space:]]*:[[:space:]]*[0-9.]'; then
      if echo "$CONTENT" | grep -qE '\b(params|values)[[:space:]]*:'; then
        if ! echo "$CONTENT" | grep -qE '\bcoordinateSpace[[:space:]]*:'; then
          violations+=("FP-08: keyframe literal missing coordinateSpace discriminator (INV-21) — must be one of 'universe'|'hub-scene'|'viewport-composition'|'scroll-timeline'|'camera'.")
        fi
      fi
    fi
  fi

  # FP-09: async createNode forbidden (renderer-migration §8 contract; INV-14).
  case "$FILE_PATH" in
    */nodes/*|*/mock-app-source/nodes/*|*/runtime/shared/nodes/*)
      if echo "$CONTENT" | grep -E '\basync[[:space:]]+(function[[:space:]]+)?createNode\b|createNode[[:space:]]*=[[:space:]]*async\b' > /dev/null; then
        violations+=("FP-09: createNode must be synchronous (INV-14, renderer-migration §8). Async work happens inside primitives via cached loaders.")
      fi
      ;;
  esac

  # FP-11: direct mutation of store state (selection/viewMode).
  if echo "$CONTENT" | grep -E 'useGraphEditorStore\.getState\(\)\.(selectedNodeId|selectedHubId|viewMode)[[:space:]]*=' > /dev/null; then
    violations+=("FP-11: direct mutation of useGraphEditorStore state forbidden (INV-20) — use store actions.")
  fi

  # FP-12: viewMode literal outside canonical 5.
  if echo "$CONTENT" | grep -E "viewMode[[:space:]]*[:=][[:space:]]*['\"](preview|editor|split)['\"]" > /dev/null; then
    violations+=("FP-12: legacy viewMode literal ('preview'|'editor'|'split') — canonical set is 'galaxy'|'hub-world'|'canvas'|'preview-hub'|'preview-app' (RA-06).")
  fi

  # FP-13: FLUX/diffusion call without negative-text discipline (limited to asset pipeline files).
  case "$FILE_PATH" in
    */kid-kode-landing/scripts/generate-*|*/kid-kode-landing/scripts/provision-*|*/kid-kode-landing/src/lib/prism/mock-app-source/assets/*)
      if echo "$CONTENT" | grep -qE 'fal\.subscribe|fal\.run|flux|FLUX'; then
        if ! echo "$CONTENT" | grep -qE '"no text"|"no letters"|no_text|no_letters'; then
          violations+=("FP-13: FLUX/fal call without negative-text discipline (INV-13) — include 'no text, no letters, no labels' in negative prompt.")
        fi
      fi
      ;;
  esac

fi  # EDITOR_BUILD_ACTIVE block

if [[ ${#violations[@]} -gt 0 ]]; then
  echo "anti-drift-check BLOCKED write to $FILE_PATH:" >&2
  for v in "${violations[@]}"; do
    echo "  - $v" >&2
  done
  echo "" >&2
  echo "References: mock spec §1.4; PRISM-EDITOR-BUILD-SPEC.md §8 (FP-NN); .claude/rules/prism-editor-build.md." >&2
  echo "For legitimate mask/hit-area Graphics, add an 'ALLOWED-GRAPHICS:' comment within 3 lines of the call." >&2
  exit 2
fi

exit 0
