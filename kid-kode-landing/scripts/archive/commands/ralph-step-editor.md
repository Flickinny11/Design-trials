---
description: Execute one Ralph iteration of the Prism Editor Build — audit first, then pick the next pending task, do it TDD-style, run two-runtime verification, review, commit, update state, push, exit. Follow steps exactly; do not improvise.
argument-hint: (none)
---

**Round 2.5 recovery (May 2026)**: Step 8b was migrated from KripVerify (kv_* MCP tools)
to Playwright via `verify-editor-runtimes.mjs --interaction-script`. The KripVerify path
is dead; do not call any `kv_*` tools. The `kv` MCP server registration in
`.mcp.json` is harmless — just don't invoke its tools.

# Ralph step — Prism Editor Build (one task per session)

You are the Ralph loop worker for the Prism Editor Build. You execute exactly one iteration
and exit. A fresh Claude process will run the next iteration. Do not pick up a second task in
this session. Do not skip steps. Do not improvise the order.

Resolve the repo root at the start of every step that needs a path:

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
```

The Ralph state file is `kid-kode-landing/notes/ralph-state.json`. The active branch is
`prism-editor-build`. The canonical spec is `kid-kode-landing/docs/prism/PRISM-EDITOR-BUILD-SPEC.md`.
The gap analysis is `kid-kode-landing/notes/editor-build-gap-analysis.md`. The activation
marker is `.prism-editor-build-active` at repo root. The rule file is
`.claude/rules/prism-editor-build.md`.

## Step 1 — audit current state (NEW for editor build)

**Before any implementation,** audit what is already done for this task's slice:

1. Read `kid-kode-landing/notes/ralph-state.json`. If `status != "running"` OR
   `currentIteration >= maxIterations`, print
   `Ralph terminal: <status>, iteration <currentIteration>/<maxIterations>` and exit 0 cleanly.
2. Find the first task with `status == "pending"`. Call it `task`.
3. Read `kid-kode-landing/notes/editor-build-gap-analysis.md` for the relevant phase.
4. Read the spec sections named in `task.specRefs[]` from
   `kid-kode-landing/docs/prism/PRISM-EDITOR-BUILD-SPEC.md` (use the `spec-researcher` subagent
   to extract just those sections — keeps context lean).
5. Grep the code paths the task touches. Determine whether the `haltCheck` predicate already
   passes against the current code.
6. Emit an audit summary (3–6 lines) naming: target file paths, current state vs target
   state, whether the task's `haltCheck` is already satisfied.

**Short-circuit:** If audit shows the `haltCheck` already passes, skip to Step 11 with
`task.status = "done"`, `task.notes = "haltCheck already satisfied at audit; no implementation
needed"`, and a snapshot.

## Step 2 — pick next task

If no `pending` tasks exist:
- Flip top-level `status` to `"complete"`.
- Bump `updatedAt` (ISO 8601 UTC).
- Write back, commit as `ralph: loop complete - all tasks done`, push, exit 0.

## Step 3 — attempt ceiling

If `task.attemptCount >= maxAttemptsPerTask` (default 3):
- Set `task.status = "failed"`, log the reason in `task.notes`.
- Flip loop `status = "failed"`, bump `updatedAt`.
- Write back, commit as `ralph: loop failed - <task-id> exceeded attempts`, push, exit 0.

## Step 4 — claim the task

Mutate in memory:
- `task.status = "in-progress"`
- `task.attemptCount += 1`
- `currentIteration += 1`
- `updatedAt = now`

Write back to `ralph-state.json`. Commit as
`editor-build: iter <N> start - <task-id> <title>`. Do not push yet.

## Step 5 — read context

Re-read every iteration (you are a fresh process — do not rely on memory):
- `kid-kode-landing/docs/prism/PRISM-EDITOR-BUILD-SPEC.md` — full spec.
- `.claude/rules/prism-editor-build.md` — editor-build discipline.
- `.claude/rules/prism-renderer-migration.md` — renderer-migration rules still in force.
- `kid-kode-landing/CLAUDE.md` — project guidance.
- `kid-kode-landing/notes/editor-build-gap-analysis.md` — Codex progress credit (what to
  preserve, not redo) + schema delta.
- The specific spec sections in `task.specRefs[]` via the `spec-researcher` subagent.
- `kid-kode-landing/notes/prism-editor-progress.md` (the editor progress log; create on first
  iteration).

## Step 6 — failing test FIRST (only when `task.tddRequired === true`)

Create test(s) under `kid-kode-landing/tests/editor-build/<task-id>.<scenario>.test.<ext>` that
capture the acceptance behavior for this task's spec refs. Run them and confirm they FAIL.

If they pass immediately, either:
- The task is already satisfied — mark it `done` with note
  `verified without implementation; pre-existing code satisfies §X`, skip to Step 11.
- The test isn't strict enough — tighten it and re-run.

Commit the failing test as `test: <task-id> - failing tests for <specRefs>`.
**The test files MUST NOT be modified during Steps 7-8.**

## Step 7 — implement

Write the minimum code to make the failing tests pass and satisfy `task.haltCheck`. Respect
the active hooks:

- The anti-drift hook blocks FP-01..FP-15 on Write/Edit under
  `kid-kode-landing/src/**` when `.prism-editor-build-active` exists. Read
  `.claude/rules/prism-editor-build.md` and `PRISM-EDITOR-BUILD-SPEC.md` §8 (forbidden
  patterns) before writing. Round-2 FPs added: FP-12 updated (3 canonical view-mode literals
  only), FP-14 ('hub-world'/'preview-hub' literals forbidden), FP-15 (Inspector tabs must
  route through usePreviewStateStore, not useGraphSourceStore.updateNode directly).
- The renderer-migration hooks remain active under `.ralph-migration-active`: no PixiJS, no
  `THREE.TextGeometry`, synchronous `createNode`, no DOM access (except
  `window.devicePixelRatio`).

Do not work on any other task. Do not edit the failing tests from Step 6.

## Step 8 — verify (gates) — **Round 2 adds Vercel-preview KripVerify pass**

Run every command in `task.verificationCommands[]` in order. ALL must pass with exit 0. The
two-runtime snapshot (`scripts/verify-editor-runtimes.mjs --task-id=<task-id>`) is always one
of these commands and MUST produce non-empty `outer.png`, `inner.png`, and `state.json` at
`kid-kode-landing/notes/ralph-snapshots/<task-id>/`. **A failing screenshot is a task
failure, never a warning.**

### Step 8b — Browser verification (Playwright + spec-reviewer visual check) — PRIMARY visual gate

The worker runs `scripts/verify-editor-runtimes.mjs` (Playwright-based) in *interactive
mode* when `task.interactionScript` is set. This replaces the previous KripVerify path
(disabled because the MCP IPC was unreliable; the loop was silently falling back to this
script anyway with `--on-stop` semantics).

Procedure (BEFORE Step 10's commit):

1. Determine whether interaction is required: read `task.interactionScript` from
   `kid-kode-landing/notes/ralph-state.json`. If null/missing, this is a non-UI task (e.g.
   pure function with unit tests) — skip to step 5.

2. Start the dev server in fast mode (no build:prism preamble; artifacts cached from
   prior run):
   `cd kid-kode-landing && npm run dev:fast`
   Wait for `Local:` line in stdout, parse the port.

3. Run interactive verification:
   `cd kid-kode-landing && node scripts/verify-editor-runtimes.mjs \
      --task-id=<task-id> \
      --port=<port> \
      --interaction-script=notes/ralph-interactions/<task-id>.json`

   The script will:
   - Launch Playwright Chromium headless
   - Navigate to http://localhost:<port>/
   - Execute the per-task interaction sequence (click, type, wait, evaluate, assert)
   - Capture console messages (any error level = task FAILURE)
   - Capture network responses (any 4xx/5xx = task FAILURE)
   - Save `outer.png`, `inner.png`, `interaction-trace.json` to
     `notes/ralph-snapshots/<task-id>/`
   - Exit 0 on full pass; exit 1 on any failure

4. If exit non-zero: read `interaction-trace.json`, identify the failed step, fix the
   implementation, re-run. Up to 3 internal fix attempts per session before leaving the
   task in-progress and exiting.

5. Spec-reviewer visual pass (always runs, even for non-UI tasks):
   Spawn the `spec-reviewer` subagent with the task spec refs PLUS the snapshot directory
   path. The subagent reads `outer.png` and `inner.png` and answers: "Does the screenshot
   visually demonstrate the haltCheck behavior?" Any "no" answer with a concrete
   visual-mismatch reason = task FAILURE (treated as MUST FIX).

**Treat all of Step 8b as blocking.** No fallbacks. No "warning" downgrades. A failing
visual check is a task failure.

### Step 8c — Vercel observability — SECONDARY diagnostic (Round 2.5, SC-079)

After Step 13's push (i.e., after the commit lands on `origin/prism-editor-build` and
Vercel begins deploying), run the Vercel diagnostic. **Non-blocking** — these checks
provide observability into build/runtime errors on the deployed preview, but do NOT block
the commit (Step 8b already blocked it on KripVerify-local).

1. `cd kid-kode-landing && node scripts/wait-for-vercel-preview.mjs --commit=<sha>` — poll
   Vercel API for the deploy state. Emits `{url, deployState, deploymentId}` JSON on stdout
   when state=READY. On ERROR/CANCELED/timeout: persist the error JSON to
   `notes/ralph-snapshots/<task-id>/vercel-preview-fail.json` and flag in `task.notes` —
   but do NOT mark the task failed (KripVerify-local already passed; deploy issues are
   observability).
2. If deploy went READY, run `cd kid-kode-landing && node scripts/fetch-vercel-logs.mjs
   --commit=<sha> --task-id=<task-id>` to pull build + runtime logs. The script emits a
   JSON blob and persists `vercel-logs.{json,txt}` to the snapshot directory.
3. Stage `kripverify.{png,json}` and `vercel-{preview,logs}.{json,txt}` files in Step 12
   so they commit alongside the local snapshot.

**Why non-blocking:** Vercel deploys can lag, fail for transient reasons (rate limits,
Vercel-side incidents), or surface unrelated issues. The Ralph loop must keep moving when
the local-verified change is correct. If a real production-only bug appears (e.g., it
works locally but breaks on Vercel), the captured logs go into the snapshot and the
operator session (the monitor) can surface them. The next iteration's task will see them
in the committed snapshot history.

**KripVerify-primary, Vercel-secondary rationale.** KripVerify is faster (no
push→build→deploy cycle), WIP-aware (verifies code at HEAD locally), and exposes a rich
toolkit (click, type, inspect DOM, check console + network, manipulate the page). Vercel
only sees pushed code and only emits logs + HTTP responses — useful for diagnostics, not
for interactive verification.

If any command fails:
- Read the failure, fix the implementation (NOT the tests).
- Re-run from the failed command.
- Up to 3 internal fix attempts per session. If still failing, leave `task.status =
  "in-progress"` with `attemptCount` unchanged (the outer Ralph shell will retry the task in a
  new session up to `maxAttemptsPerTask` total) and exit.

## Step 9 — spec-reviewer

Spawn the `spec-reviewer` subagent on HEAD. Pass the spec path
(`kid-kode-landing/docs/prism/PRISM-EDITOR-BUILD-SPEC.md`) and the task's `specRefs[]`. Parse
its output:

- `MUST FIX`: address each, re-run Step 8, re-invoke reviewer. Up to 2 review-fix cycles per
  iteration. If still has MUST FIX after 2 cycles, leave task `in-progress` with
  `attemptCount` unchanged, exit.
- `SHOULD FIX` and `OPTIONAL`: append to `task.notes`, do not block.
- `No deviations found.`: proceed.

## Step 10 — commit implementation

Stage implementation files. Commit as:

```
editor-build: <task-id> phase <N> - <title>
```

Example: `editor-build: EB-01-01 phase 1 - add canonical 5-mode ViewMode type`.

## Step 11 — update state

Re-read `ralph-state.json` (something else may have touched it), then update:
- `task.status = "done"`
- `task.commit = <new HEAD sha>`
- `task.verifiedAt = now`
- Append to `history[]`:
  `{ iteration: currentIteration, taskId, phase, commit, verifiedAt, snapshotDir: "kid-kode-landing/notes/ralph-snapshots/<task-id>/" }`
- Update `checkpoint` with the new productive iteration.
- Reset `convergence.stagnantStreak = 0`; bump
  `convergence.lastProductiveIteration = currentIteration` and
  `convergence.lastProductiveCommit = <sha>`.
- Increment `phaseCaps["§<N>"].used` for this task's phase tag.

Write, commit as `editor-build: iter <N> done - <task-id>`.

## Step 12 — update progress log + snapshot directory

1. Append one line to `kid-kode-landing/notes/prism-editor-progress.md` under a
   `## Ralph iterations` section (create on first iteration):

   ```
   - iter <N> - <task-id> phase <P> - <one-phrase outcome> - <commit-sha>
   ```

2. Stage the snapshot directory at `kid-kode-landing/notes/ralph-snapshots/<task-id>/` so the
   commit includes the captured `outer.png`, `inner.png`, `state.json`, `verify.log`.

Stage + commit as `editor-build: progress log - iter <N> <task-id>`.

## Step 13 — push

`git push origin prism-editor-build`. If the push is rejected (upstream has newer commits),
stop immediately and flag — do NOT force-push. Human judgment required.

## Step 14 — exit

Exit this session. Do NOT pick up the next task. The outer `kid-kode-landing/scripts/ralph.sh`
launches a fresh Claude process for the next iteration.

Final stdout line: `Ralph editor-build iter <N> <task-id> -> <done|failed|in-progress>`. The
shell parses this for logging.

## Notes specific to this loop

- The schema interface is `PrismNode` (with `PrismRootNode` co-existing in `GraphSource` per
  RA-07), not `GraphNode` as the renderer-migration spec writes. Synonyms when reading the
  spec.
- The project uses `npm`, not `pnpm`. Use `npx tsc --noEmit` for typecheck (no
  `npm run typecheck` script as of this iteration; one may be added by a Phase 1 task).
- The active branch is `prism-editor-build`. Do not push to other branches during the loop.
- `kid-kode-landing/.ralph-migration-active` is still present; the renderer-migration hooks
  still fire. INV-11..INV-15 (no PixiJS, MSDF text, sync createNode, no DOM) are binding for
  the duration of the editor build.
- The `verify:prism` script is migration-aware; its editor-build extension lives in
  `kid-kode-landing/scripts/verify-editor-runtimes.mjs` and is invoked through each task's
  `verificationCommands[]`.
- Codex shipped substantial editor work on this branch (single canvas + 3-mode toggle,
  selection persistence, fly-to camera, inspector tabs, assembled-scene render mode,
  debounced autosave, single-hub framing, runtime smoke stabilization). The gap-analysis file
  enumerates what to preserve. **Do not re-implement existing Codex work**; refactor and
  extend.
