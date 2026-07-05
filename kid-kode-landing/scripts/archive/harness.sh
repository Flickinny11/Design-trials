#!/usr/bin/env bash
# Harness Lock-In outer loop — drives the autonomous Prism Harness Lock-In chain.
# Each iteration spawns a fresh `claude --print` process to run /harness-step.
#
# This is a near-clone of scripts/ralph.sh adapted for the Harness Lock-In chain:
#   - state file:    notes/ralph-state.json (symlink → notes/ralph-state.harness-lockin.json)
#   - model file:    .claude/.harness-model (Opus-only)
#   - slash command: /harness-step
#   - branch:        prism-main
#
# Architecture (matches /kickoff-renderer-migration's working pattern):
#   - Lives as a single bash process launched by the kickoff session via
#     `Bash run_in_background: true` so the kickoff chat keeps its own MCP
#     state (KripVerify, etc.) and stays interactive while the loop runs.
#   - Each iteration is a child `claude --print` process invoked from
#     $REPO_ROOT (NOT a new Terminal window). stdout/stderr go to a logfile
#     in notes/ralph-logs/. The kickoff chat's Monitor tool tails state +
#     log for boundary events.
#   - The child claude inherits a fresh MCP environment from .mcp.json
#     loaded relative to $REPO_ROOT. There's only ever one orchestrator
#     and one active worker at a time — no Terminal-spawned siblings,
#     no competing MCP servers.
#
# Exits with:
#   status=complete       — all 15 HL tasks done (terminal)
#   status=failed         — a task exceeded attemptCount (terminal)
#   status=paused-ceiling — MAX_ITER / state.maxIterations reached (non-terminal)
#   status=paused-convergence — N consecutive iters with no history progress (non-terminal)
#   status=paused-phase-cap   — next task's phase hit its cap (non-terminal)

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
# Env — pull FAL_KEY and friends so /harness-step sees them
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
command -v jq >/dev/null 2>&1 || { echo "harness.sh: jq is required" >&2; exit 1; }
command -v claude >/dev/null 2>&1 || { echo "harness.sh: claude CLI not on PATH" >&2; exit 1; }

# ------------------------------------------------------------------
# Model contract — every iteration's claude subprocess MUST run on Opus.
# ------------------------------------------------------------------
HARNESS_MODEL_FILE="$REPO_ROOT/.claude/.harness-model"
if [[ ! -s "$HARNESS_MODEL_FILE" ]]; then
  echo "harness.sh: $HARNESS_MODEL_FILE missing or empty — re-run /kickoff-harness-lockin in a fresh chat with Opus selected. Refusing to launch." >&2
  exit 1
fi
HARNESS_MODEL=$(tr -d '[:space:]' < "$HARNESS_MODEL_FILE")
if [[ -z "$HARNESS_MODEL" ]]; then
  echo "harness.sh: $HARNESS_MODEL_FILE is empty after trim — refusing to launch." >&2
  exit 1
fi
if [[ ! "$HARNESS_MODEL" =~ ^claude-opus- ]]; then
  echo "harness.sh: model='$HARNESS_MODEL' is FORBIDDEN by user policy. Only claude-opus-* models may run the harness chain. Refusing to launch." >&2
  exit 1
fi

echo "=========================================="
echo "harness.sh MODEL PROOF (visible to operator):"
echo "  contract file:    $HARNESS_MODEL_FILE"
echo "  contract content: $HARNESS_MODEL"
echo "  contract sha256:  $(shasum -a 256 "$HARNESS_MODEL_FILE" | awk '{print $1}')"
echo "  opus-only check:  PASS"
echo "  CLI invocation will be: claude --print --model $HARNESS_MODEL --dangerously-skip-permissions /harness-step"
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

write_state() {
  local tmp
  tmp="$(mktemp "$STATE.tmp.XXXXXX")"
  cat > "$tmp"
  mv "$tmp" "$STATE"
}

phase_of_task() {
  local task_id="$1"
  jq -r --arg id "$task_id" '
    (.tasks[] | select(.id == $id) | .specRefs[0]?) as $ref
    | if ($ref // "") | test("§[0-9]+") then
        ($ref | capture("§(?<m>[0-9]+)")) as $c | "§\($c.m)"
      else "" end
  ' "$STATE"
}

jq_merge() {
  local prog="$1"; shift
  jq "$@" "$prog" "$STATE" | write_state
}

# ------------------------------------------------------------------
# Resume: flip paused-* → running cleanly
# ------------------------------------------------------------------
PRE_STATUS=$(jq -r '.status' "$STATE")
case "$PRE_STATUS" in
  paused-*)
    echo "harness.sh: resuming from $PRE_STATUS (clearing convergence streak)"
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
  [[ -f "$STATE" ]] || { echo "harness.sh: $STATE missing — aborting" >&2; exit 1; }

  STATUS=$(jq -r '.status' "$STATE")
  CUR_ITER=$(jq -r '.currentIteration' "$STATE")
  MAX_FROM_STATE=$(jq -r '.maxIterations' "$STATE")

  case "$STATUS" in
    running)
      ;;
    complete|failed)
      echo "harness.sh: state.status=$STATUS — stopping (terminal)"
      exit 0
      ;;
    paused-*)
      echo "harness.sh: state.status=$STATUS — stopping (breakpoint; clear and rerun)"
      exit 0
      ;;
    *)
      echo "harness.sh: state.status=$STATUS — stopping (unknown)"
      exit 0
      ;;
  esac

  if (( CUR_ITER >= MAX_FROM_STATE )); then
    echo "harness.sh: currentIteration=$CUR_ITER >= maxIterations=$MAX_FROM_STATE — breakpoint (paused-ceiling)"
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

  NEXT_TASK=$(jq -r 'first(.tasks[] | select(.status == "pending") | .id) // ""' "$STATE")
  NEXT_PHASE=""
  if [[ -n "$NEXT_TASK" ]]; then
    NEXT_PHASE=$(phase_of_task "$NEXT_TASK")
    if [[ -n "$NEXT_PHASE" ]]; then
      PHASE_USED=$(jq -r --arg p "$NEXT_PHASE" '.phaseCaps[$p].used // 0' "$STATE")
      PHASE_CAP=$(jq -r --arg p "$NEXT_PHASE" '.phaseCaps[$p].cap // .maxIterationsPerPhase // 50' "$STATE")
      if (( PHASE_USED >= PHASE_CAP )); then
        echo "harness.sh: phase $NEXT_PHASE used=$PHASE_USED cap=$PHASE_CAP — breakpoint (paused-phase-cap)"
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

  PRE_HISTORY_LEN=$(jq -r '.history | length' "$STATE")

  TS=$(date -u +%Y%m%dT%H%M%SZ)
  LOGFILE="$LOGDIR/harness-iter-$((CUR_ITER + 1))-$TS.log"
  echo "harness.sh: iter $((CUR_ITER + 1)) (shell-loop $i/$MAX_ITER) → $LOGFILE"

  # IMPORTANT: claude must be invoked from $REPO_ROOT so it finds the
  # project slash commands at $REPO_ROOT/.claude/commands/ (Claude Code
  # resolves commands relative to cwd — no walk-up).
  if ! ( cd "$REPO_ROOT" && claude \
      --print \
      --model "$HARNESS_MODEL" \
      --dangerously-skip-permissions \
      "/harness-step" ) \
      > "$LOGFILE" 2>&1
  then
    echo "harness.sh: claude exited non-zero on iter $((CUR_ITER + 1)) — see $LOGFILE"
  fi

  tail -n 3 "$LOGFILE" | sed 's/^/  /'

  POST_STATUS=$(jq -r '.status' "$STATE")
  POST_HISTORY_LEN=$(jq -r '.history | length' "$STATE")
  POST_HEAD=$(git -C "$REPO_ROOT" rev-parse HEAD)

  if (( POST_HISTORY_LEN > PRE_HISTORY_LEN )); then
    LAST_TASK=$(jq -r '.history | last | .taskId' "$STATE")
    ATTRIB_PHASE=$(phase_of_task "$LAST_TASK")
    PROGRESS=1
  else
    ATTRIB_PHASE="$NEXT_PHASE"
    PROGRESS=0
  fi

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
             artifactHash: (.invariants.lastBundleHash // null),
             recordedAt: $now
           }
       else
         .convergence.stagnantStreak = ((.convergence.stagnantStreak // 0) + 1)
       end)
    | .updatedAt = $now
  ' --arg now "$(iso_now)" --arg phase "$ATTRIB_PHASE" --arg sha "$POST_HEAD" --argjson prog "$PROGRESS"

  STREAK=$(jq -r '.convergence.stagnantStreak // 0' "$STATE")
  THR=$(jq -r '.convergence.stagnantThreshold // 5' "$STATE")
  if (( STREAK >= THR )); then
    echo "harness.sh: convergence — $STREAK consecutive iters without progress (threshold=$THR) — breakpoint (paused-convergence)"
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

  if [[ "$POST_STATUS" != "running" ]]; then
    echo "harness.sh: state.status flipped to $POST_STATUS — stopping"
    exit 0
  fi

  sleep "$SLEEP_BETWEEN"
done

echo "harness.sh: reached shell MAX_ITER=$MAX_ITER without terminal state — breakpoint (paused-ceiling)"
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
