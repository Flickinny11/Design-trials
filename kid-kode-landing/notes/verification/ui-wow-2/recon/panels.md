# UI-WOW-2 Recon — SURFACE: panels (Inspector family + RightPane)

Read-only recon of the right-rail inspector panels. Repo:
`/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing`.
Branch `prism-editor-build`. Renderer = three/webgpu + TSL only.

## Files in scope

| File | Role | Lines |
|---|---|---|
| `src/components/editor/panels/RightPane.tsx` | Router: picks HubInspector vs Inspector by selection | 21 |
| `src/components/editor/panels/Inspector.tsx` | Node inspector + 4 sibling panels (World, Group) + 8 tab bodies | 2006 |
| `src/components/editor/panels/HubInspector.tsx` | Hub inspector (6 tabs, hub-specific bodies) | 342 |
| `src/components/editor/panels/MaterialTab.tsx` | Schema-driven physical-material editor (1 of Inspector's tabs) | 165 |

Direct collaborators read:
- `src/stores/usePreviewStateStore.ts` (FP-15 write-routing target)
- `src/components/editor/chrome-layer/useChromeSlab.ts` (GPU slab hook)
- `src/components/editor/design-system/tokens.css` (palette/tokens)
- `src/app/page.tsx` (mount site, desktop/mobile branch, MobileModeToggle)

---

## 1. How panels are positioned

**All four panel housings share one geometry recipe** — `position: absolute` (NOT
`fixed`), pinned to the right of the `data-pane="graph"` container which is `absolute
inset-0` inside the editor shell (`page.tsx:799`, `page.tsx:818`).

### The five housings and their exact className

1. **Node Inspector** — `Inspector.tsx:350-359`
   ```
   absolute z-40 right-0 top-14 bottom-0 left-16
   md:left-auto md:w-[484px] md:right-3 md:top-[64px] md:bottom-3
   flex flex-col overflow-hidden ds-glass ds-edge--brass ds-elev-4
   rounded-none md:rounded-ds-lg ds-reveal-r
   ```
   - **Mobile (<768px):** `top-14` (56px, clears top bar) `bottom-0` `left-16` (64px,
     clears the left tool rail) `right-0` → a near-full-width slab inset only by the
     left rail. `rounded-none`.
   - **Desktop (≥768px):** fixed `w-[484px]`, floated `right-3 top-[64px] bottom-3`,
     `rounded-ds-lg`. This is the WIDEST housing of the family.
   - Header comments (`Inspector.tsx:352-358`) record two prior advocate MUST-FIXes:
     w-full slid *under* the left rail (fixed with `left-16`), and `md:top-3` slid
     *under* the 56px top bar (fixed with `md:top-[64px]`).

2. **HubInspector** — `HubInspector.tsx:52-54`
   ```
   absolute z-40 right-0 top-0 bottom-0 w-full
   md:w-[460px] md:right-3 md:top-3 md:bottom-3
   flex flex-col overflow-hidden ds-glass ds-glass--refract ds-edge--brass ds-elev-4
   rounded-none md:rounded-ds-lg ds-reveal-r
   ```
   - **Mobile:** `w-full top-0 bottom-0` — **edge-to-edge, full viewport height**,
     covering the top bar AND tool rail (unlike the node Inspector, which was patched
     to inset). This is an inconsistency: hub/world/group housings still use the
     unpatched `top-0 w-full` geometry, so on a phone they occlude the top bar.
   - **Desktop:** `w-[460px] right-3 top-3 bottom-3`. 24px narrower than node Inspector.
   - Adds `ds-glass--refract` (the only housing besides World that requests live
     refraction — t2-only, gated in materials.css:454).

3. **WorldInspectorPanel** — `Inspector.tsx:1566-1568` — identical geometry to
   HubInspector (`w-full ... md:w-[460px] md:right-3 md:top-3 md:bottom-3`), `ds-glass`
   (no refract on housing). `data-role="world-inspector"`.

4. **GroupInspector** — `Inspector.tsx:1933-1936` — identical geometry to HubInspector
   (`md:w-[460px]`, `top-0 w-full` mobile). `data-role="group-inspector"`.

5. **MaterialTab** — NOT a housing; renders *inside* the node Inspector's scroll body
   (`Inspector.tsx:552`). It's a tab body (`p-5 space-y-4`), no positioning of its own.

### Stacking / crowding
- **Only one housing mounts at a time.** `RightPane.tsx:18-19` picks HubInspector when
  `selectedHubId && !selectedNodeId`, else Inspector; Inspector internally early-returns
  into Group/World variants (`Inspector.tsx:313`, `:332`). So **panels never stack
  side-by-side** — the "crowd" risk is purely *within* one panel.
- `z-40` on every housing. Sibling overlays (TopBar, HubNav, Minimap, DetailCard,
  GalaxyFilterOverlay, CanvasToolbar) mount as siblings in the same `data-pane` div
  (`page.tsx:801-811`). DetailCard is the quick-look card shown *when the Inspector is
  closed* (mutually exclusive in practice but not enforced by z-order).
- All inspector chrome is hidden in preview-app mode (`{!isPreviewApp && (...)}`,
  `page.tsx:801`/`:820`).

### Breakpoint mismatch (load-bearing finding)
- Panels switch geometry at Tailwind **`md` = 768px** (no custom `screens` block in
  `tailwind.config.ts` → Tailwind default).
- The page swaps its **entire desktop/mobile layout tree at 900px**
  (`page.tsx:207: window.innerWidth >= 900`, gate at `page.tsx:658`).
- **Dead zone 768–899px:** the page renders its *mobile* branch (DetailCard +
  MobileModeToggle, no desktop TopBar cluster) but the panel uses its *desktop*
  floating `md:w-[484px]` geometry. A tablet in this band gets a floating 484px card
  over a mobile chrome layout. This is the cleanest target for the bottom-sheet rework
  — unify the panel breakpoint with the layout breakpoint (900px) or convert to a sheet.

---

## 2. Widths & dimensions

| Panel | Mobile width | Desktop width | Mobile height | Desktop float |
|---|---|---|---|---|
| Node Inspector | `right-0 left-16` (~100vw − 64px) | `484px` | `top-14 bottom-0` | `top-[64px] bottom-3 right-3` |
| HubInspector | `w-full` (100vw) | `460px` | `top-0 bottom-0` (full) | `top-3 bottom-3 right-3` |
| WorldInspector | `w-full` | `460px` | `top-0 bottom-0` | `top-3 bottom-3 right-3` |
| GroupInspector | `w-full` | `460px` | `top-0 bottom-0` | `top-3 bottom-3 right-3` |

No `max-width`, no `min-width`. Width is the only responsive lever today; height is
always "fill available vertical".

---

## 3. The tab system

Two independent tab definitions (NOT shared):
- **Node Inspector `TABS`** (`Inspector.tsx:45-54`): 8 tabs — `visual, material,
  behavior, code, animation, connections (label "Links"), backend, history`. Plus
  `WORLD_TABS` (`:60-63`) which prepends a `world` tab → 9 for App_Name_World.
- **HubInspector `TABS`** (`HubInspector.tsx:16-23`): 6 tabs — `visual, behavior, code,
  animation, connections, backend` (no material/history). Hub-specific bodies.

### Tab rail rendering (identical recipe across all panels)
`Inspector.tsx:525-541`, `HubInspector.tsx:77-93`, World `:1591-1607`:
```
<div className="flex gap-1.5 px-3 py-2.5 overflow-x-auto scrollbar-hide">
  {TABS.map(t => <button className="ds-chip ds-press ... min-h-[40px] px-3 gap-1.5
     {active ? 'ds-chip--brass' : 'hover:text-ds-text'}">
     <Icon name={t.icon} ... glow={active}/> {t.label}</button>)}
```
- Tabs are **horizontally-scrolling chips** (`overflow-x-auto scrollbar-hide`). With 8–9
  tabs at ~64px each (icon+label+`px-3`), the rail overflows on a 460–484px panel and
  **silently scrolls** — no fade/affordance, no scroll indicator. On mobile (~320px)
  this is a hidden-overflow trap; only ~4 tabs are visible.
- Active state is shared via `useGraphEditorStore.inspectorTab` (`tab` / `setTab`), so
  switching node↔hub keeps the same tab id selected even if the target panel lacks it
  (e.g. hub has no `material`/`history` → those tabs just fall through to no body).
- Tab state is global, not per-selection. `min-h-[40px]` chips = touch-target floor.

### Sub-tab systems inside tab bodies
- **AnimationLibrarySection** (`Inspector.tsx:1273-1347`): a SECOND tab system
  (`role=tablist`) for the 3 `ANIMATION_METHODOLOGIES` categories, inside the Animation
  tab. Brass-chip styling mirrors the main rail.
- **Coordinate-space / Trigger pickers** (`Inspector.tsx:1113-1171`): radiogroups of
  chips. So the Animation tab alone holds: playback transport, a live CSS-transform
  preview stage, a timeline bar, a keyframe filmstrip, 5 prop sliders, a color picker,
  2 radiogroups, a captured-keyframe chip list, 4 action buttons, AND the 3-category
  library. It is by far the most crowded tab body.

---

## 4. What content each panel/tab holds

### Node Inspector header (`Inspector.tsx:362-512`)
- Brushed-metal header plate (`ds-metal ds-grain`). Row 1: kicker (INSPECTOR ›
  elementType), truncating title + frozen snow icon, build-state chip (failed/dirty/
  repaired/built, `:382-411`), close button.
- Row 2 = **action rail that wraps** (`flex flex-wrap gap-1.5`, `:422`): 7 buttons —
  Edit/Done, Save/Saved, Save & Rebuild, Clone, Change Artifact, Preview in App UI.
  Each `h-7 text-[10px]`. On a narrow panel this rail wraps to 2–3 rows of tiny keys —
  a known density problem (the wrap is the *fix* for an earlier collision, per
  `:421-422`).
- Save-status strip (`:513-522`).

### Node Inspector tab bodies (all `function …Tab`)
- **VisualTab** (`:568-694`): live R3F sub-canvas (`VisualPreview`), element-image well,
  frame scrubber, primary/accent ColorPickers, font/radius spec rows, text-content list.
- **MaterialTab** (separate file): schema-driven sliders/knobs/color + receivesLighting
  toggle from `MATERIAL_CONTROL_SCHEMA`. **All writes → preview store** (see §5).
- **BehaviorTab** (`:711-742`): interactions list + state-management readout.
- **CodeTab** (`:747-821`): generated GSAP / static code in a `<pre>` trough + Save/Revert.
- **AnimationTab** (`:852-1268`): the keyframe editor (see §3 — most crowded).
- **ConnectionsTab** (`:1394-1470`): incoming/outgoing edge lists, fly-to buttons.
- **BackendTab** (`:1475-1528`): backend-contract card + deployment grid.
- **HistoryTab** (`:1864-1898`): per-node edit log (color/animation events).

### HubInspector bodies (`HubInspector.tsx`)
- HubVisualTab (caption, layout grid, responsive breakpoints), HubBehaviorTab (global
  bindings), HubCodeTab (manifest JSON), HubAnimationTab (animated-node summary),
  HubConnectionsTab (attached nodes, click-to-select), HubBackendTab (empty-state note).

### WorldInspectorPanel (`Inspector.tsx:1547-1732`)
- WorldTab: 9 D1 fields each as a JSON `<textarea>` with per-field Save +
  parse-error inline. Plus CapabilitiesPanel (`:1755-1855`) — capability refs with a
  server-only Resolve that returns REDACTED metadata (INV-19).

### GroupInspector (`Inspector.tsx:1909-2004`)
- Count header + Clear/close, then HUBS list and NODES list. No tabs.

---

## 5. Preview-state vs source-store write routing (FP-15)

**Rule (FP-15):** files matching `*/Inspector*.tsx` or `*/panels/*Tab.tsx` MUST NOT call
`useGraphSourceStore.getState().updateNode`. Enforced at write-time by
`.claude/hooks/anti-drift-check.sh:157-166`.

**The dataflow:**
1. **Tab edits → preview buffer.** MaterialTab writes via
   `usePreviewStateStore.getState().set(node.nodeId, { materialSpec })` /
   `{ receivesLighting }` (`MaterialTab.tsx:75`, `:81`). AnimationTab's "Save as
   keyframe" writes `usePreviewStateStore.getState().set(...)` (`Inspector.tsx:960`).
   The renderer reads `sourceNode ⊕ peek(nodeId)` via `composeNodeWithPreview`
   (`usePreviewStateStore.ts:59-65`) → **live, real-time** visual change without
   touching source.
2. **Dirty signal.** Inspector header computes `previewDirtyForSelected` from
   `usePreviewStateStore.patches[selectedId]` and ORs it with `sourceDirty` to light the
   Save button (`Inspector.tsx:123-127`).
3. **Save** (`handleSave`, `:152-167`): `commitPreviewToSource(selectedId)` (the legal
   indirection that calls source-store `updateNode`, NOT the panel) then
   `saveToServer()`. Buffer clears; debounced autosave persists.
4. **Save & Rebuild** (`handleSaveAndRebuild`, `:178-193`): Save, then
   `rebuildNode(selectedId)` re-invokes `createNode` for that one node (cleanup + cache
   evict + per-node rebuild-version bump); sibling Object3Ds stay stable.
5. **Clone** (`handleClone`, `:206-214`): uses `useGraphSourceStore.getState().cloneNode`
   (a dedicated action, NOT updateNode — FP-15 doesn't apply), then switches to galaxy +
   parks on `draggingNodeId`.
6. **WorldTab** is the one read/write-to-source surface inside Inspector.tsx, but it
   routes through `updateRootNode` (`:1678`), which is `updateRootNode` not `updateNode`
   — outside FP-15's grep, and legal.

**Implication for redesign:** any new sheet/panel control that edits a node MUST keep
routing through `usePreviewStateStore.set` (or a `commit*`/`cloneNode`/`updateRootNode`
helper). A direct `updateNode` from a panel component is an immediate hook block.

---

## 6. What becomes a bottom-sheet on mobile

The entire inspector family is the bottom-sheet candidate. Today on mobile they're
right-rail/full-screen slabs that occlude the scene. A WOW mobile pattern:

- **Node/Hub/World/Group Inspector housing** → a **draggable bottom sheet** with snap
  points (peek / half / full), `env(safe-area-inset-bottom)` aware (the MobileModeToggle
  at `page.tsx:903` already sits at `bottom: calc(10px + safe-area)` — the sheet must
  not collide with it).
- **The 8–9 tab rail** → either a sticky sheet-header segmented control or a scroll-snap
  carousel; the current silent `overflow-x-auto` is the worst mobile offender.
- **The 7-button action rail** (`Inspector.tsx:422`) → a sticky sheet footer / overflow
  menu rather than a wrapping 3-row grid of `h-7` keys.
- **AnimationTab** is too tall for a half-sheet — it wants the full snap state.

No `BottomSheet`/`Drawer` component exists in the repo yet (grep found only a README
mention). Radix is installed (could supply a Dialog/primitive base), GSAP 3.13 for the
spring drag, and the MobileModeToggle already demonstrates the GSAP-spring + safe-area
idiom to mirror.

---

## 7. Chrome-layer (slab) coupling — affects any housing rework

Every housing/header/key calls `useChromeSlab` (`Inspector.tsx:71-82`,
`HubInspector.tsx:28-30`, `MaterialTab.tsx:44-45`). Mechanics
(`useChromeSlab.ts`):
- The hook registers the DOM element with a GPU slab registry; at **tier t2** it adds
  `.ds-slab-hosted` and renders the real material in the unified canvas behind the DOM
  (materials.css suppresses the CSS bg/frost). **Below t2 (phones = t1) the hook is
  inert and the CSS Observatory-Brass look stands** (INV-9 device tiering).
- **Hooks run before early returns** in every panel (hooks rule) — e.g. HubInspector's
  4 slab hooks at `:28-30` precede the `if (!open...) return null` at `:42`. Any new
  panel/sheet must preserve this ordering.
- Header-plate `order: 0` bias (`Inspector.tsx:76`) is a deliberate z-fix so the metal
  plate registers under its own ceramic keys. A sheet rework that reparents the header
  must re-reason about slab registration order.
- `inspectorSlab` uses `frost: 0.84` (`Inspector.tsx:71`) — a UI-WOW P2 fix for "muddy
  window". Hub/World/Group use `frost: 0.6`. The refract budget is "1 inspector mounts
  at a time" (`Inspector.tsx:348-349`) — a sheet that animates between two housings
  could momentarily mount two and blow the refraction budget.

---

## 8. Styling / token discipline

- Palette is **brass / bone(text) / ice / graphite-void**, **NO purple** (asserted in
  `tokens.css:9-11`). Status colors = ok/warn/danger/ice only (warn sits *inside* the
  brass family, `tokens.css:52`).
- Components style via token classes: `ds-glass`, `ds-metal`, `ds-ceramic`, `ds-well`,
  `ds-edge`, `ds-edge--brass`, `ds-chip`, `ds-chip--brass`, `ds-btn(--primary/ghost/
  quiet)`, `ds-slider`, `ds-toggle`, `ds-kicker`, `ds-label`, `ds-body`, `ds-reveal-r`,
  `text-ds-*`. Inline `style` is used only for *functional content data* (node
  primary/secondary colors, gradient rails, animation transforms) — never for chrome.
- A few inline `background`/`boxShadow` styles exist in tab bodies (e.g.
  `Inspector.tsx:603-606`, `:1002-1003`, `:1008-1013`) but use token vars / node-data
  colors. The anti-drift `.style.background=` rule (`anti-drift-check.sh:66`) targets
  *runtime/node modules*, not these React panels; still, prefer token classes when a
  token exists.

---

## Anchors quick-list
- Router: `RightPane.tsx:14-20`
- Node housing: `Inspector.tsx:350-359`; header rail: `:362-512`; tab rail: `:525-541`;
  tab dispatch: `:550-559`
- Hub housing: `HubInspector.tsx:52-54`; tabs `:16-23`
- World housing: `Inspector.tsx:1566-1568`; Group: `:1933-1936`
- Material writes (FP-15 target): `MaterialTab.tsx:71-83`
- Preview compose: `usePreviewStateStore.ts:59-65`
- Mount + desktop/mobile branch: `page.tsx:799-838`; desktop gate 900px `page.tsx:207`
- MobileModeToggle (safe-area + GSAP idiom to mirror): `page.tsx:866-955`
- FP-15 enforcement: `.claude/hooks/anti-drift-check.sh:157-166`
- Palette no-purple: `tokens.css:9-11`
