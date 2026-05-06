#!/usr/bin/env bash
# Launches a single Claude Code worker that runs `/harness-step`.
# Invoked from osascript `do script` so it must be self-contained:
# it cannot rely on the inherited cwd, because Terminal.app spawns
# the new shell in $HOME regardless of the parent process's cwd.
#
# Reads the pinned chain model from .claude/.harness-model written
# by /kickoff-harness-lockin (must start with claude-opus-).

set -e

PROJECT_ROOT="/Users/loganbaird/Prototype_Prism/Design-trials"
MODEL_FILE="$PROJECT_ROOT/.claude/.harness-model"

cd "$PROJECT_ROOT"

if [[ ! -s "$MODEL_FILE" ]]; then
  echo "harness-step launcher: $MODEL_FILE missing or empty" >&2
  echo "Run /kickoff-harness-lockin in a fresh Claude Code chat to recapture model." >&2
  exit 2
fi

MODEL="$(cat "$MODEL_FILE")"

if [[ ! "$MODEL" =~ ^claude-opus- ]]; then
  echo "harness-step launcher: model '$MODEL' is not Opus — chain refuses to run." >&2
  echo "Switch UI dropdown to Opus and re-run /kickoff-harness-lockin." >&2
  exit 3
fi

echo "harness-step launcher: cwd=$(pwd)  model=$MODEL"
echo "harness-step launcher: about to exec  claude --print --model $MODEL /harness-step"
echo "==========================================================="

exec claude --print --model "$MODEL" /harness-step
