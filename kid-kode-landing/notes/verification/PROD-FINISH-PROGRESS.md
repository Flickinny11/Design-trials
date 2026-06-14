# PROD-FINISH — resumable progress ledger

**Run:** Finish App Reality "preview-as-app" to TRUE PRODUCTION quality. Kill the two
frame-confirmed defects (full-viewport atmosphere oval/stipple/flat-corners; Arrival hero watch
absent on desktop/tablet), then prove the whole preview-as-app works visually + functionally
across every hub × every viewport. Self-heal with NO iteration cap until C1–C13 pass.
**Branch:** `prism-editor-build`. **Model:** claude-opus-4-8 (env-confirmed).
**Started:** 2026-06-14.
**Bar:** photoreal / premium 4K motion-graphics. "acceptable"/"passes" == FAIL. WOW + true
production. Constrained preview-pane + desktop matter most; mobile + constrained must be fast.

## Viewports (all phases)
desktop 1440×900 · tablet 1024×768 · constrained 880×600 · mobile 390×844 — all DPR-2.

## Hubs
s1-arrival · s2-movement · s3-materia · s4-celestia · s5-acquire (5 hubs).

## Ground truth (recon — do not re-derive)
- **Defect 1 code:** `HubSceneBackground`/`buildHubSkyGradient` (GraphScene.tsx ~L3200, skybox
  sphere, camera-centered, fills frustum — but vignette floors corners to flat `#2b3550`
  blue-grey); `SceneBackdrop`/`SceneBackdropLayer` (~L1888/L1826, ink "pool" + image layers
  feathered by `getBackdropFalloffTexture` ~L3253 = 256px 8-bit radial alpha → ELLIPSE on wide
  planes + BANDING). Pool sized from hub aspect (width=10), not viewport aspect → doesn't cover
  wide frames.
- **Defect 2 code:** `orr-arrival-watch` (product-hero, mesh watch.glb, base scenePos y=-1.45
  scale 2.2; responsiveScenePos has mobile{y:0.2,scale:0.6}+tablet{y:-0.55,scale:0.85} but NO
  desktop entry → desktop uses base). Camera reframe GraphScene ~L1601-1609: looks at (0,0,0),
  z = mobile 11 / tablet 12.5 / desktop 14. deviceMode auto-pick page.tsx L171:
  <640 mobile / <1024 tablet / else desktop.
- Stores: `useGraphEditorStore` (deviceMode, viewMode, activeHubId), `useGraphSourceStore`
  (source nodes/hubs). Dev hooks: `__PRISM_DEBUG_STORES__`, `__PRISM_EDITOR_GET_NODE_WORLD_POS__`,
  `__PRISM_EDITOR_NODE_GROUPS__`, `__PRISM_EDITOR_SET_VIEW_MODE__`.
- Harness: Playwright. `scripts/app-reality/p9-appfeel.mjs` (mobile+constrained capture pattern)
  + `scripts/verify-editor-runtimes.mjs`. node via nvm: `/Users/loganbaird/.nvm/versions/node/v24.15.0/bin`.
- DESIGN-REFERENCES.md required toolkit. No purple. Observatory-Brass. One renderer (Three r184 TSL WebGPU).

## Acceptance criteria (C1–C13 — all must pass; capstone 0 MUST-FIX)
- C1 atmosphere fills edge-to-edge every hub × every viewport (no centered pool)
- C2 no elliptical mask edge on any landscape viewport
- C3 smooth feather (no banding/stipple) + atmospheric corners (no flat plateau / contrast cliff)
- C4 every hub hero present + correctly placed every viewport (no empty-atmosphere+text hub)
- C5 Arrival watch present + well-lit on desktop + tablet (+ mobile retained)
- C6 hub→hub nav works (rail + prev/next + hash; content changes; no blank hub)
- C7 function-bound click → premium holographic overlay (real raycast)
- C8 device-mode switch (auto + manual) = real responsive layout
- C9 preview camera LOCKED (drag = zero move) + configured view + P2 journey plays
- C10 edit-in-preview (toggle/select/edit) works
- C11 0 console errors everywhere
- C12 no regressions: tsc 0-new; vitest baseline; primitives ≥409; prebuilt elements ≥40
- C13 capstone advocate confirms (a) no oval/seam/flat/stipple landscape, (b) hero present+lit
  every hub×viewport, (c) premium + intuitive + production-ready. 0 MUST-FIX.

## Phase status
| Phase | Title | Status | Checkpoint |
|---|---|---|---|
| BASE | Stand up app + capture baseline evidence (confirm both diagnoses) | DONE ✅ | (this commit) |
| A | Full-viewport atmosphere (kill oval/stipple/flat-corners) [C1–C3] | DONE ✅ | (this commit) |
| B | Hero present + lit every hub×viewport (Arrival watch desktop/tablet) [C4–C5] | DONE ✅ | (this commit) |
| C | Production functional validation + capstone [C6–C13] | TODO | — |

## BASE findings (evidence-confirmed; baseline frames in prod-finish/baseline/)
- **Defect 1 CONFIRMED.** atmosphere.mjs baseline = 0/20. Landscape (desktop/tablet/constrained)
  = dark central OVAL on flat medium-grey corners: minCornerStd ~0.03–0.27 (FLAT plateau),
  cornerSpread ~34–40 (uneven bright halo), cornerHalo +24..+43, maxCorner luma ~64–71. MOBILE is
  the GOOD reference (textured std ~3.3, uniform spread ~5.6, dark corners ~35). Root cause: pool
  feathered by a radial alpha (ellipse on wide planes) sized to hub aspect (≠ viewport) + skybox
  vignette floors corners to a flat blue-grey; pool dark vs skybox grey = visible oval.
- **Defect 2 CONFIRMED.** heroes.mjs hide-diff baseline = 17/20. All heroes genuinely drawn + lit
  (peak ~255) but: (a) s5-acquire watch too SMALL on landscape (coverage 0.0044–0.0058 < gate);
  (b) heroes under-scaled on desktop generally (camera z=14 fov45 → composition fills only ~34% of
  frame height); (c) hero GLBs are 2–4 MB and load async ~3s with NO preload → "absent on first
  look" race (arrival watch invisible at 2.6s, present at 3.8s). Only s1-arrival has
  responsiveScenePos; other hubs author content near y=0 (visible) so they read fine.
- Added reliable dev hook `__PRISM_EDITOR_GET_NODE_SCREEN_RECT__` (GraphScene AssembledSceneDiagnostics,
  editor-shell/FP-05 safe) — projects a node's bbox to normalized screen space (inFrustum+coverage).
- tsc baseline-diff gate: 0 new errors. Dev server: port 4799.

## fal ledger
`notes/verification/app-reality/fal-ledger.json` (cumulative; strongly prefer procedural — no fal expected).

## Resume protocol
1. Re-confirm model == claude-opus-4-8.
2. Read this file + `notes/PROD-FINISH-REPORT.md`.
3. `git status`; if a phase is half-applied, finish/repair before moving on.
4. Pick first non-DONE phase; continue. Kill stray dev servers / browsers at each boundary.
5. Poll `notes/LOGAN-INBOX.md` at each phase boundary.
