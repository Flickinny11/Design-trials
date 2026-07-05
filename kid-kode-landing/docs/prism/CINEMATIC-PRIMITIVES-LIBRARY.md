# Cinematic Primitives Library Specification

**Status:** SUPPORTING doc (retained). Companion to the archived `PRISM-RENDERER-MIGRATION-SPEC.md`; now read under the canonical-3.
**Date:** 2026-05-01

> **⚠️ Reconciliation note (2026-06-05, Phase 3B hardening).** The original framing below — "the codegen model SELECTS primitives by name … it does NOT author bespoke scene animation" — is **RESCINDED** by `PRISM-CANVAS-EDITOR-SPEC.md` §2 decision 6: animation is a **300+ primitive catalog AND from-scratch authoring**; both users and AI may author bespoke animations. These **9 primitives are the shipped seed set**, not a cage — they are a subset/extension-base of the canvas catalog, each expressible as an `Animatable` with a `ControlSchema` (canvas §8.3). **Do not re-encode any "no bespoke animation" rule.** This file is retained (per `SPEC-INDEX.md`, supporting tier) for the 9 seed primitives' parameter specs and the 6 TSL shaders; ignore the original "no scene-level animation from scratch" prohibition wherever it appears below (lines 6, 293). *(STEP-3 note: the prohibition is still enforced in code at `src/lib/prism/codegen/verifier.ts` `MISSING_PRIMITIVES_LOOP` and `src/lib/prism/codegen/prompts.ts` — recorded in `SPEC-INDEX.md` as a pending code change; no code edited by this pass.)*

> *(Original status line, retained for provenance:)* This document specifies the curated library of scene-level animation patterns that all generated nodes compose from. ~~The codegen model SELECTS primitives by name in captions; it does NOT author bespoke scene animation.~~ *(rescinded — see note above.)* This is the lever that protects against the "Three.js looks like a school project at the median" problem.

---

## Library Contract

Every primitive is a function with the same signature:

```typescript
export interface PrimitiveContext {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.WebGPURenderer;
  emit: (event: string, payload: unknown) => void;
  ticker: GSAPTicker;  // shared GSAP ticker
}

export interface PrimitiveResult {
  timeline: gsap.core.Timeline;          // Built but not played; trigger logic plays it
  cleanup: () => void;                    // Disposes resources, kills timeline
  needsTick?: boolean;                    // True if primitive needs onBeforeRender
  onTick?: (delta: number) => void;       // Called per-frame if needsTick
}

export type PrimitiveFn = (
  target: THREE.Object3D,
  params: Record<string, unknown>,
  ctx: PrimitiveContext
) => PrimitiveResult;
```

Primitives are registered in `shared/primitives/index.js`:

```typescript
export const primitives = {
  'orbit': orbitPrimitive,
  'depth-rotate': depthRotatePrimitive,
  'dissolve-morph': dissolveMorphPrimitive,
  'displacement-transition': displacementTransitionPrimitive,
  'parallax-scroll': parallaxScrollPrimitive,
  'magnetic-cursor': magneticCursorPrimitive,
  'particle-emerge': particleEmergePrimitive,
  'fly-through': flyThroughPrimitive,
  'kinetic-text': kineticTextPrimitive,
};
```

Trigger logic (when the primitive's timeline fires) lives in the hub manager, which reads the `trigger` field from the `CinematicPrimitiveRef` and calls `result.timeline.play()` (or `.restart()`) at the appropriate moment.

---

## Primitive 1 — `orbit`

**What it does:** Target object orbits around a point in 3D space, optionally also rotating to face the orbit center.

**Use cases:** Featured product hovering around a brand mark; satellite icons orbiting a primary CTA; gallery items revolving in 3D.

**Params:**
- `centerX, centerY, centerZ: number` — orbit pivot point in world space (default `0, 0, 0`)
- `radius: number` — orbit radius (default `2`)
- `axisX, axisY, axisZ: number` — normalized axis of rotation (default `0, 1, 0` — vertical Y-axis orbit)
- `period: number` — seconds per full orbit (default `8`)
- `faceCenter: boolean` — whether target rotates to face center (default `true`)
- `clockwise: boolean` — direction (default `true`)

**Implementation notes:**
Use `gsap.timeline({ repeat: -1 })` with `eulerOrder: 'YXZ'`, animate `target.position` along a parametric circle and `target.lookAt(center)` if `faceCenter`. Use `motionPath` plugin for non-circular paths in future extensions. Timeline is repeating — trigger 'load' starts it; trigger 'inview' starts when intersection observer fires.

**Quality bar:**
At rest, motion is butter-smooth at 60fps. Camera position can change without breaking orbit math. No accumulated drift over 10+ minutes of looping.

---

## Primitive 2 — `depth-rotate`

**What it does:** Target object rotates on its own axis with an apparent depth — back and far edges of the rotation visibly recede via perspective. The signature "image rotates to show all sides" effect from cinematic web design.

**Use cases:** Product showcases (rotates to show all sides); brand logo reveals; hero-element idle animations.

**Params:**
- `axisX, axisY, axisZ: number` — rotation axis (default `0, 1, 0`)
- `period: number` — seconds per full rotation (default `12`)
- `pingPong: boolean` — if true, oscillate ±90° instead of full 360° (default `false`)
- `pingPongRange: number` — degrees of oscillation when pingPong (default `45`)
- `easing: string` — GSAP easing string (default `'none'` for continuous, `'sine.inOut'` for pingPong)

**Implementation notes:**
For `parallax-plane` and `mesh` modes, this works directly. For `sprite` and `plane` modes (flat planes), the rotation will show the back of the plane as it crosses 90°. For `plane` mode specifically, primitive auto-applies `THREE.DoubleSide` to material if `axisY` rotation is detected and pingPong is false. For `sprite` (billboard) mode, this primitive emits a console warning at codegen — billboarded sprites cannot meaningfully rotate.

**Quality bar:**
Smooth 360° at any speed without visible stutter. Material's double-sided rendering does not cause z-fighting at glancing angles.

---

## Primitive 3 — `dissolve-morph`

**What it does:** Target object dissolves between two visual states using a noise-driven TSL shader. Particles can optionally emerge from the dissolve front.

**Use cases:** State transitions (button → loading → success); image gallery cross-fades with character; "before/after" reveals.

**Params:**
- `secondaryTextureUrl: string` — the "after" texture
- `duration: number` — seconds for the dissolve (default `1.2`)
- `noiseScale: number` — controls dissolve grain size (default `8`)
- `edgeColor: [r, g, b]` — color of the dissolving edge (default `[1, 1, 1]`)
- `edgeWidth: number` — width of the colored edge during transition (default `0.04`)
- `emitParticles: boolean` — whether dust particles emerge from the dissolve front (default `false`)
- `particleCount: number` — count if emitParticles (default `200`)

**Implementation notes:**
Uses `dissolve.tsl.js` shader (see Section "Shader Library" below). The primitive constructs the dual-texture material at setup time, then animates a `progress` uniform from 0→1 (or 1→0 for reverse) in the timeline. Particles use a separate Points geometry with positions sampled along the dissolve front per frame. The Codrops Gommage tutorial (Jan 2026) is the reference implementation — adapt it to a parameterized primitive.

**Quality bar:**
Dissolve grain reads as intentional, not noisy. Particles emerge from where the texture is currently dissolving, not from the whole surface.

---

## Primitive 4 — `displacement-transition`

**What it does:** Cinematic transition between two states using a displacement-map shader. The texture's pixels distort along the displacement gradient, then resolve. Common in award-winning sliders (Awwwards, Codrops).

**Use cases:** Hub-to-hub navigation flourish; carousel slide changes; reveal transitions on scroll.

**Params:**
- `displacementMapUrl: string` — grayscale map driving the distortion direction
- `intensity: number` — peak distortion magnitude (default `0.5`)
- `duration: number` — seconds (default `1.5`)
- `direction: 'inOut' | 'in' | 'out'` — distortion shape (default `'inOut'` — peaks in middle)
- `secondaryTextureUrl?: string` — optional cross-fade target

**Implementation notes:**
Shader is `displacement.tsl.js`. Primitive timeline animates `intensity` parameter and optional `crossfadeProgress` in tandem.

**Quality bar:**
Distortion follows the displacement map's gradient direction faithfully. No "swimming" artifacts at peak intensity. Works at any aspect ratio.

---

## Primitive 5 — `parallax-scroll`

**What it does:** Target object's position responds to scroll position with a configurable offset, creating depth-based parallax. Foreground objects move faster than background.

**Use cases:** Hero sections with depth; multi-layer scrolling stories; subtle product detail emphasis.

**Params:**
- `axis: 'y' | 'x' | 'z'` — scroll-driven axis (default `'y'`)
- `intensity: number` — units moved per 1.0 of scroll progress (default `0.5`, negative for reverse)
- `triggerStart: number` — scroll position (0-1 of viewport) where parallax begins (default `0`)
- `triggerEnd: number` — scroll position where parallax stops (default `1`)
- `easing: string` — GSAP easing (default `'none'`)
- `smoothScroll: boolean` — use Lenis-style smooth interpolation (default `true`)

**Implementation notes:**
Uses GSAP ScrollTrigger plugin (now free since GSAP became 100% free in May 2025). Each parallax-scroll primitive registers a ScrollTrigger that ties scroll progress to `target.position[axis]` via `gsap.to()` with `scrollTrigger`. If `smoothScroll: true`, install Lenis at scene-root level (primitive checks for shared instance).

**Quality bar:**
Parallax is responsive to scroll without lag, smooth on touchpad and mouse wheel, works correctly when scrolling fast or slow.

---

## Primitive 6 — `magnetic-cursor`

**What it does:** Target object subtly attracts toward the cursor when nearby — like a magnet. Common in premium agency portfolios.

**Use cases:** Buttons, CTAs, primary navigation items, interactive accents.

**Params:**
- `radius: number` — cursor proximity (in viewport units) within which attraction begins (default `0.15`)
- `intensity: number` — max displacement toward cursor (in world units) (default `0.1`)
- `damping: number` — easing factor for return when cursor leaves (default `0.08`)
- `affectScale: boolean` — also scale up slightly when cursor near (default `true`)
- `scaleAmount: number` — peak scale boost if affectScale (default `0.05`)

**Implementation notes:**
Uses raycaster against an invisible plane at the target's depth to convert cursor position to world space. Primitive sets `needsTick: true` and `onTick` lerps target's offset toward cursor-derived position. Cleanup detaches mousemove listener.

**Quality bar:**
Magnetic effect is subtle, not gimmicky. Multiple magnetic objects don't fight each other. Lerp damping prevents jitter.

---

## Primitive 7 — `particle-emerge`

**What it does:** Target object's pixels fly in from random world positions, assemble into the final texture. Used as entrance animation.

**Use cases:** Element entrances on hub navigation; reveal-on-scroll entrances; transition cap animations.

**Params:**
- `duration: number` — seconds for assembly (default `1.5`)
- `particleCount: number` — particles used (default `512` — internally clamped 256-2048)
- `dispersionRadius: number` — initial random spread radius (default `5`)
- `colorMode: 'sample' | 'fixed' | 'gradient'` — particle color source (default `'sample'`)
- `fixedColor: [r, g, b]` — when colorMode='fixed' (default `[1, 1, 1]`)
- `easing: string` — assembly easing (default `'power3.out'`)

**Implementation notes:**
Uses Points geometry with custom TSL vertex shader that interpolates each particle's position from random origin to final UV-mapped position on target. Color mode `'sample'` reads from texture at final UV; `'fixed'` uses `fixedColor`; `'gradient'` interpolates over assembly progress.

**Quality bar:**
Particles assemble in a cohesive way that visually "becomes" the final texture, not as if random dots happened to land on a static image.

---

## Primitive 8 — `fly-through`

**What it does:** Camera flies forward through (or past) the target object, with the object scaling and blurring on approach. Used for navigation transitions.

**Use cases:** Hub-to-hub transitions where hub A "fades into the distance" as hub B emerges. Portal-style entries.

**Params:**
- `direction: 'forward' | 'backward'` — camera moves toward (forward) or away from (backward) target (default `'forward'`)
- `duration: number` — seconds (default `1.0`)
- `motionBlurStrength: number` — 0-1 (default `0.5`)
- `targetScale: number` — final scale of object (default `0.1` for forward, `2.0` for backward)
- `easing: string` — camera path easing (default `'power2.inOut'`)

**Implementation notes:**
This primitive operates on the SCENE camera, not the target object — the target stays in place; the camera moves. Used most commonly as the navigation transition primitive at hub-manager level. Motion blur uses TSL post-processing pass (compose into existing `THREE.PostProcessing` instance).

**Quality bar:**
Sense of movement feels real, not just a scale animation. Motion blur is appropriate to camera speed. No nausea-inducing camera shake.

---

## Primitive 9 — `kinetic-text`

**What it does:** Per-character or per-word animation of text — slide, fade, scale, rotate, or stagger. Replaces SplitText-style entrance animations using MSDF text instead of DOM.

**Use cases:** Headline reveals, badge animations, navigation label hover effects, brand wordmark builds.

**Params:**
- `mode: 'characters' | 'words' | 'lines'` — split granularity (default `'characters'`)
- `effect: 'slide-up' | 'slide-down' | 'fade' | 'scale' | 'rotate3d' | 'wave'` (default `'slide-up'`)
- `stagger: number` — seconds between each unit's animation start (default `0.04`)
- `duration: number` — seconds for each unit (default `0.6`)
- `easing: string` — GSAP easing (default `'power3.out'`)
- `from: object` — starting state for the effect (default depends on effect)

**Implementation notes:**
Primitive operates on MSDF text meshes. Splits text geometry by character/word/line, animates each as separate mesh, recomposes. Note: this requires the `textContent[]` to have already been rendered via `ctx.fontAtlas` — primitive consumes the resulting glyph meshes.

**Quality bar:**
No layout shift during reveal. Per-character animation maintains kerning correctness. Works with multi-line text and right-to-left scripts.

---

## Shader Library (TSL)

Six fragment shaders shipped in `shared/shaders/`. All written in TSL so they compile to both WGSL (WebGPU) and GLSL (WebGL2 fallback).

### `displacement.tsl.js`
Distorts UVs based on a displacement map. Used by `displacement-transition` primitive and `parallax-plane` render mode.

### `dissolve.tsl.js`
Noise-based dissolve with optional emission edge. Used by `dissolve-morph` primitive.

### `voronoi-particle.tsl.js`
Voronoi-driven pixel-particle effect. Used for image-to-particle transitions.

### `twisted-wave.tsl.js`
Sine-wave distortion with mouse-cursor amplification. Used for hover effects and ambient texture motion.

### `radial-blur.tsl.js`
Cinematic radial blur centered at a configurable point. Used for camera transitions and focus emphasis.

### `rgb-shift.tsl.js`
Chromatic aberration shift. Used for transitions and emphasis.

Each shader is a TSL function that returns a node graph. Primitives compose them by setting uniform inputs at runtime.

---

## Integration with the Generation Pipeline

### Plan-Phase Selection

The plan-generation model (Claude Opus) is given the primitive library as part of its planning context. For each node in the plan, it selects 0-3 primitives based on the node's role:

- Hero elements → `depth-rotate` + `parallax-scroll` (or `mesh` + `orbit`)
- CTAs → `magnetic-cursor`
- Section headers → `kinetic-text`
- Featured products → `mesh` + `orbit` or `depth-rotate`
- Decorative ornaments → `particle-emerge` on entrance
- Navigation transitions (hub-level) → `fly-through` or `displacement-transition`

### Codegen-Phase Application

The per-node code generator receives `cinematicPrimitives[]` in the prompt. The generated code MUST iterate this array and call each primitive — it does NOT author scene animation directly. The verification layer enforces this.

### Runtime Application

The hub manager wires each primitive's `result.timeline` to the appropriate trigger:
- `'load'` → play immediately on hub mount
- `'inview'` → IntersectionObserver
- `'hover'` → pointer-over event
- `'click'` → pointer-down event
- `'scroll'` → ScrollTrigger
- `'time'` → after `params.delay` ms

---

## Versioning and Extension

Primitive set is versioned. Adding a new primitive requires:

1. Implementation in `shared/primitives/<name>.js` per the Library Contract
2. Registration in `shared/primitives/index.js`
3. Addition to the `CinematicPrimitiveRef.name` enum in `packages/shared-interfaces/src/prism-graph.ts`
4. Addition to the plan-phase context document so the planner knows when to use it
5. Addition to the codegen verification rules (the `name` is now a valid value)

The library is intentionally small (9 primitives at v1) to maximize cohesion across generated apps. Resist the urge to expand it past 15-20 even at v2 — quality of generated apps depends on a small, well-curated set, not breadth.

---

## Quality Gate

Before this library ships, every primitive must:
1. Have a working demo in `packages/prism-engine/examples/primitives/`
2. Run at 60fps on a 2020 MacBook Air with WebGPU active
3. Run at ≥45fps on the same hardware with WebGL2 fallback
4. Pass visual regression vs. a curated screenshot
5. Have a 1-paragraph "when to use this" doc the planning model can reference
