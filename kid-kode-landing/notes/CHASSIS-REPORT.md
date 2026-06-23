# PRISM TOOLBAR CHASSIS — founder-refinement run report (final)

**Route:** `/toolbar-chassis` (isolated R3F WebGL `<Canvas>`, the proven Glb3DPreview
idiom — never touches the unified `three/webgpu` graph scene). The production toolbar
was NOT modified. Branch `prism-editor-build`.

Built on the committed foundation (`AUTO-CKPT: CHASSIS w1` → `w-mat` → `w-layout` →
`w-engrave` → `w-verify`). The locked chassis is kept exactly: thick extruded-rounded-rect
glass pane with real thickness, a milled rounded-rect cutout per button, rounded-cornered
cubes seated in the cutouts, hover spin (end-over-end on local X, easeInOutCubic) with
see-through, `MeshPhysicalMaterial` transmission glass + real studio environment map, AgX
tone mapping, sRGB, soft shadows, editorial dark backdrop.

This run **resumed an in-flight polish pass** that the previous run left uncommitted, then
re-verified the whole chassis against the founder's four refinements with fresh evidence
and a fresh-context multi-agent audit. The polish pass directly answers this report's own
earlier "honest flags": it de-blows-out the studio softbox over the label band, recesses
the engraving *into* the glass body (frozen-in-glass instead of a white sticker), reduces
gloss on the cubes (further from plastic), and de-figuratives the face glyphs.

---

## 1. Worn material (Iron-Man-armor finish) — refinement #1

The cubes are **real worn metal** via a full generated PBR set, applied in the metallic
workflow — NOT a glossy plastic shader.

- **Source plates:** FLUX.2 [pro] (Replicate), prompted for *seamless allover worn brushed
  metal* — dense criss-cross micro-scratches, fine brushed grain, satin sheen, subtle
  patina, edge wear — explicitly **no bolts / no rivets / no panel seams** (a first pass
  produced non-tileable "hero panels" whose clean centres mapped onto the small cube faces;
  regenerated as a uniform allover finish).
- **Derivation:** `.assetgen/derive-chassis-worn.mjs` (sharp). Bakes the exact section
  jewel-tone into the albedo (`tint · (0.5 + 0.7·luminance)` so the worn structure
  modulates brightness), then derives a tangent-space **normal** (brushed-grain + scratch
  relief), a satin **roughness** (`[0.26..0.62]`, bright→glossier), a high **metalness**
  (`[0.80..1.0]` refined alloy), and a faint **AO**. The polish pass re-baked the 5 albedos
  (smaller, cleaner; `.bak-20260623` copies retained).
- **Material** (`materials.ts → applyWornMaterial`, metallic workflow): `map`=albedo (sRGB),
  `normalMap` `normalScale 1.35` (pronounced brushed grain + scratch relief, reads head-on),
  `roughnessMap` (`roughness=1`, the map carries the satin range), `metalnessMap`
  (`metalness=1`, the map carries the alloy range), `aoMap` `aoMapIntensity 1.0` (uv1
  mirrored onto the RoundedBox geometry), thin worn clearcoat `0.08 / 0.65` (a whisper of
  satin, not wet candy), faint `anisotropy 0.4` @ `π/2` along the grain, `envMapIntensity
  0.95`. Maps use `RepeatWrapping ×1.5` so each small face shows dense grain.
  *Polish delta vs the prior pass: clearcoat 0.12→0.08, clearcoatRoughness 0.6→0.65,
  envMapIntensity 1.1→0.95, normalScale 1.15→1.35, aoMapIntensity 0.9→1.0 — every change
  moves further from glossy plastic toward worn alloy.*
- **Lit so the texture shows:** warm key + cool fill + a low front-raking light rake the
  brushed grain across the cube faces; the studio env supplies the reflections.

Evidence: `final-02-worn-closeup.jpg` (aged-bronze SCENE cubes — brushed grain + scratches
+ patina + engraved glyphs + glass-cutout refraction), `final-03b-spin-edgeon.jpg`,
`final-05-tooltip.jpg` (oxblood worn grain).

### Generated worn-PBR maps (5 sets × 5 maps = 25; 512² PNG)
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
A stone family (carrara / malachite / onyx, albedo+normal+rough) was also generated and is
staged under `…/textures/chassis/` for a future variant; the shipped chassis uses the worn
metals.

---

## 2 + 3. A few rich colors, grouped by function, in labeled grid sections — refinements #2, #3

The **real canvas-editor toolbar** (`src/components/editor/overlays/CanvasToolbar.tsx`)
exposes **exactly 14 top-level functions** — its canonical `ToolGroupId` union + `GROUPS`
array (verified by a fresh-context audit; see Audit below). All 14 are grouped into **5
logical categories**, each with **ONE** curated jewel-tone-metallic color that tints its
worn-alloy plate.

| Section (engraved label) | Color | Functions (grid layout) |
|---|---|---|
| **CREATE**    | deep emerald `#2f9e74`        | Add · Elements · Image · 3D Object · Text (3×2, last row centered) |
| **TRANSFORM** | deep sapphire `#3f6fd6`       | Transform · Selection (1×2) |
| **SCENE**     | aged bronze/amber `#b07a36`   | Background · Lighting (1×2) |
| **LOGIC**     | deep maroon/oxblood `#9c3447` | Prompt Edit · Change Artifact · Animation · Function (2×2) |
| **OUTPUT**    | gunmetal `#6b727c`            | Build (1×1) |

The pane is laid out left→right as five labeled grid sections (rows × columns per section,
short sections vertically centered in a common grid band), sized to fit cleanly
(`chassis-config.ts → buildLayout()` computes every cutout + label position and the pane
dimensions; pane ≈ 13.5 × 3.55 world units). Each cube carries a small **abstract engraved
face glyph** (built from primitive bars/rings/dots — no emoji / Lucide / icon font) so each
function has its own identity. The polish pass made the marks bolder (`GS 0.13`, `TH
0.018`), gave them a polished-dark metallic inlay (`metalness 0.45`) so they read on the
dark oxblood/gunmetal cubes too, fixed a latent dot-orientation bug (round caps now face the
camera), and replaced two potentially face-reading marks (Background → landscape, Function →
node-graph, Lighting → sun-with-rays) so no glyph reads as a face.

Evidence: `final-01-overview.jpg`.

---

## 4. Section labels engraved into the glass — refinement #4

Each section name is **engraved into the glass panel itself**, entirely in-engine
(`EngravedLabel.tsx`, Troika SDF text via drei `<Text>` — **NOT DOM, NOT drei `<Html>`, NOT
an overlay**). Two things make it read as engraved glass rather than a white sticker:

1. **Recessed into the glass body.** The label group sits behind the front glass face
   (`BASE_Z = FRONT_Z − 0.07`), so the thin front layer of the transmission pane
   refracts/frosts over it — the type looks frozen *inside* the glass, with real depth. (The
   prior pass sat the type proud of the front face; the polish recessed it.)
2. **A directional V-groove** from three stacked copies: a dark **shadow** wall offset up &
   deepest (`#04060b`), a cool **frosted-glass** fill (steel `#88a0b8`, NOT white — etched
   glass catching ambient), and a bright **highlight** rim offset down & proud (`#eef5fd`).
   Together they catch light like a real intaglio engraving.

All copies render **opaque + alpha-tested** (`alphaTest 0.3`): *transparent* text behind the
transmission pane is not captured by the glass's transmission pass and renders invisibly;
opaque alpha-tested glyphs are captured and read. The labels sit in the solid `LABEL_BAND`
above each grid (no cutout there), so the pane genuinely refracts them. Local font
`/fonts/Inter-Variable.ttf`, letterspaced caps.

Evidence: `final-04-engraved-labels.jpg` (TRANSFORM / SCENE / LOGIC / OUTPUT reading as
intaglio cut into the glass), `final-04b-engraved-detail.jpg` (raking close detail),
`final-01-overview.jpg`.

### Mechanic + tooltips (kept/added)
- **Hover spin + see-through** preserved across all 14 cubes (`CubeButton.tsx`, untouched by
  the polish): on hover the cube eases through whole turns (easeInOutCubic, lands
  front-forward so the face glyph stays upright) and the gap between the small cube and its
  larger cutout reveals the backdrop. Dev hooks `__PRISM_CHASSIS_SPIN__(0..1|null)` /
  `__PRISM_CHASSIS_HOVER__(id)` drive deterministic capture. Evidence:
  `final-03-spin-seethrough.jpg`, `final-03b-spin-edgeon.jpg`.
- **In-canvas hover tooltip** (`Tooltip.tsx`): Troika text on a dark rounded plate,
  billboarded to face the camera, floating in front of the glass — fully in-engine.
  Evidence: `final-05-tooltip.jpg` ("Animation").

---

## The gate — `scripts/no-dom-ui-gate.mjs` (npm: `gate:no-dom-ui`)

Scans the editor-chrome chassis surface and FAILS (non-zero) on any Tailwind class / styling
`className` / inline `style={` / `*.module.css` import / `tailwindcss` import / drei `<Html>`
import-or-usage, plus `@tailwind`/`@apply` directives or class selectors in any CSS in scope.
Prose comments are stripped before scanning so mentions like "NOT drei `<Html>`" don't
false-trip.

**Coverage:** the toolbar-chassis editor chrome — `src/components/editor/chassis/**` +
`src/app/toolbar-chassis/**`. Landing/marketing pages and the legacy compact/mobile DOM dock
are deliberately out of scope. The single permitted stylesheet is the route's global
stage-sizer (`chassis.css`), which sizes the WebGL mount via element/attribute selectors only
(no class selectors, no Tailwind, no UI).

```
[no-dom-ui-gate] scope: src/components/editor/chassis, src/app/toolbar-chassis
[no-dom-ui-gate] scanned 12 file(s)
[no-dom-ui-gate] PASS — chassis chrome is pure in-engine (no Tailwind/CSS-module/className/inline-style/drei-Html).
```

---

## Fresh-context audit (3 parallel agents, read-only)

A dynamic workflow ran three independent read-only auditors and synthesized one verdict.
**Zero MUST-FIX findings.**

- **Function grouping — PASS.** The real toolbar has **exactly 14** top-level functions
  (`ToolGroupId` union L134–148 + `GROUPS` array L158–178, rendered identically by the
  desktop `LiquidGlassToolbar` and the compact dock). The chassis represents **all 14** with
  **0 missing** and **0 fabricated** (ids/labels/glyphs line up 1:1). The founder's "~20"
  conflates top-level groups (14) with second-level **flyout sub-actions** (Move/Rotate/Scale,
  World/Local, Marquee/Group/Lock, add/remove-light, Rebuild/Version-history, …) that live
  *inside* the 14 groups — correctly omitted from a top-level enumeration.
- **Gate coverage — PASS.** The chassis chrome is genuinely pure in-engine; the gate's PASS
  is correct. The one `document.createElement('canvas')` (ChassisScene backdrop) bakes a
  `CanvasTexture` — texture-baking, not DOM UI. `chassis.css` is stage-sizing only. Noted
  (NOTE, not fix): the regex has latent blind spots (`appendChild`/`innerHTML`/`createPortal`/
  imperative `.style.*`) that **no in-scope code exploits today** — candidates to harden the
  gate later.
- **Polish-pass regression — PASS.** All 4 refinements met & **strengthened**; all 4 locked
  invariants intact (the files carrying invariant logic — `chassis-config.ts`,
  `CubeButton.tsx`, `page.tsx` — were untouched by the polish). The polish fixed a latent
  glyph-dot orientation bug and reduced gloss; no regression to see-through, transmission, or
  label-capture.

---

## Verification (founder review = the judge)

- **Cold-load gate** (fresh `next dev`, `.next` cleared, `unset NODE_ENV`) via chrome-devtools
  MCP at `/toolbar-chassis?spin=0`: **51 requests, all 200/304 — zero `_next` 404s** (font +
  studio env + all 25 worn textures + Inter font + 14 Troika SDF glyph-atlas blobs all
  loaded); **0 console errors** (2 benign warnings only: `THREE.Clock` deprecation;
  `PCFSoftShadowMap` auto-fallback to `PCFShadowMap`); `<canvas>` present (1600×809); scene
  probe live (94 meshes, 1 transmission-glass pane); **DOM `<body>` text length = 0** → no
  stuck loader, everything in-canvas.
- **no-dom-ui-gate:** PASS (output above).
- **tsc:** `tsc --noEmit` → **9 total errors, all pre-existing baseline** (GraphScene GLProps
  + 8 test files missing `THREE` on `NodeContext`); **0 in chassis scope → 0 new.**
- **Frames** (`notes/verification/toolbar-final/`, JPEG ≤1300px, recaptured against the
  polished state):
  - `final-01-overview.jpg` — full toolbar: 5 labeled grid sections, grouped jewel-tone
    colors, engraved labels, worn cubes, thick glass.
  - `final-02-worn-closeup.jpg` — worn aged-bronze cubes (brushed grain + scratches + patina +
    engraved glyphs + glass-cutout refraction).
  - `final-03-spin-seethrough.jpg` — the emerald CREATE section mid-spin, see-through gaps to
    the backdrop below each tilted cube.
  - `final-03b-spin-edgeon.jpg` — near edge-on detail: worn grain + maximal see-through.
  - `final-04-engraved-labels.jpg` — TRANSFORM/SCENE/LOGIC/OUTPUT engraved into the glass,
    catching light (clean oblique).
  - `final-04b-engraved-detail.jpg` — raking intaglio detail (TRANSFORM/SCENE).
  - `final-05-tooltip.jpg` — in-canvas hover tooltip ("Animation") over the oxblood LOGIC cubes.

---

## Honest flags

- **Function count:** the real toolbar has **14** top-level functions, not ~20 (audit-verified
  against `ToolGroupId`/`GROUPS`). All 14 are represented faithfully; no fabricated buttons.
  The extra ~6 the founder may picture are flyout sub-actions nested inside the 14 groups. If
  the founder wants those surfaced as their own cubes (toward ~20), that is a deliberate
  content decision — say the word and the sections expand.
- **Studio softbox hotspot:** the real environment map reflects a bright softbox. The polish
  dimmed it (`environmentIntensity 0.5`), tilted the lobe off-band (`environmentRotation`),
  and moved the rim spots off-center — the label band reads cleanly head-on
  (`final-01`) and from the left oblique (`final-04`). At one specific right-oblique angle the
  bloom still sits over the CREATE label (`final-04b`); kept because it's the approved photoreal
  studio look and reads cleanly from every other angle. Trivially dimmable further on request.
- **See-through is the cutout margin**, not a full-hole reveal: the locked form is a *cube*
  (always ≥ its side in screen-space), so as it spins you see the backdrop through the gap
  between the cube and its larger cutout — most near edge-on (`final-03b`), least near the
  diagonal. The drama is the motion; the stills show the tilt + the gaps.
- **Material reads worn at close/medium range;** at full-overview distance the small cubes read
  as solid jewel-tone alloy (the grain is sub-pixel) — expected, and why the worn close-up is
  part of the review set.
- **Spin lands on 4 whole turns** (`round(3.5)`) so the cube rests front-face-forward with the
  glyph upright — within the spec's "~3.5 turns" tolerance; intentional.
- All visible elements (pane, cubes, face glyphs, engraved labels, tooltips, backdrop) are in
  the `<canvas>`. Zero DOM/Tailwind/CSS-module/`<Html>` UI in the chassis chrome (gate-enforced;
  audit-confirmed).

---

## Independent re-verification (2026-06-23, fresh session)

This run was already executed and committed by the prior session (`ec7ae751` → `21d5a195`,
"RUN COMPLETE"). A fresh-context session independently re-ran every DONE gate **live** rather
than trusting the prior report — all green, zero regressions, no source change:

- **no-dom-ui-gate:** PASS, EXIT=0 (`node scripts/no-dom-ui-gate.mjs` — 12 files scanned, pure
  in-engine).
- **tsc `--noEmit`:** 9 errors total, **all pre-existing baseline** (GraphScene GLProps + 8 test
  files missing `THREE` on `NodeContext`); **0 in chassis scope → 0 new.**
- **Live render** (existing dev server, `/toolbar-chassis?spin=0`, chrome-devtools MCP):
  `<canvas>` 1600×809, scene probe live (**94 meshes, 1 transmission-glass pane**), DOM
  `<body>` text length **0** (all in-canvas, no stuck loader), `__PRISM_CHASSIS_SPIN__` /
  `__PRISM_CHASSIS_HOVER__` dev hooks present.
- **Console:** **0 errors** (1 benign warning: `THREE.Clock` deprecation).
- **Git:** chassis source (`src/components/editor/chassis/**`, `src/app/toolbar-chassis/**`)
  unmodified since the verified commit — the committed state IS the verified state.
- **Fresh evidence frame:** `notes/verification/toolbar-final/live-recheck-overview.jpeg`
  (this session's independent capture — confirms the 5 labeled grid sections, jewel-tone color
  grouping, engraved glass labels, worn cubes, and thick glass all render as documented).

Verdict: the founder's four refinements (worn metal/stone material, a-few-colors-grouped-by-
function, labeled grid sections, engraved-in-glass labels) are all met and the locked chassis
invariants are intact. **No further build work was warranted** — redoing complete, founder-
approved work would only risk regressing the locked chassis. Open items remain the two flagged
founder-review decisions above (14-vs-~20 buttons; softbox dimming), not defects.


---

## Independent re-verify — 2026-06-23 (fresh session, clean dev server)

A new session independently re-verified the committed, founder-approved chassis from a
**cold** dev server (`lsof -ti tcp:3000 | xargs kill -9`; `rm -rf .next`; fresh `npm run dev`,
Ready in 903ms, 327 nodes baked, MSDF regenerated, no build errors). No source was changed —
this is a confirmation pass, not a build.

**Results — all green:**
- **no-dom-ui-gate:** PASS, EXIT 0 — `node scripts/no-dom-ui-gate.mjs`, 12 files scanned,
  "chassis chrome is pure in-engine (no Tailwind/CSS-module/className/inline-style/drei-Html)."
- **tsc `--noEmit`:** 0 chassis-scope errors; 9 total = the pre-existing baseline (GraphScene
  GLProps + 8 test files). 0 new.
- **Cold-load render** (chrome-devtools MCP, `/toolbar-chassis?spin=0`): `<canvas>` 1600×809,
  scene probe `__PRISM_CHASSIS_SCENE__` = **94 meshes / 1 transmission-glass pane** (matches the
  documented state), camera at canonical front pose `[0, 0.40, 15.50]`, autoRotate frozen.
- **Console:** 0 errors, 0 pageerror; 1 benign `THREE.Clock` deprecation warning.
- **PBR maps on disk + git-tracked:** all 25 worn maps present
  (`public/prism-mock/editor/textures/chassis-worn/{emerald,sapphire,bronze,oxblood,gunmetal}-{albedo,normal,rough,metal,ao}.png`),
  loaded by `materials.ts` via `useTexture` in the metallic worn-alloy workflow.
- **Spin / see-through mechanic:** drives live — `__PRISM_CHASSIS_SPIN__(0.25)` rotates the cubes
  edge-on (face glyphs rotate away, brushed worn-metal grain reads strongly); `(0.5)` lands
  front-forward (2 whole turns), confirming `rotation.x = easeInOutCubic(p) × 4 turns × 2π`.

**Fresh evidence frames** (`notes/verification/toolbar-final/`):
- `recheck-2026-06-23-front.png` — canonical front pose (`?spin=0`). Matches the approved
  `final-01-overview.jpg`: legible engraved CREATE/TRANSFORM/SCENE/LOGIC/OUTPUT labels catching
  light, bright refractive glass, 5 jewel-tone worn-metal sections with face glyphs.
- `recheck-2026-06-23-seethrough.png` — forced edge-on spin; brushed grain prominent.
- `recheck-2026-06-23-spin.png` — forced 0.5 (front-forward landing).
- `recheck-2026-06-23-overview.png` — **no-`?spin=0`** capture mid auto-orbit (see note below).

**Operator note for the founder (intentional, not a defect):** the review route auto-orbits by
default (`OrbitControls autoRotate`, `autoRotateSpeed 0.5`). A casual visit to `/toolbar-chassis`
can therefore land at any azimuth — including the **back** of the pane, where the engraved labels
read mirror-reversed and the pane is dark (the key + raking lights are all front-side at +Z). That
is just the orbit position, not a regression. For the canonical, legible front view (and for any
deterministic capture), open **`/toolbar-chassis?spin=0`**, or drag to orbit back to front. If the
founder prefers the route to *open* facing front and only orbit on interaction, that's a one-line
change (default `autoRotate` to off, or add a brief settle-to-front) — flagging it as a UX choice,
not fixing it unprompted.

**Verdict:** the committed founder-approved chassis is intact and renders cleanly right now. No
build work was performed or warranted.

---

## Re-verify 2026-06-23 (review session, no source change)

Re-ran on founder re-issue of the chassis prompt. **No rebuild performed** — the chassis
was already built, founder-approved, and committed (`ec7ae751`→`dcabcae8`). Regenerating PBR /
re-laying-out would have regressed the locked, approved chassis, so this run was verification only.

- **no-dom-ui-gate:** PASS (exit 0) — 12 files scanned, scope `src/components/editor/chassis` +
  `src/app/toolbar-chassis`. Pure in-engine.
- **tsc:** 9 total errors = baseline exactly, **0** referencing chassis/toolbar-chassis.
- **Cold load** (killed :3000, `rm -rf .next`, fresh `npm run dev`, ready 923ms): route
  `/toolbar-chassis?spin=0` HTTP 200; Chrome-DevTools probe → 1 canvas, scene probe present,
  **94 meshes / 1 transmission pane**, all verify hooks live (`__PRISM_CHASSIS_SPIN__/HOVER__/CAM__`).
- **Console errors:** 0.
- **Fresh frames** (`notes/verification/toolbar-final/`): `review-2026-06-23-front.png`,
  `review-2026-06-23-seethrough.png`, `review-2026-06-23-detail.png`. All 4 refinements visually
  confirmed (worn satin/brushed cubes, 5 jewel-tone sections, labeled grids, in-glass V-groove
  engraving catching light, edge-on see-through).

---

## Re-verify 2026-06-23 (ULTRACODE re-issue — independent fresh-session check, no source change)

Founder re-issued the chassis build prompt (the version written when only `2917a191 CHASSIS w1`
existed). Audit of git + memory + on-disk source confirmed the run was **already complete and
founder-approved** (`ec7ae751` w-mat → `21d5a195` w-polish, plus `a9028ccd`/`dcabcae8`/`559054c2`
re-verifies, all "RUN COMPLETE"). A rebuild was therefore **deliberately not performed** —
regenerating worn PBR / re-laying-out would regress the locked approved chassis. This run is an
independent non-destructive re-verification.

- **no-dom-ui-gate:** PASS (exit 0) — 12 files scanned, scope `src/components/editor/chassis` +
  `src/app/toolbar-chassis`. Pure in-engine (no Tailwind / CSS-module / className / inline-style /
  drei `<Html>`).
- **tsc:** 9 total errors = documented baseline exactly, **0** referencing chassis/toolbar-chassis
  (0-new). The 9 are pre-existing (GraphScene GLProps + 8 test-file NodeContext.THREE).
- **Cold load** (`lsof -ti tcp:3000 | xargs kill -9`, `rm -rf .next`, fresh `npm run dev`, ready
  924ms): route `/toolbar-chassis?spin=0` HTTP 200; Chrome-DevTools cold-load probe → 1 canvas
  (1600×809), `__PRISM_CHASSIS_SCENE__` present, **94 meshes / 1 transmission pane**, verify hooks
  live (`__PRISM_CHASSIS_SPIN__/HOVER__/CAM__`).
- **Console:** 0 errors (one benign upstream `THREE.Clock deprecated` warning).
- **Network:** all 35 requests 200/304, 0 `_next` 404s; all 5 jewel-tone worn PBR sets
  (emerald/sapphire/bronze/oxblood/gunmetal × albedo/normal/rough/metal/ao) + studio env map +
  Inter font loaded.
- **Fresh frames** (`notes/verification/toolbar-final/`): `verify-session-front.png`,
  `verify-session-seethrough.png` (spin 0.25 edge-on), `verify-session-worn-closeup.png`
  (CREATE/TRANSFORM brushed-satin grain + engraved labels), `verify-session-engraved.png` (raking
  oblique, all section labels catching light). All 4 founder refinements + locked chassis visually
  confirmed intact.

**Verdict:** founder-approved chassis intact, renders cleanly, all gates green. No build work
warranted.
