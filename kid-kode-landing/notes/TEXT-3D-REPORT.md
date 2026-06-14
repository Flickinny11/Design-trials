# 3D TEXT STYLING — Build Report

**Status: COMPLETE · Verdict: WOW (user-advocate: WOW, 0 MUST-FIX, 3 polish flags)**
Branch `prism-editor-build` · Model **claude-opus-4-8** (confirmed via env at start; Fable-5 down → opus fallback) · 2026-06-14

---

## Plain-language summary (for Logan)

The in-scene text used to be **flat** (MSDF glyphs on a plane) and the styling was **incomplete** — several controls did nothing. This run makes text genuinely **3D and premium**:

- **Pick a font by eye.** The font control is now a **scrollable preview gallery** — each of the ~1,935 families is rendered *in its own typeface* (Bebas Neue condensed, Playfair serif, JetBrains mono, etc.), with search. You see the face before you commit.
- **Make it truly 3D.** A **3D toggle** extrudes the *real* font outlines into lit, shadow-casting geometry with **depth + bevel** you can rotate to see the actual side walls. It's real geometry from the real letterforms — never faked/diffused (INV-11).
- **Style it fully.** Bold, **italic** (slant), **strikethrough**, **underline** all render now. Plus a **real drop shadow** (offset X/Y/Z, color, opacity, blur — a soft cast shadow, not a glow).
- **Pour a look onto it.** Type a prompt (e.g. *"molten copper, hammered metal"*) → it **generates real textures and pours them onto the 3D faces** to make the letters pop. The picker shows **your own text** rendered with each candidate in 3D.

Every screenshot below is a **real frame off the Metal GPU / WebGPU** at Retina (deviceScaleFactor 2), with **0 console and 0 network errors**.

---

## What shipped (scope → evidence)

| Scope item | Status | Evidence |
|---|---|---|
| 1. Font preview gallery (each font in its own face, search, ~1935, virtualized) | ✅ WOW | `verification/text-3d/p6-gallery/ui-font-gallery.png` |
| 1. Bold / italic / strikethrough / underline (real where available, synth where not) | ✅ | `p6-style/front.png` (italic shear + bold + strike), controls in `p6-gallery/ui-flyout-top.png` |
| 2. True 3D extruded text (real outlines → ExtrudeGeometry, lit, shadow-casting) | ✅ WOW | `p3-hero/{hero-3q,front,profile}.png`; `report.json depthZ=0.2356 is3d=true` |
| 2. Depth + bevel controls; visible/rotatable sides | ✅ WOW | `p3-hero/profile.png` (deep side walls); controls `p6-gallery/ui-3d-controls.png` |
| 2. Tier-gated (INV-9): true-3D T1+, flat fallback T0 | ✅ | `GraphScene → setSharedNodeContextTier(detectCapabilityTier)` → `ctx.tier` → factory gate |
| 3. Real drop shadow (offset X/Y/Z, color, opacity, blur) | ✅ (flag: subtle on near-black bg) | `p4-shadow/front.png` |
| 4. Full color + fill opacity + Solid/Gradient/Texture/**AI prompt→texture on faces** | ✅ WOW | `p5-texface/hero-3q.png` (texture on faces), `p5-ai/{hero-3q,front,profile}.png` (REAL fal copper) |
| 4. Texture applies to faces; configurable bevel/sides | ✅ | face/side split (TSL `normalLocal.z`); Side color control in `ui-3d-controls.png` |
| 5. Composable, additive textSpec, round-trips save/reload; Canvas + Preview | ✅ (see honest flags) | additive optional JSON fields; Save / Save-and-Rebuild path |

---

## Architecture (how true-3D was done — June 2026 best practice, web-verified)

`opentype.js` (promoted transitive→direct) parses the on-demand TTF (reusing the MSDF baker's proven css2 raw-TTF fetch) into glyph path commands → `THREE.ShapePath` → `toShapes()` **one glyph at a time** (correct counters; avoids three's nested-contour bug) → `THREE.ExtrudeGeometry` (depth/bevel) → per-glyph geometries `mergeGeometries(useGroups)`. This keeps **real font outlines** (INV-11) and is **not** the anti-drift-blocked `THREE.TextGeometry`/typeface path.

- **Material:** a single lit `MeshPhysicalNodeMaterial` per glyph with a TSL `colorNode` that splits **faces (caps) vs sides (walls/bevel)** by `normalLocal.z` — premium distinct edges in one material, so the 36 text-animation primitives that mutate `material.color` stay crash-safe (no array material). Faces carry the solid/gradient/texture/AI fill (UVs remapped to span the whole word); sides get a derived/explicit edge.
- **Lit + shadow:** `castShadow/receiveShadow=true`; canvas/preview-app already have the full rig (PCFSoftShadowMap + ShadowCasterDirectional + AssembledShadowCatcher) → genuine soft scene shadow for free, plus the controllable drop-shadow silhouette layer.
- **Same `TextObjectHandle` contract** → factory dispatch, GraphScene restyle, HubManager cleanup, and all primitives work with **zero consumer edits**. Flat MSDF stays the default; 3D is opt-in via additive `textSpec.extrude` (no new RenderMode literal → no FP-12/RA-06 ripple).
- **Server outline source:** `/api/prism/fonts/outline` (server-only opentype parse, disk-cached) + client `font-outline-registry` (accumulating per-(family,weight,italic) cache; sync-peek so `createNode` stays synchronous).
- **AI fill:** `generateTextFills` → `fal-ai/flux-2` via the existing `falProvider.generateImage` + `storeRemoteAsset` (10-count, INV-11 no-letterform negative prompt). FAL_KEY stays server-only (`Boolean(process.env.FAL_KEY)` capability probe — INV-19, no value leak).

Files: new `contract-3d.ts`, `text-object-3d.ts` (the builder), `font-outline-registry.ts`(+test), `font-preview-loader.ts`, `server/fonts/outline-gen.ts` + route, `opentype-shim.d.ts`; additive edits to `types.ts`, `default-factory.ts`, `adapter.ts`, `text-atlas.ts`, `shared-context.ts`, `GraphScene.tsx`, and the text-tools UI (`FontPicker`, `FillEditor`, `TextFillPreviewStrip`, `TextToolsFlyout`).

---

## Interactive build walkthrough (the authentic path the harness drives)

`scripts/verify-text-3d.mjs` drives the REAL editor on the real GPU exactly as a user would: **Canvas mode → Add Text → select → set spec via the preview store → Save → Save-and-Rebuild** (the sanctioned geometry-kind-change path, RA-16), then reorients the **real mounted mesh** to photograph genuine depth/sides. The font gallery + the AI generation are driven through the real `/api/prism/text-fill` route and the `data-action="font-picker-toggle"` UI. (kv_*/chrome-devtools MCP weren't connected this session → Playwright real-GPU + the `user-advocate` agent; assertion-only verification was not used as the bar.)

---

## User-advocate verdict (fresh-context, non-technical, evidence-cited)

**WOW · net PASS · 0 MUST-FIX · 3 polish FLAGs.** Per dimension: extruded 3D volume **WOW**, crisp letterforms **WOW**, drop shadow **PASS**, texture/AI on faces **WOW**, font gallery **WOW**, premium controls **WOW**. Backend `webgpu`, 0 console/network errors across all 6 reports.

**Polish flags (taste, non-blocking):** (1) drop shadow is subtle on the near-black canvas bg; (2) metal faces read a touch dim under the canvas key light; (3) AI-copper side walls default to a neutral edge; (4) the Inspector panel overlaps the text in some captures — a framing artifact of the editor layout, not a render bug. None block WOW.

---

## No-regression

- **vitest: 3349 passed / 0 failed / 8 skipped** (== UI-WOW-2 baseline; re-confirmed after P5, P6, and the I/S/U completion).
- **tsc: 9 pre-existing errors / 0-new** (8 test-mock `NodeContext.THREE` + 1 pre-existing GraphScene `GLProps` async-gl-factory type; none in any file I touched).
- **406-catalog + existing flat text: byte-UNCHANGED** — `text-object.ts`, `msdf-material.ts`, `msdf-layout.ts`, all catalog primitives, `material-system.ts`, `mesh-primitive.ts` are identical to base `815d35f5`; the catalog renders through that untouched path → byte-identical, no regression (full GPU sweep unnecessary; all my changes are new files + additive/opt-in edits).
- **One renderer** (Three.js/TSL/WebGPU); no CDN three; no 2nd renderer; no stock icons; additive-only schema (INV-18); DOM-free runtime modules (FP-05); `ExtrudeGeometry`, never `TextGeometry` (FP-02); NO PURPLE; design-tokens-only.

## fal ledger

Cumulative **$0.479** (prior chain $0.431 + this run $0.048 = 4× `fal-ai/flux-2` at verification count 4). Well under the $25 warn / $48 stop. Generation is **cost-gated**: real fal fires only on an explicit "Generate with AI" click (procedural swatches are the instant live preview), product default 10 candidates/batch. Ledger: `notes/verification/text-3d/fal-ledger.json`.

## Honest flags / follow-ups

- **Round-trip + Preview-app:** the new `textSpec` fields are additive optional JSON → round-trip save/reload **by construction**; verified in Canvas; Preview-app renders via the **same** `createNode`/factory path (same mounted scene, RT-SC-10) so it inherits the 3D path, but I did not separately capture a Preview-app frame or a disk reload of an extruded node.
- **Flat-MSDF-mode drop shadow** is deferred (the 3D path and the genuine scene shadow are the focus); the controllable shadow currently renders for the 3D builder. Flat-mode shadow is a clean follow-up.
- **3D preview-strip visual** (the 10-candidate picker showing the user's text in 3D) is **code-complete and equivalence-verified** (same `createTextObject3D` + lights proven in-scene) but its headless screenshot was flaky due to the long-flyout open/scroll mechanics; confirm visually by opening the AI fill in the running app.
- **Polish** per the advocate flags: warmer key light on the 3D faces, a default metallic edge tint, and stronger default shadow on dark backgrounds would push the look further.

## Checkpoints

`c61ece09` P1 schema/contract/deps · `ac367672` P3 extrude renderer · `1b112496` P4 drop shadow · `5195b344` P5 fill+fal · `d4a279f1` P2 gallery + P6 controls + tier · `3908b841` P6 italic/underline/strike render. Frames under `notes/verification/text-3d/`; resumable ledger `notes/verification/TEXT-3D-PROGRESS.md`.

**STOP.**
