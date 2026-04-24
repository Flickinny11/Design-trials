# Ralph kickoff — Phase G (mockup swap + editor wiring + spec enrichment)

Paste the block below into a fresh session, verbatim. Nothing else.

---

```
I'm starting the Prism mock-app Ralph loop for Phase G (mockup swap + editor wiring).

Read these in order:
1. notes/ralph-state.json — the task list (22 tasks, 3 phases)
2. notes/session-handoff-2026-04-24.md — architecture + don't-repeat-these-mistakes
3. notes/prism-spec-extract.md — canonical spec (source of truth)
4. CLAUDE.md — one-task-per-session + forbidden patterns + deterministic contract

Execute /ralph-step. Each iteration: pick first pending task, TDD, three-gate verify (verify:prism 15/15, browser-smoke 6/6, task test), commit per sub-step, push to prism-main, update ralph-state + prism-mock-progress.md, exit. Do not batch tasks.

Launch the outer loop:
    cd kid-kode-landing && ./scripts/ralph.sh

The loop runs until status=="complete" or a paused-* breakpoint. Hooks prevent drift. Do not bypass them. Run until all 22 tasks are done.
```

---

## What this triggers

- `SessionStart` hook (`spec-presence-check.sh`) loads spec paths + warns on any missing Phase G assets (Gemini image, handoff doc, FAL_KEY).
- First `/ralph-step` run reads `ralph-state.json`, picks `T-SWAP-01` (first pending), runs 14-step TDD loop, commits, exits.
- `scripts/ralph.sh` outer loop re-invokes the inner skill until `status == "complete"` or a `paused-*` breakpoint trips.
- `anti-drift-check.sh` blocks any Write/Edit that introduces §1.4 forbidden patterns or hardcoded mock-app nodeIds inside `src/components/editor/**`.
- `spec-reviewer` subagent runs fresh-context review at the end of each iteration; MUST-FIX items block the commit.

## Narrow-set items that require a pause (per CLAUDE.md)

- `T-VID-03` (WAN 2.7 i2v) generates 4 placeholder videos at 4×$0.50 = $2.00 FAL spend. Must ask user first. Skip entirely if the user has video files ready.
- Anything that would touch production billing or third-party messaging — pause and ask.

## Resuming after a breakpoint

If the outer loop exits with `status == "paused-*"`:
1. `./scripts/ralph-resume.sh` reads the breakpoint and surfaces the reason.
2. Resolve the breakpoint condition (e.g., push a commit to unstick a stale HEAD).
3. Re-run `./scripts/ralph.sh` — it picks up from `resumeFrom` without re-doing completed work.
