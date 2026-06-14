# Recon — Canvas Toolbar (UI-WOW-2)

Surface: the left vertical tool rail of the Prism canvas editor.
Primary file: `src/components/editor/overlays/CanvasToolbar.tsx` (1834 lines).
Mounted in: `src/app/page.tsx` (desktop line 810, mobile line 827) — self-gates to `viewMode === 'canvas'`.

---

## 1. The 11 toolbar items (groups), in dock order

The dock is driven by `GROUPS: ToolGroupMeta[]` at `CanvasToolbar.tsx:146-158`. Every group is currently `wired: true`. `ToolGroupId` union is at `:125-136`.

| # | id | icon | label | wired | flyout component | engine / handler |
|---|------|------|-------|-------|------------------|------------------|
| 1 | `transform` | `move` | Transform | ✓ | `TransformFlyout` (in-file, `:1045`) | writes node's own `scenePosition` via `setScenePosition` (`:534-566`); Edit toggle → `setEditorMode('edit')`, gizmo mode via `ensureEdit` (`:526`) |
| 2 | `selection` | `group` | Selection | ✓ | `SelectionFlyout` (in-file, `:1148`) | marquee (`MarqueeOverlay`), `groupNodes`/`ungroupNodes`/`setNodeLocked`/`toggleFreeze`/`setMultiSelection` (`:569-593`) |
| 3 | `add` | `plus` | Add | ✓ | `AddElementFlyout` `@/components/editor/add-tools/` | hub-tethered element creation |
| 4 | `library` | `layers` | Elements | ✓ | `LibraryFlyout` `@/components/editor/elements/` | §13 prebuilt 3D cluster browser, drag-to-place |
| 5 | `image` | `image` | Image | ✓ | `ImageFlyout` `@/components/editor/image-tools/` | upload / paste-link → image-plane node; Replace via rebuild; imageSpec controls |
| 6 | `object3d` | `cube` | 3D Object | ✓ | `ObjectFlyout` `@/components/editor/object-tools/` | 7-primitive picker; dimension faders → `node.meshPrimitive`; jump to Inspector Material tab |
| 7 | `changeArtifact` | `sparkle` | Change Artifact | ✓ | `ChangeArtifactFlyout` `@/components/editor/change-artifact/` | §12 Upload/Generate wizard launch |
| 8 | `text` | `text` | Text | ✓ | `TextToolsFlyout` `@/components/editor/text-tools/` | P1 text system; font picker + MSDF atlas bake; live styling routes through `usePreviewStateStore` (FP-15) |
| 9 | `animation` | `wand` | Animation | ✓ | `AnimationFlyout` `@/components/editor/animation-tools/` | live catalog picker + binding stack on `node.animationBindings`; owns the keyframe-editor toggle |
| 10 | `lighting` | `bulb` | Lighting | ✓ | `LightingFlyout` (in-file, `:1265`) | writes active hub's `lightingSpec` directly via `useGraphSourceStore.setState` (`:619-629`) + per-node `receivesLighting` |
| 11 | `build` | `hammer` | Build | ✓ | `BuildFlyout` (in-file, `:1204`) | `commitPreviewToSource` + `saveToServer` + `rebuildNode` (`:597-610`); Add to System |

Five flyouts are defined inline in this file (`TransformFlyout`, `SelectionFlyout`, `LightingFlyout`, `BuildFlyout` + the `KeyframeEditorPanel` / `MarqueeOverlay`); six are imported components. Only the bespoke-authoring lane inside Animation and the Keyframe-editor track content are "designed-placeholder" (see file header `:54-58`); they surface a tasteful `showComing()` banner (`:521-523`, rendered in `FlyoutShell` `:1022-1038`) rather than fake output.

### Tool-group selection model
- Single open group at a time: `activeGroup` state (`:458`, default `'transform'`). Toggling re-clicks close it (`:778`).
- Each dock key is a `DockGroupKey` (`:371-415`) — 54×48px, brass active state via `activeKeyStyle(DS_ACCENT)`, a left brass tab indicator when active (`:394-399`), and an ice "not-wired" dot (`:407-412`, currently never shown since all wired).

---

## 2. Rail positioning & sizing

The rail container (`:731-734`):
```
<div data-component="canvas-toolbar"
  className="absolute z-50 left-3 top-1/2 -translate-y-1/2 pointer-events-auto
             flex items-stretch gap-2 max-h-[calc(100vh-7rem)]">
```
- `absolute z-50`, pinned `left-3`, vertically centred (`top-1/2 -translate-y-1/2`).
- Height-bounded `max-h-[calc(100vh-7rem)]` so short viewports scroll rather than clip (460px advocate flag, `:729-730`).
- Layout is `flex items-stretch gap-2`: **dock column** + **flyout** sit side-by-side horizontally.
- The dock (`:739`) is `flex-col gap-1 p-1.5` with `min-h-0 overflow-y-auto overscroll-contain` — the 11 keys scroll inside the bounded rail. Classes `ds-metal ds-grain ds-edge` (brushed-metal housing).
- A "CANVAS" nameplate header sits atop the keys (`:740-745`), with scribed part-line dividers (`:748-756`) and a V-groove before the Build key (`:761-774`).

---

## 3. Flyout / popover system (`FlyoutShell`, `:939-1042`)

- Rendered conditionally to the right of the dock when `activeGroup` is set (`:786-913`).
- Width: `w-[424px]` for Animation (the wide LIVE catalog picker, `wide = meta.id === 'animation'` `:950`), else `w-[252px]`.
- Classes: `ds-glass ds-glass--refract ds-edge--brass` — **hero refractive glass** plate (`:971`). It is one of ≤3 refract surfaces; `RefractionDefs` mounted once in page.tsx (`:645`).
- `max-h-[min(78vh,calc(100vh-7rem))] overflow-hidden flex`; inner scroll plate `:976` (`overflow-y-auto` for normal, `overflow-hidden` for the wide picker which manages its own scroll).
- Header (`:977-1012`): brass-soft icon chip, `ds-title` label, "Coming soon" subline only for unwired groups (all wired now), and a close `×` button.
- `coming` banner (`:1022-1038`): ice-tinted card for deferred tools.
- Keyframe editor (`KeyframeEditorPanel`, `:1549-1721`) is a **separate slide-up** panel pinned `absolute z-40 bottom-0 left-0 right-0` (full-width), CSS-transition slide via `transform: translateY(open?0:110%)` using `--ds-t-slow`/`--ds-ease-out` tokens (`:1573-1578`). Toggled from inside `AnimationFlyout`.
- Toast pill (`:924-933`): `absolute z-50 left-1/2 top-16`, smoked-glass, auto-clears after 2600ms (`:515-519`).
- Marquee overlay (`MarqueeOverlay`, `:1775-1833`): `absolute inset-0 z-30`, crosshair drag, calls `window.__PRISM_EDITOR_MARQUEE_HIT__` to hit-test the WebGPU canvas (`:679-701`).

---

## 4. Viewport-width reactivity (the weak point)

There is **no JS breakpoint logic and no real responsive layout** — the rail keeps the same desktop geometry at every width. Mobile handling is three Tailwind hacks:

1. **Phone scrim** (`:719-727`): when a flyout is open, `md:hidden absolute inset-0 z-40` dims the canvas behind, tap-to-dismiss. md+ has no scrim.
2. **`EmptyHint` contrast bump** (`:1517-1539`): `max-md:text-ds-text` steps hint text to full bone on phone widths over a bright canvas.
3. **Keyframe header label** hidden below `lg` (`:1604`).

The dock width (`54px` keys) + a `252px`/`424px` flyout = **~310-490px of fixed horizontal chrome**, anchored `left-3`, centred vertically. On a ~375px phone the wide Animation flyout (`424px`) overflows the viewport; the `252px` flyout + dock nearly fills it. There is no collapse-to-bottom-bar, no horizontal scroll-snap, no width-aware repositioning. This is the single biggest WOW/usability gap. (page.tsx renders the toolbar in BOTH desktop and mobile branches identically — `:810` and `:827`.)

---

## 5. GSAP / animation usage

- **`useReveal`** (`src/components/editor/design-system/use-reveal.ts`) — the shared GSAP entrance hook. `FlyoutShell` calls it on the inner content wrapper (`:960`, `resetKey: meta.id`) so children cascade-in (`gsap.fromTo` opacity/y, `expo.out` + `power3.out` stagger 0.04). Stagger is **disabled for the wide Animation picker** because its shared-rig canvas scissor rects must not be transform-offset mid-open (`:947-959`).
- Respects `prefers-reduced-motion` (snaps visible). transform+opacity only. Auto-reverts via `gsap.context`.
- `ds-reveal` CSS class is applied to scrim/toast/coming-banner/keyframe — a CSS keyframe entrance (materials.css), separate from GSAP.
- The keyframe slide-up uses a **CSS transition**, not GSAP.
- `MagneticCursor` runs its own plain rAF lerp loop (no GSAP, no dep).
- GSAP 3.13 is installed; only `useReveal` taps it here. **Lenis / camera-controls / postprocessing / simplex-noise are NOT used by the toolbar.**

---

## 6. Chrome-slab material system (the real surfaces)

Every visible toolbar surface is a **`useChromeSlab`** GPU slab (`src/components/editor/chrome-layer/useChromeSlab.ts`), which suppresses the element's CSS background/frost/keyline and renders it as real metal/glass/ceramic/well inside the single WebGPU canvas (`ChromeSlabLayer`). Materials: `'glass' | 'metal' | 'ceramic' | 'well'` (registry.ts:18). Options: `radius`, `borderPx`, `accent` 0..1, `frost` 0..1, `brushAxis` 'x'|'y', `order` (z-bias).

Slab usage in this file:
- Dock housing: `{ material: 'metal', radius: 13, brushAxis: 'y', order: 50 }` (`:425`).
- Each `DockGroupKey`: `{ material: 'ceramic', radius: 9, order: 51 }`, `accent` follows active (`:376-379`).
- `ToolButton` / `StepperKey`: ceramic slabs (`:275`, `:325`).
- Flyout plate: `{ material: 'glass', radius: 18, accent: 1, frost: 0.82 }` (`:956`) — frost bumped to 0.82 in UI-WOW P2 to read as a clean frosted field, not a muddy window.
- Toast / marquee hint: `{ material: 'glass', radius: 999, frost: 0.35 }` (`:429`, `:1786`).
- Fader groove: `{ material: 'well', radius: 999 }` (`:1484`).
- Keyframe body/header/lanes: ceramic/metal/well slabs with `order` 40/41/42 (`:1564-1565`, `:1733`).

`order` matters: React attaches child refs before the parent's, so the housing would paint over its keys without explicit `order` (`:422-425`, `:370`).

---

## 7. Design-token usage (clean — token-disciplined)

- All colors come from `DS` / `DS_ACCENT` / `dsAlpha` (`@/components/editor/design-system`, tokens.ts) and CSS vars (`var(--ds-*)`). `DS_ACCENT = DS.brass400 (#cd9f55)`.
- Palette is **brass / bone / ice only — no purple** (confirmed tokens.ts:23-36; comments at tokens.ts:65/78 explicitly say "no purple").
- Sanctioned hex exceptions are **scene DATA, not chrome**: `LIGHT_COLOR_DEFAULT='#ffffff'`, `HEMI_GROUND_DEFAULT='#404050'` (`:201-202`), documented as physical emitter colors written into `hub.lightingSpec`, not UI paint.
- Treatment constants `KEY_BG`, `KEY_SHADOW`, `WELL_BG`, `WELL_SHADOW`, `SMOKED_PILL`, `activeKeyStyle()` all compose from `var(--ds-*)` tokens (`:99-119`).
- `rgba(255,252,242,...)`/`rgba(0,0,0,...)` literals appear in groove/specular highlight gradients (e.g. `:247-248`, `:1331`, `:1690`) — bone/black catch-light feathering, the one place raw rgba is used instead of a token (these are specular detailing, hard to tokenize cleanly).

---

## 8. MagneticCursor & tooltips

- **MagneticCursor** (`src/components/editor/overlays/MagneticCursor.tsx`, 93 lines): mounted ONCE globally in page.tsx (`:848`), NOT per-toolbar. A `fixed inset-0 z-[100] pointer-events-none` ring+dot. Snaps to any element matching the `INTERACTIVE` selector (`MagneticCursor.tsx:21`): `button, a, input, select, textarea, [role="button"], [data-magnetic], .ds-btn, .ds-toggle, .ds-slider, [data-cluster-tile], [data-role="library-category"]`. **All toolbar keys are `<button>`**, so they auto-magnetize — no per-key opt-in needed. Sets ONLY `transform`+`opacity` imperatively; warm/brass state is the `.ds-cursor-ring.is-warm` CSS class (materials.css). Inert on coarse pointers / reduced-motion. In-house, no dep.
- **Tooltips**: native `title=` attributes only (9 occurrences). **No Radix Tooltip, no custom tooltip component.** Group keys use `title={meta.label}` (`:386`); several tool buttons pass explanatory `title` (e.g. `:1171` "Drag a box over the canvas to select", `:1187` "Freeze = AI off-limits"). This is a flat, un-styled, OS-delayed tooltip — a clear WOW upgrade lever (Radix Tooltip IS installed/available).

---

## 9. Forbidden-pattern compliance (anti-drift-check.sh)
- `if (viewMode !== 'canvas') return null;` (`:703`) — canonical-3 mode literal only; no `hub-world`/`preview-hub` strings (FP-12/FP-14 clean).
- Toolbar writes to source store directly (Transform/Lighting) which is **allowed** (it is NOT an Inspector tab; FP-15 only blocks Inspector tabs from `useGraphSourceStore.getState().updateNode`). Lighting uses `useGraphSourceStore.setState` for hubs (`:623`).
- Imperative `.style.background` FP (anti-drift line 66) targets Prism RUNTIME/node modules only — editor overlays are out of that scope. MagneticCursor sets only `.style.transform`/`.style.opacity`.

---

## Verdict
Beautiful, token-disciplined, GPU-slab chrome that is functionally complete (11 wired groups) but is **desktop-only in layout** with native OS tooltips and only a single GSAP entrance. The WOW gap is: (1) responsiveness/mobile, (2) tooltip richness, (3) the entrance/interaction choreography being limited to one fromTo + magnetic cursor.
