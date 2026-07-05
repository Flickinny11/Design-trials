# USER-ADVOCATE VERIFICATION PASS + six-tile cleanup proving-ground, via ultracode. (Claude Code)

## MODEL & MODE
MODEL: claude-opus-4-8 (NOT opusplan; confirm active model on line 1). 1M context.
ORCHESTRATION: ULTRACODE — Dynamic Workflows with PARALLEL subagents in INTERNAL verified waves (reuse the
`parallel()` pattern in notes/catalog-finish-workflow.mjs). Each subagent pins claude-opus-4-8. CONTRACT-FIRST:
freeze the user-advocate rubric + reviewer interface (Part A) BEFORE the six tiles run against it (Part B).
MODE: APP IMPLEMENTATION + HARNESS, verified. Edits allowed under kid-kode-landing/scripts/**, the verification
loop, and src/** for the 6 named tiles only. Stay on branch prism-editor-build. Run from git root. Do NOT commit
(leave staged for Logan). Shut down every dev server / browser you start; free the port.
ANTI-STUCK: after ~2 fails, web-search the CURRENT (June 2026) correct approach, root-cause, retry. NEVER downgrade a
dependency, never take the old/easy path, NEVER fake or assert a pass.

## READ FIRST
- The verification loop + harness: scripts/verify-catalog-parallel.mjs (parallel browser workers), the /prism-verify
  loop, the fresh-context `prism-criteria-reviewer` subagent, and the computer-use primitives already wired
  (KripVerify `kv_verify`/`kv_click`/`kv_type`/`kv_evaluate`; Claude-in-Chrome computer-use). BUILD ON these.
- kid-kode-landing/notes/ART-POLISH-REPORT.md — the six holdout tiles + exactly what's wrong with each.
- The working reference: the `fire-flame` primitive (it reads as correct fire) — study how it blends/tone-maps.
- PRISM-CANVAS-EDITOR-SPEC.md §8.3 (catalog), §19 forbidden, §20.

## PART A — build the USER-ADVOCATE pass into the harness (the capstone reviewer)
Add a NEW, REUSABLE reviewer role to the verification loop: a computer-use agent (Claude Opus operating the RUNNING
app — clicking/dragging/playing/typing like a real NON-TECHNICAL user, not DOM-scraping) that judges a feature/tile
against this CONCRETE, EVIDENCE-BACKED rubric and returns a verdict. It is parameterizable so future steps (toolbar,
text, etc.) can point it at any feature.
RUBRIC (every answer MUST cite specific evidence — a frame, a measured value, or an interaction result; NEVER a bare
assertion):
  1. Is anything visibly broken, misaligned, low-contrast, cut off, glitchy, or laggy? (list each WITH a frame)
  2. Does it READ AS WHAT IT CLAIMS? (e.g. does "fireball" look like fire? does a labeled control do something sensible
     across its range?) — compare against the claim/name and any ground-truth sibling.
  3. Would a first-time, non-technical user understand how to use it UNPROMPTED? (for interactive features)
  4. Does it feel responsive, or janky?
  5. NET VERDICT: would a user be PLEASED / INDIFFERENT / ANNOYED — and exactly WHY.
POWERS: MUST-FIX (blocks done) for clear failures — broken/misaligned/cut-off/laggy, or "does not read as what it
claims". FLAG-DON'T-BLOCK for subjective taste calls. ANTI-RUBBER-STAMP (load-bearing): a pass with no cited evidence
is INVALID — this is the exact failure we hit before (53 tasks "verified" while the runtime showed only a background).
Assertion-based "done" is FORBIDDEN; evidence or it didn't happen.
Wire it into scripts/verify-catalog-parallel.mjs so it runs CONCURRENTLY (same parallel pattern), after the functional
+ art-fidelity gates, as the final human-grade gate.

## PART B — six-tile cleanup, run THROUGH the new user-advocate (the proving ground)
Fix these six, each rebuilt then taken through functional + contract + art-fidelity + USER-ADVOCATE gates:
- `fireball-burst` + `heat-column`: rebuild with the NON-ADDITIVE blending approach `fire-flame` uses, so warm colour
  stays fire/heat instead of shifting pink/cream/olive under the preview tone-mapping. Must read as real fire/heat.
- `fog-roll`, `smoke`, `will-o-wisp`, `cosmic-dust`: remove the blocky slab-seam layering (more slabs + lower
  inter-slab parallax, OR a single-plane raymarch for the dense ones — choose per tile). Must read as real volume.
- `clouds`, `fog`: lift from muddy to vivid, defined sky/fog.
Each must end PLEASED on the user-advocate WITH evidence; the 312 catalog must still render+play+control (no
regression). If a tile genuinely can't reach the bar after real effort, FLAG it honestly (never fake, never rubber-stamp).

## PROVING-GROUND REQUIREMENT (the real point of this step)
This set is KNOWN-HARD and we KNOW the right answers (fire-flame is ground truth for fire). The report MUST DEMONSTRATE
the user-advocate EARNED trust: show its verdict on the CURRENT bad state (e.g. the pink/blocky fireball) — it must
correctly call that ANNOYED/MUST-FIX — and its verdict on the AFTER state, and prove it only passed genuinely good
results. If the user-advocate rubber-stamps a bad tile, that is a FAILURE of Part A — fix Part A, don't lower the bar.

## GUARDRAILS (forbidden — halt + report if hit)
Dependency-allowlist + forbidden patterns ON: no 2nd renderer/PixiJS; no diffusion-drawn text; no global-fps; no
dependency downgrades; heavy effects stay capability-gated (INV-9); additive-only on shared-interfaces/the Animatable
contract; assertion-based verification (no evidence) is forbidden. New deps must pass the allowlist guard.

## RESUMABILITY
Write notes/verification/USERADVOCATE-SIXTILE-PROGRESS.md as waves complete (Part A status; per-tile fix + each gate +
the user-advocate verdict + running tsc/vitest). Resumable from the last wave; never restart from zero. Stage as you go.

## ENV HYGIENE
Launched headless with NODE_ENV unset, model pinned claude-opus-4-8, from git root. Confirm NODE_ENV unset before any
`next dev`. Kill every browser + dev server you start at the end; free the port.

## OUTPUT
Write notes/USERADVOCATE-SIXTILE-REPORT.md:
- Part A: the user-advocate design — the rubric, how it drives the app via computer-use, how MUST-FIX vs FLAG works,
  and the anti-rubber-stamp (evidence-required) mechanism. How it's wired into the parallel harness.
- Proof it earned trust: its verdict on the BAD before-state of fireball/heat-column (must be MUST-FIX) vs the AFTER.
- Part B: BEFORE/AFTER frames + the user-advocate verdict for all six tiles; the 312 no-regression confirmation.
- Metrics (waves, peak parallelism, time, failures + fixes); tsc + vitest; anything still flagged HONESTLY.
Save frames under kid-kode-landing/notes/verification/useradvocate-sixtile/. NO commit — staged for Logan.
End with a PLAIN-LANGUAGE summary for Logan: did the user-advocate prove it catches real problems without rubber-
stamping, and are the six tiles fixed (with the headline before/after). Then STOP. HEAD stays prism-editor-build.
