# ORRERY No.7 — PHASE 2 REPORT (Full photorealistic 3D scene)

Branch `prism-editor-build` · model **claude-opus-4-8** (1M ctx) · 2026-06-22
App: `kid-kode-landing/` · Graph: `public/prism-mock/home/live-graph.json`

Phase 2 elevated the whole prototype into a full photorealistic 3D scene and closed
Phase 1's two gaps: the procedural-PBR watch parts are now **real generated GLBs**,
and the repo's under-used premium primitives (volumetric nebula, godray, curtain,
Rapier) are wired in heavily. All work verified against the running app via the
Chrome DevTools MCP (functional + vision), the art-fidelity reviewer, a fresh-context
prism-criteria-reviewer, and the user-advocate capstone, plus a clean COLD-LOAD GATE.

---

## VERDICT: RUN COMPLETE — all P2 + targeted SC-V criteria pass all gates

### P2 criteria (the Phase-2 mandate)
| Criterion | Verdict | Evidence |
|---|---|---|
| **P2-1** case + ≥2 hard parts = real generated GLBs | **PASS** | Tripo v3.1 image→3D: `case-gen.glb`/`bezel-gen.glb`/`crown-gen.glb` on disk (PBR base+MR+normal, ~4.7k tris); loaded via useGLTF in `AtelierWatchRig.tsx`; in-scene render `w1-case-headon.jpeg`; network 200; 8 generated meshes in scene |
| **P2-2** living photoreal 3D background (volumetric nebula) | **PASS** | volumetric-nebula + particle stacks on ALL 6 hubs (`live-graph` hubs[].background); renders `png/atelier.png`, `png/celestia-orrery.png`, `w2-atelier-nebula.jpeg`; drift/motion live |
| **P2-3** ≥3 dimensional chrome (transmission/refraction/godray) | **PASS** | volumetric godray shaft (repo `godrayPrimitive`) + transmission sapphire crystal + frosted glass plaque + dimensional brass header/footer/nav + 3D extruded titles + milled controls |
| **P2-4** ≥1 morphing 3D transition (Curtains/through-page) | **PASS** | Curtains-style brass curtain morph (CSS 3D rotateY hinge + backdrop refraction) plays close→hold→open on every hub nav (opacity 0→1→0 verified live); closed frame `w4-curtain-manual-closed.jpeg` |
| **P2-5** Rapier physics visible in drag-assemble / morph | **PASS** | drag chip is a real Rapier rigid body w/ angular momentum (tumbles); cyan-over-watch `w3-rapier-chip2.jpeg`; settle applies finish (case→rose-gold rev4); `__ATELIER_RAPIER_READY__` true |

### SC-V signature criteria (orrery complication)
| Criterion | Verdict | Evidence |
|---|---|---|
| **SC-V-O1** 3D orrery with orbiting bodies (not flat) | **PASS** | `OrreryComplicationRig` on Celestia: emissive sun + 4 PBR planets on tilted 3D rings, real depth (planets pass behind sun); `png/celestia-orrery.png`, `w4-orrery.jpeg` |
| **SC-V-O2** responds to a time/date control | **PASS** | `window.__ORRERY__` (setTime/setSpeed/scrub) + drag-to-scrub; planets reposition along orbits between t0 and t14 (`w4-orrery.jpeg` vs `w4-orrery-t14.jpeg`) |
| **SC-V-O3** orrery motif recurs elsewhere | **PASS** | Atelier watch dial = "Orrery Celestial" complication art + spinning armillary gear |

### Phase-1 non-regression (SC-V-A1..A8): **PASS** (criteria-reviewer confirmed)
Drag-assemble, finish swaps (case/bezel/dial/hands all swap live on the GLB parts),
orbit/loupe, caseback-flip-to-moving-movement, exploded view, live price, save —
all intact after the procedural→GLB swap.

---

## GATES
| Gate | Result |
|---|---|
| **COLD-LOAD GATE** (fresh server, pure cold load, no force-load) | **PASS** — canvas 1440×809, WebGPU, 43 scene children, not stuck on loader, **0 `_next` chunk 404s, 0 console errors/pageerrors** (3 benign warnings only) |
| In-scope console errors (all 6 hubs) | **0** |
| Transmission budget (`__PRISM_TRANSMISSION_COUNT__`) | **1** (≤2 ✓) |
| tsc gate (`scripts/typecheck-gate.mjs`) | **PASS** — 0 new (9 vs baseline 10) |
| Prod build (`npm run build`) | **PASS** — compiled 11.5s, 19/19 static pages |
| vitest | 7 fail / 3377 pass — **all 7 pre-existing** (editor-build contract tests present at Phase-1 baseline; my GraphScene diff is +1 import/+1 mount, additive) |
| art-fidelity reviewer | **3/3 PASS** (arrival/atelier/celestia-orrery within quality bar, 96-99% coverage) |
| prism-criteria-reviewer (fresh context) | **PASS** — every criterion PASS, clean forbidden-pattern sweep, **no MUST-FIX** |
| user-advocate (capstone) | **PLEASED** — "beats Slider Revolution = YES", "premium photoreal 3D = YES", **no MUST-FIX** |

---

## ASSET GENERATION (Tripo funded — 2500 balance)
- `.assetgen/tripo.py` — Tripo v2 openapi client (upload → image_to_model v3.1/P1-20260311 → poll → download PBR GLB).
- Generated case/bezel/crown via FLUX.2 concept image → Tripo image→3D (clean photoreal PBR, ~4.7k tris each — vs the old 37 MB TRELLIS bloat). Keys stayed in `.assetgen/`, never committed.

## HONEST FLAGS (non-blocking — advocate FLAGs, no MUST-FIX)
1. **Subtitle legibility on secondary hubs** — RESOLVED this run: the wave2 nebula brightening washed out subtitle copy; dampened nebula env + raised plate veils on s2/s3/s5 → subtitles now read (`w5-s2-fixed.jpeg`, `w5-s3-fixed.jpeg`). A faint heading/subtitle vertical overlap on Movement remains (pre-existing float layout, minor).
2. **Acquire ghost-text** near the CHF price reads as a faint double-render (pre-existing layout; minor).
3. **Exploded view** separates the dial/crystal/movement but is subtle; doesn't dramatically read as "exploded" (mechanic eased + intact, not a regression).
4. **Curtain transition** is an editor DOM-overlay morph (z-45), not an in-WebGPU-scene morph; an in-canvas curtain-wave plane was attempted but the preview render pipeline didn't composite the camera-followed plane — the DOM curtain is the shipped, verified path.
5. **Capture-timing**: the live curtain + the Rapier chip are transient (~1s / mid-drag); single screenshots can miss the peak frame. Both verified functionally (curtain opacity curve 0→1→0; chip position + applied finish).

## KEY FILES
- `src/components/atelier/AtelierWatchRig.tsx` — generated GLB case/bezel/crown + godray shaft
- `src/components/atelier/OrreryComplicationRig.tsx` — interactive 3D orrery
- `src/lib/prism/atelier/physics.ts` + `AtelierDragController.tsx` — Rapier tumble
- `src/components/editor/overlays/HubMorphTransition.tsx` + `design-system/materials.css` — curtain morph
- `public/prism-mock/home/live-graph.json` — per-hub volumetric nebula
- `public/prism-mock/orrery/meshes/atelier/{case,bezel,crown}-gen.glb` — generated parts

Frames: `notes/verification/phase2/` (1440px) + `notes/verification/phase2/png/`.

---

ORRERY-PHASE2: RUN COMPLETE
