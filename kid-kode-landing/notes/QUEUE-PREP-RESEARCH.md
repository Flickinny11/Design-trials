# QUEUE-PREP — current-tooling research log

**Date searched: 2026-06-14.** Method per Logan's standing preference: training is ~1yr stale,
so for each domain I web-searched the CURRENT June-2026 best-in-class, then deliberately compared
my first instinct against the newest options and justified the pick. Cross-checked against
`docs/prism/DESIGN-REFERENCES.md` (the existing toolkit) and `src/lib/prism-graph/types.ts`
(the additive schema). Picks that already exist in the repo toolkit are noted as "already wired".

Legend: 🥇 = chosen, 🆕 = newer-than-first-instinct upgrade, ✅ = already in repo toolkit.

---

## DOMAIN A — 3D BACKGROUND LIBRARY

Goal: a library of massive, depth-scattered 3D backgrounds for hubs/scenes. Image +
REAL-3D-sprinkle HYBRID (a base image/diffusion layer with real depth-scattered 3D elements
layered into space), animated + customizable, CAMERA-JOURNEY ready (works with the P2
`PrismHub.cameraKeyframes` journeys), premium + fast on mobile/constrained, each one a reusable,
droppable, customizable asset bound to a hub background layer (`PrismHub.background` ⇒
`PrismHubBackgroundLayer[]`, attachment ∈ viewport-fixed|camera-locked|parallax|world|
infinite-environment; depthLayer 'environment' or 'background').

### A1 — Base image / diffusion layer (the "image" half of the hybrid)
- **First instinct:** FLUX.1 [dev]/[pro] on fal (what the repo's `prism-fal` skill last locked).
- 🆕🥇 **FLUX.2 family on fal** (`fal-ai/flux-2-*`) — 32B, multi-reference support, enhanced
  typography, Pro/Dev/Flex/Max variants. **FLUX.2 [dev] Turbo** (fal's own distill, "10x cheaper,
  6x more efficient", released around New Year 2026) is the budget-aware pick for high-res
  background plates; **FLUX.2 [flex]** when you need control (steps/guidance). FLUX1.1 [pro] held
  the top Elo on the Artificial Analysis image arena.
  - Source: https://fal.ai/flux-2 , https://fal.ai/models/fal-ai/flux-2-flex ,
    https://venturebeat.com/technology/new-years-ai-surprise-fal-releases-its-own-version-of-flux-2-image-generator
- Alt: **GPT Image 2** (OpenAI, on fal) — extreme detail + typography; pricier. Not needed here
  (INV-11 forbids diffusion-drawn letterforms — backgrounds carry NO text; negative prompt must
  include "no text, no letters, no labels").
- **Why for purpose:** the base plate is an `equirect`/wide environment image used as the
  furthest depth layer (skybox-style `infinite-environment` or a giant `world` plane). fal is
  budget-OK per the prompt but **procedural is strongly preferred** where it reads premium — the
  base image is the FALLBACK / richness booster, not the default for every background.

### A2 — Depth-from-image → parallax (turns a flat plate into volumetric depth)
- **First instinct / ✅ already wired:** FAL `depth-anything/v2` → `renderMode: 'parallax-plane'`
  (canvas spec §4: "image + depth map (FAL depth-anything/v2), depth-displaced for parallax";
  schema already carries `depthMapUrl` + `parallax-plane`).
- 🆕 **Depth Anything V3 (DA3, ICLR 2026)** — spatially-consistent geometry from arbitrary views;
  notably better on the exact hard cases backgrounds hit (backlit skies, low-light interiors,
  reflective surfaces). Recommended as an OPTIONAL quality upgrade for the depth bake where DA3 is
  reachable; **DA2 stays the proven default** (already integrated, cheaper) so the run never blocks
  on a new dependency.
  - Source: https://depth-anything-3.github.io/ , https://blog.roboflow.com/depth-anything-3/
- **Apple Depth Pro** — sharp metric monocular depth in <1s; alternative if a metric scale is ever
  needed. Not required for parallax (relative depth suffices).
- **Why for purpose:** depth-displacement of the base plate is the cheapest way to make the
  "image half" of the hybrid feel 3D and respond to the camera journey (parallax by `parallaxDepth`
  on the layer). This is the bridge between the flat plate and the real-3D sprinkle.

### A3 — Volumetric / nebula / atmosphere (the premium procedural core)
- **First instinct:** FBM + domain-warp fragment shader (DESIGN-REFERENCES §9 already has this).
- 🥇 **Raymarched volumetrics in TSL/WebGPU** with the modern physically-inspired recipe:
  **Beer-Lambert absorption + Henyey-Greenstein phase function + light-marching for
  self-shadowing** (dense gas extinguishes color while in-scattering other colors). This is the
  2026 standard and a clear step up from flat FBM planes.
  - Sources: Maxime Heckel "Field Guide to TSL and WebGPU"
    https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/ ;
    `dgreenheck/webgpu-galaxy` (TSL+WebGPU nebula/galaxy, alpha-blended particles, configurable)
    https://github.com/dgreenheck/webgpu-galaxy ;
    `CK42BB/procedural-clouds-threejs` (WebGPU raymarching + **WebGL2 billboard/mesh fallback** —
    the exact tier-down pattern we need for mobile) https://github.com/CK42BB/procedural-clouds-threejs
- ✅ **Already in repo:** `src/lib/prism/animatable/primitives/nebula.ts` + `clouds.ts` exist in the
  406-primitive catalog — the background library should COMPOSE/extend these, not reinvent.
- **Why for purpose:** procedural volumetrics are resolution-independent, animate for free (time
  uniform), cost nothing in download, and read as true premium atmosphere — the antidote to the
  "oval pasted on a flat background" defect PROD-FINISH just fixed. Tier-gate the raymarch step
  count (T2 full raymarch, T1 fewer steps, T0 billboard/FBM fallback).

### A4 — Procedural particle / starfield (the depth-scattered sprinkle, cheap layer)
- 🥇 **WebGPU compute particles via TSL `instancedArray`** — CPU caps ~50k; WebGPU compute pushes
  to 500k–1M (official three.js `webgpu_compute_particles` runs 500k; `webgpu_compute_points` 300k).
  Persistent GPU buffers survive frames; perfect for drifting starfields/dust/embers scattered in
  real Z so the camera journey moves THROUGH them (true parallax, not a flat star texture).
  - Sources: https://threejs.org/examples/webgpu_compute_particles.html ;
    https://threejsroadmap.com/blog/galaxy-simulation-webgpu-compute-shaders ;
    https://wawasensei.dev/courses/react-three-fiber/lessons/tsl-gpgpu
- **Mobile/constrained:** tier down to an instanced `THREE.Points` field (tens of thousands) or a
  static depth-scattered sprite cloud — same look, no compute pass.
- **Why for purpose:** this is the literal "depth-scattered 3D elements layered into space" the run
  asks for; GPU compute makes it lightning-fast even at high counts.

### A5 — Gaussian-splat backgrounds (photoreal captured environments)
- **First instinct / ✅ referenced:** `gsplat.js` + `@mkkellogg/gaussian-splats-3d`
  (DESIGN-REFERENCES §13); canvas spec §4 names **Spark** (`@sparkjsdev/spark`) for the `splat`
  render mode.
- 🆕🥇 **Spark 2.0 (April 2026, World Labs)** — adds a **Level-of-Detail system that streams +
  renders huge 3DGS worlds on any device**, supports `.PLY`(compressed)/`.SPZ`/`.SPLAT`/
  `.KSPLAT`/**`.SOG`** (SOGS: ~1M gaussians w/ full SH in ~14MB). This is the 2026 pick for a
  photoreal captured background that the camera can fly into.
  - Sources: https://www.worldlabs.ai/blog/spark-2.0 , https://sparkjs.dev/ ,
    https://github.com/sparkjsdev/spark , https://swyvl.io/blog/best-gaussian-splat-viewers/
- **Caveat:** splats are the heaviest path. Gate to desktop/T2; provide a baked-still or volumetric
  fallback on mobile. Use as a SPECIAL-CASE premium background, not the default.
- **Why for purpose:** when a hub wants a real-world cinematic environment (a real observatory, a
  nebula capture), a streamed splat beats any procedural look — but only where the device can hold it.

### A6 — SYNTHESIS — the hybrid background as a LAYER STACK
The background library entry = a small, typed, parameterized **layer stack** bound to
`PrismHub.background` (each `PrismHubBackgroundLayer`), composited back-to-front:
1. **Far env** — `infinite-environment` skybox: procedural volumetric nebula (A3) OR fal base
   plate (A1), tier-gated.
2. **Mid depth** — `parallax`/`world` plate(s) depth-displaced (A2) for the "image half" parallax.
3. **Scatter** — `world` GPU-compute particle field (A4) in real Z (the depth-scattered sprinkle).
4. **(opt) Splat** — `world` Spark splat (A5) for photoreal hubs, desktop/T2 only.
5. **Near FX** — `camera-locked` foreground motes/godrays (compose existing primitives).
Each layer's `parallaxDepth`/`z`/`opacity` are customizable; the whole asset is droppable and
re-skinnable. Every layer is camera-journey-ready because it lives in scene Z and is read by the
runtime against the `cameraKeyframes` journey — no special-casing. Mobile/constrained tiering:
swap A3 raymarch→billboard, A4 compute→points, drop A5 entirely. NO 2nd renderer — all
Three.js r184+/TSL/WebGPU.

---

## DOMAIN B — GUIDED TIPS (glowing-lightbulb first-visit walkthrough)

Goal: a glowing lightbulb affordance (top-right) that launches a first-visit walkthrough where
Prism DRIVES the screen — an animated cursor moves + highlights areas, high-tech popups appear
with the relevant artifact animated in 3D + premium-type explanation + Skip/Close controls; built
from the 406+ primitives + DESIGN-REFERENCES; skippable, dismissible, first-visit-aware,
re-triggerable from the lightbulb; the advocate verifies by actually triggering + stepping through.

### B1 — Tour / spotlight / coach-mark libraries (2026 landscape)
- 🥇 **Driver.js** — best-in-class **spotlight cutout** (highlights an element, dims everything
  else), **zero dependencies**, tiny. We adopt its spotlight TECHNIQUE (SVG-mask / box-shadow
  scrim cutout) for DOM-chrome steps. Strictly tour+spotlight (no analytics) — exactly the scope.
- **Onborda** — Next.js + Tailwind + shadcn, React 19 native — BUT **documented to have NO a11y**
  (no ARIA, no keyboard nav, no focus trap). Convenient but fails Logan's bar; rejected as the core.
- **Shepherd.js** — strong a11y + deep customization, actively maintained (release March 2026),
  but its React wrapper has React-19 compatibility issues. Good fallback reference for a11y patterns.
- **React Joyride** — simplest, free, but becomes "something you orchestrate" once tours are
  conditional/multi-route — and it can't do scene-spotlight or 3D popups at all.
- **userTourKit / Tour Kit / OnboardJS** — React-19-native; userTourKit notable for a11y +
  framework flexibility.
  - Sources: https://www.chameleon.io/blog/javascript-product-tours ,
    https://usertourkit.com/blog/what-is-best-react-product-tour-library ,
    https://userorbit.com/blog/best-open-source-product-tour-libraries ,
    https://onboardjs.com/blog/5-best-react-onboarding-libraries-in-2025-compared
- **Jimo "Smart Cursors"** (SaaS, not a lib) — animated cursors that auto-advance on real user
  events, "2× conversions vs traditional tours." Concept reference for the cursor-driving feel.
  - Source: https://jimo.ai/blog/best-product-tour-software

### B2 — Cursor-driving (Prism moves the pointer)
- ✅ **Already in DESIGN-REFERENCES §7:** `mouse-follower` (Cuberto, GSAP-based, skew/magnetic) +
  the lerped custom-cursor pattern. We DRIVE this programmatically: animate a synthetic cursor
  along an authored path (GSAP/Motion timeline) between step targets, with the magnetic-snap +
  skew feel so it reads like a confident product demo, not a jumpy tooltip.
- **Why:** off-the-shelf tour libs jump a tooltip to each target; a smoothly driven cursor that
  travels + clicks is the "Prism drives the screen" premium feel the run demands.

### B3 — Scene-spotlight + 3D-artifact-in-popup (the part NO library does)
- Prism renders into a **WebGPU canvas**, so a DOM tooltip/spotlight can't dim around a 3D
  artifact. The walkthrough must: (a) **scene-spotlight** — darken the live 3D scene except a
  framed artifact (vignette/scrim composited in-scene or a postprocessing focus pass), and
  (b) **render the relevant artifact animated in 3D inside the popup** (a small in-scene framed
  view or a mini R3F/Three view sharing the renderer — NO 2nd renderer). Built from the 406+
  primitives (glass/dispersion, holographic, glitch-in, depth-rotate, kinetic-text) +
  DESIGN-REFERENCES (postprocessing bloom/vignette, TSL). This is bespoke by necessity.
- **Premium type:** real MSDF text (INV-11) for the explanation copy, Observatory-Brass tokens,
  NO purple.

### B4 — Accessibility & "non-cheesy" discipline (2026 bar)
- **prefers-reduced-motion** — the lowest-effort/highest-impact a11y win; on reduced-motion, the
  walkthrough must fall back to static framed steps (no cursor fly, no heavy 3D motion) and keep
  on-page controls. WCAG 2.2 is the current normal in 2026.
- **Focus management** — focus trap within the active popup, full keyboard nav (Tab/Shift-Tab,
  Enter=next, Esc=close/skip), ARIA roles/labels on every step. (Onborda's lack of this is exactly
  why we don't lean on it.)
- **Skippable / dismissible / first-visit-aware / re-triggerable** — persist a "seen" flag
  (localStorage) so it auto-launches once on first visit; the lightbulb re-triggers on demand;
  Skip + Close always present.
  - Sources: https://webaim.org/blog/2026-predictions/ ,
    https://blog.openreplay.com/prefers-reduced-motion-accessible-animation/ ,
    https://usertourkit.com/compare/tour-kit-vs-onborda

### B5 — SYNTHESIS — the pick
**A thin BESPOKE walkthrough controller**, a11y-first, that:
- borrows **Driver.js's spotlight-cutout technique** for DOM-chrome steps (vendor Driver.js only
  if lighter than bespoke; default = bespoke SVG-mask scrim so we own a11y + the premium look),
- **programmatically drives the existing `mouse-follower`/lerped cursor** (DESIGN-REFERENCES §7)
  along authored step paths,
- composes **scene-spotlight + 3D-artifact popups** from the 406+ primitives + DESIGN-REFERENCES
  (the part libraries can't do),
- is **first-visit-aware, skippable, dismissible, re-triggerable from the glowing lightbulb**, and
- honors **prefers-reduced-motion + focus trap + keyboard + ARIA**.
Off-the-shelf full tour libs (Onborda/Joyride) are rejected as the core because they can't touch
the WebGPU scene and (Onborda) ship no a11y; their PATTERNS (Driver.js spotlight, Jimo smart
cursor, Shepherd a11y) inform the bespoke build. NO new heavy dependency required.

---

## PROPOSED DESIGN-REFERENCES.md ADDITIONS
(Proposals only — this run does not edit docs. The build agent decides; add ONLY where a 2026 tool
clearly beats the existing toolkit.)

1. **§3/§13 — Spark 2.0 (April 2026) LoD streaming** for 3DGS: `.SOG`/`.SPZ`/`.KSPLAT`, ~1M
   gaussians @ ~14MB, streams huge worlds on any device. Beats the bare `gsplat.js`/`@mkkellogg`
   mention already present. (https://sparkjs.dev/ , https://www.worldlabs.ai/blog/spark-2.0)
2. **§13 — Depth Anything V3 (ICLR 2026)** as the parallax-depth upgrade over the V2 the repo
   wires today (better on backlit/low-light/reflective). Keep V2 as the proven default.
   (https://depth-anything-3.github.io/)
3. **§9/§3 — Volumetric raymarch recipe in TSL**: Beer-Lambert absorption + Henyey-Greenstein
   phase + light-marching self-shadow, with a WebGL2 billboard fallback. The doc has FBM/
   domain-warp but not the modern volumetric phase-function recipe. Refs: Maxime Heckel TSL field
   guide; `dgreenheck/webgpu-galaxy`; `CK42BB/procedural-clouds-threejs`.
4. **§3 — TSL GPU-compute particles** (`instancedArray`, 300k–1M) for depth-scattered starfields/
   dust, with an instanced-`Points` mobile fallback. (three.js `webgpu_compute_particles`.)
5. **New small "Onboarding / Guided Tours" note** (or a line in §7): Driver.js (spotlight cutout,
   zero-dep) as the highlight technique; note Onborda's a11y gap and Shepherd's a11y strength;
   Jimo Smart Cursors as the cursor-driven concept reference.

---
## SELF-INSTINCT-VS-NEWEST scorecard (kill training-data bias)
| Domain | First instinct | Newest found (2026) | Picked | Why |
|---|---|---|---|---|
| Base image | FLUX.1 dev/pro | FLUX.2 [dev] Turbo / Flex | 🆕 FLUX.2 Turbo | cheaper/faster/32B; procedural still preferred |
| Depth | depth-anything/v2 (wired) | Depth Anything V3 (ICLR'26) | V2 default + 🆕 V3 optional | V2 proven/cheap; V3 better hard cases |
| Volumetric | flat FBM plane | TSL raymarch + HG phase + light-march | 🆕 raymarch | true premium atmosphere, tier-gated |
| Particles | CPU points (~50k) | WebGPU compute instancedArray (~1M) | 🆕 compute | 20× count, real-Z parallax, fast |
| Splat | gsplat.js/@mkkellogg | Spark 2.0 LoD streaming (.SOG) | 🆕 Spark 2.0 | streams huge worlds, any device |
| Tour | React Joyride / build-all | Driver.js + bespoke scene-spotlight | bespoke + Driver.js technique | libs can't touch WebGPU scene; a11y |
| Cursor | new lib | drive existing mouse-follower §7 | reuse §7 | already in toolkit; no new dep |
