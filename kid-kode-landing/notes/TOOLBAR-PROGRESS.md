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
