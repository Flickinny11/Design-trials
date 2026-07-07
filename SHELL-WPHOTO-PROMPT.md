# PRISM-WPHOTO — PHOTOREALISM PIPELINE (founder-ratified program, authored 2026-07-06)

You are the W-PHOTO orchestrator. Working dir:
/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing
Branch: current checkout. Do NOT switch branches.

## MISSION
Kill "looks digital." Per notes/PRISM-DESIGN-SUPREMACY-PLAN.md §1: the
premium web's realism comes from photoreal IMAGERY composited with depth,
shadow, and post — not from pushing realtime materials to film quality.
Build the four-route rendering system and remaster the mock watch app as
the acceptance test. 12 of 14 grammar families route their gaps here — read
notes/DESIGN-GRAMMAR-GAP-REPORT.md and design-grammar/families/*.json FIRST;
they are your requirements ledger.

## FRESH-DATED RESEARCH DUTY (founder-verified leads, 2026-07-06 — verify
current versions/endpoints yourself before use)
- Instruction-based image editing: Nano Banana 2 Edit, FLUX.2 [pro] Edit.
- LAYER SEPARATION: Qwen-Image-Layered (prompt-based subject/layer split,
  multi-image output) — directly matches our composite pipeline.
- Product-photo ops now commodity: cutout, realistic shadow synthesis,
  relighting (Photoroom-class; prefer Replicate-hosted equivalents FIRST —
  we hold a Replicate key). Depth: current depth-anything family.
- fal.ai: one-API-many-models; TYPE a fal adapter per our provider-adapter
  law but STUB it until a fal key exists (.assetgen/fal.key — flag in
  report; founder may drop it mid-run, check twice like W9 did).
- Splats: current three.js-compatible gaussian-splat viewer libs.
- R1 floor: verify current three.js tone-mapping best practice (AgX/neutral
  filmic) + IBL/HDRI env workflow on our pinned r184.

## REQUIRED WORK
1. ROUTE PLANNER (src/lib/render-routes/): typed decision module choosing
   R1 realtime PBR / R2 pre-rendered composite / R3 baked hybrid / R4 splat
   per element from {interaction need, realism bar, byte budget, motion
   need}; doc with decision table; Conductor/prompt-to-node consumable.
2. COMPOSITE PIPELINE (R2/R3, src/lib/photo-pipeline/): generate ->
   layer-separate/cutout -> depth map -> synthesized soft shadow plate ->
   relight/harmonize -> LUT grade -> assemble as a LAYERED PARALLAX SCENE
   primitive (per design-grammar/observations/layered-photo-product-hero.md
   z-order + motion character: differentiated parallax, slow independent
   float loops, z-interleaved display type). Baked assets committed (DL13).
3. DRIVERS the gap report flagged: carousel driver primitive (filmstrip/
   coverflow families) + loop-column driver (infinite filmstrip) with
   never-resting drift + eased snap. Motion exemplars REQUIRED (frame
   sequences, not stills).
4. R1 CINEMATIC FLOOR: IBL/HDRI environment system, filmic tone mapping,
   imperfection-map pass (dust/scratches/fingerprint breakup — perfection
   reads digital), contact shadows, DOF/grain/bloom/LUT post chain — all as
   reusable primitives registered in DESIGN-REFERENCES conventions.
5. R4 SPLAT VIEWER: three.js-compatible splat component + loader + asset
   slot (generation/capture integration is a later wave).
6. ACCEPTANCE TEST — WATCH REMASTER: apply the route planner to the mock
   watch app (content-level changes allowed per W9A precedent; engine
   untouched). Before/after frames per scene. Re-run the W5B headless ship
   gate — zero certified regression.
7. STRETCH (triage honestly; if deferred, record in deviations + gap
   report): scroll-video-scrub + cinematic-video-hero families via our
   video-gen adapters.
8. Flight-record all generation/build events; notes/spec-deviations-wphoto.md
   BEFORE deviating code.

## SPEND DISCIPLINE
Replicate <= $10 estimated (log per-generation estimates + running total);
Tripo <= 100 credits (balance-check before batches); founder alerts: <$5
Replicate / <100 Tripo remaining.

## INVARIANTS (violation = MUST-FIX)
I-CANVAS (`/` core untouched); I-ENGINE (runtime/engine code untouched —
primitives + pipeline + mock-app CONTENT only); I-SECRETS/INV-19;
I-PROVENANCE (truthful commits; every baked asset labeled with real
generation source + prediction id); npm run verify EXIT 0; W5B gate green.

## EVIDENCE + JUDGES + MARKERS
Evidence to notes/verification/shell-wphoto/: before/after watch frames,
motion frame-sequences for both drivers, composite-pipeline stage outputs
for one full example (gen->layers->depth->shadow->grade->scene), route
planner decision-table doc, verify + W5B gate output. Dual judges fresh-
context: criteria-reviewer + user-advocate as "art director with a loupe":
(a) would you believe the remastered hero frames are photographs? (b) does
motion read alive-not-busy per the grammar? 0 MUST-FIX gate, fix rounds.
Report: notes/SHELL-WPHOTO-REPORT.md (skeleton first).
Complete: PRISM-WPHOTO: RUN COMPLETE
Blocked: PRISM-WPHOTO: BLOCKED-NEEDS-FOUNDER
Commit small and often; no silent 15-minute stretches. On resume, read
report + git log first.
