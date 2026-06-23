# PRISM TOOLBAR V2 — progress ledger

REDO against `docs/prism/PRISM-EDITOR-CHROME-SPEC.md`: every FORM (toolbar shell,
each button, each icon) must be a GENERATED photoreal 3D GLB on disk; the prior
run's procedural forms are discarded. Behaviors (liquid-glass material, warp,
hover-spin, tooltips, action wiring) layer on top of the generated GLBs.

Scope: TOOLBAR only (§0 D1-D7, §1 TB-1..9, §2 IC-1..5, §6 gen, §7 verify). Node
editor (§3) + keyframe editor (§4) DEFERRED to later founder-scoped runs.

---

## Wave 1 — generate the forms (GLBs on disk) ✅ pending-reverify
- Found a partial prior V2 generation already on disk (sentinel run, interrupted):
  29 Tripo v3.1 GLBs but at **~44MB / 1.46M tris each** (Tripo ignored face_limit)
  and the **shell was a hollow ring** (text prompt misread).
- Triage-rendered via new `/glb-lab` QA route (isolated R3F WebGL canvas, Glb3DPreview
  rig): icons = premium + colored + on-concept (RGB-arrow gizmo, rose-gold frame+mountain,
  amethyst-bracket select, etc.); buttons = coherent machined-metal medallion family; shell = WRONG.
- **Regenerated the shell** (Tripo v3.1, corrected "solid smooth rounded rail, no hole" prompt)
  → a solid polished lozenge column (correct liquid-glass rail form).
- Built `.assetgen/optimize-glb.mjs` (gltf-transform weld→simplify[meshoptimizer]→dedup→prune
  + sharp texture downsize → **plain uncompressed GLB**, since no DRACO/meshopt decoder is wired
  in the app runtime). Optimized all 29:
  - buttons: ~42MB/1.46M tris → ~0.8MB/24k tris (768px tex)
  - icons:   ~40MB/1.46M tris → ~0.75MB/24k tris (512px tex)
  - shell:   2.4MB/9.5k tris → 0.29MB (1024px tex)
- Shipped set: **29 GLBs, 22MB total** in `public/prism-mock/editor/meshes/`, all plain GLB
  (extensionsUsed []), all load + render premium (icon grid + button grid frames captured).
- tsc gate green (0 new). Evidence frames in `notes/verification/toolbar-v2/`.

## Wave 2 — mount generated forms + behaviors — PENDING
## Wave 3 — tooltips + engraving + polish — PENDING
## Wave 4 — per-row checklist verification + report — PENDING

## Wave 2 — mount generated forms + behaviors ✅ pending-reverify
- New glb.tsx: useShellGeometry (shell GLB → rail-fit geometry for the warp+glass)
  + useToolGlb (clone + clone materials + auto-orient disc-normal→+Z + scale-to-fit).
- LiquidGlassBar renders the GENERATED shell geometry under MeshTransmissionMaterial + warp.
- ToolButton3D mounts btn-<id>.glb (kept baked metal) sunk in glass + hover-spin on X;
  IconGlb mounts ic-<id>.glb (baseColor→emissive for vivid colored glow).
- Deleted orphaned procedural glyphs.tsx + icons/index.ts.
- All 29 GLBs load in-app (perf.resource confirmed), 0 console errors, tsc 0-new.
- Edge-on spin-hold capture confirms coins reveal real 3D depth.

## Wave 3 — tooltips + engraving + legibility polish ✅ pending-reverify
- Calmed the glass (warp bendAmp 0.07→0.035, temporalDistortion 0.18→0.06,
  distortion 0.28→0.12, core opacity 0.5→0.32) + raised idle coins (REST_Z) so the
  sunk generated icons read clearly through the glass — every icon now legible in its socket.
- Tooltips verified: hovering a textless button shows its glass tooltip ("Background", opacity 1).
- Text buttons: ADD + BUILD carry persistent inline labels.
- Engraving (TB-8): changeArtifact/text/build present their icon GLB as an intaglio
  (recessed well + cut-metal re-material) that glows + sweeps on hover.
- Action fires verified: click selection → flyout switched Transform→Selection.
- tsc 0-new, 0 console errors.

## Wave 4 — verification + report — IN PROGRESS
