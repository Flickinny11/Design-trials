# PRISM MOCK-APP — SESSION HANDOFF (2026-04-24)

You are continuing work on the Prism mock-app prototype at `/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing/`, branch `prism-main`. Production deployment auto-deploys to https://kid-kode-ai-landing.vercel.app/ on every push.

Read this whole file before touching anything. The prior session rediscovered hard lessons more than once; the notes below will save you from repeating them.

## What the prototype actually is

An **image-to-UI** system (not image-to-code). A single AI-generated image becomes the UI. The image is preserved pixel-for-pixel; the architecture attaches semantic handles (nodes) to pixel regions. Each region is its own `PIXI.Sprite` tethered to a node, independently animatable, transformable, swappable. The full mockup is rendered as `page-background` at z=0; every other element is a crop of that same mockup positioned exactly over its source region, so at rest the whole page looks unified. On hover/interaction, per-element GSAP effects differentiate each sprite.

This is genuinely a different category than v0/Bolt/Lovable (which reverse-engineer images into CSS and lose the visual richness). Here the richness stays; editability is gained.

**Current live artifact** (as of handoff): 
- Mockup: `notes/mockup-candidates/scifi-mockup-v1.png` (FLUX.2-pro, 1536×2048, sci-fi cosmic crystalline)
- .prism artifactHash: `7310c04872bacf9b6a19fcba08de7e9d96bd8798d712e2804617958cb7106f48`
- Latest production deploy at time of handoff: `dpl_62exFVfJcfB9brrwkgu87zLp3HMX`
- 40 nodes — 18 visible (crystalline nav sigils, portal, artifact cards, counter relic, pedestal), 22 invisible placeholders
- All compliance gates green: verify:prism 15/15, browser-smoke 6/6, live-modes-smoke 8/8

## What you must accomplish this session

### Task 1 — Replace the mock app with a new image

- **Source image**: `kid-kode-landing/Gemini_Generated_Image_2w5g832w5g832w5g.png`
- It's an AI video generator app UI
- It has readable text — every distinct text block must be its own node (separate from its container)
- It has ~4 video elements indicated by play-button overlays — each is a node
- Segment every element, extract each to a crop, tether to a node, build the `.prism`, ship

### Task 2 — Wire the 3D node editor to actually edit the preview pane

- The 3D editor (right pane of Visual Editor mode) already renders. It visualizes the graph in 3D (spheres + edges + camera orbit) but doesn't yet drive the preview pane.
- **DO NOT modify the editor's visual design.** It already has chrome (TopBar, HubNav, Inspector, DetailCard, Minimap, SearchPalette, galaxy/home/dashboard tabs). All of it stays.
- Wire those tabs/panels so they introspect + edit the preview pane's graph at runtime.
- **Must be GENERIC**: the editor edits whatever hub/app is in the preview. Never import this mock-app's specific node IDs. Drive everything from `window.__prism.graph.nodes` at runtime.

### Task 3 (spec enrichment) — Interactive element auto-recognition

Add to `notes/prism-spec-extract.md` (or a sidecar note): when uploaded/generated images contain indicators like play buttons, pause buttons, toggle switches, sliders, etc., the engine should identify them during segmentation (via SAM/Florence phrase grounding or a downstream classifier). After identification, the UI prompts the user: *"These N elements appear to be video players / audio controls / toggles. Do you have content for them, or should the engine generate content from the surrounding image context?"* This becomes a post-segmentation classification + user-prompt step in the provisioning pipeline.

## Architecture facts (non-negotiable — learned the hard way)

### 1. Spec §1.4 forbidden patterns — compliance is mandatory
- ❌ NO `PIXI.Text` anywhere
- ❌ NO `PIXI.Graphics` for visible UI. Mask-only uses are OK IF the call site has an `ALLOWED-GRAPHICS:` comment within 3 lines (the `.claude/hooks/anti-drift-check.sh` hook enforces this on write)
- ❌ NO `innerHTML`, `outerHTML`, `document.write`
- ❌ NO inline `.style.background`, `.style.border`, `.style.boxShadow`, `.style.backgroundImage`
- ❌ NO `fillText` / `strokeText` on 2D canvas contexts
- ❌ NO `html-to-image`
- ✅ Every visible element must have `sourceAsset` pointing to a PNG in `source-images/base/`

### 2. Invisible placeholders for absent nodes
When a mockup doesn't contain every node the graph expects, invisible nodes get a 2×2 fully-transparent PNG + transform `{ x: −1, y: −1, width: 2, height: 2, z: existing }`. Preserves the 40-node architecture without contributing pixels. Don't delete nodes from the graph just because the mockup doesn't show them — keep architectural parity.

### 3. Page-background is the full mockup
The `page-background` node's `sourceAsset` is the UNCROPPED full mockup. It renders first (z=0). Every other node is a crop at its bbox and renders on top at its source position. At rest the crops sit pixel-identical over their source region → visually one image. This is what makes the "image IS the UI" feel work.

### 4. Alpha-cutout is critical
Bbox crops are rectangles but object silhouettes are irregular. Without cutout, hovered elements show visible dark rectangles around them. Solution: `scripts/alpha-cutout.mjs` — luminance-based alpha pass (pixels below luminance ~18 → fully transparent, above ~55 → fully opaque, linear ramp between). Applied per-crop.
- **Skip** cutout on: `page-background`, `navbar-bg`, `hero-section-bg`, `feature-grid-section-bg`, `settings-section-bg`, `footer-bg`, `hero-card-bg` (solid object).
- **Apply** to everything else that sits as a floating element on a darker background.
- For the new AI-video-generator image, adjust the threshold per-element — some crops may have light backgrounds; in that case you may need a different approach (chroma key, SAM RLE masks, or per-crop background-color detection).

### 5. FLUX.2 prompt engineering (when you need to GENERATE a mockup)
- ❌ NEVER describe elements by function ("sign in button", "navigation menu", "feature card")— FLUX bakes purpose-implied text and shape stereotypes
- ✅ DO describe shape + material ("pill-shaped object", "rounded rectangle panel with iridescent surface", "circular disc with gradient")
- Strong negative: `"text, letters, words, numbers, typography, wordmarks, icons, glyphs, characters, writing, labels, captions, symbols"`
- Describe elements as integrated/nested into a composition, not floating. Include floor/shelf/ground plane references to anchor spatial continuity.
- Good settings: FLUX.2-pro, `image_size: { width: 1536, height: 2048 }`, guidance 4.5–5.0, 40–44 inference steps. ~$0.06/call.

**For Task 1 this is moot** — the user is providing a pre-generated image that already has text. Text in the crop IS the text rendering. Do not overlay MSDF on top (doubles the text).

### 6. Segmentation reality (what the session learned)
- **SAM 3** (`fal-ai/sam-3/image-rle`): text-prompted, no auto-everything mode. Works on concrete object nouns (logo, button, card, icon, sphere, orb, pedestal, frame, crystal). Fails (HTTP 422) on abstract or text-oriented terms (panel, text, heading, link, switch, hero-card). Uses `return_multiple_masks: true, max_masks: 32, include_boxes: true, include_scores: true`. Output `box` is `[cx, cy, w, h]` normalized 0..1. $0.005/call.
- **Florence-2** (`fal-ai/florence-2-large/caption-to-phrase-grounding`): accepts any text query, returns bboxes. But results are often WILDLY wrong — "navigation bar" might return the hero area. Inspect every output.
- **Pragmatic**: use SAM + Florence as HINTS; hand-tune bboxes via visual inspection. A debug-overlay script that draws bboxes on the mockup is essential for QA before cropping.
- **Per-pixel RLE**: SAM returns RLE masks; if your extractor needs exact silhouette (not just bbox), decode the RLE. COCO RLE format. Not done in the prior session's segment-scifi.mjs (rle field wasn't saved). Re-run SAM saving `rle` if you need tight per-pixel masks.

### 7. Mockup-to-graph extraction flow
Repeatable recipe:
1. Upload mockup: `const imageUrl = await fal.storage.upload(blob)`
2. Run SAM with prompts for concrete nouns present in the image (~10–20 queries). Collect boxes.
3. Write a debug-overlay script that draws each bbox + label on a copy of the mockup (SVG composite via sharp). Eyeball alignment.
4. In your extract script, define a `BBOX` object: `{ [nodeId]: { x, y, w, h } }` in mockup pixel space. Hand-tune where SAM missed.
5. For each node: `sharp(mockupPath).extract({ left, top, width, height }).toFile(...)`. For invisible nodes, write a 2×2 transparent PNG.
6. Run `scripts/alpha-cutout.mjs` (may need tuning for the new image's background luminance).
7. Patch `home-hub.json`: update each node's `transform` to its bbox (pixel-space); set `hub.layout.viewportWidth = mockupWidth`, `hub.layout.contentHeight = mockupHeight`, `hub.layout.viewportHeight = Math.round(mockupWidth * 9 / 16)`.
8. Strip any stale `transformByBreakpoint`, `visibleAtBreakpoints`, `regionKeys`, `textOnly` from nodes that now have real crops.
9. `npm run build:prism` (runs build:atlas → build:msdf → build-prism).

### 8. State variants drift — DO NOT regenerate
If a node has interactive states (hover, active, pressed), do NOT generate separate FAL images per state. Each regeneration drifts visually. Instead: one base sprite + GSAP runtime effects (brighten, scale, lift, tint). ONLY keep `regionKeys` for structurally different states (e.g. toggle on vs off where the material genuinely changes, like lens-lit vs lens-dark).

### 9. Shape masks (optional build-time clip)
`visual.shape: 'rect' | 'rounded' | 'circle' | 'pill' | 'oval'` + optional `visual.shapeRadius`. `build-atlas.mjs` applies sharp SVG alpha composite to clip crops to that shape. Useful for logos (circle), buttons (pill), cards (rounded). Applied to base + state kinds only.

### 10. Drop shadows (runtime)
`boot.ts` applies `pixi-filters` `DropShadowFilter` to containers whose nodeId suffix is `-card-bg` or `-card-cta`. Opt-out on mobile breakpoint for perf. Tuned parameters: `offset { x: 0, y: 3 }, color 0x000000, alpha 0.35, blur 3, quality 4`.

### 11. Text in the graph
Each node has `intent.visualSpec.textContent` which can list text entries with `renderMethod: 'msdf' | 'sharp-svg' | 'diffusion'`. Current mockup-first architecture keeps all `textContent` mostly empty (the mockup crops carry the text visually). `stats-live-counter` is the only node actively using msdf (runtime-dynamic counter).

For Task 1 (new image has text): the user wants each text block as its own node. Two ways:
- Each text block's crop IS the text (read from the mockup). Keep `textContent: []` on these nodes. The crop is the visual.
- OR if the text should be dynamic, add `renderMethod: 'msdf'` + typography + position. But then the BASE crop should NOT contain that text (or it doubles). This requires masking the text region out of the crop.

For a first pass: keep all text baked into crops (each text block = its own crop). Add MSDF later only where the text needs to be editable/dynamic.

### 12. Responsive + viewport presets (Phase A infrastructure — intact, don't break)
- `PrismHost.tsx` uses ResizeObserver to track container size
- `boot.ts` has `mount(canvas, prismUrl, { width, height })` + `result.resize(w, h)` method
- `applyLayout(breakpoint)` re-applies transforms on breakpoint crossings
- Mobile (390×844), Tablet (768×1024), Desktop (1440×900), Fit presets in Preview mode via a toolbar
- `viewport.content.scale.set(containerW / designW)` for uniform scale

### 13. Hub layout
```
hub.layout = {
  viewportWidth: <mockup width>,        // e.g. 1536
  viewportHeight: round(w * 9 / 16),    // derived for 16:9 visible frame
  contentHeight: <mockup height>,       // e.g. 2048
  backgroundColor: "#0a0a12"
}
```

### 14. verify:prism rule relaxation
`scripts/verify-prism.mjs` — the §10.8 text.methods check was relaxed: requires only `msdf` in the graph. `sharp-svg` and `diffusion` are still supported by the pipeline (`build-atlas.mjs` and `provision-assets.mjs`) but not required in-graph. Don't tighten this without a plan.

### 15. .gitignore override for Vercel
Vercel runs `npx next build` (not `npm run build`) — so `build:prism` does NOT fire in CI. The built artifact must ship in git. `kid-kode-landing/public/prism-assets/` is intentionally NOT gitignored (commented inline in the repo-root `.gitignore`). `source-images/` and `.provisioning-manifest.json` ARE gitignored.

When you rebuild, commit `public/prism-assets/*` and push. Vercel auto-deploys.

### 16. Verification gates
- `npm run verify:prism` — 15 static checks (text methods, shape, structural)
- `node scripts/browser-smoke.mjs` — 6 Playwright checks on local `next start` at :4777
- `node scripts/live-vercel-smoke.mjs` — 5 checks against live URL
- `node scripts/live-modes-smoke.mjs` — 8 checks (all view modes + all 4 viewport presets)
- Run verify + browser-smoke before commit; run live smokes after deploy

### 17. Working directory quirk
Most npm / node scripts require being in `kid-kode-landing/` (not the repo root). `node --env-file=.env.local scripts/foo.mjs` won't find `.env.local` unless your cwd is `kid-kode-landing/`. When Bash calls lose their cwd, re-`cd` in the command.

### 18. Editor integration specifics (for Task 2)

**Where the editor lives**:
- `src/components/editor/graph/GraphScene.tsx` — the 3D canvas, dynamic-imported in `src/app/page.tsx`
- `src/components/editor/overlays/TopBar.tsx` — top-of-page chrome (logo, mode toggle, health, search)
- `src/components/editor/overlays/HubNav.tsx` — bottom pill tabs (Galaxy / Home / Dashboard / Profile / Auth)
- `src/components/editor/overlays/DetailCard.tsx` — selected-node detail viewer
- `src/components/editor/overlays/Minimap.tsx` — minimap in bottom-right
- `src/components/editor/overlays/SearchPalette.tsx` — ⌘K search
- `src/components/editor/panels/Inspector.tsx` — right-side inspector (properties)

**Runtime bridge to the preview pane**:
- `boot.ts` already exposes `window.__prism = { router, viewport, events, graph, nodes: Map<nodeId, NodeInstance>, currentBreakpoint, hiddenNodeIds, shr }` after mount.
- Also exposes `window.__prismBreakNode(nodeId)` for SHR dev.
- The editor can subscribe: `const graph = window.__prism?.graph` — this gives live access to the currently-loaded hub.
- For bidirectional editing: when the editor mutates a node's transform or intent, it should (a) mutate the corresponding `window.__prism.nodes.get(nodeId).container` directly for immediate visual feedback, and (b) persist the change back to a source of truth (home-hub.json for permanent edits, or an in-memory "live edit buffer" for sandbox edits).

**Generic editor constraint**: the editor must introspect the graph at runtime. No hardcoded nodeIds like `'hero-card-bg'`. It iterates `graph.nodes` and renders whatever's there. When the hub changes, the editor re-reads the graph.

**Likely wiring**:
- TopBar's existing graph-health, search, mode toggle stay.
- HubNav's tabs (Galaxy / Home / Dashboard / Profile / Auth) — these are hub navigation. If the graph had multiple hubs, clicking a tab switches hubs. Current graph has only home-hub. Either: show only tabs for hubs that exist in the loaded .prism, or leave the static tabs and route them to no-ops for now.
- Inspector: select a node (click in 3D scene, or click in preview pane) → show its intent.caption, visual.transform, stateEffects, visualSpec. Edit inputs → mutate graph → re-apply.
- DetailCard: similar but more visual — show the node's sourceAsset preview + metadata.
- Minimap: already renders 21 nodes-representation; connect to the actual graph for accuracy.
- SearchPalette: ⌘K → fuzzy-search nodeIds and captions → select jumps camera / highlights.

**Click-to-select in preview pane**: add a pointerdown listener on each node's container (in boot.ts or PrismHost) that emits a `node-selected` event on `window.__prism.events`. Editor subscribes to it. On selection, pan camera, light up in Inspector.

**Drag-and-drop (optional, nice-to-have but within architecture)**: pointermove on a selected container → update `transform.x/y` live. On pointerup, persist.

## Files you will touch

| Purpose | File |
|---|---|
| Graph (the hub + nodes) | `src/lib/prism/mock-app-source/hubs/home-hub.json` |
| Per-node createNode modules | `src/lib/prism/mock-app-source/nodes/*.js` |
| Per-node source crops | `src/lib/prism/mock-app-source/assets/source-images/base/*.png` |
| Atlas builder (sharp + MaxRects) | `src/lib/prism/mock-app-source/assets/build-atlas.mjs` |
| MSDF font builder | `src/lib/prism/mock-app-source/assets/build-msdf.mjs` |
| .prism zipper | `src/lib/prism/mock-app-source/build-prism.mjs` |
| Runtime mount | `src/lib/prism/player/boot.ts` |
| React host wrapper | `src/components/prism-player/PrismHost.tsx` |
| Page with mode toggle | `src/app/page.tsx` |
| 3D editor (DO NOT MODIFY VISUALLY) | `src/components/editor/graph/GraphScene.tsx` |
| Editor overlays + panels | `src/components/editor/overlays/*`, `panels/*` |
| Generation scripts (existing patterns to copy) | `scripts/generate-scifi-mockup.mjs`, `scripts/generate-mockup-v3.mjs` |
| Segmentation scripts | `scripts/segment-mockup.mjs`, `scripts/segment-scifi.mjs`, `scripts/florence-ground.mjs` |
| Extraction + alpha cutout | `scripts/extract-from-mockup.mjs`, `scripts/extract-scifi-elements.mjs`, `scripts/alpha-cutout.mjs` |
| Debug overlays | `scripts/debug-scifi-boxes.mjs` |
| Verification | `scripts/verify-prism.mjs`, `scripts/browser-smoke.mjs`, `scripts/live-modes-smoke.mjs`, `scripts/live-vercel-smoke.mjs` |
| Spec reference | `notes/prism-spec-extract.md` (quote by section) |
| Progress log | `notes/prism-mock-progress.md` |
| Current mockup candidates | `notes/mockup-candidates/*` |

## Required FAL model IDs (verified this session)

- `fal-ai/flux-2-pro` — photorealistic cinematic image generation
- `fal-ai/flux-2-pro/edit` — image-to-image editing (supports `@image1` reference syntax; up to 9 reference images)
- `fal-ai/recraft/v4/pro/text-to-image` — UI-native vector-style (AVOID for this architecture)
- `fal-ai/recraft/v3/text-to-image` — cheaper Recraft
- `fal-ai/sam-3/image-rle` — SAM 3 segmentation with RLE output
- `fal-ai/florence-2-large/caption-to-phrase-grounding` — phrase grounding for bbox queries
- `fal-ai/wan/v2.7/image-to-video` — WAN 2.7 for image-to-video (if you add video generation for play-button elements)

`.env.local` has `FAL_KEY=<credentials>`. Don't commit it (gitignored).

## Quick-start for Task 1 (step-by-step)

```bash
cd /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing

# 1. Inspect the new image dimensions + layout
node -e "require('sharp')('Gemini_Generated_Image_2w5g832w5g832w5g.png').metadata().then(m => console.log(m.width, 'x', m.height))"

# Then use the Read tool on the image file to visually inspect layout.

# 2. Move it somewhere sensible
mkdir -p notes/mockup-candidates
mv Gemini_Generated_Image_2w5g832w5g832w5g.png notes/mockup-candidates/ai-video-mockup.png

# 3. Write a new segment-video-mockup.mjs based on segment-scifi.mjs
#    Use SAM prompts tuned for the new image's elements: button, icon,
#    thumbnail, video, play button, toggle, tab, panel, card, slider.
#    Save BOTH boxes AND rle so you can use RLE masks for per-pixel cutout
#    if the luminance threshold doesn't work for this image's palette.
node --env-file=.env.local scripts/segment-video-mockup.mjs

# 4. Write debug-video-boxes.mjs to visualize the SAM bboxes on the mockup.
node scripts/debug-video-boxes.mjs
# Open notes/mockup-candidates/video-debug.png and check alignment.

# 5. Write extract-video-elements.mjs based on extract-scifi-elements.mjs.
#    Define BBOX map per-node based on inspection + SAM hints.
#    Each distinct text block = its own node.
#    Each video thumbnail (the 4 with play buttons) = its own node (and mark
#    with intent.behaviorSpec.interactions for future video-playback wiring).
node scripts/extract-video-elements.mjs

# 6. Apply alpha cutout.
node scripts/alpha-cutout.mjs
# If the new mockup has a lighter background than the sci-fi one, tune
# the LOW/HIGH thresholds or write a different masking approach.

# 7. Patch home-hub.json transforms.
node /tmp/patch-video-transforms.mjs

# 8. Rebuild.
npm run build:prism
npm run verify:prism

# 9. Smoke.
node scripts/browser-smoke.mjs

# 10. Ship.
cd /Users/loganbaird/Prototype_Prism/Design-trials
git add -A
git commit -m "prism-mock: swap to AI video generator mockup"
git push origin prism-main

# 11. Wait for Vercel deploy. Monitor via mcp__claude_ai_Vercel__get_project.

# 12. Live smoke.
cd kid-kode-landing
node scripts/live-modes-smoke.mjs
```

## Things that will bite you if you don't know them

1. **Wrong cwd for npm/node scripts**: always be in `kid-kode-landing/`, not the repo root.
2. **PreToolUse anti-drift hook** blocks any `PIXI.Graphics` write without `ALLOWED-GRAPHICS:` comment within 3 lines. Including in COMMENTS that mention the phrase. If your comment says "no PIXI.Graphics for UI" the hook will block. Rephrase to avoid the phrase.
3. **verify:prism**'s text-methods check is currently relaxed to require only `msdf`. Don't tighten without a plan.
4. **T11 pixel-regression test fixture** may be stale. If it fails after your atlas rebuild, update `tests/fixtures/home-hub-hero.png` with the `UPDATE_BASELINE=1` env flag.
5. **Vercel deploys on push to prism-main**. Don't push broken builds.
6. **Spec §1.4 hook is live**. It will block commits that add `PIXI.Text`, unchecked `PIXI.Graphics`, `innerHTML`, `fillText`, etc. in `src/lib/prism/**`.
7. **The 3D editor is untouched architecturally**. You're wiring it for the first time. Don't refactor it.
8. **Never hardcode nodeIds in the editor code**. Drive everything from `window.__prism.graph.nodes`.
9. **Gemini-generated image name has underscores**: `Gemini_Generated_Image_2w5g832w5g832w5g.png`. Move + rename it early so subsequent scripts don't have weird paths.
10. **prism-spec-extract.md is authoritative**. Quote by line number. The original `docs/prism/*.md` spec files are NOT on disk; only the extract is.

## Things the previous session tried that you should NOT repeat

- Generating 40 independent per-element FAL images (state variants drift, composition fights).
- Recraft V4 pro for mockup (produces flat CSS-looking output).
- Describing elements by function in FLUX prompts ("sign in button") — FLUX bakes purpose-implied text.
- MSDF text overlay on top of crops that already contain the text (doubles).
- Assuming SAM 3 has an "everything mode" (it doesn't; text-prompted only).
- Trusting Florence-2's bboxes without visual verification.
- Masking via runtime PIXI.Graphics for every shape (build-time sharp composite is cleaner).
- Continuing to add glass-morphism / rounded-rect language to prompts — that's what code does, it's not what image generation should do.

## Session commits (for reference)

The prior session's trajectory on `prism-main`:
- `e2ff5e8` — pre-this-session baseline (Ralph loop complete)
- Phases 1–E3 (asset re-pass, MSDF text overhaul, state-drift fix, depth tuning, various mockup attempts)
- `1564852` — alpha cutout (current live)
- `notes/mockup-candidates/scifi-mockup-v1.png` is the mockup that's live right now
- `notes/mockup-candidates/scifi-mockup-v2.png` + `v3` are better-prompted iterations (v3 has no text at all, v2 has embossed gibberish) — not yet shipped

## Your charter

1. Run Task 1 (new image → segment → crop → node-tether → build → ship) cleanly, following the recipe above.
2. Run Task 2 (wire editor tabs to live preview graph) without visually modifying the editor. Keep it generic.
3. Do Task 3 (spec enrichment for interactive-element recognition) as notes added to `notes/prism-spec-extract.md` or a sidecar `notes/prism-spec-enrichments-2026-04-24.md`.
4. Commit after each meaningful step. Use progressive commit messages. Update `notes/prism-mock-progress.md`.
5. Every change goes through gates (verify:prism, browser-smoke, live-modes-smoke).
6. If something's ambiguous about the user's intent, ASK. Don't assume; the prior session did too much of that.

## Final admonition

The architecture is real. The user has verified it. Don't second-guess it — image-IS-the-UI, each crop is a node, the runtime renders sprites, it works. Your job is to keep that architecture intact while executing the two tasks cleanly.

Good luck.
