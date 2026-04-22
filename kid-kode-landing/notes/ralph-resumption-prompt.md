# Ralph resumption prompt

Paste this into any fresh Claude Code session on the `prism-main` branch to resume the autonomous build if the outer loop dies mid-flight.

---

I'm resuming the Prism mock-app Ralph loop. Read `kid-kode-landing/notes/ralph-state.json` — if `status == "running"` and `currentIteration < maxIterations`, restart the loop with `cd kid-kode-landing && ./scripts/ralph.sh`. If `status == "failed"`, read the most recent log under `kid-kode-landing/notes/ralph-logs/iter-*.log` to diagnose what went wrong. Either (a) fix the failing task manually per the same TDD + verify + reviewer discipline described in `.claude/commands/ralph-step.md`, then flip the task's `status` back to `"pending"`, reset its `attemptCount` to 0, flip the loop `status` back to `"running"`, commit and push, then run `./scripts/ralph.sh` again — or (b) mark the task `"skipped"` with a reason in `notes` if the criterion is not reachable without human action. Do not force-push. Do not modify `notes/prism-spec-extract.md` to sidestep a failing task. All anti-drift hooks are active in `.claude/settings.json`; do not weaken them. Before re-arming the loop, confirm `git status` is clean and `git log origin/prism-main..HEAD` is empty (any in-flight commits must be pushed before resumption).
