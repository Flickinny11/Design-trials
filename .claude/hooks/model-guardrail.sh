#!/usr/bin/env bash
# model-guardrail.sh — PreToolUse hook on Write|Edit
#
# Hard barrier against any edit that would re-introduce a forbidden model
# choice in this project's model-critical configuration paths. Exits non-zero
# on violation, which causes Claude Code to reject the edit before it lands.
#
# This is path-scoped: it only blocks where models are *applied*, not where
# they're *mentioned in prose*. Documentation, post-mortems, and historical
# notes can name the bad models freely. The barrier is on the active config.
#
# Blocks:
#   1. `model:` frontmatter inside .claude/agents/*.md   (agents must inherit parent)
#   2. top-level `"model"` JSON key in any settings.json (UI must drive model)
#   3. .claude/.harness-model or .claude/.ralph-model whose content is not claude-opus-*
#   4. `--model claude-sonnet-…` or `--model claude-haiku-…` arguments in shell scripts
#      under this repo (the chain workers must always be invoked with --model claude-opus-*)
#
# Input: standard PreToolUse hook payload on stdin (JSON with tool_input).
# Exit: 0 = allow, non-zero with stderr message = block.

set -euo pipefail

payload=$(cat)
file_path=$(echo "$payload" | jq -r '.tool_input.file_path // .tool_input.notebook_path // ""')
new_content=$(echo "$payload" | jq -r '.tool_input.content // .tool_input.new_string // ""')

# No file? Don't block (some other tool shape; not ours to police).
[[ -z "$file_path" ]] && exit 0

reject() {
  echo "model-guardrail REJECTED edit on $file_path:" >&2
  echo "  $1" >&2
  echo "  Per user policy (zero-ambiguity): chain coding work runs on Opus only." >&2
  echo "  To override, you must first edit .claude/hooks/model-guardrail.sh." >&2
  exit 1
}

# --- Path-scoped rules ---
case "$file_path" in
  */.claude/agents/*.md)
    if grep -qE '^model:[[:space:]]*[^[:space:]]' <<< "$new_content"; then
      reject "would add 'model:' frontmatter; agents must inherit parent (UI-selected) model."
    fi
    ;;

  */.claude/settings.json|*/.claude/settings.local.json|*/.claude/settings/*.json)
    if jq -e 'has("model")' <<< "$new_content" >/dev/null 2>&1; then
      reject "would set a top-level 'model' field; model is UI-driven per session."
    fi
    ;;

  */.claude/.harness-model|*/.claude/.ralph-model)
    trimmed=$(tr -d '[:space:]' <<< "$new_content")
    if [[ -n "$trimmed" && ! "$trimmed" =~ ^claude-opus- ]]; then
      reject "would set chain model to '$trimmed' (not an Opus variant)."
    fi
    ;;

  *.sh|*.bash|*.zsh)
    # In shell scripts, refuse hardcoded --model claude-sonnet-... or claude-haiku-...
    # (--model claude-opus-... is fine; --model "$VAR" is fine; --model … via env is fine.)
    if grep -qE -- '--model[[:space:]]+(["'\'']?)claude-(sonnet|haiku|3-5-sonnet|3\.5-sonnet)' <<< "$new_content"; then
      reject "would add --model claude-sonnet/haiku argument to a shell script; chain workers must run --model claude-opus-*."
    fi
    ;;
esac

exit 0
