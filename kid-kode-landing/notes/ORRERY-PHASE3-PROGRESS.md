# ORRERY No.7 — PHASE 3 PROGRESS (cinematic motion layer)

Branch `prism-editor-build` · model **claude-opus-4-8** (1M ctx) · 2026-06-22
Run-start COLD-LOAD GATE: PASS (canvas 1440x809, webgpu, 0 errors, 0 _next 404s).

| Wave | Target | Status | Evidence |
|---|---|---|---|
| W1 | **P3-1** true in-3D-scene cinematic hub transition (fix flag #4) | **DONE-pending-final-reverify** | in-canvas brass curtain (camera-parented TSL quad, `inCanvas=true`, NO DOM `.ds-hub-morph-stage`); cover trace 0→1→0; swap gated to peak cover (atelier 102-node ~6s mount stall held fully covered); camera dolly-through z 10.5→14.87→10.5; 0 console errors. Frames: w1-curtain-cover{30,60,100b}, w1-atelier-after-transition, w1-live-transition-A |

## P3-1 root-cause + fix (flag #4)
Phase-2 in-canvas curtain "rendered but never covered the viewport" = frustum-culled, scene-ROOTED position-follower. Fix = camera-PARENTED quad (ChromeSlabLayer idiom: `if(camera.parent==null) scene.add(camera); camera.add(group)`), `frustumCulled=false`, renderOrder 9500, depthTest/Write=false, toneMapped=false, TSL brass-curtain material. Gated state machine (close→commit-at-peak→hold→open) solves the main-thread-stall-freeze the DOM overlay was a workaround for. Camera dolly-through in SceneControlsBridge (pull back on token, landing eases in on commit). DOM HubMorphTransition retired.

New files: `src/stores/useHubTransitionStore.ts`, `src/components/editor/transition/HubSceneTransition.tsx`.
Touched: GraphScene.tsx (mount + dolly + nav route), page.tsx (nav route + DOM curtain removed), PreviewHubNav.tsx (nav route).
