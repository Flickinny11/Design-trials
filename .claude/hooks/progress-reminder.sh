#!/usr/bin/env bash
# Stop — warn if commits were made on the active branch without touching the
# expected progress log:
#   - prism-renderer-ralph branch  → notes/prism-renderer-progress.md
#   - any other branch (legacy)    → notes/prism-mock-progress.md
# Non-blocking: prints to stderr, exits 0.
set -u

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" 2>/dev/null || exit 0

git rev-parse --git-dir > /dev/null 2>&1 || exit 0

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

# Pick the upstream baseline + progress log for this branch.
if [[ "$BRANCH" == "prism-renderer-ralph" ]]; then
  BASE="origin/prism-renderer-ralph"
  LOG_PATH="kid-kode-landing/notes/prism-renderer-progress.md"
  LOG_LABEL="notes/prism-renderer-progress.md"
else
  BASE="origin/prism-main"
  LOG_PATH="kid-kode-landing/notes/prism-mock-progress.md"
  LOG_LABEL="notes/prism-mock-progress.md"
fi

git rev-parse --verify "$BASE" > /dev/null 2>&1 || exit 0

NEW_COMMITS=$(git log "$BASE"..HEAD --oneline 2>/dev/null || true)
[[ -z "$NEW_COMMITS" ]] && exit 0

CHANGED=$(git diff --name-only "$BASE"..HEAD 2>/dev/null || true)
if ! echo "$CHANGED" | grep -qF "$LOG_PATH"; then
  echo "⚠️  progress-reminder: $(echo "$NEW_COMMITS" | wc -l | tr -d ' ') commit(s) since $BASE without touching $LOG_LABEL." >&2
  echo "    Update the log before pushing. (Ralph's /ralph-step step 12 is responsible for this.)" >&2
fi

exit 0
