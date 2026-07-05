# UI-WOW-2 Recon — Surface: `page-layout`

Target: `src/app/page.tsx` (1029 lines) + direct collaborators
(`src/app/layout.tsx`, `chrome-layer/*`, the overlay/panel tree it mounts).
Read-only recon. All anchors are `file:line`.

---

## 1. Overall editor layout (what mounts where)

`src/app/page.tsx` is the **entire editor shell**. It is a single `'use client'`
page (no nested routes). Top-level structure:

```
<main className="relative w-screen h-screen overflow-hidden bg-ds-void">   page.tsx:643
  <RefractionDefs />                       SVG displacement filters       :644
  <ModeTransitionConductor />              mode-morph choreography (t2)   :648
  <div absolute inset-0 …ambient backdrop> radial brass/ice gradient      :650-656
  { isDesktop ? <DESKTOP TREE> : <MOBILE TREE> }                          :658-840
  <SearchPalette /> <AddNodeDialog /> <ChangeArtifactWizard />
  <ElementLibraryBrowser /> <MagneticCursor />   (mounted in BOTH modes)  :842-848
</main>
```

The whole UI is **absolutely-positioned overlays floating over one full-bleed
3D canvas**. There is no flex/grid page skeleton — every panel pins itself with
`absolute` + Tailwind edge utilities and a hardcoded `z-N`.

### The 3D canvas mount

```
<div data-pane="graph" className="absolute inset-0">     page.tsx:799 (desktop), :818 (mobile)
  <GraphScene />                                          :800 / :819
  { !isPreviewApp && ( <TopBar/><HubNav/><Minimap/><DetailCard/>
                       <RightPane/><GalaxyFilterOverlay/><CanvasToolbar/> ) }
</div>
```

- `GraphScene` is `dynamic(..., { ssr: false })` (`page.tsx:45-137`) with an
  elaborate Observatory-Brass boot loader as `loading`. **This is the ONLY
  renderer** — one `three/webgpu` canvas (CLAUDE.md, INV-R1/FP-R1). The chrome
  glass/metal slab layer renders *inside* this same canvas
  (`GraphScene.tsx:3177` mounts `<ChromeSlabLayer />`), not as a second canvas.
- Editor chrome (TopBar/HubNav/Minimap/DetailCard/RightPane/CanvasToolbar) is
  hidden whenever `isPreviewApp` so the built scene "reads as the running app"
  (`page.tsx:640`, comment :792-798).

### Overlays mounted (desktop branch)

| Component | Import | Pins itself at |
|---|---|---|
| view-mode toggle | inline JSX `page.tsx:669-719` | `absolute top-2 left-1/2 z-40` |
| `PreviewAppWorldBadge` | inline `page.tsx:959` | `absolute top-2 right-3 z-40` (preview-app only) |
| preview-app nav pill | inline `page.tsx:734-790` | `absolute bottom-4 left-1/2 z-40` (preview-app only) |
| `TopBar` | overlays/TopBar | own absolute, top strip |
| `HubNav` | overlays/HubNav | `absolute bottom-5 max-md:bottom-[84px] left-1/2` (HubNav.tsx:92) |
| `Minimap` | overlays/Minimap | own absolute (desktop only — absent in mobile tree) |
| `DetailCard` | overlays/DetailCard | own absolute |
| `RightPane`→`Inspector`/`HubInspector` | panels/RightPane | `absolute right-0 … md:w-[484px] md:right-3` (Inspector.tsx:359) |
| `GalaxyFilterOverlay` | overlays/GalaxyFilterOverlay | own absolute |
| `CanvasToolbar` | overlays/CanvasToolbar | `absolute left-3 top-1/2 z-50` (CanvasToolbar.tsx:732), self-gates `viewMode==='canvas'` |
| `SearchPalette`,`AddNodeDialog`,`ChangeArtifactWizard`,`ElementLibraryBrowser`,`MagneticCursor` | various | modal/global overlays, mode-agnostic |

---

## 2. viewMode handling (`galaxy | canvas | preview-app`)

- Canonical 3 modes only (RA-06b). `viewMode`/`setViewMode` live on
  `useGraphEditorStore` (`page.tsx:142-143`); `activeHubId` too (`:146`).
- **One scene, mode is a state** (`page.tsx:636-640`): `GraphScene` always
  mounts; mode drives what renders *inside* it. `isPreviewApp = viewMode ===
  'preview-app'` (`:640`) is the single switch that hides editor chrome.
- Desktop view-mode toggle is a 3-slot segmented control with a sliding brass
  thumb driven by `translateX(idx*96px)` (`page.tsx:683-690`); CSS-transition
  spring. The mobile equivalent is `MobileModeToggle` (`page.tsx:866-951`),
  GSAP-driven `x` slide (`:882-895`), 88px slots, 44px (`h-11`) touch targets,
  `bottom: calc(10px + env(safe-area-inset-bottom))` (`:901`).
- preview-app routing is heavy: URL hash `#hub=<hubId>` is source of truth
  (`page.tsx:376-527`), popstate listener, history push/replace, and 4 `window.__PRISM_*`
  dev hooks for the verify scripts (set-view-mode `:226`, fire-tether `:251`,
  debug-stores `:316`, compiled-hub-view `:340`, preview-app-nav `:451`).
- Dev hook `__PRISM_EDITOR_SET_VIEW_MODE__` only accepts the 3 literals
  (`page.tsx:230`). **FP-12 / FP-14** block any other viewMode string at
  write-time — do not introduce `hub-world`/`preview-hub`.

---

## 3. Responsive / mobile branching — THE CORE FINDING

Responsiveness today is **split across two incompatible mechanisms**, and they
disagree on the breakpoint:

### (a) Page-level: a single `isDesktop` JS boolean at 900px

```ts
const [isDesktop, setIsDesktop] = useState(true);             page.tsx:139
useEffect(() => {
  const check = () => setIsDesktop(window.innerWidth >= 900); page.tsx:206-211
  check(); window.addEventListener('resize', check); …
}, []);
```

`isDesktop ? <DESKTOP TREE> : <MOBILE TREE>` (`page.tsx:658` vs `:815`). The two
trees are **near-duplicates** that diverge only in:
- mobile drops `<Minimap/>` and the desktop `view-mode-toggle`/preview-nav/world-badge;
- mobile adds `<MobileModeToggle/>` (`page.tsx:838`).

This `useState(true)` default means **SSR + first client paint always render the
desktop tree**, then snap to mobile on the first `resize`/mount effect — a
layout flash on phones, and **it keys off `window.innerWidth`, NOT the
container**, so it is blind to a constrained preview-pane embed (see §5).

### (b) Component-level: Tailwind breakpoint utilities (default screens)

Every overlay self-manages mobile with `max-md:` / `md:` / `lg:` utilities:
- TopBar: `hidden lg:flex` (TopBar.tsx:157), `max-md:hidden` (`:189`),
  `hidden md:inline` labels (`:215,234,235`).
- HubNav: `bottom-5 max-md:bottom-[84px]` (HubNav.tsx:92) — hand-tuned offset to
  clear the mobile mode toggle.
- Inspector: `right-0 top-14 bottom-0 left-16 md:left-auto md:w-[484px]
  md:right-3 md:top-[64px] md:bottom-3 … rounded-none md:rounded-ds-lg`
  (Inspector.tsx:359; also full-bleed variants at `:1568`, `:1936`).
- CanvasToolbar: phone scrim `md:hidden` (CanvasToolbar.tsx:723), label
  `hidden lg:inline` (`:1604`).

`tailwind.config.ts:4-6` does **not** override `screens`, so these resolve to
Tailwind defaults **sm 640 / md 768 / lg 1024**. The page boolean cuts at
**900**. So between 768–900px the overlays are in "desktop md+" CSS state while
the page still renders the desktop JS tree (consistent there), but between
900–1024 the page is desktop yet `lg:`-gated TopBar affordances are hidden — the
two systems are **not aligned to a shared breakpoint scale**.

### (c) No container-width awareness anywhere

`grep` for `ResizeObserver` / `LayoutContext` / `containerWidth` in the editor
shell returns **nothing** (only `prism-player/PrismHost.tsx` has a ResizeObserver,
and that is the *inner* runtime player, not the editor). All responsive
decisions read `window.innerWidth` or the CSS media query of the **viewport**,
never the element's own box.

---

## 4. Behavior when embedded in a constrained preview-pane (not full browser)

This is the failure mode UI-WOW-2 must fix. When the editor is iframed/embedded
into a narrow preview-pane:

- **`window.innerWidth` still reports the full browser width**, not the pane.
  So `isDesktop` (`page.tsx:207`) stays `true` even when the editor only has,
  say, 520px of real estate → the **desktop tree renders into a phone-width
  box**. Inspector pins to `md:w-[484px] md:right-3` and will consume nearly the
  whole pane / overflow it; the centered top toggle + preview nav collide.
- Tailwind `md:`/`lg:` utilities are viewport media queries → **same blindness**;
  they never trigger the mobile layout inside a wide-browser-but-narrow-pane.
- The chrome-slab layer maps DOM rects → in-canvas SDF instances per frame using
  `getBoundingClientRect` against `size.width/height` of the R3F canvas
  (`ChromeSlabLayer.tsx:230-263`). It is already *element-rect driven*, so it
  would track a resized pane correctly **once the DOM layout itself is
  container-aware** — but the DOM layout is not, so slabs would faithfully render
  a broken desktop layout.
- `env(safe-area-inset-*)` (`page.tsx:901`) is honored only on the mobile toggle;
  the rest of the chrome ignores safe-area.

**Net:** the editor has no concept of "my own width." Embedding it shrinks the
canvas but leaves the overlay layout in desktop mode until the *browser window*
(not the pane) crosses 900px.

---

## 5. Single best integration point for a responsive layout system + bottom-sheet host

**Insert one `EditorLayoutProvider` (container-query context) wrapping the
`<main>` body, plus a single `BottomSheetHost` portal rendered once near the end
of `<main>` — both in `src/app/page.tsx`.**

Concretely:

1. **Container-aware breakpoint context.** Replace the `isDesktop`/innerWidth
   effect (`page.tsx:139,206-211`) with a `ResizeObserver` on the `<main>` (or a
   wrapping `<div ref>`), publishing `{ width, density: 'compact'|'regular'|'wide' }`
   via React context + a small zustand slice. Every `isDesktop` consumer and the
   overlay `md:`/`lg:` decisions read **container width**, not viewport. This is
   the one change that makes the embedded-preview-pane case correct. The `<main>`
   at `page.tsx:643` is the natural ref host — it is `w-screen h-screen` today;
   switch to `relative w-full h-full` so it fills whatever pane contains it, and
   measure that.
   - Bonus: native CSS container queries (`@container`) could back the Tailwind
     side if a `@tailwindcss/container-queries`-style `@container` utility is
     added — but a JS context is the lower-risk first move and keeps the existing
     `isDesktop ? … : …` branch shape (`page.tsx:658`) intact during migration.

2. **Bottom-sheet host.** Mount a single `<BottomSheetHost />` once, as a sibling
   of the global overlays around `page.tsx:842-848` (after `<ElementLibraryBrowser/>`,
   before `<MagneticCursor/>`). Drive it from a tiny zustand `useBottomSheetStore`
   (open id + payload), so Inspector / CanvasToolbar / HubInspector dismiss their
   full-bleed `rounded-none` mobile panels (Inspector.tsx:359,1568,1936) into a
   **proper draggable sheet** instead of edge-pinned full-screen takeovers. GSAP
   3.13 (already imported `page.tsx:5`) drives the sheet's `y` translate +
   spring/`back.out`; safe-area via `env(safe-area-inset-bottom)` (pattern already
   at `page.tsx:901`). Radix is available but barely used (only ColorPicker) —
   prefer a hand-built sheet to match the chrome-slab material story, or wrap
   Radix `Dialog` with `forceMount` for focus-trap and let the slab layer render
   the surface.
   - The sheet panel should carry `useChromeSlab({ material:'glass', frost })`
     (`useChromeSlab.ts:34`) so it renders as real in-canvas glass at t2 and
     degrades to CSS `.ds-glass` below t2 (INV-9), exactly like the existing
     preview-nav pill (`page.tsx:634,738`).

3. **Z-index discipline.** There is no z token scale — overlays hardcode
   z-10/20/30/40/50/[100]. The bottom-sheet host + its scrim should sit at the
   top of a *defined* order (sheet scrim above z-50 chrome, sheet above scrim,
   MagneticCursor above all). Consider adding `--ds-z-*` tokens while here.

This keeps the "one renderer, one scene" invariant intact: the layout system and
sheet are **pure DOM overlays**; the slab layer keeps mirroring their rects.

---

## 6. Current state (concrete)

- One full-bleed `three/webgpu` canvas (`GraphScene`, `page.tsx:800`) under a
  cloud of `absolute`-pinned DOM overlays; chrome glass/metal is rendered inside
  that same canvas by `ChromeSlabLayer` (mounted at `GraphScene.tsx:3177`,
  rect-mirrored per frame `ChromeSlabLayer.tsx:197-287`).
- Mode = a state of the scene; `isPreviewApp` (`page.tsx:640`) hides editor
  chrome. preview-app default on boot (RA-17).
- Responsiveness = a 900px `window.innerWidth` JS boolean swapping two
  near-duplicate JSX trees (`page.tsx:139,206-211,658,815`) **plus** independent
  Tailwind `md/lg` (768/1024) utilities inside each overlay — **two systems, two
  breakpoints, neither container-aware**.
- No bottom-sheet host today; mobile panels are edge-pinned full-bleed
  `rounded-none` takeovers (Inspector.tsx:359 etc.). The only sheet-like /
  safe-area-aware element is `MobileModeToggle` (`page.tsx:866-951`).
- Embedded in a constrained pane → renders the desktop tree until the *browser
  window* crosses 900px, because nothing measures the container.

---

## 7. WOW opportunities (specific, dep-combining)

1. **Container-query layout engine (the headline).** `ResizeObserver` on `<main>`
   → `density` context → drives both the page tree branch (`page.tsx:658`) and a
   set of `data-density` attributes the overlays read instead of `md:`/`lg:`.
   Editor becomes flawless at any pane width — the single biggest WOW for an
   embedded preview-pane. Animate the density crossfade with GSAP (already in).
2. **Material bottom-sheet host** with a draggable handle, GSAP `back.out` spring
   open, Lenis 1.3 momentum on its scrollable body (Lenis is installed and was
   used on the library grid per git log), and a `useChromeSlab` glass surface so
   the sheet is real in-canvas refractive glass at t2. One host, store-driven,
   replaces every full-bleed mobile panel takeover.
3. **Choreographed mode transition tied to layout.** `ModeTransitionConductor`
   (`page.tsx:648`) already does a refractive sweep on mode change; extend it to
   also choreograph the density transition (panels reflow with staggered GSAP
   reveal) so resizing the pane feels designed, not janky.
4. **Adaptive chrome density.** At `compact` density, collapse TopBar's
   `lg:flex` cluster (TopBar.tsx:157) and CanvasToolbar's rail into the sheet host
   rather than hiding/clipping — turning today's `hidden`/`max-md:` losses into a
   single reachable surface.
5. **Pointer-light + magnetic-cursor continuity** across the sheet: the chrome
   pointer light (`ChromeSlabLayer.tsx:214-219`) and in-house `MagneticCursor`
   (`overlays/MagneticCursor.tsx`, mounted `page.tsx:848`) should treat the sheet
   handle as a snap target for a tactile drag-to-open.
6. **camera-controls 3.1** (installed) can bound the canvas framing per density so
   the scene re-frames as the pane narrows (galaxy zoom-out on compact), keeping
   the subject centered behind the sheet.

---

## 8. Risks / invariants constraining edits here

- **One renderer only** — `three/webgpu`, WebGL2 fallback. No PixiJS (FP-01),
  no second canvas, no split-pane (FP-R6). The layout system + sheet must be
  **pure DOM overlays** over the single `GraphScene` canvas. (CLAUDE.md;
  anti-drift-check.sh FP-01.)
- **TSL not raw GLSL** for any in-canvas surface (slab materials in
  `chrome-layer/material.ts` are TSL). A DOM sheet sidesteps this, but if the
  sheet gets an in-canvas slab it must stay on the existing TSL slab path.
- **Additive-only schema** (INV-18) — don't rename/delete store or node fields;
  a new `useBottomSheetStore` / density context is additive and fine.
- **INV-9 device tiering** — `useChromeSlab` is **inert below t2** and the v1 CSS
  must stand (`useChromeSlab.ts:82`). Any sheet material must degrade to plain
  `.ds-glass` CSS below t2; never assume the slab layer is live.
- **NO PURPLE** — palette is brass / bone / ice / graphite / void. Every color
  must come from `--ds-*` tokens (tokens.css). The boot loader and toggles model
  this (`page.tsx:70,97,128`).
- **Design-tokens-only styling** — radius via `--ds-r-*` (tokens.css:89-94),
  no hardcoded hex where a token exists. Note the existing inline RGB gradient
  backdrops use `rgba(var(--ds-brass-400-rgb), …)` token RGBs (`page.tsx:70,654`)
  — follow that pattern, not literal hex.
- **Never surface the word "fal" in UI.** (Patina maps are fal-generated in
  `material.ts` but never labeled.)
- **Canonical 3 view modes only** — FP-12 + FP-14 block any new viewMode literal
  outside `galaxy|canvas|preview-app`. A density/layout system must NOT add a 4th
  mode; density is orthogonal to viewMode.
- **FP-11**: don't mutate `useGraphEditorStore` state directly — use actions.
  A new layout/sheet store is separate and unconstrained, but if the sheet reads
  selection it goes through existing selectors.
- **Editor-shell `window.*` is allowed** here (page.tsx already uses
  `window.innerWidth`, history, dev hooks) — FP-05 scopes only to runtime/node
  modules under `runtime/**`. So a `ResizeObserver`/context in `page.tsx` is legal.
- **`useState(true)` SSR default** for `isDesktop` (`page.tsx:139`) causes a
  desktop→mobile flash on phones; a ResizeObserver-based replacement should
  initialize from a layout-effect measurement (or accept a 1-frame hidden state)
  to avoid the same flash.
- **Two-tree duplication** (`page.tsx:658` vs `:815`) is a maintenance trap —
  the desktop/mobile trees drift (mobile already lost `Minimap`). A container-
  query system should ideally collapse them to **one tree** with density-driven
  child visibility, reducing this risk rather than adding a third branch.
