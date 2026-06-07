#!/usr/bin/env bash
# Resume the Ralph loop after a paused-* breakpoint.
#
# Usage:
#   ./scripts/ralph-resume.sh                # flip paused-* → running, re-launch ralph.sh
#   ./scripts/ralph-resume.sh --dry          # show state; don't launch
#   ./scripts/ralph-resume.sh --only=§10     # raise only the §10 phase cap by one default allotment
#   ./scripts/ralph-resume.sh --no-launch    # flip status only; caller re-launches
#
# Terminal statuses (complete, failed) are NOT resumable — this script errors out.
# paused-ceiling, paused-convergence, paused-phase-cap are resumable.

set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
KIDDIR="$REPO_ROOT/kid-kode-landing"
STATE="$KIDDIR/notes/ralph-state.json"

command -v jq >/dev/null 2>&1 || { echo "ralph-resume.sh: jq is required" >&2; exit 1; }
[[ -f "$STATE" ]] || { echo "ralph-resume.sh: $STATE missing" >&2; exit 1; }

DRY=0
LAUNCH=1
ONLY_PHASE=""
for arg in "$@"; do
  case "$arg" in
    --dry)        DRY=1 ;;
    --no-launch)  LAUNCH=0 ;;
    --only=*)     ONLY_PHASE="${arg#--only=}" ;;
    -h|--help)
      sed -n '2,11p' "$0"; exit 0 ;;
    *) echo "ralph-resume.sh: unknown arg: $arg" >&2; exit 1 ;;
  esac
done

iso_now() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
write_state() {
  local tmp
  tmp="$(mktemp "$STATE.tmp.XXXXXX")"
  cat > "$tmp"
  mv "$tmp" "$STATE"
}

STATUS=$(jq -r '.status' "$STATE")
case "$STATUS" in
  running)
    echo "ralph-resume.sh: state.status=running — nothing to resume."
    if (( LAUNCH )); then
      echo "ralph-resume.sh: launching scripts/ralph.sh …"
      exec "$KIDDIR/scripts/ralph.sh"
    fi
    exit 0
    ;;
  complete|failed)
    echo "ralph-resume.sh: state.status=$STATUS — TERMINAL; not resumable." >&2
    exit 1
    ;;
  paused-ceiling|paused-convergence|paused-phase-cap)
    echo "ralph-resume.sh: state.status=$STATUS — resuming."
    ;;
  *)
    echo "ralph-resume.sh: unknown status $STATUS — aborting." >&2; exit 1 ;;
esac

if (( DRY )); then
  jq '{
    status, currentIteration, maxIterations,
    convergence, phaseCaps, checkpoint,
    lastBreakpoint: (.breakpoints | if length > 0 then last else null end)
  }' "$STATE"
  exit 0
fi

jq \
  --arg now "$(iso_now)" \
  --arg only "$ONLY_PHASE" \
  '
  .status = "running"
  | .updatedAt = $now
  | .convergence.stagnantStreak = 0
  | (if ($only != "") then
       .phaseCaps[$only].cap = ((.phaseCaps[$only].cap // .maxIterationsPerPhase // 50) + (.maxIterationsPerPhase // 50))
     else . end)
  | .resumeFrom = (.checkpoint // null)
  ' "$STATE" | write_state

echo "ralph-resume.sh: state flipped to running (resumeFrom = checkpoint)."

if (( LAUNCH )); then
  echo "ralph-resume.sh: launching scripts/ralph.sh …"
  exec "$KIDDIR/scripts/ralph.sh"
else
  echo "ralph-resume.sh: --no-launch set — caller must re-run ralph.sh."
fi
