#!/usr/bin/env bash
# Bulletproof one-shot kickoff for the Prism Editor Build Ralph loop.
#
# Usage:
#   kickoff-loop.sh <model-id>
#
# <model-id> must start with "claude-opus-" (the agent passes its own model ID
# from its system prompt). Anything else is rejected to enforce the Opus-only
# policy.
#
# Behavior:
#   1. Validates model-id is Opus.
#   2. Writes model-id to .claude/.ralph-model (the contract file ralph.sh
#      checks before spawning each child claude --print process).
#   3. Runs preflight: branch, marker, state.json schema/status, spec, rule,
#      ralph.sh executable, verifier present, VERCEL_TOKEN loadable from
#      .env.local. Each check passes silently or fails loudly with exit non-0.
#   4. Reports task counts.
#   5. Prints a JSON line with everything the monitor session needs:
#      {model, branch, doneCount, pendingCount, inProgressCount, nextPending}
#   6. Exits 0 on success. Exits non-zero with a clear stderr message on any
#      check failure — the agent surfaces the message to the user and aborts.
#
# After this script exits 0, the agent should:
#   - Launch ralph.sh in background via `Bash run_in_background: true`
#   - Set up the Monitor on ralph-state.json + the bg task log
#   - Stay reachable as the monitor

set -uo pipefail

MODEL_ID="${1:-}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE="$REPO_ROOT/kid-kode-landing/notes/ralph-state.json"
MODEL_FILE="$REPO_ROOT/.claude/.ralph-model"
ENV_FILE="$REPO_ROOT/kid-kode-landing/.env.local"

die() {
  echo "kickoff-loop: FAIL — $1" >&2
  exit 1
}

# 1. Validate model id.
[[ -z "$MODEL_ID" ]] && die "missing <model-id> arg. Pass your model ID as arg 1 (e.g., claude-opus-4-7)."
[[ "$MODEL_ID" =~ ^claude-opus- ]] || die "model '$MODEL_ID' is not an Opus variant. Sonnet/Haiku are forbidden for ralph coding. Switch your UI dropdown to Opus and re-run."

# 2. Write the model contract.
mkdir -p "$REPO_ROOT/.claude"
echo "$MODEL_ID" > "$MODEL_FILE" || die "cannot write $MODEL_FILE"
chmod 600 "$MODEL_FILE" 2>/dev/null || true

# 3. Preflight.
cd "$REPO_ROOT" || die "cannot cd to repo root"

# Branch must be prism-editor-build.
BR="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '<none>')"
[[ "$BR" == "prism-editor-build" ]] || die "branch is '$BR' — must be on prism-editor-build. Run: git checkout prism-editor-build"

# Editor-build marker present.
[[ -f "$REPO_ROOT/.prism-editor-build-active" ]] || die "marker .prism-editor-build-active not at repo root."

# Spec exists.
[[ -f "$REPO_ROOT/kid-kode-landing/docs/prism/PRISM-EDITOR-BUILD-SPEC.md" ]] || die "spec PRISM-EDITOR-BUILD-SPEC.md missing."

# Rule file exists.
[[ -f "$REPO_ROOT/.claude/rules/prism-editor-build.md" ]] || die "rule file .claude/rules/prism-editor-build.md missing."

# ralph.sh executable.
[[ -x "$REPO_ROOT/kid-kode-landing/scripts/ralph.sh" ]] || die "ralph.sh not executable. Run: chmod +x kid-kode-landing/scripts/ralph.sh"

# ralph.sh wired to /ralph-step-editor.
grep -q '/ralph-step-editor' "$REPO_ROOT/kid-kode-landing/scripts/ralph.sh" || die "ralph.sh is not invoking /ralph-step-editor."

# State file present with schema v1.1, status running, pending tasks > 0.
[[ -f "$STATE" ]] || die "ralph-state.json missing at $STATE"
command -v jq >/dev/null 2>&1 || die "jq is required. Install: brew install jq"
jq -e '.schemaVersion == "1.1" and .status == "running" and ([.tasks[] | select(.status == "pending")] | length) > 0' "$STATE" >/dev/null 2>&1 || die "ralph-state.json failed schema/status/pending check (must be v1.1, running, with pending tasks)."

# verify-editor-runtimes.mjs present.
[[ -f "$REPO_ROOT/kid-kode-landing/scripts/verify-editor-runtimes.mjs" ]] || die "verify-editor-runtimes.mjs missing."

# .mcp.json present + registers kv MCP server.
[[ -f "$REPO_ROOT/.mcp.json" ]] || die ".mcp.json missing — workers won't have kv_* MCP tools."
jq -e '.mcpServers.kv' "$REPO_ROOT/.mcp.json" >/dev/null 2>&1 || die ".mcp.json doesn't register the kv MCP server."

# VERCEL_TOKEN sourceable from .env.local.
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi
[[ -n "${VERCEL_TOKEN:-}" ]] || die "VERCEL_TOKEN not set (in env or in $ENV_FILE). Append: VERCEL_TOKEN=vcp_... to that file."
[[ "${VERCEL_TOKEN}" =~ ^vcp_ ]] || die "VERCEL_TOKEN doesn't look like a Vercel token (should start with vcp_)."

# claude CLI on PATH.
command -v claude >/dev/null 2>&1 || die "claude CLI not on PATH."
command -v node >/dev/null 2>&1 || die "node not on PATH."

# 4. Task counts.
DONE=$(jq '[.tasks[] | select(.status=="done")] | length' "$STATE")
PENDING=$(jq '[.tasks[] | select(.status=="pending")] | length' "$STATE")
IN_PROG=$(jq '[.tasks[] | select(.status=="in-progress")] | length' "$STATE")
NEXT_ID=$(jq -r '[.tasks[] | select(.status=="pending")][0].id // ""' "$STATE")
NEXT_TITLE=$(jq -r '[.tasks[] | select(.status=="pending")][0].title // ""' "$STATE")

# 5. Emit JSON status line on stdout.
jq -n \
  --arg model "$MODEL_ID" \
  --arg modelFile "$MODEL_FILE" \
  --arg branch "$BR" \
  --argjson done "$DONE" \
  --argjson pending "$PENDING" \
  --argjson inProgress "$IN_PROG" \
  --arg nextId "$NEXT_ID" \
  --arg nextTitle "$NEXT_TITLE" \
  --arg repoRoot "$REPO_ROOT" \
  --arg ralphScript "$REPO_ROOT/kid-kode-landing/scripts/ralph.sh" \
  --arg stateFile "$STATE" \
  '{
     ok: true,
     model: $model,
     modelFile: $modelFile,
     branch: $branch,
     repoRoot: $repoRoot,
     ralphScript: $ralphScript,
     stateFile: $stateFile,
     counts: { done: $done, pending: $pending, inProgress: $inProgress },
     next: { id: $nextId, title: $nextTitle }
   }'
