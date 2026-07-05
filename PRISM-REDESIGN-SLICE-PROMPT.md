# PRISM UI REDESIGN — GATEABLE SLICE (run brief)
_Model: claude-opus-4-8 for ALL work, authoring AND verification. Never Sonnet. 1M context automatic on Max._

## MISSION (read fully, then do exactly this — no more)
You are a headless Claude Code (opus-4-8) session. Produce ONE small, genuinely premium
design slice for the Prism editor UI chrome, get it past a real review gate, surface it,
then STOP. Logan approves or rejects the slice BEFORE any full build-out. Do NOT build the
whole UI. Do NOT add phases. One slice, brilliant, then stop.

## CONDEMNED — never reuse or re-skin (see PRISM-BUILD-STATE.md)
- The brass/gold "chrome-layer" slab system (`useChromeSlab`, brass `material.ts`).
- Gold-in-a-square logos. The existing color scheme.
- Grotesque fonts — ANY grotesque, banned everywhere.
- Prebuilt / Lucide-style 2D glyph icons, emojis, lightning bolts, CSS-filter fake-3D.
If you find yourself reaching for any of these, stop and do the opposite.

## THE AESTHETIC (north star)
"Tony Stark / Iron Man / Transformers / Liquid Terminator" — the documented Prism aesthetic
(see ~/.claude/skills/photorealistic-3d-ui/SKILL.md). Photoreal chrome, titanium, anodized
metal, liquid metal, holographic, refractive. Mechanical sci-fi premium.
- NOT liquid-glass-Apple. NOT flat. NOT generic Tailwind.
- Liquid glass is ONE refractive material used selectively (a holographic accent, a
  refractive edge) — gorgeous when photoreal-3D, warping and refracting light in motion —
  but it is NOT the basis.

## THE THESIS (how to build — this is the whole point)
Every element COMBINES several dependencies/primitives, each tuned for the Prism runtime.
A button is not one material: e.g. a beveled PBR chrome body + edge caustics + clearcoat
specular + a refraction pass + a physics-driven press. Stack and optimize. If you think you
have used enough dependencies on an element, you have not — go further.

Ingredients (READ BOTH before authoring):
- The 410 primitives at `kid-kode-landing/src/lib/prism/animatable/primitives` —
  bevel-glass, brushed-metal, liquid-metal-flow, crystal-facet, caustics x12, acrylic-edge,
  iridescence, refraction-warp, holographic, etc. All TSL `MeshPhysicalNodeMaterial`.
- `kid-kode-landing/docs/prism/DESIGN-REFERENCES.md` — the anti-default toolkit
  (TSL/WebGPU physical materials, pmndrs postprocessing, ray-marched SDFs + smooth-union,
  Rapier + fluid sims for gravity/flow, magnetic cursors, Gaussian splatting). Read §16
  performance patterns too.

## THE SLICE — produce exactly these five things, together, as one cohesive composition
1. **2-3 buttons** — primary, secondary, and one icon button. Dimensional (real Z-thickness),
   photoreal material, never flat. Hover = material/light shift (not just color); press =
   physical depress with momentum (power easings only).
2. **ONE custom 3D icon** — genuinely 3D, colored, animated. Build via the fal pipeline
   (FLUX.2 -> hunyuan-3d -> GLB) OR procedural BufferGeometry + PBR. NEVER prebuilt/Lucide/
   emoji. Make it the standout — a Prism mark or a tool glyph, your call, make it stunning.
3. **The Prism logo / wordmark** — reimagined. NOT a gold square. Dimensional, on-aesthetic.
4. **The type** — a premium typeface that fits the aesthetic and is NOT grotesque.
5. **ONE panel** — a dimensional chrome/holographic surface (e.g. an inspector panel) with
   measurable Z-thickness and edges that carry highlight/shadow/dispersion (no naked 1px
   lines). Real material, real depth.

## TOOLSET (use it — all on this machine)
- **fal.ai** (FAL_KEY in env) for anything that must be truly photoreal: `fal-ai/flux/pro/v2`
  (photoreal image) -> `fal-ai/hunyuan-3d/v3.1/pro/image-to-3d` (GLB); seedream for multi-view;
  part-splitter for an icon that fans open/morphs. Helper:
  `OpenDesign/plugins/_official/3d-animated-visuals/scripts/fal-client.ts`. Catalogue +
  decision tree: `.../references/fal-models/index.md`. INSPECT every fal asset (screenshot 3
  angles, grade 0-5 on geometry/texture/scale, regenerate if any axis <4, cap 4 attempts).
- **OpenDesign 3d-animated-visuals references**: `materials.md` (PBR recipes for chrome/
  titanium/mercury/anodized), `stack-and-imports.md`, `performance-budgets.md`, the
  `techniques/` recipes. At `OpenDesign/plugins/_official/3d-animated-visuals/references/`.
- **photorealistic-3d-ui skill** at `~/.claude/skills/photorealistic-3d-ui/` (R3F + Rapier
  physics + theatre.js + Blender-baked) — the methodology for dimensional chrome.
- **blender-mcp** for parametric mechanical parts (beveled panels, gears).
- The 410 primitives + DESIGN-REFERENCES.md.

## RENDER CONTEXT (critical — this is why the old UI looked flat)
Render in a REAL WebGL context with proper IBL/env-map AND a populated transmission render
target, so glass and metal actually refract and reflect. Do NOT reproduce the shared
catalog-rig limitation where transmission reads BLACK (an opaque slab) — documented in
`primitives/bevel-glass.ts`. If transmission isn't available, deliberately use env-map
specular + clearcoat + Beer-Lambert + postprocessing refraction instead. Hold 60fps on
Tier-A (M-series). Bloom + ChromaticAberration are functional (they reveal material), never
decorative.

## THE REVIEW GATE (the author is NOT the judge — this is non-negotiable)
After the slice renders, spawn FRESH-CONTEXT opus-4-8 reviewer subagent(s) (the OpenDesign
external-review pattern) to grade real screenshots >=4 on EACH axis: photorealism, material,
motion, spec_match, polish. Do NOT self-declare success. If any axis <4, read the named gaps,
fix that specific issue (don't rebuild), re-review. Iterate until all axes >=4 (cap ~6).

### HARD STOPS (anti-patterns — automatic fail)
- CSS-only "glass" pretending to be 3D. - Flat shadow planes as fake depth.
- Single box-shadow as a depth primitive. - Bouncy/elastic easings (use power3.out,
  power4.inOut, expo.out only). - Decorative postprocessing. - Any naked 1px edge.

## OUTPUT, then STOP
- A single self-contained, openable artifact rendering the real WebGL/R3F slice with all
  five elements together, at `Design-trials/redesign-slice/index.html` (serve it or print the
  exact open path/URL).
- `Design-trials/redesign-slice/SLICE-REPORT.md`: what you built, which dependencies/
  primitives you combined PER element, the fal assets generated + their review scores, the
  final review scores per axis, and the preview path.
- Then STOP. Do not port to the Prism app, do not build more. Logan gates this slice; the
  production port (via the photorealistic-3d-ui skill) happens only after he approves.
