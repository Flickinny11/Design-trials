> **⚠️ SUPERSEDED BY the canonical-3 (`PRISM-RUNTIME-SPEC.md`, `PRISM-NODE-EDITOR-SPEC.md`, `PRISM-CANVAS-EDITOR-SPEC.md`) — archived 2026-06-05.**
> This is the PixiJS-era mock-app build spec. The renderer is now three/webgpu (migration done). It is **not build-truth**. It explicitly encodes the **split-pane dual-state (F1)** pattern (left mock / right 3D graph, `:260`, `:1941`, `:1996`) which the anchor forbids and the runtime spec replaces (one unified scene, modes are states not panes — `PRISM-RUNTIME-SPEC.md` INV-R3, FP-R6). **Retained for future-source value** as an app-architecture reference for the eventual engine, NOT as current build truth. See `SPEC-INDEX.md`.

# Prism Mock App Build Specification v1.0

**Status:** Implementation-ready spec for converting the prototype’s mock app to real `.prism` architecture
**Date:** 2026-04-20
**Companion document:** `PRISM-ENGINE-SPEC-V3.md` (canonical engine spec)
**Target repo:** Flickinny11/Design-trials, branch `prism-main`, directory `kid-kode-landing/`
**Scope:** The mock Kriptik app rendered in the prototype’s left pane. Nothing else.

> This spec governs ONE specific piece of work: converting the mock app that currently
> renders as HTML/CSS/Tailwind divs into a real Prism-architected app loaded by a working
> Prism Runtime Player. When complete, the mock app IS what a Prism-engine-generated app
> looks like, architecturally. The engine itself is not yet built; the mock app is
> hand-authored to match what the engine will eventually produce.

-----

## 1. Purpose

### 1.1 Why This Spec Exists

The Kriptik Prism engine is validated and spec’d (V3). We have a deployed prototype at `kid-kode-ai-landing.vercel.app` with a 3D knowledge-graph editor pane that is architecturally near-final. The left-pane preview currently renders a mock Kriptik-style app as HTML divs — which is architecturally wrong for Prism.

We are working backwards. Rather than building the engine first and then integrating it, we build a correct Prism-architected app by hand (the mock app in the left pane) that conforms exactly to what the engine’s V3 spec says an output app should be. Once the mock app is architecturally correct, the engine’s job becomes clear: generate `.prism` artifacts that match this target. The prototype becomes the architectural reference implementation.

This spec covers ONLY the mock app rebuild. It does NOT cover:

- Changes to the 3D graph pane (preserved as-is)
- Cross-pane sync / postMessage bridge (future scope)
- Node inspector / edit flow wiring (future scope)
- Real engine integration (future scope)
- The actual Kriptik Builder page integration (future scope)

### 1.2 What “Correct” Means

When this spec is complete:

1. The left pane of the prototype loads a real `.prism` file (hand-authored, not engine-generated)
1. A real Prism Runtime Player loads the `.prism` file and renders the mock Kriptik app
1. Rendering uses PixiJS v8 with WebGPU preferred / WebGL2 fallback, AVIF texture atlases, MSDF font atlases
1. The mock app is composed of bipartite nodes — every visible element is a node with a frontend side AND (where applicable) a backend side
1. The backend sides run via an in-browser local backend runtime for this prototype (see Section 6)
1. Hub navigation works via the reparent-on-navigate pattern even though the prototype may only have one hub
1. The graph.json driving the app contains full NodeIntent data for every node per V3 Invariant 11
1. The existing 3D graph pane reads the same graph.json and renders its nodes in 3D
1. Everything else in the prototype (the 3D pane’s visual design, animations, camera controls, inspector panels) is untouched

### 1.2.1 Rendering Philosophy — This Is A Game Engine, Not A DOM

This is the most important concept in this spec, and any implementation that violates it is wrong.

**Prism apps do NOT render as HTML + CSS.** They render as PixiJS sprites on a WebGL/WebGPU canvas, the same way a 2D video game renders. The canvas is the entire app. There is no DOM, no CSS, no React components-with-backgrounds. There are sprites drawn from textures, composited by the GPU, transformed with pixel-perfect control.

**Images ARE the elements (Invariant 8).** This means:

- A button’s visual representation — its shape, color, gradient, shadow, icon, AND its label text — is ALL baked into a single image region in the atlas. The button is a Sprite drawn from that region.
- A card’s visual representation — the card shape, the headline text, the subheading text, the decorative elements — is baked into its atlas region (or, in the case of the card being a CONTAINER for child elements, only the card background/frame is in the atlas and child elements have their own regions).
- A navbar is not “one image.” It’s a collection of nodes: logo (its own atlas region), each nav link (its own atlas region with its label baked in), sign-in button (its own atlas region with label baked in). Segmentation produces these as distinct elements.

**Code’s job is behavior AND runtime visual reactivity.** The separation is not “code does not touch visuals” — it’s “code does not construct UI structure from scratch.” See sections 1.2.2-1.2.5 below for the correct text, animation, and state frameworks. Code absolutely renders MSDF runtime text, applies GSAP transforms, and animates overlay layers — those are the game engine toolkit for making static images feel alive.

### 1.2.2 Text Rendering — Three Methods Per V3 Invariant 6

Text in Prism uses a **tiered hybrid**. Each piece of text on a node declares which method renders it; all three methods coexist. Code IS involved in text rendering — at build time for `sharp-svg`, at runtime for `msdf`. What code does NOT do is construct UI elements from primitive shapes.

**Method 1 — `sharp-svg` (build-time compositing).** The diffusion image for this element is generated with NO text (FLUX negative prompt: “no text, no letters, no words, no labels”). At build time, Sharp+SVG composites the text onto the element image pixel-perfectly — exact font, weight, color, position. By the time the atlas region is packed, the text is BAKED INTO the image. At runtime, the sprite just shows the already-rendered text as part of the image. This is the default for functional UI text: button labels, nav links, form labels, headings, captions. 100% text accuracy. This is text-via-code — it’s just code running at BUILD time, not at runtime.

**Method 2 — `msdf` (runtime-rendered).** MSDF atlas text rendered by a WebGPU shader at runtime. Used for: dynamic text that didn’t exist at build time (live counters, user names from the session, data from backend calls, search result counts, toast messages) AND scalable text that must stay crisp at any zoom or transform. The MSDF font atlas ships in the `.prism`; `createNode()` creates `BitmapText` children against it.

**Method 3 — `diffusion` (baked in the FLUX output).** For stylized decorative text where aesthetic matters more than pixel accuracy — stylized hero headlines with custom typography treatment, logo wordmarks, artistic typographic elements. The diffusion prompt explicitly includes the text (“headline reading ‘Build apps from a prompt’ in a bold gradient style”), and the model (Ideogram 3.0 or FreeText-enhanced FLUX) renders it at ~90-95% accuracy. If OCR verification fails, Sharp+SVG re-composites as a fallback.

Each `TextContentSpec` in a node’s `visualSpec.textContent` array specifies:

```typescript
interface TextContentSpec {
  text: string;
  role: 'heading' | 'body' | 'label' | 'placeholder' | 'caption';
  renderMethod: 'sharp-svg' | 'msdf' | 'diffusion';
  typography: { fontFamily: string; fontSize: number; fontWeight: number; color: string };
  position: { x: number; y: number; anchor: 'left' | 'center' | 'right' };
}
```

The mock app’s atlas build script (Section 5) implements the `sharp-svg` pipeline: source images are supplied WITHOUT text (per FLUX’s no-text prompt convention), and Sharp composites each node’s `sharp-svg` textContent entries onto the image per the typography + position specs before packing into the atlas. For `msdf` text, runtime `createNode()` creates `BitmapText` children. For `diffusion` text, the source images already contain the text (hand-authored to simulate Ideogram output).

### 1.2.3 Animation — Three Methodologies

Prism supports three animation methodologies, each selected per-animation based on what’s being animated. All three can coexist in the same app, and a single element can use multiple methods.

**Method 1 — i2v frame-based animation.** For animations where the **pixels inside the image** need to animate — beautiful animated backgrounds, liquid/fire/energy effects, morphing graphics, particle flows, anything that can’t be achieved by transforming the sprite as a whole. The element has a **frame sequence** (a series of images representing each frame of the animation). Runtime cycles through the frames at a target frame rate. Frames are generated by the image-to-video (i2v) pipeline during generation, or hand-authored for the mock app. Each frame is its own atlas region. The `AnimationTab` in the editor UI lets users scroll-to-scrub through frames and edit individual frames via image-to-image prompting.

**Method 2 — Code-based transform animation.** GSAP/tween.js tweens on sprite properties (position, scale, rotation, alpha, tint). For animations achievable by transforming the whole sprite as a unit — slide-in on mount, fade-out on unmount, scale-bounce on press, parallax drift. Code animates sprite transforms; the base image is static. This is what people usually mean when they say “animation via code.”

**Method 3 — Hybrid transparent-layer animation. This is the heart of why Prism looks good.** Transparent image layers sized exactly to match the base element are positioned above and/or below it. Code animates those OVERLAY layers (alpha, transform, tint, filter), and the visual effect appears as if the element itself is animating — but the base element image is untouched. This pattern enables:

- **Glows** — a soft-edged glow image sized slightly larger than the element, placed behind it, alpha-pulsed via GSAP on hover/active
- **Shadows** — a shadow image placed below, animated on lift-hover to offset and blur more
- **State-change effects** — shimmer layers that sweep across the element, scanline overlays, ripple-click layers emanating from the click point, border-trace layers that draw outlines, frost-overlay glass layers
- **Attention effects** — glow-pulse, color-wash, bloom overlays
- **Composite reactions** — press reactions combining a scale-down of the base sprite (method 2) with a bloom overlay layer (method 3)

Every state-change effect in the catalog — `glow-pulse`, `shimmer`, `scale-press`, `lift-hover`, `color-wash`, `scanline`, `ripple-click`, `border-trace`, `frost-overlay` — is implemented via method 3 (overlay layers) or method 2 (sprite transforms) or a combination. Method 3 is what makes “sprite-based UI” feel alive and reactive without requiring every state to be a new rendered image. The overlay images themselves are small, reusable, and often shared across many nodes in the atlas.

Each node’s intent declares which state effects it uses in a `stateEffects` array, and `createNode()` implements them via the appropriate method(s).

### 1.2.4 State Transitions via Layer Swapping

Discrete state changes — toggle-on vs toggle-off, button-default vs button-pressed, checkbox-checked vs checkbox-unchecked, tab-active vs tab-inactive — use **layer swapping**. Each state has its own image, shipped as its own atlas region. Code controls which image is visible based on state.

Example: a toggle component has `toggle-off.png` and `toggle-on.png` in the atlas. The node’s state store has a boolean `isOn`. `createNode()` creates both sprites; only one is `visible: true` at a time; on click, the state toggles and visibility swaps. Optional: a short cross-fade or scale animation (method 2) bridges the swap for polish.

For more complex state sets — a button with default/hover/pressed/disabled states — each state can have its own image region. Code reads the current state and shows the corresponding sprite. OR, for effects achievable via overlays without needing a fully different base image, method 3 (overlay layers) is cheaper.

The mock app’s atlas MUST include state images for any node that has discrete states. The `visual` metadata on the node declares the regions per state:

```json
"visual": {
  "atlasId": "atlas-0",
  "regions": {
    "default": { "x": 0, "y": 0, "w": 240, "h": 64 },
    "hover":   { "x": 0, "y": 64, "w": 240, "h": 64 },
    "pressed": { "x": 0, "y": 128, "w": 240, "h": 64 },
    "disabled":{ "x": 0, "y": 192, "w": 240, "h": 64 }
  },
  "defaultRegion": "default",
  "transform": { "x": 400, "y": 480, "width": 240, "height": 64, "z": 51 }
}
```

OR if the node uses overlay-based states only:

```json
"visual": {
  "atlasId": "atlas-0",
  "region": { "x": 0, "y": 0, "w": 240, "h": 64 },
  "overlayRegions": {
    "glow-pulse": { "x": 240, "y": 0, "w": 256, "h": 80 },
    "ripple": { "x": 240, "y": 80, "w": 300, "h": 300 }
  },
  "transform": { "x": 400, "y": 480, "width": 240, "height": 64, "z": 51 }
}
```

### 1.2.5 What Code Does and Does Not Do

Code in a node’s `createNode()` DOES:

- Create sprites from atlas regions (base element, state variants, overlay layers)
- Position, scale, and layer those sprites
- Handle pointer events and fire declared events
- Apply method 2 transforms (GSAP on sprite properties) for transform-based animations and state effects
- Apply method 3 overlay animations (alpha, transform, tint, filter on overlay sprite layers) for state effects
- Create MSDF `BitmapText` children for `msdf`-method textContent entries
- Swap which state sprite is visible for layer-swap state transitions
- Cycle through frame sequences for method 1 i2v animations
- Call backend sides via the local backend runtime

Code in a node’s `createNode()` does NOT:

- Construct UI layout from primitive shapes (rectangles, lines) to fake being an element
- Render `sharp-svg` or `diffusion` text — that happens at build time
- Generate the element’s base visual from scratch — the base visual is the atlas image
- Use any DOM, HTML, or CSS primitives
- Reach outside the PixiJS sprite model for its visual reality

If a Claude Code session catches itself drawing `PIXI.Graphics` rectangles to approximate an element, or creating `PIXI.Text` for a static label that should be in the atlas, or drawing a “fake button” from primitives — stop and reread this section. The base image in the atlas IS the element.

### 1.3 Non-Goals

- Production performance targets — this is a prototype
- Full Self-Healing Runtime — a toy demo version only (Section 9)
- Real external integrations — Supabase, Stripe, OpenAI calls are all mocked in the local backend runtime
- Deployment to production hosts — the mock app runs inside the prototype’s Next.js shell
- Progressive/wavefront loading — the `.prism` is hand-authored, so it’s all there at once
- Real SAM/YOLO segmentation from a FLUX hub image — we generate element-level images directly via fal.ai FLUX.2 rather than running the segmentation step (Section 5.0)

### 1.4 Images For Literally Every Visual Element — Non-Negotiable

Every visible thing in the mock app is an image from the atlas. Not “every element” in the abstract — **every single visible visual piece**:

- Every button → image
- Every icon → image
- Every container, box, card, panel, section wrapper → image
- Every nav link, tab, breadcrumb → image
- Every input field chrome (the styled border/fill/background of a text input) → image (with an invisible DOM `<input>` overlaid on top for cursor + keyboard, per the PixiJS interactive-input pattern)
- Every toggle, checkbox, radio, slider track/thumb → image (one per state, swapped at runtime)
- Every divider, separator, decorative line → image
- Every background — the page background, section backgrounds, card backgrounds → image
- Every badge, tag, chip, pill → image
- Every avatar placeholder, logo mark, brand icon → image
- Every progress bar fill/track, spinner frame → image (or image sequence for spinners)
- Every tooltip chrome, popover chrome, modal chrome → image
- Every shadow, glow, ambient gradient that visually sits on or behind an element → image (overlay layer)

**If you can see it in the rendered app, an image in the atlas produced it.** There are three exceptions and only three:

1. **MSDF-rendered runtime text** — BitmapText instances for genuinely dynamic text (live counters, user names from the session, data returned from a backend call, timestamp displays, search result counts). Static text like button labels, headings, nav link names is NOT in this category — that text is composited into the element’s image via sharp-svg at build time.
1. **Invisible DOM overlays for accessibility / input** — a transparent `<input>` positioned over an input field’s image chrome handles cursor and keyboard. A transparent `<button>` may sit over complex image buttons for screen-reader support. The IMAGE is what’s visible; the DOM overlay is transparent and only handles interaction semantics.
1. **Method-2 GSAP transforms on sprites** — scaling a sprite up on hover, fading, rotating. These modify the rendered sprite but the sprite’s visual content is still the atlas image.

What this means for Claude Code:

- Do NOT use `PIXI.Graphics` to draw any rectangle, circle, line, or shape that represents a UI element. `Graphics` is allowed ONLY for invisible hit areas, masks for overlay effects, or debug overlays in dev mode.
- Do NOT use CSS or HTML to render any visible chrome or container. The PixiJS canvas is the entire app surface.
- Do NOT use `PIXI.Text` anywhere. Text is either sharp-svg-composited into atlas images at build time, `diffusion`-baked into atlas images by the image model, or `msdf`-rendered at runtime via BitmapText for dynamic data only.
- If an element you’re implementing doesn’t have a source image for it, STOP and add it to the provisioning script (Section 5.0) rather than faking it with primitives.

The success test: if someone opens the running mock app, takes a screenshot, and zooms in on any visible element — that pixel content should trace back to a fal.ai-generated image in the atlas (possibly with composited sharp-svg text on top), NOT to code that drew a shape.

### 1.5 Behaves Like A Real App — Navigation, Scroll, Responsiveness

The mock app is a single hub (one page), but within that hub it must behave like a real product:

**Scroll behavior.** The hub’s content exceeds the viewport height vertically. Users scroll through it:

- **Desktop:** mouse wheel scroll up/down scrolls the hub content. Trackpad two-finger scroll works. Scroll is smooth, not stepped — use a momentum-eased scroll (GSAP `ScrollSmoother` or a manual smooth-scroll implementation over the PixiJS stage y-position).
- **Mobile / touch:** single-finger drag scrolls. Momentum scrolling (flick to scroll fast, decays naturally) — same physics as a real mobile app. Implement via PixiJS pointer events on a root scroll container that translates the child content container on Y.
- **Keyboard:** Arrow up/down, Page up/down, Home/End all scroll correctly.

The implementation: the hub’s root container is a “scroll viewport” fixed to the visible canvas size. Its child “content container” holds all the hub’s element sprites laid out in absolute positions. Scrolling translates the content container’s y-position; the viewport clips what’s visible (use PixiJS mask or the renderer’s scissor/clip region).

**Responsive layout.** The mock app renders correctly across these breakpoints:

- **Desktop wide (>1440px):** full layout, maximum content width, generous spacing
- **Desktop standard (1024-1440px):** full layout, slight content max-width constraint
- **Tablet (768-1024px):** condensed layout — navbar may collapse into a hamburger-style icon, hero section may restack, feature grid may go from 3-col to 2-col
- **Mobile (<768px):** mobile layout — single column for most sections, navbar fully collapsed to hamburger + logo, hero stacks vertical, CTA button full-width-ish, footer simplifies

Because this is sprite-based, responsive behavior is done by the hub’s **layout engine** — a function `layoutHub(viewportWidth, viewportHeight)` that reads each node’s position from its intent and computes responsive transforms. For breakpoint-specific layouts, nodes can declare alternate `transform` blocks per breakpoint in their intent (`transformByBreakpoint: { desktop: {...}, tablet: {...}, mobile: {...} }`), and the layout engine picks the right one.

Some nodes may be visible in desktop but hidden in mobile (e.g., a secondary feature column) — intent declares `visibleAtBreakpoints: ['desktop', 'tablet']`. The runtime respects these.

**Navigation within the hub.** Anchor-style scrolling to sections:

- Nav links (`Home`, `Features`, `Pricing`, `Docs`) are each their own node. Clicking one animates the content container’s y-position to the corresponding section’s Y offset via GSAP. Smooth scroll, not jumping.
- The current section is visually indicated in the navbar (active nav link gets its hover/active overlay layer turned on).
- `back to top` style actions work the same way — GSAP to y=0.

**Inter-hub navigation (future).** The mock app has one hub. But the runtime’s hub manager (Section 4.6 of this spec, if present, or the Prism Player reference) supports hub-to-hub navigation with reparent-on-navigate. Elements clicking “Sign in” or “Get Started” MAY fire events that would trigger a hub switch in a multi-hub app; for the single-hub mock, these events fire and are acknowledged with a visual effect but no actual navigation happens. Log in the console: `"[mock] would navigate to /auth — single-hub mock, no-op"`.

**Pointer interactions feel like a real app.** Every interactive sprite responds to:

- `pointerover` / `pointerout` → hover state (method 2 transform + method 3 overlay fade-in)
- `pointerdown` / `pointerup` → press state (scale-down briefly then release)
- `pointertap` → action fires
- Touch equivalents on mobile behave identically (PixiJS unifies mouse + touch via pointer events)

The app should NOT feel like a static image with clickable regions. It should feel like an app — elements react to interaction, scrolling is smooth, transitions between states are animated, the whole thing breathes.

-----

## 2. Current State of the Prototype

### 2.1 What Exists

```
kid-kode-landing/
├── app/                              (Next.js 15 app router)
│   ├── page.tsx                      (landing page — untouched)
│   ├── editor/
│   │   └── page.tsx                  (split-pane editor — left mock, right 3D graph)
│   └── layout.tsx
├── components/
│   ├── editor/
│   │   ├── SplitPane.tsx             (left/right split layout — untouched)
│   │   ├── MockApp.tsx               (CURRENT left pane — HTML divs, to be REPLACED)
│   │   ├── GraphPane.tsx             (3D graph pane — untouched)
│   │   ├── GraphScene.tsx            (Three.js scene — untouched)
│   │   ├── NodeSphere.tsx            (node visualization — untouched)
│   │   ├── Inspector.tsx             (right-side inspector — untouched)
│   │   └── ...
│   └── ui/                           (shadcn components — untouched)
├── lib/
│   ├── graph-store.ts                (Zustand store for graph state — partial change)
│   ├── capture-textures.ts           (html-to-image capture — REMOVED)
│   └── ...
├── public/                           (static assets — additions for atlas)
├── package.json
└── next.config.mjs
```

### 2.2 What to Keep

- `app/page.tsx` and all marketing routes (untouched)
- `app/editor/page.tsx` shell (untouched; only the child component changes)
- `components/editor/SplitPane.tsx` (untouched)
- All files under `components/editor/` EXCEPT `MockApp.tsx` (untouched)
- All files under `components/ui/` (untouched)
- `lib/graph-store.ts` — modified slightly to accommodate the new graph shape (see Section 3.3)

### 2.3 What to Remove

- `components/editor/MockApp.tsx` — replaced entirely
- `lib/capture-textures.ts` — the html-to-image texture capture path is obsolete
- Any Zustand store fields related to captured HTML textures
- Any `html-to-image` or `domtoimage` dependencies

### 2.4 What to Add

New files under `components/prism-player/` and `lib/prism/`:

```
components/
└── prism-player/
    ├── PrismPlayer.tsx               (React wrapper around the player)
    ├── PrismCanvas.tsx               (PixiJS canvas host)
    └── PrismHost.tsx                 (replaces MockApp.tsx; mounts PrismPlayer)

lib/
└── prism/
    ├── player/                       (the Prism Runtime Player library)
    │   ├── index.ts                  (entry point)
    │   ├── boot.ts                   (manifest loading + init sequence)
    │   ├── pixi-init.ts              (PixiJS v8 setup)
    │   ├── atlas-loader.ts           (AVIF atlas decoding)
    │   ├── graph-to-tree.ts          (graph-to-PixiJS-tree adapter)
    │   ├── hub-manager.ts            (hub switching, reparent-on-navigate)
    │   ├── module-registry.ts        (per-node code modules)
    │   ├── state-manager.ts          (app state)
    │   ├── event-bus.ts              (inter-node events + SHR trace hooks)
    │   ├── backend-client.ts         (calls to local backend runtime)
    │   └── shr/                      (toy SHR — Section 9)
    │       ├── telemetry.ts
    │       ├── divergence.ts
    │       └── local-repair-mock.ts  (the prototype uses a MOCK repair; real model deferred)
    ├── local-backend/                (in-browser backend runtime for mock app)
    │   ├── index.ts
    │   ├── router.ts                 (route matcher for backend calls)
    │   ├── handlers/                 (per-backend-node handler modules)
    │   └── fake-db.ts                (in-memory store backing the mock backend)
    ├── artifact/
    │   ├── unpack.ts                 (read .prism zip in browser)
    │   └── types.ts                  (mirror of V3 manifest types)
    └── mock-app-source/              (the source material for the hand-authored .prism)
        ├── README.md                 (explains this is the "what FLUX would produce" layer)
        ├── hubs/
        │   └── home-hub.ts           (hub definition)
        ├── nodes/
        │   ├── navbar.ts             (node definitions — one file per node)
        │   ├── hero-card.ts
        │   ├── feature-grid.ts
        │   └── ...
        ├── assets/
        │   ├── source-images/        (the original PNG/SVG source for each node)
        │   └── build-atlas.mjs       (build script: sources → AVIF atlas + regions)
        └── build-prism.mjs           (build script: sources → app.prism)

public/
└── prism-assets/
    ├── mock-app.prism                (the compiled .prism artifact for the mock app)
    └── player-runtime.js             (optional: pre-bundled player for external use)
```

-----

## 3. The .prism Artifact — Mock App Version

### 3.1 Container Format

The mock app’s `.prism` file is a zip archive with this exact structure:

```
mock-app.prism
├── manifest.json
├── graph.json
├── nodes/
│   ├── navbar.js                     (ESM module, exports createNode())
│   ├── hero-card.js
│   ├── feature-grid.js
│   └── ...
├── backends/
│   ├── navbar.js                     (ESM module, exports handler())
│   ├── hero-card.js
│   └── ...                           (only for nodes with backend sides)
├── schemas/
│   └── shared-types.js               (Zod schemas for contract types)
├── assets/
│   ├── atlas-0.avif                  (2048×2048 packed UI atlas)
│   ├── font-inter.msdf.json          (MSDF font atlas metadata)
│   └── font-inter.msdf.png           (MSDF font atlas bitmap)
├── integrations/                     (empty for mock — no external integrations)
└── meta/
    ├── version.txt                   (0.1.0)
    └── generator.json                ({"generator": "hand-authored-mock", ...})
```

### 3.2 manifest.json Schema (Minimal for Prototype)

```json
{
  "prismVersion": "0.1.0",
  "playerVersionRequired": ">=0.1.0 <0.2.0",
  "entryHub": "home-hub",
  "hubs": ["home-hub"],
  "nodeCount": 12,
  "services": {
    "main": {
      "tag": "main",
      "target": "browser-embedded",
      "framework": "prism-player",
      "routesDir": "backends/",
      "nodeIds": ["navbar", "hero-card", "feature-grid", ...]
    }
  },
  "integrations": [],
  "assets": {
    "assets/atlas-0.avif": { "sha256": "...", "size": 287432 },
    "assets/font-inter.msdf.json": { "sha256": "...", "size": 12003 },
    "assets/font-inter.msdf.png": { "sha256": "...", "size": 184221 }
  },
  "createdAt": "2026-04-20T00:00:00Z",
  "generator": { "engine": "hand-authored-mock", "version": "1.0" }
}
```

Note: `target: "browser-embedded"` is a mock-app-only target meaning “runs inline in the prototype’s Next.js page, backend via the in-browser local-backend runtime.” The production `.prism` format will have real deployment targets; this one does not.

### 3.3 graph.json Schema (Mock App)

**Important — element-level segmentation:** Per V3 Section 10, FLUX generates a hub image and segmentation (SAM/YOLO) decomposes it into INDIVIDUAL ELEMENT NODES. A “navbar” is not one node — it is a layout region containing multiple nodes: the logo, each nav link, and the sign-in button, each with their own atlas region, intent, and code. A “hero card” is the container background PLUS separate nodes for interactive children like the CTA button. This is not optional — it is the foundational premise of Prism’s architecture.

For the mock app, the hand-authored atlas MUST reflect this: one image region per segmented element, not one region per “section” of the page.

```json
{
  "version": "0.1.0",
  "nodes": [
    {
      "nodeId": "navbar-bg",
      "subtype": "frontend-element",
      "parentHubId": "home-hub",
      "serviceTag": "main",
      "visual": {
        "atlasId": "atlas-0",
        "region": { "x": 0, "y": 0, "w": 1920, "h": 80 },
        "transform": { "x": 0, "y": 0, "width": 1920, "height": 80, "z": 100 }
      },
      "intent": {
        "caption": "Navigation bar background — dark translucent bar spanning the top of the viewport, providing the visual container for the logo, nav links, and sign-in button that sit on top.",
        "behaviorSpec": {
          "interactions": [],
          "apiCalls": [],
          "dataBindings": [],
          "emits": [],
          "listens": [],
          "triggersDownstream": []
        },
        "stateEffects": [],
        "contracts": { "inputs": {}, "outputs": {} }
      },
      "codeRef": "nodes/navbar-bg.js",
      "backendRef": null
    },
    {
      "nodeId": "navbar-logo",
      "subtype": "frontend-element",
      "parentHubId": "home-hub",
      "serviceTag": "main",
      "visual": {
        "atlasId": "atlas-0",
        "region": { "x": 0, "y": 80, "w": 160, "h": 48 },
        "transform": { "x": 40, "y": 16, "width": 160, "height": 48, "z": 101 }
      },
      "intent": {
        "caption": "Kriptik logo — wordmark with gradient, clickable, navigates back to home hub on tap.",
        "behaviorSpec": {
          "interactions": [{ "event": "pointertap", "effect": "navigate-home" }],
          "apiCalls": [],
          "dataBindings": [],
          "emits": ["navigate"],
          "listens": [],
          "triggersDownstream": [
            { "eventName": "navigate", "targetNodeIds": ["hub-router"], "toleranceMs": 500 }
          ]
        },
        "stateEffects": ["lift-hover", "scale-press"],
        "contracts": { "inputs": {}, "outputs": {} }
      },
      "codeRef": "nodes/navbar-logo.js",
      "backendRef": null
    },
    {
      "nodeId": "navbar-link-home",
      "subtype": "frontend-element",
      "parentHubId": "home-hub",
      "serviceTag": "main",
      "visual": {
        "atlasId": "atlas-0",
        "region": { "x": 160, "y": 80, "w": 72, "h": 40 },
        "transform": { "x": 600, "y": 20, "width": 72, "height": 40, "z": 101 }
      },
      "intent": {
        "caption": "Nav link 'Home' — text label with subtle underline effect on hover, navigates to home hub on tap.",
        "behaviorSpec": {
          "interactions": [{ "event": "pointertap", "effect": "navigate-home" }],
          "apiCalls": [],
          "dataBindings": [],
          "emits": ["navigate"],
          "listens": [],
          "triggersDownstream": [
            { "eventName": "navigate", "targetNodeIds": ["hub-router"], "toleranceMs": 500 }
          ]
        },
        "stateEffects": ["border-trace", "color-wash"],
        "contracts": { "inputs": {}, "outputs": {} }
      },
      "codeRef": "nodes/navbar-link.js",
      "backendRef": null
    },
    // ... similar nodes for navbar-link-editor, navbar-link-docs, navbar-link-pricing
    {
      "nodeId": "navbar-signin-btn",
      "subtype": "frontend-element",
      "parentHubId": "home-hub",
      "serviceTag": "main",
      "visual": {
        "atlasId": "atlas-0",
        "region": { "x": 232, "y": 80, "w": 120, "h": 40 },
        "transform": { "x": 1760, "y": 20, "width": 120, "height": 40, "z": 101 }
      },
      "intent": {
        "caption": "Sign-in button — gradient-filled pill with 'Sign In' text baked in, opens sign-in modal on tap.",
        "behaviorSpec": {
          "interactions": [{ "event": "pointertap", "effect": "open-signin-modal" }],
          "apiCalls": [],
          "dataBindings": [],
          "emits": ["open-modal"],
          "listens": [],
          "triggersDownstream": [
            { "eventName": "open-modal", "targetNodeIds": ["signin-modal"], "toleranceMs": 500 }
          ]
        },
        "stateEffects": ["lift-hover", "scale-press", "glow-pulse"],
        "contracts": { "inputs": {}, "outputs": {} }
      },
      "codeRef": "nodes/navbar-signin-btn.js",
      "backendRef": null
    },
    {
      "nodeId": "hero-card-bg",
      "subtype": "frontend-element",
      "parentHubId": "home-hub",
      "serviceTag": "main",
      "visual": {
        "atlasId": "atlas-0",
        "region": { "x": 0, "y": 128, "w": 1280, "h": 480 },
        "transform": { "x": 320, "y": 200, "width": 1280, "height": 480, "z": 50 }
      },
      "intent": {
        "caption": "Hero card background — rounded panel with gradient, containing the headline 'Build apps from a prompt' and subheading 'Kriptik turns natural language into running applications in under 15 seconds' — all text baked into the image. The CTA button sits on top as a separate node.",
        "behaviorSpec": {
          "interactions": [],
          "apiCalls": [],
          "dataBindings": [],
          "emits": [],
          "listens": ["build-flow-started"],
          "triggersDownstream": []
        },
        "stateEffects": [],
        "contracts": { "inputs": {}, "outputs": {} }
      },
      "codeRef": "nodes/hero-card-bg.js",
      "backendRef": null
    },
    {
      "nodeId": "hero-card-cta",
      "subtype": "frontend-element",
      "parentHubId": "home-hub",
      "serviceTag": "main",
      "visual": {
        "atlasId": "atlas-0",
        "region": { "x": 352, "y": 80, "w": 240, "h": 64 },
        "transform": { "x": 400, "y": 480, "width": 240, "height": 64, "z": 51 }
      },
      "intent": {
        "caption": "Primary CTA button — gradient-filled rounded rect with 'Get Started' text baked in. On tap, emits build-flow-started event and calls /api/mock/track-cta-click to record analytics. On success, plays glow-pulse effect.",
        "behaviorSpec": {
          "interactions": [{ "event": "pointertap", "effect": "start-build-flow" }],
          "apiCalls": [{ "endpoint": "/api/mock/track-cta-click", "method": "POST" }],
          "dataBindings": [],
          "emits": ["build-flow-started"],
          "listens": [],
          "triggersDownstream": [
            { "eventName": "build-flow-started", "targetNodeIds": ["build-panel"], "toleranceMs": 1000 }
          ]
        },
        "stateEffects": ["lift-hover", "scale-press", "glow-pulse"],
        "contracts": { "inputs": {}, "outputs": {} }
      },
      "codeRef": "nodes/hero-card-cta.js",
      "backendRef": "backends/hero-card-cta.js"
    }
    // ... more nodes for feature grid (each feature card is ITS OWN node),
    // footer (each footer link is its OWN node), etc.
  ],
  "hubs": [
    {
      "hubId": "home-hub",
      "title": "Home",
      "nodeIds": [
        // page-level background
        "page-background",

        // navbar — decomposed per visible element (per Invariant 8)
        "navbar-bg", "navbar-logo",
        "navbar-link-home", "navbar-link-editor", "navbar-link-docs", "navbar-link-pricing",
        "navbar-signin-btn",

        // hero section — decomposed
        "hero-section-bg",             // animated i2v background (Method 1 demo)
        "hero-card-bg",                // the card container (image with decorative design, no text)
        "hero-card-headline-text",     // diffusion-text image OR sharp-svg text on hero-card-bg
        "hero-card-subhead-text",      // sharp-svg text
        "hero-card-cta",               // CTA button with all three animation methods demoed

        // feature grid — one node per feature card, one per icon, one per title/description if separable
        "feature-grid-section-bg",
        "feature-card-1-bg", "feature-card-1-icon", "feature-card-1-title", "feature-card-1-desc",
        "feature-card-2-bg", "feature-card-2-icon", "feature-card-2-title", "feature-card-2-desc",
        "feature-card-3-bg", "feature-card-3-icon", "feature-card-3-title", "feature-card-3-desc",

        // settings area demonstrating state-transition / layer-swap
        "settings-section-bg",
        "notifications-toggle",        // toggle-off.png and toggle-on.png layer swap
        "theme-selector-button",       // button with default/hover/pressed state variants

        // stats area demonstrating MSDF runtime text
        "stats-card-bg",
        "stats-live-counter",          // MSDF BitmapText showing CTA click count from backend

        // footer — decomposed
        "footer-bg", "footer-logo",
        "footer-link-privacy", "footer-link-terms", "footer-link-contact",
        "footer-social-twitter", "footer-social-github", "footer-social-discord",
        "footer-copyright-text"
      ],
      "layout": {
        "viewportWidth": 1920,         // design viewport; responsive layout happens at runtime
        "viewportHeight": 1080,
        "contentHeight": 3200,         // total scrollable content height (exceeds viewport)
        "backgroundColor": "#0a0a0a"
      }
    }
  ],
  "edges": [
    { "from": "navbar-logo", "to": "hub-router", "type": "triggers", "event": "navigate" },
    { "from": "navbar-link-home", "to": "hub-router", "type": "triggers", "event": "navigate" },
    { "from": "navbar-link-editor", "to": "hub-router", "type": "triggers", "event": "navigate" },
    { "from": "navbar-signin-btn", "to": "signin-modal", "type": "triggers", "event": "open-modal" },
    { "from": "hero-card-cta", "to": "build-panel", "type": "triggers", "event": "build-flow-started" },
    { "from": "hero-card-cta", "to": "stats-live-counter", "type": "data-flow", "event": "counter-incremented" },
    { "from": "notifications-toggle", "to": "user-preferences-store", "type": "state-update", "event": "notifications-toggled" }
    // ... more edges
  ]
}
```

That example lists ~35 nodes — realistic for a single polished home hub. A richer hub could reach 50-60 nodes. The test for whether a visible thing is its own node: if it has its own visual identity, its own position, its own potential interactivity, or would be independently editable in the real engine’s node inspector — it’s a node.

Every `intent` block is the full V3 NodeIntent structure — caption, behaviorSpec with all seven sub-arrays, `stateEffects` array declaring which state-change effects from the catalog this node uses, and contracts. Invariant 11 says this persists at runtime; our graph.json matches. For a representative mock home hub, expect ~30-50 nodes total across navbar (7), hero card (2), feature grid (12-20), footer (5-10), plus any modal triggers.

### 3.4 Node Modules (Frontend Side)

Per-node frontend module at `nodes/{nodeId}.js`:

```js
// nodes/hero-card.js
// This node has THREE child nodes: hero-card-bg, hero-card-headline-image, hero-card-cta-button.
// Wait — per Invariant 8, the headline text IS part of the background image of the hero card
// (since it's static copy). The CTA button is its own node with its own atlas region. So:
// hero-card itself is a container/layout node holding:
//   - its own background sprite (which includes the headline "Build apps from a prompt"
//     and the subheading, baked in as pixels from FLUX+SAM output, or equivalent hand-authored image)
//   - a child node: hero-card-cta (separate node, separate atlas region, own intent)
//
// This example shows hero-card's createNode — which renders ITS OWN background sprite.
// The CTA button is a SEPARATE node; its createNode runs separately and is positioned
// inside the hero-card via the parent-child graph relationship + layout transforms.

export function createNode(ctx) {
  const { atlas, region, transform, state, events, shr } = ctx;

  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);

  // The hero card's visual IS this sprite. Headline text is already in the image.
  // Code does NOT draw the headline. Code does NOT lay out text.
  // The image from FLUX+SAM (or hand-authored equivalent) IS the hero card.
  const sprite = new PIXI.Sprite(atlas.getTexture(region));
  sprite.width = transform.width;
  sprite.height = transform.height;
  container.addChild(sprite);

  // Optional: entrance animation via GSAP on the sprite's properties.
  // Entrance animations are declared in the node's intent; createNode implements them.
  sprite.alpha = 0;
  sprite.y = 20;
  gsap.to(sprite, { alpha: 1, y: 0, duration: 0.6, ease: 'power2.out' });

  // Hero-card itself is not directly clickable — the CTA child node handles clicks.
  // But hero-card may listen for events from its children (e.g., 'build-flow-started'
  // bubbling up from the CTA button) and emit its own.
  events.on('build-flow-started', (payload) => {
    // Example: the card could animate to acknowledge the click.
    gsap.to(sprite, { scale: 1.02, duration: 0.15, yoyo: true, repeat: 1 });
  });

  return {
    container,
    teardown: () => container.destroy({ children: true })
  };
}
```

### 3.4.1 Example: CTA Button as Its Own Node

The CTA button is ITS OWN node per Invariant 8. Its atlas region contains the button shape, color, gradient, shadow, and the button label text (“Get Started”) — the label was composited via `sharp-svg` at build time per section 1.2.2. Its `createNode` handles click, state effects via method-3 overlay layers, and the backend call:

```js
// nodes/hero-card-cta.js
import { gsap } from 'gsap';

export function createNode(ctx) {
  const { atlas, region, overlayRegions, transform, events, backend, intent } = ctx;

  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);
  container.eventMode = 'static';
  container.cursor = 'pointer';

  // === Layer 1 (z: below): soft glow layer, hidden by default. ===
  // Method 3 (hybrid transparent-layer animation): sized larger than the base button,
  // positioned behind. Alpha is pulsed on hover and success states.
  const glow = new PIXI.Sprite(atlas.getTexture(overlayRegions['glow-pulse']));
  glow.anchor.set(0.5);
  glow.x = transform.width / 2;
  glow.y = transform.height / 2;
  glow.width = transform.width * 1.15;
  glow.height = transform.height * 1.4;
  glow.alpha = 0; // hidden until state triggers it
  container.addChild(glow);

  // === Layer 2 (z: middle): base button sprite. The entire visual — shape, gradient,
  // shadow, and the "Get Started" label — is THIS image. The label was composited
  // via Sharp+SVG at build time per the sharp-svg renderMethod in intent.textContent. ===
  const base = new PIXI.Sprite(atlas.getTexture(region));
  base.width = transform.width;
  base.height = transform.height;
  base.anchor.set(0.5);
  base.x = transform.width / 2;
  base.y = transform.height / 2;
  container.addChild(base);

  // === Layer 3 (z: above): shimmer overlay, hidden by default. ===
  // Method 3: a diagonal shimmer image that sweeps across on hover via x-position tween.
  const shimmer = new PIXI.Sprite(atlas.getTexture(overlayRegions['shimmer']));
  shimmer.anchor.set(0.5);
  shimmer.x = -transform.width / 2;
  shimmer.y = transform.height / 2;
  shimmer.width = transform.width * 0.4;
  shimmer.height = transform.height;
  shimmer.alpha = 0;
  // Use a mask so the shimmer only shows over the button shape, not outside it.
  const shimmerMask = new PIXI.Graphics()
    .roundRect(0, 0, transform.width, transform.height, 12)
    .fill(0xFFFFFF);
  shimmer.mask = shimmerMask;
  container.addChild(shimmerMask);
  container.addChild(shimmer);

  // === Interactions ===

  container.on('pointerover', () => {
    // lift-hover (method 2) + glow-pulse overlay fade-in (method 3) + shimmer sweep (method 3)
    gsap.to(base.scale, { x: 1.03, y: 1.03, duration: 0.2, ease: 'power2.out' });
    gsap.to(glow, { alpha: 0.6, duration: 0.2 });
    gsap.fromTo(shimmer,
      { alpha: 0, x: -transform.width / 2 },
      { alpha: 0.8, x: transform.width * 1.5, duration: 0.6, ease: 'power2.inOut' }
    );
  });

  container.on('pointerout', () => {
    gsap.to(base.scale, { x: 1.0, y: 1.0, duration: 0.2 });
    gsap.to(glow, { alpha: 0, duration: 0.2 });
  });

  container.on('pointerdown', () => {
    // scale-press (method 2) — base shrinks briefly on press
    gsap.to(base.scale, { x: 0.97, y: 0.97, duration: 0.08 });
  });

  container.on('pointerup', () => {
    gsap.to(base.scale, { x: 1.03, y: 1.03, duration: 0.12, ease: 'back.out(2)' });
  });

  container.on('pointertap', async () => {
    // Fire the declared event — Invariant 11 requires this match intent.emits
    events.emit('build-flow-started', { source: intent.nodeId });

    try {
      await backend.call('/api/mock/track-cta-click', { method: 'POST', body: {} });
      // glow-pulse on success (method 3: overlay layer animation)
      gsap.to(glow, {
        alpha: 1.0, duration: 0.15,
        yoyo: true, repeat: 1, ease: 'power2.inOut',
        onComplete: () => { glow.alpha = 0; }
      });
    } catch (err) {
      // SHR telemetry picks up the failure if the declared downstream doesn't fire
    }
  });

  return {
    container,
    teardown: () => container.destroy({ children: true })
  };
}
```

Notice:

- No `PIXI.Text`, no primitive shapes used to construct the button — the button IS the base atlas image.
- The label “Get Started” is baked in via `sharp-svg` at build time (section 5).
- Hover, press, glow-on-success are ALL implemented via method 2 (GSAP transform tweens on the base sprite) + method 3 (overlay layer animations). No new geometry, no text rendering, no CSS.
- The overlay regions come from the atlas — they are images, not code-generated shapes. A soft radial glow PNG, a diagonal shimmer PNG. Both reusable across many button nodes.

### 3.4.2 Example: Toggle With Layer Swapping

A toggle is the clearest case of layer-swap state transitions (section 1.2.4):

```js
// nodes/notification-toggle.js
import { gsap } from 'gsap';

export function createNode(ctx) {
  const { atlas, regions, transform, state, events, intent } = ctx;

  const container = new PIXI.Container();
  container.position.set(transform.x, transform.y);
  container.eventMode = 'static';
  container.cursor = 'pointer';

  // Two sprites from separate atlas regions: toggle-off and toggle-on images.
  // Both created at build time. Runtime swaps which is visible.
  const offSprite = new PIXI.Sprite(atlas.getTexture(regions.off));
  offSprite.width = transform.width;
  offSprite.height = transform.height;
  container.addChild(offSprite);

  const onSprite = new PIXI.Sprite(atlas.getTexture(regions.on));
  onSprite.width = transform.width;
  onSprite.height = transform.height;
  onSprite.alpha = 0; // hidden until toggled on
  container.addChild(onSprite);

  // Initial state from the state manager
  let isOn = state.get('notifications-enabled') ?? false;
  offSprite.alpha = isOn ? 0 : 1;
  onSprite.alpha = isOn ? 1 : 0;

  container.on('pointertap', () => {
    isOn = !isOn;
    state.set('notifications-enabled', isOn);

    // Cross-fade between the two sprite images for polish (method 2)
    gsap.to(offSprite, { alpha: isOn ? 0 : 1, duration: 0.15 });
    gsap.to(onSprite, { alpha: isOn ? 1 : 0, duration: 0.15 });

    events.emit('notifications-toggled', { isOn });
  });

  return {
    container,
    teardown: () => container.destroy({ children: true })
  };
}
```

The visual reality of the toggle changes because the IMAGE shown changes. Not because code drew a different toggle. Both toggle states are pre-rendered images in the atlas; runtime picks which one is visible.

### 3.4.3 Example: Animated Background (i2v Frame-Based)

For an animated background element where pixels within the image need to animate (flowing colors, particle drift, liquid light effects), use method 1 — frame sequence:

```js
// nodes/hero-animated-bg.js
export function createNode(ctx) {
  const { atlas, frameRegions, transform, intent } = ctx;

  const container = new PIXI.Container();

  // frameRegions is an ordered array of atlas regions, one per frame of the animation.
  // Hand-authored for the mock app (pre-rendered frames); i2v-generated in production.
  const sprites = frameRegions.map(region => {
    const s = new PIXI.Sprite(atlas.getTexture(region));
    s.width = transform.width;
    s.height = transform.height;
    s.visible = false;
    container.addChild(s);
    return s;
  });

  let currentFrame = 0;
  sprites[0].visible = true;

  // Cycle frames at target FPS
  const fps = intent.animationSpec?.fps ?? 24;
  const intervalMs = 1000 / fps;
  const timer = setInterval(() => {
    sprites[currentFrame].visible = false;
    currentFrame = (currentFrame + 1) % sprites.length;
    sprites[currentFrame].visible = true;
  }, intervalMs);

  return {
    container,
    teardown: () => { clearInterval(timer); container.destroy({ children: true }); }
  };
}
```

The pixels within the image animate because we’re cycling through pre-rendered frames. Code isn’t generating the animation — it’s playing back the frame sequence. The sequence itself comes from i2v in production or from a hand-authored multi-frame PNG set in the mock app.

### 3.4.2 Counter Example: When MSDF Text IS Used

The ONE case where runtime text is correct: a counter showing the total number of CTA clicks after the backend responds. This data is genuinely dynamic — it didn’t exist at build time, so it can’t be in the atlas.

```js
// nodes/click-counter.js
export function createNode(ctx) {
  const { atlas, region, transform, state, msdfFont } = ctx;

  const container = new PIXI.Container();

  // The background label "Total clicks:" is baked into the atlas.
  const labelSprite = new PIXI.Sprite(atlas.getTexture(region));
  labelSprite.width = transform.width;
  labelSprite.height = transform.height;
  container.addChild(labelSprite);

  // The NUMBER is dynamic — it must be rendered at runtime via MSDF.
  const countText = new PIXI.BitmapText({
    text: '0',
    style: { fontFamily: msdfFont.family, fontSize: 32, fill: 0xFFFFFF }
  });
  countText.position.set(180, 12); // positioned over the "__" placeholder in the atlas
  container.addChild(countText);

  // Listen for state updates and re-render the number
  state.subscribe('heroCtaClicks', (count) => {
    countText.text = String(count);
  });

  return { container, teardown: () => container.destroy({ children: true }) };
}
```

This is the ONLY shape of runtime text rendering that’s correct for Prism. Static copy goes in the atlas.

### 3.5 Node Modules (Backend Side)

Per-node backend module at `backends/{nodeId}.js`, only for nodes with a backend side:

```js
// backends/hero-card.js
export async function handler(request, ctx) {
  // ctx provides: fakeDb, logger, nodeIntent
  if (request.method === 'POST' && request.path === '/api/mock/track-cta-click') {
    const clickCount = (await ctx.fakeDb.get('heroCtaClicks')) ?? 0;
    await ctx.fakeDb.set('heroCtaClicks', clickCount + 1);
    return { status: 200, body: { clickCount: clickCount + 1 } };
  }
  return { status: 404, body: { error: 'not found' } };
}
```

The backend handler shape is the same shape a real Prism engine will generate — it’s just that in the prototype, it runs in the browser via the local backend runtime (Section 6) instead of deploying to Vercel.

-----

## 4. The Prism Runtime Player (Prototype Version)

### 4.1 Entry Point

```ts
// lib/prism/player/index.ts
import { bootPrismApp } from './boot';

export async function mount(canvas: HTMLCanvasElement, prismUrl: string) {
  const app = await bootPrismApp(canvas, prismUrl);
  return {
    app,
    unmount: () => app.teardown()
  };
}
```

### 4.2 Boot Sequence

```ts
// lib/prism/player/boot.ts
export async function bootPrismApp(canvas: HTMLCanvasElement, prismUrl: string) {
  // 1. Fetch the .prism file
  const response = await fetch(prismUrl);
  const prismBytes = await response.arrayBuffer();

  // 2. Unpack the zip (JSZip or fflate in browser)
  const artifact = await unpackPrism(prismBytes);

  // 3. Validate manifest
  validateManifest(artifact.manifest);

  // 4. Initialize PixiJS v8 app (WebGPU preferred, WebGL2 fallback)
  const pixiApp = await initPixi(canvas);

  // 5. Load atlases into PixiJS textures
  const atlasMap = await loadAtlases(artifact.assets, pixiApp.renderer);

  // 6. Load MSDF font atlas
  const fontAtlas = await loadMsdfFont(artifact.assets);

  // 7. Parse graph.json and build in-memory graph
  const graph = parseGraph(artifact.graph);

  // 8. Register per-node modules (lazy-loaded from artifact)
  const moduleRegistry = createModuleRegistry(artifact.nodes);

  // 9. Initialize local backend runtime (Section 6)
  const backend = createLocalBackend(artifact.backends, graph);

  // 10. Initialize state manager
  const state = createStateManager();

  // 11. Initialize event bus with SHR trace hooks
  const events = createEventBus({ shrTrace: true });

  // 12. Initialize hub manager
  const hubManager = createHubManager({
    graph, moduleRegistry, pixiApp, atlasMap, fontAtlas,
    state, events, backend
  });

  // 13. Initialize SHR toy client (Section 9)
  const shr = initShrToyClient({ graph, events, moduleRegistry });

  // 14. Navigate to entry hub
  await hubManager.navigateTo(artifact.manifest.entryHub);

  return {
    pixiApp,
    graph,
    hubManager,
    state,
    events,
    backend,
    shr,
    teardown: () => { /* cleanup all */ }
  };
}
```

### 4.3 PixiJS Initialization

```ts
// lib/prism/player/pixi-init.ts
import { Application } from 'pixi.js';

export async function initPixi(canvas: HTMLCanvasElement) {
  const app = new Application();
  await app.init({
    canvas,
    preference: 'webgpu',        // WebGPU preferred per V3 Section 14
    powerPreference: 'high-performance',
    antialias: true,
    resolution: window.devicePixelRatio,
    autoDensity: true,
    backgroundAlpha: 0,
  });
  return app;
}
```

### 4.4 Atlas Loading

```ts
// lib/prism/player/atlas-loader.ts
import { Texture, Rectangle } from 'pixi.js';

export async function loadAtlases(
  assets: Map<string, Uint8Array>,
  renderer: any
): Promise<Map<string, AtlasTextureProvider>> {
  const map = new Map();
  for (const [path, bytes] of assets) {
    if (!path.endsWith('.avif')) continue;
    const blob = new Blob([bytes], { type: 'image/avif' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    await img.decode();
    const baseTexture = Texture.from(img);
    const atlasId = path.replace('assets/', '').replace('.avif', '');
    map.set(atlasId, {
      getTexture(region) {
        const frame = new Rectangle(region.x, region.y, region.w, region.h);
        return new Texture({ source: baseTexture.source, frame });
      }
    });
  }
  return map;
}
```

AVIF decoding uses the native `Image` element — as of April 2026 AVIF is 94.9% supported in browsers per research. For the ~5% trailing case, fall back to a PNG variant (build script produces both; player picks based on browser capability).

### 4.5 Hub Manager & Reparent-on-Navigate

```ts
// lib/prism/player/hub-manager.ts
export function createHubManager(deps) {
  let currentHubContainer: PIXI.Container | null = null;
  const nodeContainers = new Map<string, PIXI.Container>();

  async function navigateTo(hubId: string) {
    const hub = deps.graph.getHub(hubId);

    // Create new hub container (will become this hub's Render Group)
    const hubContainer = new PIXI.Container();
    hubContainer.isRenderGroup = true;

    // For each node in this hub, instantiate or reparent
    for (const nodeId of hub.nodeIds) {
      const node = deps.graph.getNode(nodeId);
      let nodeContainer = nodeContainers.get(nodeId);

      if (!nodeContainer) {
        // First time rendering this node — instantiate
        const module = await deps.moduleRegistry.load(node.codeRef);
        const result = module.createNode({
          atlas: deps.atlasMap.get(node.visual.atlasId),
          region: node.visual.region,
          transform: node.visual.transform,
          state: deps.state,
          events: deps.events,
          backend: deps.backend,
        });
        nodeContainer = result.container;
        nodeContainers.set(nodeId, nodeContainer);
      } else {
        // Shared node — reparent to new hub
        if (nodeContainer.parent) {
          nodeContainer.parent.removeChild(nodeContainer);
        }
      }

      hubContainer.addChild(nodeContainer);
    }

    // Swap hub containers
    if (currentHubContainer) {
      deps.pixiApp.stage.removeChild(currentHubContainer);
      // Note: do NOT destroy currentHubContainer — its children are shared
    }
    deps.pixiApp.stage.addChild(hubContainer);
    currentHubContainer = hubContainer;

    deps.events.emit('hub-navigated', { hubId });
  }

  return { navigateTo, getCurrentHub: () => currentHubContainer };
}
```

The prototype may only have one hub — `home-hub` — but the reparent-on-navigate pattern is in place so that as the mock app grows to multiple hubs, navigation already works correctly.

### 4.6 Module Registry & Hot-Swap

```ts
// lib/prism/player/module-registry.ts
export function createModuleRegistry(nodesMap: Map<string, string>) {
  const loaded = new Map<string, any>();

  async function load(codeRef: string) {
    if (loaded.has(codeRef)) return loaded.get(codeRef);

    const source = nodesMap.get(codeRef);
    if (!source) throw new Error(`Node module not found: ${codeRef}`);

    // Compile via blob URL + dynamic import
    const blob = new Blob([source], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const module = await import(/* @vite-ignore */ url);
    URL.revokeObjectURL(url);

    loaded.set(codeRef, module);
    return module;
  }

  function hotSwap(codeRef: string, newSource: string) {
    // Used by SHR: replace a node's module without reloading the page
    const blob = new Blob([newSource], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    return import(/* @vite-ignore */ url).then(module => {
      loaded.set(codeRef, module);
      URL.revokeObjectURL(url);
      return module;
    });
  }

  return { load, hotSwap };
}
```

-----

## 5. Asset Provisioning and Atlas Baking

This section covers TWO phases that run before the `.prism` artifact is assembled:

- **Phase A (Section 5.0):** Asset provisioning — generating and retrieving all source images, animation frame sequences, and fonts needed by the mock app. This uses the user’s fal.ai account for AI generation of images and i2v animations, plus public URLs for fonts and reusable overlay assets.
- **Phase B (Section 5.1-5.4):** Atlas baking — taking the provisioned source assets and packing them into the AVIF atlas + MSDF font atlas + frame sequences that go into the `.prism` file.

Phase A must complete before Phase B can run.

-----

### 5.0 Asset Provisioning via fal.ai

The user has provided fal.ai API access. Claude Code uses fal.ai as the primary source for all AI-generated assets in the mock app — FLUX.2 for images (matching the production Prism engine’s Invariant 8 image source), and fal’s i2v models for frame-sequence animations. This makes the mock genuinely representative of what the production engine produces.

**Environment:**

Claude Code reads the user’s fal.ai API key from `.env.local` at the repo root:

```
FAL_KEY=<user's fal.ai key>
```

The provisioning script (`lib/prism/mock-app-source/assets/provision-assets.mjs`) uses `@fal-ai/client` (the official SDK) to generate and retrieve all assets. Claude Code should search current fal.ai docs (docs.fal.ai) for the exact model endpoints, parameter shapes, and queue/stream patterns as of the build date — fal’s API and model catalog change; training-time assumptions will be wrong.

**Asset categories and provisioning strategy:**

|Category                                               |Source                                                                                                                                     |Notes                                                                                                                                 |
|-------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------|
|Style reference image                                  |fal.ai FLUX.2 (first call, establishes style)                                                                                              |Generated before any element image; all subsequent FLUX calls reference this for visual consistency                                   |
|Base element images (no text)                          |fal.ai FLUX.2 dev, FLUX.2 Klein, or current best text-free UI model                                                                        |Negative prompt includes “no text, no letters, no words, no labels”. These are inputs to the sharp-svg text compositing in Section 5.2|
|Decorative/stylized text element images                |fal.ai Ideogram v3 (or current best text-in-image model)                                                                                   |Used for `diffusion` renderMethod textContent — text is baked into the image                                                          |
|State variant images (hover/pressed/toggle-on/etc.)    |fal.ai FLUX.2 with style reference + state-specific prompt variation                                                                       |Each variant generated separately with prompt diffs like “with subtle lifted glow” vs base                                            |
|i2v animation frame sequences                          |fal.ai image-to-video model (current best: WAN 2.5, Kling 2.5, Hunyuan Video, or whatever fal currently hosts with best UI-friendly output)|Feeds a base image to the i2v model, retrieves the generated video, extracts frames via ffmpeg-wasm or server-side ffmpeg             |
|Overlay layers (glow, shimmer, ripple, scanline, frost)|fal.ai FLUX.2 with transparent-background prompt, OR public URLs if specified                                                              |Reusable across many nodes; small set of ~8-10 overlays total                                                                         |
|MSDF font atlas                                        |msdf-atlas-gen from a .ttf in public/fonts/                                                                                                |Not AI-generated; deterministic tool. Inter or similar chosen up front                                                                |

**Style lock workflow (critical for visual consistency):**

Step 1 — Generate the style reference FIRST, before any element images. Claude Code calls fal.ai FLUX.2 with a prompt describing the overall visual style:

```
"A premium SaaS web application interface element in dark mode.
Deep charcoal background (#0a0a12) with electric blue accent gradients (#4da6ff to #9b66ff).
Subtle glass morphism with soft translucency.
Crisp edges, subtle drop shadows, gentle glow on interactive elements.
Clean modern aesthetic, professional product design quality.
Photorealistic rendering, pixel-perfect edges, no artifacts.
NO TEXT, NO LETTERS, NO LABELS.
Transparent background where the element ends."
```

Save output to `source-images/_style-reference.png`. This image is NOT itself used in the mock — it’s the visual anchor for all subsequent generations.

Step 2 — Every base element image generation call references the style image via fal’s image conditioning (`image_url` parameter or equivalent for the chosen model). The prompt specifies what the element is while the style image locks appearance. Example for the hero CTA button:

```
Model: fal-ai/flux-2/dev (or current best UI element generator)
image_url: <URL of _style-reference.png from fal's CDN after first upload>
prompt: "Primary call-to-action button, pill-shaped rounded rectangle,
         240x64 pixels, filled with the blue-to-purple gradient from the reference,
         subtle drop shadow below, soft inner glow on the top edge,
         transparent background outside the button shape.
         NO TEXT. NO LETTERS."
negative_prompt: "text, letters, words, labels, watermark, signature, rough edges, low quality"
image_size: { width: 256, height: 96 }  (slight padding for glow/shadow extending past button edge)
```

Step 3 — Generate all ~40-60 base element images consistently against the style reference. Upload each to fal’s asset store or save locally.

**i2v animation workflow:**

For nodes with method-1 frame-based animations, the flow is:

1. Generate the first-frame base image via FLUX.2 (same as any element image).
1. Feed that base image to fal’s current best i2v model (Claude Code searches fal docs for current recommendation — likely Kling, WAN, Hunyuan, or similar as of build date). Specify motion prompt (“gentle liquid light flowing diagonally, slow ambient pulse, loop seamlessly at 24fps”).
1. Retrieve the output video (typically 24-48 frames at 24fps, ~1-2 seconds loop).
1. Extract frames as PNGs using ffmpeg-wasm (browser-compatible) or Node’s ffmpeg binding. Save as `source-images/frames/{nodeId}/frame-00.png` through `frame-NN.png`.
1. The atlas build script (Section 5.2) packs each frame as its own atlas region.

For the mock app, keep i2v to a minimum — ONE or TWO elements demonstrate method 1 without bloating the atlas. A good candidate: an animated background element in the hero section with flowing gradient light, or a subtle “AI thinking” shimmer on a feature card.

**Overlay layer provisioning:**

Overlay layers are small, reusable, and don’t need style-lock against the main reference. Generate them as standalone transparent-background PNGs with direct prompts:

- `glow-soft.png`: “Soft radial glow, blue-to-purple gradient, 256x256, transparent background, centered, falloff from 80% opacity center to 0% at edges”
- `shimmer-diagonal.png`: “Diagonal sweep of bright light, narrow strip, 45-degree angle, white-to-transparent gradient, 128x64”
- `ripple-circle.png`: “Expanding concentric rings, blue, semi-transparent, 256x256, centered, fading outward”
- `scanline.png`: “Thin horizontal scan line, cyan, glowing, 1920x4, transparent background”
- `frost-noise.png`: “Frosted glass noise texture, 512x512, subtle grain, transparent background with low-opacity white specks”
- `border-trace.png`: “Thin glowing border outline, blue, rounded rectangle shape with transparent interior, 240x64”

Alternatively, hand-provide these in the repo at `source-images/overlays/` — they are simple enough that pre-existing assets from a UI asset pack or Figma kit would work fine. If Claude Code sees files already present, skip regeneration.

**Provisioning script responsibilities:**

The provisioning script at `lib/prism/mock-app-source/assets/provision-assets.mjs` must:

1. Read `FAL_KEY` from `.env.local`. If missing, fail clearly with instructions.
1. Check which source images already exist on disk. Skip regeneration for any that exist (idempotent — running twice doesn’t re-cost fal credits).
1. Generate the style reference if missing.
1. Upload style reference to fal for use as `image_url` in subsequent calls.
1. For each node in the graph source (`hubs/home-hub.json`), generate the required base image + state variants + i2v frames per the node’s `visual.sourceAsset` and `intent.visualSpec` specs.
1. Generate overlay layers if missing.
1. Run `msdf-atlas-gen` if the MSDF atlas is missing.
1. Write a provisioning log to `lib/prism/mock-app-source/assets/.provisioning-manifest.json` recording what was generated, fal model used, fal request IDs, costs, and local paths. This enables re-runs to be selective and gives the user an audit trail.
1. Surface fal.ai errors clearly — rate limits, invalid API key, model not found — rather than silently producing broken images.

**Documentation lookup requirement:**

fal.ai’s API and model catalog changes frequently. Claude Code MUST search the live docs at `https://docs.fal.ai` (and model-specific pages like `https://fal.ai/models/fal-ai/flux-2/dev`) to get the current:

- Exact model identifier strings (e.g. `fal-ai/flux-2/dev` may have been renamed)
- Parameter names and types (image generation parameters evolve)
- i2v model recommendations (Kling, WAN, Hunyuan, Sora-via-fal, etc. — the best varies over time)
- Queue vs sync vs streaming patterns
- Pricing per model (to inform the provisioning log)

Do NOT rely on training-time knowledge of fal’s API surface. Search current docs before writing the provisioning script.

**Estimated fal.ai cost for a full mock build:**

At current (April 2026) fal.ai pricing with FLUX.2 + one i2v element:

- ~50 base element images @ $0.009 each (FLUX.2 Klein at sub-second) = ~$0.45
- ~10 state variants @ $0.009 = ~$0.09
- ~8 overlay layers @ $0.009 = ~$0.07
- 1 style reference = $0.009
- 1 i2v animation (~48 frames, Kling or similar) ~ $0.10-0.40 depending on model
- **Total per full build: ~$0.65-$1.00**

Running the provisioning script once and caching locally means subsequent mock-app rebuilds cost $0. The `.provisioning-manifest.json` tracks what’s cached.

-----

### 5.1 Atlas Source Image Requirements (After Provisioning)

After Section 5.0 provisioning completes, the `source-images/` directory contains everything needed for atlas baking. This section describes what the atlas build script expects to find.

**Source image requirements — this is critical:**

- One **base source image** per node in the graph, PLUS overlay images and state-variant images per node that needs them. If the graph declares 40 nodes and 10 of them have 3 states each plus shared overlay layers (glow, shimmer, ripple), the total source image count is closer to 60-80.
- Each base source image represents ONE element’s visual (a button, a logo, a card background, a feature tile, a footer link). Not a section of UI.
- Each source image is at its NATURAL rendered size (e.g., a button at 240×64 px, a card background at 1280×480 px) — no cropping, no letterboxing.
- **Source images for `sharp-svg` textContent nodes have NO TEXT.** They are the pure visual — button shape with gradient and shadow, card background with decorative elements, nav link with subtle underline — and nothing else. Text gets composited in by the build script per the node’s `textContent` entries. This matches what FLUX produces in production.
- **Source images for `diffusion` textContent nodes HAVE text baked in.** For decorative stylized text where the design is inseparable from the typography treatment (a stylized logo wordmark, an artistic hero headline with custom character treatment), the source image includes the text as part of the hand-authored design. This simulates Ideogram output.
- **Overlay images** (glow, shimmer, ripple, scanline, border-trace, frost) are reusable. One soft radial glow PNG can be referenced by many nodes. These live alongside the element images and are also packed into the atlas.
- **State variant images** for nodes using layer-swap state transitions — `toggle-off.png`, `toggle-on.png`, `button-default.png`, `button-hover.png`, `button-pressed.png` — are separate images, each packed as its own atlas region.
- **Animation frame sequences** for nodes using method-1 i2v animation — `hero-bg-frame-00.png` through `hero-bg-frame-23.png` for a 24-frame animation — are a series of images packed as separate regions, indexed per node in its `frameRegions` metadata.
- Source images should be produced at design quality — these represent what FLUX produces. Acceptable sources: Figma exports (high-DPI PNG), AI image generator output (Midjourney, DALL-E, Ideogram, Stable Diffusion), photo-real renders, or hand-designed PNG files. NOT acceptable: screenshots of DOM-rendered HTML with system fonts (looks nothing like FLUX output).
- PNG with transparency is the expected source format (the atlas compiler converts to AVIF with alpha).
- Source images live in `lib/prism/mock-app-source/assets/source-images/` organized as:
  
  ```
  source-images/
    base/              ← one image per node (no-text version for sharp-svg nodes,
                         text-baked version for diffusion nodes)
    overlays/          ← reusable overlay layers (glow-soft.png, shimmer-diagonal.png,
                         ripple-circle.png, scanline.png, frost-noise.png, etc.)
    states/            ← per-node state variants (toggle-off.png, toggle-on.png, etc.)
    frames/            ← per-node animation frame sequences
      hero-bg/
        frame-00.png
        frame-01.png
        ...
  ```

If the source images look like “web UI with system fonts and tailwind colors,” the rendered Prism mock app will look wrong. The source images should look like designed art — gradients, glows, carefully-rendered decorative elements, shadows, depth. This is what FLUX produces. The mock app should look like a real product.

### 5.2 Build Script

The build script implements the REAL `sharp-svg` text compositing pipeline per V3 Invariant 6. For each base source image, it looks up the corresponding node’s `textContent` array, renders each `sharp-svg` text entry as an SVG, and composites them onto the base image BEFORE packing into the atlas. The output atlas regions contain text-baked images, same as the production engine produces.

```js
// lib/prism/mock-app-source/assets/build-atlas.mjs
import sharp from 'sharp';
import { MaxRectsPacker } from 'maxrects-packer';
import { globby } from 'globby';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

// --- Load node definitions (to know which text goes on which image) ---
const graphSource = JSON.parse(readFileSync('../hubs/home-hub.json', 'utf-8'));
const nodesByAssetKey = new Map(); // maps source image filename → node definition
for (const node of graphSource.nodes) {
  const assetKey = node.visual.sourceAsset ?? node.nodeId; // e.g. "navbar-logo" or "hero-card-cta"
  nodesByAssetKey.set(assetKey, node);
}

// --- Helper: render a TextContentSpec as an SVG and return its PNG buffer ---
async function renderTextOverlay(text, typography, position, width, height) {
  const { fontFamily, fontSize, fontWeight, color } = typography;
  const anchor = position.anchor ?? 'left';
  const textAnchor = anchor === 'center' ? 'middle' : anchor === 'right' ? 'end' : 'start';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <style>
      @font-face { font-family: '${fontFamily}'; src: url('file://${path.resolve(`../../../public/fonts/${fontFamily}-Variable.ttf`)}'); }
    </style>
    <text x="${position.x}" y="${position.y}"
          font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}"
          fill="${color}" text-anchor="${textAnchor}"
          dominant-baseline="middle">${escapeXml(text)}</text>
  </svg>`;
  return Buffer.from(svg);
}

function escapeXml(s) {
  return s.replace(/[<>&'"]/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', "'":'&apos;', '"':'&quot;' }[c]));
}

// --- Process each source image: composite sharp-svg text where the node declares it ---
async function processSourceImage(sourcePath) {
  const assetKey = path.basename(sourcePath, path.extname(sourcePath));
  const node = nodesByAssetKey.get(assetKey);

  let img = sharp(sourcePath);
  const meta = await img.metadata();

  if (node?.intent?.visualSpec?.textContent) {
    const sharpSvgEntries = node.intent.visualSpec.textContent.filter(
      t => t.renderMethod === 'sharp-svg'
    );
    if (sharpSvgEntries.length > 0) {
      const overlays = await Promise.all(sharpSvgEntries.map(async t => ({
        input: await renderTextOverlay(t.text, t.typography, t.position, meta.width, meta.height),
        top: 0, left: 0,
      })));
      img = img.composite(overlays);
    }
  }

  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  return { assetKey, width: info.width, height: info.height, data, channels: info.channels };
}

// --- Collect all source images (base + overlays + states + frames) ---
const sources = await globby([
  'source-images/base/*.png',
  'source-images/overlays/*.png',
  'source-images/states/*.png',
  'source-images/frames/**/*.png',
]);
const images = await Promise.all(sources.map(processSourceImage));

// --- Pack ---
const packer = new MaxRectsPacker(2048, 2048, 2);
packer.addArray(images.map(i => ({ width: i.width, height: i.height, data: i })));

// --- Compose final atlas ---
const atlasBase = sharp({
  create: { width: 2048, height: 2048, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
});
const composites = packer.bins[0].rects.map(r => ({
  input: r.data.data,
  raw: { width: r.width, height: r.height, channels: r.data.channels },
  top: r.y, left: r.x,
}));
const avif = await atlasBase.composite(composites).avif({ quality: 75 }).toBuffer();
writeFileSync('../assets/atlas-0.avif', avif);

// --- Emit regions JSON ---
const regions = {};
packer.bins[0].rects.forEach(r => {
  regions[r.data.assetKey] = { atlasId: 'atlas-0', x: r.x, y: r.y, w: r.width, h: r.height };
});
writeFileSync('../assets/atlas-regions.json', JSON.stringify(regions, null, 2));
```

This is the real pipeline, not a shortcut. Every `sharp-svg` textContent entry in every node gets composited onto its base image at build time using the exact typography, position, and color specified. The atlas regions at the end contain text-baked images identical in structure to what the production engine produces — the only difference is the base image came from a hand-authored PNG instead of FLUX.

AVIF quality 75 is visually lossless per research; outputs 40-60% smaller than JPEG. For a mock app with ~40 nodes + overlays + states, atlas is ~500KB-1.5MB.

### 5.3 MSDF Font Atlas

Generate once with `msdf-atlas-gen` (Node CLI):

```bash
npx msdf-atlas-gen -font public/fonts/Inter-Variable.ttf \
  -size 48 -type mtsdf \
  -imageout public/prism-assets/font-inter.msdf.png \
  -json public/prism-assets/font-inter.msdf.json
```

Bundled into the `.prism` at build time.

### 5.4 .prism Assembly Script

```js
// lib/prism/mock-app-source/build-prism.mjs
import JSZip from 'jszip';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { createHash } from 'crypto';

const zip = new JSZip();

// Add graph.json (compiled from hubs/ and nodes/ sources)
const graph = buildGraphFromSources();
zip.file('graph.json', JSON.stringify(graph, null, 2));

// Add per-node frontend modules
for (const nodeFile of readdirSync('./nodes')) {
  zip.folder('nodes').file(nodeFile.replace('.ts', '.js'),
    compileTsToJs(`./nodes/${nodeFile}`));
}

// Add per-node backend modules
for (const backendFile of readdirSync('./backends')) {
  zip.folder('backends').file(backendFile.replace('.ts', '.js'),
    compileTsToJs(`./backends/${backendFile}`));
}

// Add schemas
zip.folder('schemas').file('shared-types.js', compileTsToJs('./schemas/shared-types.ts'));

// Add assets
zip.folder('assets').file('atlas-0.avif', readFileSync('./assets/atlas-0.avif'));
zip.folder('assets').file('font-inter.msdf.json', readFileSync('./assets/font-inter.msdf.json'));
zip.folder('assets').file('font-inter.msdf.png', readFileSync('./assets/font-inter.msdf.png'));

// Generate manifest with asset hashes
const manifest = buildManifest(graph);
zip.file('manifest.json', JSON.stringify(manifest, null, 2));

// Meta
zip.folder('meta').file('version.txt', '0.1.0');
zip.folder('meta').file('generator.json', JSON.stringify({
  generator: 'hand-authored-mock', version: '1.0', date: new Date().toISOString()
}, null, 2));

// Write .prism (which is just a zip with a custom extension)
const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
writeFileSync('../../../public/prism-assets/mock-app.prism', buffer);
```

Run via `pnpm run build:prism`. Output lands in `public/prism-assets/mock-app.prism`, served as a static asset by Next.js.

-----

## 6. Local Backend Runtime (In-Browser)

### 6.1 Purpose

Real Prism apps deploy their backend sides with their frontend sides to hosts like Vercel. The prototype runs everything in the browser, so we need a local backend runtime that executes backend node handlers in-browser against a fake database. This is ONLY for the prototype — real Prism apps use real deployed backends.

The backend handler shape is identical to what the engine will generate. This is the important invariant: when the real engine is built, backend modules can move from the in-browser runtime to a real Vercel deployment without changing.

### 6.2 Router

```ts
// lib/prism/local-backend/router.ts
export function createLocalBackend(
  backendsMap: Map<string, string>,
  graph: Graph
): BackendClient {
  const handlers = new Map<string, Function>();
  const fakeDb = createFakeDb();

  // Load all backend modules and index their handler functions
  for (const [path, source] of backendsMap) {
    const blob = new Blob([source], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    import(/* @vite-ignore */ url).then(module => {
      const nodeId = path.replace('backends/', '').replace('.js', '');
      handlers.set(nodeId, module.handler);
      URL.revokeObjectURL(url);
    });
  }

  async function call(path: string, options: RequestOptions = {}) {
    // Route the request to the correct handler based on path
    const targetNodeId = routePathToNode(path, graph);
    const handler = handlers.get(targetNodeId);
    if (!handler) throw new Error(`No handler for ${path}`);

    const request = {
      method: options.method ?? 'GET',
      path,
      body: options.body ?? null,
      headers: options.headers ?? {}
    };

    const ctx = {
      fakeDb,
      logger: console,
      nodeIntent: graph.getNode(targetNodeId).intent
    };

    const response = await handler(request, ctx);
    return response;
  }

  return { call };
}
```

### 6.3 Fake DB

```ts
// lib/prism/local-backend/fake-db.ts
export function createFakeDb() {
  // Backed by IndexedDB so state persists across reloads during development
  const store: Map<string, any> = new Map();

  return {
    async get(key: string) { return store.get(key); },
    async set(key: string, value: any) { store.set(key, value); return value; },
    async delete(key: string) { store.delete(key); },
    async list(prefix: string) {
      return Array.from(store.entries()).filter(([k]) => k.startsWith(prefix));
    }
  };
}
```

Upgrade to IndexedDB-backed persistence via `idb-keyval` if developer demand warrants it. Not required for basic prototype.

### 6.4 Route Resolution

```ts
// lib/prism/local-backend/router.ts (continued)
function routePathToNode(path: string, graph: Graph): string {
  // Walk the graph looking for a node whose backendRef handles this path
  for (const node of graph.allNodes()) {
    if (!node.backendRef) continue;
    const routes = node.intent?.behaviorSpec?.apiCalls ?? [];
    if (routes.some(r => r.endpoint === path)) return node.nodeId;
  }
  throw new Error(`No node handles backend path: ${path}`);
}
```

-----

## 7. Integration Into the Prototype

### 7.1 Replacing MockApp.tsx

Old `MockApp.tsx` (HTML divs) is removed. New `PrismHost.tsx`:

```tsx
// components/prism-player/PrismHost.tsx
'use client';

import { useEffect, useRef } from 'react';
import { mount } from '@/lib/prism/player';
import { useGraphStore } from '@/lib/graph-store';

export function PrismHost() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const setGraphFromPrism = useGraphStore(s => s.setGraphFromPrism);

  useEffect(() => {
    if (!canvasRef.current) return;
    let app: any;
    (async () => {
      app = await mount(canvasRef.current!, '/prism-assets/mock-app.prism');
      // Hand the graph to the Zustand store so the 3D graph pane renders it
      setGraphFromPrism(app.app.graph);
    })();
    return () => { app?.unmount(); };
  }, [setGraphFromPrism]);

  return (
    <div className="w-full h-full bg-black">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
```

### 7.2 Editor Page Update

```tsx
// app/editor/page.tsx — minimal change
import { SplitPane } from '@/components/editor/SplitPane';
import { PrismHost } from '@/components/prism-player/PrismHost';  // was: MockApp
import { GraphPane } from '@/components/editor/GraphPane';

export default function EditorPage() {
  return (
    <SplitPane
      left={<PrismHost />}
      right={<GraphPane />}
    />
  );
}
```

### 7.3 Graph Store Update

```ts
// lib/graph-store.ts — add one field + one action
import { create } from 'zustand';

interface GraphState {
  // ... existing fields

  // NEW: the graph as loaded from the .prism
  prismGraph: PrismGraph | null;
  setGraphFromPrism: (graph: PrismGraph) => void;
}

export const useGraphStore = create<GraphState>((set) => ({
  // ... existing
  prismGraph: null,
  setGraphFromPrism: (graph) => set({ prismGraph: graph })
}));
```

### 7.4 GraphPane Reads From prismGraph Instead of html-to-image Captures

Update GraphPane to pull node data from `prismGraph` instead of the old captured-texture store:

```tsx
// components/editor/GraphPane.tsx — one section changes
const prismGraph = useGraphStore(s => s.prismGraph);

// Replace old `capturedTextures` code with:
const nodes = prismGraph?.nodes ?? [];
const edges = prismGraph?.edges ?? [];

// Render spheres from the graph's node list; labels/colors from each node's intent.caption
```

The 3D graph pane’s visual design is untouched — only the data source changes.

-----

## 8. Dependency Changes

### 8.1 Add

```json
{
  "dependencies": {
    "pixi.js": "^8.5.0",
    "jszip": "^3.10.1",
    "gsap": "^3.13.0"
  },
  "devDependencies": {
    "sharp": "^0.33.0",
    "maxrects-packer": "^2.7.3",
    "globby": "^14.0.0",
    "msdf-atlas-gen": "^1.3.0",
    "@fal-ai/client": "latest",
    "dotenv": "^16.4.0",
    "@ffmpeg/ffmpeg": "^0.12.0",
    "@ffmpeg/util": "^0.12.0"
  }
}
```

Notes on versions: Claude Code should search for current stable versions of `@fal-ai/client` and `@ffmpeg/*` at install time since these move frequently. If `@fal-ai/client` has a newer officially-recommended replacement (e.g., `@fal-ai/serverless-client` has been the official name in the past), use the current one from docs.fal.ai. Server-side fal calls via raw `fetch` are also acceptable if the SDK is unstable.

### 8.2 Remove

```json
{
  "dependencies": {
    "html-to-image": "REMOVE",
    "dom-to-image": "REMOVE"
  }
}
```

### 8.3 Build Scripts

```json
{
  "scripts": {
    "provision-assets": "node --env-file=.env.local lib/prism/mock-app-source/assets/provision-assets.mjs",
    "build:atlas": "node lib/prism/mock-app-source/assets/build-atlas.mjs",
    "build:msdf": "msdf-atlas-gen -font public/fonts/Inter-Variable.ttf -size 48 -type mtsdf -imageout public/prism-assets/font-inter.msdf.png -json public/prism-assets/font-inter.msdf.json",
    "build:prism": "pnpm run build:atlas && pnpm run build:msdf && node lib/prism/mock-app-source/build-prism.mjs",
    "dev": "pnpm run build:prism && next dev",
    "build": "pnpm run build:prism && next build"
  }
}
```

`provision-assets` is run explicitly once (or when new nodes are added). It reads `FAL_KEY` from `.env.local`, generates all missing source images via fal.ai, and caches them. Subsequent runs of `dev` and `build` do NOT re-call fal.ai — they use the cached source images. Re-run `provision-assets` only when the graph gains new nodes or when a node’s intent changes in a way that requires a new image.

**`.env.local` required entries:**

```
FAL_KEY=your_fal_api_key_here
```

This file must exist before `provision-assets` runs. The script fails with a clear error if `FAL_KEY` is missing.

### 8.4 .gitignore additions

```
.env.local
lib/prism/mock-app-source/assets/source-images/
lib/prism/mock-app-source/assets/.provisioning-manifest.json
public/prism-assets/
```

Source images, the provisioning manifest, and the built atlas/MSDF outputs should not be committed. Each developer provisions their own via their own fal key. CI/CD can use a shared fal key and cache the provisioned assets in a build cache if desired.

-----

## 9. Toy Self-Healing Runtime (Prototype Only)

### 9.1 Scope

The prototype demonstrates SHR with a MOCK local repair — it detects divergence correctly per V3 Section 28, but the “repair” is a hardcoded swap rather than a real local model. This proves the architecture is right; the real model integration comes later.

### 9.2 Telemetry

```ts
// lib/prism/player/shr/telemetry.ts
export function initShrToyClient({ graph, events, moduleRegistry }) {
  const suspectCounts = new Map<string, number>();
  const lastEvents = new Map<string, number>();

  events.onAny((eventName, payload, sourceNodeId) => {
    const sourceNode = graph.getNode(sourceNodeId);
    if (!sourceNode) return;

    const declared = sourceNode.intent.behaviorSpec.triggersDownstream
      .filter(t => t.eventName === eventName);
    if (declared.length === 0) return;

    // For each declared downstream target, set a watchdog
    for (const target of declared) {
      for (const targetNodeId of target.targetNodeIds) {
        const expectedUntil = Date.now() + target.toleranceMs;
        const watchdog = setTimeout(() => {
          const observed = lastEvents.get(`${targetNodeId}:${target.eventName}`) ?? 0;
          if (observed < Date.now() - target.toleranceMs) {
            // Divergence detected
            onDivergence(sourceNodeId, eventName, target);
          }
        }, target.toleranceMs + 50);
      }
    }
  });

  function onDivergence(sourceNodeId, eventName, target) {
    const count = (suspectCounts.get(sourceNodeId) ?? 0) + 1;
    suspectCounts.set(sourceNodeId, count);
    console.warn(`[SHR] Node ${sourceNodeId} suspect (count: ${count}) — expected downstream ${target.eventName} did not fire`);
    if (count >= 3) {
      triggerRepair(sourceNodeId, eventName, target);
    }
  }

  async function triggerRepair(nodeId, eventName, target) {
    console.log(`[SHR TOY] Repairing ${nodeId} for failed ${eventName} -> ${target.eventName}`);
    events.emit('shr-repair-triggered', { nodeId, eventName });

    // Show a small "…" indicator over the affected node while "repair" happens
    const node = graph.getNode(nodeId);
    const nodeContainer = moduleRegistry.getRenderedContainer(nodeId);
    if (nodeContainer) showRepairIndicator(nodeContainer);

    // Simulate local model inference latency (~1s for a real Qwen3-Coder-Next 3B on WebGPU)
    await new Promise(r => setTimeout(r, 1000));

    // Toy "repair": we keep a copy of the original module source on boot.
    // On repair, we hot-swap back to it. Real SHR would regenerate from the node's
    // caption/behaviorSpec via a local model. The OUTCOME is the same: the module
    // is replaced and the node works again.
    const originalSource = toyRepairCache.get(nodeId);
    if (!originalSource) {
      console.warn(`[SHR TOY] No cached original for ${nodeId}, cannot repair`);
      events.emit('shr-needs-user-attention', { nodeId });
      return;
    }

    await moduleRegistry.hotSwap(node.codeRef, originalSource);
    suspectCounts.delete(nodeId);
    hideRepairIndicator(nodeContainer);
    console.log(`[SHR TOY] Repaired ${nodeId} — user's next click should work.`);
    events.emit('shr-repair-completed', { nodeId });
  }

  // Toy cache: on boot, snapshot every loaded module so we can "repair" to it.
  // Real SHR does not need this — it regenerates from intent.
  const toyRepairCache = new Map();
  for (const [codeRef, source] of moduleRegistry.getAllSources()) {
    toyRepairCache.set(codeRefToNodeId(codeRef), source);
  }

  function showRepairIndicator(container) {
    // Small spinner sprite or pulsing dots overlay on the container.
    // Implementation: create a PIXI.Container with a spinning sprite, add to the node's container.
  }

  function hideRepairIndicator(container) {
    // Remove the overlay.
  }

  return { getSuspectCounts: () => suspectCounts };
}
```

### 9.3 Demo Flow

The prototype includes a hidden “break node X” dev tool button that artificially corrupts a node’s handler. Clicking it:

1. Replaces the node’s module with a no-op
1. User clicks the button the broken node handles
1. Event fires but declared downstream doesn’t happen
1. After 3 consecutive tries, SHR detects divergence
1. A visible “SHR: repairing node X…” indicator appears for 1 second
1. Module registry hot-swaps back to the original code
1. User’s next click works

This demonstrates the SHR architecture is correct without requiring a real on-device model. The real model integration comes in a later phase.

-----

## 10. Success Criteria

The mock app conversion is complete when ALL of these are true:

**Build & setup:**

1. Running `pnpm run provision-assets` (reads `FAL_KEY` from `.env.local`) generates all base element images, state variants, overlay layers, and i2v frame sequences via fal.ai, caches them in `source-images/`, and writes `.provisioning-manifest.json` with request IDs and costs
1. Running `pnpm run build-atlas` takes the provisioned source images, composites `sharp-svg` text onto the base images per node textContent specs, packs into AVIF atlas + emits regions JSON + packs MSDF font atlas
1. Running `pnpm run dev` assembles the `.prism` file and starts the Next.js dev server
1. Navigating to `/editor` shows the split pane with PixiJS rendering on the left, 3D graph on the right

**Rendering — images for literally every element (section 1.4):**
5. Every visible piece of the mock app is an atlas image — buttons, icons, containers, cards, nav links, backgrounds, dividers, badges, input chromes, toggles, etc. Grep test: `new PIXI.Graphics()` appears ONLY as invisible hit areas, masks, or dev-mode debug overlays. `new PIXI.Text` does not appear at all.
6. The PixiJS render looks like a REAL product — polished gradients, composited typography, visual depth — because the atlas was generated by fal.ai FLUX.2 against a style-locked reference, not from hand-drawn primitives
7. Every interactive element on screen is a separate node with its own atlas region, own intent, own code module — the navbar’s logo, each nav link, and the sign-in button are distinct nodes (not one “navbar” node)

**Text rendering (V3 Invariant 6):**
8. Text rendering uses the correct method per node:

- `sharp-svg` textContent entries: composited into the atlas image at BUILD time by the atlas build script using Sharp+SVG — verify by inspecting an atlas region in an image viewer and confirming the text is pixels
- `msdf` textContent entries: rendered at runtime via `BitmapText` for dynamic data only (counters, user names, live backend responses)
- `diffusion` textContent entries: text is part of the fal.ai-generated source image (using Ideogram v3 or equivalent)
- Grep test: `new PIXI.BitmapText` appears ONLY in nodes rendering dynamic data from state or backend

**Animation — all three methodologies demonstrated:**
9. At least one node uses each of the three animation methodologies:

- Method 1 (i2v frame-based): an element cycles through a fal.ai-generated i2v frame sequence (typically an animated hero background or ambient decorative element)
- Method 2 (code-based transforms): a hover lift, a press scale, or entrance animations via GSAP
- Method 3 (hybrid overlay layers): glow-pulse, shimmer, ripple-click, or similar effect implemented as a reusable overlay sprite animated via alpha/transform

1. At least one node uses layer-swap state transitions (toggle with distinct toggle-off and toggle-on atlas regions, or a button with default/hover/pressed variants)
1. Hovering, clicking, and interacting with elements fires the declared events from their NodeIntent and applies the declared state effects using overlay layers (method 3) and/or GSAP transforms (method 2), never CSS

**Navigation and scroll — behaves like a real app (section 1.5):**
12. The hub’s content exceeds the viewport height; mouse wheel scroll, trackpad scroll, and keyboard arrow/page keys all scroll the content smoothly with momentum easing
13. Single-finger touch drag scrolls on mobile/tablet with natural momentum and flick physics — feels like a real native app scroll, not a basic DOM scroll
14. Nav link clicks (e.g., “Features”) scroll-animate to the corresponding section using GSAP, with the active section indicated in the navbar via overlay state
15. The layout is responsive: viewing at desktop wide (>1440px), desktop (1024-1440), tablet (768-1024), and mobile (<768) each shows an appropriately laid-out version. Node `transformByBreakpoint` entries are respected; nodes with `visibleAtBreakpoints` restrictions hide/show correctly
16. Every interactive sprite responds to pointerover/pointerout/pointerdown/pointerup/pointertap with visible state feedback — the app feels alive, not like a static image with click regions

**Backend & graph integration:**
17. Backend calls from nodes (e.g., `hero-card-cta` → `/api/mock/track-cta-click`) execute via the local backend runtime and return successfully
18. The 3D graph pane on the right shows ALL nodes from the `.prism` graph.json (~30-60 for a realistic home hub with all required visual elements), with captions as labels

**Artifact & SHR:**
19. The `.prism` file can be extracted with any zip tool (`unzip mock-app.prism -d extracted/`) and its contents match the format in Section 3.1
20. The toy SHR demo works end-to-end: hidden dev tool breaks a node → user click fails → after 3 attempts the repair indicator appears for ~1 second → module is restored → next click works

**Clean migration:**
21. No references to `html-to-image` remain in the codebase
22. All files in `components/editor/` except the replaced `MockApp.tsx` → `PrismHost.tsx` swap are byte-identical to before
23. `package.json` shows the new dependencies added, old ones removed
24. A clean checkout + `pnpm install` + `FAL_KEY=... pnpm run provision-assets && pnpm run dev` on a fresh machine reproduces the working prototype

**Final visual inspection:**
25. Showing the running app to someone unfamiliar with the project, they should say it looks like a real product. Scrolling feels smooth. Hovering and clicking feel alive. Nothing looks like a wireframe or a design mockup.

-----

## 11. Out of Scope (Future Work)

These things are NOT part of this spec and should be left for subsequent phases:

- postMessage bridge between preview pane and graph pane (currently the communication is through the shared Zustand store; future work adds proper sandboxing)
- Click on element in preview → select node in 3D graph
- Click on node in 3D graph → highlight element in preview
- Node inspector editing → hot-patch the preview (edit code, save, preview updates)
- Real local model integration for SHR (Transformers.js + Qwen3-Coder-Next 3B + WebGPU)
- Real engine integration (replacing the hand-authored `.prism` with one generated by the Prism engine)
- Multi-hub navigation (the prototype may have one hub; future mock apps add more)
- Port to the real Kriptik Builder page (current work is in the standalone prototype)
- Deployment to production (the prototype `.prism` runs embedded in Next.js; future work deploys standalone)
- Progressive wavefront preview (the hand-authored `.prism` loads all at once)

-----

*End of Mock App Build Spec v1.0.*
