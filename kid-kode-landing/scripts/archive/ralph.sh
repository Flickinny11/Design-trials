#!/usr/bin/env bash
# Ralph outer loop — drives the autonomous Prism Editor Build.
# Each iteration spawns a fresh `claude --print` process to run /ralph-step-editor.
# (Previously drove the prism-mock-app build via /ralph-step; that chain is complete.)
#
# Exits with:
#   status=complete       — all tasks done (terminal)
#   status=failed         — a task exceeded attemptCount (terminal)
#   status=paused-ceiling — MAX_ITER / state.maxIterations reached (non-terminal; resume)
#   status=paused-convergence — N consecutive iters produced zero history progress (non-terminal; resume)
#   status=paused-phase-cap   — next task's phase hit its cap (non-terminal; resume with --only=§X)
#
# A non-terminal paused-* status is a *breakpoint*, not a failure — run
# `scripts/ralph-resume.sh` to clear the block and continue from the last checkpoint.

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
# Env — pull FAL_KEY and friends into this shell so /ralph-step-editor sees them
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
# Model contract — every iteration's claude subprocess MUST run on Opus.
# Sonnet and Haiku are explicitly forbidden by user policy; the file
# .claude/.ralph-model is written by /kickoff-renderer-migration and must
# contain a claude-opus-* model ID. No fallback, no default, no exceptions.
# ------------------------------------------------------------------
RALPH_MODEL_FILE="$REPO_ROOT/.claude/.ralph-model"
if [[ ! -s "$RALPH_MODEL_FILE" ]]; then
  echo "ralph.sh: $RALPH_MODEL_FILE missing or empty — re-run /kickoff-renderer-migration in a fresh chat with Opus selected. Refusing to launch." >&2
  exit 1
fi
RALPH_MODEL=$(tr -d '[:space:]' < "$RALPH_MODEL_FILE")
if [[ -z "$RALPH_MODEL" ]]; then
  echo "ralph.sh: $RALPH_MODEL_FILE is empty after trim — refusing to launch." >&2
  exit 1
fi
if [[ ! "$RALPH_MODEL" =~ ^claude-opus- ]]; then
  echo "ralph.sh: model='$RALPH_MODEL' is FORBIDDEN by user policy. Only claude-opus-* models may run the ralph loop. Sonnet and Haiku are explicitly disallowed for this complex coding work. Refusing to launch." >&2
  exit 1
fi

# Proof banner — print three independent lines of evidence so the user can
# visually confirm the model BEFORE any claude subprocess fires.
echo "=========================================="
echo "ralph.sh MODEL PROOF (visible to operator):"
echo "  contract file:    $RALPH_MODEL_FILE"
echo "  contract content: $RALPH_MODEL"
echo "  contract sha256:  $(shasum -a 256 "$RALPH_MODEL_FILE" | awk '{print $1}')"
echo "  opus-only check:  PASS (regex ^claude-opus- matched)"
echo "  CLI invocation will be: claude --print --model $RALPH_MODEL --dangerously-skip-permissions /ralph-step-editor"
echo "=========================================="

# ------------------------------------------------------------------
# Config
# ------------------------------------------------------------------
MAX_ITER="${MAX_ITER:-500}"
SLEEP_BETWEEN="${SLEEP_BETWEEN:-5}"

# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
iso_now() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

# Atomic state write — cat | write_state, replaces $STATE atomically via rename.
write_state() {
  local tmp
  tmp="$(mktemp "$STATE.tmp.XXXXXX")"
  cat > "$tmp"
  mv "$tmp" "$STATE"
}

# Primary phase of a task = major spec section of its first specRef (e.g. §10.14 -> §10).
# Prints empty string if the task can't be located or the ref doesn't match.
phase_of_task() {
  local task_id="$1"
  jq -r --arg id "$task_id" '
    (.tasks[] | select(.id == $id) | .specRefs[0]?) as $ref
    | if ($ref // "") | test("§[0-9]+") then
        ($ref | capture("§(?<m>[0-9]+)")) as $c | "§\($c.m)"
      else "" end
  ' "$STATE"
}

# Atomic jq-merge of state (apply a jq program to current STATE and write back).
# Usage: jq_merge '<program>' [--arg k v]...
jq_merge() {
  local prog="$1"; shift
  jq "$@" "$prog" "$STATE" | write_state
}

# ------------------------------------------------------------------
# Resume: flip paused-* → running cleanly, clear stagnation, snapshot resumeFrom
# ------------------------------------------------------------------
PRE_STATUS=$(jq -r '.status' "$STATE")
case "$PRE_STATUS" in
  paused-*)
    echo "ralph.sh: resuming from $PRE_STATUS (clearing convergence streak)"
    jq_merge '
      .status = "running"
      | .updatedAt = $now
      | .convergence.stagnantStreak = 0
      | .resumeFrom = (.checkpoint // null)
    ' --arg now "$(iso_now)"
    ;;
esac

# ------------------------------------------------------------------
# Main loop
# ------------------------------------------------------------------
for i in $(seq 1 "$MAX_ITER"); do
  [[ -f "$STATE" ]] || { echo "ralph.sh: $STATE missing — aborting" >&2; exit 1; }

  STATUS=$(jq -r '.status' "$STATE")
  CUR_ITER=$(jq -r '.currentIteration' "$STATE")
  MAX_FROM_STATE=$(jq -r '.maxIterations' "$STATE")

  # Terminal — exit; nothing to resume.
  case "$STATUS" in
    running)
      ;;
    complete|failed)
      echo "ralph.sh: state.status=$STATUS — stopping (terminal)"
      exit 0
      ;;
    paused-*)
      echo "ralph.sh: state.status=$STATUS — stopping (breakpoint; run scripts/ralph-resume.sh)"
      exit 0
      ;;
    *)
      echo "ralph.sh: state.status=$STATUS — stopping (unknown)"
      exit 0
      ;;
  esac

  # Global ceiling — non-terminal breakpoint.
  if (( CUR_ITER >= MAX_FROM_STATE )); then
    echo "ralph.sh: currentIteration=$CUR_ITER >= maxIterations=$MAX_FROM_STATE — breakpoint (paused-ceiling)"
    jq_merge '
      .status = "paused-ceiling"
      | .updatedAt = $now
      | .breakpoints += [{
          at: $now,
          iteration: .currentIteration,
          kind: "ceiling",
          message: "state.maxIterations reached"
        }]
    ' --arg now "$(iso_now)"
    exit 0
  fi

  # Phase-cap pre-check on next pending task.
  NEXT_TASK=$(jq -r 'first(.tasks[] | select(.status == "pending") | .id) // ""' "$STATE")
  NEXT_PHASE=""
  if [[ -n "$NEXT_TASK" ]]; then
    NEXT_PHASE=$(phase_of_task "$NEXT_TASK")
    if [[ -n "$NEXT_PHASE" ]]; then
      PHASE_USED=$(jq -r --arg p "$NEXT_PHASE" '.phaseCaps[$p].used // 0' "$STATE")
      PHASE_CAP=$(jq -r --arg p "$NEXT_PHASE" '.phaseCaps[$p].cap // .maxIterationsPerPhase // 50' "$STATE")
      if (( PHASE_USED >= PHASE_CAP )); then
        echo "ralph.sh: phase $NEXT_PHASE used=$PHASE_USED cap=$PHASE_CAP — breakpoint (paused-phase-cap)"
        jq_merge '
          .status = "paused-phase-cap"
          | .updatedAt = $now
          | .breakpoints += [{
              at: $now,
              iteration: .currentIteration,
              kind: "phase-cap",
              phase: $p,
              message: "phase cap reached"
            }]
        ' --arg now "$(iso_now)" --arg p "$NEXT_PHASE"
        exit 0
      fi
    fi
  fi

  # Snapshot for convergence detection — we key off history[] length growth
  # (a new entry is appended only when a task completes in step 11 of ralph-step).
  PRE_HISTORY_LEN=$(jq -r '.history | length' "$STATE")

  TS=$(date -u +%Y%m%dT%H%M%SZ)
  LOGFILE="$LOGDIR/iter-$((CUR_ITER + 1))-$TS.log"
  echo "ralph.sh: iter $((CUR_ITER + 1)) (shell-loop $i/$MAX_ITER) → $LOGFILE"

  # Fresh Claude process. --dangerously-skip-permissions assumes the user has
  # pre-authorized the session per CLAUDE.md autonomous-operation block.
  # --model is REQUIRED (no fallback) so the chain runs on the UI-selected
  # model the user captured at kickoff. Never let claude default to sonnet 4.5.
  # IMPORTANT: claude must be invoked from $REPO_ROOT so it finds the project
  # slash commands at $REPO_ROOT/.claude/commands/ (Claude Code resolves
  # commands relative to cwd — no walk-up).
  if ! ( cd "$REPO_ROOT" && claude \
      --print \
      --model "$RALPH_MODEL" \
      --dangerously-skip-permissions \
      "/ralph-step-editor" ) \
      > "$LOGFILE" 2>&1
  then
    echo "ralph.sh: claude exited non-zero on iter $((CUR_ITER + 1)) — see $LOGFILE"
    # Don't bail — /ralph-step-editor may have flipped state.status on its own.
  fi

  tail -n 3 "$LOGFILE" | sed 's/^/  /'

  # Re-read post-iteration state.
  POST_STATUS=$(jq -r '.status' "$STATE")
  POST_HISTORY_LEN=$(jq -r '.history | length' "$STATE")
  POST_HEAD=$(git -C "$REPO_ROOT" rev-parse HEAD)

  # Attribute the iteration to a phase. If a task completed (history grew), use
  # that task's phase; otherwise attribute to the next-pending phase from above.
  if (( POST_HISTORY_LEN > PRE_HISTORY_LEN )); then
    LAST_TASK=$(jq -r '.history | last | .taskId' "$STATE")
    ATTRIB_PHASE=$(phase_of_task "$LAST_TASK")
    PROGRESS=1
  else
    ATTRIB_PHASE="$NEXT_PHASE"
    PROGRESS=0
  fi

  # Bump phaseCaps.used; update convergence + checkpoint atomically.
  jq_merge '
    (if ($phase != "") then
       .phaseCaps[$phase].used = ((.phaseCaps[$phase].used // 0) + 1)
       | .phaseCaps[$phase].cap = (.phaseCaps[$phase].cap // .maxIterationsPerPhase // 50)
       | .phaseCaps[$phase].status = "active"
     else . end)
    | (if $prog == 1 then
         .convergence.stagnantStreak = 0
         | .convergence.lastProductiveIteration = .currentIteration
         | .convergence.lastProductiveCommit = $sha
         | .checkpoint = {
             iteration: .currentIteration,
             commit: $sha,
             verifiedAt: $now,
             artifactHash: (.invariants.lastArtifactHash // null),
             recordedAt: $now
           }
       else
         .convergence.stagnantStreak = ((.convergence.stagnantStreak // 0) + 1)
       end)
    | .updatedAt = $now
  ' --arg now "$(iso_now)" --arg phase "$ATTRIB_PHASE" --arg sha "$POST_HEAD" --argjson prog "$PROGRESS"

  # Convergence breakpoint — zero progress for N consecutive iters.
  STREAK=$(jq -r '.convergence.stagnantStreak // 0' "$STATE")
  THR=$(jq -r '.convergence.stagnantThreshold // 5' "$STATE")
  if (( STREAK >= THR )); then
    echo "ralph.sh: convergence — $STREAK consecutive iters without progress (threshold=$THR) — breakpoint (paused-convergence)"
    jq_merge '
      .status = "paused-convergence"
      | .updatedAt = $now
      | .breakpoints += [{
          at: $now,
          iteration: .currentIteration,
          kind: "convergence",
          streak: '"$STREAK"',
          threshold: '"$THR"',
          message: "no history progress"
        }]
    ' --arg now "$(iso_now)"
    exit 0
  fi

  # Task-level terminal (status != running) — exit.
  if [[ "$POST_STATUS" != "running" ]]; then
    echo "ralph.sh: state.status flipped to $POST_STATUS — stopping"
    exit 0
  fi

  sleep "$SLEEP_BETWEEN"
done

# Shell-level MAX_ITER exhausted — breakpoint, not failure.
echo "ralph.sh: reached shell MAX_ITER=$MAX_ITER without terminal state — breakpoint (paused-ceiling)"
jq_merge '
  .status = "paused-ceiling"
  | .updatedAt = $now
  | .breakpoints += [{
      at: $now,
      iteration: .currentIteration,
      kind: "ceiling-shell",
      message: "shell MAX_ITER exhausted"
    }]
' --arg now "$(iso_now)"
