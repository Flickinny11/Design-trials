# Ralph harness v1.1 — convergence detection, phase caps, resumable breakpoints

**Landed:** 2026-04-22 (mid-flight — while the v1.0 loop was running iter 3/T02).

This document captures the structural changes to the outer Ralph loop. It supersedes the v1.0 design in which `MAX_ITER=50` was a hard ceiling with no resumption story.

## What changed

### 1. Ceiling raised to 500, with convergence detection

- `state.maxIterations` migrated `50 → 500` (schema v1.1 adds `maxIterationsPerPhase: 50`).
- `scripts/ralph.sh` default `MAX_ITER` raised `50 → 500`.
- A new convergence detector tracks `history[]` growth per iteration. If 5 consecutive iterations produce **zero new history entries** (i.e. no task transitions to `done`), the loop flips `status` to `paused-convergence` and exits cleanly. Threshold: `state.convergence.stagnantThreshold` (default 5), adjustable.
- Rationale: a genuinely productive loop keeps running for up to 500 iters; a spinning loop dies after 5 no-ops instead of burning the full budget.

### 2. Phase-based caps

- New `state.phaseCaps: { "§N": { used, cap, status } }`. A phase = the first-level spec section (e.g. `§10`, `§3`) derived from each task's first `specRef`.
- Before each iteration, the next pending task's phase is checked against `cap` (default 50 per phase, from `maxIterationsPerPhase`). If the phase has exhausted its allotment, the loop flips `status` to `paused-phase-cap`.
- After each iteration, the iteration is attributed:
  - If a task completed this iter (history grew), the iter counts against the completed task's phase.
  - Otherwise, it counts against the next-pending-task's phase.
- Rationale: a task tree covering five spec sections gets `5 × 50 = 250` iters of total budget, with 50 protecting any single section from runaway retries. Resuming a specific phase with `ralph-resume.sh --only=§X` adds another `maxIterationsPerPhase` allotment.

### 3. Resumable breakpoints

- `status` is no longer binary. Terminal values (`complete`, `failed`) stay as before. Three new **non-terminal** values carry a breakpoint reason:
  - `paused-ceiling` — global iter budget exhausted.
  - `paused-convergence` — 5 consecutive no-progress iters.
  - `paused-phase-cap` — next task's phase cap reached.
- `state.checkpoint` snapshots the last productive iteration (`iteration`, `commit`, `verifiedAt`, `artifactHash`, `recordedAt`). Updated on every successful iter.
- `state.breakpoints[]` appends an entry on every paused-* transition with `{ at, iteration, kind, message, ... }`.
- `scripts/ralph-resume.sh` is the only path back to `status = running`. It:
  - Refuses terminal statuses (`complete`, `failed`).
  - Clears `convergence.stagnantStreak`.
  - For `--only=§X`, bumps that phase's `cap` by `maxIterationsPerPhase`.
  - Sets `resumeFrom = checkpoint` for auditability.
  - Re-launches `scripts/ralph.sh` in-place (unless `--no-launch`).

### 4. Schema v1.1 (additive)

```jsonc
{
  "schemaVersion": "1.1",
  "maxIterations": 500,
  "maxIterationsPerPhase": 50,
  "convergence": {
    "stagnantStreak": 0,
    "stagnantThreshold": 5,
    "lastProductiveIteration": <int>,
    "lastProductiveCommit": "<sha>"
  },
  "phaseCaps": {
    "§10": { "used": <int>, "cap": 50, "status": "active" }
  },
  "checkpoint": {
    "iteration": <int>,
    "commit": "<sha>",
    "verifiedAt": "<iso>",
    "artifactHash": "<sha256>",
    "recordedAt": "<iso>"
  },
  "resumeFrom": null | <checkpoint>,
  "breakpoints": [ { "at", "iteration", "kind", "message", ... } ]
}
```

All v1.0 fields (`currentIteration`, `maxAttemptsPerTask`, `tasks[]`, `invariants`, `history[]`) are unchanged.

## Scripts (all in `scripts/`)

- `ralph.sh` — v1.1 outer loop. Handles terminal exit, three paused-* exits, convergence streak, phase-cap pre-check, and resume-from-paused-* on launch.
- `ralph-resume.sh` — flip paused-* → running, optionally raise a specific phase's cap, re-launch ralph.sh.
- `ralph-migrate-state.sh` — idempotent one-shot migration v1.0 → v1.1. Can be re-run safely.

## In-flight compatibility

The v1.0 `scripts/ralph.sh` was running when the migration was applied. Specifically:

- The outer bash loop had the v1.0 script loaded in memory (default `MAX_ITER=50` hardcoded in its `for` expansion). It keeps using v1.0 semantics until it exits.
- `state.maxIterations` was bumped to 500 — the v1.0 ceiling check `CUR_ITER >= MAX_FROM_STATE` becomes a no-op for the remainder of that run. The v1.0 loop exits cleanly at shell-counter `i=50`.
- When the next operator runs `scripts/ralph.sh` (or `scripts/ralph-resume.sh`), v1.1 semantics take over.
- The migration is additive-only. `/ralph-step` step 11 re-reads `ralph-state.json` before updating, so fields added during a running iteration survive.

## Operator cheat-sheet

| Situation | Command |
|---|---|
| Fresh start / continue after v1.0 loop exits | `cd kid-kode-landing && ./scripts/ralph.sh` |
| paused-ceiling or paused-convergence | `cd kid-kode-landing && ./scripts/ralph-resume.sh` |
| paused-phase-cap (§10 exhausted) | `cd kid-kode-landing && ./scripts/ralph-resume.sh --only=§10` |
| Inspect state without launching | `cd kid-kode-landing && ./scripts/ralph-resume.sh --dry` |
| Re-apply migration (safe, idempotent) | `cd kid-kode-landing && ./scripts/ralph-migrate-state.sh` |
