# Recon — Dependency Usage (UI-WOW-2)

Surface: **dependency-usage**. Repo: `kid-kode-landing`. Read-only.
Goal: map where each combinable dep is *already* used, with file:line anchors, and identify
concrete cross-dep combinations for a contract-first WOW redesign.

Reference skimmed: `docs/prism/DESIGN-REFERENCES.md` §15 Integration Recipes (L979-1009) + §16
Performance Patterns (L1011-1048). Forbidden-pattern enforcement: `.claude/hooks/anti-drift-check.sh`.

---

## TL;DR dependency status table

| Dep | Installed | Used in src/? | Where (primary) | One-line state |
|---|---|---|---|---|
| **gsap** 3.13 | yes | **Heavily (30 files)** | chrome-layer, all flyouts, runtime primitives | Workhorse: mode-morph sweeps, panel reveals, magnetic, primitive tweens |
| **lenis** 1.3 | yes | **1 hook, 1 consumer** | `design-system/use-lenis.ts` → `ElementLibraryBrowser.tsx` | Momentum scroll on element-library grid ONLY; under-used |
| **camera-controls** 3.1 | yes | GraphScene (via drei) | `GraphScene.tsx` ControlsBridge + `lib/editor/canvas-camera.ts` | Galaxy free-cam + canvas guard-railed cam (bounded dist/polar/azimuth/pan) |
| **simplex-noise** 4.0 | yes | **NONE — dead import** | (installed, zero `src/` imports) | Bundled but invisible; biggest untapped lever |
| **d3-force-3d** | yes | 2 files | `lib/useForceGraph.ts`, `prism-graph/hub-geometry.ts` | Node-positioning force sim for galaxy/hub layout |
| **postprocessing** 6.37 | yes | GraphScene | `GraphScene.tsx` (Bloom/CA/Vignette/Noise/SMAA) | **GATED OFF under WebGPU** (the default renderer) — see CONSTRAINT |
| **@react-three/postprocessing** 3 | yes | GraphScene | `GraphScene.tsx` EffectComposer | Same gate — WebGL2-only path |
| **three/tsl** | yes | **187 files** | runtime primitives, chrome-layer | The real shader layer (TSL-only, no GLSL) |
| **three/webgpu** | yes | GraphScene + runtime | `GraphScene.tsx:25` `WebGPURenderer` | Default renderer, WebGL2 auto-fallback |
| **drei** 10 | yes | GraphScene | `GraphScene.tsx` (CameraControls, AdaptiveDpr, PerformanceMonitor) | R3F helpers |
| **MagneticCursor** (in-house) | n/a | 1 mount | `overlays/MagneticCursor.tsx` → `app/page.tsx:848` | Global signature cursor (rAF, CSS `.is-warm`) |
| **text-fill** (prompt→texture) | n/a | feature cluster | `text-fills/procedural-fills.ts` + `text-tools/FillEditor.tsx` | Deterministic procedural pigment tiles poured into MSDF coverage |
| **View Transitions API** | n/a | **NOT used** | only named in 2 primitive comments | No `startViewTransition`, no `::view-transition` CSS anywhere |

---

## 1. gsap 3.13 — the workhorse (30 src files)

Imported via `import { gsap } from 'gsap'`. Three distinct usage tiers:

### a) Chrome-layer mode choreography (the signature reveal)
`src/components/editor/chrome-layer/ModeTransitionConductor.tsx`
- **L78-85** boot "lights coming on" — `gsap.to({x,y})` drives a synthetic `pointermove` so the
  GPU chrome slabs' pointer-light uniform sweeps across the chrome once at boot.
- **L104-111** hub-morph (preview-app page turns) — slides a real refractive glass pane across.
- **L129-160** mode-morph — staggered surface reveal (`gsap.fromTo` `expo.out`, stagger 0.045,
  L129-141) + a travelling glass sweep pane timed to mask galaxy↔canvas remount (L153-159).
- Key trick (L18-19, L146): the GPU chrome slabs track DOM rects per frame, so animating the DOM
  twin animates the rendered glass material "for free."

### b) Shared chrome interaction hooks
- `src/components/editor/design-system/use-reveal.ts` — one shared `useReveal()` hook
  (L40-53: `gsap.context` + `fromTo` stagger, `expo.out`/`power3.out`); consumed by
  `overlays/CanvasToolbar.tsx`. Replaces ~8 copy-pasted reveal blocks.
- `src/components/editor/animation-tools/magnetic.ts` — `attachMagnetic(el)` pointer-proximity
  lean (L30-31 `gsap.quickTo`, L50-57 `elastic.out` release). Consumed by **7 flyouts**:
  ImageFlyout, AddElementFlyout, Glb3DPreview, ModelPicker, ArtifactLibraryPanel,
  AnimationFlyout, ObjectFlyout. **Axis-aligned translate/scale ONLY** — tilt/rotation forbidden
  on SharedViewport ancestors (the scissor rig re-reads axis-aligned rects per frame, L8-13).
- `src/app/page.tsx:891-894` — view-mode toggle thumb slide (`gsap.set`/`gsap.to` `back.out(1.5)`).

### c) Runtime cinematic primitives (10 of the 9-seed library + animatable)
`src/lib/prism/runtime/shared/primitives/*` — orbit, depth-rotate, dissolve-morph,
displacement-transition, fly-through, kinetic-text, magnetic-cursor, parallax-scroll,
particle-emerge use GSAP timelines for the in-scene node animation. Plus
`lib/prism/animatable/bindings.ts` and `primitives/scroll-scene-scrub.ts`.

**Performance note (DESIGN-REFERENCES L1013-1015):** all GSAP here is transform/opacity + rAF —
already on the GPU-compositing happy path; `quickTo`/`context.revert()` used correctly.

## 2. lenis 1.3 — momentum scroll (UNDER-USED)

`src/components/editor/design-system/use-lenis.ts` — scoped `Lenis` instance (L46-54:
`wrapper`/`content`, lerp 0.12, custom expo easing), inert on coarse-pointer + reduced-motion
(L40-42), cleans up rAF + `lenis.destroy()` (L67-71).
- **Only consumer:** `src/components/editor/elements/ElementLibraryBrowser.tsx` (the 36-cluster
  element-library grid). The doc-comment (L4-7) admits it was a dead import until UI-WOW P2.
- **Gap:** the inspector body, animation catalog, and toolbar dock are named in the comment as
  intended targets but are NOT yet wired. Big easy win.

## 3. camera-controls 3.1 — the cinematic camera (via drei `CameraControls`)

`src/components/editor/graph/GraphScene.tsx` (drei re-exports yomotsu/camera-controls):
- Two `ControlsBridge` controllers. **Galaxy/free** (L1380-1383): `minDistance=8 maxDistance=600`
  — unconstrained nav. **Canvas guard-railed** (L1559-1566): `min/maxDistance`, `min/maxPolarAngle`,
  `min/maxAzimuthAngle` from a per-hub `rail`, plus `setBoundary(box)` pan clamp (L1497-1514).
- `src/lib/editor/canvas-camera.ts` — pure deterministic pose math (standoff `+Z 18`, L20-21;
  round-trip pose restore L44-55). Feeds the bridge; never owns store objects.
- Note (L463): pointermove ticks during camera-controls inertia are a known throttle point.

## 4. simplex-noise 4.0 — INSTALLED, ZERO USAGE (top opportunity)

`grep -rln simplex src/` → **nothing.** Not imported anywhere. The procedural needs that *would*
use it are currently hand-rolled: `text-fills/procedural-fills.ts` ships its own value-noise
lattice (L48-60) + mulberry32 PRNG (L36-44) instead of simplex. DESIGN-REFERENCES §15 WebGL recipe
(L1001) explicitly pairs `simplex-noise` with TSL/WebGPU compute for procedural generation. This is
the single biggest "installed but invisible" lever.

## 5. d3-force-3d — graph layout physics

- `src/lib/useForceGraph.ts:282-299` — `forceSimulation(...,3)` (3D), `forceLink` (L286),
  `forceManyBody(-110)` charge (L296), `forceCenter` (L297), `forceCollide(7.2)` (L299).
  Drives node scatter inside each hub. Consumed by `ArtifactNode.tsx`, `GraphScene.tsx`.
- `src/lib/prism-graph/hub-geometry.ts` — deliberately RE-derives the galaxy orbital math
  (FNV-1a hash → ring/angle, L26-47) rather than import d3, to stay React/`'use client'`-free for
  the renderer + drag listener. `findNearestHub` linear scan for clone auto-snap.

## 6. postprocessing 6.37 + @react-three/postprocessing 3 — GATED OFF UNDER WEBGPU

`src/components/editor/graph/GraphScene.tsx`:
- Imports `EffectComposer, Bloom, ChromaticAberration, Vignette, Noise, SMAA` (L16-22) +
  `BlendFunction` from bare `postprocessing` (L23).
- Two pipes: galaxy (L2637-2648: Bloom 0.85 + CA + Vignette + Noise + SMAA) and preview/canvas
  (L2994-2996: Bloom 0.35 + SMAA).
- **CRITICAL CONSTRAINT (L2540, L2897):** `const usePost = qualityMode !== 'low' && !isWebGPU`.
  The @react-three/postprocessing `EffectComposer` targets `WebGLRenderer` only and **cannot run
  under WebGPU** (commented L3106-3107, INV-R14). Since `three/webgpu` is the DEFAULT renderer,
  **the bloom/CA/vignette pipeline is OFF for most users** — it only lights up on the WebGL2
  fallback path. Any WOW that "adds bloom" must instead be expressed as a **TSL post node / emissive
  bloom in-material** under WebGPU, not by leaning on this EffectComposer.

## 7. three/tsl + three/webgpu — the real shader layer (187 files)

- `three/webgpu` `WebGPURenderer` (`GraphScene.tsx:25`) is the default; auto WebGL2 fallback
  since three r171 (L3069-3073). One bundled `three` instance (RT-SC-02 / FP-R1).
- TSL is the ONLY shader path (raw GLSL forbidden). 187 files import `three/tsl`. The chrome glass
  slabs use it via `chrome-layer/tsl.ts` (permissive `TSLNode` re-export, L1-30) → `material.ts`.
  Runtime primitives (`lib/prism/animatable/primitives/*`: nebula, ink-swirl, dispersion,
  hyperspace-warp, refraction-warp, smoke-*, fireball-burst, domain-warp-morph, velvet-sheen…)
  are all TSL. This is where procedural noise + refraction WOW must live under WebGPU.

## 8. MagneticCursor (in-house, NOT a package)

`src/components/editor/overlays/MagneticCursor.tsx` — soft ring + hot dot, plain rAF lerp
(L67-75), magnetic snap toward interactive element centers (L46-57, `INTERACTIVE` selector L21).
Mounted once globally at `src/app/page.tsx:848`. Inert on coarse-pointer + reduced-motion (L29-31).
**Chrome-rule discipline (L14-17):** sets ONLY `transform`+`opacity` imperatively; warm/press
visual is the CSS class `.ds-cursor-ring.is-warm` (materials.css) — never imperative
`.style.background`. Augments (never hides) the OS cursor (a11y-safe).

## 9. text-fill — prompt→texture (deterministic procedural)

- `src/components/editor/text-fills/procedural-fills.ts` — bakes 256×256 pigment tiles to PNG data
  URLs (`generateProceduralFills`). Deterministic per `<prompt>::<style>::<index>` via xmur3 hash
  (L25-34) + mulberry32 (L36-44) — no Math.random/Date. Hand-rolled value-noise (L48-60). DOM
  canvas allowed here because it lives under `src/components/**`, NOT `src/lib/prism/**` (L13-15).
- `src/components/editor/text-tools/FillEditor.tsx` — UI kind-switcher solid|gradient|texture|
  ai-texture (L24-29). AI path is honest: 10 client-side procedural candidates per batch
  (L31-45), cloud endpoint `/api/prism/text-fill` probed once and shows `{wired:false}` note
  (L11-12). Candidates render as the user's OWN text in 3D via `TextFillPreviewStrip`.
- **Invariant:** every kind pours pigment into MSDF glyph coverage (the alpha mask) — code NEVER
  draws a letterform (INV-11/FP-02). `fal` word must never surface in UI; the "AI" label + probe
  pattern already respect this.

## 10. View Transitions API — NOT used

No `startViewTransition`, no `::view-transition` / `view-transition-name` CSS in `src/`. Only two
*comments* in animatable primitives (`morph-into-card.ts:7`, `swap-flip-morph.ts:7`) reference the
concept as inspiration. DESIGN-REFERENCES lists it (§14, §15 L987/L1007) as a page-transition
option. Note: with one continuous WebGPU scene (no page nav / no DOM panes swapping), VT API has
limited applicability — the in-scene morph is the right analog, already done in TSL primitives.

---

## WOW combination ideas (cross-dep, contract-first)

Combining per DESIGN-REFERENCES §15 "Product Landing with 3D Hero" stack (R3F + drei +
postprocessing + Lenis + TSL + GSAP):

1. **simplex-noise (TSL) + camera-controls + GSAP → cinematic galaxy entrance.** Resurrect the dead
   simplex dep as a TSL noise field (nebula/dust) in the galaxy backdrop; GSAP-tween a
   `camera-controls.dollyTo`/`rotateTo` fly-in on boot, synced with the existing
   ModeTransitionConductor boot sweep. The 3 levers (procedural noise + scripted camera + glass
   sweep) fire as ONE choreographed "the world powers on" moment.
2. **Lenis + GSAP scroll-scrub + TSL → momentum-driven scene parallax.** Wire `useLenis` into the
   inspector + animation-catalog (currently unwired), and bridge Lenis scroll velocity into the
   already-present `scroll-scene-scrub.ts` primitive so scrolling chrome subtly parallaxes the live
   scene depth — premium tactile coupling between chrome and the WebGPU world.
3. **TSL emissive-bloom in-material (replaces the gated EffectComposer) + MagneticCursor pointer-
   light.** Since postprocessing bloom is OFF under WebGPU, express selection/hover glow as a TSL
   emissive bloom node driven by the same pointer position MagneticCursor tracks — the cursor's
   warm snap and the node's glow share one uniform, so hovering a node visibly "ignites" it.
4. **camera-controls guard-rail + GSAP elastic → canvas "snap to subject."** On node-select in
   canvas, GSAP-ease `camera-controls.fitToBox`/`moveTo` to frame the artifact within the existing
   per-hub rail, with an `elastic.out` settle matching the magnetic flyout language — one consistent
   "magnetic" motion vocabulary across cursor, tiles, and camera.
5. **simplex-noise + text-fill procedural pipeline.** Swap the hand-rolled value-noise in
   `procedural-fills.ts` for true simplex (richer organic pigment), and offer the same noise field
   as a live TSL animated text-fill (shimmer) — unifying the prompt→texture feature with the shader
   layer instead of static PNG bakes.
6. **GSAP + d3-force-3d → "settle" choreography.** When entering galaxy, run the force sim a few
   ticks then GSAP-tween nodes from a collapsed origin to their force-resolved positions
   (`stagger`) — a living "constellation assembling" reveal instead of an instant layout pop.

---

## RISKS / constraints that bound edits here

- **One renderer only.** `three/webgpu` (WebGL2 fallback), one bundled `three` (FP-R1/INV-R1). No
  PixiJS, no second visible renderer, no CDN-vs-bundled split.
- **postprocessing EffectComposer is WebGPU-incompatible** → gated OFF for default users
  (`usePost = ... && !isWebGPU`, GraphScene L2540/L2897). Do NOT design WOW around it; use TSL post
  nodes / emissive bloom for the WebGPU path (INV-R14).
- **TSL only, no raw GLSL** (FP enforced). New shader WOW = TSL via `chrome-layer/tsl.ts` permissive
  re-export or runtime `tsl-types.ts`.
- **No `document.*`/`window.*` in `src/lib/prism/**` runtime/node modules** (FP-05, only
  `window.devicePixelRatio`). MagneticCursor/use-lenis live under `src/components/**` where DOM is OK.
- **Chrome-rule:** no imperative `.style.background`/`border`/`boxShadow` — transform+opacity only;
  visual state via CSS classes (MagneticCursor L14-17 is the model). Design-tokens-only styling
  (`tokens.css`/`materials.css`), no hardcoded hex where a token exists.
- **NO PURPLE.** Palette is brass / bone / ice. `hub.color` never tints chrome.
- **Never surface "fal" in UI.** text-fill AI path already uses "AI" label + honest probe.
- **Additive-only schema** (INV-18); canonical view modes are exactly `galaxy | canvas | preview-app`
  (FP-12/FP-14 block `hub-world`/`preview-hub`). Default boot mode = `preview-app`.
- **INV-R2 two-state:** never show a node both built AND as a sphere in one view; no split-pane.
- **camera-controls in canvas is guard-railed by design** (bounded dist/polar/azimuth/pan, SC-071);
  only galaxy is free. Any GSAP camera move in canvas must stay inside the rail/boundary.
- **Reduced-motion + coarse-pointer:** all motion deps (Lenis, MagneticCursor, magnetic, reveals,
  ModeTransitionConductor) already bail on these — new WOW must too.
- **Forbidden-pattern hook** (`.claude/hooks/anti-drift-check.sh`) fires on Write/Edit: FP-01..FP-15
  (PixiJS, TextGeometry, destructive compile writes, raw secrets, async createNode, legacy view
  modes, Inspector-write routing). Editor `graph/` + `overlays/` are **Frozen by default** outside
  the carved-out edit plan.
