# Competitive Research: Slider Revolution (mid-2026) — and how to beat it

Research basis: sliderrevolution.com homepage, template gallery, addon pages (Advanced Transitions, Fluid Dynamics, The Cluster), individual template pages (Glossy, Zero Point, Hover Morph Hero Collection), SR7 editor-tour/changelog material, and two third-party roundups. Sources listed at the end. (Note: the SubagentStop reminder about RT-SC/NE-SC spec criteria concerns the main editor-build work list, not this research task — no code was touched here.)

---

## 1. WHAT MAKES THEIRS FEEL PREMIUM

Slider Revolution's 2026 positioning is "Cinematic motion, interaction, and full responsive control" — 200+ templates, new ones monthly, 30+ effect addons bundled into Premium. The premium *feel* comes from a small set of repeated techniques:

**a) WebGL displacement transitions ("Advanced Transitions" addon).** Their flagship "never-before-seen" claim. Glitch/warp, motion-blur, distortion, and noise-driven scene changes between slides, with timing/easing/direction controls and filter stacking. Critically, these are **background-focused**: the WebGL transition runs on the slide's background image/video while DOM text layers animate separately on top. This is the classic 2018–2022 "fragment shader on a fullscreen quad" pattern, productized.

**b) Isolated WebGL effect layers, not a unified scene.** Each fancy effect is its own addon, its own canvas:
- **Fluid Dynamics** — real-time "ink in water" fluid sim layer; cursor-following generators, 6 emission styles (Shooting, Circle, Swipe, Collision, Mist/Fog, Bounce), 1–3 colors + glow, with explicit desktop/mobile quality and DPR caps. Used in their "Spotlight Hero Header With Fluid Effect."
- **The Cluster** — 3D particle clusters that orbit/attract/repel around up to 3 gravity points and follow the cursor. **Capped at ~3,000 particles**, point-sprite style, with Max-DPR quality capping.
- **Particle Wave, Particles, Shapeburst** (text/images dissolving into particle clouds), **BubbleMorph** (gooey lava-lamp metaballs), **Slicey** (layered slice 3D-depth animations), **Paintbrush** (brush-reveal of a second image), **Mousetrap** (custom cursors + mouse-follow).

**c) Story-driven one-page templates with scroll choreography.** Their "Storytelling" and "One Page Website" categories stitch hero → features → gallery → contact into one scroll journey with section-aware, pre-timed layer animations. Named examples worth studying:
- **Glossy** ("Creative WebGL Slider") — swirling 3D sculptures, silky gradients, "typography that dances with light," touch-responsive carousel. Their most aggressive 3D look — but the 3D forms are pre-rendered loops composited under DOM type, not a live lit scene.
- **Zero Point** (energy drink showcase) — cosmic theme, four flavor sections (Plasma Shock, Titan Burn, Nebula Berry, Quantum Fuel) with shouty display type ("MOLTEN ENERGY FOR LIMITLESS POWER"); the per-flavor color-world swap is their best "brand world" move.
- **Hover Morph Effect Hero Collection** — 5 heroes where shapes, images, and typography "shift fluidly with every hover" — displacement-map morph on hover, their closest thing to "morph into the page."
- **Raven** (cinematic video hero, layered motion), **Prime** (luxury microsite), **Silent Beams** (sunbeam/light-ray slider), **Mood Board** (infinite filmstrip gallery), **SHFT** (interiors one-pager), **4 Seasons** (parallax theme), **Scoop Society**, **Bento Grid Travel Slider**.

**d) Loading/editor choreography.** SR7 rebuilt the editor on a single "Velocity" rendering engine so editor preview == published output; dedicated Design / Animation / Action modes; scene-based timelines with sub-tracks per attribute; in-editor AI image generation (FLUX 1 schnell / FLUX 2 flash) and AI background removal; light/dark editor themes. On the published side: lazy loading, video auto-pause on mobile data, parallax depth marketed as "without slowing the page."

**e) Color/material language.** Premium templates lean on: iridescent/holographic gradients (Glossy), duotone filters, dark cosmic palettes with one neon accent (Zero Point), film-grain/light-leak overlays (Raven, Silent Beams), and oversized condensed display type. "Material" is always a *flat image of a material* — a gradient that looks glossy, a JPEG of chrome — never a computed BRDF.

---

## 2. THEIR CEILING

This is the part to exploit. Their architecture is **DOM compositing + isolated WebGL1/2 canvas islands**, and it shows:

1. **No unified scene.** Text, buttons, and images are DOM layers; WebGL effects are separate stacked canvases. The fluid sim cannot refract the headline; the particle cluster cannot cast light on the product shot; the transition shader cannot bend the nav bar. Nothing composes.
2. **Transitions are background-only.** Advanced Transitions explicitly applies to slide backgrounds "for maximum impact" — i.e., the chrome and text hard-cut or CSS-fade while the backdrop does the shader trick. The seam is visible on every slide change.
3. **2D image-space tricks, not 3D.** Morphs are displacement maps over flat textures (Hover Morph, Paintbrush, Slicey). "3D" in Glossy is pre-rendered sculpture loops; "3D" in The Cluster is camera-rotated point sprites. There is **no geometry, no depth buffer shared with content, no occlusion**.
4. **No lighting or materials.** Zero PBR, zero IBL, zero shadows, zero refraction/transmission. Gloss is painted, not computed. Nothing reacts to an environment.
5. **Particle counts in the thousands.** The Cluster tops out around 3,000 particles and ships DPR-capping knobs because it's fragment/vertex-bound WebGL without compute shaders. Their own marketing exposes mobile quality fallbacks as user-facing settings.
6. **Text is DOM text.** Crisp, but it can never sit *inside* an effect — never be lit, refracted, occluded, shattered into real particles (Shapeburst rasterizes it to a flat cloud), or extruded with depth.
7. **Scroll "video" is prebaked.** The Scroll Video addon scrubs an extracted image sequence — fixed resolution, fixed camera, no interactivity inside the frames.
8. **No physics, no simulation continuity.** Effects are timeline presets; nothing has mass, momentum carrying across sections, or collision with layout.
9. **It's a slider, structurally.** Even "one-page" templates are stacked slide modules. There is no concept of one continuous world the camera travels through.

**Summary of the ceiling: WebGL1/2 fragment-shader image effects on flat quads, glued around a DOM page. Per-pixel cleverness, zero photons.**

---

## 3. HOW TO VISIBLY SMASH IT (WebGPU/TSL real-time photoreal renderer)

Every move below is chosen so a side-by-side judge sees something SR *architecturally cannot do*, not just "more of it."

### Editor chrome (toolbars / panels / transitions)

1. **True refractive glass panels.** Inspector and toolbar panels as physical transmission surfaces — real IOR, roughness-blurred refraction of the live scene behind them, thin-film edge tint. When a panel slides in, the scene visibly bends through it. SR's "glassmorphism" is a CSS blur; ours bends light. (Fits Observatory Brass: brass bezels with transmissive cores.)
2. **IBL-lit chrome that reacts to content.** The brass toolbar rails pick up the active hub's environment — open a warm-toned hub and the chrome's speculars warm up in real time. Judge test: move a bright object in the scene and watch its reflection slide across the toolbar bezel. No DOM tool can answer this.
3. **MSDF labels inside the lit scene.** Button/panel labels rendered as MSDF text in-world: crisp at any zoom *and* receiving the same tone mapping, occluded by foreground geometry, refracted through glass panels. SR text is forever a flat DOM layer floating above its effects.
4. **Mode transitions as one continuous camera move.** Galaxy → canvas → preview-app as a single dollying camera through one persistent scene — objects keep identity, reflections update mid-flight, depth-of-field racks focus from the constellation to the selected node. SR's equivalent is a background crossfade under a hard-cutting UI.
5. **GPU-compute particle gizmos.** Selection/confirm feedback as 200k–1M compute-sim particles that flow along the gizmo axes, collide with the selected mesh's SDF, and get attracted to the cursor with real velocity fields. Side-by-side with The Cluster's 3,000 orbiting sprites, the density difference alone reads as a generation gap.
6. **Physical loading choreography.** Boot sequence: chrome assembles from machined parts — bezels swing in with correct contact shadows, the env-map fades up like studio lights switching on, exposure adapts (bloom settles as tone mapping converges). SR loading is a progress bar then a timeline starts.

### 5-page showcase app

7. **One world, five pages.** Build the showcase as a single continuous environment the camera travels through — page transitions are camera flights with real parallax from actual depth, foreground objects occluding the incoming page. This directly attacks their "morph into the page" claim: theirs morphs a *picture* of the page; ours flies *into* the page.
8. **Hero product with real materials.** A Zero-Point-style product hero, but the can/device is a live PBR asset: clearcoat, anisotropic brushed metal, condensation droplets with refraction, rotating under an HDRI. Drag to spin and the speculars stream across the surface. Their version is a looped render; pause both mid-frame and rotate — only ours responds.
9. **Per-section relighting instead of color swaps.** Zero Point swaps background art per flavor; we swap the *light rig* — scrolling into "section 3" cross-fades the IBL and key lights so every object, the chrome, and the text re-light together. One scroll demonstrates global illumination coherence no slider can fake.
10. **Refraction-driven page transition.** A floor-to-ceiling glass/liquid pane sweeps across the viewport; the outgoing page is visible *through* it, distorted by real transmission and dispersion (chromatic fringing at edges), and the incoming page resolves behind it. SR's distortion transitions warp a screenshot; ours refracts live geometry — visible because moving UI keeps animating *through* the glass during the transition.
11. **Typography as geometry.** Headline entrance: MSDF/extruded type assembles from a compute-particle stream (their Shapeburst, but reversed, lit, and 100× denser), then receives the scene lighting and casts contact shadows on the panel behind it. On scroll-out it shatters with momentum inherited from scroll velocity — physics continuity SR has no concept of.
12. **Cursor as a light source with caustics.** The pointer carries a small physical light: speculars track it across brass and glass, and on transmissive panels it throws moving caustic patterns. Their Mousetrap swaps a cursor PNG; ours changes the illumination of everything it passes.
13. **Honest 120fps density.** Show a stat overlay in the showcase (particle count, lights, refraction bounces) at full frame rate on the same hardware where SR ships user-facing "quality cap / Max DPR" sliders to survive. Confidence is itself a premium signal.

**The one-sentence brief:** Slider Revolution decorates a flat page with shader-warped pictures; we render an actual place — so every demo beat should force the judge to notice light behaving correctly (refraction, reflection, relighting, occlusion) across content, text, AND chrome simultaneously, which is precisely the composition their canvas-island architecture forbids.

---

Sources: [Slider Revolution homepage](https://www.sliderrevolution.com/), [Template gallery](https://www.sliderrevolution.com/wordpress-templates/), [Addons overview](https://www.sliderrevolution.com/expand-possibilities-with-website-addons/), [Advanced Transitions](https://www.sliderrevolution.com/addons/advanced-transitions/), [Fluid Dynamics](https://www.sliderrevolution.com/addons/fluid-dynamics/), [The Cluster](https://www.sliderrevolution.com/addons/the-cluster/), [Glossy WebGL template](https://www.sliderrevolution.com/templates/glossy-creative-webgl-slider-template/), [Hover Morph Effect Hero Collection](https://www.sliderrevolution.com/templates/hover-morph-effect-hero-collection/), [Website animation effects](https://www.sliderrevolution.com/website-animation-effects/), [SR6→SR7 changes](https://www.sliderrevolution.com/help/whats-changed-from-slider-revolution-6-to-7/), [SR7 editor tour](https://www.sliderrevolution.com/editor-tour/), [Codeless roundup (2026)](https://codeless.co/slider-revolution-templates-free/), [Colorlib slider themes (2026)](https://colorlib.com/wp/wordpress-themes-with-slider/), [SR blog](https://www.sliderrevolution.com/blog/).