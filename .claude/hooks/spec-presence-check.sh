#!/usr/bin/env bash
# SessionStart — warn if the canonical Prism spec extract is missing.
# Non-blocking: prints to stderr, exits 0.
set -u

EXTRACT="${CLAUDE_PROJECT_DIR:-$(pwd)}/kid-kode-landing/notes/prism-spec-extract.md"
if [[ ! -f "$EXTRACT" ]]; then
  echo "⚠️  spec-presence-check: $EXTRACT is missing." >&2
  echo "    Ralph tasks reference this file as the canonical spec (original docs/prism/*.md are not on disk)." >&2
  echo "    Restore from git history or an earlier commit before running /ralph-step." >&2
fi

exit 0
