#!/usr/bin/env bash
# PostToolUse Write|Edit — block writes that introduce dependencies or imports
# outside the agreed-upon spec allowlist.
#
# Two surfaces:
#   1. package.json / package-lock.json — any new dependency key not on the
#      allowlist below blocks the write (exit 2).
#   2. .ts/.tsx/.js/.mjs/.cjs under src/lib/prism/**, src/components/prism-player/**,
#      and scripts/** — any `import ... from 'X'` or `require('X')` for X not on
#      the allowlist blocks.
#
# Forbidden (always block, regardless of context): html-to-image (per spec line 1251).
#
# Exit codes:
#   0 = ok / out of scope
#   2 = block (stderr shown to Claude as feedback)

set -uo pipefail

input=$(cat)

file_path=$(printf '%s' "$input" | /usr/bin/python3 -c 'import sys,json; d=json.load(sys.stdin); print((d.get("tool_input") or {}).get("file_path") or "")' 2>/dev/null || echo "")
[[ -z "$file_path" ]] && exit 0

# Exit early if the file doesn't actually exist on disk yet (Edit tool may run before
# the file is committed in some flows). PostToolUse runs after the write, so usually
# the file is there.
[[ ! -f "$file_path" ]] && exit 0

# ============================================================================
# Allowlist — packages that may be imported / declared as deps in this repo.
# Keep alphabetized within each group. To allow a new package, add it here AND
# document the rationale in notes/post-ralph-tweaks.md or notes/mockup-pipeline.md.
# ============================================================================

# Runtime dependencies (allowed in src/**, .ts/.tsx/.js/.mjs files)
RUNTIME_ALLOW=(
  "@radix-ui/react-dialog"
  "@radix-ui/react-popover"
  "@radix-ui/react-scroll-area"
  "@radix-ui/react-slider"
  "@radix-ui/react-tabs"
  "@radix-ui/react-tooltip"
  "@react-three/drei"
  "@react-three/fiber"
  "@react-three/postprocessing"
  "camera-controls"
  "clsx"
  "d3-force-3d"
  "gsap"
  "jszip"
  "lenis"
  "next"
  "next/font"
  "next/font/google"
  "next/font/local"
  "next/image"
  "next/link"
  "next/navigation"
  "next/server"
  "pixi-filters"
  "pixi.js"
  "postprocessing"
  "react"
  "react-dom"
  "react/jsx-runtime"
  "simplex-noise"
  "tailwind-merge"
  "three"
  "three/examples/jsm/controls/OrbitControls"
  "zustand"
  "zustand/middleware"
)

# Build / scripts dependencies (allowed in scripts/** + assets/*.mjs)
BUILD_ALLOW=(
  "@fal-ai/client"
  "dotenv"
  "ffmpeg-static"
  "globby"
  "maxrects-packer"
  "msdf-bmfont-xml"
  "playwright"
  "sharp"
)

# DevDeps allowed in package.json devDependencies
DEVDEP_ALLOW=(
  "@types/node"
  "@types/react"
  "@types/react-dom"
  "@types/three"
  "autoprefixer"
  "postcss"
  "tailwindcss"
  "typescript"
)

# Hard-fail: forbidden no matter what
FORBIDDEN=(
  "html-to-image"
)

# Combined allowlist for import-statement scanning. node:* builtins always allowed.
ALL_ALLOW=("${RUNTIME_ALLOW[@]}" "${BUILD_ALLOW[@]}" "${DEVDEP_ALLOW[@]}")

# ============================================================================
# Helpers
# ============================================================================

# Returns 0 if $1 is in ${ALL_ALLOW[@]} or starts with node: (Node.js builtin)
# or starts with ./ or ../ or / (relative/absolute path). Returns 1 otherwise.
is_allowed_import() {
  local pkg="$1"
  case "$pkg" in
    node:*|./*|../*|/*)
      return 0
      ;;
  esac
  local a
  for a in "${ALL_ALLOW[@]}"; do
    if [[ "$pkg" == "$a" ]]; then
      return 0
    fi
  done
  # Also allow scoped subpaths of allowed scoped packages, e.g. "@react-three/fiber/foo"
  for a in "${ALL_ALLOW[@]}"; do
    if [[ "$pkg" == "$a"/* ]]; then
      return 0
    fi
  done
  return 1
}

is_forbidden() {
  local pkg="$1"
  local f
  for f in "${FORBIDDEN[@]}"; do
    if [[ "$pkg" == "$f" || "$pkg" == "$f"/* ]]; then
      return 0
    fi
  done
  return 1
}

violations=()

# ============================================================================
# Surface 1: package.json / package-lock.json — check newly added deps
# ============================================================================

is_package_json=0
case "$file_path" in
  */package.json|*/package-lock.json) is_package_json=1 ;;
esac

if [[ "$is_package_json" -eq 1 && "$file_path" == *"/package.json" ]]; then
  # Extract dependency keys, check each against allowlists
  while IFS= read -r pkg; do
    [[ -z "$pkg" ]] && continue
    if is_forbidden "$pkg"; then
      violations+=("FORBIDDEN dep in package.json: \"$pkg\" — explicitly disallowed by spec line 1251.")
      continue
    fi
    # Check against runtime + build + devdep allowlists
    found=0
    for a in "${RUNTIME_ALLOW[@]}" "${BUILD_ALLOW[@]}" "${DEVDEP_ALLOW[@]}"; do
      if [[ "$pkg" == "$a" ]]; then found=1; break; fi
    done
    if [[ "$found" -eq 0 ]]; then
      violations+=("UNAPPROVED dep in package.json: \"$pkg\" — not on the allowlist in .claude/hooks/dependency-allowlist-check.sh. If this is intentional, add it to the allowlist with rationale in notes/mockup-pipeline.md §10.")
    fi
  done < <(/usr/bin/python3 -c '
import sys, json
try:
  with open(sys.argv[1]) as f:
    pj = json.load(f)
except Exception:
  sys.exit(0)
deps = list((pj.get("dependencies") or {}).keys()) + list((pj.get("devDependencies") or {}).keys())
for d in deps:
  print(d)
' "$file_path" 2>/dev/null)
fi

# ============================================================================
# Surface 2: code files — check import statements
# ============================================================================

# Only enforce on prism runtime + build code paths.
in_prism_scope=0
case "$file_path" in
  */src/lib/prism/*|*/src/components/prism-player/*|*/scripts/*) in_prism_scope=1 ;;
esac

is_code=0
case "$file_path" in
  *.ts|*.tsx|*.js|*.mjs|*.cjs|*.jsx) is_code=1 ;;
esac

if [[ "$in_prism_scope" -eq 1 && "$is_code" -eq 1 && "$is_package_json" -eq 0 ]]; then
  # Extract import / require targets — supports:
  #   import ... from 'pkg'
  #   import 'pkg'
  #   require('pkg')
  #   await import('pkg')
  pkgs=$(grep -E "^(import|export)[[:space:]].*[[:space:]]from[[:space:]]+['\"]([^'\"]+)['\"]|^import[[:space:]]+['\"]([^'\"]+)['\"]|require\(['\"]([^'\"]+)['\"]\)|await import\(['\"]([^'\"]+)['\"]\)" "$file_path" 2>/dev/null | \
    sed -E "s/.*from[[:space:]]+['\"]([^'\"]+)['\"].*/\1/; s/^import[[:space:]]+['\"]([^'\"]+)['\"].*/\1/; s/.*require\(['\"]([^'\"]+)['\"]\).*/\1/; s/.*await import\(['\"]([^'\"]+)['\"]\).*/\1/" | \
    sort -u)

  while IFS= read -r pkg; do
    [[ -z "$pkg" ]] && continue
    if is_forbidden "$pkg"; then
      violations+=("FORBIDDEN import in $(basename "$file_path"): '$pkg' — explicitly disallowed by spec line 1251.")
      continue
    fi
    if ! is_allowed_import "$pkg"; then
      violations+=("UNAPPROVED import in $(basename "$file_path"): '$pkg' — not on the allowlist. If intentional, add to .claude/hooks/dependency-allowlist-check.sh and document the rationale.")
    fi
  done <<< "$pkgs"
fi

# ============================================================================
# Report
# ============================================================================

if [[ ${#violations[@]} -gt 0 ]]; then
  echo "[dependency-allowlist-check] BLOCK — drift detected in $file_path:" >&2
  for v in "${violations[@]}"; do
    echo "  - $v" >&2
  done
  echo "" >&2
  echo "Allowlist managed at: .claude/hooks/dependency-allowlist-check.sh" >&2
  echo "Approved dependencies are documented in notes/mockup-pipeline.md §10 and notes/prism-spec-extract.md." >&2
  exit 2
fi

exit 0
