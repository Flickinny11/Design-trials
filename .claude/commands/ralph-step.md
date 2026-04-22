---
description: Execute one Ralph iteration — pick next pending task, do it TDD-style, verify, review, commit, update state, exit. Follow steps exactly; do not improvise.
argument-hint: (none)
---

# Ralph step — one task per session

You are the Ralph loop worker. You execute exactly one iteration and exit. A fresh Claude process will run the next iteration. Do not pick up a second task in this session. Do not skip steps. Do not improvise the order.

All paths below are relative to the repo root `/Users/loganbaird/Prototype_Prism/Design-trials/`. The Ralph state file lives at `kid-kode-landing/notes/ralph-state.json`. Canonical spec: `kid-kode-landing/notes/prism-spec-extract.md`.

## Step 1 — read state; terminal checks

Read `kid-kode-landing/notes/ralph-state.json`. If `status != "running"` OR `currentIteration >= maxIterations`, print `Ralph terminal: <status>, iteration <currentIteration>/<maxIterations>` and exit 0 cleanly without further work.

## Step 2 — pick next task

Find the first task with `status == "pending"` in the `tasks` array. If none exists:
- Flip `status` to `"complete"`.
- Bump `updatedAt`.
- Write back, commit as `ralph: loop complete — all tasks done`, push, exit 0.

## Step 3 — attempt ceiling

If the selected task's `attemptCount >= maxAttemptsPerTask` (default 3):
- Set `task.status = "failed"`, log the reason in `task.notes`.
- Flip loop `status = "failed"`, bump `updatedAt`.
- Write back, commit as `ralph: loop failed — <task-id> exceeded attempts`, push, exit 0.

## Step 4 — claim the task

Mutate in memory:
- `task.status = "in-progress"`
- `task.attemptCount += 1`
- `currentIteration += 1`
- `updatedAt = now` (ISO 8601, UTC)

Write back to `ralph-state.json`. Commit as `ralph: iter <N> start — <task-id> <title>`. Do NOT push yet (push happens at step 13).

## Step 5 — read spec refs

For each string in `task.specRefs`, locate it in `kid-kode-landing/notes/prism-spec-extract.md`. Read the relevant section(s) into your working memory. Do not try to open `docs/prism/*.md` — those files are not on disk.

## Step 6 — write a failing test FIRST

Create a test under `tests/<mirrored-path>/<task-id>.test.mjs` (or `.test.ts` if a TS runner is available) that captures the exact acceptance behavior for this task's spec ref. The test should fail today (if the implementation were partial or absent, the test would catch it). If the spec criterion is satisfied in the current codebase, the test should still encode the acceptance contract in a way that verifies it.

Run the test. Confirm it FAILS. If it passes immediately, either:
- The task is already satisfied — mark it `"done"` with a note like `"verified without implementation; pre-existing code satisfies §X"`, skip to step 11.
- The test is not strict enough — tighten it and re-run.

Commit the failing test as `test: <task-id> — failing test for <§ref>`. The test file must NOT be modified during steps 7–8.

## Step 7 — implement

Write the minimum code to make the test pass. The anti-drift PreToolUse hook will block §1.4 forbidden patterns — respect them. For legitimate masks/hit-areas, include an `ALLOWED-GRAPHICS:` comment within 3 lines of the `PIXI.Graphics` call.

Do not batch scope creep. If you notice adjacent polish opportunities, write them as `SHOULD FIX` items in `task.notes` and move on.

## Step 8 — verify (three gates)

Run all three from `kid-kode-landing/`:
1. `npm run verify:prism` — the static harness.
2. `node scripts/browser-smoke.mjs` — the runtime smoke.
3. The new test from step 6.

All three must pass. If any fails:
- If `attemptCount < maxAttemptsPerTask`: fix the code and re-run. Do not commit broken state.
- If `attemptCount >= maxAttemptsPerTask`: update state to failed (per step 3's pattern), exit 0.

If a verify failure is caused by a flaky browser-smoke, investigate before retrying — do not paper over with retries.

## Step 9 — spec-reviewer

Spawn the `spec-reviewer` subagent on HEAD. Parse its output:
- `MUST FIX` items: address each, re-run step 8, re-invoke reviewer.
- `SHOULD FIX` and `OPTIONAL` items: append to `task.notes`. Do not block.
- `No deviations found.`: proceed.

## Step 10 — commit implementation

Stage the implementation files and progress-log touch (step 12 will update progress-log; optionally stage it now). Commit as:

```
prism-mock: <task-id> — <one-line description that cites the §ref satisfied>
```

Example: `prism-mock: T01 — hub-router scroll + active-section indicator (§10.14)`.

## Step 11 — update state

Re-read `ralph-state.json` (in case something else touched it), then update:
- `task.status = "done"`
- `task.commit = <new HEAD sha>`
- `task.verifiedAt = now`
- Append to `history`: `{ iteration: currentIteration, taskId, commit, verifiedAt }`
- Re-read `artifactHash` from `manifest.json` inside the rebuilt `public/prism-assets/mock-app.prism` and set `invariants.lastArtifactHash`.

Write, commit as `ralph: iter <N> done — <task-id>`.

## Step 12 — update progress log

Append one line to `kid-kode-landing/notes/prism-mock-progress.md` under a `## Ralph iterations` section (create the section if it doesn't exist):

```
- iter <N> — <task-id> — §<ref> — <one-phrase outcome> — <commit-sha>
```

Commit as `prism-mock: progress log — iter <N> <task-id>`.

## Step 13 — push

`git push origin prism-main`. If the push is rejected (upstream has newer commits), stop immediately and flag — do not force-push. Human judgment required.

## Step 14 — exit

Exit this session. Do NOT pick up the next task. The outer `scripts/ralph.sh` will launch a fresh Claude process for the next iteration.

Final stdout line should be `Ralph iter <N> <task-id> → <done|failed>`. The shell parses this for logging.
