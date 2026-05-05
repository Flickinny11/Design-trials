#!/usr/bin/env bash
# PostToolUse Write|Edit + SessionStart — block writes that simplify, modify, or
# remove the spec-defined infrastructure of the Prism mock app.
#
# Composes with all the OTHER hooks already in place — does NOT replace them:
#   - PreToolUse anti-drift-check.sh (existing) — §1.4 forbidden patterns
#   - PostToolUse dependency-allowlist-check.sh (added 2026-04-27) — dep + import drift
#   - PostToolUse format-check.sh + todo-scanner.sh (existing) — formatting + TODO/HACK markers
#   - SessionStart spec-presence-check.sh (existing) — top-level spec presence
#   - Stop progress-reminder.sh (existing) — progress-log touch
#   - Stop verify-on-stop.sh (added 2026-04-28) — spec-marker presence at end of turn
#   - This file (added 2026-04-28) — runtime / pipeline / build-script integrity
#
# Three trigger surfaces (decided by env var $CLAUDE_HOOK_EVENT or defaults to PostToolUse):
#   - PostToolUse Write|Edit: block (exit 2) if the just-written file violates spec-shape.
#   - SessionStart: warn (non-blocking) if any spec-required file is missing.
#   - Stop: warn if spec markers are missing at end of turn.
#
# What this hook blocks:
#   1. Removing required deps from package.json: pixi.js, pixi-filters, gsap,
#      sharp, maxrects-packer, globby, msdf-bmfont-xml, jszip, @fal-ai/client,
#      playwright, three, @react-three/fiber, @react-three/drei.
#   2. Removing required package.json scripts: build:atlas, build:msdf,
#      build:prism, verify:prism, dev, build, start.
#   3. Writing build-atlas.mjs, build-msdf.mjs, build-prism.mjs, verify-prism.mjs,
#      boot.ts, or index.ts in a way that drops their spec-required markers.
#   4. Hand-editing build outputs (atlas-0.avif, atlas-regions.json, mock-app.prism,
#      font-inter.msdf.*).
#   5. Introducing DOM rendering for visible chrome in player code.
#
# Exit codes:
#   0 = ok / out of scope
#   2 = block (stderr shown to Claude as feedback)

set -uo pipefail

input=$(cat 2>/dev/null || true)

# Detect event type. PostToolUse passes tool_input; SessionStart/Stop don't.
file_path=""
if [[ -n "$input" ]]; then
  file_path=$(printf '%s' "$input" | /usr/bin/python3 -c '
import sys, json
try:
  d = json.load(sys.stdin)
  print((d.get("tool_input") or {}).get("file_path") or "")
except Exception:
  print("")
' 2>/dev/null || echo "")
fi

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
KID="$REPO_ROOT/kid-kode-landing"

REQUIRED_FILES=(
  "$KID/src/lib/prism/player/boot.ts"
  "$KID/src/lib/prism/player/index.ts"
  "$KID/src/lib/prism/mock-app-source/assets/build-atlas.mjs"
  "$KID/src/lib/prism/mock-app-source/assets/build-msdf.mjs"
  "$KID/src/lib/prism/mock-app-source/build-prism.mjs"
  "$KID/scripts/verify-prism.mjs"
  "$KID/scripts/browser-smoke.mjs"
  "$KID/notes/prism-spec-extract.md"
  "$KID/src/lib/prism/mock-app-source/hubs/home-hub.json"
)

declare -a build_atlas_markers=( "import sharp" "MaxRectsPacker" "dest-in" ".avif(" "atlas-regions.json" )
declare -a build_msdf_markers=( "msdf-bmfont-xml" "font-inter.msdf" )
declare -a build_prism_markers=( "import JSZip" "manifest.json" "mock-app.prism" "artifactHash" )
declare -a verify_prism_markers=( "forbidden:PIXI.Text" "prism:nodeCount" "prism:artifactHash" "prism:three.methods" )
declare -a boot_markers=( "pixi.js" "BitmapText" )

declare -a build_outputs=(
  "public/prism-assets/atlas-0.avif"
  "public/prism-assets/atlas-regions.json"
  "public/prism-assets/mock-app.prism"
  "public/prism-assets/font-inter.msdf.png"
  "public/prism-assets/font-inter.msdf.fnt"
  "public/prism-assets/font-inter.msdf.json"
)

violations=()

# SessionStart / Stop branch — presence-only, non-blocking warning
if [[ -z "$file_path" ]]; then
  missing=()
  for f in "${REQUIRED_FILES[@]}"; do
    [[ -f "$f" ]] || missing+=("$f")
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "[spec-infrastructure-check] WARN — required spec infrastructure is missing:" >&2
    for m in "${missing[@]}"; do
      echo "  - $m" >&2
    done
    echo "Restore from git history before proceeding." >&2
  fi
  exit 0
fi

# PostToolUse Write|Edit branch — block on violation
[[ ! -f "$file_path" ]] && exit 0

case "$file_path" in
  "$KID"/*) rel="${file_path#$KID/}" ;;
  *) rel="$file_path" ;;
esac

# 1. Build outputs — block ANY hand-edit
for out in "${build_outputs[@]}"; do
  if [[ "$rel" == "$out" ]]; then
    violations+=("FORBIDDEN: hand-editing build output $out — these are deterministic outputs of the build chain (npm run build:atlas / build:msdf / build:prism). Re-run the build instead.")
  fi
done

# 2. package.json — required deps + required scripts must remain
if [[ "$rel" == "package.json" ]]; then
  result=$(/usr/bin/python3 - "$file_path" <<'PYEOF'
import sys, json
path = sys.argv[1]
try:
    with open(path) as f:
        pj = json.load(f)
except Exception as e:
    print(f"PARSE_ERROR: {e}")
    sys.exit(0)

required_deps = ["pixi.js", "pixi-filters", "gsap", "sharp", "maxrects-packer", "globby",
                 "msdf-bmfont-xml", "jszip", "@fal-ai/client", "playwright", "three",
                 "@react-three/fiber", "@react-three/drei"]
required_scripts = ["build:atlas", "build:msdf", "build:prism", "verify:prism", "dev", "build", "start"]

deps = set((pj.get("dependencies") or {}).keys()) | set((pj.get("devDependencies") or {}).keys())
scripts = set((pj.get("scripts") or {}).keys())

for d in required_deps:
    if d not in deps:
        print(f"MISSING_DEP: {d}")
for s in required_scripts:
    if s not in scripts:
        print(f"MISSING_SCRIPT: {s}")
PYEOF
)
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    case "$line" in
      MISSING_DEP:*)
        dep="${line#MISSING_DEP: }"
        violations+=("FORBIDDEN: removing dep \"$dep\" from package.json — this is a spec-required runtime/build dependency.")
        ;;
      MISSING_SCRIPT:*)
        scr="${line#MISSING_SCRIPT: }"
        violations+=("FORBIDDEN: removing package.json script \"$scr\" — this is a spec-required build/verification script.")
        ;;
      PARSE_ERROR:*)
        violations+=("FORBIDDEN: package.json no longer parses as JSON: ${line#PARSE_ERROR: }")
        ;;
    esac
  done <<< "$result"
fi

# 3. Per-file markers
check_markers() {
  local fpath="$1"
  shift
  local markers=("$@")
  local m
  for m in "${markers[@]}"; do
    if ! grep -qF "$m" "$fpath" 2>/dev/null; then
      violations+=("FORBIDDEN: $rel missing required marker \"$m\" — spec-shape requirement.")
    fi
  done
}

case "$rel" in
  src/lib/prism/mock-app-source/assets/build-atlas.mjs)
    check_markers "$file_path" "${build_atlas_markers[@]}" ;;
  src/lib/prism/mock-app-source/assets/build-msdf.mjs)
    check_markers "$file_path" "${build_msdf_markers[@]}" ;;
  src/lib/prism/mock-app-source/build-prism.mjs)
    check_markers "$file_path" "${build_prism_markers[@]}" ;;
  scripts/verify-prism.mjs)
    check_markers "$file_path" "${verify_prism_markers[@]}" ;;
  src/lib/prism/player/boot.ts|src/lib/prism/player/index.ts)
    check_markers "$file_path" "${boot_markers[@]}" ;;
esac

# 4. Player / prism-player code — block DOM rendering of visible chrome
case "$rel" in
  src/lib/prism/player/*|src/lib/prism/mock-app-source/nodes/*|src/components/prism-player/*)
    if [[ "$file_path" == *.ts || "$file_path" == *.tsx || "$file_path" == *.js || "$file_path" == *.mjs ]]; then
      if grep -E "document\.createElement\(['\"](div|span|p|h[1-6]|button|a|img)['\"]\)" "$file_path" 2>/dev/null > /dev/null; then
        if ! grep -q "ALLOWED-DOM-DEBUG" "$file_path" 2>/dev/null; then
          violations+=("SUSPECT: document.createElement of a visible HTML element in $rel — Prism mock app uses PixiJS rendering, not DOM chrome. If debug-only, add // ALLOWED-DOM-DEBUG: <reason>.")
        fi
      fi
      if grep -E "\.style\.(background|border|boxShadow|backgroundImage)[[:space:]]*=" "$file_path" 2>/dev/null > /dev/null; then
        if ! grep -q "ALLOWED-DOM-DEBUG" "$file_path" 2>/dev/null; then
          violations+=("SUSPECT: inline style mutation for visible chrome in $rel — atlas-sourced visuals only. If debug-only, add // ALLOWED-DOM-DEBUG: <reason>.")
        fi
      fi
    fi
    ;;
esac

if [[ ${#violations[@]} -gt 0 ]]; then
  echo "[spec-infrastructure-check] BLOCK — spec-infrastructure drift detected in $rel:" >&2
  for v in "${violations[@]}"; do
    echo "  - $v" >&2
  done
  echo "" >&2
  echo "Spec extract: kid-kode-landing/notes/prism-spec-extract.md" >&2
  echo "Allowlist + markers: kid-kode-landing/.claude/hooks/spec-infrastructure-check.sh" >&2
  echo "If drift is intentional (deliberate spec evolution), update marker list AND document in notes/mockup-pipeline.md." >&2
  exit 2
fi

exit 0
