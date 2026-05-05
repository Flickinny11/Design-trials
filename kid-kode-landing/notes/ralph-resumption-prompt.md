# Resuming the renderer-migration Ralph loop after interruption

If the outer loop dies, the machine reboots, or you stop
`./scripts/ralph.sh` mid-flight, resume by:

1. Open a terminal in the repo:
   ```bash
   cd /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing
   ```

2. Confirm you're on the right branch:
   ```bash
   git status
   ```
   `On branch prism-renderer-ralph` is correct.

3. Inspect state:
   ```bash
   jq '.status, .currentIteration, .convergence' notes/ralph-state.json
   jq '.tasks | map({id, status, attemptCount})' notes/ralph-state.json
   ```
   - `status` should be `"running"` or `"paused-*"` (a paused state is a
     breakpoint, not a failure — the script auto-resumes on the next launch).
   - If `status` is `"failed"`, see the "Loop failed" section below.

4. Restart:
   ```bash
   ./scripts/ralph.sh
   ```
   The shell loop reads state, picks up at the next `pending` task, spawns a
   fresh Claude process per iteration, and pushes commits to
   `origin/prism-renderer-ralph` after each.

## Paused breakpoints (non-terminal)

If `status` is one of `paused-ceiling`, `paused-convergence`, or
`paused-phase-cap`, the loop auto-flips it back to `running` on the next
invocation (see `ralph.sh` lines 84–96, the "Resume" block). No manual
intervention needed; just relaunch.

- `paused-ceiling` — MAX_ITER (or state.maxIterations) was hit. Increase the
  cap or relaunch as-is.
- `paused-convergence` — N consecutive iterations produced no `history[]`
  growth (i.e., no task moved to `done`). Inspect the last few logs in
  `notes/ralph-logs/` to see why. Typical causes: tests that can't pass
  with current verification commands, spec-reviewer MUST FIX cycles, or
  `attemptCount` saturating before a fix lands.
- `paused-phase-cap` — `phaseCaps[§N].used >= cap`. The migration's tasks
  T01–T10 each map to a distinct `§N`, so this should rarely fire unless a
  single task takes many iterations. Increase the cap in
  `notes/ralph-state.json` if needed.

## Loop failed (terminal)

If `status` is `"failed"`:

1. Read the failed task's `notes` field for the reason:
   ```bash
   jq '.tasks[] | select(.status == "failed")' notes/ralph-state.json
   ```

2. Decide:
   - **The task definition was too strict** (verification command was wrong,
     halt-check was unattainable, etc.) — refine the task in
     `notes/ralph-state.json`, set its `status` back to `"pending"`, reset
     `attemptCount` to 0, flip loop `status` to `"running"`, commit, then
     `./scripts/ralph.sh`.
   - **The task is genuinely hard and the model needs more chances** —
     bump `maxAttemptsPerTask` from 3 to 5 in `notes/ralph-state.json`,
     reset the failed task's `attemptCount` and `status`, flip loop status,
     commit, relaunch.
   - **The migration spec needs revision** — fix the spec, regenerate
     `notes/prism-renderer-spec-extract.md`, refine the task definitions,
     then resume.

3. Never silently push a "failed" task to `done` without an actual passing
   verification. Better to refine and rerun.

## All tasks done (terminal, success)

If `status` is `"complete"`, the migration finished. Final steps (manual):

```bash
# Confirm everything is on the branch:
git log prism-main..HEAD --oneline | head -30

# Run the full DoD verification per spec §17:
cd kid-kode-landing
npx tsc --noEmit
npx vitest run
npx playwright test tests/browser/T10.cross-browser.spec.ts

# Squash-merge into prism-main:
git checkout prism-main
git merge --squash prism-renderer-ralph
git commit -m "prism-renderer: merge migration into prism-main"
git push
```

If the migration goes sideways and you want to abort:

```bash
git checkout prism-main
git branch -D prism-renderer-ralph
git push origin --delete prism-renderer-ralph
```

## Removing migration mode

Once merged, remove the migration markers (the override clauses in
`.claude/rules/prism-renderer-migration.md` become inert):

```bash
rm .ralph-migration-active kid-kode-landing/.ralph-migration-active
# Optional: restore wrapped hooks to their original behavior
mv kid-kode-landing/.claude/hooks/spec-infrastructure-check.sh.original \
   kid-kode-landing/.claude/hooks/spec-infrastructure-check.sh
mv kid-kode-landing/.claude/hooks/verify-on-stop.sh.original \
   kid-kode-landing/.claude/hooks/verify-on-stop.sh
```

Update the "Active Migration" section in `kid-kode-landing/CLAUDE.md` to
"Status: COMPLETE." Commit and push.
