# TEXT SYSTEM (P1) — wave progress

Part of the Canvas completion run (see `CANVAS-COMPLETION-PROGRESS.md`). Branch `prism-editor-build`.

## Wave 0+1 (prior session, landed in SAFETY-CKPT 37b3d1d)
- Frozen contract `src/lib/prism/text/contract.ts`; msdf-layout (pure, kerning-aware); msdf-material (TSL: median-of-RGB MSDF coverage × fwidth AA, live property surface, aBlockUv fills); text-object (per-glyph/word/line unit meshes named `glyph-<i>`).
- Font registry + 1,935-family Google Fonts manifest; server atlas-gen + `/api/prism/fonts{,/atlas}` with `.prism-font-cache/` disk cache + `x-prism-font-cache: hit|miss` header; 6 core atlases baked (Inter, Bebas Neue, JetBrains Mono, Lora, Playfair Display, Space Grotesk).
- Catalog rig real-glyph injection (`setTextSubjectAtlas` + shared-tile-renderer); procedural text-fills; `TextSpec`/`TEXT_SPEC_DEFAULT`/`PrismNode.textSpec` (additive); 40 tests.

## Wave 2 (this session, workflow wf_9a05073c-f2f — 3 parallel agents)
- **A (scene/runtime):** RenderMode += `'text'`; default-factory text branch (sync-first peek → async atlas resolve, `userData.textHandle`, cleanup never touches the shared atlas); `buildTextNode()` helper (§7.6 self-caption); `text-atlas.ts` registry seam; codegen prompts exhaustive-switch case; 10 factory tests.
- **B (toolbar UI):** Text group `wired:true` + `TextToolsFlyout` (Add Text, content, font picker over the full manifest w/ bake state, size/weight/spacing/align/decompose/opacity faders, FillEditor solid|gradient|texture|ai-texture w/ 5 procedural swatches + generate-more + honest unwired-cloud note, outline/glow/shadow, 7 preset chips, text-animation picker surface). FP-15 routing via usePreviewStateStore. 13 helper tests.
- **C (server/tests):** `src/server/text-fill/generate.ts` flagged hook (`{wired:false}`) + `/api/prism/text-fill` route; 21 tests (hook/route matrix + textSpec round-trip through the real persist payload shape).

## Integration fixes (post-wave, this session)
1. GraphScene `AssembledSceneNode`: live textSpec → `textHandle.setSpec()` effect (criterion 26 instant restyle; atlas re-resolve on font change with cancellation).
2. `node-content-hash.ts`: `textSpec` added to the build-relevant projection.
3. `verify-built-node.ts`: `'text'` is an async-artifact mode (cold-atlas build no longer mis-repaired to a plane).
4. `next.config.mjs`: `serverExternalPackages: ['msdf-bmfont-xml']` — webpack-bundled native msdfgen binary path broke the on-demand bake (502 → fixed, criterion 27 server path live).
5. Hue fidelity: `lit?: boolean` on msdf-material/createTextObject; factory passes `resolveReceivesLighting(node)` (text default UNLIT per §10) → pigment via emissiveNode, zero lit response. Root cause: editor's night-HDRI env tinted every lit fill blue (0% warm pixels measured → fixed, gradient measured warm).
6. Fill-texture plumbing: `resolveFillTexture` opt threaded contract→text-object→factory (`ctx.textureLoader`); texture/ai-texture fills actually pour pigment now (was falling back to solid).
7. Material diagnostics: `userData.msdf{FillKind,HasFillTexture,Lit}` for harness assertions.

## Verification (evidence under `notes/verification/text-system/`)
- `results.json` — criterion-26 structural drive ALL PASS (real-GPU Chrome): Add Text → 4 real glyph meshes; re-font to non-core in-place (same Group uuid, 387–690ms incl. live server bake); resize instant in-place; 0 image-artifact requests; 7 sibling nodes' identity stable; movable via Transform steppers; console/network clean.
- `crit27-fonts-list.txt` + `crit27-cache-proof.txt` — 1,935 families; Abel: miss→bake(1.13s)→hit(6ms); PNG + JSON served; disk cache on.
- Frames 01–15: canvas mode, flyout, node added, re-font, resized, moved, default/gradient/glow/AI-fill close-ups, http+data-URL bisects.
- `before-after/` — wave-text + scramble tiles: proxy slabs (7f93d56) vs real "PRISM" letterforms (fresh).
- Targeted 8-text-tile catalog run: 8/8 pass, deviceLost 0. Full 312 `--no-resume` run: see CANVAS-COMPLETION-PROGRESS for the result line.
- tsc gate: 10 baseline / 0 new at every step. Vitest: tests/text 105 green wave-total; full suite 2323 pass / 21 pre-existing fails (verified identical at clean HEAD; P5 punch-list).

## Honest flags
- Cloud generation endpoint intentionally inert (`{wired:false}`) — swatches are deterministic local procedural bakes labeled as such in the UI (contract: the masking path is real; endpoint is the one remaining hook).
- Glow preset stacks additively over fills: a high-intensity glow can wash out texture pigment until the user lowers it (user-controlled stacking; capture script reordered, documented).
- Text-animation picker is surface-only (binding = P2 by phase design). Full hover-play preset gallery (§7.5) backlog — 7 static chips shipped.
- Galaxy/topology view shows text nodes as intent-stage spheres (codeRef:'' has no artifact data) — consistent with stage-0 nodes.
- Cold-atlas deferred mount can miss preview edits made during the first resolve window (next edit re-syncs).
