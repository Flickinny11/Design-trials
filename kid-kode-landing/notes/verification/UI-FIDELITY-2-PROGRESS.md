# UI-FIDELITY-2 — Progress Ledger (resumability source of truth)

> Protocol: every session reads this + `git log` FIRST, verifies claims cheaply,
> continues from the first incomplete wave. Never restart from zero.
> Updated continuously by the running session.

## Run state

- **Run started:** 2026-06-11 (session 1, claude-fable-5)
- **Branch:** prism-editor-build
- **Current wave:** W0 (orientation) — IN PROGRESS
- **Last AUTO-CKPT:** (none yet — launch kit 10080ba is pre-run HEAD)
- **FAL_KEY:** present in kid-kode-landing/.env.local (presence-checked session 1; minimal validation call pending)
- **LOGAN-INBOX:** checked session 1 — no OPEN directives

## Waves

| Wave | Scope | Status |
|---|---|---|
| W0 | Orientation: ledger, FAL validation, DESIGN-REFERENCES full read, research (Slider Rev / fal models / WebGPU chrome), baseline DPR2 screenshots | ✅ DONE (AUTO-CKPT pending→see git) |
| W1 | Chrome material foundation: shared WebGPU chrome layer, TSL material lib (brushed metal/smoked glass/ceramic), Fresnel/refraction/bevels, pointer-reactive light, T0 fallback, <2ms budget | ✅ FOUNDATION DONE (see W1 notes) |
| W2 | Surface migration: toolbar+flyouts+sliders, inspector, catalog frame, overlays, HUD, keyframe shell, boot + typography overhaul + morph-through transitions + canvas2D→MSDF labels | pending |
| W3 | Flagship 5-hub showcase: fal.ai assets (image/3D/video), hi-res (kill 1024²), morph-through nav, all-5-driver bindings, poured-texture text | pending |
| W4 | Carried fixes + no-regression: gizmo offset, 312 catalog, full vitest, perf table, mobile fallback | pending |
| W5 | Evidence + report: DPR2 zoom crops, advocate verdicts (Slider-Rev side-by-side), dependency-usage table, spend ledger, UI-FIDELITY-2-REPORT.md | pending |

## W1 notes (foundation shipped S1)

- **Built:** `src/components/editor/chrome-layer/` — page-lifetime slab registry
  (survives Canvas contentKey remounts), two instanced material families
  (opaque metal/ceramic/well + refractive glass), camera-parented CSS-px
  placement, DOM twins keep layout/text/input (`.ds-slab-hosted` suppression in
  materials.css, t2-gated, layer-active hysteresis), pointer PointLight +
  damped uniforms, TSL nebula scene backgroundNode (refractable backdrop;
  matches the CSS one used at t0/t1).
- **Material physics:** IQ rounded-box SDF per instance (per-corner radii),
  fwidth AA, SDF-gradient bevel normals → MeshPhysicalNodeMaterial (real
  GGX/Fresnel/IBL), brushed-metal stretched-noise micro-normals, ceramic
  clearcoat+grain, wells inverted-bevel, glass = edge-lensed 3-tap RGB
  dispersion of viewportMipTexture w/ viewportSafeUV + Beer–Lambert smoke +
  guaranteed rim light; brass keyline + magnetic pointer border-glow
  (emissive) replace .ds-edge.
- **Pilot surfaces live:** TopBar (metal), CanvasToolbar dock (metal, brushed y),
  FlyoutShell (glass, accent), Inspector (glass). tsc gate: 10 baseline / 0 new.
  backend=webgpu attested, consoleErrors=0.
- **Evidence:** `notes/verification/fidelity2/w1-after/` — full frames + DPR2
  zoom crops (dock static/hover, flyout hover + corner ultra, topbar, inspector
  edge). Own-eyes: dock reads as machined brushed metal under the pointer
  light; flyout reads as smoked glass w/ brass-lit bevel — REAL material, not
  CSS. Flag: odd diagonal light band on inspector glass body (investigate in
  W2 polish; likely refracted TopBar/nebula via mip chain — not a blocker).
- **PERF (honest flag):** dev-mode headless rAF harness — HEAD canvas 10.3ms
  median → +1.5ms fixed (bg node + pointer light + layer) → +~4ms with glass
  slabs (viewport copy + mip-gen at DPR2 3360×2200). OVER the 2ms budget in
  this harness; W4 owns GPU timestamp measurement on a real window +
  production build + mitigations (half-res refraction copy, tap reduction).
- **Pre-existing finding (not a regression — verified via stash-bisect at
  HEAD):** canvas-mode demo backdrop nondeterministically shows the blue
  mockup or the flat gray compiled slab depending on prior drive state
  (hub-reveal/camera). The W3 showcase rebuild replaces this content wholesale.
- **fal feed for chrome (Patina micro-normals + env):** deferred into W2
  surface work where the material API grows texture slots. FAL_KEY re-check due
  at W2 boundary per mandate.

## Surfaces done (advocate verdicts)

(pilot shipped; advocate gate runs at W2 when surfaces are complete)

## fal.ai spend ledger ($50 HARD CAP — warn $25/$40, stop $48)

Machine ledger: `notes/verification/fidelity2/fal-ledger.json` (auto-appended by
`scripts/fidelity2-fal-gen.mjs`, which enforces the $48 stop).

| # | Model | Purpose | Est. cost | Running total |
|---|---|---|---|---|
| 1 | fal-ai/patina/material | chrome brushed-metal normal+rough (W2 TSL feed) | $0.05 | $0.05 |
| 2 | fal-ai/patina/material | chrome ceramic micro-grain (W2 TSL feed) | $0.05 | $0.10 |
| 3 | fal-ai/flux-2 (dev) | warm observatory equirect env (chrome/boot accent) | $0.03 | $0.13 |

All three vision-critiqued and APPROVED (brushed normal = clean tangent-space
striations; ceramic = subtle micro-tooth; observatory env = on-brand warm-brass/
ice studio — gorgeous). Patina maps wired into the opaque slab material
(blend-in over procedural noise via readiness uniform); env reserved for
boot/showcase lighting accents.

## W0 progress (S1)

- ✅ FAL_KEY **VALID** — authenticated probe returned 404-NOT_FOUND on fake request id
  (invalid key ⇒ 401). $0.00 spent.
- ✅ DESIGN-REFERENCES.md read IN FULL (1,066 lines). Chrome-applicable entries mapped:
  TSL/WebGPU §3 (core), SDF ray-march §8 (beveled chrome), noise §9 (micro-normals),
  postprocessing §4, curtains-distortion §1+§11, Lenis inertia §6, magnetic cursor §7,
  Barba/View-Transitions morphs §5/§14, GPU compute particles §3, perf §16.
- ✅ Baseline DPR2 screenshots captured: 13 frames →
  `notes/verification/fidelity2/baseline/before-*.png` (tier=t2, consoleErrors=0,
  dev server :4870, real Chrome Metal/WebGPU). Script: `scripts/fidelity2-baseline.mjs`.
- ✅ Own-eyes before-judgment: (1) preview-app hero = flat gray slab + filler content
  (worst offender, confirms Addendum 2); (2) chrome = good Observatory-Brass structure
  but flat CSS fills; (3) dead wells: Inspector LIVE PREVIEW solid black, Element Image
  purple-gradient placeholder, catalog tile thumbs read as gray skeletons.
- ✅ Wave-0 workflow `wf_2b178158-0dc` COMPLETE (6/6 agents, ~833k subagent tokens).
  Full reports persisted: `notes/verification/fidelity2/w0/*.md`.

## W0 DECISIONS (binding for W1-W5)

### Chrome architecture (W1) — single-canvas in-scene chrome
- page.tsx mounts ONLY GraphScene now (one R3F WebGPU canvas across all 3 modes) —
  chrome renders IN that canvas. Caveat: Canvas remounts on contentKey
  ('assembled'|'topology') flip; chrome setup must be remount-safe.
- Pattern: camera-parented ortho CSS-pixel group; instanced rounded-rect quads
  (rect, radii vec4, borderPx, styleId per instance); DOM twins keep layout + input +
  text (browser composites DOM text OVER canvas — slabs draw behind their DOM rect).
- TSL node graph on MeshPhysicalNodeMaterial: SDF rounded-box → fwidth AA →
  opacityNode; SDF-gradient bevel → normalNode (real GGX/Fresnel for free); styles:
  glass = backdropNode edge-lensing via viewportSafeUV + 3-tap RGB dispersion +
  viewportMipTexture roughness frost + Beer–Lambert attenuation; brushed metal =
  anisotropy ~0.8 along dock axis; ceramic = clearcoat 1. Evan-Wallace analytic
  shadow quads underneath.
- Pointer-reactive: real PointLight at pointer ray ∩ chrome plane (damped spring) +
  SDF border-band magnetic glow into emissiveNode. Hover/press = direct uniform writes.
- Tier: t2 = rendered chrome; t1/t0 keep Observatory-Brass CSS (materials.css intact).
  `data-ds-tier` switchboard already exists.
- Perf: one shared viewport copy + mip-gen for ALL glass (flat cost); 3-4 taps max;
  no per-panel FBOs; no gaussianBlur node; DPR≤2; budget <2ms median via
  three WebGPU timestamp queries / stats-gl.

### fal.ai model picks (June-2026 verified, prices in w0/research-fal-models-june2026.md)
- Image: `fal-ai/flux-2-pro` (4MP, ~$0.075) · cheap iteration `fal-ai/flux-2` dev $0.012/MP
  · max-res `fal-ai/bytedance/seedream/v4/text-to-image` 4096² $0.03
- Edit: `fal-ai/flux-2-pro/edit`; sparing `fal-ai/nano-banana-pro/edit` ($0.15-0.30)
- 3D: `fal-ai/hunyuan3d-v3/image-to-3d` $0.375+$0.15 PBR (GLB+PBR);
  text→3D `fal-ai/hunyuan-3d/v3.1/pro/text-to-3d`; fallback `fal-ai/trellis-2`
- Video loops: `fal-ai/kling-video/v3/pro/image-to-video` $0.112/s w/ end_image_url
  loop trick; cheap 4K `fal-ai/ltx-2/image-to-video`
- PBR micro-materials: `fal-ai/patina/material` (5 tileable maps ≤8K, ~$0.35@2K)
- Env: equirect panorama via FLUX.2-pro prompting (no true HDRI model on fal)
- Budget envelope: ~40 imgs + 20 meshes + 10 loops + 10 materials ≈ $30 → fits $50.

### Competitive brief (Slider Revolution, w0/research-slider-revolution.md)
Their ceiling: DOM compositing + isolated WebGL1/2 canvas islands — no unified scene,
no real lighting/materials (gloss is painted), transitions are background-only, ~3k
particle caps, text forever DOM. THE LINE: "SR decorates a flat page with
shader-warped pictures; we render an actual place." Every demo beat must show light
behaving correctly (refraction/reflection/relighting/occlusion) across content + text
+ chrome simultaneously. 13-point smash list in the report.

### Showcase scene blockers (w0/audit-showcase-scene.md)
1. Multi-hub wire format: `hub` singular in 4 places (types.ts:923 HomeHubJson,
   loader.ts:29-47, regen route.ts:71, useGraphSourceStore.saveToServer:397-419,
   build-live-prism.mjs:53/:109) — additive `hubs?:` fix. Runtime already multi-hub.
2. Hub activation never wired: PrismHost swaps camera rails on activeHubId change but
   never calls hubManager.activate — the morph-through attach point.
3. Video textures NOT supported — additive videoUrl + loadVideo lane needed.
4. 2-4K assets fine on live direct-URL path (no cap; atlas hard-caps 512 — bypass it).
   No KTX2 path; watch GPU memory.
5. New fonts need MSDF atlases (pipeline exists: font-registry + on-demand bake API).

### Gizmo fix (w0/audit-gizmo-offset-bug.md) — root-caused
TransformControls (a world-space helper) is mounted INSIDE the translated anchor group
(GraphScene.tsx:1944-1993) → handle world = 2·(sp+ct). Fix: render TransformControls
as a sibling outside the anchor; proxy stays inside. No math changes elsewhere.

## W3 SHOWCASE CREATIVE BRIEF (authored S1 — binding unless Logan overrides via inbox)

**Concept: "ORRERY No.7" — a celestial-mechanics timepiece by Atelier Prism.**
A flagship product-launch app for a fictional luxury watch whose movement is a
miniature orrery. Why this concept: (1) jewelry-grade macro photorealism is the
hardest premium bar — exactly what the engine must prove; (2) brass/sapphire/
meteorite materials ARE the Observatory-Brass language — app and editor chrome
resonate; (3) it weaponizes our strengths against Slider Revolution's flagship
genre (product showcase) — their Zero Point is flat art swaps; ours is a lit,
refracting, occluding place; (4) the watch CTA hero GLB already exists as a seed
and the fal observatory env panorama is already generated.

**The five hubs (story arc = descend INTO the mechanism, then out to the cosmos):**
1. **ARRIVAL** — the timepiece floats in deep space over a faint brass orrery
   ring. Headline "Time, machined." in molten-brass poured-texture MSDF. GPU
   dust drifts (time driver). Scroll pulls the camera THROUGH the sapphire
   crystal into the movement (fly-through + scroll driver) → morphs to hub 2.
2. **MOVEMENT** — exploded mechanism: photoreal gears/tourbillon as real 3D
   nodes under the lighting rig (Hunyuan3D), depth-rotate + orbit bindings,
   pointer-parallax macro photography planes (4MP), engraved kinetic-text specs.
3. **MATERIA** — "Brass. Sapphire. Meteorite." poured-texture text; 4K macro
   material imagery; VIDEO TEXTURE moment: molten-metal pour loop (Kling v3
   seamless); magnetic-cursor material swatches (pointer driver).
4. **CELESTIA** — the planetarium: orbiting planet objects (3D), star particle
   field, the observatory env, constellation kinetic-text. CLICK a planet →
   state-driver relight (per-section relighting — smash-list #9).
5. **ACQUIRE** — the watch on a pedestal under a key light; event-driver
   variant switching (dial/strap states); brass CTA; closing line.
All five drivers used: time (orbits/dust), scroll (fly-through/parallax),
pointer (magnetic/parallax), state (planet relight, variants), event (clicks).
Morph-through hub navigation: camera transit rails (already in runtime) +
displacement/dissolve transition primitives.

**fal asset plan (≈$8-10 of the $50):** ~8-10 3D meshes (watch re-gen at PBR
quality, 2-3 gears, tourbillon, 3-4 planets, pedestal) via hunyuan3d-v3
image-to-3d from FLUX.2-pro hero images (image→3D gives more art control than
text→3D); ~12-16 hi-res images (hub backdrops 4MP, macro materials, dial macro;
seedream 4096² for 2 ultra-wides — kills the 1024² ceiling); 1-2 Kling v3
5s loops ($0.56 ea); deep-space equirect panorama. Every asset vision-critiqued
before placement; rejects regenerated budget permitting.

**Structural pre-work (agent running):** multi-hub wire format (4 seams),
hubManager.activate on nav, additive videoUrl + loadVideo lane.

## Session log

- **S1 (2026-06-11):** First session. No prior ledger. Confirmed: FAL_KEY present,
  inbox empty, sentinel armed. Created ledger + 6-wave task structure. Next:
  DESIGN-REFERENCES full read → research → baselines.
