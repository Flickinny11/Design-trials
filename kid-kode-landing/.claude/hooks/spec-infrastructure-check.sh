#!/usr/bin/env bash
# Migration-aware wrapper for spec-infrastructure-check.sh.
# When .ralph-migration-active exists, skip the original (which would block
# the renderer migration's PixiJS removal in Phase 5). Otherwise, delegate.
if [ -f "$CLAUDE_PROJECT_DIR/.ralph-migration-active" ] || \
   [ -f "$CLAUDE_PROJECT_DIR/kid-kode-landing/.ralph-migration-active" ]; then
  exit 0
fi
exec "$0.original" "$@"
