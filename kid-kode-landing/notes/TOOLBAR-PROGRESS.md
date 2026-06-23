# PRISM TOOLBAR — Liquid Glass redesign progress

## Wave 1 — Liquid-glass 3D toolbar object  (2026-06-22)
- Architecture: dedicated ISOLATED R3F WebGL <Canvas> (the proven Glb3DPreview pattern;
  never touches the unified three/webgpu graph scene). Replaces the brushed-metal DOM dock
  on desktop/regular; compact (mobile) keeps the metal horizontal dock for phone ergonomics.
- New module: src/components/editor/overlays/liquid-toolbar/
  - LiquidGlassBar.tsx — RoundedBox + drei MeshTransmissionMaterial (transmission=1, ior 1.45,
    chromaticAberration, anisotropy, iridescence 0.65 soap-film, animated distortion +
    temporalDistortion) + an inner luminous core + a multi-axis warp/bend + pointer-follow lean.
  - ToolbarScene.tsx — ortho camera fit-to-canvas, studio key/fill + raking rim spotlights,
    Environment w/ custom Lightformers (glass reflections), iridescent backdrop the glass refracts.
  - ToolButton3D.tsx — sunk 3D token in a machined socket, hover-lift + accent glow, wired to handler.
  - ToolbarTooltips.tsx — DOM glass tooltip beside the rail on hover (Wave 3 polish).
  - config.ts / icons/ — layout math + per-tool jewel palette + icon registry stub.
- Integration: CanvasToolbar.tsx imports LiquidGlassToolbar, hoists handleToggleGroup (function→popup,
  else toggle flyout). Flyouts unchanged.
- VERIFIED: cold load GET / 200; canvas mode mounts toolbar canvas (96x697); ZERO console errors;
  glass reads as luminous dimensional refractive object (not a flat/frosted panel); synthetic click on
  Selection button switched flyout Transform→Selection (functionality preserved). tsc gate: 0 new errors.

## Wave 2 — 3D buttons sunk in + hover-spin + function  (2026-06-22)
- ToolButton3D rebuilt as a photoreal milled MEDALLION: cylinder with 3 material groups
  ([0] knurled metal edge, [1] accent front face w/ emissive, [2] darker back) + a polished
  bezel ring, seated in a recessed socket (torus rim + dark recess floor that receives the
  coin's contact shadow). Canvas shadows enabled; key directional light casts.
- At rest the coin sits BELOW the glass front face (sunk in); hover raises it (HOVER_Z) + glows.
- Hover-spin physics: impulse+friction integrator on rotation.x (HORIZONTAL axis). Hover injects
  ~3.5 end-over-end turns; click injects +2.6 (visibly ACCELERATES); FRICTION 1.35 smoothly
  decelerates; below SETTLE_VEL it eases to the nearest full turn (icon ends upright). dt clamped.
- Dev-only __PRISM_TOOLBAR_SPIN_TEST__ holds all coins at a given X angle for deterministic capture.
- VERIFIED: edge-on(90deg) hold → coins collapse to thin metallic edge slivers (real depth proven);
  three-quarter hold → tilted colored faces + edge band (real tumble); click 'Add' → flyout switched
  to Add tools (function preserved + spin accelerated). 0 console errors. tsc 0 new.
