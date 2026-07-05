# SHELL W8 — Evidence Manifest (captured off the real Metal GPU via Chrome DevTools MCP)

All frames are real WebGPU renders of the shipped preview route
(`/templates/<slug>`), which runs each template's real `.prism` GraphSource in
the Prism runtime (`ConductorRuntime` → `mountFromGraphSource`), at 1440×900.

## Rendered frames (final — all text clean 3D-extruded, verified MeshPhysicalNodeMaterial)
- `hero-final.jpeg` — Template (a) **Aperture / Kinetic Scroll Hero**. Bright
  extruded-gold "Time, Reimagined." headline (Playfair, 3D bevelled), clean
  subhead + tagline, photoreal material backdrop, hero watch (GLB), floating
  brass + sapphire macro plates (inset). Brass-ring cursor. E10 dissolve.
- `gallery-final.jpeg` — Template (b) **Atlas / Cursor Gallery**. Bright
  "MATERIA, a study in surfaces" title, 3×2 grid of photoreal macro-material
  tiles, atmospheric backdrop, "Move the cursor. The surfaces answer." footer
  fully in-frame. Beam custom cursor. E10 veil.
- `showpiece-final.jpeg` — Template (c) **Nova / Particle Showpiece**. Bright
  "Particles, on command." headline + subhead, layered galaxy+nebula+firefly
  fields, cursor attract/repel constellation rings, halo cursor. E10 glass-sweep.

## Text-render root-cause fix (advocate MF-1, resolved)
The garbled red-dust text row (advocate MF-1) was the factory's 3D-text path
falling back to the flat-MSDF atlas — which does not bind reliably in
ConductorRuntime — when the extruded-outline cache was cold OR a glyph (`·`,
`—`) was missing from the outline set. Fixed by (a) pre-warming the outline
cache for every text node's chars before mount (`warmTemplateOutlines` in
ConductorRuntime) so the extrude path resolves synchronously, and (b) removing
`·`/`—` from template copy. All text nodes now confirmed
`MeshPhysicalNodeMaterial` (real extruded 3D, never the flat fallback):
headline/subhead/tagline on the hero, title on the gallery, headline on Nova.

## Measured reactivity (probed via `window.__prismPreviewDrivers`, real driver hub)
- **E8 scroll scrub (hero):** driving scroll 0 → 0.9 rotated the brass plate's
  mesh from `rotation.x 0.61` → `-0.49` (a live scroll-scrubbed transform). Frame
  ticker ran 884 ticks / ~1.5 s; `frameSize` = 4 stateful onTicks registered;
  scroll fed to the shared hub + per-node `setScrollProgress`.
- **E9 cursor field (showpiece):** moving the pointer from (-0.7, 0.5) to
  (0.7, -0.5) moved the attract/repel field's particles from
  `[-0.384, -0.706]` → `[-0.157, -0.757]` (`particlesReactToCursor: true`).
  Frame ticker ran 3930 ticks; custom cursor mounted (`data-cursor-style="halo"`).
- **E9 custom cursor:** `[data-component="custom-cursor-layer"]` mounts on every
  template with the authored style (ring / beam / halo), window-pointer driven,
  a11y-safe (augments OS cursor).
- **Bindings attached in the shipped preview:** each node's `animationBindings`
  play in `ConductorRuntime` (parallax/scroll-rotate-3d/pointer-tilt-3d/
  scroll-zoom/float/particle fields observed as live binding players).
- **Console:** 0 errors on all three template routes (only THREE deprecation +
  webpack critical-dependency warnings, pre-existing).

## What proves "a real app, not a slide"
Each template is a live `.prism` graph editable in the canvas + node editors,
running the same runtime the user's shipped app uses, reacting to real scroll +
pointer input (measured above), with a config-driven custom cursor and a
one-click scene transition. SR templates are pre-baked slider timelines; these
respond continuously to the visitor and are forkable ("Remix") into an account
as an editable running app.
