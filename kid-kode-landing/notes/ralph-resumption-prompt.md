# Ralph resumption prompt

Paste this into any fresh Claude Code session on the `prism-main` branch to resume the autonomous build if the outer loop dies mid-flight or hits a breakpoint.

---

I'm resuming the Prism mock-app Ralph loop. Read `kid-kode-landing/notes/ralph-state.json`.

**Terminal statuses — loop is done, do not re-arm:**
- `status == "complete"` — every task is `done`. Nothing to do.
- `status == "failed"` — a task exceeded `maxAttemptsPerTask`. Read the most recent log under `kid-kode-landing/notes/ralph-logs/iter-*.log` to diagnose. Either (a) fix the failing task manually per the same TDD + verify + reviewer discipline described in `.claude/commands/ralph-step.md`, then flip the task's `status` back to `"pending"`, reset its `attemptCount` to 0, flip loop `status` back to `"running"`, commit and push, then run `./scripts/ralph.sh` again — or (b) mark the task `"skipped"` with a reason in `notes` if the criterion is not reachable without human action.

**Non-terminal (paused) statuses — breakpoint hit; resume is expected:**
- `status == "paused-ceiling"` — `currentIteration` reached `maxIterations`. Run `./scripts/ralph-resume.sh` to bump (implicitly) and continue from the last `checkpoint`.
- `status == "paused-convergence"` — 5 consecutive iterations produced zero history-level progress (no task completed). Inspect the last 5 iter-logs first — a genuinely stuck task should be fixed or skipped; spurious convergence (e.g. a noisy branch of retries that produced real work but not history-commits) can be cleared with `./scripts/ralph-resume.sh`.
- `status == "paused-phase-cap"` — the next pending task's primary spec-section exhausted its `phaseCaps[§X].cap` budget. Confirm the phase has actually made progress before topping up; resume with `./scripts/ralph-resume.sh --only=§X` to raise only that phase's cap by `maxIterationsPerPhase` (default 50).

**Running status — fresh start:**
- `status == "running"` AND `currentIteration < maxIterations` — the loop died without updating state. Run `cd kid-kode-landing && ./scripts/ralph.sh`.

**Rules of engagement (unchanged from v1.0):**
- Do not force-push. Do not modify `notes/prism-spec-extract.md` to sidestep a failing task. All anti-drift hooks are active in `.claude/settings.json`; do not weaken them.
- Before re-arming the loop, confirm `git status` is clean and `git log origin/prism-main..HEAD` is empty (any in-flight commits must be pushed before resumption).
- Non-terminal breakpoints are *not* failures — the checkpoint field records the last verified-good state and is always safe to resume from.
