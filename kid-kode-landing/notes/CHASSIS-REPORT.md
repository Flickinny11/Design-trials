# PRISM TOOLBAR CHASSIS — founder-refinement run report

**Route:** `/toolbar-chassis` (isolated R3F WebGL `<Canvas>`, the proven Glb3DPreview
idiom — never touches the unified `three/webgpu` graph scene). The production toolbar
was NOT modified. Branch `prism-editor-build`.

Built on the committed foundation (`AUTO-CKPT: CHASSIS w1`) — the locked chassis is
kept exactly: thick extruded-rounded-rect glass pane with real thickness, a milled
rounded-rect cutout per button, rounded-cornered cubes seated in the cutouts, hover
spin (end-over-end on local X, easeInOutCubic) with see-through, `MeshPhysicalMaterial`
transmission glass + real studio environment map, AgX tone mapping, sRGB, soft shadows,
editorial dark backdrop.

This run applied the founder's four refinements on top.

---

## 1. Worn material (Iron-Man-armor finish) — refinement #1

The cubes are now **real worn metal** via a full generated PBR set, applied in the
metallic workflow — NOT a glossy plastic shader.

- **Source plates:** FLUX.2 [pro] (Replicate), prompted for *seamless allover worn
  brushed metal* — dense criss-cross micro-scratches, fine brushed grain, satin sheen,
  subtle patina, edge wear — explicitly **no bolts / no rivets / no panel seams** (the
  first pass produced gorgeous but non-tileable "hero panels" whose clean centres mapped
  onto the small cube faces; regenerated as a uniform allover finish).
- **Derivation:** `.assetgen/derive-chassis-worn.mjs` (sharp). Bakes the exact section
  jewel-tone into the albedo (`tint · (0.5 + 0.7·luminance)` so the worn structure
  modulates brightness), then derives a tangent-space **normal** (brushed-grain +
  scratch relief), a satin **roughness** (`[0.26..0.62]`, bright→glossier), a high
  **metalness** (`[0.80..1.0]` refined alloy), and a faint **AO**.
- **Material** (`materials.ts` → `applyWornMaterial`): metallic workflow, `metalnessMap`
  + `roughnessMap` (so the satin range reads), `normalScale 1.15`, `aoMap` (uv1 mirrored
  onto the RoundedBox geometry), thin worn clearcoat (`0.12 / 0.6` — a whisper of satin,
  not wet candy), faint anisotropy `0.4` along the grain, `envMapIntensity 1.1`. Maps use
  `RepeatWrapping ×1.5` so each small face shows dense grain.
- **Lit so the texture shows:** added a low front-raking light to rake the brushed grain
  across the cube faces, alongside the warm key / cool fill / spot rims.

Evidence: `final-02-worn-closeup.jpg` (aged-bronze cube — brushed grain + patina +
engraved glyph), `final-04-engraved-labels.jpg` (bronze cubes catching light).

### Generated worn-PBR maps (5 sets × 5 maps = 25; 512² PNG, 7.1 MB total)
Path: `kid-kode-landing/public/prism-mock/editor/textures/chassis-worn/`

| Section key | albedo | normal | rough | metal | ao |
|---|---|---|---|---|---|
| emerald  | `emerald-albedo.png`  | `emerald-normal.png`  | `emerald-rough.png`  | `emerald-metal.png`  | `emerald-ao.png`  |
| sapphire | `sapphire-albedo.png` | `sapphire-normal.png` | `sapphire-rough.png` | `sapphire-metal.png` | `sapphire-ao.png` |
| bronze   | `bronze-albedo.png`   | `bronze-normal.png`   | `bronze-rough.png`   | `bronze-metal.png`   | `bronze-ao.png`   |
| oxblood  | `oxblood-albedo.png`  | `oxblood-normal.png`  | `oxblood-rough.png`  | `oxblood-metal.png`  | `oxblood-ao.png`  |
| gunmetal | `gunmetal-albedo.png` | `gunmetal-normal.png` | `gunmetal-rough.png` | `gunmetal-metal.png` | `gunmetal-ao.png` |

Generators (in the gitignored `.assetgen/` workspace, where the keys live):
`gen-chassis-worn.sh` (parallel FLUX.2) → `derive-chassis-worn.mjs` (tint-bake + derive).

---

## 2 + 3. A few rich colors, grouped by function, in labeled grid sections — refinements #2, #3

The **real canvas-editor toolbar** (`src/components/editor/overlays/CanvasToolbar.tsx`)
exposes **14 top-level functions**. All 14 are grouped into **5 logical categories**, each
with **ONE** curated jewel-tone-metallic color that tints its worn-alloy plate. (The real
toolbar has 14 top-level functions, not ~20 — every one is represented faithfully rather
than padded with invented buttons.)

| Section (engraved label) | Color | Functions (grid) |
|---|---|---|
| **CREATE**    | deep emerald `#2f9e74`        | Add · Elements · Image · 3D Object · Text (3×2, 5) |
| **TRANSFORM** | deep sapphire `#3f6fd6`       | Transform · Selection (1×2) |
| **SCENE**     | aged bronze/amber `#b07a36`   | Background · Lighting (1×2) |
| **LOGIC**     | deep maroon/oxblood `#9c3447` | Prompt Edit · Change Artifact · Animation · Function (2×2) |
| **OUTPUT**    | gunmetal `#6b727c`            | Build (1×1) |

The pane is laid out left→right as five labeled grid sections (rows × columns per section,
short sections vertically centered in a common grid band), sized to fit cleanly
(`chassis-config.ts → buildLayout()` computes every cutout + label position and the pane
dimensions; pane ≈ 13.5 × 3.55 world units). Each cube also carries a small **abstract
engraved face glyph** (built from primitive bars/rings/dots — no emoji / Lucide / icon
font) so each function has its own identity.

Evidence: `final-01-overview.jpg`.

---

## 4. Section labels engraved into the glass — refinement #4

Each section name is **engraved into the glass panel itself**, entirely in-engine
(`EngravedLabel.tsx`, Troika SDF text via drei `<Text>` — **NOT DOM, NOT drei `<Html>`,
NOT an overlay**). Technique:

- The glyphs render **opaque + alpha-tested** (the key fix: *transparent* text behind the
  transmission pane is not captured by the glass's transmission pass and renders invisibly;
  opaque alpha-tested glyphs are captured and read).
- Recessed-engraving look: a **dark groove-shadow** copy offset up-and-deeper (the shadowed
  top wall of a groove lit from above) behind a **bright frosted etch** copy offset down and
  just proud of the front face (the lit bottom wall) — so the type reads as cut into the
  glass and **catches light**. Local font `/fonts/Inter-Variable.ttf`, letterspaced caps.

Evidence: `final-01-overview.jpg`, `final-04-engraved-labels.jpg`.

### Mechanic + tooltips (kept/added)
- **Hover spin + see-through** preserved across all 14 cubes (`CubeButton.tsx`): on hover the
  cube eases through whole turns (easeInOutCubic, ~3.5→4 turns, landing front-forward so the
  face glyph stays upright) and the gap between the small cube and its larger cutout reveals
  the backdrop. Dev hooks `__PRISM_CHASSIS_SPIN__(0..1|null)` / `__PRISM_CHASSIS_HOVER__(id)`
  drive deterministic capture. Evidence: `final-03-spin-seethrough.jpg`.
- **In-canvas hover tooltip** (`Tooltip.tsx`): Troika text on a dark rounded plate,
  billboarded to face the camera, floating in front of the glass above the cube — fully
  in-engine. Evidence: `final-05-tooltip.jpg`.

---

## The gate — `scripts/no-dom-ui-gate.mjs` (npm: `gate:no-dom-ui`)

Scans the editor-chrome chassis surface and FAILS (non-zero) on any Tailwind class /
styling `className` / inline `style={` / `*.module.css` import / `tailwindcss` import /
drei `<Html>` import-or-usage, plus `@tailwind`/`@apply` directives or class selectors in
any CSS in scope. Prose comments are stripped before scanning so mentions like "NOT drei
`<Html>`" don't false-trip.

**Coverage:** the toolbar-chassis editor chrome —
`src/components/editor/chassis/**` + `src/app/toolbar-chassis/**`. Landing/marketing pages
and the legacy compact/mobile DOM dock are deliberately out of scope. The single permitted
stylesheet is the route's global stage-sizer (`chassis.css`), which sizes the WebGL mount
via element/attribute selectors only (no class selectors, no Tailwind, no UI).

```
[no-dom-ui-gate] scope: src/components/editor/chassis, src/app/toolbar-chassis
[no-dom-ui-gate] scanned 12 file(s)
[no-dom-ui-gate] PASS — chassis chrome is pure in-engine (no Tailwind/CSS-module/className/inline-style/drei-Html).
```

---

## Verification (founder review = the judge)

- **Cold-load gate** (fresh `next dev`, `.next` cleared) via chrome-devtools MCP at
  `/toolbar-chassis?spin=0`: all 38 requests **200/304 — zero `_next` 404s** (font + 25
  worn textures + studio env all loaded); **0 console errors**; `<canvas>` present
  (1512×809); scene probe: 78 meshes, 1 transmission-glass mesh, 14 worn cubes, 10
  engraved-label meshes; **0 DOM text in `<body>`** (no stuck loader, everything in-canvas).
- **no-dom-ui-gate:** PASS (output above).
- **tsc:** `tsc --noEmit` → 9 total errors, **all pre-existing baseline** (GraphScene GLProps
  + 8 test files missing `THREE` on `NodeContext`); **0 in chassis scope → 0 new**.
- **Frames** (`notes/verification/toolbar-final/`, JPEG ≤1300px):
  - `final-01-overview.jpg` — full toolbar: 5 labeled grid sections, grouped colors,
    engraved labels, worn cubes, thick glass.
  - `final-02-worn-closeup.jpg` — worn aged-bronze cube hero close-up (brushed grain +
    patina + engraved glyph + glass-cutout refraction).
  - `final-03-spin-seethrough.jpg` — emerald cubes mid-spin, tilted, see-through gaps.
  - `final-04-engraved-labels.jpg` — engraved labels catching light (angled).
  - `final-05-tooltip.jpg` — in-canvas hover tooltip ("Animation").

---

## Honest flags

- **Function count:** the real toolbar has **14** top-level functions, not ~20. All 14 are
  represented faithfully; no fabricated buttons were added to hit a round number. CREATE is a
  5-cube section laid out as a 3×2 grid (last row centered).
- **See-through is inherently the cutout margin**, not a full-hole reveal: the locked form is a
  *cube* (always ≥ its side in both screen axes), so as it spins you see the backdrop through
  the gap between the cube and its larger cutout, most at face-on and least near the diagonal.
  The drama is the motion; the still frame at ~45° shows the tilt + the gaps.
- **Studio softbox hotspot:** the real environment map reflects a bright softbox that can wash
  the centre labels slightly head-on (`final-01`); it reads cleanly from any off-axis angle
  (`final-04`). Kept because it's the approved photoreal studio look; easy to dim later.
- **Material reads worn at close/medium range;** at full-overview distance the small cubes read
  as solid jewel-tone alloy (the grain is sub-pixel) — expected, and why the worn-material
  close-up is part of the review set.
- All visible elements (pane, cubes, face glyphs, engraved labels, tooltips) are in the
  `<canvas>`. Zero DOM/Tailwind/CSS-module/`<Html>` UI in the chassis chrome (gate-enforced).
