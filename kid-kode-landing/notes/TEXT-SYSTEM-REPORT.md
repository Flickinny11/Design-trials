# TEXT SYSTEM REPORT — P1 of the Canvas completion run

**Branch:** `prism-editor-build` · **Model:** claude-fable-5 · **Date:** 2026-06-10
**Spec:** PRISM-CANVAS-EDITOR-SPEC.md §7 (Text System), §5 (Text tools), §18 criteria 26–27 (+ the criterion-28 masking path). INV-11 honored throughout: letterforms are ALWAYS real font glyphs; AI/texture pigment pours into the MSDF coverage mask, never the letter shapes.

## What shipped

**Substrate (wave 0–1, landed in 37b3d1d):**
- Frozen contract (`src/lib/prism/text/contract.ts`); pure kerning-aware MSDF layout; TSL unit material (median-of-RGB coverage × fwidth screen-space AA; live color/emissive/emissiveIntensity/opacity surface so all 36 text-animation primitives keep working); `TextObject` with per-glyph/word/line unit meshes named `glyph-<i>` and instant in-place `setSpec`.
- Font system: registry + 1,935-family Google Fonts manifest; 6 pre-baked core atlases; on-demand server bake (`/api/prism/fonts/atlas`) with disk cache + `x-prism-font-cache: hit|miss` proof header.
- Catalog rig binding: `buildSubject('text')` assembles real letterforms ("PRISM") when the atlas is injected — all 36 text primitives animate real glyphs.
- `TextSpec` / `TEXT_SPEC_DEFAULT` / `PrismNode.textSpec` (additive, INV-8).

**Wave 2 (3 parallel agents) + integration:**
- `renderMode: 'text'` (additive union member) + default-factory branch: synchronous createNode, async cold-atlas resolve, `userData.textHandle` for instant restyle, dispose-safe (shared atlas never disposed).
- Text toolbar group wired (Observatory Brass DS only): Add Text, content, searchable 1,935-family font picker (CORE badges, bake-loading state), size/weight/spacing/align/decompose/opacity, fills (solid | gradient | texture | ai-texture), outline/glow/shadow, 7 preset chips, text-animation picker surface. FP-15: all styling writes via `usePreviewStateStore`; only structural Add Text uses `addNode`.
- AI texture-fill: prompt → 5 deterministic procedural swatches (labeled local) + Generate more; cloud endpoint = flagged hook `src/server/text-fill/generate.ts` returning `{wired:false}` + `/api/prism/text-fill` route (per contract; FLUX-family endpoint re-verify at wiring time documented in-file).
- Integration fixes: GraphScene live-restyle effect (criterion 26), content-hash projection += textSpec, verify-built-node treats text as async-populating, `serverExternalPackages` for the native msdfgen binary, hue-fidelity `lit:false` routing (text defaults UNLIT per §10 — the editor's night HDRI was tinting every lit fill blue), fill-texture loader plumbing (texture/ai-texture fills actually pour), material diagnostics for harnesses, legible ink spawn fill + non-occluding spawn placement (advocate MUST-FIX).

## Criteria proof (evidence: `notes/verification/text-system/`)

**Criterion 26 — real MSDF, selectable/movable, instant re-font/resize, no image re-render: PASS.**
`results.json` (real-GPU drive): Add Text → 4 real `glyph-*` unit meshes; re-font Inter→Abril Fatface IN PLACE (same Group uuid) in 387–690ms *including* the live on-demand server bake; resize fontSize 0.4→1.35 in place; **zero** image-artifact network requests during re-font/resize; all 7 sibling nodes' Object3D identity stable; node moved via Transform steppers (scenePosition → world pose). Frames 01–06.

**Criterion 27 — full library + on-demand atlas generation with cache: PASS.**
`crit27-fonts-list.txt`: 1,935 families (6 core). `crit27-cache-proof.txt`: non-core Abel — first request `x-prism-font-cache: miss` (1.13s server bake, valid msdf JSON, 97 chars, distanceRange 4) → second request `hit` (6ms); PNG asset served; `.prism-font-cache/{atlases,ttf}` populated. UI path: picking Abril Fatface in the font picker fired the same miss→bake (results.json `atlasRequests`).

**Criterion 28 masking path (P1 scope = masking real, generation hooked): PASS (masking) / FLAGGED (cloud endpoint).**
`11-ai-fill-swatches.png` ("molten gold" → 5 rich procedural swatches) and `12-ai-fill-applied.png` (lava texture poured into "Molten Brass" letterforms — intra-letter luma stdev 45.2 vs 4.4 for a flat fill, letterform shapes untouched). Bisect frames 13–15 prove the pour path for http URLs, synthetic data URLs, and the actual swatch PNG.

**Text-animation primitives on real glyphs:** `before-after/wave-text-{BEFORE,AFTER}` and `scramble-{BEFORE,AFTER}` — proxy slabs → real "PRISM" letterforms animating per-glyph. Targeted catalog run on 8 text tiles: 8/8 pass, deviceLost 0. (Full-312 result line: CANVAS-COMPLETION-PROGRESS.md.)

## Advocate
First pass: INDIFFERENT/BLOCKED — one MUST-FIX (default spawn nearly invisible: warm-white ~1.48:1 over the light viewport, spawned behind the watch) + 5 flags. Fixed: DS-ink spawn fill (#1d212b, scene-data hex) + lower-band spawn position (0,−0.8,+0.2); results.json error-list contradiction fixed. Re-grade: see CANVAS-COMPLETION-PROGRESS.md log (re-run after the 312 completes freed the GPU).

## Gates
- tsc: 10 baseline / **0 new** at every step.
- vitest: tests/text **105 passing** (40 wave-1 + 65 wave-2/integration); full suite 2323 pass / 21 fail — the 21 verified **pre-existing at clean HEAD** in a throwaway worktree (legacy source-text-assertion tests; P5 punch-list).
- 312-catalog no-regression: **306/312 pass, deviceLost 0** (std=webgl tier + glass=webgpu tier). The 6 fails are exactly the documented pre-existing P5 set (dust-poof, hover-lift, lightning-bolt, pointer-attract-scale, pointer-press, scroll-skew). The gate also CAUGHT one real regression introduced with real-glyph injection — `neon-flicker-text` (and latent in `text-typewriter-cursor`): `instanceof MeshStandardMaterial` material collection silently skips the TSL `MeshStandardNodeMaterial` glyph units → no flicker. Root-cause-fixed with duck-typed emissive-surface checks; re-verified 2/2 solo. Harness note (P5 evidence): the SwiftShader std tier degrades under the auto-tuner's high concurrency (29 passes in the first 78s at low conc, then mass plays/controls timeouts); a capped `--max 3` run was clean — direct support for the punch-list's "concurrency backoff" remedy.

## Logan directive (LOGAN-INBOX, folded in)
AI fill picker upgraded per the live directive: **10 candidates** per batch, each rendered as the **user's actual selected text in real 3D** — `TextFillPreviewStrip.tsx`, one shared WebGPU canvas rendering the node's full effective spec with only the fill swapped per row, gentle perspective sway, transparent overlay buttons preserving the `ai-fill-swatch` test surface. Evidence: `11-ai-fill-swatches.png` (ten "Molten Brass" rows in distinct molten-gold textures inside the flyout), `12-ai-fill-applied.png` (picked texture in the scene).

## Honest flags
1. Cloud generation endpoint intentionally inert (`{wired:false}`, no FAL key in this env) — UI says so inline; swatches are deterministic local procedural bakes.
2. Glow preset stacks additively over fills; a high-intensity glow can wash out texture pigment until lowered (user-controlled; burned two capture rounds before root-causing).
3. Text-animation picker = surface only; durable binding (`animationBindings` → Drivers) is P2 by the run's phase map.
4. Full hover-play preset gallery (§7.5) backlog; 7 static preset chips shipped.
5. Galaxy/topology shows text nodes as intent-stage spheres (no artifact data for codeRef:'') — consistent with stage-0 nodes; revisit if Logan wants glyph previews in galaxy.
6. Cold-atlas deferred mount can miss preview edits made in the first resolve window (next edit re-syncs).
7. Pre-existing vitest debt (21 fails) and the favicon 404 console line are P5 items, untouched here.

## Plain-language summary for Logan
Text in Canvas is real now. You click Add Text and get actual, crisp text in the 3D scene — dark ink so you can read it instantly. The font menu lists ~1,900 Google fonts; pick anything and if we've never used it before the server bakes its atlas in about a second, then it's instant forever (we proved the cache with headers). Restyling is immediate: size, weight, spacing, gradients, outlines, glows, one-click presets — the letters re-render in place without touching any image, and nothing else in the scene rebuilds. The "describe a look" fill works: type "molten gold," click a swatch, and the texture pours INTO the letters — the letter shapes themselves are never AI-drawn, which is the rule that keeps text editable forever. The catalog's 36 text animations (waves, scrambles, typewriters…) now animate real letterforms instead of placeholder blocks. The one piece intentionally left unplugged is the cloud image generator for fills (needs the harness-side endpoint + key); the UI says so honestly and local swatches stand in.
