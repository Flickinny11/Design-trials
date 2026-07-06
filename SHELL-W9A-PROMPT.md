# PRISM-SHELL-W9A — MOCK WATCH APP SHOWPIECE ENHANCEMENT (founder-directed 2026-07-05)

You are the W9A orchestrator. Working dir:
/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing
Branch: current checkout. Do NOT switch branches.

## MISSION
The mock watch-atelier app (ORRERY No.7 lineage — "Time, machined.") is the
capability proof users see inside the framed preview pane and on the landing
showcases. Enhance it into an even stronger showpiece using the newly live
generation pipelines: Tripo API (.assetgen/tripo.key) for hero-grade 3D
(Smart Mesh clean topology, PBR/8K textures, part segmentation, GLB export)
and Replicate (.assetgen/replicate.key) for tileable materials and imagery.
Photoreal watch geometry, richer materials, more cinematic staging — while
every certified behavior stays green.

## READ FIRST
1. docs/prism/ORRERY-NO7-VISION.md — the vision this must serve.
2. notes/SHELL-W2-REPORT.md + notes/SHELL-W5B-REPORT.md — where the mock app
   is embedded and what the judges certified.
3. The mock-app source (public/prism-mock-app-renderer/ + its runtime
   fixtures) — locate precisely before touching anything.
4. docs/prism/DESIGN-REFERENCES.md — advanced technique catalog.
5. SHELL-W9-PROMPT.md FOUNDER ADDENDUM — the provenance law and key
   discipline apply to this wave identically.

## FRESH-DATED RESEARCH DUTY
Check today's date; web-verify current Tripo API endpoints/models and current
Replicate model versions before use. Founder-verified 2026-07-05: Tripo Smart
Mesh P1.0, 8K texturing, part segmentation, universal rigging, GLB export;
Replicate headliners Hunyuan 3D 3.1 / Rodin Gen-2. Verify again yourself.

## REQUIRED WORK
1. HERO GEOMETRY — replace/augment the watch centerpiece with a Tripo-generated
   photoreal model (Smart Mesh topology, PBR textures). Part-segment so crown,
   bezel, movement can stage independently. Bake and commit GLB + textures
   under public/ (baked assets only; DL13).
2. MATERIALS — regenerate/upgrade the atelier's material story with fresh
   Replicate tileables + Tripo textures. DL16: material richness everywhere;
   flat black voids are MUST-FIX.
3. STAGING — more cinematic camera/light choreography using the committed
   animatable primitives. Reduced-motion path preserved.
4. INTEGRITY — the mock app must run identically in every certified context:
   framed preview pane (W2 Task 0), preview runtime, ship fixture (W5B §14.1
   GATE headless test). npm run verify EXIT 0. Re-run the W5B headless ship
   gate and show output.

## SPEND DISCIPLINE
Tripo: check balance before batch runs; log credits used per generation in
the report. Replicate: log estimated $ per generation; keep W9A spend under
~$5. If balance or estimates run low, finish with committed assets and note it.

## INVARIANTS (violation = MUST-FIX)
- I-CANVAS: `/` canvas editor byte-untouched. I-ENGINE: Prism runtime/engine
  code untouched — mock-app CONTENT only. Diff-verify both.
- I-SPEC: no canonical spec edits; deviations to notes/spec-deviations-w9a.md
  BEFORE the deviating code. I-SECRETS: keys never in git/logs/reports.
- I-PROVENANCE: commit messages never claim unperformed acts.

## EVIDENCE + JUDGES + MARKERS
Frames (desktop+mobile, real build) to notes/verification/shell-w9a/;
metrics.json; verify output. Dual judges (criteria-reviewer + fresh-context
user-advocate on "is this watch app a jaw-dropping showpiece?"), 0 MUST-FIX.
Report: notes/SHELL-W9A-REPORT.md (skeleton first).
Complete: PRISM-SHELL-W9A: RUN COMPLETE
Blocked: PRISM-SHELL-W9A: BLOCKED-NEEDS-FOUNDER
Commit small and often. On resume, read report + git log first.
