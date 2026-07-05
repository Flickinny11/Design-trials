# P2 — Premium Chrome Foundation — CONTRACT (contract-first)

Heart of the DESIGN LAW: our own chrome must be the best ad for what Prism builds.
**REUSE the chrome-layer** (`useChromeSlab` + `ChromeSlabLayer` + TSL `material.ts`) — never reinvent.
From `../P0/ARCHITECTURE-MAP.md` §P2/P3.

## Decomposition
- **C9 Inspector↔Canvas decouple** — `ColorPicker`/`MaterialTab`/`VisualPreview` are imported ONLY by
  Inspector; canvas color/material/visual editing breaks without it (toolbar `ObjectFlyout` delegates
  via `openInspector('material')`). Extract to shared editors mounted by BOTH the CanvasToolbar
  flyouts and the Inspector. **This is where the deferred P1 C8-A orphan-color reroute + Wave-3
  NE-SC-14 (retire VisualPreview regen-api 2nd path) land** — fix them together with the decouple.
- **C10 floating/movable/animated toolbar** — `CanvasToolbar` is static-docked, no drag, dock doesn't
  animate (only flyouts toggle). Add position state + pointer-drag on the dock root + an animated
  (GSAP/Theatre) expand/collapse. Static = FAIL.
- **C11/C12 chrome material uplift** — every toolbar/panel/window/flyout/button: photoreal 3D depth,
  beveled lit edges, scene-sampling refraction, ambient+key/fill/rim, OKLCH gradients, semi-
  translucency, cast + contact/AO shadows. **C12 hero button: DONE (see HERO-EVIDENCE.md).**
- **Forbidden-aesthetic cleanup** — kill the two `backdrop-filter` glassmorphism surfaces:
  `HolographicDetailCard.tsx:158` and `PrismHost.tsx:418`. (NOTE: `page.tsx` mounts only GraphScene,
  so PrismHost may be unmounted/dead in the current app — verify before investing; HolographicDetailCard
  shows on global-element detail-card clicks in preview.)
- **C13 performance** — 60fps desktop / ≥30fps constrained, <50ms latency, tier-gated; chrome slab
  layer is capacity-64-per-family (no growth path) — watch the cap if adding many slabs.

## Done this pass
- **C12 hero button** — extended the chrome-layer with a `hero`/`heroDepthPx` option + a gated
  in-shader extrusion path (size-relative chamfer, steep wall normal, form-following brass emissive,
  brighter lit chamfer) + a draw-`order` fix so the key sits over the masthead rail. The primary Add
  Node CTA now reads as a raised, lit 3D brass key (was a flat slab occluded by the rail). Verified
  in real app; fixed the pre-existing TopBar `hero` tsc error (baseline 10→9). Evidence: HERO-EVIDENCE.md.

## Invariants / forbidden
- One renderer (the GraphScene WebGPU canvas). No `backdrop-filter`/glassmorphism, no Tailwind-faked
  look, no flat fills, no single-drop-shadow fake depth, no purple. Hero/material changes gated so the
  existing ~24 slabs stay byte-identical. tsc 0-new (baseline **9**). Real-frame verification (DPR-2
  advocate at P10).
