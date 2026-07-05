The spec-criteria reminder is project-wide verification tracking and does not block this read-only audit. Two notes from the audit intersect it: page.tsx now mounts **only GraphScene** (no PrismHost XOR — relevant evidence toward RT-SC-10), and `VisualPreview`'s `saveAndVerify` regen-API path (`panels/visual-preview/regen-api`) is the NE-SC-14 legacy second path, documented below. Full audit follows as the return value.

---

# Observatory Brass v1 Chrome Audit — kid-kode-landing

Repo root: `/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing` (anchors given as `file:line`).

---

## 0. Design-system foundation

### `src/components/editor/design-system/tokens.css` (124 lines, frozen contract)
Single source of all chrome values, loaded globally via `src/app/layout.tsx:4-5`:
- Neutrals `--ds-void/#04050a` … `--ds-steel/#323848` (17-22); text ramp (25-28); brass ramp `--ds-brass-100…700` + rgb triplets (31-41); ice secondary (44-48); status colors (51-56).
- Gradient ramps (59-67): `--ds-grad-brass`, `--ds-grad-brass-soft`, `--ds-grad-panel` (translucent glass), `--ds-grad-panel-opaque` (t0 fallback), `--ds-grad-smoked`, `--ds-grad-metal`, `--ds-grad-ceramic`, `--ds-grad-well`, `--ds-grad-text-brass`.
- Edges/elevation (70-86): `--ds-edge-grad[-brass]`, `--ds-elev-0..4`, `--ds-chamfer[-soft]`, `--ds-glow-brass[-strong]`.
- Radii 6-24px/pill (89-94), motion 120-480ms + 4 easings (97-104), type scale 9-19px (107-114), frost strengths blur 18/26/10px (117-119), focus ring (122).

### `src/components/editor/design-system/tokens.ts` (94 lines)
JS mirror (`DS` hex object, lockstep with CSS). `DS_ACCENT = brass400` (46), `dsHexNumber()` (53) for three.js, `dsAlpha()` (58), `DS_CATEGORY_TINTS` (66), `DS_DIFFICULTY` (79), `DS_MOTION` (85). Explicitly the bridge for "three.js light/material colors, canvas-drawn chrome" — a GPU chrome renderer consumes this for uniforms.

### `src/components/editor/design-system/materials.css` (417 lines) — class → application map

| Class | Recipe (line) | Applied at |
|---|---|---|
| `.ds-glass` | panel gradient + frost + chamfer + elev-2 (32) | CanvasToolbar FlyoutShell (CanvasToolbar.tsx:889), Inspector (Inspector.tsx:323), HubInspector (HubInspector.tsx:47), GroupInspector (Inspector.tsx:1864), AddNodeDialog (AddNodeDialog.tsx:86), SearchPalette `--heavy` (SearchPalette.tsx:94), ColorPicker popover `--heavy` (ColorPicker.tsx:137), catalog header (CatalogGallery.tsx:77), preview-app nav (page.tsx:715) |
| `.ds-glass--refract` | t2-only SVG backdrop displacement (401-406) | exactly 3 heroes: Inspector:323, HubInspector:47, toolbar flyout:889 |
| `.ds-smoked` | smoked gradient + light frost (46) | GalaxyFilterOverlay dock (:65), boot readout strip (page.tsx:115), preview-app hub readout (page.tsx:736), world-badge strip (page.tsx:973); inlined as `SMOKED_PILL` for toast/marquee hint (CanvasToolbar.tsx:103) |
| `.ds-metal` | brushed repeating gradient over grad-metal (55) | TopBar:55, HubNav:62, Minimap bezel:116, toolbar dock (CanvasToolbar.tsx:654), Inspector/HubInspector header plates (Inspector.tsx:326, HubInspector.tsx:50), view-mode toggles (page.tsx:653, 871), world badge (page.tsx:961); KeyframeEditorPanel header inlines `--ds-grad-metal` (CanvasToolbar.tsx:1490) |
| `.ds-ceramic` | matte gradient (69) | DetailCard:47, KeyframeEditorPanel body (CanvasToolbar.tsx:1482), MaterialTab plates (:86, :137), Inspector keyframe cards (:1017, :1048), catalog plates (CatalogGallery.tsx:135, 183); PrimitiveTile caption inlines it (:76); inactive tool keys (CanvasToolbar.tsx:276, 1232) |
| `.ds-well` | recessed trough (76) | TopBar mode trough/health pill/breadcrumb (:83, :177, :136), Minimap well:122, toolbar SelectionChip/status/stepper wells (:321, :1071, :1130, :1209), Inspector SpecRows (:618, :633…), HubInspector troughs (:119, :228…), swatch frames (ColorPicker.tsx:111/146, ControlPanel.tsx:81, MaterialTab.tsx:115), SearchPalette icon well:158, boot rail (page.tsx:99) |
| `.ds-grain::after` | SVG feTurbulence grain (86) | every `.ds-metal` surface |
| `.ds-edge[--brass]::before` | masked 1px gradient border (99-115) | nearly every panel; brass on hero glass, selected tiles (PrimitiveTile.tsx:44), mode-toggle thumb (page.tsx:659) |
| `.ds-elev-0..4` | (119-123) | composable |
| `.ds-lift/.ds-press/.ds-reveal[-r]/.ds-sweep` | transform-only motion (127-173) | tiles/buttons/panel entrances |
| `.ds-kicker/.ds-label/.ds-title[-brass]` | type (183-209) | all labels; brass-clip title TopBar:72 |
| `.ds-btn` + variants | machined keys (213-265) | TopBar:198-224, DetailCard:129-167, AddNodeDialog:98-165, GalaxyFilter:48, Inspector rail:397-455, Build flyout (CanvasToolbar.tsx:1143-1153), catalog:177 |
| `.ds-chip` + variants | engraved tags (268-284) | status badges, Inspector/HubInspector tab rails (:477 / :77), ESC chip, count chip |
| `.ds-input/.ds-select` | troughs (287-308) | SearchPalette:108, AddNodeDialog:111-146, GalaxyFilter:77, ControlPanel:56 |
| `.ds-slider` | groove + brass radial thumb (311-346) | MaterialTab:111, ControlPanel:45, FaderRow (CanvasToolbar.tsx:1407), Inspector PropSlider:1301 + scrubber:581 |
| `.ds-toggle` | machined switch (349-378) | ControlPanel:74, MaterialTab:152 |
| Tier gating (382-406), coarse-pointer upsizing (410-417) | | global |

Pseudo budget (line 8): `.ds-edge*` owns `::before`, `.ds-grain` owns `::after`.

### `tier.ts` (42 lines) — T0/T1/T2
`detectChromeTier()` (15): WebGPU + fine pointer → t2; WebGPU mobile or WebGL2 → t1; else t0. SSR default t1. Stamped pre-hydration on `<html data-ds-tier>` by `DS_TIER_BOOT_SCRIPT` (41) injected at `layout.tsx:57`. materials.css consumption: t0 → opaque panels, no backdrop-filter, grain hidden (382-393); t1 → `--heavy` frost downgraded (394-397); t2 + `@supports(backdrop-filter:url(#ds-refract))` → `.ds-glass--refract` = `url('#ds-refract') saturate(155%) brightness(1.07)` (401-406). Backdrop-filter never animated. This ladder is the switchboard for CSS-look vs rendered-surface.

### `RefractionDefs.tsx` (77 lines)
0×0 SVG filter `#ds-refract`: feGaussianBlur(0.022) → feImage 128×128 data-URI displacement map (X-red/Y-green ramps, neutral center, rim-only radial mask) → feDisplacementMap scale 0.16. Chromium-only. Mounted once at `page.tsx:627`. ≤3 refract surfaces per viewport. First candidate for true GPU refraction replacement.

### `use-tilt.ts` (82 lines)
rAF pointer tilt ≤3° for chrome cards. HARD RULE (9-12, 79): never on a SharedViewport ancestor — the rig scissors to axis-aligned rects.

---

## 1. Overlays (`src/components/editor/overlays/`)

All mount in `page.tsx:776-806` as DOM siblings over the single GraphScene WebGPU canvas inside `data-pane="graph"`; hidden in preview-app except SearchPalette/AddNodeDialog (page.tsx:819-820). Ignore `.bak-*` siblings.

### 1.1 CanvasToolbar.tsx (1711 lines)
Gated `viewMode==='canvas'` (619). Five surfaces:

**A. Left dock** (645-726): `absolute z-50 left-3 top-1/2 -translate-y-1/2`, max-h `calc(100vh-7rem)`, `ds-metal ds-grain ds-edge`, scrollable. Brass CANVAS nameplate (655-660); machined V-groove part lines (`GROOVE_H` 237-241; 663-689); **9 group keys** 54×48px (`GROUPS` 140: Transform/Selection/Add/Image/3D Object/Text/Animation/Lighting/Build, all wired) — icon + 9px mono label; active = `activeKeyStyle()` brass-tinted ceramic + keyline + glow (110-115) + brass side bar (704-707).

**B. FlyoutShell** (868-954): 252px (424px Animation), `ds-glass ds-glass--refract ds-edge--brass`, max-h `min(78vh,100vh-7rem)`, `ds-reveal`. Header: brass-soft icon plate, WIRED/COMING status, close key; ice "coming with <subsystem>" callout (934-950). Flyouts:
- **TransformFlyout** (957-1057): SelectionChip well; Edit-handles toggle; Move/Rotate/Scale `ToolButton` grid → `canvasGizmoMode`; `StepperRow` X/Y/Z + S/R (28px machined ± keys, hit-area `::after` extension 297-299, recessed value wells); Align X/Y; Snap/Reset.
- **SelectionFlyout** (1060-1113): count well; Marquee, All-in-Hub; Group/Ungroup (brass); Lock (warn)/Freeze (ice); Clear.
- **BuildFlyout** (1116-1174): status well + glowing state dot (dirty/failed/repaired/built); `ds-btn--primary` Save & Rebuild; Add to System; history key.
- **LightingFlyout** (1177-1383): hub well; light rows (ceramic / brass-active) w/ emitter dot + trash; Add Light + 6-type picker; type `<select>`, native color input, intensity stepper, cast-shadow key; `FaderRow` ds-sliders Shadow Softness (brass) + Env/IBL (ice); receives-light toggle.
- Delegated: `TextToolsFlyout` (text-tools/), `AnimationFlyout` (animation-tools/ — live tile grid over shared rig, driver chips, reused ControlPanel, GSAP + magnetic hover), `AddElementFlyout`, `ImageFlyout`, `ObjectFlyout` (imports 74-78).

**C. KeyframeEditorPanel — the keyframe shell** (1449-1652): `absolute z-40 bottom-0 inset-x-0` slide-up (translateY 110%→0). `ds-ceramic ds-edge` body; metal+grain header strip (1487-1493) with timeline icon, `ds-chip--ice` "CATALOG FORTHCOMING", play/pause + loop keys, 1/60-1/100-1/120 snap segment in a well, close. Scrubber (1557-1604): invisible native range over machined groove + brass fill, 31 ruler ticks, rotated-square **brass playhead jewel**. 3 demo tracks (`TRACKS` 1450-1454) as well lanes with diamond keyframe gems + brass playhead line + per-track `+` key.

**D. MarqueeOverlay** (1655-1710): `absolute inset-0 z-30` crosshair; smoked hint pill; brass selection rect. Commits via `window.__PRISM_EDITOR_MARQUEE_HIT__` against the canvas rect (595-617).

**E. Toast** (854-862) `z-50 top-16` smoked pill; phone scrim `z-40` (635-643).

Inline constants `KEY_BG/KEY_SHADOW/WELL_BG/WELL_SHADOW` (95-100), tokens-only.

Stores: editor store (viewMode, selection set, editorMode, canvasGizmoMode, frozenNodeIds, activeHubId, toggleFreeze), source store (nodes/hubs, setScenePosition, updateNode, group/ungroup, lock, saveToServer, markDirty, raw `setState` for `lightingSpec` at 539), built-snapshot store (371).

### 1.2 TopBar.tsx (228)
`absolute z-30 top-0 h-14` full-width `ds-metal ds-grain ds-edge`, radius 0 (:55). Brass nameplate (61-70), `ds-title-brass` "Prism" + KRIPTIK EDITOR kicker; canvas-only **Scene/Topology** pill trough w/ brass-soft active slot (83-113 → `editorRenderMode`); breadcrumb (116-139). Right: **L0-L4 zoom bars** (24×6px pills, brass active, 148-172) + descriptor; **health pill** (`ds-well` tri-segment ok/warn/danger 96×4px meter + %, 176-193); `+ Add Node` ghost pill, reset-camera, Search ⌘K `ds-btn`s (195-224).

### 1.3 HubNav.tsx (108)
`absolute z-30 bottom-5` (`max-md:bottom-[84px]`) center, `ds-metal ds-grain ds-edge` pill (60-64). Galaxy + per-hub h-9 pill buttons: brass `Pip` (23-41), glyph icon (brass active; raw hub.color banned), name, count. `ACTIVE_SLOT` brass wash + keyline + glow (16-20). `resetCamera`/`flyToHub`.

### 1.4 SearchPalette.tsx (204)
⌘K-gated. Scrim `inset-0 z-50` void α.62 + light frost (84-89). Panel 640px at 14vh: `ds-glass--heavy ds-edge--brass` + elev-4 + brass glow (94-95). `ds-input` header w/ ESC chip; HUBS/NODES sections; selected rows = brass leading rail + keyline + wash (`rowSelectedStyle` 76-80); status dots; footer key-hint kicker bar. `flyToHub`/`flyToNode`+`openInspector`.

### 1.5 DetailCard.tsx (190)
Gate: node selected + Inspector closed (:32). `absolute z-30 right-5 top-20 w-[340px] ds-ceramic ds-edge` elev-3 slide-in (46-48). Ice hairline; kicker hub row; `ds-title`; `Badge` chips (83-94); VERIFICATION `ds-well` meter w/ status glow fill (96-113); ice frozen banner; action rail: Inspect/Edit(ghost)/regenerate/freeze (128-168).

### 1.6 AddNodeDialog.tsx (170)
`fixed inset-0 z-40` smoked frost scrim (74-79); 420px `ds-glass ds-edge` form `ds-reveal` (86); `ds-select` hub, `ds-input` caption textarea + subtype; Cancel quiet / submit `ds-btn--primary` (149-166). Writes `addNode`.

### 1.7 Minimap.tsx (129) — canvas2D, exact draw list
`absolute z-20 bottom-5 right-5`, pointer-events-none. `ds-metal ds-grain ds-edge` bezel (116) → MINIMAP kicker + brass count (118-121) → `ds-well ds-edge` window with **180×140 canvas** (123), dpr-scaled (36-41). 2D ctx (:35) draws per state change:
1. `dsAlpha(DS.void, 0.78)` background (59-60).
2. Hub discs on a squashed ellipse (44-48): r22 circles, brass α.25/ice α.09 fill, brass α.67/ice α.31 1px rims (62-75).
3. Edges: 0.5px `dsAlpha(textHi,0.07)` lines between seeded pseudo-random node points (50-57, 77-86).
4. Node dots r2/3/3.5 (idle/hover/selected), status-colored, brass200 selected (88-101).
5. 6px brass300 selection reticle (103-109).
No text in-canvas (labels are DOM). All DS-mirror colors.

### 1.8 GalaxyFilterOverlay.tsx (100)
Galaxy-only (:32). `absolute top-16 right-3 z-40`, slides to `md:right-[484px]` when inspector open (40-42). `ds-btn` pill (brass-armed ghost + glow, 44-62); 280px `ds-smoked ds-edge` dock (65) w/ `ds-input` + Clear. Writes `filterQuery`.

---

## 2. Panels (`src/components/editor/panels/`)

### 2.1 RightPane.tsx (20)
Hub-only selection → HubInspector, else Inspector (:14-19). Guarantees ≤1 inspector glass (refract budget).

### 2.2 Inspector.tsx (1932)
**Housing** (319-323): `absolute z-40`, mobile `left-16` full-bleed, desktop `md:w-[460px] md:right-3 md:top-3 md:bottom-3`; `ds-glass ds-glass--refract ds-edge--brass ds-elev-4 ds-reveal-r`. **Header plate** (326-457): `ds-metal ds-grain ds-edge` — kicker + elementType, display name + frozen snow icon; build-state `ds-chip` (failed/dirty/repaired/built, 366-369); close; action rail: Edit/Done, Save (`--primary` when dirty), Save & Rebuild (ghost), Clone, Preview in App UI. Save-status well (458-467). **Tab rail** (470-486): 8 `ds-chip` tabs (`TABS` 44-53: Visual/Material/Behavior/Code/Animation/Links/Backend/History; World prepends for root, 59-62). Frozen banner (488-493).

Tabs: **VisualTab** (513-629) — live VisualPreview sub-canvas; ELEMENT IMAGE `ds-well ds-edge` 16:10 frame (captured atlas crop via `useElementImageStore` or gradient placeholder); frame `ds-slider` (576-582); SpecRow wells with 2 ColorPickers; text-content wells. **BehaviorTab** (646), **CodeTab** (682, live GSAP codegen). **AnimationTab** (787-1326): play/stop keys; `ds-well` radial-vignette **animation stage** transforming the captured element (934-971) + LIVE/PLAYING chips; timeline groove + gradient playhead (973-989); 48px keyframe thumb strip, brass-active (991-1014); `ds-ceramic` property card with 5 `PropSlider`s (Scale/Opacity/Rotation/X/Y, 1027-1031) + glow ColorPicker; coordinate-space + trigger radio chip groups (1044-1100); save-as-keyframe → `usePreviewStateStore` (887-898); `AnimationLibrarySection` (1208). **ConnectionsTab** (1329), **BackendTab** (1410), **HistoryTab** (1795), **WorldInspectorPanel/WorldTab/CapabilitiesPanel** (1482/1562/1686), **GroupInspector** (1840+, same glass minus refract).

Stores: editor, source, `usePreviewStateStore` (FP-15 buffer; dirty detection :102), `useBuiltSnapshotStore` (:252), `useElementImageStore`, `useAnimationEditsStore`; `window.__prism.highlightNode` bridge (206-237).

### 2.3 HubInspector.tsx (334)
Same refract housing (:47); metal header (50-67); 6 chip tabs (15-22); all content from well/kicker rows: layout grid, breakpoints, global-binding chips, manifest trough + build-command wells (225-243), animated-node rows, `ds-lift` node link buttons.

### 2.4 MaterialTab.tsx (157)
Schema-driven `MATERIAL_CONTROL_SCHEMA` on one `ds-ceramic ds-edge` plate (86): knob/fader → `ds-slider` (101-113), color → native picker in well (114-125); brass tabular readouts; receivesLighting `ds-toggle` (137-154). Writes only `usePreviewStateStore.set` (64-76). Same widget vocabulary as catalog ControlPanel (INV-5).

### 2.5 ColorPicker.tsx (227)
Well-framed swatch trigger w/ Radix open-state brass ring (104-130); portal popover `z-50` `ds-glass--heavy ds-edge w-64` (137); checkerboard preview well; 4 custom sliders (Hue/Sat/Lum/Alpha, 164-167) — literal color-science tracks, machined groove, **brass radial thumb div** (216-223), invisible native range; hex `ds-input`.

### 2.6 visual-preview/VisualPreview.tsx (354)
**Second R3F `<Canvas>`** inside the Inspector (264-282): async gl factory → `three/webgpu` WebGPURenderer (init awaited) or null → WebGL2 fallback (87-104). 16:10 `DS.ink` well; mounts node via synchronous `createNode` + `userData.cleanup` (114-175); sliders mutate transforms in place; renderer-tag chip (283-288). Below: **unstyled native range fieldsets** (295-329 — visually off-system) + literal-brass "Save & Verify" (333-345) hitting the legacy regen API (the NE-SC-14 second path). A third GPU context beside GraphScene + shared rig — consolidation target.

---

## 3. Animation catalog (`src/components/editor/animation-catalog/`) — shared canvas rig

### 3.1 shared-tile-renderer.ts (`sharedRig` singleton)
ONE persistent WebGPURenderer (WebGL2 fallback) bound to ONE canvas for page lifetime (`acquire()` idempotent). Frame loop (~500-550): `autoClear=false`, `alpha:true` (133, 141); clear whole buffer transparent once (`setScissorTest(false); setClearColor(0x000000,0); clear()` 508-511); per tile: `getBoundingClientRect`, cull off-screen, `setViewport/setScissor` **CSS-px top-left values passed straight through** (WebGPURenderer normalizes origin + dpr, 528-539), clear to `TILE_BG #06070d`, `render(tile.scene, tile.camera)` (540-546). Per-tile Scene+PerspectiveCamera; shared PMREM RoomEnvironment; glass-category emissive bokeh backdrops (brass/ice); pointer/scroll stimulus overrides; MSDF atlas injection; dpr≤2.

### 3.2 SharedCanvas.tsx (35)
Catalog mount: `<canvas data-component="shared-rig-canvas">` `fixed inset-0 z-0 pointer-events-none` — **behind** the DOM; transparent DOM holes reveal scissored tiles. Never disposed.

### 3.3 SharedViewport.tsx (81)
Transparent DOM window registering with `sharedRig.register({element, def, params, getPlaying, frozenPhase, onInstance})`; `rebuild()` on def change.

### 3.4 PrimitiveTile.tsx (101)
`ds-lift` button (tilt forbidden); `ds-edge`/`--brass` selected ring + glow; transparent 4:3 viewport; **shadow-only bezel vignette** (63-70, no fill over GPU frame); `--ds-grad-ceramic` caption plate + difficulty chip. Hover/focus = play.

### 3.5 ControlPanel.tsx (96)
The ONE schema renderer (INV-5): `ds-slider`/`ds-select`/`ds-toggle`/color-in-well; brass readouts. Reused by AnimationFlyout and mirrored by MaterialTab.

### 3.6 CatalogGallery.tsx (195)
Route `src/app/animation-catalog/page.tsx`. SharedCanvas behind; content z-1; sticky `ds-glass` header (only backdrop surface — never overlaps previews); engraved category rules; 150px auto-fill grid; detail rail (324px sticky) — ceramic title plate, brass-bezel transparent detail window (151-170), Play/Pause ghost btn, ceramic ControlPanel plate. Rule (14-18): **no fill/backdrop-filter over a preview rect**.

### 3.7 Second rig mount — `animation-tools/flyout-rig.ts`
Body-mounted page-lifetime canvas (`data-component="animation-flyout-rig-canvas"`): `fixed inset-0`, **z-60, above the flyout glass**, pointer-events none, **per-frame `clip-path`** to the flyout content rect (`setRigClip`; hidden = `inset(0 0 100% 0)`). Rationale (8-27): glass backdrop-filter would paint over transparent windows if behind. So both compositing strategies exist: **canvas-behind-DOM-holes** (catalog) and **canvas-above-DOM-clipped** (flyout).

---

## 4. Boot / loading surface

`src/app/page.tsx:40-132` — GraphScene `dynamic()` loading component: full-viewport `bg-ds-void`; brass-TL/ice-BR ambient radials (61-67); 64px graphite track ring + chamfer; brass sweep arc (spin 1.1s + glow); counter-rotating ice arc; brass radial hub cap; 176×8px `ds-well` boot rail with brass indicator (scoped `@keyframes ds-boot-rail` translateX, reduced-motion aware, 51-59); `ds-smoked ds-edge` pill "INITIALIZING PRISM RUNTIME" (ice glow kicker). Secondary: drei `<Html>` "Warming renderer fonts" pill at GraphScene.tsx:2908-2912 (DOM text over canvas — migration item).

---

## 5. Mode toggle / HUD (page.tsx)

- **Desktop view-mode toggle** (648-697): `absolute top-2 center z-40`; `ds-metal ds-grain ds-edge` pill; sliding `ds-edge--brass` brass-soft thumb (translateX idx×96px, spring); 3× 96×36px buttons `galaxy|canvas|preview-app`, `::after` hit extension, brass text glow.
- **MobileModeToggle** (838-917): `fixed bottom safe-area z-40`; same materials; GSAP thumb (`back.out(1.5)`; `gsap.set` reduced-motion); 88px slots, 44px height.
- **Preview-app HUD**: `PreviewAppWorldBadge` (925-984) — metal nameplate top-right z-40, brass "World" kicker + smoked ice value strip, 500ms poll of `__PRISM_EDITOR_PREVIEW_APP_NAV__.world`; **preview-app nav** (712-767) — `ds-glass ds-edge` pill bottom-center z-40, Prev/Next + smoked hub-id readout.
- Canvas-mode Scene/Topology sub-toggle in TopBar (82-114).

---

## 6. canvas2D sites (MSDF migration list)

| # | Site | Draws | Consumer |
|---|---|---|---|
| 1 | `overlays/Minimap.tsx:35` | radar shapes only (void fill, hub discs, edges, status dots, brass reticle) — no text | DOM canvas in metal bezel (chrome proper) |
| 2 | `graph/HubLabels.tsx:28` | **Text**: 1024×256, `bold 96px Inter` `fillText` hub title (shadow color pass + bone pass) → CanvasTexture → Sprite 40×10 units above hubs | 3D labels — direct MSDF target |
| 3 | `graph/GraphScene.tsx:136` | hub mockup image letterboxed onto ≤1024² over `DS.ink` → CanvasTexture on hub hulls (cache 120-153) | 3D, no text |
| 4 | `src/lib/nodeTexture.ts:22` | **Heavy text**: 2048×1024 sphere texture — `fillText` node name (34-56px), elementType, status meter labels, backend-contract text, "◯ CLIENT ONLY"/"◇ STATELESS" (lines 158-366), roundRects/gradients, or captured-image compositing → CanvasTexture for galaxy spheres | largest MSDF surface |
| 5 | `src/lib/editor/populate-element-images.ts:74` | atlas-region crops → dataURL PNGs → `useElementImageStore` | `<img>` previews in Inspector; no text |
| 6 | `editor/text-fills/procedural-fills.ts:347` | `bakeTile` putImageData pigment tiles → dataURL swatches | TextToolsFlyout fills; no text |

Adjacent DOM-text-over-canvas implicated: `NodeLabels` (GraphScene.tsx:1091, projected drei `<Html>` LOD labels), font-warmup `<Html>` pill (:2908), and the SVG `Icon` system (`icons/Icon.tsx`, ~40 authored 24×24 paths used by every surface).

---

## 7(a). Surfaces ranked by visual prominence

| Rank | Surface | Anchor | Geometry / z | Materials today | Existing GPU |
|---|---|---|---|---|---|
| 1 | Inspector / HubInspector / GroupInspector | Inspector.tsx:319, HubInspector.tsx:47, Inspector.tsx:1840 | right 460px full-height, z-40 | refract hero glass + metal header + ceramic/well content, chip rail, ds-sliders | VisualPreview's own R3F WebGPU canvas |
| 2 | CanvasToolbar dock + flyout | CanvasToolbar.tsx:645/868 | left rail + 252/424px flyout, z-50 (scrim z-40) | metal+grain dock, refract glass flyout, machined keys/steppers/faders | Animation flyout windows into shared rig (body canvas z-60) |
| 3 | TopBar | TopBar.tsx:53 | full-width ×56px, z-30 | metal+grain+edge, brass nameplate, wells, LOD bars | none |
| 4 | KeyframeEditorPanel | CanvasToolbar.tsx:1456 | full-width bottom slide-up, z-40 | ceramic body, metal header, well lanes, brass jewels | none |
| 5 | SearchPalette | SearchPalette.tsx:82 | modal 640px, z-50 + frost scrim | heavy glass + brass edge | none |
| 6 | View-mode toggle (+ mobile) | page.tsx:648/838 | top-center / fixed bottom, z-40 | metal pill, sliding brass thumb (GSAP mobile) | none |
| 7 | HubNav | HubNav.tsx:60 | bottom-center rail, z-30 | metal pill, brass slots, pips | none |
| 8 | DetailCard | DetailCard.tsx:46 | right-top 340px, z-30 | ceramic, chips, glowing meter | none |
| 9 | Boot/loading surface | page.tsx:40-132 | full viewport, transient | void+ambient, graphite ring, brass arc, well rail, smoked pill | none |
| 10 | AddNodeDialog | AddNodeDialog.tsx:68 | modal 420px, z-40 | glass form, troughs, brass primary | none |
| 11 | Minimap | Minimap.tsx:114 | bottom-right ~196×190, z-20 | metal bezel + well | canvas2D radar |
| 12 | GalaxyFilterOverlay | GalaxyFilterOverlay.tsx:38 | top-right 280px, z-40 | btn pill + smoked dock | none |
| 13 | Preview-app HUD (nav + badge) | page.tsx:712/958 | bottom-center / top-right, z-40 | glass pill, metal nameplate, smoked readouts | none |
| 14 | Toast / marquee hint / scrim | CanvasToolbar.tsx:854/1694/635 | transient, z-30–50 | smoked pill recipe | none |
| 15 | Animation catalog page | CatalogGallery.tsx:69 | separate route | glass header, ceramic plates, bezel windows | shared WebGPU rig (canvas z-0) |
| 16 | ColorPicker popover | ColorPicker.tsx:133 | Radix portal 256px, z-50 | heavy glass, wells, brass thumbs | none |

## 7(b). Seams for a shared chrome-render layer

1. **Unified GraphScene canvas** — GraphScene.tsx:3086-3097: one R3F `<Canvas gl={createUnifiedRenderer}>` (async WebGPURenderer factory 2997-3026, ACES, soft shadows, `window.__PRISM_RENDERER_BACKEND__` probe). Caveat: Canvas is keyed by `contentKey` ('assembled'|'topology', :3058) and remounts on that flip; whole scene is a `dynamic()` import. A chrome pass inside must survive both.
2. **SharedTileRenderer pattern** — `sharedRig` singleton + its two mount strategies: `SharedCanvas.tsx` (fixed canvas **behind** DOM, z-0, transparent windows) and `flyout-rig.ts` (body-mounted canvas **above** DOM, z-60, pointer-events none, per-frame clip-path, survives React unmounts). flyout-rig is the closest template for a full chrome layer: page-lifetime body canvas + DOM-rect scissored draws + DOM kept as transparent hit-targets. Inherited constraints: axis-aligned rects only (use-tilt.ts:9-12); glass backdrop-filter cannot overlay GPU windows (CatalogGallery.tsx:14-18, flyout-rig.ts:20-23).
3. **VisualPreview's per-panel R3F canvas** (VisualPreview.tsx:264) — third GPU context; fold into the shared rig.
4. **Tier switchboard** — `html[data-ds-tier]` (tier.ts + layout.tsx:57): pre-hydration gate for "t2 = rendered chrome / t1-t0 = CSS fallback"; materials.css already encodes same-geometry-lighter-physics fallbacks.
5. **RefractionDefs mount** (page.tsx:627) — the once-per-page slot a rendered-materials layer replaces along with `.ds-glass--refract`.
6. **Portals**: Radix Popover Portal (ColorPicker.tsx:132) escapes the chrome tree; drei `<Html>` (GraphScene.tsx:2908, NodeLabels) is the in-scene DOM bridge to retire.
7. **Existing window bridges** for canvas↔DOM coordination: `__PRISM_EDITOR_MARQUEE_HIT__` (CanvasToolbar.tsx:598), `__PRISM_EDITOR_SET_VIEW_MODE__`, `__PRISM_DEBUG_STORES__`, `__PRISM_EDITOR_PREVIEW_APP_NAV__`, `__PRISM_EDITOR_GET_NODE_WORLD_POS__` (page.tsx:221-358; GraphScene.tsx:2860-2877).
8. **MSDF pipeline already live**: editor warms the Inter MSDF atlas at GraphScene.tsx:2828-2850 (`/prism-assets/font-inter.msdf.{png,json}` via `getSharedNodeContext().fontAtlas`); the shared rig injects the same atlas — chrome text can reuse this exact path.

## 7(c). State stores chrome reads (`src/stores/`)

| Store | Chrome consumers | Slices |
|---|---|---|
| `useGraphEditorStore` | every surface | `viewMode` (boot default `'preview-app'`, store:252), `editorRenderMode`, `zoomLevel`/`cameraDistance`, `activeHubId`, `selectedNodeId/Ids`, `selectedHubId/Ids`, `hoveredNodeId`, `inspectorOpen/Tab`, `searchOpen/Query`, `filterOpen/Query`, `addNodeDialogOpen`, `frozenNodeIds`, `editorMode`, `canvasGizmoMode`, `draggingNodeId`, `hubRevealAt/DurationMs`, `nodeRebuildVersion`, fly-to/reset-camera signals |
| `useGraphSourceStore` | TopBar, HubNav, Minimap, SearchPalette, DetailCard, Inspectors, CanvasToolbar + flyouts, AddNodeDialog, page compile | `hubs/nodes/edges/rootNodes`, `isDirty`, `savedAt`; actions `setScenePosition`, `updateNode`, `addNode`, `cloneNode`, `groupNodes/ungroupNodes`, `setNodeLocked`, `saveToServer`, `markDirty`; toolbar writes `lightingSpec` via raw `setState` (CanvasToolbar.tsx:539) |
| `usePreviewStateStore` | Inspector dirty detection (:102), MaterialTab writes, AnimationTab keyframe capture | `patches[nodeId]`, `set`, `peek` (FP-15 buffer → `commitPreviewToSource`) |
| `useBuiltSnapshotStore` | Inspector build badge (:252), Build flyout (CanvasToolbar.tsx:371) | `snapshots[nodeId]` (status/buildCount/hash/repairStrategy) |
| `useElementImageStore` | Inspector Visual/Animation previews | `images[nodeId]` (written by populate-element-images.ts) |
| `useAnimationEditsStore` | Inspector Animation/Code/Visual tabs | `edits[nodeId]` (frames, colors, coordinateSpace, trigger) |

Non-zustand state chrome reads: `window.__PRISM_EDITOR_PREVIEW_APP_NAV__` (world-badge poll), `window.__prism` highlight bridge, and the `data-ds-tier` html attribute.