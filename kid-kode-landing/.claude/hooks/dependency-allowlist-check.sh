#!/usr/bin/env bash
# PreToolUse Write|Edit|MultiEdit — dependency-allowlist + canonical-3
# forbidden-pattern guard. Thin wrapper around the Python analyzer, which
# inspects the *pending* write content (PreToolUse runs before the write).
#
# Surfaces (see dependency-allowlist-check.py for detail):
#   1. package.json — unapproved/forbidden deps + dependency DOWNGRADES.
#   2. imports under src/lib/prism/**, src/components/prism-player/**, scripts/**.
#   3. canonical-3 forbidden patterns (PixiJS / 2nd visible renderer / CDN-three
#      split / diffusion-drawn text / stored global fps / app-behavior-in-canvas).
#
# Exit codes: 0 = ok / out of scope, 2 = block (stderr shown to Claude).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec /usr/bin/python3 "$HERE/dependency-allowlist-check.py"
