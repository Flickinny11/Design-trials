# Recon — keyframe-timeline surface (UI-WOW-2)

> Read-only recon. Repo root: `/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing`.
> Branch `prism-editor-build`. Renderer: Three.js/TSL/WebGPU (no PixiJS). Palette: brass/bone/ice, **no purple**.

## TL;DR

There are **TWO distinct keyframe/timeline surfaces**, and the monitor's "cramped strip at bottom, half-hidden behind panels, utilitarian dark tracks+diamonds" describes **#1**:

1. **`KeyframeEditorPanel`** — a full-bleed **slide-up bottom strip** in `CanvasToolbar.tsx`
   (`src/components/editor/overlays/CanvasToolbar.tsx:1549-1721`). This is the "tracks + diamonds +
   playhead + scrubber" strip. It is a **DESIGNED PLACEHOLDER** — its tracks are a hardcoded mock
   (`TRACKS`, line 1543), bound to **no real data**. Toggled from the Animation flyout.
2. **`AnimationTab`** — the **real, data-bound** keyframe editor inside the right **Inspector** panel
   (`src/components/editor/panels/Inspector.tsx:852-1300+`). Reads/writes `node.keyframes`
   (canonical `PrismKeyframe[]`), has coordinate-space + trigger pickers, a live preview stage, a
   frame strip, and "Save as keyframe". This is the functional one but it is a vertical stack of
   ceramic cards in a ~360px-wide side panel, not a horizontal timeline.

The WOW opportunity: make the **bottom strip (#1) the premium centerpiece**, bind it to the **real
`node.keyframes` data** that #2 already manages, and give it a **smoky EXPANDING reveal** when it
slides up. Today it just `translateY(110%)`→`0`.

---

## 1. The bottom strip — `KeyframeEditorPanel` (the primary target)

**File:** `src/components/editor/overlays/CanvasToolbar.tsx`

### Where it renders / mount + gating
- Mounted unconditionally inside `CanvasToolbar`'s return, after the flyout shell:
  `CanvasToolbar.tsx:916-921`:
  ```tsx
  {/* Slide-up keyframe editor */}
  <KeyframeEditorPanel
    open={keyframeOpen}
    onClose={() => setKeyframeOpen(false)}
    selectionLabel={selectionLabel}
  />
  ```
- `CanvasToolbar` itself only renders while `viewMode === 'canvas'` — gated in
  `src/app/page.tsx:809-810` ("Self-gates to viewMode==='canvas'").
- `keyframeOpen` is `useState(false)` local to `CanvasToolbar` (`CanvasToolbar.tsx:459`).
  It is **toggled from the Animation flyout**, not from a dedicated dock key.

### Open/close mechanism (the toggle)
- The toggle lives in the Animation group flyout: `AnimationFlyout.tsx:547-561`
  (`data-action="keyframe-toggle"`, label flips "Keyframe Editor" ↔ "Hide Keyframe Editor").
- Wired through `CanvasToolbar.tsx:886-893`:
  ```tsx
  <AnimationFlyout
    …
    keyframeOpen={keyframeOpen}
    onToggleKeyframe={() => setKeyframeOpen((v) => !v)}
  />
  ```
- So the strip is reachable **only** by: enter canvas mode → open Animation tool group → click the
  Keyframe Editor key. That coupling is part of why it reads as "half-hidden."

### Current visual design (the cramped/utilitarian strip)
Anchored full-width at the bottom of the canvas, **z-40**, floating above the left rail and right
Inspector. Geometry:
- Container: `CanvasToolbar.tsx:1567-1578` — `absolute z-40 bottom-0 left-0 right-0`,
  `transform: open ? 'translateY(0)' : 'translateY(110%)'`, opacity 0/1,
  `transition: transform var(--ds-t-slow) … , opacity var(--ds-t-base) …`. **This is the entire
  current reveal animation** — a plain slide + fade, no smoke, no expansion, no stagger.
- Body slab: `ds-ceramic ds-edge`, `m-3`, `useChromeSlab({ material:'ceramic', radius:18, order:40 })`
  (`:1564, :1582-1586`).
- Header: brushed-`metal` slab strip, `h-11`, `:1565, :1589-1597`. Contains:
  `Icon name="timeline"` + "Keyframe Editor" title + an **ice chip reading "CATALOG FORTHCOMING"**
  (`:1601-1603` — visible admission it's a placeholder) + selection label; right side has
  play/pause, loop, a snap-grid segmented control (`1/60 · 1/100 · 1/120`, `:1628-1648`), close.
- **Scrubber/fader** (`:1660-1707`): a transparent `<input type=range>` over a machined groove with
  brass fill, 31 ruler ticks (major every 5), and a **rotated brass "jewel" playhead** (`:1695-1703`,
  `w-3 h-3 rotate-45`). Time readout `{(playhead*3).toFixed(2)}s` … `3.00s` — **hardcoded 3s
  duration**, `playhead` is local state seeded at `0.32`.
- **Multi-track lanes** (`:1709-1717` + `KeyframeTrackRow` `:1728-1772`):
  `max-h-[200px] overflow-y-auto`. Each lane = a 28px-tall recessed `well` slab with diamond keys.
  - `TRACKS` is **fully hardcoded mock data** (`CanvasToolbar.tsx:1543-1547`):
    ```tsx
    const TRACKS = [
      { name: 'Opacity',     color: DS.brass400, keys: [0.0, 0.25, 0.6, 1.0] },
      { name: 'Translate Y', color: DS.brass200, keys: [0.0, 0.5, 0.85] },
      { name: 'Scale',       color: DS.ice300,   keys: [0.0, 1.0] },
    ];
    ```
  - Diamonds: `:1746-1757` — `rotate-45` 10px squares with a radial-gradient brass/ice face,
    positioned `left: ${6 + k*88}%`. Playhead line per lane at `:1758-1761`.
  - Footer line (`:1714-1716`): *"Timeline is continuous seconds (no global fps). Tracks bind to the
    selection's Animatable controls once the Primitive Catalog lands."* — confirms it is unbound.
  - Each lane has a tiny `+` add-key button (`:1763-1769`) that **does nothing** (no onClick).

**Net:** visually it's already brass-on-graphite and on-system, but it is (a) thin/short
(28px lanes, 200px cap), (b) bound to mock data, (c) inert (scrub moves a number; no keys are
draggable/addable/selectable), and (d) reachable only via the flyout. It reads "utilitarian" because
the lanes are dark recessed wells with small flat diamonds and no depth/motion/selection feedback.

### Local state in the panel (all ephemeral, none persisted)
`CanvasToolbar.tsx:1554-1557`: `playhead` (0.32), `playing`, `loop`, `snapGrid` ('1/60'|'1/100'|'1/120').
None of this writes to the graph. `play`/`loop` toggle icons only.

---

## 2. The real data-bound editor — Inspector `AnimationTab`

**File:** `src/components/editor/panels/Inspector.tsx:850-1300`

This is where the **canonical keyframe data actually lives**. It renders inside the right Inspector
panel (vertical card stack), NOT as a horizontal timeline. Key parts:

- Reads source-⊕-preview keyframes (`:870-879`):
  ```tsx
  const sourceNode      = useGraphSourceStore(s => s.nodes.find(n => n.nodeId === node.id));
  const previewPatch    = usePreviewStateStore(s => s.patches[node.id] ?? null);
  const persistedKeyframes: PrismKeyframe[] =
    (previewPatch?.keyframes as PrismKeyframe[] | undefined) ??
    sourceNode?.keyframes ?? [];
  ```
- **Live preview stage** (`:997-1036`): recessed `ds-well` chamber, transforms a DOM element by
  interpolated frame props; "LIVE PREVIEW"/"PLAYING" chips.
- **Timeline playhead bar** (`:1038-1054`): a thin 2px gradient progress fill — the only horizontal
  "timeline" affordance here, purely cosmetic.
- **Frame strip** (`:1056-1078`): horizontally-scrollable 48px swatch buttons (the editable frames
  from `useAnimationEditsStore`), distinct from `persistedKeyframes`.
- **Per-keyframe property editors** (`:1081-1107`): Scale/Opacity/Rotation/Translate X/Y `PropSlider`s
  + glow color.
- **Coordinate-space + trigger pickers** (`:1109-1171`): chip radiogroups sourced from
  `KEYFRAME_COORDINATE_SPACES` / `KEYFRAME_TRIGGERS` (canonical constants). `data-testid`s:
  `kf-coordinate-space-picker`, `kf-trigger-picker`.
- **Captured keyframes display** (`:1173-1207`, `data-testid="kf-captured-timeline"`): renders
  `persistedKeyframes` as brass chips (`#N · <space> · <trigger>`). **This is the real persisted
  list** — and it's just chips, not a timeline.
- **Save as keyframe** (`:952-963, :1226-1234`): snapshots `canvasTransform` →
  `captureCanvasTransformAsKeyframe(...)` → routes through `usePreviewStateStore.set(...)` (FP-15).

### Two parallel frame models (important nuance)
- `useAnimationEditsStore` (`src/stores/useAnimationEditsStore.ts`) — an **ephemeral editor buffer**
  of `FrameProps[]` (scale/opacity/rotation/x/y/color) plus `coordinateSpace`/`trigger` picker state.
  This drives the Inspector's frame strip + sliders + live preview. It is NOT the canonical schema.
- `node.keyframes: PrismKeyframe[]` — the **canonical, persisted** list (see §3). "Save as keyframe"
  is the only bridge that converts a captured transform into a `PrismKeyframe`.

A premium bottom strip should render **the canonical `node.keyframes`** (and likely the editor-buffer
frames as a live overlay), so the two surfaces stop being disconnected.

---

## 3. Data model (canonical schema)

**File:** `src/lib/prism-graph/types.ts`

- `PrismNode.keyframes?: PrismKeyframe[]` — additive, optional (`types.ts:672-677`).
- `PrismKeyframe` (`types.ts:976-992`):
  ```ts
  interface PrismKeyframe {
    coordinateSpace: PrismKeyframeCoordinateSpace; // REQUIRED (INV-21 / FP-08)
    t?: number;                 // [0..1] normalized, or absolute seconds
    params?: Record<string, unknown>;  // animated values at this waypoint
    values?: Record<string, unknown>;  // legacy alias accepted by FP-08 regex
    ease?: ScrollBindingEase | string;
    trigger?: PrismKeyframeTrigger;
  }
  ```
- `KEYFRAME_COORDINATE_SPACES` (`types.ts:943-952`): the **fixed canonical 5** (RA-03, INV-21):
  `'universe' | 'hub-scene' | 'viewport-composition' | 'scroll-timeline' | 'camera'`.
- `KEYFRAME_TRIGGERS` (`types.ts:957-963`): `'load' | 'scroll' | 'hover' | 'click' | 'in-view'`.
- `ScrollBinding` (`types.ts:915-936`): the scroll-driven property animation (`property`/`from`/`to`/
  `ease`) — `coordinateSpace` is implicit `scroll-timeline`. Lives on `node.scrollBinding`.

**Param value vocabulary** (what tracks would key off): `opacity, translateX/Y/Z, rotateX/Y/Z,
scale, scaleX/Y/Z, rotateZ`. Producers:
- `captureCanvasTransformAsKeyframe` (`src/lib/prism-graph/keyframe-capture.ts:42-66`) writes
  `translateX/Y/Z, rotateX/Y/Z, scale, scaleX/Y/Z`.
- `keyframe-primitives.ts` (`src/lib/prism-graph/keyframe-primitives.ts`) — 3 baseline
  `KeyframePrimitive`s (`load` fade-in, `in-view` slide, `hover` lift), each a `PrismKeyframe[]` with
  a pure `interpolateKeyframePrimitive(primitive, t)` lerp (`:133-157`). `InterpolatedKeyframeValues`
  keys (`:35-42`): `opacity, translateX/Y/Z, scale, rotateZ`.
- `src/lib/prism-graph/animation-keyframes.ts` — a SEPARATE legacy `KeyframeTimeline` model
  (`durationMs`, `Keyframe { t, params:{scale,opacity,rotation,x,y} }`) with `captureKeyframe` /
  `replayKeyframeTimeline`. Tagged to the archived renderer-migration spec; **not** the canonical
  `PrismKeyframe`. Don't build the new strip on this one.

**"Tracks"** as a concept does **not** exist in the schema — `node.keyframes` is a flat list. A
multi-track UI is a *view-model projection*: group the flat list by param key (one lane per animated
property) or by trigger. The hardcoded `TRACKS` in `CanvasToolbar.tsx:1543` is exactly that
projection, just faked. A real version derives lanes from `persistedKeyframes`.

---

## 4. Design system + chrome (what a redesign attaches to)

- **Tokens (JS):** `src/components/editor/design-system/tokens.ts`. Palette: graphite neutrals
  (`void`→`steel`), bone text (`textHi #f3f1ea` … `textLow #6e7077`), **brass ramp**
  (`brass100 #f7e9c6` → `brass700`, accent = `brass400 #cd9f55`), **ice** (`ice200`→`ice500`,
  informational/frozen only), status `ok/warn/danger`. `DS_ACCENT = DS.brass400`. **No purple
  anywhere** — `DS_CATEGORY_TINTS`/`DS_DIFFICULTY` explicitly say "never purple."
  `dsAlpha(hex, a)` for inline rgba; `dsHexNumber` for three.js.
- **Tokens (CSS):** `src/components/editor/design-system/tokens.css` — `--ds-grad-brass`,
  `--ds-grad-metal`, `--ds-grad-ceramic`, `--ds-grad-well`, `--ds-grad-smoked`
  (`tokens.css:63`), `--ds-glow-brass`, motion vars `--ds-t-fast/base/slow/glide`,
  `--ds-ease-out` (`cubic-bezier(0.22,1,0.36,1)`).
- **Materials:** `src/components/editor/design-system/materials.css` — `.ds-ceramic`, `.ds-metal`,
  `.ds-well`, `.ds-glass`, `.ds-smoked` (`:46-47`, uses `--ds-grad-smoked`), `.ds-edge`,
  `.ds-grain`, `.ds-press`, and a `.ds-reveal` keyframe animation (`:141-151`) for a stagger-in.
- **Chrome slab (real GPU surfaces):** `useChromeSlab({ material, radius, order, accent, frost,
  brushAxis, borderPx })` — `src/components/editor/chrome-layer/useChromeSlab.ts:34`. Materials are
  **only** `'glass' | 'metal' | 'ceramic' | 'well'` (`registry.ts:18`). At tier t2 the DOM element's
  CSS surface is suppressed and the slab renders the real refractive/brushed surface in the unified
  WebGPU canvas behind it; below t2 the CSS material stands (INV-9 graceful tiering). The bottom
  strip already uses three slabs: body=ceramic/40, header=metal/41, lanes=well/42.
- **Reveal hook:** `useReveal<T>({ stagger, delay, resetKey })`
  (`src/components/editor/design-system/use-reveal.ts:26`) — GSAP `fromTo` cascade of direct
  children, opacity-only, auto-reverts via `gsap.context`, never throws. Already used by the flyout
  shell (`CanvasToolbar.tsx:960`). **This is the existing seam for an entrance choreography.**
- **Icons:** `Icon name="timeline"` and `name="diamond"` both exist
  (`src/components/editor/icons/Icon.tsx:48-49`), plus `play/pause/refresh/plus/close`.

### Installed deps (confirmed in `package.json`, all combinable)
`gsap 3.13.0`, `lenis ^1.3.0`, `camera-controls ^3.1.0`, `d3-force-3d ^3.0.5`,
`simplex-noise 4.0.3`, `postprocessing ^6.37.0`, `@react-three/postprocessing ^3.0.4`,
`@react-three/fiber ^9.1.0`, `@react-three/drei ^10.0.0`, `three ^0.184.0`, `zustand ^5.0.2`.
NOT installed: curtains.js, vfx-js, cursor-physics. `MagneticCursor` is in-house at
`src/components/editor/overlays/MagneticCursor.tsx` (and `attachMagnetic` is used in AnimationFlyout
`PickerTile` `:611`).

---

## 5. What a premium redesign + smoky EXPANDING reveal attaches to

- **Open trigger / state:** keep `keyframeOpen` in `CanvasToolbar` (`:459, :886-893`). The expanding
  reveal replaces the single `translateY(110%)→0` on `CanvasToolbar.tsx:1574-1578`. Drive the
  entrance with **GSAP** via the existing `useReveal` pattern (or a bespoke timeline): height/clip
  grow + lanes cascade + diamonds pop. `--ds-ease-out` / `DS_MOTION.spring` are the on-system curves.
- **Smoke layer:** there is **no** `'smoke'`/particle slab material — the chrome layer is glass/metal/
  ceramic/well only. A "smoky" reveal is therefore either (a) a DOM/CSS `--ds-grad-smoked` veil that
  dissipates (cheap, tier-safe, INV-9-friendly), or (b) a `simplex-noise`-driven TSL volumetric puff
  rendered into the unified WebGPU canvas (premium, must gate on chrome tier t2 / INV-9). Brass/ice
  tint only — no purple.
- **Data binding (the big upgrade):** replace `TRACKS` (`CanvasToolbar.tsx:1543`) with a view-model
  derived from the selected node's **canonical `node.keyframes`** (read via `useGraphSourceStore` ⊕
  `usePreviewStateStore`, mirroring Inspector `:870-879`). Group flat `PrismKeyframe[]` into lanes by
  param key (opacity / translate / scale / rotate). Reuse `interpolateKeyframePrimitive` semantics
  for the playhead readout. Make the per-lane `+` actually capture (route through
  `usePreviewStateStore` per FP-15, never `useGraphSourceStore.getState().updateNode` from an
  Inspector-tab file — but the strip lives in CanvasToolbar, so confirm the FP-15 file scope before
  wiring; see risks).
- **Selection context:** `selectionLabel` already flows in (`:920`). Empty-state when no node /
  no keyframes (mirror Inspector `:1185-1189`).
- **Playhead/scrub:** the brass-jewel playhead (`:1695-1703`) and ruler are good bones — promote to
  draggable diamonds, hover-scrub, snap to the `snapGrid` value (currently dead). `camera-controls`
  is NOT relevant here (no 3D nav in the strip); `lenis` could smooth a long horizontal track scroll.
- **Postprocessing:** the strip is DOM/CSS chrome over the canvas; `postprocessing`/R3F belong to the
  unified scene, so a smoke puff would be a scene-side effect, not a DOM filter. Prefer the cheaper
  CSS-smoke path unless a scene-integrated puff is explicitly wanted (and tier-gated).

---

## 6. Collaborators / file index

| Concern | File:anchor |
|---|---|
| Bottom strip UI (PRIMARY) | `src/components/editor/overlays/CanvasToolbar.tsx:1542-1772` |
| Strip mount + `keyframeOpen` state | `CanvasToolbar.tsx:459, 916-921` |
| Toggle button | `src/components/editor/animation-tools/AnimationFlyout.tsx:547-561` |
| Toggle wiring | `CanvasToolbar.tsx:886-893` |
| Canvas-mode gate | `src/app/page.tsx:809-810` |
| Real data-bound editor (Inspector) | `src/components/editor/panels/Inspector.tsx:850-1300` |
| Ephemeral frame buffer store | `src/stores/useAnimationEditsStore.ts` |
| Canonical `PrismKeyframe` schema | `src/lib/prism-graph/types.ts:672-677, 915-992` |
| Keyframe capture (transform→PrismKeyframe) | `src/lib/prism-graph/keyframe-capture.ts:42-66` |
| Baseline primitives + interpolator | `src/lib/prism-graph/keyframe-primitives.ts` |
| Legacy timeline model (NOT canonical) | `src/lib/prism-graph/animation-keyframes.ts` |
| DS tokens (JS) | `src/components/editor/design-system/tokens.ts` |
| DS tokens / materials (CSS) | `src/components/editor/design-system/{tokens.css,materials.css}` |
| Chrome slab hook + materials | `src/components/editor/chrome-layer/{useChromeSlab.ts,registry.ts}` |
| Reveal choreography hook | `src/components/editor/design-system/use-reveal.ts` |
| Magnetic cursor (in-house) | `src/components/editor/overlays/MagneticCursor.tsx` |
| Forbidden-pattern hook | `.claude/hooks/anti-drift-check.sh` |

---

## 7. Risks / invariants constraining edits here

- **One renderer only** — Three.js/TSL/WebGPU, no PixiJS (FP-01). Any "smoke" rendered in the scene
  must be TSL, not raw GLSL, and not a second renderer.
- **INV-9 device tiering** — chrome slabs/scene effects must degrade: below tier t2 the CSS material
  stands and any GPU smoke must be absent/cheapened, never broken. The smoky reveal must have a
  tier-safe CSS fallback.
- **FP-08 (anti-drift-check.sh:121-126)** — every keyframe literal `{ t:…, (params|values):{…} }`
  MUST carry `coordinateSpace` from the canonical 5. If the strip writes/captures keyframes, the
  capture path (`captureCanvasTransformAsKeyframe`) already supplies it — don't author bare literals.
- **INV-21 / RA-03** — coordinate-space set is fixed; never invent a new lane "space."
- **FP-15 (anti-drift-check.sh:157-161)** — *Inspector-tab files* must route writes through
  `usePreviewStateStore`, never `useGraphSourceStore.getState().updateNode`. The bottom strip lives
  in `CanvasToolbar.tsx` (an overlay, not `panels/*`), so the literal FP-15 grep targets Inspector
  files — but **match the intent**: keyframe edits should go through `usePreviewStateStore` so
  Save/Save-and-Rebuild semantics hold. Verify the hook's exact path scope before wiring writes.
- **No purple** — palette is brass/bone/ice only; `DS_CATEGORY_TINTS`/`DS_DIFFICULTY` enforce it by
  convention. Smoke/glow tints must be brass or ice.
- **Design-tokens-only styling** — component-local hex is forbidden (tokens.ts header comment);
  import from `DS`/tokens.css. The current strip already obeys this (`KEY_BG`, `WELL_BG`,
  `--ds-grad-*`). New colors must come from tokens.
- **Imperative `.style.background/.border/.boxShadow`** is flagged for *Prism runtime* code by
  anti-drift-check.sh:66 (needs `// ALLOWED-DOM-STYLE:` bypass). The editor chrome (`src/components/
  editor/**`) is generally outside the runtime-scope grep, but GSAP tweening inline style on these
  DOM nodes should prefer transform/opacity/clip (compositor-friendly) and tokenized gradients.
- **Never surface the word "fal"** in UI (asset-pipeline term). Not currently present in this surface;
  keep it out of any new copy.
- **Editor `overlays/` is "frozen by default"** per `kid-kode-landing/CLAUDE.md` directory-scope
  note. CanvasToolbar is STEP8 authoring chrome that has been actively edited on this branch, but a
  redesign of `KeyframeEditorPanel` should be a deliberate, scoped change (it touches the same file
  as the whole canvas toolbar).
- **Two disconnected frame models** (ephemeral `useAnimationEditsStore` `FrameProps` vs canonical
  `node.keyframes` `PrismKeyframe`). A redesign that binds the strip to real data must pick the
  canonical list as source of truth and treat the editor buffer as a live overlay — getting this
  wrong silently desyncs the strip from the Inspector.
- **`gsap` is the only animation lib in this chrome** (no Theatre, no Framer). Entrance choreography
  must be GSAP (matches `useReveal`).
