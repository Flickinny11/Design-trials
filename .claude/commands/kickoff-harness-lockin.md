---
description: Start the autonomous Prism Harness Lock-In Ralph loop in the background and stream iteration-by-iteration progress into this chat. Runs until all 15 HL tasks complete, a task fails 3×, or you stop it. One task per child Claude process. KripVerify auto-runs at every Stop event for visual + console + network verification.
argument-hint: (none)
---

# Kickoff: Prism Harness Lock-In

You are the operator of the harness lock-in run. The user typed
`/kickoff-harness-lockin` in this chat. Your job:

1. Verify the harness is ready (preflight checks).
2. Launch the autonomous loop in the background.
3. Stream iteration progress into this chat as it happens.
4. Stay reachable so the user can ask questions or stop the loop.
5. When the loop terminates, produce a final summary.

Do **not** run `/ralph-step` yourself in this session. The outer loop spawns
fresh `claude --print` processes for that. Your role here is operator and
narrator, not worker.

The plan: `/Users/loganbaird/.claude/plans/1-sounds-good-lets-jolly-frog.md`.
The state: `kid-kode-landing/notes/ralph-state.json` (symlinked to
`ralph-state.harness-lockin.json` — 15 HL tasks, status `running`).

## Step 1 — preflight (do this synchronously before launching)

Run these checks in parallel via Bash:

- `git -C /Users/loganbaird/Prototype_Prism/Design-trials rev-parse --abbrev-ref HEAD` → must equal `prism-main`
- `jq -r '.status, .project, (.tasks | map(select(.status != "done")) | length), (.tasks | map(select(.status == "done")) | length)' /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing/notes/ralph-state.json` → status must be `running` or `paused-*`; project must contain "Harness Lock-In"; report `done` and `pending` counts
- `command -v claude && command -v jq` → both must resolve
- `test -x /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing/scripts/ralph.sh` → must succeed
- `test -f /Users/loganbaird/Prototype_Prism/Design-trials/.mcp.json && jq -e '.mcpServers.kv' /Users/loganbaird/Prototype_Prism/Design-trials/.mcp.json` → KripVerify MCP must be registered (so child Ralph sessions inherit kv_* tools)

If any check fails, **stop**. Tell the user exactly what's wrong and how to
fix it. Do not proceed.

If status is `complete`, tell the user the lock-in is already done and ask
if they want to (a) review the final summary, (b) reset state for another
run, or (c) start a follow-up phase. Do not relaunch.

If status is `failed`, read the failed task's `notes` field, surface the
reason, and ask the user what to do (refine the task, bump
`maxAttemptsPerTask`, or revise the spec).

If branch is not `prism-main`, refuse to launch. The harness lock-in writes
straight to `prism-main` so Vercel auto-deploys each iter and KripVerify can
verify against the dev server in lockstep with commits.

## Step 2 — tell the user what's about to happen

In one short message:
- The done/pending task counts (HL01–HL15).
- That you'll launch `scripts/ralph.sh` in the background.
- That iteration updates will appear in this chat.
- That KripVerify auto-runs after every iter and findings will inject into
  the next iter's first prompt.
- That they can interrupt at any time by saying "stop the loop" (you'll then
  call `TaskStop` on the bash task, see Step 6).

Don't be verbose. Two or three sentences.

## Step 3 — launch the outer loop in the background

Use the **Bash** tool with `run_in_background: true`:

```
cd /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing && ./scripts/ralph.sh
```

The Bash tool returns a task id and an output file path. Save both — you
need them for monitoring (Step 4) and stopping (Step 6).

Do **not** set a timeout; the loop may run for hours. `run_in_background`
means it survives independent of any single tool call.

## Step 4 — set up the iteration-progress monitor

Use the **Monitor** tool with `persistent: true` and a command that polls
both the script's output file and `ralph-state.json` for boundary events,
emitting one line per event. The monitor exits naturally when state goes
terminal (`complete` or `failed`).

Use this exact monitor command, with `<OUTPUT_PATH>` replaced by the output
file path you got from Step 3:

```bash
STATE=/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing/notes/ralph-state.json
LOG=<OUTPUT_PATH>
last_size=0
last_done=$(jq -r '[.tasks[] | select(.status=="done") | .id] | join(",")' "$STATE" 2>/dev/null || echo "")
last_status=""
while sleep 6; do
  if [[ -f "$LOG" ]]; then
    cur_size=$(stat -f%z "$LOG" 2>/dev/null || stat -c%s "$LOG" 2>/dev/null || echo 0)
    if (( cur_size > last_size )); then
      tail -c +$((last_size+1)) "$LOG" 2>/dev/null | \
        grep -E "ralph\.sh: iter|Ralph iter|loop complete|loop failed|breakpoint|claude exited non-zero" | \
        head -20
      last_size=$cur_size
    fi
  fi
  cur_done=$(jq -r '[.tasks[] | select(.status=="done") | .id] | join(",")' "$STATE" 2>/dev/null || echo "")
  cur_status=$(jq -r '.status' "$STATE" 2>/dev/null || echo "")
  if [[ "$cur_done" != "$last_done" ]]; then
    new=$(comm -23 <(tr ',' '\n' <<<"$cur_done" | sort) <(tr ',' '\n' <<<"$last_done" | sort) | tr '\n' ' ')
    echo "✅ task(s) done: $new"
    last_done=$cur_done
  fi
  if [[ "$cur_status" != "$last_status" && -n "$cur_status" ]]; then
    echo "📊 status: $cur_status"
    last_status=$cur_status
  fi
  case "$cur_status" in
    complete) echo "🏁 Ralph loop COMPLETE — all 15 HL tasks done."; exit 0 ;;
    failed)   failed_id=$(jq -r '[.tasks[] | select(.status=="failed") | .id] | join(",")' "$STATE" 2>/dev/null)
              echo "❌ Ralph loop FAILED at task: $failed_id"; exit 0 ;;
  esac
done
```

Set the Monitor's `description` to `Ralph harness-lockin loop progress`.

## Step 5 — converse while the loop runs

After Step 4, your turn ends. Monitor events arrive as their own messages.
KripVerify findings arrive as `[KripVerify findings — ...]` injections on
each user prompt. The user can ask questions; you're free to:
- Tail recent iteration logs from `kid-kode-landing/notes/ralph-logs/` if
  they ask "what's happening in HL0X right now?"
- Read `git log --oneline -20` to show recent commits.
- Read `jq` excerpts from `notes/ralph-state.json` to show task statuses
  and KripVerify-flagged tasks (those with `kvVerify: true`).
- Read the latest spec-reviewer output if they ask about a specific iter.
- Read `.kripverify/findings/latest.json` if they ask about the most
  recent verification run.

Do **not** run `/ralph-step` yourself. Do not edit code. Do not commit.
The autonomous loop is doing the work; you are the narrator and concierge.

## Step 6 — handle stop requests

If the user says "stop the loop" or similar:
1. Call `TaskStop` on the Bash background task id from Step 3.
2. Verify by reading the script's output file — last line should show the
   loop interrupted.
3. The state file will retain whatever in-progress task was active. Tell the
   user how to resume (just `/kickoff-harness-lockin` again, or run
   `./scripts/ralph.sh` from a terminal).

## Step 7 — terminal handling

When the Monitor exits (loop reached terminal state):

- If `status: complete`: read final state, summarize: total iterations,
  per-task commit shas, total runtime, any non-trivial SHOULD-FIX notes,
  the latest KripVerify run summary from `.kripverify/findings/latest.json`,
  and the production deploy URL (https://kid-kode-ai-landing-git-prism-main-logans-projects-e51c822e.vercel.app/).
  Recommend opening the live URL to confirm visually.
- If `status: failed`: read the failed task's `notes` and the last 50 lines
  of its iter log. Surface the failure and recommend a recovery path
  (refine task, bump attempts, or revise spec).
- If `status: paused-*`: that's a non-terminal breakpoint. Quote the
  relevant `breakpoints[]` entry. Recommend `scripts/ralph-resume.sh`
  if it exists, or in-place edit of the state file to clear the block.

## Behavior rules

- Be concise in your narration. Two-line updates are better than ten-line
  recaps.
- The Monitor emits boundary events; don't echo them — they arrive on
  their own. Only respond when the user asks something or when the
  monitor terminates.
- KripVerify findings inject automatically as `[KripVerify findings — ...]`
  blocks. Don't fetch them yourself unless the user asks for the full
  payload.
- If the user asks for details about a specific iteration, read the
  relevant log file and quote the relevant lines (file:line pattern).
- The lock-in takes hours, not minutes. Don't be alarmed if there's a long
  gap between updates.
- If you see `claude exited non-zero` events, that's the script reporting
  that a child Claude process errored — but `/ralph-step` may still have
  flipped state.status on its own (e.g., to "failed" after maxAttempts).
  Read state.json before concluding the loop is broken.
- After every successful HL iter, the corresponding commit hits `prism-main`
  and Vercel auto-deploys. Production progress is observable on the live URL.
