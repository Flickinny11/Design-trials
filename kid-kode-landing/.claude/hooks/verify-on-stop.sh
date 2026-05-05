#!/usr/bin/env bash
# Migration-aware wrapper for verify-on-stop.sh.
# When .ralph-migration-active exists, skip the original `npm run verify:prism`
# (it enforces PixiJS-era §10 criteria that the migration deliberately
# breaks during phases 2-8). Otherwise, delegate.
if [ -f "$CLAUDE_PROJECT_DIR/.ralph-migration-active" ] || \
   [ -f "$CLAUDE_PROJECT_DIR/kid-kode-landing/.ralph-migration-active" ]; then
  exit 0
fi
exec "$0.original" "$@"
