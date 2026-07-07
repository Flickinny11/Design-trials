# PRISM-W2D — PER-HUB 2D/3D RENDER MODE (founder-ratified, authored 2026-07-07)
Working dir: /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing
Read FIRST: notes/PRISM-DESIGN-SUPREMACY-PLAN.md §4 W-2D (your contract),
hub schema + SceneRoot/renderer ownership, W-TPL's shipped picker/templates.

## MISSION
Per-hub renderMode: '3d' | '2d' with ZERO runtime fracture. The invariant is
the graph + self-contained nodes, NOT perspective rendering.
1. Hub schema gains renderMode (default '3d'); migration for existing hubs.
2. 2D = flat/orthographic composition path in the SAME renderer + same node
   contract; 3D accents remain layerable onto 2d hubs; transitions between
   2d/3d hubs stay smooth in preview.
3. Galaxy/node editor UNCHANGED (planets look identical either mode).
4. Canvas: depth-specific tools (Z position, camera staging, orbit) grey out
   on 2d hubs with a subtle mode chip; mode toggle in canvas + galaxy
   inspector, switchable any time, non-destructive both directions (depth
   data preserved, just unused, when 2d).
5. Conductor/prompt-to-node read hub renderMode and style accordingly
   (grammar families tagged 2d-appropriate vs 3d-only — extend family JSONs
   with a renderModes field; corpus honesty law respected).
6. Two demo fixtures: one hub toggled live 3d->2d->3d with frames proving
   non-destructive round trip; one mixed app (3d landing + 2d data hub).
7. Flight-record mode events; notes/spec-deviations-w2d.md before deviating.

## INVARIANTS: I-CANVAS core untouched beyond specified additive tool-state
logic; I-ENGINE (composition path is renderer CONFIG, not engine rewrite —
if that proves impossible, BLOCK, do not rewrite); I-SECRETS; I-PROVENANCE;
npm run verify EXIT 0; W5B gate green.
## JUDGES (fresh-context, 0 MUST-FIX): criteria-reviewer + user-advocate as
"user with a data-heavy app: does 2d feel native, not crippled?"
Evidence to notes/verification/shell-w2d/ incl. round-trip frames.
Report: notes/SHELL-W2D-REPORT.md (skeleton first).
## MARKER LAW: the completion marker must appear as an EXACT verbatim line,
alone, unformatted: 
PRISM-W2D: RUN COMPLETE
Blocked marker likewise verbatim: PRISM-W2D: BLOCKED-NEEDS-FOUNDER
