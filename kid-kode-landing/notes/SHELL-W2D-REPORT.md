# SHELL W-2D — PER-HUB 2D/3D RENDER MODE (report)

Status: IN PROGRESS (skeleton committed first, per run rules).
Contract: `notes/PRISM-DESIGN-SUPREMACY-PLAN.md` §4 W-2D + SHELL-W2D prompt.
Branch: `codex/prism-recovery-harness-20260630`.

## Mission recap

Per-hub `renderMode: '3d' | '2d'` with ZERO runtime fracture. The invariant is
the graph + self-contained nodes, NOT perspective rendering. 2D is a
flat/orthographic composition path in the SAME renderer, same node contract;
3D accents stay layerable; 2d↔3d hub transitions stay smooth in preview;
galaxy unchanged; depth tools grey out on 2d hubs; mode toggle in canvas +
galaxy inspector, non-destructive both directions; Conductor/prompt-to-node
read hub mode; grammar families tagged with `renderModes`; two demo fixtures;
flight-recorded mode events.

## Design of record (how 2D avoids fracturing the runtime)

- __Same renderer, same camera object, renderer CONFIG only (I-ENGINE):__ 2D is
  a *flattened-perspective composition* — the hub's camera drops to a telephoto
  FOV (`FLAT_HUB_FOV`) with the distance compensated so the framed viewport
  height is identical (`d₂ = d₃ · tan(fov₃/2)/tan(fov₂/2)`). Perspective depth
  scaling/parallax collapses below visibility → the composition reads flat /
  orthographic-equivalent, while the scene, node contract, hub manager, and
  WebGPU pipeline are untouched. No `OrthographicCamera` class swap, no canvas
  remount, no second scene — which is also exactly why 2d↔3d hub transitions
  can tween smoothly on one camera.
- __Non-destructive both directions:__ `renderMode` is one additive hub field.
  Node `scenePosition.z`, hub `cameraKeyframes`, and every other depth datum
  are preserved verbatim — they are simply *unused* while the hub is 2d
  (journeys don't play, the projection flattens z).
- __3D accents layerable:__ mesh nodes still render as lit 3D geometry inside
  a 2d hub; only the *composition camera* is flat.
- __Galaxy unchanged:__ planets read `identity`/radius only; `renderMode` is
  never consulted by the galaxy renderer.

## Deliverables

| # | Deliverable | Status |
|---|---|---|
| D1 | Schema: `PrismHub.renderMode` + `hub-render-mode.ts` helpers + read-side migration | PENDING |
| D2 | Runtime 2d composition path in `mountFromGraphSource` (config, smooth transitions, camera-plane refit) | PENDING |
| D3 | Editor canvas/preview: mode-aware SceneControlsBridge (orbit lock, flat fov, journeys gated, drift planar) | PENDING |
| D4 | Canvas HUD mode chip + toggle, greyed Z stepper + journey strip, HubInspector (galaxy) toggle | PENDING |
| D5 | Grammar `capabilities.renderModes` on all 16 families + query axis + validator; Conductor blueprint/hub/mode-aware flatten; prompt-edit context | PENDING |
| D6 | Flight recorder 10th type `render_mode_event` (+ ingest route + client beacon + conductor capture) | PENDING |
| D7 | Demo fixtures: live 3d→2d→3d round-trip evidence + mixed app (3d landing + 2d data hub) | PENDING |
| D8 | Tests + gates + judges | PENDING |

## Invariant compliance

(graded at run end — targets:)
- I-CANVAS: core untouched beyond specified additive tool-state logic.
- I-ENGINE: composition path is renderer CONFIG, not engine rewrite.
- I-SECRETS / I-PROVENANCE.
- `npm run verify` EXIT 0; W5B ship gate 11/11; tsc baseline 9 = 9 (0 new).

## Evidence

`notes/verification/shell-w2d/` — round-trip frames, mixed-app frames,
store-evidence JSON, gate outputs. See EVIDENCE.md in that folder.

## Judge verdicts

- criteria-reviewer: (pending)
- user-advocate (data-heavy app user): (pending)

## Deviations

None. (`notes/spec-deviations-w2d.md` would be written before deviating.)

## Gotchas (for future waves)

- (filled at run end)
