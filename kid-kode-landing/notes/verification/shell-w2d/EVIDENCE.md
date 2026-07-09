# SHELL W-2D — evidence index (captured 2026-07-09, live browser on :3007)

All frames 1440×775 PNG, captured with Chrome DevTools MCP driving the real
running app. Numeric readings sampled live via `window.__W2D_DEMO__`,
`window.__PRISM_DEBUG_STORES__`, and `window.__PRISM_EDITOR_GET_CANVAS_CAMERA__`;
the full numbers are in `store-evidence.json`.

## WebGPU environment note (pre-existing, NOT W-2D)

This machine's current Chrome renders the runtime's WebGPU path with a red
dither on emissive text/lit meshes. Probe frames prove it predates W-2D:

- `probe-known-good-template.png` — the W8-judged `/templates/kinetic-scroll-hero`
  on W-2D HEAD: red-dithered.
- `probe-baseline-template.png` — the SAME route served from a worktree at the
  pre-W2D boundary commit `f11e4bbd`: identically red-dithered.
- `probe-baseline-webgl2.png` — same baseline route on the runtime's own
  automatic WebGL2 fallback: renders correctly.

All W-2D evidence below is captured on that WebGL2 fallback (same runtime,
same graph, same composition config — the camera math under test is
backend-independent).

## A — Runtime mixed-app demo (`/w2d-demo`, fixture 2)

The `ledger-mixed` graph (3d landing + `renderMode:'2d'` ledger) running
through the REAL `mountFromGraphSource`; hub pills call the runtime's own
`hubManager.activate`.

- `A1-demo-landing-3d.png` — 3d landing: depth-staged torus showpiece, tilted
  side plates, FOV 50.0 · Z 10.0 readout.
- `A2-demo-ledger-2d-flat.png` — the 2d ledger: a NATIVE flat data page
  (aligned table, no perspective skew) with the 3D brass-gyre accent still
  rendering as lit geometry. FOV 10.0 · Z 53.3 readout — framing-preserving
  telephoto (2·10·tan25° = 2·53.3·tan5°).
- `A4-demo-landing-restored.png` — navigated back: FOV 50.0 · Z 10.0 restored.
- Smooth-transition proof: screenshot latency can't catch the 650ms tween, so
  the sampled curve in `store-evidence.json`
  (`fov 13→27.9→39.5→47.7→49.8→50` over ~650ms, cubic ease-out) is the
  evidence of record — one continuous PerspectiveCamera, no remount.

## B — Editor live toggle round trip (`/`, fixture 1)

s1-arrival (legacy hub, `renderMode` absent = 3d migration default), 39 nodes.

- `B1-canvas-3d.png` — canvas 3d: free orbit, camera z=18, Transform flyout.
- `B2-canvas-2d-flat.png` — after clicking the HUD MODE→2D chip: camera
  z=85.22 (exactly 18·tan22.5°/tan5°), straight-on, HUD reads
  "2D · FLAT / PAN + ZOOM · DEPTH OFF", JOURNEY strip greyed.
- `B3-canvas-2d-z-stepper-greyed.png` — node selected: the Z stepper renders
  greyed with the why-tooltip; functional proof in `store-evidence.json`
  (two Z clicks stage NOTHING; an X click still stages 0.06).
- `B4-canvas-3d-restored.png` — after MODE→3D: camera z=18.00 exactly, HUD
  instrument restored.
- Non-destructive round trip (`store-evidence.json`): hub JSON identical
  except the `renderMode:'3d'` stamp; all 39 node scenePositions
  byte-identical.

## G — Galaxy invariance + inspector toggle

- `G1-galaxy-s1-3d.png` vs `G2-galaxy-s1-2d-identical-planets.png` — same
  planets/orbits/labels with s1 toggled 3d↔2d (HubPlanet never reads
  renderMode).
- `G3-hub-inspector-mode-toggle.png` — the Hub Inspector Visual tab carries
  the RENDER MODE (3D Depth / 2D Flat) toggle in galaxy.

## P — Editor preview-app (shipped view)

- `P1-preview-app-2d-flat.png` — s1 as 2d: the shipped view is a flat
  print-like page at z=49.71 (= distanceForFovChange(45, 10.5, 10)), planar
  breathing only.
- `P0-preview-app-3d-restored.png` — s1 back to 3d: perspective hero pose
  (z≈10.5 + idle drift) with dimensional backdrop.

## Flight recorder

- `flight-recorder-render-mode-events.ndjson` — the two HUD chip toggles
  recorded LIVE through beacon → `/api/prism/render-mode-event` →
  `recordRenderMode` → training sink: `canvas-hud 3d→2d` and
  `canvas-hud 2d→3d` on `s1-arrival`, consent true.

## Hygiene

`public/prism-mock/home/live-graph.json` git-checkout restored after capture
(EDIT-I2); staged preview patches cleared; baseline worktrees removed.
