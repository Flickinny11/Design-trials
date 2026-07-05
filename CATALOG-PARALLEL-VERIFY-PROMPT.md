# CATALOG PARALLEL VERIFY — build the parallel verification harness + run a full 312-primitive sign-off. (Claude Code)

## MODEL & MODE
MODEL: claude-opus-4-8 (NOT opusplan; confirm active model on line 1). 1M context.
MODE: APP TOOLING + VERIFICATION. Add/refactor scripts under kid-kode-landing/scripts/** and write notes/** ONLY.
Do NOT touch app source under src/** EXCEPT to fix a genuine FUNCTIONAL verification failure (see FIX vs FLAG).
Stay on branch prism-editor-build. Run from git root. Do NOT commit (leave everything staged for Logan).
Shut down every dev server and browser you start; free the port at the end.
ANTI-STUCK: after ~2 fails on a step, web-search the CURRENT (2026) correct approach, root-cause it, retry.
NEVER downgrade a dependency or take the old/easy path.

## WHY THIS STEP
The 312-primitive catalog is BUILT and COMMITTED (HEAD 5fa695f). It already passed: the Animatable contract suite
(960 vitest), tsc baseline (10, 0 new), and a RIG-LEVEL render check (312 tiles load, hover-plays, 0 device-lost).
What it has NOT had is a fast, COMPLETE per-primitive browser art/glass sign-off — the old pass was a single serial
browser at ~1-2 tiles/min (multi-hour). THIS step builds the PARALLEL verification harness (the ultracode-for-verify
upgrade) and uses it to run a full 312 sign-off.

## DECISIONS (locked — do not reopen)
1. Orchestration: reuse the SAME parallel pattern as the build (notes/catalog-finish-workflow.mjs `parallel()`).
   Shard the 312 tiles across CONCURRENT verify workers. The reusable harness is the core deliverable
   (e.g. scripts/verify-catalog-parallel.mjs). Mechanical render/play/control capture runs in parallel browser
   workers; art-fidelity judgment runs as parallel fresh-context reviewer subagents over the captured frames.
2. Browser lib: Playwright — already used by scripts/verify-catalog.mjs and verify-catalog-realgpu.mjs (2026 default,
   cheap context parallelism). Do NOT introduce a new browser dependency.
3. Two tiers, each parallel, each tuned to the hardware:
   - STANDARD tiles (GPU-light majority): the software-GL/SwiftShader path (verify-catalog.mjs flags). Higher concurrency.
   - GLASS / TRANSMISSION / IBL / dispersion / caustics / iridescence tiles: the REAL-GPU Metal/WebGPU path
     (verify-catalog-realgpu.mjs flags; backend MUST report webgpu). Lower concurrency (GPU-memory bound).
4. Concurrency is AUTO-TUNED to THIS Mac's GPU/memory headroom: ramp up as far as the hardware allows with ZERO
   device-loss; back off on any device-lost. Do not impose an arbitrary small cap; do not thrash into device-loss.
5. Run scope: verify ALL 312 (full catalog). The report MUST break out the NEW 159 (finish-run W1-W8) from the prior 153.
6. Reuse ONE shared dev server (or a small pool) across workers via multiple pages/contexts — never relaunch next dev per tile.

## PER-PRIMITIVE GATES (every tile — do NOT loosen)
- RENDERS (non-blank first frame) + PLAYS (a mid-animation frame visibly differs from the first frame) +
  CONTROLS work (driving a control to an extreme changes the frozen frame) + appears in the Picker +
  ART-FIDELITY reviewer judges it premium.
- Glass/transmission/etc. -> REAL-GPU spot-check (backend=webgpu; real refraction/sparkle), never the software rig.
- A fresh-context art-fidelity reviewer signs off; MUST-FIX blocks done.

## FIX vs FLAG (scope-lock)
- FIX in this run: genuine FUNCTIONAL failures only — a tile that does not render, does not play, a control that does
  nothing, or a contract/tsc regression. Delete-then-regenerate broken code; NEVER show broken code to a repair model.
  Re-run that tile's gates after the fix.
- FLAG (do NOT fix here): subtle ART-POLISH nits — subtle-TSL brightness/exposure, clear-glass needing a backdrop in
  preview tiles, the ~5 known nits. These belong to the LATER dedicated art-polish step. List each precisely (which
  tile, what's off) so that step can act on it.

## GUARDRAILS (forbidden — halt + report if hit)
PreToolUse dependency-allowlist + forbidden patterns stay ON: NO stock icon libs, NO PixiJS / 2nd visible renderer,
NO diffusion-drawn text, NO dependency downgrades, NO global-fps. Any new dep must pass the allowlist guard.

## RESUMABILITY
Write notes/verification/PARALLEL-VERIFY-PROGRESS.md as shards finish (tiles passed / failed / flagged + running totals).
If interrupted, a relaunch reads it and continues from the unfinished shards — never restart from zero. Stage files as you go.

## ENV HYGIENE
You are launched headless with NODE_ENV unset, model pinned to claude-opus-4-8, from the git root. Before any `next dev`,
confirm NODE_ENV is unset. At the end, kill every browser + dev server you started and free the port.

## OUTPUT
Write notes/CATALOG-PARALLEL-VERIFY-REPORT.md:
- Headline: of 312, how many fully pass ALL gates; NEW-159 vs PRIOR-153 breakdown.
- Orchestration metrics: harness design (1-2 lines), worker count / PEAK parallelism actually achieved, total wall-clock,
  and the honest SPEEDUP vs the old serial pass.
- A GALLERY of mid-animation frames (contact sheets fine), grouped by the catalog's animation categories.
- GLASS real-GPU results: backend confirmed webgpu, per-glass-tile pass + one frame each.
- Every functional failure found + exactly how the loop fixed it (or, if truly unfixable, FLAGGED honestly — never faked).
- The carried-forward ART-POLISH to-do list (each flagged nit, precisely located).
Save frames under kid-kode-landing/notes/verification/catalog-parallel/. NO commit — staged for Logan.
End with a PLAIN-LANGUAGE summary for Logan: did the full catalog pass, how much faster the parallel harness is, and what
(if anything) remains for the art-polish step. Then STOP. HEAD stays prism-editor-build.
