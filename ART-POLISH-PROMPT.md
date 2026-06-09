# ART-POLISH PASS — close the precise punch-list from the verify + lighting steps, via ultracode. (Claude Code)

## MODEL & MODE
MODEL: claude-opus-4-8 (NOT opusplan; confirm active model on line 1). 1M context.
ORCHESTRATION: ULTRACODE — Dynamic Workflows with PARALLEL subagents in INTERNAL verified waves (reuse the
`parallel()` pattern in notes/catalog-finish-workflow.mjs / catalog-batch-workflow.mjs). Each subagent pins
claude-opus-4-8. CONTRACT-FIRST: write + freeze the additive "volumetric plane" tag (see item 2) BEFORE the parallel
shader-fix agents build against it. Run waves straight through (no human pause between waves).
MODE: APP IMPLEMENTATION, verified. Edits allowed under kid-kode-landing/src/** (catalog primitives + the tile renderer
+ the post pass) and scripts/notes. Stay on branch prism-editor-build. Run from git root. Do NOT commit (leave staged
for Logan). Shut down every dev server / browser you start; free the port.
ANTI-STUCK: after ~2 fails on a tile, web-search the CURRENT (June 2026) correct approach, root-cause, retry.
NEVER downgrade a dependency, never take the old/easy path, never fake a pass.

## READ FIRST (do not skip)
- kid-kode-landing/notes/CATALOG-PARALLEL-VERIFY-REPORT.md — the precisely-located art-polish flags.
- kid-kode-landing/notes/MATERIAL-LIGHTING-REPORT.md §8 (honest gaps carried here) — the exact carried items.
- kid-kode-landing/notes/CATALOG-BATCH-REPORT.md + CATALOG-BATCH-2-REPORT.md — the ~5 minor nits.
- kid-kode-landing/docs/prism/PRISM-CANVAS-EDITOR-SPEC.md — §8.3 (catalog), §10 (lighting), §11 (material), INV-8,
  INV-9, §19 forbidden, §20 re-verify.
- The lighting system just shipped: src/lib/prism/runtime/shared/{lighting-rig,material-system,environment-ibl,
  capability-tier}.ts + shared-tile-renderer.ts (glass lit-backdrop). BUILD ON it; do not duplicate or regress it.

## SCOPE — exactly these items, nothing else
1. **Clear-glass centres:** the lit backdrop lifted the 5 clear-glass tiles out of black, but the CENTRES of
   `crystal-ball` / `water-droplet` (and any sibling clear tiles) are still dark. Tune backdrop brightness/proximity +
   material thickness/IOR so the centre refracts the backdrop instead of reading near-black. Keep it premium, not blown out.
2. **Flat volumetrics:** lift the volumetric/smoke/fog/fire tiles that render flat or blocky — `clouds`, `fog`,
   `godray`, `cosmic-dust`, `fireball-burst` (also fix its colour — must read as FIRE, not teal/grey), `supernova`,
   `will-o-wisp`, `heat-column`, `volumetric-cone`, and any sibling flagged in the verify report. This REQUIRES a small
   ADDITIVE change so the renderer can tell a plane is volumetric: add an optional `volumetric` (or equivalent) tag to
   the Animatable/primitive metadata and have `buildSubject` give tagged planes real depth treatment. The tag is
   ADDITIVE with a safe default — it must NOT break the frozen Animatable contract or any existing primitive.
3. **T2 unlit mask:** at the T2 tier the SSGI/GTAO post pass currently touches unlit image planes. Add an object/layer
   mask so `receivesLighting=false` planes are excluded from the screen-space passes — making the "diffusion-baked
   image planes are pixel-identical" guarantee EXACT at T0/T1/T2 (today it's exact only at T0/T1).
4. **Editor-canvas shadows:** enable shadow-casting inside the editor `<Canvas>` view (the `shadows` prop + per-mesh
   cast/receive flags) so meshes cast soft shadows in the canvas, matching the runtime/probe.
5. **The ~5 minor nits** from the catalog batch reports — resolve each, listed by name in your report.

## OUT OF SCOPE (do not touch)
Text-MSDF binding, the OTHER deferred toolbar groups (Image / 3D-shape / Text / Animation-picker), the engine/harness,
AI/neural relighting, and graph topology / node-system / the bipartite DAG (frozen, INV-1). Do not regress the lighting
system or the 312-primitive functional pass.

## VERIFICATION — FULL STRENGTH (reuse the NEW parallel harness)
Use scripts/verify-catalog-parallel.mjs (the parallel browser harness) for the visual pass — the fast ultracode-for-verify
path; real-GPU spot-checks (backend=webgpu) for glass + volumetrics. Per item:
- BEFORE/AFTER frames for every lifted tile; the art-fidelity reviewer (fresh context) must judge each AFTER premium.
- Item 1: clear-glass centres visibly refract the backdrop (not near-black), on the real-GPU path.
- Item 2: each flagged volumetric visibly gains depth; `fireball-burst` is fire-coloured; the volumetric tag is additive
  and ALL 312 still render+play+control (no regression).
- Item 3: an unlit image plane is byte-identical at T2 now (re-run the criterion-17-style check at T2, not just T1).
- Item 4: a mesh casts a soft shadow inside the editor canvas view (screenshot).
- Gates throughout: `tsc --noEmit` 0 new (hold baseline); vitest green incl. any new tests; fresh-context reviewer
  signs off each wave; MUST-FIX blocks done. Fix-don't-skip; contamination-aware repair (delete broken code first).

## GUARDRAILS (forbidden — halt + report if hit)
Dependency-allowlist + forbidden patterns ON: no 2nd visible renderer / PixiJS; no diffusion-drawn text; no stored
global-fps; no dependency downgrades; heavy effects stay capability-gated (INV-9); additive-only on shared-interfaces /
the Animatable contract (never remove/repurpose fields). New deps must pass the allowlist guard.

## RESUMABILITY
Write notes/verification/ART-POLISH-PROGRESS.md as waves complete (tiles fixed + before/after + running tsc/vitest). If
interrupted, a relaunch reads it and continues from the last wave — never restart from zero. Stage files as you go.

## ENV HYGIENE
Launched headless with NODE_ENV unset, model pinned claude-opus-4-8, from git root. Confirm NODE_ENV unset before any
`next dev`. Kill every browser + dev server you start at the end; free the port.

## OUTPUT
Write notes/ART-POLISH-REPORT.md:
- A BEFORE/AFTER gallery for every lifted tile (clear-glass centres; each volumetric; fireball colour).
- The additive volumetric-tag change documented (what field, default, why it can't break existing primitives).
- T2 unlit-mask proof (unlit plane byte-identical at T2) + editor-canvas shadow proof.
- Orchestration metrics (waves, peak parallelism, total time, every failure + how the loop fixed it).
- tsc + vitest results; the ~5 nits resolved by name; anything that still can't meet the bar, flagged HONESTLY (never faked).
Save frames under kid-kode-landing/notes/verification/art-polish/. NO commit — staged for Logan.
End with a PLAIN-LANGUAGE summary for Logan (what looks better now, with the headline before/after tiles, and anything
still open). Then STOP. HEAD stays prism-editor-build.
