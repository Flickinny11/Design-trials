# 3D TEXT STYLING — locked architecture (P0 output)

Contract-first. Flat MSDF stays the **default**; true-3D is **opt-in** via additive `textSpec.extrude`. No new RenderMode literal (avoids FP-12/RA-06/receivesLightingDefault ripple).

## Schema (additive only — INV-18; types.ts)
- `TextShadowSpec` += `blur?: number` (em), `offsetZ?: number` (em; 3D only).
- `TextSpec` += `bold?`, `italic?`, `strikethrough?`, `underline?` (booleans); `extrude?: TextExtrudeSpec`.
- new `TextExtrudeSpec`: `{ enabled?: boolean; depth?: number; bevelEnabled?: boolean; bevelThickness?: number; bevelSize?: number; bevelSegments?: number; curveSegments?: number; faceFill?: TextFill; sideFill?: TextFill }`.
- `TEXT_SPEC_DEFAULT` unchanged (all new fields optional/absent → legacy byte-identical).

## True-3D pipeline (the core)
opentype.js (promote transitive ^1.3.4 → **direct ^2.0.0**) → glyph path commands → `THREE.ShapePath` (M/L/Q/C/Z) → `toShapes()` **one glyph at a time** (verify winding w/ `ShapeUtils.isClockWise`; never feed a whole word to one toShapes — three #16950/#13653/#20854) → `THREE.ExtrudeGeometry(shapes,{depth,bevelEnabled,bevelThickness,bevelSize,bevelSegments,curveSegments,steps:1})` → per-glyph geoms `mergeGeometries(geoms, useGroups=true)`.
- **Material groups (verified r184 ExtrudeGeometry.js):** group **0 = front/back caps (FACES)**, group **1 = side walls + bevel (SIDES)**.
- **Default = single `MeshPhysicalNodeMaterial`** on `.material` (three applies it to all groups) → text-animation primitives that mutate `.color/.emissive/.opacity` stay safe (NO crash, no-regression). Use a `[face, side]` **array only when `sideFill` differs** from `faceFill` (split-fill 3D + animation-primitive is an honest out-of-scope caveat).
- **UV remap (load-bearing):** ExtrudeGeometry default front-face UVs = raw object-space XY (NOT 0..1) → after merge, `computeBoundingBox()` + remap group-0 uv to 0..1 over word bbox so a poured texture spans the whole word (else it tiles/garbles).
- **Lit + shadow:** lit `MeshPhysicalNodeMaterial` via `buildPhysicalMaterial`/`applyMaterialSpec` (material-system.ts:43); `castShadow=receiveShadow=true`. Canvas/preview-app rig already complete (PCFSoft + ShadowCasterDirectional + AssembledShadowCatcher) → genuine scene shadow free. Galaxy lacks caster/receiver (text editing is in canvas, so fine).
- **Tier (INV-9):** `detectCapabilityTier()`; T1+ → full extrude (bevelSegments 2-4, curveSegments 6-12, high for DPR-2 sharpness); **T0 → flat MSDF + pseudo-depth drop-shadow fallback**. Add a tiny additive seam to expose tier to the factory text branch.

## Outline data source (server, reuses MSDF cache pattern)
New server-only `src/server/fonts/outline-gen.ts` + route `GET /api/prism/fonts/outline?family&weight&chars` → reuses atlas-gen.ts css2 raw-TTF fetch+disk-cache → opentype.js parse → returns `{ unitsPerEm, ascender, descender, underlinePosition, underlineThickness, glyphs:{[char]:{advanceWidth, commands[]}}, kerning }` (opentype units; self-consistent layout, no MSDF cross-scale bug). Keeps opentype.js OFF the client bundle.
Client `src/lib/prism/text/font-outline-registry.ts` (mirror font-registry memo + `resolveTextOutlines`/`peekTextOutlines` in text-atlas.ts) → DOM-free, relative imports. Inter served from local `public/fonts/Inter-Variable.ttf`.

## Builder seam (a2)
New `src/lib/prism/text/text-object-3d.ts` returns the SAME `TextObjectHandle` (object:Group, units:Mesh[] named `glyph-<i>`, spec, setSpec, measure, dispose) → GraphScene restyle effect (GraphScene.tsx:2259-2307), HubManager cleanup, 36 primitives unchanged. Factory text branch (default-factory.ts:506 `mountText`) dispatches: `spec.extrude?.enabled && tierAllows3D ? createTextObject3D(...) : createTextObject(...)`. createNode stays SYNC (peek-sync-else-async-then-mount, same as atlas). Geometry-kind flip (flat↔3D) → setSpec rebuilds units under same Group identity, OR route via Save-and-Rebuild (rebuildNode).

## Bold / italic / strike / underline (a1)
- bold: real `wght@700` face (css2) or opentype `Font.variation.set({wght})` on variable Inter; faux = outline dilation (labeled synthesized).
- italic: real `ital@1` face; faux = XY shear matrix on node (~0.2 rad).
- strike/underline: extruded bars from `font.tables.post.underlinePosition/Thickness`, merged into word geometry, face material.

## Font preview gallery (P2) — EDITOR DOM chrome (DOM allowed here)
Virtualized list of ~1935 families; each row renders the family NAME in its OWN font via injected `@font-face` (Google Fonts css2 `<link>`, windowed to visible rows; verify CSP). Search filter. bold/italic/strike/underline toggles. Pick → preview-store write {fontFamily,fontWeight} + resolveAtlas + resolveTextOutlines warm. MUST use DESIGN-REFERENCES toolkit: Lenis-class inertia scroll, GSAP choreography, material-treatment (never flat), deliberate type hierarchy. (Outlines NOT needed for gallery — only the scene mesh.)

## Drop shadow (P4)
Two layers: (1) genuine PCFSoft scene shadow from the lit mesh (free, photoreal); (2) controllable artistic drop-shadow layer = offset silhouette (MSDF coverage for flat / front-face shape for 3D) tinted `shadow.color` @ `shadow.opacity`, offset (offsetX,offsetY,offsetZ) em, `blur` via TSL multi-tap / feather. Extends existing flat shadow (offsetX/Y/opacity) additively.

## Fill on 3D faces (P5)
Reuse `TextFill` (solid/gradient/texture/ai-texture) → `faceFill` routes to group-0 face material map; `sideFill` to group-1. Wire `text-fill/generate.ts` `{wired:false}` stub → real fal route (`fal-ai/flux-2`) → `/prism-mock/uploads/` → TextureLoader. Upgrade `TextFillPreviewStrip.tsx` (10 candidates, user's OWN text) to render in TRUE 3D (LOGAN-INBOX backlog item).

## Guards
opentype.js → add to package.json AND dep-allowlist (RUNTIME_ALLOW — check both .py and .sh) BEFORE any import. Never `new THREE.TextGeometry(` (FP-02). New src/lib/prism/text modules DOM-free (FP-05, except devicePixelRatio). No CDN three (RT-SC-02). PCFSoft not VSM. NO PURPLE. Never surface "fal"/print FAL_KEY.
