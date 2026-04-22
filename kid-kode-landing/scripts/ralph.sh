#!/usr/bin/env bash
# Ralph outer loop — drives the autonomous Prism mock-app build.
# Each iteration spawns a fresh `claude --print` process to run /ralph-step.
# Exits when state.status != "running" OR MAX_ITER reached.

set -euo pipefail

# ------------------------------------------------------------------
# Paths
# ------------------------------------------------------------------
REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
KIDDIR="$REPO_ROOT/kid-kode-landing"
STATE="$KIDDIR/notes/ralph-state.json"
LOGDIR="$KIDDIR/notes/ralph-logs"
ENV_FILE="$KIDDIR/.env.local"

mkdir -p "$LOGDIR"

# ------------------------------------------------------------------
# Env — pull FAL_KEY and friends into this shell so /ralph-step sees them
# ------------------------------------------------------------------
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# ------------------------------------------------------------------
# Dependencies
# ------------------------------------------------------------------
command -v jq >/dev/null 2>&1 || { echo "ralph.sh: jq is required" >&2; exit 1; }
command -v claude >/dev/null 2>&1 || { echo "ralph.sh: claude CLI not on PATH" >&2; exit 1; }

# ------------------------------------------------------------------
# Config
# ------------------------------------------------------------------
MAX_ITER="${MAX_ITER:-50}"
SLEEP_BETWEEN="${SLEEP_BETWEEN:-5}"

# ------------------------------------------------------------------
# Loop
# ------------------------------------------------------------------
for i in $(seq 1 "$MAX_ITER"); do
  if [[ ! -f "$STATE" ]]; then
    echo "ralph.sh: $STATE missing — aborting" >&2
    exit 1
  fi

  STATUS=$(jq -r '.status' "$STATE")
  CUR_ITER=$(jq -r '.currentIteration' "$STATE")
  MAX_FROM_STATE=$(jq -r '.maxIterations' "$STATE")

  if [[ "$STATUS" != "running" ]]; then
    echo "ralph.sh: state.status=$STATUS — stopping"
    exit 0
  fi
  if (( CUR_ITER >= MAX_FROM_STATE )); then
    echo "ralph.sh: currentIteration=$CUR_ITER >= maxIterations=$MAX_FROM_STATE — stopping"
    exit 0
  fi

  TS=$(date -u +%Y%m%dT%H%M%SZ)
  LOGFILE="$LOGDIR/iter-$((CUR_ITER + 1))-$TS.log"
  echo "ralph.sh: iter $((CUR_ITER + 1)) (shell-loop $i/$MAX_ITER) → $LOGFILE"

  # Fresh Claude process. --dangerously-skip-permissions assumes the user has
  # pre-authorized the session per CLAUDE.md autonomous-operation block.
  # Use --permission-mode bypassPermissions so hooks still run but prompts don't block.
  if ! claude \
      --print \
      --dangerously-skip-permissions \
      "/ralph-step" \
      > "$LOGFILE" 2>&1
  then
    echo "ralph.sh: claude exited non-zero on iter $((CUR_ITER + 1)) — see $LOGFILE"
    # Don't bail — /ralph-step may have flipped state.status on its own.
  fi

  tail -n 3 "$LOGFILE" | sed 's/^/  /'

  # Re-read status after the iteration; break early if terminal.
  POST_STATUS=$(jq -r '.status' "$STATE")
  if [[ "$POST_STATUS" != "running" ]]; then
    echo "ralph.sh: state.status flipped to $POST_STATUS — stopping"
    exit 0
  fi

  sleep "$SLEEP_BETWEEN"
done

echo "ralph.sh: reached shell MAX_ITER=$MAX_ITER without terminal state"
