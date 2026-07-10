# PRISM DESIGN PLAYBOOK — the always-on doctrine (W-PCP D2)

> Purpose: close the **design-starvation** gap W-BAKE §4 proved (best one-shot
> design mean 16/100, 100% MUST-FIX). This file is the full doctrine; the
> compact distillation rides inside **L1 v2** (`DESIGN_DOCTRINE_L1_BLOCK`,
> `src/lib/prism/codegen/pcp-blocks.ts`) so every codegen call carries it.
> Deep per-node-class guides retrieve from the skill registry
> (`docs/prism/pcp/skills/`, Amendment A).
>
> Sources (all committed): Design Law DL1–DL16
> (`docs/prism/PRISM-SHELL-DESIGN-LAW-2026-07-03.md`), the W-DG1 grammar
> corpus (`design-grammar/families/*.json`, 14 grounded families), the W-BAKE
> judge rubric + verdicts (`scripts/bakeoff/rubric.mjs`,
> `notes/bakeoff/judge/axis2/scores.json`), and numeric ranges proven on
> shipped nodes across W9A / W-TPL / W-BG / W-PHOTO (wave reports in
> `notes/`). Rules below carry a WHY and a number — adjectives don't survive
> a cold model.

---

## 1. How a node earns its place (the three-question gate)

Every generated node is judged (blind, 0–100, DL rubric) on:
1. **Does it run?** A module that throws at `createNode` shows the fallback
   plane and scores ≤10. (W-BAKE: 65–80% of visual one-shots crashed — use
   ONLY the documented runtime surface.)
2. **Is it the spec?** Every color, copy string, camera/light note and
   primitive in the visualSpec must be visibly present. `MISSING_SPEC_ELEMENT`
   was the #1 defect on every model (39/40 renders).
3. **Is it alive?** Light must respond, materials must read as material,
   composition must have depth. A technically-correct flat frame still fails
   (FLAT_VOID was #2 on every model).

## 2. DL1–DL16 operationalized — per-node directives

Each row: what a NODE MODULE must do, why, and the MUST-FIX trigger a judge
fires when it's violated.

| DL | Per-node directive | Why | Trigger |
|---|---|---|---|
| DL1 | Build for a dark stage: backdrop in the `#0b0b10`–`#16161d` band from the spec's gradientStops — never `#000` flat fill. | Dark-first is the professional default; pure black reads as "nothing rendered". | `FLAT_VOID`, `BLANK_RENDER` |
| DL2/DL14 | Palette = the spec's ink/paper/accent EXACTLY. ONE accent (signal red family) used at ≤10% of frame area. No blues unless the spec names one. | Identity discipline; `#3b82f6`-class blues are the strongest template tell. | `DEFAULT_BLUE_DRIFT`, `OFF_PALETTE` |
| DL3 | Bimodal type scale: one display size + micro labels; body only where spec lists body copy. Use the spec's exact px sizes; letterSpacing ≥0.05em on ALL-CAPS captions. | Mid-size type everywhere reads generic; bimodal scale is the premium signature (W-DG1 oversized-type family). | `SCALE_ERROR` |
| DL4/DL10/DL11 | Depth and glass come from rendered material (transmission/ior/clearcoat responding to lights) — never a translucent flat plane pretending to be glass. | If light doesn't move across it, it reads as a sticker. | `DEAD_LIGHTING` |
| DL6 | Every entrance/settle animation eases with weight: `power3.out`/`power4.out`, overshoot 1.04→1.0 over ~0.9s. NOTHING LINEAR on hero motion. | Linear tweens read as mechanical placeholder motion. | (judged in motion review) |
| DL7 | Hairlines at 0.005–0.01 scene-unit thickness, exact spacing on the 0.25-unit grid; no soft blurred shadow stacks. | Engineered precision is the brand; soft-UI blur is 2024 slop. | `BROKEN_COMPOSITION` |
| DL9 | No purple-gradient-on-dark washes, no stock blob shapes, no emoji, ASCII-only rendered text. | Slop tells; non-ASCII glyphs garble in the MSDF atlas (proven W-TPL/W8). | `GARBLED_TEXT`, `OFF_PALETTE` |
| DL12 | Interactive elements (buttons/CTAs) are extruded 3D objects: visible edge bevel, PBR material, hover/press via primitives or gsap with weight. | Flat rect + text = CSS-era button; the product's buttons are objects. | `ALL_BLACK_ELEMENT`, `FLAT_VOID` |
| DL16 | Rich, never void: every frame region carries either content, graded backdrop, or lit material. An unlit black margin larger than ~25% of frame is a defect. | "Flat black slab" is an automatic founder-level MUST-FIX. | `FLAT_VOID` |

## 3. Numeric doctrine (W-DG1 distillation, WHY-annotated)

### 3.1 Palette
- **Stage**: near-black band `#0b0b10 → #16161d` as a vertical engineered
  gradient (2–3 stops from the spec), NOT flat. WHY: a gradient reads as a
  lit stage; a flat fill reads as void (DL16, FLAT_VOID trigger).
- **Figure/ground brightness plan**: decide the ONE brightest element before
  composing — headline accent, emissive core, or key-lit subject. WHY: every
  strong family in the grammar corpus self-lights one element and grades the
  rest around it (gpu-fluid, oversized-type, particle-field).
- **Accent budget**: accent hue on ≤10% of pixels; second accent = 0. WHY:
  one signal color carries identity; two reads as template.
- **Text contrast ≥ 4.5:1** against its local backdrop (compute against the
  gradient stop behind the text, not the global background). WHY: judged
  LOW_CONTRAST; also the corpus contract minimum.

### 3.2 Typography
- **Scale (scene-unit em heights)**: hero 0.62 · headline 0.34 · subhead 0.20
  · body 0.13 · caption 0.09. Nothing between subhead and hero. WHY: bimodal
  scale is the premium signature; mid sizes dilute (oversized-type family).
- **Faces**: serif display (Lora class) for hero/headline; mono (JetBrains
  Mono class) for captions/numerals/CTAs. WHY: neo-serif + mono is the DL3
  pairing; grotesques are forbidden on shell surfaces.
- **ALL-CAPS micro labels**: letterSpacing 0.05–0.12em, caption size. WHY:
  tracked caps read engineered; untracked caps read shouty.
- **ASCII ONLY in rendered text** — no em-dash, `·`, arrows, smart quotes.
  WHY: glyphs outside the MSDF atlas render as boxes/garble (proven W-TPL).
- **Copy comes from the spec**: iterate the textContent items; never invent
  or hardcode alternate copy. WHY: data-driven copy survives regeneration;
  invented copy is a spec violation (sonnet's 55-case axis-1 cluster).

### 3.3 Spacing & composition
- **Rhythm**: base unit 0.25 scene units; padding 2× base; stack gap 1–2×
  base. Hub frame ≈ x∈[-3.5,3.5], y∈[-3,2.5] at fov 50, camera z=10 — size
  compositions to FILL it. WHY: SCALE_ERROR (tiny centered subject in a huge
  void) hit 12–25 renders per model in W-BAKE.
- **Subject height 55–70% of frame** for a hero; headline baseline on the
  lower or upper third line. WHY: rule-of-thirds anchoring; centered-and-small
  is the most common one-shot failure.
- **Three depth planes minimum**: backdrop plane (z≈-2.5, gradient or photo)
  → subject/mid → foreground accent (rim light catch, particles, or floor
  contact shadow). WHY: single-plane scenes read flat regardless of material
  (layered-photo + parallax families: depth IS the perceived quality).
- **Contact shadow under grounded objects**: radial-gradient plane, radius
  ≈1.1–1.6× subject radius, opacity 0.4–0.6. WHY: floating objects with no
  shadow read as paste-ins (coverflow family: "premium feel comes from clean
  shadow craft").

### 3.4 Lighting
- **Three-point minimum on 3D subjects**: key (intensity ~1.0–1.4, 30–45°
  off-axis), rim/back (~0.6–1.0, opposite side, may carry the accent hue),
  ambient fill 0.25–0.6. WHY: the runtime provides ambient 0.6 + key 1.2 —
  ADD the rim/accent locally; key-only = DEAD_LIGHTING.
- **Emissive glow cap 2.3** (AgX tone mapping red-clips warm emissives above
  ~2.5 — proven W-TPL). Additive-glow subjects (particles, cores) brightest
  at center with soft falloff.
- **Metal needs something to reflect**: pair metalness >0.5 with an env map,
  a lit backdrop plane, or emissive neighbors. WHY: metal in a void renders
  BLACK (proven W5/W8: "metal-reads-dark").
- **The light story must be single-source-consistent** across planes: match
  temperature and direction or the composite reads fake (layered-photo rule).

### 3.5 Materials (PBR ranges proven on shipped nodes)
- Flat cards / panels: `roughness ≥ 0.5`, `metalness ≤ 0.55`,
  `clearcoat ≤ 0.25`. WHY: above these, runtime key light causes specular
  blowout (proven W-TPL fix).
- Brushed metal: roughness 0.5–0.55, metalness 0.5–0.55, clearcoat 0.2,
  anisotropy ~0.8 along the machining direction.
- Glass/prism: `transmission 0.9–1.0`, `ior 1.4–1.6`, thickness > 0,
  iridescence where spec'd, PLUS a back rim light and an emissive core —
  transparent objects over dark stages vanish without them (proven W9).
- Stone/marble: roughness 0.6–0.8, metalness 0, high-frequency normal or
  texture map — flat-color "marble" is a slop tell.

### 3.6 Motion
- Entrances: 0.5–0.9s, `power2.out`/`power3.out`, translate ≤0.4 units +
  fade. Settle: overshoot scale 1.04→1.0, `power4.out`, 0.9s
  (weighted-settle). Press: scale 0.97, 120ms, `back.out`.
- Idle/ambient: ONE slow transform (orbit 0.1–0.2 rad/s, or breathing scale
  ≤2%) — perpetual multi-axis motion reads as screensaver.
- Hover: ≤6° tilt toward cursor over ~300ms `cubic-bezier(0.215,0.61,0.355,1)`.
- Everything a primitive can do goes THROUGH `ctx.primitives` (orbit,
  depth-rotate, parallax-scroll, magnetic-cursor, kinetic-text…) — bespoke
  gsap is for what the library can't express. All timelines die in
  `userData.cleanup()`.

## 4. Anti-slop forbidden patterns (MUST-FIX triggers, verbatim rubric vocabulary)

A judge enumerates these with region anchors; each one present = MUST-FIX:

- **FLAT_VOID** — any frame region (>~25%) that is unlit flat fill. Fix:
  gradient stage + depth planes (§3.3).
- **ALL_BLACK_ELEMENT** — black button/card on black stage with no material
  response. Fix: PBR material + edge bevel + rim light (DL12/DL16).
- **DEFAULT_BLUE_DRIFT** — any blue accent the spec didn't name (`#3b82f6`,
  `#4a90d9`, `#0af` class). Fix: use spec accent verbatim.
- **DEAD_LIGHTING** — uniform brightness, no key/rim differentiation, metal
  with nothing to reflect. Fix: §3.4 three-point + reflection source.
- **BROKEN_COMPOSITION** — overlapping text, subject clipped by frame,
  elements outside the hub frame. Fix: §3.3 grid + frame bounds.
- **GARBLED_TEXT** — `[object Object]`, missing glyph boxes, overlapping
  glyph runs. Fix: `createText(STRING, opts)`, ASCII-only, spec copy.
- **MISSING_SPEC_ELEMENT** — anything the visualSpec names that isn't
  visible. Fix: checklist the spec before returning the group.
- **OFF_PALETTE / LOW_CONTRAST / SCALE_ERROR / BLANK_RENDER** — §3.1–§3.3.

## 5. Worked exemplars — committed code + frame pairs, annotated

### 5.1 W9A watch atelier hero (flagship 3D product node)
- **Code:** `src/lib/prism/atelier/watch-node-factory.ts`
- **Frame:** `notes/verification/shell-w9a/w9a-desktop-01-hero.png`
- **What makes it work:** node-local 3-point light rig (bounded PointLights
  INSIDE the factory — the scene gives only ambient+key); generated PBR
  (FLUX-derived dial + brushed metal) so every surface has micro-detail;
  champagne/brass supporting palette over the dark stage (DL16 "rich, never
  void"); one hero object at ~60% frame height, face-on; UI chrome
  (swatches, price panel) kept flat-and-quiet so the lit object owns the
  frame; deep-blue nebula backdrop = the stage gradient, not flat black.

### 5.2 W-TPL "Meridian" (photo-composite hero, R2 route)
- **Code:** `src/lib/templates/catalog/meridian.ts`
- **Frame:** `notes/verification/shell-wtpl/hero-01-meridian.png`
- **What makes it work:** light-field photography carries the lighting
  (glass shelves, daylight) — the node adds only composition; oversized
  display word BEHIND the subject (type sandwich = depth); product subject
  sharp and centered-right, supporting copy pushed low-left (bimodal type);
  mono CTA with tracked caps. Light temperature is consistent across planes
  because the planes come from one composite.

### 5.3 W-TPL "Cascade" (architectural photo stage + editorial type)
- **Code:** `src/lib/templates/catalog/cascade.ts`
- **Frame:** `notes/verification/shell-wtpl/hero-10-cascade.png`
- **What makes it work:** single hot light source (the lit doorway) gives
  the frame a focal engine; headline in warm off-white self-lights the upper
  third; mono subline tiny beneath it (bimodal); everything else graded
  dark. One brightest element, decided in advance (§3.1).

### 5.4 W-TPL "Ledgerline" (pricing tiers as material objects)
- **Code:** `src/lib/templates/catalog/ledgerline.ts`
- **Frame:** `notes/verification/shell-wtpl/hero-05-ledgerline.png`
- **What makes it work:** each tier IS its material (obsidian / marble) —
  rendered PBR with real texture maps, not colored cards (DL11/DL12);
  text grounded over PHOTO surfaces, not emissive mesh (extruded text
  dithers red over emissive dark mesh under AgX — the proven fix); prices
  in display serif, features in mono caption.

### 5.5 W-TPL "Folio" (editorial gallery family)
- **Code:** `src/lib/templates/catalog/folio.ts`
- **Frame:** `notes/verification/shell-wtpl/hero-07-folio.png`
- **What makes it work:** distinct-image gallery (never one subject echoed —
  the carousel-echo anti-pattern); natural photographic light with a gentle
  bottom scrim anchoring copy (editorial-product-gallery family rule);
  desaturated grade unifies the set.

### 5.6 CONTRAST — the one-shot ceiling (W-BAKE best render, still not ship-grade)
- **Code (raw generation):** `notes/bakeoff/runs/axis2/claude-sonnet-5/v-03-glass-prism-refraction-r1.json`
- **Frame:** `notes/bakeoff/renders/frames/claude-sonnet-5/v-03-glass-prism-refraction-r1.png`
  (judged 58/100 — the corpus best)
- **What works:** readable glass prism, red emissive core, dispersion streak
  on-accent — the §3.5 glass recipe half-applied.
- **What fails (verbatim judge MUST-FIX):** OFF_PALETTE + DEFAULT_BLUE_DRIFT
  (right-edge pale blue slab), FLAT_VOID (left half background),
  MISSING_SPEC_ELEMENT (iridescence + back rim absent). Its sibling run r2
  scored 5/100: the SAME model hallucinated `createTextMesh` from `@/text`
  and the whole module crashed — the exact failure the L1 v2 runtime-surface
  block exists to prevent.

## 6. Per-node-class quick directives

- **hero-3d / product-hero**: §3.4 three-point rig, contact shadow, orbit or
  depth-rotate primitive, subject 55–70% frame, backdrop gradient plane.
- **editorial-type / headline**: oversized display word as compositional
  plate; bimodal scale; occlusion by subject welcome; ghost the word (lower
  brightness) when imagery must lead.
- **card / panel / pricing**: §3.5 flat-card PBR caps; hairline borders;
  extruded ≥0.02-unit depth; hover tilt ≤6°; NEVER black-on-black.
- **gallery / carousel / filmstrip**: distinct images per cell (no echo);
  soft contact shadows; drama inside the cells, chrome stays calm.
- **nav / dock / CTA**: objects not rects (DL12); mono tracked-caps labels;
  press-down 0.97/120ms; one accent element max.
- **empty-state / footer**: still a stage — graded backdrop + one lit
  element + generous caption-scale type; "empty" never means void (DL16).
