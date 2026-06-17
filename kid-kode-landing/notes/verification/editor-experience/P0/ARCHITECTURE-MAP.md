# P0 — Editor-Experience Architecture Map (authoritative)

Produced 2026-06-17 by a 6-mapper parallel workflow (read-only, file:line-cited).
This is the reference downstream phases read INSTEAD of re-mapping. Every claim
below carries a `file:line` from the mappers' evidence. Model: claude-opus-4-8.

> **How to read:** each phase section lists (a) what already works correctly,
> (b) the concrete defects/divergences with evidence, (c) the fix direction.
> "Divergence" = visual diverges from node schema/built-state (breaks the
> NODE-REALIZATION mental model). The canonical model: **the graph/schema IS the
> runtime; preview-app shows BUILT state only (INV-R6, canvas-spec §6).**

---

## P1 — PERSISTENCE & BUILD INTEGRITY (the keystone)

**The 3-layer model is REAL and mostly correct:**
- `usePreviewStateStore` = ephemeral per-node STAGING overlay (`Partial<PrismNode>` patches, in-memory only). `composeNodeWithPreview(node, patch)` = pure source⊕overlay merge.
- `useGraphSourceStore` = durable schema graph + 1s debounced autosave → `/api/prism/regen`.
- `useBuiltSnapshotStore` = content-hash builtSnapshot registry (built|repaired|failed) + `window.__prismBuiltSnapshots` bridge.
- **Save** = `commitPreviewToSource` (preview-commit.ts:36-47): pull patch → `updateNode` → `markNodeDirty(true)`. (FP-15-legal indirection.)
- **Build** = `rebuildNode` (rebuild-node.ts:34-68): Save + content-hash gate (RT-SC-09) + `evictArtifactCacheEntry` (runs `userData.cleanup()`) + `bumpNodeRebuildVersion` → keyed `AssembledSceneNode` remount re-invokes real synchronous `createNode` for exactly that node; siblings' Object3D refs stable (INV-R8). **Faithful.**
- Renderer reads source⊕overlay at GraphScene.tsx:2634-2637.

**DIVERGENCES (the C5/C8 bug, concretely):**
1. **(A) Orphan-store divergence — `useAnimationEditsStore`.** Visual-tab color pickers `setPrimary/setSecondary` (Inspector.tsx:713,722) and Animation-tab frame faders `setFrame` (Inspector.tsx:988, sliders 1148-1161) write to `useAnimationEditsStore`, which **no persistence/overlay/rebuild path ever reads** (sole consumer = Inspector.tsx). Pure local UI state, decoupled from the node. Only the separate "Save as keyframe" button (Inspector.tsx:1008-1019) reaches the overlay. **Fix:** re-route these through `usePreviewStateStore.set` so they become source⊕overlay-visible, commit on Save, and invalidate the content hash. (Decide the schema home for frame-fader shape first — `node-content-hash.ts` projection must cover the target field.)
2. **(B) In-place setSpec divergence — the keystone C5.** GraphScene.tsx:2773-2895: four effects find `userData.textHandle/imageHandle/meshPrimitiveHandle` and call `handle.setSpec()` on the LIVE mounted Object3D ("NO rebuild"). Because preview-app is a STATE of the same unified scene (same mounted objects), **a staged-but-unbuilt spec edit is visible in preview-app** → violates C5 ("edit → does NOT move in Preview until Build") and canvas-spec §6 / INV-R6. **Fix direction:** gate the live overlay (`composeNodeWithPreview`) AND the in-place `setSpec` effects to **canvas authoring only**; in **preview-app** render committed+BUILT state only (ignore the preview overlay; on preview-app entry, the mounted object must reflect the built snapshot, not a staged setSpec). This is the single highest-value P1 fix (also closes NE-SC-13 "a failing edit is not previewable").
3. **(C) Transform auto-apply.** Gizmo `onObjectChange` (GraphScene.tsx:2594) + CanvasToolbar nudge/scale/rotate (CanvasToolbar.tsx:559,584) write `scenePosition` **directly to source on every drag frame** → autosaves within ~1s, no staging, no Build. The mapper notes this is *narrowly* node-realization-compliant (scenePosition is the legit authoring field, renderer reads it live, no rebuild needed for pose). **But D-DRAG (locked decision) wants drag to show a GHOST/PENDING preview with persistence + canonical position waiting for Save+Build.** So transforms SHOULD stage too (C22). Reconcile to ONE discipline.

**Other P1 facts:**
- `ArtifactNode` useMemo deps = `[nodeId, codeRef, layout]` (ArtifactNode.tsx:312), NOT content hash → a committed non-codeRef edit doesn't auto-re-realize without the explicit `rebuildNode` version bump (intentional per INV-R6; surfaced as the "Dirty — rebuild" badge Inspector.tsx:414).
- Per-node `node.dirty` exists (useGraphSourceStore.ts:300-311), editor-transient, stripped from persist payload.
- **C6 Discard is DEAD** — `usePreviewStateStore.discard/discardAll` have ZERO UI callers. The staging contract's revert half is unimplemented.
- Overlay never schedules autosave (good — staged edits can't silently persist); but transform direct-writes DO (the residual auto-apply-to-disk path).
- Runtime `mount.ts` reads the baked `.prism`, NOT the editor stores — separate from the editor edit loop.

**Cross-cut (unmet canonical criteria that P1 closes):** NE-SC-13 (single verifying edit→save→build→preview path; failing edit not previewable→caption repair), NE-SC-14 (exactly ONE edit/save/build path — retire the legacy `VisualPreview` regen-api.ts second path, FP-NE-5), RT-SC-06 (Build pop-transition sphere→position→artifact). RT-SC-10/RT-SC-11 appear already satisfied (page.tsx mounts only `GraphScene`; default boot viewMode = `preview-app`, store line 354) — the `unmet-criteria.json` description of RT-SC-10 is stale; CONFIRM in running app during P1 verify.

---

## P2 — INSPECTOR↔CANVAS COUPLING + CHROME MATERIAL

**C9 coupling CONFIRMED (architecture inversion):**
- `ColorPicker.tsx`, `MaterialTab.tsx`, `VisualPreview.tsx` each have **exactly one importer: Inspector.tsx**. The canvas-editable categories (primary/secondary color, MeshPhysical material §11, visual-spec sliders) are physically trapped in the node-editor panel. Toolbar `ObjectFlyout` (ObjectFlyout.tsx:299-301) DELEGATES material editing back via `openInspector('material')`. **Remove/relocate Inspector → canvas color/material/visual editing breaks.** Transform editing survives (gizmo reads store `editorMode`, independent of Inspector).
- **Fix:** extract these into shared editors mounted by BOTH the CanvasToolbar flyouts and the Inspector (cut the `openInspector('material')` seam first). Add a single-importer guard test.
- Animation is split-ownership: Inspector AnimationTab (keyframe editor + orphan store) vs toolbar AnimationFlyout/KeyframeEditorPanel — reconcile to one source.

**C10 toolbar:** `CanvasToolbar` is STATIC/DOCKED left (CanvasToolbar.tsx:759), **not floating, not drag-repositionable**; the dock does **not** animate expand/collapse (only per-group flyouts toggle with a one-shot reveal). No drag scaffold exists on the dock. Inspector right-rail (484px, z-40) CAN occlude right-side elements; no auto-reposition away from the element under edit.

**C11/C12 chrome material — the refraction-glass system = `chrome-layer` (REUSE, don't reinvent):**
- Entry point: **`useChromeSlab(options)`** (useChromeSlab.ts:34) → attach `ref` to any DOM element. Registers in a window-singleton registry; the in-canvas `ChromeSlabLayer` (mounted inside the ONE GraphScene canvas) draws the real SDF slab behind the DOM and CSS `.ds-slab-hosted` suppresses the DOM surface.
- Options (registry.ts:20): `material: 'glass'|'metal'|'ceramic'|'well'`, `radius`, `borderPx`, `accent:0..1`, `frost:0..1` (glass), `brushAxis:'x'|'y'` (metal), `order` (draw sort). **Anything else is silently dropped.**
- Glass is REAL live-scene refraction (material.ts:343): `viewportMipTexture` 3-tap chromatic split along SDF gradient + Beer-Lambert smoke + lit glass-body floor + IBL via `pmremTexture`. `MeshPhysicalNodeMaterial`, bevel normals, clearcoat. Covers ~25 surfaces today.
- Instanced, capacity **64 per family** (opaque+glass), camera-parented plane at `CHROME_DISTANCE=2.0`, depthTest off, renderOrder 9000/9100. (No growth path beyond 64 — watch capacity if adding many slabs.)

**DIVERGENCES / forbidden aesthetics (P2/P10):**
- **"true-3D brass hero" DOES NOT EXIST** (TopBar.tsx:54-61 passes `hero/heroStyle/heroDepthPx` that the chrome-layer never reads → Add Node renders as a FLAT metal slab; `createHeroMaterial`/`heroPool` don't exist). **Fix:** EXTEND chrome-layer — add `hero*` to `ChromeSlabOptions` + a true-3D path in `ChromeSlabLayer` (per-hero extruded `RoundedBoxGeometry`/`ExtrudeGeometry` — reuse `IconPrimitives.makeIconGeometry` pattern + the existing accented-brass face material material.ts:262-330 + the pointer PointLight + cursor-tracked tilt). Once added, TopBar already passes the right options.
- **Forbidden `backdrop-filter` glassmorphism remains:** `HolographicDetailCard.tsx:158` (blur 20px) and `PrismHost.tsx:418` (blur 20px + single drop-shadow). Migrate both to `useChromeSlab({material:'glass'})`.
- **Double-refraction coupling risk:** surfaces carrying BOTH the GPU slab AND `.ds-glass--refract` SVG filter (Inspector, HubInspector, CanvasToolbar flyout, FunctionBindingPopup). `.ds-slab-hosted` suppresses background/backdrop but NOT the separate SVG filter — decide whether to drop `ds-glass--refract` on slab-hosted surfaces.

---

## P3 — IDENTITY (icons / logo / typography)

- **No third-party icon lib** (zero lucide/feather/heroicons/etc. in package.json). All chrome icons = `Icon.tsx` PATHS dict (Icon.tsx:7-57, 50+ hand-authored 24×24 paths, composited into a faux-extruded "milled solid"). **De-slop = re-author path strings, not swap a library.** Most-used: chevron×17, close×15, check×13, refresh×11, sparkle×10, plus×9.
- **Logo / "Lucide-style gold star" = `Icon name="sparkle"`** (4-point star, Icon.tsx:20) inside a brass nameplate in TopBar.tsx:84-100 (no dedicated logo component). The favicon `src/app/icon.svg:22` is a proper **brass-prism-refracting-a-beam** mark — the stronger identity. **Fix:** make the TopBar mark a real prism glyph matching the favicon (add a `prism` PATHS entry or a `PrismLogo` component). Editing `sparkle` updates all 10 uses atomically.
- **Flat lightning-bolt = `zap`** (Icon.tsx:26), used in NodeEditorPromptEdit.tsx:35 + PromptEditFlyout.tsx:44. No emoji glyphs anywhere in live JSX. **Fix:** re-author `zap` to a less-generic energy mark.
- **UI font = Switzer** (layout.tsx:22-35, self-hosted woff2 via `next/font/local`, → `--font-display`/`--font-ui`; JetBrains Mono = mono). Swap by replacing the woff2 src in layout.tsx:23,30; tokens.css consumes the next/font vars so no value change needed.
- **Scene MSDF text = Inter** (separate pipeline; TEXT_SPEC_DEFAULT.fontFamily='Inter' types.ts:416; atlas from Inter-Variable.ttf). Changing it = schema change + `npm run build:msdf` + node rebuild. **Decoupled from chrome typography.**
- **OKLCH Observatory-Brass tokens (KEEP, FROZEN):** tokens.css:16-69 (oklch source of truth) + tokens.ts (exact sRGB hex mirror, lockstep). Only the TYPE tokens (tokens.css:173-205) are in P3 scope.

---

## P4 — DRAG / GIZMO

- **C17 CONFIRMED:** gizmo (drei `<TransformControls>`, "CanvasTransformGizmo" GraphScene.tsx:2427-2600) only mounts when `editorMode==='edit'` (early return 2534); every selection action resets `editorMode:'idle'` (useGraphEditorStore.ts:437-575) → user MUST click "Edit Handles" (CanvasToolbar.tsx:1180-1194) first. Spec §5 line 116 / SC-9 line 391 require no such ritual. **Fix:** arm gizmo on selection (drop the `editorMode==='edit'` gate at 2463/2534); keep the scenePosition write path (compliant). Toolbar Move/Rotate/Scale already auto-`ensureEdit()`.
- Gizmo IS a real translate/rotate/scale control (axis X/Y/Z + plane handles, mode via g/r/s keys), **but NO `translationSnap`/`rotationSnap`, NO world/local `space` toggle, NO axis-show config**. Toolbar "Snap On/Off" is **decorative** (local React state CanvasToolbar.tsx:472, never reaches the gizmo). Spec §5 line 116 requires snap.
- **Camera fights gizmo:** neither CameraControls sets `makeDefault` (GraphScene.tsx:1690,2071) → drei TransformControls can't read `state.controls` to auto-suspend the camera during drag. Drag handlers are mouse-named. **Fix:** add `makeDefault` to the canvas CameraControls (fixes orbit/touch fight); then wire snapping (lift `snap` into the store, pass `translationSnap`/`rotationSnap`).
- No ghost/pending drag preview (D-DRAG/C22) — drag writes scenePosition live. Add ghost if D-DRAG is enforced.

---

## P5 — TEXT AUTHORING + VISUAL BUGS

- **C23:** text content = `<textarea rows={2}>` in a 252px flyout (TextToolsFlyout.tsx:245) — half-visible for multi-line headlines. No on-canvas double-click inline editing. **Fix:** auto-grow textarea and/or on-canvas inline edit.
- **C24:** AI texture/material prompt is buried 3 nav steps deep (Text flyout → Fill section → 'AI' chip; FillEditor.tsx:200-207, terse 1-letter label). **Fix:** promote/label it (header affordance "Generate fill from a prompt").
- **C25 ghost subtitle ROOT FOUND:** `orr-arrival-headline` (visual.transform.y=1.32 vs scenePosition.y=0.55) and `orr-arrival-sub` (visual.transform.y=0.82 vs scenePosition.y=1.7) carry conflicting position fields in live-graph.json:334,445. Renderer uses `scenePosition` (sub ABOVE headline) while `visual.transform` encodes the opposite order → overlap/collision. **Fix:** reconcile to `scenePosition` single source, delete/ignore stale `visual.transform`, re-space so the large headline's ascender clears the sub; verify no overlap by screenshot.
- **C28 stray brass square FOUND:** `KeyframeDemo` (GraphScene.tsx:2341-2413) = hardcoded 0.6×0.6 `planeGeometry` brass plane, mounts unconditionally in canvas (3891), NO node backing (no nodeId/schema, unselectable). Violates node-realization. **Fix:** delete/feature-flag the block + its mount.
- Selection = single circular `ringGeometry` (boundingSphere-sized, GraphScene.tsx:3001-3012), no corner handles — poor for wide text. MSDF quality itself is sound (real MSDF, INV-11 clean). **Fix:** tight bounding-box + corner handles.

---

## P6 — 3D BACKGROUND AUTHORING

- `HubBackgroundPicker.tsx` = 5 labeled preset cards (name + tagline) + Clear + 5 live CUSTOMIZE controls (Palette select + Density/Drift/Depth/Glow sliders). **NOT "mystery buttons"** (C29 mostly OK). Lacks per-card thumbnail previews (text-only).
- **C30:** entry BURIED in Hub Inspector Visual tab (HubInspector.tsx:150) — reachable only by selecting a hub. **No Canvas affordance.** Fix: add a CanvasToolbar "Background" section / hub context action.
- **C31:** apply path = `updateHub({background})` (additive schema only); `HubBackgroundStack` reads `hub.background` live every frame → procedural backgrounds need NO separate Build (schema IS built state — correct, not a divergence).
- fal FLUX-2 + depth-anything pipeline = **build-time only, no live caller**; hybrid presets reference pre-baked static PNGs in `public/three-d-bg/`. Live in-editor generation would need wiring the dormant pipeline (keep INV-7: public URLs only).

---

## P7 — EDIT HISTORY (undo/redo + timeline)

- **C32:** NO undo/redo anywhere. No zundo/temporal, no Cmd+Z, no past/future stacks. Both stores use plain `subscribeWithSelector`. Step capacity = 0. **Fix:** wrap `useGraphSourceStore` (schema source-of-truth) with zundo/temporal, patch-based, ≥100 steps; undo must re-fire dirty/autosave AND re-bump `nodeRebuildVersion` so BUILT state re-realizes from reverted schema (else stale build = divergence).
- **C33:** "History" tab (Inspector.tsx:1938) = read-only per-node edit LOG from the orphan store, no timestamps/ordering/jump-to-state. Toolbar "view history" = `onComing('Version history')` stub. **Fix:** real ordered timeline with jump-to-state backed by the temporal store.
- **C34:** undo↔staging interaction is purely hypothetical (no undo today). HubInspector omits the 'history' tab entirely.

---

## CROSS-CUTTING NOTES

- The `useAnimationEditsStore` orphan store is the common root of P1(A) AND P7's read-only history. Fixing P1(A) (route edits through the overlay) and P7 (real temporal store) should retire `useAnimationEditsStore` as the "history" source.
- `VisualPreview`'s "Save & Verify" regen path (its own `regen-api.ts`) is the **second edit/save/build path** flagged by NE-SC-14/FP-NE-5 — retiring it unifies on the overlay→Save→Build path (ties P1 + C9).
- `page.tsx` computes `compiledAppView`/`activeCompiledHubView` but only exposes them via a debug hook (not rendered) — dead-ish since the unified-scene refactor; safe to leave but note for cleanup.

## RECOMMENDED PHASE ORDER (given the map)
P1 (correctness keystone — gate overlay to canvas + route orphan edits + wire Discard + pending UI) → P2 (decouple Inspector/Canvas + hero-button + kill glassmorphism) → P3 (icons/logo/font) → P4 (arm-on-select gizmo + snapping + camera makeDefault) → P5 (kill KeyframeDemo + reconcile headline/sub + surface AI prompt + selection handles) → P6 (Canvas bg entry + thumbnails) → P7 (zundo temporal + timeline) → P8 (declutter/choreography) → P9 (demo app) → P10 (advocate sign-off).
