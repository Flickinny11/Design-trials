# PRISM EDITOR CHROME 1 — The Liquid-Glass Toolbar — RUN REPORT

**Date:** 2026-06-22 · **Branch:** `prism-editor-build` · **Model:** claude-opus-4-8
**Scope:** the canvas-editor TOOLBAR (editor chrome — NOT app-content nodes; the
node-authorship gate does not apply). The flat/tailwind-style brushed-metal dock
has been REPLACED with a photoreal 3D liquid-glass object carrying real 3D
spinning buttons and bespoke animated 3D icons.

---

## 1. What shipped

A new isolated module — `src/components/editor/overlays/liquid-toolbar/` — renders
the desktop toolbar as a **dedicated R3F WebGL `<Canvas>`** (the proven
`Glb3DPreview` pattern; it deliberately never touches the unified `three/webgpu`
graph scene). `CanvasToolbar.tsx` mounts it on desktop/regular and keeps the
machined brushed-metal horizontal dock ONLY for compact/mobile (phone ergonomics).
Both chromes drive the **same `activeGroup` + handlers**, so every editor action
is unchanged.

| File | Role |
|---|---|
| `LiquidGlassToolbar.tsx` | React entry: sized rail, DOM grip spine (reuses existing drag handlers), mounts the Canvas, hosts the tooltip layer. |
| `ToolbarScene.tsx` | R3F scene: ortho camera fit-to-canvas, studio key/fill + raking rim spotlights, `Environment` w/ custom `Lightformer`s, iridescent backdrop the glass refracts, the bar + the 14 buttons. |
| `LiquidGlassBar.tsx` | The toolbar AS a liquid-glass object (below). |
| `ToolButton3D.tsx` | A photoreal milled-coin button sunk in a socket, with hover-spin physics. |
| `icons/kit.tsx` | Shared 3D icon kit (IconRoot idle motion, IconMat, useExtruded, EngravedPlate, IconStateContext). |
| `icons/glyphs.tsx` | The 14 bespoke 3D icons. |
| `icons/index.ts` | id → icon registry. |
| `ToolbarTooltips.tsx` | Hover glass tooltips + persistent labels for the few text buttons. |
| `config.ts` | World layout math + per-tool jewel palette. |

## 2. How the liquid-glass object + warp is built

- **Body:** a `RoundedBox` rendered with drei **`MeshTransmissionMaterial`** — a real
  transmission FBO pass (`transmission=1`, `ior 1.45`, `thickness`,
  `chromaticAberration 0.07`, `anisotropy`, animated `distortion` +
  `temporalDistortion`, `attenuationColor/Distance`), plus **soap-film
  `iridescence` 0.65** (MeshPhysicalMaterial passthrough) and `clearcoat`. This is
  a genuine volumetric, refractive, iridescent glass — NOT a CSS frosted/blur
  panel.
- **Internal volume:** a luminous inner-core slab + an iridescent backdrop plane
  (vivid soap-film radial bands) that the glass refracts, so the body glows with
  colored light instead of reading hollow/black. Custom `Lightformer`s in an
  `Environment` give crisp, controllable highlights; a raking rim spotlight defines
  the silhouette.
- **Warp/bend (DESIGN LAW B.1):** a true **per-frame vertex deformation** — a
  traveling sine along the bar's length displaces X (and a phase-shifted wave
  displaces Z), so the slab visibly **undulates like a ribbon of liquid** and leans
  toward the cursor; on top of that the material's `temporalDistortion` churns the
  refraction every frame and the body breathes. The buttons are separate meshes, so
  the glass flexes over its sunk controls. (Frames `warp-t0/t1` show the
  non-straight, animated silhouette.)

## 3. The 3D buttons + spin

Each button is a **photoreal milled medallion**: a cylinder with three material
groups — `[0]` knurled brushed-metal **edge**, `[1]` accent **front face** (emissive,
glows when lit), `[2]` darker **back** — framed by a polished bezel ring and seated
in a recessed socket (torus rim + dark recess floor that receives the coin's
contact shadow; Canvas `shadows` on, key light casts). At rest the coin sits BELOW
the glass front face (**sunk in**); on hover it rises out and lights.

**Hover-spin physics:** an angular-velocity **impulse + friction integrator** on the
HORIZONTAL (X) axis. Hover injects ~3.5 end-over-end turns; a click injects +2.6
(it visibly **accelerates**); `FRICTION 1.35` **smoothly decelerates** it; below a
settle threshold it eases to the nearest full turn so the icon always ends upright.
The tumble reveals the coin's real depth — verified deterministically: at 90° the
coins collapse to thin metallic **edge slivers** (`w2-edge`, `spin-090`); at
three-quarter they show tilted faces + the edge band (`w2-tq`).

## 4. The bespoke 3D icon set (how each was made)

All 14 are **bespoke 3D objects** — extruded `THREE.Shape`s (beveled) and composed
primitives with emissive-PBR gradient tones, scene shadows and idle motion. **ZERO**
emoji / Lucide / line-drawings / lightning / box / generic glyphs. Authored
procedurally (crisper + fully animatable at UI scale than a generated GLB; the
generators are the right tool for organic app-content objects, not 16px chrome
icons).

| Tool | Icon | Make |
|---|---|---|
| transform | axis move-gizmo | 3 jewel-toned arrows (cyl shaft + cone) + center icosahedron, idle sway |
| selection | corner brackets + gem | 4 extruded L-brackets that breathe + a spinning octahedron |
| add | luminous plus | beveled extruded cross + emissive core, pulse |
| library | layer stack | 3 rounded extruded plates, top one separates (bob) |
| image | framed scene | extruded frame (with hole) + extruded mountain + sun sphere |
| object3d | faceted crystal | flat-shaded icosahedron + wire shell, spin |
| background | ringed planet | glossy gradient sphere + orbiting torus ring |
| changeArtifact | **ENGRAVED** sparkle | 4-point star intaglio + orbiting motes |
| promptEdit | command pill + caret | **REPLACES the banned lightning** — extruded pill + chevron + BLINKING caret bar |
| text | **ENGRAVED** slab-serif 'T' | extruded T cut into the coin |
| animation | play + motion arc | extruded play triangle + torus arc + traveling spark |
| function | node-link | two node spheres + link cylinder + traveling pulse |
| lighting | light bulb | emissive sphere (breathing) + metal screw base |
| build | **ENGRAVED** cog | 8-tooth gear intaglio (with center bore) |

## 5. Tooltips + engraving

- **Tooltips:** textless buttons show a tasteful glass tooltip (accent pip + label)
  on hover, level with the button (`w3-tooltip`).
- **Text buttons:** a FEW carry a persistent inline label — **ADD** and **BUILD**.
- **Engraving:** the engraved subset (changeArtifact, text, build) renders the
  symbol as a real **intaglio** — a shallow recess with the symbol sunk below the
  face; on hover the engraving fills with accent light and the symbol sweeps
  (animated). Photoreal depth + shadow (`w3-engrave`).

## 6. Action-still-fires matrix (14/14 ✓)

Verified by synthetic R3F pointer events on the toolbar canvas + reading resulting
state (all on the running app):

| # | Button | Result |
|---|---|---|
| 1 | transform | opens Transform flyout ✓ |
| 2 | selection | opens Selection flyout ✓ |
| 3 | add | opens Add flyout ✓ |
| 4 | library/Elements | opens Elements flyout ✓ |
| 5 | image | opens Image flyout ✓ |
| 6 | object3d | opens 3D Object flyout ✓ |
| 7 | background | opens Background flyout ✓ |
| 8 | changeArtifact | opens Change Artifact flyout ✓ |
| 9 | promptEdit | opens Prompt Edit flyout ✓ |
| 10 | text | opens Text flyout ✓ |
| 11 | animation | opens Animation flyout ✓ |
| 12 | function | sets `functionPopupNodeId` on the selected node ✓ |
| 13 | lighting | opens Lighting flyout ✓ |
| 14 | build | opens Build flyout ✓ |

(Click also injects the spin impulse, so each press both fires the action AND
accelerates the coin.)

## 7. Before / after

- **Before:** a flat, machined brushed-metal DOM dock ("Chrome-Arc") of 14 ceramic
  key faces with flat `<Icon>` glyphs — the very tailwind/flat style the mandate
  retires. (Retained for compact/mobile only; the original is preserved in
  `CanvasToolbar.tsx.bak-*-toolbar3d`.)
- **After:** a photoreal 3D liquid-glass rail with sunk milled-coin buttons,
  hover-spin, and 14 bespoke animated 3D icons. Frames in
  `notes/verification/toolbar/` (`w1-*`, `w2-*`, `w3-*`, `spin-*`, `warp-*`,
  `capstone-*`).

## 8. Gate verdicts

| Gate | Verdict |
|---|---|
| Cold-load (Chrome DevTools MCP) | **PASS** — `GET / 200`, all `_next` 200, no 404, no pageerror, `<canvas>` present, no stuck loader |
| Console errors (canvas mode) | **0** |
| tsc gate (`typecheck-gate.mjs`) | **PASS — 0 new** (9 vs baseline 10) |
| New dependencies | **none** (only existing three / R3F / drei / gsap) |
| Aesthetic defect gate (self) | **CLEAN** — not flat; real transmission (not glassmorphism); warps/bends; buttons 3D w/ depth on spin; no emoji; no Lucide/lightning/box/generic icons; tooltips present; no grotesque font; all actions fire |
| art-fidelity reviewer | **16 frames · 16 PASS · 0 NEEDS-POLISH** |
| prism-criteria-reviewer | **PASS** — all 5 reqs met, 0 defect-gate hits, 0 MUST-FIX (real transmission glass + vertex warp; 3D button physics; bespoke icons, 0 lucide/emoji/lightning; actions wired; tsc 0 new) |
| user-advocate capstone | **PLEASED** — "a genuine premium 3D liquid-glass object, NOT a flat/tailwind/cheap bar"; edge-on spin proves real depth, warp + bespoke icons cited; 0 MUST-FIX |
| aesthetic vision judge | **PASS** — readsAsLiquidGlass ✓, buttonsAre3D ✓, iconsBespoke ✓, 0 gate violations |

### Reviewer nits (all non-blocking; 2 already addressed in final polish)
- **[FIXED]** chromatic-aberration rim fringe read slightly heavy → softened `0.07 → 0.05`.
- **[FIXED]** the compact/mobile dock's `meta.icon` for promptEdit was still `'zap'` (a flat
  lightning glyph) — changed to `'code'` so there is **no lightning anywhere**, mobile included.
  (The desktop 3D path was already a command-pill; `iconFor` keys on `id`, so the old string was
  dead there.) Removed a dead `attach` param on `IconMat`.
- **[KNOWN]** at full edge-on, the lowest icons briefly streak — a transient motion blur during the
  ~2s spin-down, not a static defect.
- **[KNOWN]** rest rail is a touch dark by taste — intentional (the glass is a substrate; hover
  raises + lights each coin).

## 9. Honest flags

- The DESKTOP toolbar is the 3D liquid-glass object; **compact/mobile keeps the
  brushed-metal horizontal dock** (a phone can't host a 14-coin vertical rail
  ergonomically). This is intentional and documented, not a flat fallback on the
  surface under test.
- Icons are procedural meshes, not generated GLBs — the correct tool for crisp,
  animatable ~16px chrome icons (the Tripo/Replicate generators remain for organic
  app-content objects per the inbox directive).
- A dev-only `__PRISM_TOOLBAR_SPIN_TEST__` hook (holds a coin at a given X angle)
  exists for deterministic spin-phase capture; it is inert unless a test sets it.
- The natural hover-spin is transient; deterministic holds were used to capture
  clean edge-on / back / three-quarter evidence.

---

## 10. Final status

All gates green. The canvas-editor toolbar is now a photorealistic 3D **liquid-glass
object** that warps/bends, carrying real 3D **milled-coin buttons** sunk into the
glass that **spin** end-over-end with physics, fronted by **14 bespoke animated 3D
icons** (engraved subset + tooltips + persistent ADD/BUILD labels) — every action
still fires. Cold load clean, console 0 errors, tsc 0 new, art-fidelity 16/16,
criteria PASS, advocate PLEASED. Zero MUST-FIX.

Checkpoints: `d0f44db0` (wave1) → `53352a2d` (wave2) → `3d49e7cb` (wave3) →
`e5f1e53c` (wave4 warp) → final polish.

PRISM-TOOLBAR: RUN COMPLETE
