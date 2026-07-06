# Mockup → .prism Pipeline (Caption-Driven)

**The graph IS the plan.** Every dynamic decision in the build pipeline — SAM-3.1 segmentation prompts, alpha-cutout thresholds, shape/mask choices, layer composition, animation parameters, separate text-layer specs, mobile/tablet/desktop sizing — derives from the rich caption on each hub and node, not from hardcoded values in scripts.

**Audience.** Claude Code today (Ralph-equivalent), and the future Prism engine's parallel models. The pipeline below is what those models execute.

**Cross-reference.** For the journey that produced these techniques, see [post-ralph-tweaks.md](./post-ralph-tweaks.md). For the spec foundation, see [prism-spec-extract.md](./prism-spec-extract.md) — the spec extract is **never modified**; this doc layers caption conventions on top of the existing schema.

---

## 1. The caption contract

The graph is populated **before the pipeline runs**. Either Claude Code visually inspects an uploaded mockup and authors captions, or the future Prism engine generates the mockup *from* a descriptive prompt whose per-element descriptions become the captions natively. Either way, downstream stages read captions — they do not re-derive what the captions already encode.

### Hub-level (`hub.caption`)

Required. Contains:
- What page this is (landing, settings, dashboard, etc.) and overall purpose.
- The **stacked sections** in render order (navbar / hero / feature-grid / settings / footer for the home hub).
- Aesthetic direction (palette, material vocabulary — sculpted-objects vs. flat UI vs. photographic, etc.).
- Primary affordance(s) — the user's main interactive target on this page.
- Any global behaviors (theme bindings, scroll length, viewport contracts).
- The **text-as-layer assertion** for this hub.

Plus `hub.responsiveBreakpoints` (NEW field): mobile / tablet / desktop scale factors.

### Per-node — enriched `intent.caption` (existing field, target richer content)

2–4 sentences covering four objectives:
1. **What** the element *is* visually — shape, material, finish, distinguishing visual nouns.
2. **Function/role** — what it does, what events it fires, what it listens for, what API it calls.
3. **Neighbors** — visually adjacent nodes, parent section, overlapping layers (text labels, glow overlays, shimmer overlays).
4. **Per-element pipeline hints in prose** — e.g. "alpha cutout soft on dark", "separate MSDF text layer above the substrate", "layer-swap between off and on regions" — anything a future automation needs to do *to this element* that isn't generic.

### Per-node — additive structured fields (the convention layer)

These were introduced in the 2026-04-27 caption-enrichment pass. They are **additive and optional** — older readers (`build-atlas.mjs`, `build-prism.mjs`, `verify-prism.mjs`, the runtime player) ignore unknown fields. They live on `intent` (or `visualSpec`) and provide machine-readable inputs for downstream stages.

- **`intent.samHints`** — drives SAM-3.1 prompt construction.
  ```json
  { "elementType": "button", "visualNouns": ["pill", "anodized", "aluminum", "chamfered"], "material": "aluminum", "finish": "anodized-black", "textureProfile": "smooth" }
  ```
  Replaces the hardcoded `PROMPTS` list in [scripts/segment-scifi.mjs](../scripts/segment-scifi.mjs).

- **`intent.alphaCutout`** — drives per-element luminance cutout decisions.
  ```json
  { "necessity": "soft", "backgroundAffinity": "dark", "luminanceLow": 18, "luminanceHigh": 55, "antialiasHint": "glow" }
  ```
  Replaces the hardcoded `LOW=18`/`HIGH=55` and `SKIP` set in [scripts/alpha-cutout.mjs](../scripts/alpha-cutout.mjs). When `necessity` is `none`, the element keeps its full crop (used for section backgrounds).

- **`intent.visualSpec.layers[]`** — declarative layer composition.
  ```json
  [
    { "id": "glow", "type": "overlay", "overlayRegion": "glow-pulse", "z": 50, "blendMode": "screen", "defaultAlpha": 0 },
    { "id": "base", "type": "sprite", "region": "hero-card-cta", "z": 51 },
    { "id": "shimmer", "type": "overlay", "overlayRegion": "shimmer", "z": 52, "blendMode": "screen", "defaultAlpha": 0, "mask": { "shape": "rounded", "radius": 12 } },
    { "id": "label", "type": "text", "z": 53 }
  ]
  ```
  Mirrors the layer-stack currently encoded imperatively in node `.js` modules (e.g., [hero-card-cta.js](../src/lib/prism/mock-app-source/nodes/hero-card-cta.js)).

- **`intent.animationSpec`** — declarative animation parameters.
  ```json
  {
    "onHover": [
      { "target": "container", "property": "scale", "to": 1.03, "duration": 200, "ease": "power2.out" },
      { "target": "glow", "property": "alpha", "to": 0.6, "duration": 200 }
    ],
    "onPress": [{ "target": "container", "property": "scale", "to": 0.97, "duration": 80 }],
    "onRelease": [{ "target": "container", "property": "scale", "to": 1.03, "duration": 120, "ease": "back.out(2)" }]
  }
  ```
  Mirrors hardcoded GSAP tweens in `.js` modules. Today the `.js` is still the runtime source of truth (per Invariant 8: *"code is behavior"*); the JSON is a parallel declarative description for the engine to consume. A future migration would let `.js` modules read `intent.animationSpec` directly.

- **`intent.visualNeighbors`** — per-node spatial adjacency.
  ```json
  { "parentSection": "hero-card-bg", "overlappingLayers": ["glow", "shimmer"], "spatialAdjacency": ["hero-card-headline-text", "hero-card-subhead-text"] }
  ```

- **`intent.interactionNeighbors`** — per-node interaction adjacency.
  ```json
  { "triggers": [{ "nodeId": "hero-card-bg", "event": "build-flow-started" }], "listensTo": [{ "nodeId": "theme-selector-button", "event": "theme-changed" }] }
  ```

- **`intent.responsiveSizing?`** — optional per-breakpoint transform overrides.
  ```json
  { "mobile": { "width": 80, "height": 80 }, "tablet": { "width": 120, "height": 120 } }
  ```
  Absent fields fall back to base `visual.transform`.

- **`intent.visibility?`** — optional flag for nodes that exist for graph completeness but aren't rendered in the current mockup.
  ```json
  { "renderInCurrentMockup": false, "reason": "scifi-mockup-v1 has no footer chrome; nodes held as TINY for graph completeness" }
  ```

### Worked examples (one per archetype)

See the live nodes in [home-hub.json](../src/lib/prism/mock-app-source/hubs/home-hub.json):

- **Background:** `page-background` — `samHints.elementType: "background"`, `alphaCutout.necessity: "none"`, single `layers[].type: "sprite"`.
- **Section:** `navbar-bg` — passive container, no animations.
- **Interactive button (multi-layer):** `hero-card-cta` — 4 layers (glow + base + shimmer + label), full `animationSpec` with onHover/onPress/onRelease.
- **Toggle (state-swap):** `notifications-toggle` — 2 layers (off + on) with `onToggleOn` / `onToggleOff` cross-fades.
- **Text-only (separate-layer):** `feature-card-1-title` — `samHints.elementType: "text-layer"`, `alphaCutout.necessity: "none"`, single layer `type: "text"` with full `textContent[]` typography spec.
- **Dynamic-text (state-bound):** `stats-live-counter` — `binding: "state.heroCtaClicks"`, `onIncrement` animation pulse.

---

## 2. Two entry paths to a populated graph

### Path A — Uploaded mockup PNG

1. User drops a PNG into `notes/mockup-candidates/` (or supplies a path).
2. **Claude Code visually inspects the image.** Identifies what's on the page: a header, a hero card, three feature cards, etc. Notes element shapes, materials, layouts. Counts elements.
3. Claude Code populates `hub.caption` and per-node `intent.caption` (and the structured fields) for every element it identifies. Captions describe each element specifically enough that the rest of the pipeline runs caption-driven.
4. The graph is now the plan.

### Path B — Engine-generated mockup (future Prism engine)

1. The engine accepts a descriptive prompt: "landing page for an AI video generator with a header, footer, 4 video slots, 4 marketing cards…"
2. The engine plans IN the graph: creates a hub with that caption, creates one node per identified element, captions each node from the prompt's per-element descriptions.
3. The engine then generates the mockup PNG from those same captions (so the mockup and the captions are coherent by construction).
4. The pipeline runs on the result, caption-driven.

In both paths, **the graph is populated before the build runs**. The build never re-derives what captions encode.

---

## 3. Pipeline stages (caption-driven)

### Stage 0 — Mockup input
- **Today:** active mockup is [notes/mockup-candidates/scifi-mockup-v1.png](./mockup-candidates/scifi-mockup-v1.png) (1536×2048 portrait), generated by [scripts/generate-scifi-mockup.mjs](../scripts/generate-scifi-mockup.mjs) via fal.ai `flux-2-pro` with a heavy positive + negative prompt that forbids text, letters, words, numbers, typography, CSS gradients, rounded rectangles, glass-morphism, flat UI, dashboard / figma chrome.
- **Caption tells the stage:** `hub.caption` describes the aesthetic and required sections; downstream prompts build from this. The mockup-generation prompt is **not constrained to what code can render** — we use images for the UI, so painterly / photographic / 3D / sculpted-physical-object styles are all fair game. What matters is element coverage and understandable layout.
- **Per-mockup parameters:** the mockup's aesthetic prompt (lives on the script today; should derive from `hub.caption` going forward), dimensions, model choice, steps, guidance.
- **Reuse:** drop in any 1536×2048 (or similarly proportioned) PNG; or generate a new one from a fresh `hub.caption`.

### Stage 1 — Visual analysis (populates captions)
- Claude Code or the engine reads the mockup, populates / updates `hub.caption` and every visible node's `intent.caption` plus structured fields. For uploaded mockups, this is a hand-authored pass; for engine-generated mockups, captions are already set from the original prompt.
- **Output:** [home-hub.json](../src/lib/prism/mock-app-source/hubs/home-hub.json) is fully populated.

### Stage 2 — SAM-3.1 segmentation
- **Today:** [scripts/segment-scifi.mjs](../scripts/segment-scifi.mjs) prompts fal.ai `sam-3/image-rle` with a hardcoded list of visual nouns (`crystal`, `portal`, `frame`, `panel`, `artifact`, `emblem`, `orb`, `sphere`, `pedestal`, `relic`, `platform`).
- **Caption-driven (target):** prompts derive from each node's `intent.samHints.visualNouns` + `samHints.elementType`. SAM is asked to segment *the interactive elements the graph declares*, not generic visual nouns. The result is a set of candidate masks per node; an extraction step (Stage 3) picks the right one.
- **Output:** segmentation JSON keyed by node-id (or by SAM's mask IDs to be matched in Stage 3).

### Stage 3 — Per-node extraction (caption-guided bbox selection)
- **Today:** [scripts/extract-scifi-elements.mjs](../scripts/extract-scifi-elements.mjs) carries a hand-authored `BBOX` table mapping each of 40 nodeIds to mockup pixel coordinates. SAM informs the human; the human picks. Nodes not visible in the current composition get a 2×2 transparent placeholder (`TINY`) so the graph stays at 40 nodes (`prism:nodeCount` still passes).
- **Caption-driven (target):** the matcher reads each node's `intent.samHints` + `intent.visualNeighbors.parentSection` + `intent.visualNeighbors.spatialAdjacency` and picks the SAM mask that best fits. Nodes flagged `intent.visibility.renderInCurrentMockup: false` automatically get the TINY placeholder.
- **Output:** per-node crops at `src/lib/prism/mock-app-source/assets/source-images/base/{nodeId}.png`, plus a bbox-map for diagnostic purposes.

### Stage 4 — Alpha cutout (caption-driven thresholds)
- **Today:** [scripts/alpha-cutout.mjs](../scripts/alpha-cutout.mjs) processes every `base/{nodeId}.png`: pixel luminance ≤ 18 → fully transparent, ≥ 55 → opaque, linear in between. Hardcoded `SKIP` set protects 7 background-affinity crops.
- **Caption-driven (target):** thresholds derive from each node's `intent.alphaCutout.luminanceLow`, `luminanceHigh`. Skip-or-process derives from `intent.alphaCutout.necessity` (`none` skips). `backgroundAffinity` decides whether dark-pixel or light-pixel is the "negative space."
- **Output:** alpha-masked PNGs in place, ready for atlas packing.

### Stage 5 — Text layers (separate, never baked)
- **Principle:** text is **always a separate layer** over its element substrate — never baked into the element image. The substrate may be transparent / blank / minimal; the visible text comes from `intent.visualSpec.textContent[]` rendered at runtime via MSDF BitmapText (Method 2/3) or composited at build time via sharp-svg (Method 1).
- **Today:** [build-atlas.mjs](../src/lib/prism/mock-app-source/assets/build-atlas.mjs) `compositeTextIfNeeded()` handles `renderMethod: "sharp-svg"` entries. MSDF entries are rendered at runtime by node `.js` modules.
- **Caption-driven (already in place):** each text-layer is declared as a `layers[].type: "text"` with full typography in `textContent[].typography` (font, size, weight, color, anchor, position).

### Stage 6 — Atlas build with shape masks
- **Today (universal, kept verbatim):** [build-atlas.mjs](../src/lib/prism/mock-app-source/assets/build-atlas.mjs) reads each node's `visual.shape` (rect | rounded | pill | circle | oval) and optional `shapeRadius`, builds a white-fill SVG matching the shape, composites with `blend: 'dest-in'` to alpha-clip the source pixels to the shape — corners outside the shape become transparent in the atlas region. MaxRects packs into a 4096² atlas at AVIF q75. Region long-side is capped at 512px.
- **Caption-driven inputs:** `visual.shape` and `visual.shapeRadius` are already on every node. The visual layers are also declared on each node via `intent.visualSpec.layers[].mask` for cross-reference.
- **Output:** [public/prism-assets/atlas-0.avif](../public/prism-assets/atlas-0.avif) + [atlas-regions.json](../public/prism-assets/atlas-regions.json).

### Stage 7 — `.prism` assemble + verify + smoke
- `npm run build:msdf` — MSDF font atlas (deterministic).
- `npm run build:prism` — assembles manifest + graph + nodes + backends + atlas + msdf into `mock-app.prism`. `artifactHash` is reproducible across runs.
- `npm run verify:prism` — 15 static checks (forbidden patterns, manifest valid, every node has a module, animation methods 1/2/3 represented, layer-swap present, MSDF text method represented, etc.).
- `node scripts/browser-smoke.mjs` — Playwright headless run with 6 runtime checks (canvases render, runtime mounts, no console errors, scroll handled, devtool present, screenshot saved).

---

## 4. Universal techniques (kept verbatim — the *how* doesn't change per mockup)

These all live in [build-atlas.mjs](../src/lib/prism/mock-app-source/assets/build-atlas.mjs), [boot.ts](../src/lib/prism/player/boot.ts), and the existing scripts. None of these need rewriting per mockup. Only their **per-element parameters** are caption-driven.

| Technique | Where it lives | What's universal | What's caption-driven |
|---|---|---|---|
| **Build-time SVG shape masking** | [build-atlas.mjs](../src/lib/prism/mock-app-source/assets/build-atlas.mjs) `applyShapeMaskIfNeeded()` | Mask shapes (rect/rounded/pill/circle/oval), `dest-in` blend mode, post-resize timing | Per-node `visual.shape` + `visual.shapeRadius` |
| **Alpha cutout via luminance** | [scripts/alpha-cutout.mjs](../scripts/alpha-cutout.mjs) | Luminance formula (0.299R + 0.587G + 0.114B), linear interp between LOW/HIGH | Per-node `intent.alphaCutout.{necessity, luminanceLow, luminanceHigh, backgroundAffinity}` |
| **MSDF text on a separate layer** | runtime via `PIXI.BitmapText` in node `.js` modules; build-time via [build-msdf.mjs](../src/lib/prism/mock-app-source/assets/build-msdf.mjs) | MSDF rendering, BitmapText API, anchor mapping | Per-node `intent.visualSpec.textContent[]` (text, role, renderMethod, typography, position) |
| **Drop-shadows / depth hierarchy** | `pixi-filters` DropShadowFilter applied in [boot.ts](../src/lib/prism/player/boot.ts) | Filter, default softness | (future: `intent.shadowProfile`) — currently fixed |
| **Atlas + MaxRects + AVIF q75** | [build-atlas.mjs](../src/lib/prism/mock-app-source/assets/build-atlas.mjs) | Packer config, atlas size 4096², region long-side cap 512, AVIF q75 | Nothing per-mockup |
| **Responsive sizing** | [PrismHost.tsx](../src/components/prism-player/PrismHost.tsx) | Viewport scaler | `hub.responsiveBreakpoints` + per-node `intent.responsiveSizing` overrides |
| **Layer composition (overlays + base + text)** | node `.js` modules; declarative form mirrored in graph | PIXI layer ordering, blend modes, mask compositing | Per-node `intent.visualSpec.layers[]` |
| **Animation tweens (GSAP)** | node `.js` modules; declarative form mirrored in graph | GSAP API, ease functions, common patterns (lift-hover, scale-press, glow-pulse, shimmer) | Per-node `intent.animationSpec` (durations, eases, fromValue/toValue per event) |

---

## 5. Swap-in-a-new-mockup procedure

The reusability test for this whole pipeline. To replace the current sci-fi mockup with a different one:

1. **Drop a new PNG** into `notes/mockup-candidates/` (or generate one with `npx node scripts/generate-scifi-mockup.mjs` after editing the prompt — or write a parallel `generate-X-mockup.mjs` for a different aesthetic). Aspect-ratio match `hub.layout` if possible; otherwise update `hub.layout` accordingly.
2. **Have Claude Code visually analyze** the new mockup. Update `hub.caption` to describe its aesthetic and section structure. For every element visible in the new mockup, update the relevant node's:
   - `intent.caption` (4 objectives — what / function / neighbors / hints)
   - `intent.samHints` (visual nouns / material / finish that match the new style)
   - `intent.alphaCutout` (necessity / backgroundAffinity / thresholds appropriate for the new palette)
   - `intent.visibility.renderInCurrentMockup` (true for visible nodes; false for nodes the new mockup doesn't include)
   - `visual.transform` (real coords for visible nodes; TINY 2x2 for absent ones)
3. **Run the pipeline:**
   ```bash
   cd kid-kode-landing
   node scripts/segment-scifi.mjs       # (or a caption-driven variant)
   node scripts/extract-scifi-elements.mjs  # (or caption-driven)
   node scripts/alpha-cutout.mjs        # (or caption-driven)
   npm run build:atlas
   npm run build:msdf
   npm run build:prism
   ```
4. **Verify:** `npm run verify:prism` (15/15) + `node scripts/browser-smoke.mjs` (6/6).
5. **Eyeball** at `npm run dev` and iterate.

What changes per swap: the mockup PNG, the captions, the per-node bbox/transform numbers. What does NOT change: the build scripts, the universal techniques, the runtime player.

---

## 6. Dynamic creation/deletion of nodes and hubs

The graph grows and shrinks based on what the mockup contains:

- **New element in the mockup → new node** in `home-hub.json` (or in the relevant hub's JSON). Caption authored at the same time as the node is added. `visual.transform` populated from the mockup pixel coords.
- **Element removed from a new mockup → set the node's `visibility.renderInCurrentMockup: false`** and TINY its `visual.transform`. Don't delete the node — the graph keeps the node count stable for `verify:prism` and provides a slot for future activation.
- **New page → new hub.** Each page-level surface is a hub (`hubId`, `title`, `caption`, `layout`, `responsiveBreakpoints`, plus its own `nodes[]` and `edges[]`). The current mock app has a single `home-hub`; multi-page apps add hubs and `hub-router` arbitrates between them.
- **Page removed → hub deleted** (or marked `visibility: false` if you want to retain the captions for future restoration).

This dynamism is what the future Prism engine will exercise as it accepts a descriptive prompt and plans IN the graph: "this app has 4 hubs (landing, dashboard, settings, profile), here are the captions, here are the nodes per hub, generate the mockups."

---

## 7. What works today vs. what's caption-driven-in-principle but hardcoded-in-practice

Honest gap list:

| Concern | Today (1564852 + 2026-04-27 enrichment) | Target | When the gap closes |
|---|---|---|---|
| SAM-3.1 prompts | Hardcoded list in [segment-scifi.mjs](../scripts/segment-scifi.mjs) | Built from each node's `intent.samHints` | When `segment-*.mjs` reads home-hub.json and assembles prompts per-node |
| Bbox extraction (SAM mask → node mapping) | Hand-authored `BBOX` table in [extract-scifi-elements.mjs](../scripts/extract-scifi-elements.mjs) | Caption-guided matcher picks SAM masks per `intent.samHints` + `intent.visualNeighbors` | Future: ML-assisted matcher driven by captions |
| Alpha-cutout thresholds | `LOW=18`/`HIGH=55` hardcoded; `SKIP` set hardcoded | Per-element: `intent.alphaCutout.{luminanceLow, luminanceHigh, necessity}` | When [alpha-cutout.mjs](../scripts/alpha-cutout.mjs) reads home-hub.json per-node |
| Animation parameters | Hardcoded GSAP calls in node `.js` (e.g. [hero-card-cta.js](../src/lib/prism/mock-app-source/nodes/hero-card-cta.js)) | Read from `intent.animationSpec` | Future: refactor `.js` modules to consume the JSON description (Invariant 8 still allows this — runtime is `.js`, declaration is JSON) |
| Drop-shadow profile | Fixed values in [boot.ts](../src/lib/prism/player/boot.ts) | Per-node `intent.shadowProfile` (NEW field, not yet defined) | Future enhancement |
| Mockup-generation prompt | Embedded in [generate-scifi-mockup.mjs](../scripts/generate-scifi-mockup.mjs) | Derived from `hub.caption` + per-node `intent.caption` | Future: a generator that reads the graph and assembles the prompt |

When each gap closes, the corresponding script becomes thinner — because the caption already says what to do.

---

## 8. Phase G — recorded, not active

[scripts/enrich-elements.mjs](../scripts/enrich-elements.mjs) (commit `eeb483a`) attempted per-element FLUX.2-pro image-to-image enrichment as a build step. The result reintroduced inconsistency between elements (each element re-rolled in diffusion, with its own variance). **This is not the approach.** We do not generate additional images beyond the mockup. The script is preserved on disk as a "tried, abandoned" record (Bucket D in [post-ralph-tweaks.md](./post-ralph-tweaks.md)). Do not invoke it.

## 9. Recraft-era scripts — superseded

[scripts/segment-mockup.mjs](../scripts/segment-mockup.mjs), [scripts/extract-from-mockup.mjs](../scripts/extract-from-mockup.mjs), [scripts/generate-mockup.mjs](../scripts/generate-mockup.mjs), [scripts/florence-ground.mjs](../scripts/florence-ground.mjs), [scripts/segment-mockup-retry.mjs](../scripts/segment-mockup-retry.mjs) were the Phase F flow against the recraft-v4-pro mockup. They are functionally equivalent to today's `*-scifi.mjs` scripts, just for a different mockup. Both flows are subsumed by the caption-driven model: the right primitive isn't "this set of scripts," it's "captions tell the pipeline what to do per-element." The recraft-era scripts remain on disk for archaeological reference.

---

## 10. Constraints & non-negotiables

- **Spec dependencies, runtime, and forbidden patterns are unchanged.** Per `notes/prism-spec-extract.md`: no `PIXI.Text`, no `PIXI.Graphics` for visible UI (only invisible hit areas / masks / dev overlays with `ALLOWED-GRAPHICS` comment), no `html-to-image`, no inline `style.background` / `style.border` / etc. for visible chrome. Allowed packages: pixi.js, pixi-filters, gsap, sharp, maxrects-packer, msdf-bmfont-xml, @fal-ai/client, jszip, globby, ffmpeg-static, dotenv, playwright + the Next.js / React / 3D editor runtime list.
- **Drift prevention.** PreToolUse `anti-drift-check.sh` blocks forbidden patterns at write time (PIXI.Text, PIXI.Graphics-without-`ALLOWED-GRAPHICS`, innerHTML/outerHTML). PostToolUse `dependency-allowlist-check.sh` (added 2026-04-27) blocks adding non-allowlisted dependencies to package.json or non-allowlisted imports in prism runtime / scripts code.
- **Code creates functions of elements, not the elements themselves.** Per spec invariant 8: *"Images are elements; code is behavior."* Never use code to construct visible chrome.
- **The spec extract is never modified.** Conventions in this doc layer additively on top of the existing schema.
- **Allowlist addition (2026-06-08, Material+Lighting subsystem, canvas-spec §10/§11).** Added to `RUNTIME_ALLOW` in `.claude/hooks/dependency-allowlist-check.py`: `three/examples/jsm/environments/RoomEnvironment.js` and `three/examples/jsm/tsl/display/{GTAONode,SSGINode,SSRNode,TRAANode,GodraysNode}.js`. **Rationale:** these are first-party three.js addons that ship *inside* the already-approved `three@0.184` package — they are NOT a new npm dependency and NOT a second renderer (one `three` instance, INV-R1 / RT-SC-02 intact). RoomEnvironment provides the PMREM studio IBL for the T0 tier (all devices); the `tsl/display` nodes provide native TSL screen-space GI/AO (GTAO/SSGI), reflections (SSR), temporal AA (TRAA), and volumetric godrays for the **T2** tier only — capability-gated behind WebGPU-desktop detection (INV-9), never the default path. No dependency was downgraded; no version pin changed (held at three@0.184).
- **Node-Editor V2 harness — deferred swap deps (2026-06-14, PRISM-NODE-EDITOR-SPEC-V2 D1/D2/D3/D5).** The prompt-edit / Functions / Integrations / snippets HARNESS is built as **pure first-party TypeScript** — interfaces + stubs + the MCP reference adapter — with **NO new entries added to `package.json` or the allowlist**. The live AI service + live aggregator + Supabase land on Logan's production greenlight; until then they are reached ONLY through **lazy, env-gated dynamic imports** via `src/server/optional-import.ts` (hidden from the bundler with `webpackIgnore`/`turbopackIgnore`), located OUTSIDE the runtime/build import scope the allowlist hook scans (`src/lib/prism/**`, `src/components/prism-player/**`, `scripts/**`). **The "go live" swap = install the dep + set the env key; no UI/contract rework, no allowlist edit until then.** Verified-current swap targets (June 2026 npm registry, recorded for the install command): `ai`@6.0.205 + `@ai-sdk/anthropic` (Vercel AI SDK v6 + Anthropic provider; model `claude-opus-4-8`, ANTHROPIC_API_KEY) · `@modelcontextprotocol/sdk`@1.29.0 (PRISM_MCP_ENDPOINT) · `@supabase/supabase-js`@2.108.1 (SUPABASE_URL + key, RLS) · aggregator alternatives `@pipedream/sdk`@3.1.0 / `@composio/core`@0.10.0 / `nango`@0.70.6 (PRISM_CAPABILITY_PROVIDER). Secrets stay server-side (vault / capability references only, INV-R13); none of these touch the client bundle.

---

## 11. End-to-end verification

```bash
cd /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing

# 1. JSON valid
jq . src/lib/prism/mock-app-source/hubs/home-hub.json > /dev/null && echo "graph: ok"

# 2. Rebuild the .prism artifact
npm run build:atlas      # consumes per-node visual.shape + visual.shapeRadius
npm run build:msdf       # font atlas (deterministic)
npm run build:prism      # assemble (artifactHash deterministic)

# 3. Static checks (15/15)
npm run verify:prism

# 4. Production build + Playwright smoke (6/6)
npm run build
node scripts/browser-smoke.mjs
```

If any of those fail, do not ship. Fix at the layer where the failure originated (caption, script, or runtime) — not by relaxing the check.

---

## 12. Editor view-model mapping

The 3D node editor at `/` reads from the same [home-hub.json](../src/lib/prism/mock-app-source/hubs/home-hub.json) the build pipeline consumes. It does **not** maintain a parallel data source: the canonical schema *is* the editor's data source. The mapping layer that adapts the canonical `PrismNode` / `PrismHub` / `PrismEdge` shape onto the values each Inspector tab expects lives in [src/lib/prism-graph/view-model.ts](../src/lib/prism-graph/view-model.ts) and is consumed by [src/components/editor/panels/Inspector.tsx](../src/components/editor/panels/Inspector.tsx) (and its hub-side sibling [HubInspector.tsx](../src/components/editor/panels/HubInspector.tsx)).

Why this matters for the pipeline doc: when a new mockup swap-in (§5) updates a node's caption / `samHints` / `alphaCutout` / `animationSpec`, those edits show up in the editor immediately — through the accessors below — without any code change. The view-model is the *editor's contract* on the schema this doc defines.

### 12.1 Inspector tab × accessor table

The Inspector renders six tabs. Each tab pulls only from the accessors listed below; it never reads `node.X` directly. This keeps the editor stable across schema enrichments — adding a new optional field to `home-hub.json` cannot break a tab unless an accessor explicitly opts in.

| Tab (id) | View-model accessor(s) | Canonical JSON field(s) |
|---|---|---|
| **Visual** (`visual`) | `getCaption(node)`, `getElementType(node)`, `getTextContent(node)`, `getLayers(node)` + neutral palette defaults (primary `#5d8bff`, secondary `#a978ff`, font `Inter`, radius from `visual.shapeRadius`, shadow `none`) | `intent.caption`, `intent.samHints.elementType`, `intent.visualSpec.textContent[]`, `intent.visualSpec.layers[]`, `visual.shape` / `visual.shapeRadius` |
| **Behavior** (`behavior`) | `getInteractions(node)`, `getStateCount(node)` | `intent.behaviorSpec.interactions[]` (event/effect), `triggersDownstream[].targetNodeIds`, `intent.stateEffects[]` |
| **Code** (`code`) | `node.code` (read-only source string loaded from `codeRef`) | `codeRef` (path under `src/lib/prism/mock-app-source/nodes/*.js`) |
| **Animation** (`animation`) | `getHasAnimation(node)`, `getAnimationFrames(node)`, `getAnimationSpec(node)` | `intent.animationSpec.{onHover,onPress,onRelease,onToggleOn,onToggleOff,…}`, `visual.frameCount` |
| **Connections** (Links, `connections`) | `getEdges(graph, nodeId)`, plus the spatial / interaction neighbors via `getVisualNeighbors(node)` and `getInteractionNeighbors(node)` | `edges[].{from,to,event,type}`, `intent.visualNeighbors`, `intent.interactionNeighbors` |
| **Backend** (`backend`) | `getBackendContract(node)` | `backendRef`, `intent.behaviorSpec.apiCalls[0].{method,endpoint}` (the editor's `route` is `apiCalls[0].endpoint`), `intent.contracts.{inputs,outputs}` |

All six accessors are pure functions — input is the canonical `PrismNode` (or `GraphSource` for `getEdges`), output is the editor's expected shape. They live in `view-model.ts` and never reach for React, fetch, or any I/O.

### 12.2 Hub-side accessors (HubInspector)

Hubs expose the same six tabs, but each tab is hub-flavored. The hub view-model maps `PrismHub` fields onto the panel:

| Tab | Hub source |
|---|---|
| **Visual** | `hub.caption`, `hub.layout.{viewport,contentHeight,backgroundColor}`, `hub.responsiveBreakpoints` (per breakpoint: `{maxWidth, scale}`). The mockup PNG (`public/prism-assets/scifi-mockup-v1.png`) is rendered by [GraphScene.tsx](../src/components/editor/graph/GraphScene.tsx)'s `HubHulls` inner sphere, not by HubInspector |
| **Behavior** | global event bindings filtered by `source` prefix (`theme`, `state.*`, `hub.*`) — surfaces `theme→visual.tint` and the three `state.*` bindings on `home-hub` |
| **Code** | manifest summary (`prismVersion`, `entryHub`, `nodeCount`, `artifactHash` pointer) plus build-command reference text |
| **Animation** | read-only summary of nodes whose `intent.animationSpec` is non-empty or whose `visual.frameCount > 1` (today: `hero-section-bg`'s 24-frame i2v loop) |
| **Connections** | every node where `parentHubId === hub.hubId` (clickable to switch selection); plus hub-to-hub edges for future multi-hub graphs |
| **Backend** | empty state — hubs do not own a backend contract |

The wrapper that picks Inspector vs. HubInspector based on `selectedNodeId` / `selectedHubId` lives in [src/components/editor/panels/RightPane.tsx](../src/components/editor/panels/RightPane.tsx).

### 12.3 Eight 2026-04-27 enrichment fields → first-class accessors

Each of the structured fields described in §1 is exposed as its own accessor so future tabs (or extensions to existing tabs) can read them without re-mapping:

| Accessor | JSON field |
|---|---|
| `getSamHints(node)` | `intent.samHints` |
| `getAlphaCutout(node)` | `intent.alphaCutout` |
| `getLayers(node)` | `intent.visualSpec.layers[]` |
| `getAnimationSpec(node)` | `intent.animationSpec` |
| `getVisualNeighbors(node)` | `intent.visualNeighbors` |
| `getInteractionNeighbors(node)` | `intent.interactionNeighbors` |
| `getResponsiveSizing(node)` | `intent.responsiveSizing` |
| `getVisibility(node)` | `intent.visibility` |

These are additive — older readers ignore them — so enriching captions does not require an editor change for the data to be reachable.

### 12.4 Live binding (preview ↔ editor)

A bidirectional bridge exposed on `window.__prism` (declared in [src/lib/prism/player/boot.ts](../src/lib/prism/player/boot.ts) and surfaced through [src/components/prism-player/PrismHost.tsx](../src/components/prism-player/PrismHost.tsx)):

- `window.__prism.highlightNode(nodeId | null)` — editor → preview. Inspector calls this on every selection change to draw a transient ring around the corresponding sprite in the PixiJS pane.
- `window.__prism.onNodeSelected(cb)` — preview → editor. Per-node `pointerdown` in the runtime player emits `node-selected` on the event bus; Inspector subscribes and pushes the click into `useGraphEditorStore.selectNode(id)`.
- `window.__prism.selectNode(nodeId)` — visual-only alias for `highlightNode` (does **not** emit `node-selected`, by design — avoids editor→preview→editor loops).

The selection ring is the only `PIXI.Graphics` use the editor adds to the runtime; it carries the `// ALLOWED-GRAPHICS: selection-ring` marker comment that satisfies §1.4 of the spec.

### 12.5 What the editor does *not* do

- **Does not write back to `home-hub.json`.** Color picker / animation tab edits live in `useAnimationEditsStore` only. JSON write-back is a downstream concern (touches build-pipeline reproducibility, undo/redo, multi-user concurrency).
- **Does not modify node `.js` modules.** `intent.animationSpec` is a parallel declarative description; the runtime source of truth remains the imperative GSAP calls in `nodes/*.js` (per Invariant 8 — "code is behavior").
- **Does not derive palette colors from the JSON.** `home-hub.json` does not store palette swatches (atlas crops carry their own pixels); the view-model supplies neutral defaults so the picker has something to display.

The complete plan that produced this mapping layer (Phases 0–6, 7 Ralph iterations) lives at `/Users/loganbaird/.claude/plans/i-recently-made-changes-effervescent-church.md`.

### 12.6 Editor parity layer (post-Ralph fix-up)

Two structural fields on every node, set in `home-hub.json` and surfaced through the editor view-model:

- `intent.section: string` — visual section the node belongs to (`navbar`, `hero`, `feature-grid`, `settings`, `footer`, `page`). Drives sub-centroid clustering inside a hub: each section gets its own anchor point on a ring at `hubRadius × 0.55` from hub center, and a `forceSectionCohesion` custom force pulls nodes toward their section anchor. Result: zooming into a hub shows visually distinct section clusters rather than one undifferentiated cloud.
- `intent.editorRole: 'element' | 'background'` — flags full-section / card background fills. The 3D editor, search palette, hub-nav, minimap, and detail-card all filter on `editorRole === 'element'`, so backgrounds (page, navbar, hero-section, hero-card, feature-grid-section, feature-card-{1,2,3}, settings-section, stats-card, footer — 11 of 40 nodes for the home hub) appear as part of the hub's outer mockup shell rather than as nav-able element-spheres. The runtime player still renders all 40 sprites — this is purely an editor-side filter.

Captions are the human-readable artifact: each is prefixed with its section label (`"Navbar — Kriptik wordmark — …"`, `"Hero — pill-shaped CTA button face …"`) so a person reading the JSON can see the section without consulting the structured field.

#### Ratio-based hub sizing in `useForceGraph.ts`

A hub is virtually limitlessly large — its radius is computed dynamically from element count:

```
hubRadius = BASE_HUB_RADIUS × (1 + (elementCount / NODES_PER_BASE_HUB) × HUB_GROWTH_RATIO)
```

with `BASE_HUB_RADIUS=90`, `NODES_PER_BASE_HUB=30`, `HUB_GROWTH_RATIO=0.7`. So a 30-element hub renders at the historical 90-unit radius, a 60-element hub grows to ≈153 units, etc. Every other distance — section sub-centroid radius, intra-section scatter, collision radius, link distances — is expressed as a fraction of `hubRadius`:

| Constant | Ratio | Use |
|---|---|---|
| `SECTION_RADIUS_RATIO` | 0.55 | sub-centroid distance from hub center |
| `NODE_CLUSTER_RATIO` | 0.18 | intra-section scatter |
| `COLLISION_RATIO` | 0.04 | per-node collide radius |
| `LINK_CONTAINS_RATIO` | 0.10 | edge type `contains` |
| `LINK_SHARES_RATIO` | 0.30 | edge type `shares-state` |
| `LINK_DATAFLOW_RATIO` | 0.20 | edge type `data-flow` |
| `LINK_NAV_RATIO` | 0.35 | edge type `navigates-to` |
| `LINK_DEFAULT_RATIO` | 0.25 | other edges |

Camera bounds in `GraphScene.tsx` derive from the largest hub's radius (`minDistance ≈ hubRadius × 0.09`, `maxDistance ≈ hubRadius × 6.5`, with floors of 5/600 to keep small / empty graphs sane), and fly-to offsets scale with the destination hub's specific radius. Adjust ratios here, never hardcode pixel values downstream.

#### Overlay parity

The 5 editor overlays (`SearchPalette`, `HubNav`, `Minimap`, `TopBar`, `DetailCard`) all read from `useGraphSourceStore` via `toEditorView` — the same source the 3D scene reads from. They each apply the `editorRole === 'element'` filter so search results, hub-nav counts, minimap dots, and detail-card lookups match the 3D scene's nav-able set. The legacy `src/data/mockGraph.ts` fixture has been deleted; nothing in `src/` references it.

The plan that produced this fix-up lives at `/Users/loganbaird/.claude/plans/no-its-ok-lets-synthetic-quasar.md`.

### §10 addendum — F5 allowlist (2026-06-20)

`@dimforge/rapier3d-compat@0.19.3` added to `RUNTIME_ALLOW` in `.claude/hooks/dependency-allowlist-check.py`. Rationale: physics for the F5 Atelier configurator's drag-drop part snapping (magnetic anchor sockets + spring-settle joints). `-compat` ships inlined base64 WASM (no bundler/loader config); runs as a headless physics step alongside `three/webgpu` — NOT a second renderer, NOT DOM. Pinned 0.19.x to start fresh on the post-0.18 API (ShapeCastHit rename). See docs/prism/ORRERY-NO7-PROTOTYPE-SPEC.md §1.

### §10 addendum — SHELL W0 allowlist (2026-07-04)

`zod@^3.25.76` added to `RUNTIME_ALLOW` in `.claude/hooks/dependency-allowlist-check.py`
and promoted from a transitive vendored dep to a direct dependency. Rationale: the
frontend-shell spec (PRISM-FRONTEND-SHELL-SPEC.md v1.1, invariant I4 "contract-first
tRPC + Zod") mandates Zod-validated contracts. SHELL W0 authors the shell↔engine
command/event contract (`packages/shared-interfaces/src/prism-shell.ts`), the Brand
Profile schema (`prism-brand.ts`), and the CollabRoom TYPES-only contract
(`prism-collab.ts`, decision E). zod is pure runtime schema validation — no renderer,
no DOM, no transport, no second state library (I3 intact). Version matches the already
vendored 3.25.76 (no downgrade).

### §10 addendum — SHELL W1 allowlist (2026-07-04)

`@trpc/server@^11` + `@trpc/client@^11` added to `RUNTIME_ALLOW` in
`.claude/hooks/dependency-allowlist-check.py` and installed as direct dependencies.
Rationale: the frontend-shell spec (PRISM-FRONTEND-SHELL-SPEC.md v1.1, invariant I4
"contract-first tRPC + Zod") mandates tRPC as the shell's RPC layer, and the W1 wave
prompt requires the chat agentic loop to "wire to a local echo/stub agent endpoint
(tRPC, contract-first)". The agent endpoint is a tRPC v11 router
(`src/server/trpc/`) whose streaming procedure yields Zod-validated events from
`packages/shared-interfaces/src/prism-agent.ts` over `httpBatchStreamLink` — a plain
fetch response stream, NOT a WebSocket (I1 intact) and NOT polling. tRPC carries no
renderer, no DOM, no state library (I3 intact — Zustand remains the only store).
The stub agent is replaced by the real orchestrator in W5 behind the same contract.

### §10 addendum — FLIGHT RECORDER devDep allowlist (W-FR, 2026-07-05)

`hyparquet-writer@^0.16` (+ its single transitive dep `hyparquet`) added to
`DEVDEP_ALLOW` in `.claude/hooks/dependency-allowlist-check.py` and installed as a
**devDependency**. Rationale (deviation D3, `notes/spec-deviations-wfr.md`): the W-FR
spec requires an NDJSON sink with daily rotation **plus a Parquet compaction script**.
Both libs are pure JS with no native code; they are used ONLY by the offline
`scripts/flight-recorder-compact.mjs` (rolls a day's NDJSON training-corpus partitions
into columnar Parquet). They never enter the request path, the client bundle, or any
`src/lib/**` runtime module — the recorder writer itself adds ZERO runtime deps (its
NDJSON sink uses `node:fs`). No dependency was downgraded; no version pin changed.
