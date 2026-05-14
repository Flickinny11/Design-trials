---
description: Start the autonomous Prism Editor Build Ralph loop in the background and stream iteration-by-iteration progress into this chat. Runs until all editor-build tasks complete, a task fails 3×, or you stop it. One task per child Claude process. The session this command runs in is the MONITOR — never the implementer.
argument-hint: (none)
---

# Kickoff: Prism Editor Build

You are the operator of the Prism Editor Build. The user typed `/kickoff-prism-editor` in this
chat. Your job:

1. Verify the harness is ready.
2. Launch the autonomous loop in the background.
3. Stream iteration progress into this chat as it happens.
4. Stay reachable so the user can ask questions or stop the loop.
5. When the loop terminates, produce a final summary.

Do **not** run `/ralph-step-editor` yourself in this session. The outer loop spawns fresh
`claude --print` processes for that. Your role here is operator and narrator, not worker.

Resolve the repo root at the start:

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
```

All paths below are relative to `$REPO_ROOT`. The Ralph state file is
`kid-kode-landing/notes/ralph-state.json`. The spec is
`kid-kode-landing/docs/prism/PRISM-EDITOR-BUILD-SPEC.md`. The activation marker is
`.prism-editor-build-active`. The model contract is `.claude/.ralph-model`.

## Step 0 — capture your model (CRITICAL — must be Opus)

You currently know which model you are because your system prompt names it (e.g. "powered by
the model named Opus 4.7", "the exact model ID is 'claude-opus-4-7'"). The user has set a hard
rule: **the Ralph loop runs on Opus only.** Sonnet and Haiku are explicitly forbidden for
Ralph coding work — `scripts/ralph.sh` will refuse to launch on anything that doesn't start
with `claude-opus-`.

Write your full model ID to `.claude/.ralph-model`. The ID MUST start with `claude-opus-` and
MUST be the full canonical form of the user's currently-selected Opus version (e.g.
`claude-opus-4-7`).

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
echo 'claude-opus-4-7' > "$REPO_ROOT/.claude/.ralph-model"
```

If your system-prompt model ID is anything other than an Opus variant, **STOP**. Tell the
user their UI dropdown is set to a forbidden model (Sonnet/Haiku) and abort the kickoff.

After writing, prove the model is real:

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
echo "=== MODEL PROOF ==="
echo "1. Wrote to .claude/.ralph-model:"; cat "$REPO_ROOT/.claude/.ralph-model"
echo ""; echo "2. Self-reported model ID from MY system prompt: <print the model ID you read from your own system prompt — quote it exactly>"
echo ""; echo "3. SHA256 of model-file (tamper check):"; shasum -a 256 "$REPO_ROOT/.claude/.ralph-model"
echo ""; echo "4. Starts-with-claude-opus check:"; grep -q '^claude-opus-' "$REPO_ROOT/.claude/.ralph-model" && echo PASS || echo FAIL
```

Show the user the literal output. Do not paraphrase.

The file `.claude/.ralph-model` is git-ignored.

## Step 1 — preflight

Run these checks in parallel via Bash. They must all pass.

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"

# Branch must be prism-editor-build.
test "$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)" = "prism-editor-build"

# Editor-build marker present.
test -f "$REPO_ROOT/.prism-editor-build-active"

# State file exists, has schema v1.1, status running, ≥1 pending task.
jq -e '.schemaVersion == "1.1" and .status == "running" and ([.tasks[] | select(.status == "pending")] | length) > 0' \
  "$REPO_ROOT/kid-kode-landing/notes/ralph-state.json" >/dev/null

# Spec exists.
test -f "$REPO_ROOT/kid-kode-landing/docs/prism/PRISM-EDITOR-BUILD-SPEC.md"

# Rule file exists.
test -f "$REPO_ROOT/.claude/rules/prism-editor-build.md"

# Loop driver is executable.
test -x "$REPO_ROOT/kid-kode-landing/scripts/ralph.sh"

# Loop driver invokes /ralph-step-editor (not /ralph-step).
grep -q '/ralph-step-editor' "$REPO_ROOT/kid-kode-landing/scripts/ralph.sh"

# Verifier exists.
test -f "$REPO_ROOT/kid-kode-landing/scripts/verify-editor-runtimes.mjs"

# Model file captured, Opus.
test -s "$REPO_ROOT/.claude/.ralph-model"
grep -q '^claude-opus-' "$REPO_ROOT/.claude/.ralph-model"

# CLI tools on PATH.
command -v claude && command -v jq && command -v node
```

If any check fails, **stop**. Tell the user exactly what's wrong and how to fix it. Do not
proceed.

If the state file's `status` is `complete`, the editor build is already done — tell the
user, surface the final task count, and ask whether to (a) merge into another branch, (b)
review the snapshot directory, or (c) reset state for a re-run.

If `status` is `failed`, read the failed task's `notes` field, surface the reason, and ask
the user whether to refine the task, bump `maxAttemptsPerTask`, or revise the spec.

Also surface the done/pending counts:

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
jq -r '"done=" + (([.tasks[] | select(.status == "done")] | length | tostring)) + " pending=" + (([.tasks[] | select(.status == "pending")] | length | tostring)) + " in-progress=" + (([.tasks[] | select(.status == "in-progress")] | length | tostring))' \
  "$REPO_ROOT/kid-kode-landing/notes/ralph-state.json"
```

## Step 2 — tell the user what's about to happen

In one short message:
- The done/pending task counts.
- That you'll launch `kid-kode-landing/scripts/ralph.sh` in the background.
- That iteration updates will appear in this chat.
- That they can interrupt at any time by saying "stop the loop" (Step 6).

Two or three sentences. No verbosity.

## Step 3 — launch the outer loop in the background

Use the **Bash** tool with `run_in_background: true`:

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT/kid-kode-landing" && ./scripts/ralph.sh
```

The Bash tool returns a task id and an output file path. Save both — you need them for
monitoring (Step 4) and stopping (Step 6).

Do **not** set a timeout; the loop may run for hours. `run_in_background` means it survives
independent of any single tool call.

## Step 4 — set up the iteration-progress monitor

Use the **Monitor** tool with a command that polls both the script's output file and
`ralph-state.json` for boundary events, emitting one line per event. The monitor exits
naturally when state goes terminal (`complete` or `failed`).

Use this exact monitor command, with `<OUTPUT_PATH>` replaced by the output file path from
Step 3:

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
STATE="$REPO_ROOT/kid-kode-landing/notes/ralph-state.json"
LOG=<OUTPUT_PATH>
last_size=0
last_done=$(jq -r '[.tasks[] | select(.status=="done") | .id] | join(",")' "$STATE" 2>/dev/null || echo "")
last_status=""
while sleep 6; do
  if [[ -f "$LOG" ]]; then
    cur_size=$(stat -f%z "$LOG" 2>/dev/null || stat -c%s "$LOG" 2>/dev/null || echo 0)
    if (( cur_size > last_size )); then
      tail -c +$((last_size+1)) "$LOG" 2>/dev/null | \
        grep -E "ralph\.sh: iter|Ralph editor-build iter|loop complete|loop failed|breakpoint|claude exited non-zero" | \
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
    complete) echo "Ralph editor-build loop COMPLETE — all tasks done."; exit 0 ;;
    failed)   failed_id=$(jq -r '[.tasks[] | select(.status=="failed") | .id] | join(",")' "$STATE" 2>/dev/null)
              echo "Ralph editor-build loop FAILED at task: $failed_id"; exit 0 ;;
  esac
done
```

Set the Monitor's `description` to `Ralph editor-build loop progress`.

## Step 5 — converse while the loop runs

After Step 4, your turn ends. Monitor events arrive as their own messages. The user can ask
questions; you're free to:
- Tail recent iteration logs from `kid-kode-landing/notes/ralph-logs/` if they ask "what's
  happening in EB-XX-XX right now?".
- Read `git log prism-editor-build..HEAD --oneline | head` to show recent commits.
- Read `jq` excerpts from `notes/ralph-state.json` to show task statuses.
- Read the latest spec-reviewer output if they ask about a specific iter.
- Display recent two-runtime snapshots from `kid-kode-landing/notes/ralph-snapshots/<id>/`.

Do **not** run `/ralph-step-editor` yourself. Do not edit code. Do not commit. The autonomous
loop is doing the work; you are the narrator and concierge.

## Step 6 — handle stop requests

If the user says "stop the loop" or similar:
1. Call `TaskStop` on the Bash background task id from Step 3.
2. Verify by reading the script's output file — last line should show the loop interrupted.
3. The state file will retain whatever in-progress task was active. Tell the user how to
   resume: run `/kickoff-prism-editor` again, or `cd kid-kode-landing && ./scripts/ralph.sh`
   from a terminal.

## Step 7 — terminal handling

When the Monitor exits (loop reached terminal state):

- If `status: complete`: read final state, summarize: total iterations, per-task commit
  shas, total runtime, any non-trivial SHOULD-FIX notes. Recommend the user remove the
  `.prism-editor-build-active` marker if they want the editor-build hooks to deactivate.
- If `status: failed`: read the failed task's `notes` and the last 50 lines of its iter log.
  Surface the failure and recommend a recovery path.

## Behavior rules

- Be concise in your narration. Two-line updates beat ten-line recaps.
- The Monitor emits boundary events; don't echo them — they arrive on their own. Only
  respond when the user asks something or when the Monitor terminates.
- If the user asks for details about a specific iteration, read the relevant log file and
  quote the relevant lines using the `file:line` pattern.
- The editor build takes hours, not minutes. Long gaps between updates are expected.
- If you see `claude exited non-zero` events, the script reported that a child Claude
  process errored — but `/ralph-step-editor` may still have flipped `state.status` on its
  own (e.g., to "failed" after maxAttempts). Read state.json before concluding the loop is
  broken.
