#!/usr/bin/env bash
# Stop — warn if commits were made since origin/prism-main without touching
# kid-kode-landing/notes/prism-mock-progress.md.
# Non-blocking: prints to stderr, exits 0.
set -u

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" 2>/dev/null || exit 0

# Only check if we're in a git repo with the expected branches.
git rev-parse --git-dir > /dev/null 2>&1 || exit 0
git rev-parse --verify origin/prism-main > /dev/null 2>&1 || exit 0

NEW_COMMITS=$(git log origin/prism-main..HEAD --oneline 2>/dev/null || true)
[[ -z "$NEW_COMMITS" ]] && exit 0

CHANGED=$(git diff --name-only origin/prism-main..HEAD 2>/dev/null || true)
if ! echo "$CHANGED" | grep -q 'kid-kode-landing/notes/prism-mock-progress.md'; then
  echo "⚠️  progress-reminder: $(echo "$NEW_COMMITS" | wc -l | tr -d ' ') commit(s) since origin/prism-main without touching notes/prism-mock-progress.md." >&2
  echo "    Update the log before pushing. (Ralph's /ralph-step step 12 is responsible for this.)" >&2
fi

exit 0
