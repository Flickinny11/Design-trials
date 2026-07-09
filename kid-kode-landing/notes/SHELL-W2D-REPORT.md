# SHELL W-2D — PER-HUB 2D/3D RENDER MODE (report)

Status: COMPLETE — criteria-reviewer PASS (0 MUST-FIX) + user-advocate PLEASED (0 MUST-FIX).
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
| D1 | Schema: `PrismHub.renderMode` + `hub-render-mode.ts` helpers + read-side migration | DONE |
| D2 | Runtime 2d composition path in `mountFromGraphSource` (config, smooth transitions, camera-plane refit) | DONE |
| D3 | Editor canvas/preview: mode-aware SceneControlsBridge (orbit lock, flat fov, journeys gated, drift planar) | DONE |
| D4 | Canvas HUD mode chip + toggle, greyed Z stepper + journey strip, HubInspector (galaxy) toggle | DONE |
| D5 | Grammar `capabilities.renderModes` on all 16 families + query axis + validator; Conductor blueprint/hub/mode-aware flatten; prompt-edit context | DONE |
| D6 | Flight recorder 10th type `render_mode_event` (+ ingest route + client beacon + conductor capture) | DONE |
| D7 | Demo fixtures: live 3d→2d→3d round-trip evidence + mixed app (3d landing + 2d data hub) | DONE |
| D8 | Tests + gates + judges | DONE |

## Invariant compliance

- I-CANVAS — PASS (judge-verified: GraphScene edits are additive tool-state inside SceneControlsBridge only; AssembledSceneNode composition untouched).
- I-ENGINE — PASS (judge-verified: one PerspectiveCamera, fov/distance config; no ortho swap, no remount, no second renderer).
- I-SECRETS / I-PROVENANCE — PASS (judge spot-checked commit claims against the diff).
- `npm run verify` EXIT 0 (run pre- and post-capture); W5B ship gate 11/11; tsc 9 = 9 baseline (reviewer re-ran independently); vitest whole-suite: 3644 passed, the 9 failures are pre-existing at boundary f11e4bbd (proven via baseline worktree — identical failure sets).

## Evidence

`notes/verification/shell-w2d/` — round-trip frames, mixed-app frames,
store-evidence JSON, gate outputs. See EVIDENCE.md in that folder.

## Judge verdicts

- criteria-reviewer: **PASS — 0 MUST-FIX.** All 7 criteria PASS with executed
  evidence (re-ran tsc = 9 baseline, 21/21 W2D tests, grammar validator, all
  forbidden-pattern greps; independently audited all 14 family tags — "no
  dishonest tag"). Two cosmetic SHOULD-FIX, both commit-MESSAGE wording
  (the D5 message says "6 3d-only" — the honest on-disk count is 5; and a
  git diff-stat path elision), no code action required.
- user-advocate (data-heavy app user): **PLEASED — 0 MUST-FIX.** "2D feels
  native, not crippled: the ledger reads as a real right-aligned flat data
  page, depth tools genuinely disable (proven inert), the round trip is
  byte-identical, and every framing/smoothness number checks out
  independently" — the judge recomputed the tan-ratio framing math and the
  tween monotonicity themselves, and verified the WebGPU-dither probe story
  holds (both WebGPU probes equally broken incl. at the pre-wave commit;
  WebGL2 correct).

## Deviations

None. (`notes/spec-deviations-w2d.md` would be written before deviating.)

## Gotchas (for future waves)

- **This machine's current Chrome red-dithers the runtime's WebGPU path**
  (emissive extruded text + lit meshes render as red speckle) — proven
  PRE-EXISTING via probe frames at boundary f11e4bbd. The runtime's automatic
  WebGL2 fallback renders correctly; force it in a capture browser with an
  initScript `Object.defineProperty(navigator,'gpu',{get:()=>undefined})`.
  Root-causing the WebGPU regression (Chrome update vs three r-version) is an
  engine-side follow-up, NOT a graph/editor issue.
- Screenshot latency (~400ms+) cannot catch the 650ms composition tween —
  sample the camera per-frame via a page handle (`__W2D_DEMO__.camera()`)
  and record the fov/z curve as numeric evidence instead.
- The editor boots through a short sequence that can override an early
  `setViewMode` (preview-app → galaxy); wait for boot to settle before
  driving view modes from a verify script, and SKIP the first-run
  onboarding modal (button text `SKIP`).
- `useGraphEditorStore.setViewMode` is a plain set; the sanctioned verify
  hook is `window.__PRISM_EDITOR_SET_VIEW_MODE__`.
- Round-trip evidence law: after toggling a legacy hub 2d→3d, the hub
  carries an explicit `renderMode:'3d'` stamp where the field was previously
  ABSENT — byte-compare everything EXCEPT that field, then git-checkout
  live-graph.json (EDIT-I2 hygiene; autosave stamps it within seconds).
- The W8 `TEMPLATE_CATALOG` fold-in feeds `HUB_TEMPLATE_CATALOG` whose tests
  instantiate every entry SINGLE-hub — a multi-hub demo graph must NOT be
  registered there; a standalone lab route (`/w2d-demo`) is the safe idiom.
- camera-controls orbit is cleanly disabled per-mode with
  `azimuthRotateSpeed/polarRotateSpeed = 0` (no clamp snap); pan+zoom stay
  native.
- `bind('spin','time')` takes `params.speed` (see sections.ts), not
  periodSec; template `rot` is an `[x,y,z]` tuple.


PRISM-W2D: RUN COMPLETE
_(Marker line appended 2026-07-09 08:29 by founder-monitor after independent verification — both judge verdicts 0 MUST-FIX in report body, verify EXIT 0, W5B 11/11, vitest failures proven pre-existing via baseline worktree. The 01:09 report omitted this exact machine-readable line; the sentinel accepted the marker from the agent runlog (announcement, not record), triggering 12 phantom watcher retries. Sentinel patched to report-only markers this morning. No content above this line was changed.)_
