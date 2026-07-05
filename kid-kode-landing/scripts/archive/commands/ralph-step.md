---
description: Execute one Ralph iteration of the Prism Renderer Migration — pick next pending task, do it TDD-style, verify, review, commit, update state, exit. Follow steps exactly; do not improvise.
argument-hint: (none)
---

# Ralph step — one task per session, prism renderer migration

You are the Ralph loop worker. You execute exactly one iteration and exit. A
fresh Claude process will run the next iteration. Do not pick up a second
task in this session. Do not skip steps. Do not improvise the order.

All paths below are relative to the repo root. Resolve it with
`REPO_ROOT="$(git rev-parse --show-toplevel)"`. The Ralph state file lives at
`kid-kode-landing/notes/ralph-state.json`. Active branch is
`prism-renderer-ralph`. The condensed spec is
`kid-kode-landing/notes/prism-renderer-spec-extract.md`; the canonical specs
are `kid-kode-landing/docs/prism/PRISM-RENDERER-MIGRATION-SPEC.md` and
`kid-kode-landing/docs/prism/CINEMATIC-PRIMITIVES-LIBRARY.md`.

## Step 1 — read state; terminal checks

Read `kid-kode-landing/notes/ralph-state.json`. If `status != "running"` OR
`currentIteration >= maxIterations`, print
`Ralph terminal: <status>, iteration <currentIteration>/<maxIterations>` and
exit 0 cleanly without further work.

## Step 2 — pick next task

Find the first task with `status == "pending"` in the `tasks` array. If none
exists:
- Flip `status` to `"complete"`.
- Bump `updatedAt` (ISO 8601 UTC).
- Write back, commit as `ralph: loop complete - all tasks done`, push, exit 0.

## Step 3 — attempt ceiling

If the selected task's `attemptCount >= maxAttemptsPerTask` (default 3):
- Set `task.status = "failed"`, log the reason in `task.notes`.
- Flip loop `status = "failed"`, bump `updatedAt`.
- Write back, commit as `ralph: loop failed - <task-id> exceeded attempts`,
  push, exit 0.

## Step 4 — claim the task

Mutate in memory:
- `task.status = "in-progress"`
- `task.attemptCount += 1`
- `currentIteration += 1`
- `updatedAt = now`

Write back to `ralph-state.json`. Commit as `ralph: iter <N> start - <task-id> <title>`. Do NOT push yet (push happens at step 13).

## Step 5 — read context

Always re-read these every iteration (you are a fresh process — do not rely
on memory):
- `kid-kode-landing/notes/prism-renderer-spec-extract.md`
- `.claude/rules/prism-renderer-migration.md`
- `kid-kode-landing/CLAUDE.md` (the "Active Migration" section)
- The specific spec sections in `task.specRefs[]` (use the `spec-researcher`
  subagent to extract just those sections from
  `kid-kode-landing/docs/prism/PRISM-RENDERER-MIGRATION-SPEC.md` and
  `CINEMATIC-PRIMITIVES-LIBRARY.md` — keeps main context lean)
- `kid-kode-landing/notes/prism-renderer-progress.md`

## Step 6 — failing test FIRST (only when `task.tddRequired === true`)

Create test(s) under `kid-kode-landing/tests/<area>/<task-id>.<scenario>.test.<ext>`
that capture the acceptance behavior for this task's spec ref. Run them and
confirm they FAIL.

If they pass immediately, either:
- The task is already satisfied — mark it `done` with note
  `verified without implementation; pre-existing code satisfies §X`, skip to
  step 11.
- The test isn't strict enough — tighten it and re-run.

Commit the failing test as
`test: <task-id> - failing tests for spec sections <refs>`.
**The test files MUST NOT be modified during steps 7-8.**

## Step 7 — implement

Write the minimum code to make the failing tests pass and satisfy
`task.haltCheck`. Respect the migration-active hooks (they block forbidden
patterns per `.claude/rules/prism-renderer-migration.md`).

Do not work on any other task. Do not edit the failing tests from step 6.

## Step 8 — verify (gates)

Run every command in `task.verificationCommands` in order. ALL must pass
with exit 0. If any fails:
- Read the failure, fix the implementation (NOT the tests).
- Re-run from the failed command.
- Up to 3 internal fix attempts. If still failing, leave the task in
  `in-progress` with `attemptCount` unchanged (the outer Ralph shell will
  retry the task in a new session up to `maxAttemptsPerTask` total).

## Step 9 — spec-reviewer

Spawn the `spec-reviewer` subagent on HEAD. Parse its output:
- `MUST FIX` items: address each, re-run step 8, re-invoke reviewer. Up to
  2 review-fix cycles per iteration. If still has MUST FIX after 2 cycles,
  leave task `in-progress` with `attemptCount` unchanged, exit (will retry
  in fresh session).
- `SHOULD FIX` and `OPTIONAL`: append to `task.notes` for visibility, do not
  block.
- `No deviations found.`: proceed.

## Step 10 — commit implementation

Stage the implementation files. Commit as:

```
prism-renderer: <task-id> phase <N> - <title>
```

Example: `prism-renderer: T01 phase 1 - foundation deps + PrismNode schema additions`.

## Step 11 — update state

Re-read `ralph-state.json` (something else may have touched it), then update:
- `task.status = "done"`
- `task.commit = <new HEAD sha>`
- `task.verifiedAt = now`
- Append to `history[]`:
  `{ iteration: currentIteration, taskId, commit, verifiedAt }`
- Update `invariants.lastBundleHash` if a build artifact was produced.

Write, commit as `ralph: iter <N> done - <task-id>`.

## Step 12 — update progress log

Append one line to `kid-kode-landing/notes/prism-renderer-progress.md` under
the existing `## Ralph iterations` section:

```
- iter <N> - <task-id> phase <P> - <one-phrase outcome> - <commit-sha>
```

Stage and commit as `prism-renderer: progress log - iter <N> <task-id>`.

## Step 13 — push

`git push origin prism-renderer-ralph`. If the push is rejected (upstream has
newer commits), stop immediately and flag — do NOT force-push. Human
judgment required.

## Step 14 — exit

Exit this session. Do NOT pick up the next task. The outer
`scripts/ralph.sh` will launch a fresh Claude process for the next
iteration.

Final stdout line: `Ralph iter <N> <task-id> -> <done|failed|in-progress>`.
The shell parses this for logging.

## Notes specific to this repo

- The schema interface is `PrismNode` (in
  `kid-kode-landing/src/lib/prism-graph/types.ts`), not `GraphNode` as the
  spec writes. Treat them as synonymous when reading the spec.
- The project uses `npm`, not `pnpm`. Use `npx tsc --noEmit` for the
  typecheck (no `npm run typecheck` script yet — T01 may add one).
- The active branch is `prism-renderer-ralph`. Do not push to `prism-main`
  during the migration.
- The pre-existing `verify:prism` and `browser-smoke.mjs` checks enforce
  PixiJS-era criteria and are gated off via the `.ralph-migration-active`
  marker. Use `task.verificationCommands` instead.
- The pre-existing `kid-kode-landing/notes/prism-spec-extract.md`
  (1349 lines) is the OLD mock-app spec. Use the new
  `kid-kode-landing/notes/prism-renderer-spec-extract.md` for renderer work.
