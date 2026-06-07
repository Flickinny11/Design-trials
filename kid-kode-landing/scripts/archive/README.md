# Archived — Ralph / Harness loop drivers (RETIRED 2026-06-05, STEP 3)

These scripts and slash-commands drove the autonomous **Ralph** and **Harness**
loops. They are **retired** and kept here for traceability only. Do **not** run
them.

> Per `STEP3-DRIFT-PREVENTION-PROMPT.md`: *"Ralph loops are RETIRED. Big parallel
> work → Claude Code dynamic workflows (Opus 4.8, self-checking). Focused work →
> a normal Opus 4.8 session. No homegrown loop scripts."*

Each of these re-spawned `claude --print … --dangerously-skip-permissions` up to
~500× against a task ledger (`notes/ralph-state.json`, now `status: complete`).
That auto-continuation pattern is exactly what the modernized drift-prevention
system replaces with **non-looping** feedback (a Stop hook that returns
`hookSpecificOutput.additionalContext` instead of forcing continuation) and an
**evidence-based** two-layer verification protocol (`/prism-verify`).

## What moved here

| File | Was | Role |
|---|---|---|
| `ralph.sh` | `scripts/` | Outer Ralph loop (`MAX_ITER=500`). |
| `ralph-resume.sh` | `scripts/` | Re-launches `ralph.sh` after a pause. |
| `kickoff-loop.sh` | `scripts/` | Preflight + background launcher for the loop. |
| `harness.sh` | `scripts/` | Harness lock-in loop driver. |
| `ralph-migrate-state.sh` | `scripts/` | Ralph state-schema migration helper (loop-only utility). |
| `commands/ralph-step.md` | `.claude/commands/` | Per-iteration worker (renderer-migration line). |
| `commands/ralph-step-editor.md` | `.claude/commands/` | Per-iteration worker (editor-build line). |
| `commands/kickoff-renderer-migration.md` | `.claude/commands/` | Loop launcher. |
| `commands/kickoff-prism-editor.md` | `.claude/commands/` | Loop launcher/monitor. |
| `commands/kickoff-harness-lockin.md` | `.claude/commands/` | Loop launcher. |
| `commands/harness-step.md` | `.claude/commands/` | Per-iteration harness worker. |

Moving the `*.md` workers out of `.claude/commands/` **de-registers** them as
slash-commands (`/ralph-step`, `/kickoff-*`, `/harness-step` no longer resolve),
which is intentional — the loops must not be one-keystroke launchable.

## What was deliberately KEPT in `scripts/`

The verification utilities are **not** loop drivers and remain active:
`verify-prism.mjs`, `verify-editor-runtimes.mjs`, `verify-repair-loop.mjs`,
`browser-smoke.mjs`, `live-*-smoke.mjs`, `wait-for-vercel-preview.mjs`,
`fetch-vercel-logs.mjs`, plus the asset/build pipeline scripts.

The **guardrail hooks** (`anti-drift-check.sh`, `model-guardrail.sh`,
`dependency-allowlist-check.sh`, `migration-forbidden-patterns.sh`,
`post-edit-typecheck.sh`, `format-check.sh`, `todo-scanner.sh`,
`spec-presence-check.sh`, `progress-reminder.sh`, `spec-criteria-stop.sh`) are
likewise preserved/modernized — only the loop *drivers* were retired.
