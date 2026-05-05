#!/usr/bin/env bash
# Stop hook — at end of every Claude turn, sanity-check that all spec-required
# infrastructure files are still present on disk AND that verify:prism still
# returns 15/15 if any prism code was touched in the turn. Non-blocking warning.
#
# Composes with the existing Stop progress-reminder.sh (which warns if commits
# happened without touching prism-mock-progress.md). Both hooks run on every
# Stop event in this repo.

set -u

REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
KID="$REPO_ROOT/kid-kode-landing"

# 1. Presence check — required spec infrastructure must still be on disk.
required=(
  "$KID/src/lib/prism/player/boot.ts"
  "$KID/src/lib/prism/player/index.ts"
  "$KID/src/lib/prism/mock-app-source/assets/build-atlas.mjs"
  "$KID/src/lib/prism/mock-app-source/assets/build-msdf.mjs"
  "$KID/src/lib/prism/mock-app-source/build-prism.mjs"
  "$KID/scripts/verify-prism.mjs"
  "$KID/scripts/browser-smoke.mjs"
  "$KID/notes/prism-spec-extract.md"
  "$KID/src/lib/prism/mock-app-source/hubs/home-hub.json"
  "$KID/public/prism-assets/mock-app.prism"
)

missing=()
for f in "${required[@]}"; do
  [[ -f "$f" ]] || missing+=("$f")
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "[verify-on-stop] WARN — spec-required infrastructure files missing at end of turn:" >&2
  for m in "${missing[@]}"; do
    echo "  - ${m#$REPO_ROOT/}" >&2
  done
  echo "    Restore from git history before committing." >&2
fi

# 2. Stronger check — run verify:prism if any prism code or graph was touched
#    in this turn (vs HEAD). Cost ~2s; benefit is catching breakage before it
#    ships and before the next Ralph iteration starts.
TOUCHED=""
if git -C "$REPO_ROOT" rev-parse --git-dir > /dev/null 2>&1; then
  TOUCHED=$(git -C "$REPO_ROOT" diff --name-only HEAD 2>/dev/null | grep -E "kid-kode-landing/(src/lib/prism/|src/components/prism-player/|src/components/editor/|scripts/|notes/|public/prism-assets/)" || true)
  # Also include staged changes
  STAGED=$(git -C "$REPO_ROOT" diff --name-only --cached 2>/dev/null | grep -E "kid-kode-landing/(src/lib/prism/|src/components/prism-player/|src/components/editor/|scripts/|notes/|public/prism-assets/)" || true)
  TOUCHED="$TOUCHED"$'\n'"$STAGED"
fi

if [[ -n "$(echo "$TOUCHED" | tr -d '[:space:]')" ]]; then
  if [[ -f "$KID/package.json" ]] && command -v npm >/dev/null 2>&1; then
    OUTPUT=$(cd "$KID" && npm run verify:prism 2>&1) || STATUS=$?
    STATUS=${STATUS:-0}
    if [[ "$STATUS" -ne 0 ]]; then
      echo "[verify-on-stop] WARN — verify:prism FAILED after prism/editor/script edits in this turn (exit=$STATUS):" >&2
      # Surface only the FAIL/PASS summary lines and any failing check IDs to keep noise low.
      echo "$OUTPUT" | grep -E "(FAIL|PASS|/15)" | tail -20 >&2
      echo "    Run: cd kid-kode-landing && npm run verify:prism — fix before committing or starting the next iteration." >&2
    fi
  fi
fi

exit 0
