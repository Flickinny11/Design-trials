---
description: Execute one task of the Prism Harness Lock-In — verify (including KripVerify), commit, push, exit. The orchestrator (kid-kode-landing/scripts/harness.sh) spawns the next iteration. One task per process. Chain runs until all 15 HL tasks complete.
argument-hint: (none)
---

# Harness step — one task per process, orchestrator-driven

You are a single Ralph-style worker for the Prism Harness Lock-In. You
execute exactly **one** task and then **exit cleanly with no spawn**. The
outer orchestrator `kid-kode-landing/scripts/harness.sh` reads
`ralph-state.json` after you exit and decides whether to launch the next
iteration or terminate. Do not pick up a second task in this session. Do
not spawn anything yourself — no `osascript`, no `nohup claude`, no
`Terminal.app`.

All paths are relative to `/Users/loganbaird/Prototype_Prism/Design-trials/`.
The state file is `kid-kode-landing/notes/ralph-state.json` (symlink to
`ralph-state.harness-lockin.json`). Active branch is `prism-main`.
The plan: `/Users/loganbaird/.claude/plans/1-sounds-good-lets-jolly-frog.md`.
Spec: `kid-kode-landing/docs/prism/PRISM-RENDERER-MIGRATION-SPEC.md` +
`CINEMATIC-PRIMITIVES-LIBRARY.md` + amendment 0002.

The model contract file `.claude/.harness-model` was written by
`/kickoff-harness-lockin` and pins the entire chain to the model the user
had selected in their Cursor / Claude Code UI dropdown when they kicked off.
You inherit that model because the orchestrator (`harness.sh`) invoked you
with `claude --print --model "$(cat .claude/.harness-model)"`. The next
iteration uses the same file via the same orchestrator — you do not
launch it.

## Step 1 — read state; terminal checks; model proof

Read `kid-kode-landing/notes/ralph-state.json`. If `status != "running"` OR
`currentIteration >= maxIterations`, print
`Harness terminal: <status>, iteration <currentIteration>/<maxIterations>` and
exit 0 cleanly. Do NOT launch a next window.

Verify `.claude/.harness-model` exists, is non-empty, AND starts with
`claude-opus-`. Sonnet and Haiku are forbidden by user policy. Run this
proof block at the top of EVERY iteration and show its output:

```bash
echo "=========================================="
echo "harness-step iter MODEL PROOF:"
MODEL_FILE=/Users/loganbaird/Prototype_Prism/Design-trials/.claude/.harness-model
if [[ ! -s "$MODEL_FILE" ]]; then echo "  FAIL: $MODEL_FILE missing"; exit 0; fi
MODEL=$(cat "$MODEL_FILE")
echo "  contract file:    $MODEL_FILE"
echo "  contract content: $MODEL"
echo "  contract sha256:  $(shasum -a 256 "$MODEL_FILE" | awk '{print $1}')"
if [[ "$MODEL" =~ ^claude-opus- ]]; then echo "  opus-only check:  PASS"; else echo "  opus-only check:  FAIL — refusing to proceed"; exit 0; fi
echo "  self-reported model: <print the model ID from your own system prompt — quote it exactly>"
echo "=========================================="
```

Also assert the model the user-passed via `--model` (which is what THIS
worker is running on) matches the contract file. If they diverge, print
`harness-step: --model arg differs from .harness-model contract file — STOP, do NOT continue. Re-run /kickoff-harness-lockin.`
and exit 0.

## Step 2 — pick next task

Find the first task with `status == "pending"` in the `tasks` array. If none
exists:
- Flip `status` to `"complete"`, bump `updatedAt`.
- Write back, commit as `harness: lockin complete - all 15 tasks done`, push.
- Print `Harness loop COMPLETE — all 15 tasks done.`
- **Do NOT launch a next window.** The chain ends here.
- Exit 0.

## Step 3 — attempt ceiling

If the selected task's `attemptCount >= maxAttemptsPerTask` (default 3):
- Set `task.status = "failed"`, log the reason in `task.notes`.
- Flip loop `status = "failed"`, bump `updatedAt`.
- Write back, commit as `harness: lockin failed - <task-id> exceeded attempts`, push.
- Print `Harness loop FAILED at <task-id>.`
- **Do NOT launch a next window.** The chain stops here.
- Exit 0.

## Step 4 — claim the task

Mutate in memory:
- `task.status = "in-progress"`
- `task.attemptCount += 1`
- `currentIteration += 1`
- `updatedAt = now` (ISO 8601 UTC)

Write back. Commit as `harness: iter <N> start - <task-id> <title>`. Do
NOT push yet.

## Step 5 — read context

Always re-read every iteration (you are a fresh process):
- `/Users/loganbaird/.claude/plans/1-sounds-good-lets-jolly-frog.md` (the plan)
- `kid-kode-landing/CLAUDE.md`
- The specific spec sections in `task.specRefs[]`. Use the `spec-researcher`
  subagent if available to extract just those sections (keeps context lean).
  spec-researcher runs on a cheaper model (sonnet 4.6) by design — it
  extracts text, doesn't make complex judgments.
- `kid-kode-landing/notes/prism-mock-progress.md` (last entry)
- `.claude/rules/` if any harness-specific rules exist
- `.kripverify/findings/latest.json` if it exists (most recent KripVerify run)

## Step 6 — failing test FIRST (only when `task.tddRequired === true`)

Create test(s) under `kid-kode-landing/tests/<area>/<task-id>.<scenario>.test.<ext>`
that capture the acceptance behavior for this task's spec ref + haltCheck.
Run them and confirm they FAIL.

If they pass immediately, either:
- The task is already satisfied — mark `done` with note `verified without
  implementation; pre-existing code satisfies <ref>`, skip to step 11.
- The test isn't strict enough — tighten it and re-run.

Commit the failing test as
`test: <task-id> - failing tests for <spec ref / haltCheck>`.
**Test files MUST NOT be modified during steps 7-9.**

## Step 7 — implement

Write the minimum code to make the failing tests pass and satisfy
`task.haltCheck`. Respect every active hook (anti-drift, dependency
allowlist, migration forbidden patterns, post-edit typecheck, plus the
spec-compliance hooks added in HL01 once they exist:
verify-coderef-modules.sh and validate-live-graph.sh).

If a hook blocks an edit, FIX THE EDIT — do not bypass the hook.

Do not work on any other task. Do not edit the failing tests from step 6.

## Step 8 — shell verification gates

Run every command in `task.verificationCommands` in order. ALL must pass
with exit 0. If any fails:
- Read the failure output, fix the implementation (NOT the tests).
- Re-run from the failed command.
- Up to 3 internal fix attempts. If still failing after 3 attempts, leave
  the task `in-progress` with `attemptCount` unchanged, print
  `Harness iter <N> <task-id> -> in-progress (verification failed)`, do NOT
  launch a next window, exit 0.

## Step 8.5 — KripVerify visual verification (when `task.kvVerify === true`)

For tasks with `kvVerify: true` in state.json, the shell verification is
necessary but not sufficient. Use the `kv_*` MCP tools to confirm runtime
correctness:

1. `kv_dev_server_status()` — if status is not `ready`, call
   `kv_restart_dev_server({ project_root: '/Users/loganbaird/Prototype_Prism/Design-trials', config: {} })`.
   Wait for ready (poll up to 60s).
2. `kv_navigate({ url: 'http://127.0.0.1:<port>/' })` using port from status.
3. `kv_wait_for({ selector: 'canvas', timeout_ms: 30000 })` — confirm the app mounts.
4. For each entry in `task.kvAsserts[]`, run `kv_evaluate({ js: <assertion> })`
   and confirm the result is truthy. If a kvAssert returns a negation, log
   the actual value and treat as a verification failure.
5. `kv_check_console({ level: 'error' })` — assert empty array. Any console
   error fails this gate.
6. `kv_check_console({ since_iso: <session_start_iso> })` filtering for
   messages matching `'has been deprecated'` — assert empty.
7. `kv_screenshot({ full_page: true })` — save a snapshot for the audit
   trail (the bytes go to KripVerify's findings store).

If any KripVerify check fails: treat the same as a shell verification
failure — fix the implementation, re-run step 8 + step 8.5. Up to 3 internal
fix attempts. If still failing, leave the task `in-progress`, do NOT launch
a next window, exit 0.

## Step 9 — spec-reviewer

Spawn the `spec-reviewer` subagent on HEAD. The reviewer has no model
override in its frontmatter, so it inherits YOUR model (the chain model from
`.harness-model`) — staff-engineer review at the same quality the user is
paying for elsewhere. Parse its output:
- `MUST FIX` items: address each, re-run steps 8 + 8.5, re-invoke reviewer.
  Up to 2 review-fix cycles per iteration. If still has MUST FIX after 2
  cycles, leave task `in-progress` with `attemptCount` unchanged, do NOT
  launch a next window, exit 0.
- `SHOULD FIX` and `OPTIONAL`: append to `task.notes` for visibility, do not
  block.
- `No deviations found.`: proceed.

## Step 10 — commit implementation

Stage the implementation files (not the failing tests — those were already
committed in step 6). Commit as:

```
harness: <task-id> - <title>
```

Example: `harness: HL01 - spec-compliance hooks (verify-coderef-modules + validate-live-graph)`.

## Step 11 — update state

Re-read `ralph-state.json` (HL01 hooks may have written intermediate state),
then update:
- `task.status = "done"`
- `task.commit = <new HEAD sha>`
- `task.verifiedAt = now`
- Append to `history[]`:
  `{ iteration: currentIteration, taskId, commit, verifiedAt }`
- Update `invariants.lastBundleHash` if a build artifact was produced.
- Update `convergence.lastProductiveIteration = currentIteration` and
  `convergence.lastProductiveCommit = <new HEAD sha>`.
- Update `checkpoint.{iteration,commit,verifiedAt,recordedAt}` to the
  current values.

Write back, commit as `harness: iter <N> done - <task-id>`.

## Step 12 — update progress log

Append a multi-line section to `kid-kode-landing/notes/prism-mock-progress.md`
under the harness lock-in section. Format:

```
### iter <N> · <task-id> — <one-line outcome>

- Implementation: <2-4 lines describing what changed and why>
- Verification: <which test suites + KripVerify asserts passed>
- Commit: <sha>
- Production: deploys to https://kid-kode-ai-landing-git-prism-main-logans-projects-e51c822e.vercel.app/ via Vercel auto-deploy
```

Stage and commit as `harness: progress log - iter <N> <task-id>`.

## Step 13 — push

`git push origin prism-main`. If the push is rejected (upstream has newer
commits), stop immediately and flag — do NOT force-push. Print
`Harness iter <N> <task-id> -> push-rejected` and exit. Human judgment
required.

## Step 14 — exit cleanly

Do NOT spawn another `claude` process. Do NOT open a Terminal window.
Do NOT chain to anything. The outer orchestrator
(`kid-kode-landing/scripts/harness.sh`) launched you as a child process,
reads `ralph-state.json` after you exit, and spawns the next iteration
itself with the same `.harness-model` it already validated at startup.

Re-read `ralph-state.json` one more time so the final stdout line
reflects accurate state.

Final stdout line:
- success →            `Harness iter <N> <task-id> -> done`
- verification stalled → `Harness iter <N> <task-id> -> in-progress (<reason>)`
- last pending done →   `Harness chain COMPLETE — all 15 HL tasks done.`
                        (the orchestrator will see `status: complete` on
                        its next state read and exit on its own).

Then exit 0. The orchestrator polls `ralph-state.json` after every child
exit and decides whether to spawn another iteration, pause, or terminate.

## Behavior rules

- One task per session. Do not pick up a second task. Do not skip steps.
- Drift protection is hooks. If a hook blocks an edit, fix the edit. Never
  bypass via `--no-verify` or any other shortcut.
- Tests are committed BEFORE implementation when `tddRequired: true`. They
  are immutable through implementation + verification.
- KripVerify is the runtime verification gate for `kvVerify: true` tasks.
  Failure of any kvAssert OR any console error means the task is not done.
- Commits are atomic per step (test commit, start commit, impl commit, state
  commit, progress commit). Do not squash.
- Push to `prism-main`. Vercel auto-deploys each commit. Each iter's commit
  appears at the production URL within ~60s.
- The chain self-terminates on `status: complete` or `status: failed`.
  The orchestrator (`harness.sh`) reads state after each child exit and
  exits its own loop on terminal status. The user can resume by re-running
  `/kickoff-harness-lockin` in a fresh chat (which relaunches `harness.sh`).

## Notes specific to this run

- The schema interface is `PrismNode` (not `GraphNode` as the spec writes).
- The project uses `npm`, not `pnpm`. Use `npx tsc --noEmit` for typecheck.
- The active branch is `prism-main`. Direct commits, not a feature branch.
- KripVerify dev server config lives at `.kripverify.json` in repo root.
  KripVerify MCP server is registered in `.mcp.json` — `kv_*` tools are
  available natively in this session.
- The chain runs in `claude --print` mode driven by
  `kid-kode-landing/scripts/harness.sh`. Each iteration's stdout/stderr
  goes to `kid-kode-landing/notes/ralph-logs/harness-iter-<N>-<ts>.log`.
  The kickoff chat's Monitor tool tails state + log for boundary events.
- spec-researcher subagent: hardcoded to claude-sonnet-4-6 (cheap, simple
  extraction). spec-reviewer subagent: inherits chain model (complex, needs
  the full model). ANTHROPIC_SMALL_FAST_MODEL=haiku 4.5 (auxiliary tasks
  like compaction). All other coding work: chain model from .harness-model.
