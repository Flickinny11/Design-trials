# PRISM — HARNESS DRIFT-PREVENTION — the 5 pillars (2026-06-29)

The build harness (sentinel `run-surface.sh` + chains + fresh-context judges) is kept.
What was missing — and what let the 2026-06-29 drift through — is added here as 5 pillars.
The drift was NOT a build agent deviating from a spec; it was (a) the PLANNER writing a
contaminated spec (retire the working editor; edit-from-preview), and (b) a remote-asset
crash that headless software-GPU "verification" was blind to. Build-time code-pattern
hooks (anti-drift-check.sh) could catch neither. These pillars close both holes.

Authority: the Ruler (`../PRISM-INTENT-ANCHOR.md`) + the machine-enforced subset
`.claude/INTENT-LOCK.md`.

## Pillar 1 — INTENT-LOCK + FOUNDER-SIGNOFF gate
- Hook: `.claude/hooks/intent-lock-gate.sh` (PreToolUse: Write|Edit).
- Blocks writes to specs / `*-PROMPT.md` / orchestrators / `SPEC-INDEX.md` that contradict the
  locked intent (retire/replace the `/` editor, edit-from-preview, rebuild-galaxy) OR that
  self-promote a spec to build-truth (`SUPERSEDES` / `Canonical (additive)` / `ACTIVE build-truth`)
  — unless a founder-authored `# FOUNDER-SIGNOFF: <YYYY-MM-DD>` token is present.
- Why: the contamination was prose in a spec, invisible to code-pattern hooks.

## Pillar 2 — DESTRUCTIVE-ACTION gate
- Hook: `.claude/hooks/destructive-action-guard.sh` (PreToolUse: Write|Edit|Bash).
- Hard-blocks delete/move/hard-reset of PROTECTED paths (the `/` editor `src/components/editor/**`,
  `src/app/page.tsx`, keyframe editor, walkthrough/tutorial, `src/lib/prism/**`) — **even under
  bypassPermissions** — and blocks a Write that would empty/stub a protected file. Override only via
  a founder-authored `FOUNDER-OVERRIDE` marker.
- Plus a `permissions.deny` blast-radius list in `.claude/settings.json` for catastrophic `rm -rf`.

## Pillar 3 — PRE-BUILD spec-vs-intent check
- Script: `kid-kode-landing/scripts/spec-intent-check.mjs`.
- The chain MUST call it on a phase's spec/prompt BEFORE launching the build agent; non-zero exit
  refuses the launch. Promotes the spec-reviewer from a POST-build judge to a PRE-build gate.
- **Chain wiring (done 2026-06-30):** `run-surface.sh` calls
  `kid-kode-landing/scripts/prism-autonomy-preflight.mjs --prompt "$PROMPT"` before every
  agent launch. `run-ws-chain.sh` calls the same preflight with both the phase prompt and
  `PRISM-WORKSPACE-COMPLETION-SPEC.md` before each W-3/W-4/W-5 phase. A block writes
  `chain-WS-<phase>-preflight.log` or `chain-<name>-run.log.preflight` and pauses the chain.

## Pillar 4 — Blocking STOP layer + narrowed blast radius
- Hook: `.claude/hooks/completion-gate.sh` (Stop / SubagentStop) — refuses to let a session
  "complete" while a crash-class remote-asset dependency sits in changed editor/scene code.
  Honors `stop_hook_active` so it blocks at most once (never loops). Re-arms the blocking stop
  layer that was softened to a non-blocking reminder before the drift.
- Blast radius: `permissions.deny` (Pillar 2) + the destructive-action guard apply even under
  bypassPermissions, so an unattended chain cannot delete the working editor.

## Pillar 5 — Real-browser / hardware-GPU / near-human verification (+ perf budget + no-remote)
- Doctrine: `docs/prism/VERIFICATION-STANDARD.md` (rewritten 2026-06-29).
- Verify in a REAL hardware-GPU browser with near-human computer-use + vision (Claude native
  computer-use / Claude-in-Chrome / GPU chrome-devtools). **Headless software-GPU is BANNED for
  visual/behavioral checks** — it cannot render WebGPU faithfully and silently passed the crashing
  canvas for days.
- Every run asserts the §8 budget: ≥60fps WebGPU / ≥45fps WebGL2, "feels fast", bounded memory,
  **ZERO remote asset fetches** (Network panel), zero console errors/rejections.
- Write-time no-remote-asset enforcement: `.claude/hooks/no-remote-asset-gate.sh` (PreToolUse:
  Write|Edit) — blocks drei `<Environment preset>`, CDN HDRIs/meshes, `esm.sh`, any `https://…asset`
  in `src/**`. This is the hook that would have stopped the 2026-06-29 crash at write time.

## Wiring (active for build sessions; project root = `Design-trials`)
All hooks are wired in `.claude/settings.json` under `PreToolUse` (Write|Edit + a Write|Edit|Bash
group), `Stop`, and `SubagentStop`, alongside the kept `anti-drift-check.sh` / `dependency-allowlist-check.sh`.
Each hook is independently testable: pipe a sample hook-JSON to it and check the exit code (2 = block).

## What is intentionally still kept
The sentinel/chain pattern, the 3 fresh-context judges, the existing FP-NN code-pattern gates
(`anti-drift-check.sh`), the dependency allowlist, and the non-blocking `spec-criteria-stop` reminder.
The 5 pillars ADD the planner-stage + real-verification layer; they replace nothing that worked.
