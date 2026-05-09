#!/usr/bin/env bash
# Blocking renderer migration audit for Claude/Codex-compatible hook adapters.
set -euo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-}"
if [[ -z "$ROOT" ]]; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi

cd "$ROOT/kid-kode-landing"
npm run guard:prism-renderer
