---
description: Start the autonomous Prism Harness Lock-In chain in the background and stream iteration-by-iteration progress into this chat. Runs until all 15 HL tasks complete, a task fails 3×, or you stop it. One task per child Claude process.
argument-hint: (none)
---

# Kickoff: Prism Harness Lock-In

You are the operator of the harness chain. The user typed
`/kickoff-harness-lockin` in this chat. Your job:

1. Verify the harness is ready.
2. Launch the autonomous loop **in the background of THIS chat** (no
   Terminal windows — see "Why no Terminal windows" below).
3. Stream iteration progress into this chat via the Monitor tool.
4. Stay reachable so the user can ask questions or stop the loop.
5. When the loop terminates, produce a final summary.

Do **not** run `/harness-step` yourself in this session. The outer loop
(`kid-kode-landing/scripts/harness.sh`) spawns fresh `claude --print`
processes for that. Your role here is operator and narrator, not worker.

## Why no Terminal windows

A previous version of this command spawned a new `Terminal.app` window per
iteration via `osascript`. That architecture was wrong:

- New Terminal windows spawn fresh `claude` processes that load **their
  own** MCP servers (KripVerify, etc.), independent of the kickoff chat's
  MCP state. Two KripVerify servers competing on `.kripverify/findings/`
  and on the sandboxed dev server is undefined behavior.
- KripVerify findings produced inside a Terminal window's claude do **not**
  get injected back into THIS chat's `[KripVerify findings]` prompt.
- Output isn't visible here; the user has to alt-tab to read each window.
- Failures are silent unless someone goes looking.

The correct pattern (matching `/kickoff-renderer-migration`): one bash
orchestrator script lives in this chat as a background task; it spawns
child `claude --print` processes one at a time as direct children, not
inside fresh Terminal windows. Only one MCP environment, only one
KripVerify sandbox, output and findings flow back through this chat.

## Step 0 — capture your model (CRITICAL — must be Opus)

You currently know which model you are because your system prompt names
it (e.g. "powered by the model named Opus 4.7", "the exact model ID is
'claude-opus-4-7'"). The user has set a hard rule: **the chain runs on
Opus only.** Sonnet and Haiku are explicitly forbidden — `harness.sh`
will refuse to launch on anything that doesn't start with `claude-opus-`.

Write your full model ID to `.claude/.harness-model`:

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
echo 'claude-opus-4-7' > "$REPO_ROOT/.claude/.harness-model"
```

(Substitute your actual Opus version if different — e.g. `claude-opus-4-8`
when that ships.)

If your system-prompt model ID is anything other than an Opus variant,
**STOP**. Tell the user their UI dropdown is set to a forbidden model
and abort the kickoff.

After writing, prove the model is real by running ALL of the following
and showing each output to the user verbatim:

```bash
echo "=== MODEL PROOF ==="
echo "1. Wrote to .claude/.harness-model:"; cat $REPO_ROOT/.claude/.harness-model
echo ""; echo "2. Self-reported model ID from MY system prompt: <print the model ID you read from your own system prompt — quote it exactly>"
echo ""; echo "3. SHA256 of model-file (tamper check):"; shasum -a 256 $REPO_ROOT/.claude/.harness-model
echo ""; echo "4. Starts-with-claude-opus check:"; grep -q '^claude-opus-' $REPO_ROOT/.claude/.harness-model && echo PASS || echo FAIL
```

The file is git-ignored.

## Step 1 — preflight

Run these checks in parallel via Bash:

- `git -C $REPO_ROOT rev-parse --abbrev-ref HEAD` → must equal `prism-main`
- `jq -r '.status, .project, (.tasks | map(select(.status != "done")) | length), (.tasks | map(select(.status == "done")) | length)' $REPO_ROOT/kid-kode-landing/notes/ralph-state.json` → status must be `running` or `paused-*`; project must contain "Harness Lock-In"; report pending and done counts
- `command -v claude && command -v jq` → both must resolve
- `test -x $REPO_ROOT/kid-kode-landing/scripts/harness.sh` → must succeed
- `test -f $REPO_ROOT/.claude/commands/harness-step.md` → must succeed
- `test -f $REPO_ROOT/.mcp.json && jq -e '.mcpServers.kv' $REPO_ROOT/.mcp.json` → KripVerify MCP registered
- `test -s $REPO_ROOT/.claude/.harness-model` → step 0 captured a non-empty model ID
- `grep -q '^claude-opus-' $REPO_ROOT/.claude/.harness-model` → captured model is an Opus variant

If any check fails: **stop**. Tell the user exactly what's wrong and how
to fix it. Do not proceed.

If status is `complete`: tell the user the chain is already done. Recommend
viewing the production deploy at https://kid-kode-ai-landing-git-prism-main-logans-projects-e51c822e.vercel.app/.

If status is `failed`: read the failed task's `notes`, surface the reason,
and ask the user what to do (refine the task, bump `maxAttemptsPerTask`,
or revise the spec).

If status is `paused-*`: harness.sh handles paused states by flipping
back to `running` on launch — you do not need to do anything special.

## Step 2 — tell the user what's about to happen

In one short message:
- Pending / done task counts.
- The model ID written to `.harness-model` (so the user can confirm it
  matches their UI dropdown).
- That you'll launch `kid-kode-landing/scripts/harness.sh` as a background
  task in this chat (no Terminal windows).
- That iteration boundary events (task start/done/failed, status changes)
  will appear here automatically via Monitor.
- That they can interrupt at any time by saying "stop the loop" — you'll
  call `TaskStop` on the orchestrator task.

Don't be verbose. Two or three sentences.

## Step 3 — launch the outer loop in the background

Use the **Bash** tool with `run_in_background: true`:

```
cd $REPO_ROOT/kid-kode-landing && ./scripts/harness.sh
```

The Bash tool returns a task id and an output file path. Save both — you
need them for monitoring (Step 4) and stopping (Step 6).

Do **not** set a timeout; the chain may run for hours. `run_in_background`
keeps it alive across tool calls.

## Step 4 — set up the iteration-progress monitor

Use the **Monitor** tool with `persistent: true` and a command that polls
both the script's output file and `ralph-state.json` for boundary events,
emitting one line per event. The monitor exits naturally when state goes
terminal (`complete` or `failed`).

Use this exact monitor command, with `<OUTPUT_PATH>` replaced by the
output file path you got from Step 3:

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
STATE=$REPO_ROOT/kid-kode-landing/notes/ralph-state.json
LOG=<OUTPUT_PATH>
last_size=0
last_done=$(jq -r '[.tasks[] | select(.status=="done") | .id] | join(",")' "$STATE" 2>/dev/null || echo "")
last_status=""
while sleep 6; do
  if [[ -f "$LOG" ]]; then
    cur_size=$(stat -f%z "$LOG" 2>/dev/null || stat -c%s "$LOG" 2>/dev/null || echo 0)
    if (( cur_size > last_size )); then
      tail -c +$((last_size+1)) "$LOG" 2>/dev/null | \
        grep -E "harness\.sh: iter|Harness iter|loop complete|loop failed|breakpoint|claude exited non-zero" | \
        head -20
      last_size=$cur_size
    fi
  fi
  cur_done=$(jq -r '[.tasks[] | select(.status=="done") | .id] | join(",")' "$STATE" 2>/dev/null || echo "")
  cur_status=$(jq -r '.status' "$STATE" 2>/dev/null || echo "")
  if [[ "$cur_done" != "$last_done" ]]; then
    new=$(comm -23 <(tr ',' '\n' <<<"$cur_done" | sort) <(tr ',' '\n' <<<"$last_done" | sort) | tr '\n' ' ')
    echo "task(s) done: $new"
    last_done=$cur_done
  fi
  if [[ "$cur_status" != "$last_status" && -n "$cur_status" ]]; then
    echo "status: $cur_status"
    last_status=$cur_status
  fi
  case "$cur_status" in
    complete) echo "Harness Lock-In COMPLETE — all 15 HL tasks done."; exit 0 ;;
    failed)   failed_id=$(jq -r '[.tasks[] | select(.status=="failed") | .id] | join(",")' "$STATE" 2>/dev/null)
              echo "Harness Lock-In FAILED at task: $failed_id"; exit 0 ;;
  esac
done
```

Set the Monitor's `description` to `Harness Lock-In loop progress`.

## Step 5 — converse while the loop runs

After Step 4, your turn ends. Monitor events arrive as their own messages.
The user can ask questions; you're free to:
- Tail the latest iteration log from `kid-kode-landing/notes/ralph-logs/`
  (filename `harness-iter-<N>-<ts>.log`).
- `git log --oneline -20` for recent commits.
- `jq` excerpts from `ralph-state.json` for task statuses.
- `.kripverify/findings/latest.json` for the most recent KripVerify run
  produced by the active worker.

Do **not** run `/harness-step` yourself. Do not edit code. Do not commit.
The autonomous loop is doing the work; you are the narrator and concierge.

## Step 6 — handle stop requests

If the user says "stop the loop" or similar:
1. Call `TaskStop` on the Bash background task id from Step 3.
2. Verify by reading the script's output file — last line should reflect
   the loop interrupted (or just empty if killed mid-iteration).
3. State retains whatever in-progress task was active. Tell the user how
   to resume: re-run `/kickoff-harness-lockin` (which will recapture the
   current UI-selected model, then relaunch).

## Step 7 — terminal handling

When the Monitor exits (loop reached terminal state):

- If `status: complete`: read final state, summarize: total iterations,
  per-task commit shas, total runtime, any non-trivial SHOULD-FIX notes.
  Recommend the user verify the production deploy at
  https://kid-kode-ai-landing-git-prism-main-logans-projects-e51c822e.vercel.app/.
- If `status: failed`: read the failed task's `notes` and the last 50
  lines of its iter log. Surface the failure and recommend a recovery
  path (refine task, bump attempts, or revise spec).

## Behavior rules

- Be concise in your narration. Two-line updates beat ten-line recaps.
- The Monitor emits boundary events; don't echo them — they arrive on
  their own. Only respond when the user asks something or when the
  monitor terminates.
- If the user asks for details about a specific iteration, read the
  relevant log file and quote relevant lines (file:line pattern).
- The chain takes hours, not minutes. Don't be alarmed by long gaps.
- If you see `claude exited non-zero` events, that's the script reporting
  that a child claude process errored — but `/harness-step` may still
  have flipped state.status on its own. Read state.json before
  concluding the loop is broken.
- If the user changes their UI model dropdown mid-run, currently-running
  workers won't see it. The next re-kickoff will rewrite `.harness-model`.
