# PRISM-WVIS — Visual Convergence & Design-Lane Upgrade

Mission: raise visual-node quality to the production SLO —
**>=80% of visual nodes reach >=85/100 within budget (hero <=2 seen
iterations, standard <=1)**. Six levers. D1 is the decisive measurement
and runs FIRST, before any building.
Authority: docs/prism/RATIFICATION-2026-07-09.md +
docs/prism/BAKEOFF-TABLE-SIGNED.md + SHELL-WBAKEB-REPORT.md §3/§6.
Routing tiers are LAW per the signed table — this wave changes HOW lanes
work, never WHICH model runs a tier.

## D1 — Loop-convergence probe (decisive; before building anything)
1. Input: the 369 judged renders + region-anchored critiques already on
   disk (notes/bakeoff-b/). Stratified sample ~60 failing renders across
   models, tiers, 2D/3D (per-model cap 12), each with its critique.
2. Loop arm: SAME-MODEL revision (signed repair law) given its critique
   AND its own frame (vision-capable models; text-critique-only arm for
   text-only models, labeled) -> re-render -> blind re-judge under the
   rotation rules. Up to 2 iterations per render.
3. Control arm: best-of-2 blind resample on 20 specs, no feedback.
4. Report: delta-score per iteration per model class; % reaching >=85
   within 1 and within 2 iterations; cost and wall per iteration.
   State the number plainly even if it is bad — this decides whether the
   SLO is one wave away or the architecture needs deeper work.
5. D1 budget: $35 of the wave cap, ledgered per call.

## D2 — Spec-manifest completeness gate (kills MISSING_SPEC_ELEMENT)
6. Generators emit a manifest mapping EVERY L3 spec element to a code
   location. Deterministic pre-render gate rejects unmapped items back
   to the generator (one retry) before any mount. Additive wiring into
   the codegen path; verifier rule + unit tests.

## D3 — Preset libraries as first-class primitives (kills FLAT_VOID /
## DEAD_LIGHTING at the source)
7. Light-rig library: >=12 numeric rigs (key/fill/rim, mood-tagged).
   Camera-framing library: >=10. Composition-layout library: >=10
   spanning 2D and 3D. Every preset render-proven with a committed thumb
   (W-BG catalog discipline — no unproven entries).
8. Design-director contract updated: emits preset SELECTIONS +
   parameters; freeform lighting/camera numbers become a fallback, not
   the default. L3 schema carries the selection.

## D4 — Reference-frame conditioning
9. Per visual node, a composition frame (existing FLUX pipeline) rides
   the generation call for multimodal models; text-only models receive a
   structured frame description fallback (labeled in the recorder).
10. Critic scores render-vs-frame alongside the DL rubric.

## D5 — Hero lane: see-then-revise as the default
11. Design-critical lane becomes: generate -> mount+capture -> SAME model
    reads its own frame -> revise -> final. Best-of-2 select where the
    iteration budget allows. Config-gated per OD11 budgets.
12. Flight-recorder fields: iterations used, per-iteration scores, preset
    selections — including the Luna first-pass regression sentinel from
    the signed table's condition 4.

## D6 — Per-model protocol wrappers + targeted exemplars
13. Constraint checklist ordered AT THE END of the prompt; plan-then-code
    preamble; model-specific format wrappers where the bakeoff showed
    fence/prose habits. Exemplar retrieval upgraded: 2 NEAREST exemplars
    by node class/style, replacing the generic six.

## D7 — Validation against the SLO (the wave's proof)
14. Re-run the frozen 20 visual specs through the UPGRADED lane
    (D2+D3+D4+D5+D6 all active) with claude-sonnet-5 (contestant
    reliability floor) AND claude-fable-5 (ceiling reference). Blind
    judging, rotation rules, W-2D capture discipline.
15. Report the SLO number directly: % of nodes reaching >=85 within
    budget, per model, vs the signed >=80% target. Show the frames.

## Budget + invariants
- HARD CAP $85 total metered (includes D1's $35), per-lane caps,
  $0.50 stop margin, per-call ledger. Founder-CLI judging is
  sub-equivalent and ledgered separately (W-BAKEB cap semantics).
- I-V1. Additive only; routing tiers exactly per BAKEOFF-TABLE-SIGNED.
- I-V2. All D3 presets render-proven; no catalog entry without a thumb.
- I-V3. Blinding + judge rotation per W-BAKEB standard; mappings
  committed after judging.
- I-V4. Honest disclosure: if D1 convergence is poor, the report says so
  in the first paragraph — do not bury the lede.
- I-V5. No key material anywhere. I-V6. Marker verbatim IN the report.

## Judges (fresh context, both required, 0 MUST-FIX)
- criteria-reviewer: recount D1 deltas + D7 SLO numbers from raw
  artifacts; re-render 3 presets from their committed parameters; verify
  the D2 gate rejects a seeded incomplete manifest; I-V1 diff check.
- user-advocate (founder proxy): eye-check >=8 D7 frames against scores;
  answer plainly — does the SLO hold, and would Logan ship these frames?
  PLEASED/DISPLEASED verbatim.

## Report — notes/SHELL-WVIS-REPORT.md
(1) D1 convergence tables + verdict FIRST; (2) gate + presets + refs +
lane wiring evidence; (3) D7 SLO table + frames; (4) cost ledger;
(5) anomalies; (6) judge verdicts verbatim; (7) what W-DISPATCH inherits.
Final line, verbatim: PRISM-WVIS: RUN COMPLETE
