#!/usr/bin/env bash
# PreToolUse hook for Write/Edit — blocks forbidden patterns.
# Two scopes:
#   1. Mock-spec §1.4 patterns (always active): prism runtime/build code only.
#   2. Editor-build FP-NN (active only when .prism-editor-build-active marker exists at repo
#      root): broader scope under kid-kode-landing/src/** with per-FP path filters.
# Reads hook JSON from stdin; exits 2 (= block + show stderr to Claude) on violations.

set -euo pipefail

input=$(cat)

file_path=$(printf '%s' "$input" | /usr/bin/python3 -c 'import sys,json; d=json.load(sys.stdin); print((d.get("tool_input") or {}).get("file_path") or "")')
content=$(printf '%s' "$input" | /usr/bin/python3 -c 'import sys,json; d=json.load(sys.stdin); ti=d.get("tool_input") or {}; print(ti.get("content") or ti.get("new_string") or "")')

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"

# Always-active scope: prism runtime/build code only.
ALWAYS_ACTIVE=0
case "$file_path" in
  */src/lib/prism/player/*|*/src/lib/prism/artifact/*|*/src/lib/prism/local-backend/*|*/src/lib/prism/shr/*|*/src/components/prism-player/*|*/src/lib/prism/mock-app-source/nodes/*|*/src/lib/prism/mock-app-source/backends/*|*/src/lib/prism/mock-app-source/assets/*.mjs|*/src/lib/prism/mock-app-source/build-prism.mjs)
    ALWAYS_ACTIVE=1 ;;
esac

# Editor-build scope: only fires when the marker exists.
EDITOR_BUILD_ACTIVE=0
if [ -f "$REPO_ROOT/.prism-editor-build-active" ]; then
  case "$file_path" in
    */kid-kode-landing/src/*|*/kid-kode-landing/scripts/generate-*|*/kid-kode-landing/scripts/provision-*)
      EDITOR_BUILD_ACTIVE=1 ;;
  esac
fi

if [ $ALWAYS_ACTIVE -eq 0 ] && [ $EDITOR_BUILD_ACTIVE -eq 0 ]; then
  exit 0
fi

violations=()

# ---- Always-active mock-spec §1.4 checks (prism runtime/build code only) ----
if [ $ALWAYS_ACTIVE -eq 1 ]; then

  if printf '%s' "$content" | grep -qE '\bnew[[:space:]]+PIXI\.Text[[:space:]]*\('; then
    violations+=("FORBIDDEN: \`new PIXI.Text(...)\` — mock spec §1.4 prohibits PIXI.Text. Use sharp-svg (build time) or PIXI.BitmapText with MSDF (runtime dynamic data only).")
  fi
  if printf '%s' "$content" | grep -qE '\bPIXI\.Text\b'; then
    violations+=("FORBIDDEN: reference to \`PIXI.Text\` — §1.4 prohibits the class entirely. Replace with BitmapText + MSDF atlas.")
  fi

  if printf '%s' "$content" | grep -qE 'new[[:space:]]+PIXI\.Graphics[[:space:]]*\('; then
    if ! printf '%s' "$content" | grep -q 'ALLOWED-GRAPHICS'; then
      violations+=("SUSPECT: \`new PIXI.Graphics()\` without an \`// ALLOWED-GRAPHICS: <reason>\` comment in the file. §1.4 permits Graphics ONLY for invisible hit areas / masks / dev overlays. If this is one of those cases, add the marker comment.")
    fi
  fi

  if printf '%s' "$content" | grep -qE '(innerHTML|outerHTML)[[:space:]]*=|document\.write\('; then
    violations+=("FORBIDDEN: DOM text injection (\`innerHTML=\`, \`outerHTML=\`, \`document.write\`) in Prism runtime code. Render via atlas images or MSDF BitmapText only.")
  fi

  if printf '%s' "$content" | grep -qE '\b(fillText|strokeText)[[:space:]]*\('; then
    violations+=("FORBIDDEN: Canvas 2D \`fillText\`/\`strokeText\`. Text is compiled to the atlas via Sharp+SVG at build time (§5.2) or rendered at runtime via MSDF BitmapText (§1.4 exception 1).")
  fi

  if printf '%s' "$content" | grep -qE '\.style\.(background|border|boxShadow|backgroundImage)[[:space:]]*='; then
    if ! printf '%s' "$content" | grep -q 'ALLOWED-DOM-STYLE'; then
      violations+=("SUSPECT: direct DOM \`.style.background/.border/.boxShadow\` in Prism runtime. §1.4 forbids CSS for visible chrome — use atlas overlays instead. If this is for an invisible accessibility overlay, add \`// ALLOWED-DOM-STYLE: <reason>\` to bypass.")
    fi
  fi

fi  # ALWAYS_ACTIVE

# ---- Editor-build FP-NN checks (PRISM-EDITOR-BUILD-SPEC.md §8) ----
if [ $EDITOR_BUILD_ACTIVE -eq 1 ]; then

  # FP-01: PixiJS imports anywhere under kid-kode-landing/src/**.
  if printf '%s' "$content" | grep -qE "from[[:space:]]+['\"]pixi|import[[:space:]]+\*[[:space:]]+as[[:space:]]+PIXI\b"; then
    violations+=("FP-01: PixiJS import forbidden (INV-11) — runtime is Three.js WebGPU. See PRISM-EDITOR-BUILD-SPEC.md §8.")
  fi

  # FP-02: THREE.TextGeometry.
  if printf '%s' "$content" | grep -qE '\bnew[[:space:]]+THREE\.TextGeometry[[:space:]]*\('; then
    violations+=("FP-02: THREE.TextGeometry forbidden (INV-13) — text uses MSDF via three-msdf-text-webgpu.")
  fi

  # FP-04: destructive position writes inside compile/organize/preview function bodies.
  if printf '%s' "$content" | grep -qE '^[[:space:]]*(function[[:space:]]+|const[[:space:]]+|export[[:space:]]+(default[[:space:]]+)?(function[[:space:]]+|async[[:space:]]+function[[:space:]]+)?)(compile|organize|previewHub|previewApp)[A-Za-z_0-9]*\b'; then
    if printf '%s' "$content" | grep -qE '\.(scenePosition|editorTransform|canvasTransform|compiledTransform)\.(x|y|z)[[:space:]]*=[^=]'; then
      violations+=("FP-04: destructive position write inside compile/organize/preview function (INV-17) — compile is non-destructive. Clone the data; do not mutate source positions.")
    fi
  fi

  # FP-05: document.* / window.* in runtime/node modules (window.devicePixelRatio allowed).
  case "$file_path" in
    */kid-kode-landing/src/lib/prism/runtime/*|*/kid-kode-landing/src/lib/prism/mock-app-source/nodes/*|*/kid-kode-landing/src/components/prism-player/*)
      if printf '%s' "$content" | grep -qE '\bdocument\.[a-zA-Z]'; then
        violations+=("FP-05: document.* forbidden in runtime/node modules (INV-15).")
      fi
      if printf '%s' "$content" | grep -qPE '\bwindow\.(?!devicePixelRatio\b)[a-zA-Z]' 2>/dev/null; then
        violations+=("FP-05: window.* forbidden in runtime/node modules — only window.devicePixelRatio is allowed (INV-15).")
      fi
      ;;
  esac

  # FP-06: raw secret string literals. (Character class: dash placed at end to avoid range parse.)
  if printf '%s' "$content" | grep -qiE "(api[_-]?key|secret|token|password|client[_-]?secret)[[:space:]]*[:=][[:space:]]*[\"'][A-Za-z0-9_./+=-]{16,}[\"']"; then
    violations+=("FP-06: raw secret string literal forbidden (INV-19) — use capability references; resolve via server-only vault.")
  fi

  # FP-07: process.env.*_SECRET outside src/server/** or server-only module.
  case "$file_path" in
    */kid-kode-landing/src/server/*) ;;
    *)
      if printf '%s' "$content" | grep -qE 'process\.env\.[A-Z_]*(SECRET|KEY|TOKEN|PASSWORD)'; then
        if ! printf '%s' "$content" | head -5 | grep -q "import[[:space:]]\+['\"]server-only['\"]"; then
          violations+=("FP-07: process.env secret access outside src/server/** or server-only module (INV-19).")
        fi
      fi
      ;;
  esac

  # FP-08: keyframe literal missing coordinateSpace.
  if printf '%s' "$content" | grep -qE 'keyframes?[[:space:]]*[:=][[:space:]]*\['; then
    if printf '%s' "$content" | grep -qE '\bt[[:space:]]*:[[:space:]]*[0-9.]'; then
      if printf '%s' "$content" | grep -qE '\b(params|values)[[:space:]]*:'; then
        if ! printf '%s' "$content" | grep -qE '\bcoordinateSpace[[:space:]]*:'; then
          violations+=("FP-08: keyframe literal missing coordinateSpace discriminator (INV-21) — must be one of 'universe'|'hub-scene'|'viewport-composition'|'scroll-timeline'|'camera'.")
        fi
      fi
    fi
  fi

  # FP-09: async createNode.
  case "$file_path" in
    */nodes/*|*/mock-app-source/nodes/*|*/runtime/shared/nodes/*)
      if printf '%s' "$content" | grep -qE '\basync[[:space:]]+(function[[:space:]]+)?createNode\b|createNode[[:space:]]*=[[:space:]]*async\b'; then
        violations+=("FP-09: createNode must be synchronous (INV-14, renderer-migration §8). Async work happens inside primitives via cached loaders.")
      fi
      ;;
  esac

  # FP-11: direct mutation of store selection/viewMode.
  if printf '%s' "$content" | grep -qE 'useGraphEditorStore\.getState\(\)\.(selectedNodeId|selectedHubId|viewMode)[[:space:]]*='; then
    violations+=("FP-11: direct mutation of useGraphEditorStore state forbidden (INV-20) — use store actions.")
  fi

  # FP-12: legacy viewMode literal.
  if printf '%s' "$content" | grep -qE "viewMode[[:space:]]*[:=][[:space:]]*['\"](preview|editor|split)['\"]"; then
    violations+=("FP-12: legacy viewMode literal ('preview'|'editor'|'split') — canonical set is 'galaxy'|'hub-world'|'canvas'|'preview-hub'|'preview-app' (RA-06).")
  fi

  # FP-13: FLUX/fal call without negative-text discipline (asset pipeline files only).
  case "$file_path" in
    */kid-kode-landing/scripts/generate-*|*/kid-kode-landing/scripts/provision-*|*/kid-kode-landing/src/lib/prism/mock-app-source/assets/*)
      if printf '%s' "$content" | grep -qE 'fal\.subscribe|fal\.run|flux|FLUX'; then
        if ! printf '%s' "$content" | grep -qE '"no text"|"no letters"|no_text|no_letters'; then
          violations+=("FP-13: FLUX/fal call without negative-text discipline (INV-13) — include 'no text, no letters, no labels' in negative prompt.")
        fi
      fi
      ;;
  esac

fi  # EDITOR_BUILD_ACTIVE

if [ ${#violations[@]} -gt 0 ]; then
  printf '\n=== ANTI-DRIFT BLOCK ===\n' >&2
  printf 'File: %s\n' "$file_path" >&2
  for v in "${violations[@]}"; do printf '  - %s\n' "$v" >&2; done
  printf '\nReferences: mock spec §1.4; PRISM-EDITOR-BUILD-SPEC.md §8 (FP-NN); .claude/rules/prism-editor-build.md.\n' >&2
  printf 'If this is a false positive, fix the hook at .claude/hooks/anti-drift-check.sh.\n' >&2
  exit 2
fi

exit 0
