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

| W2 | **P3-2** dramatic exploded view (fix flag #3) | **DONE-pending-final-reverify** | parts fly apart with per-part stagger (crystal first → bezel last) + big Z throws + indices radial fan + explode() auto-orients to 3/4 (yaw 0.6/pitch 0.4); movement/gears exposed at back. Reads UNMISTAKABLY exploded. Frame: w2-exploded-full. Reassembles to whole watch (w2-day). |
| W2 | **P3-3** day/night + lume reveal | **DONE-pending-final-reverify** | __ATELIER_RIG__.night(on?) eases nightAmt; dims env IBL (1.0→0.07) + named shared key/fill/ambient + ramps lume emissive (hands+indices 0→5.5) + dial glow pointLight; watch goes dark, lume markers ignite. Day (w2-day) vs night (w2-night2). Restores shared lights on rig unmount (w2-s1-after-night-restore bright, no leak). transmission=2 (≤2). 0 console errors. |

| W3 | **P3-4** premium micro-response | **DONE-pending-final-reverify** | watch cursor PARALLAX (leans toward pointer → specular sweeps; verified delta 0.096 rad far-left vs far-right) + tactile PRESS (pivot scale 1.0→0.965 on pointerdown→1.0 on up); existing MagneticCursor (snap/grow/press/warm-glow) on all controls still mounted. 0 console errors. |
| W3 | **P3-5** cinematic camera language | **DONE-pending-final-reverify** | preview-app idle camera DRIFT (slow orbit sway + dolly + target parallax around hero pose, eased in, never fights the landing/transition): verified continuous motion x±0.18/y±0.10/z±0.10 over 3.6s on s1. Entrances handled by the P3-1 transition dolly-through. Scene always feels alive. |

| W4 | full verification sweep + COLD-LOAD GATE + advocate | **COMPLETE** | FINAL cold-load PASS (final code; 0 errors, 0 _next 404s, in-canvas transition, no DOM curtain); 6-hub sweep 0 errors; tsc 0 new; prod build ✓ 11.9s; art-fidelity 13/13 PASS; criteria-reviewer MUST-FIX none; user-advocate PLEASED (beats Slider Revolution) MUST-FIX none. Exploded spread deepened per advocate wish (w4-exploded-deeper); strap rest clean (w4-atelier-rest). |

## RUN COMPLETE — ORRERY-PHASE3
All P3-1..P3-5 pass all gates. Phase 1+2 criteria intact. See ORRERY-PHASE3-REPORT.md.
