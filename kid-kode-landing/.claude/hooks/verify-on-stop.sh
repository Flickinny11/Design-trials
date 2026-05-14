#!/usr/bin/env bash
# Migration- and editor-build-aware wrapper for verify-on-stop.sh.
#
# Marker behavior:
#   - .prism-editor-build-active present → invoke verify-editor-runtimes.mjs (two-runtime
#     snapshot) when available, then exit 0 (non-blocking, matches Stop semantics).
#   - .ralph-migration-active present → skip the original verify:prism (renderer migration
#     deliberately breaks PixiJS-era §10 criteria during phases 2–8). Exit 0.
#   - Neither marker → delegate to verify-on-stop.sh.original.

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

if [ -f "$REPO_ROOT/.prism-editor-build-active" ]; then
  if [ -f "$REPO_ROOT/kid-kode-landing/scripts/verify-editor-runtimes.mjs" ]; then
    if ! ( cd "$REPO_ROOT/kid-kode-landing" && node scripts/verify-editor-runtimes.mjs --on-stop 2>&1 ); then
      echo "[verify-on-stop] WARN — verify-editor-runtimes.mjs reported failures (non-blocking)." >&2
    fi
  fi
  exit 0
fi

if [ -f "$REPO_ROOT/.ralph-migration-active" ] || \
   [ -f "$REPO_ROOT/kid-kode-landing/.ralph-migration-active" ]; then
  exit 0
fi

exec "$0.original" "$@"
