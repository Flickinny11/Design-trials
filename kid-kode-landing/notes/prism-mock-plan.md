# Prism Mock App — Phase Plan

Source spec: `docs/prism/PRISM-MOCK-APP-BUILD-SPEC.md` (2009 lines, fully read).

## Repo-vs-spec path adaptations

The spec assumes paths like `components/editor/MockApp.tsx`, `lib/prism/`. This repo uses `src/`:

| Spec path | This repo path |
|---|---|
| `components/editor/MockApp.tsx` | `src/components/editor/preview/LivePreview.tsx` (REPLACE) |
| `components/editor/GraphPane.tsx` | `src/components/editor/graph/GraphScene.tsx` (DO NOT MODIFY) |
| `components/prism-player/` | `src/components/prism-player/` |
| `lib/prism/` | `src/lib/prism/` |
| `lib/graph-store.ts` | `src/stores/useGraphEditorStore.ts` |
| `public/prism-assets/` | `public/prism-assets/` (unchanged) |

The current `LivePreview.tsx` is React/HTML and is what we are replacing with `PrismHost.tsx`.

## Package manager

Repo currently uses npm (has `package-lock.json`). Mock spec uses pnpm in script examples. **Decision: use npm** to match existing tooling. Package scripts use `npm run` commands.

## Tool adjustments

- **ffmpeg** not installed in the container. Use `ffmpeg-static` package for the Node provisioning script to extract i2v frames.
- **msdf-atlas-gen** is a C++ CLI not always installable via npm. Use `msdf-bmfont-xml` (pure JS, PixiJS-compatible) instead — output format maps to PixiJS v8 `BitmapText` via `fontType: 'msdf'` loader data.
- Actually re-check: the `msdf-atlas-gen` npm package exists as a wrapper. If it installs cleanly it's preferred (produces `.json` output PixiJS expects). Fall back to `msdf-bmfont-xml` if install fails.

## Phase plan

- [x] **Phase 0** — skills, CLAUDE.md, specs (committed `260e63c`)
- [ ] **Phase 1** — scaffolding + deps
  - Create `src/lib/prism/{player,local-backend,artifact,mock-app-source}/` tree
  - Create `src/components/prism-player/`
  - Update `package.json`: add `pixi.js`, `jszip`, `@fal-ai/client`, `dotenv`, `ffmpeg-static`, `sharp`, `maxrects-packer`, `globby`, `msdf-atlas-gen` (or `msdf-bmfont-xml`); remove both `html-to-image` entries
  - Add scripts: `provision-assets`, `build:atlas`, `build:msdf`, `build:prism`, update `dev` + `build`
  - Update `.gitignore` per spec §8.4
  - `npm install`
- [ ] **Phase 2** — hand-author `src/lib/prism/mock-app-source/hubs/home-hub.json` with ~35 nodes
  - Sections: page-bg, navbar (7 nodes), hero (5), feature-grid (12), settings (2), stats (2), footer (8)
  - Each node: nodeId, subtype, parentHubId, visual{sourceAsset, transform, region (to be filled in by atlas build), region-by-state if any}, intent{caption, behaviorSpec, visualSpec{textContent[]}, stateEffects[]}
  - Edges: triggers, data-flow, state-update
- [ ] **Phase 3** — `provision-assets.mjs` (fal.ai)
  - Use `@fal-ai/client`; current model IDs: `fal-ai/flux/dev` or `fal-ai/flux-pro/v1.1` (verify at docs.fal.ai), `fal-ai/ideogram/v2` for text-baked, `fal-ai/kling-video/v1.6/pro/image-to-video` for i2v
  - Style-lock: generate `_style-reference.png` first, reference via `image_url` on every subsequent call
  - Idempotent: skip existing outputs; write `.provisioning-manifest.json`
  - Download Inter-Variable.ttf to `public/fonts/` from Google Fonts first
  - Extract i2v frames via `ffmpeg-static`
- [ ] **Phase 4** — atlas build
  - `build-atlas.mjs`: Sharp+SVG text compositing → MaxRects 2048×2048 pack → AVIF quality 75 → `public/prism-assets/atlas-0.avif` + `atlas-regions.json`
  - `build:msdf` npm script invokes msdf tool → `public/prism-assets/font-inter.msdf.{png,json}`
  - Sanity preview → `public/prism-assets/atlas-preview.html`
- [ ] **Phase 5** — `.prism` assembly (`build-prism.mjs`)
  - JSZip package: manifest.json + graph.json + nodes/*.js + backends/*.js + schemas + assets
  - Write to `public/prism-assets/mock-app.prism`
- [ ] **Phase 6** — `createNode` per node in `src/lib/prism/mock-app-source/nodes/{nodeId}.js`
  - Forbidden: `PIXI.Text`, `PIXI.Graphics` for visible chrome, CSS/HTML
  - Allowed: sprites from atlas regions, BitmapText for MSDF dynamic text only, GSAP transforms, overlay layers, Graphics only for masks/hitAreas
  - Patterns: §3.4.1 CTA (overlay glow+shimmer), §3.4.2 toggle layer-swap, §3.4.3 i2v frame cycle, MSDF counter
- [ ] **Phase 7** — `PrismPlayer` runtime
  - `boot.ts`, `pixi-init.ts`, `atlas-loader.ts`, `hub-manager.ts`, `module-registry.ts`, `state-manager.ts`, `event-bus.ts`, `backend-client.ts`
  - Scroll viewport with momentum (wheel + touch + keyboard)
  - Responsive layout engine (desktop wide/standard/tablet/mobile)
  - Hub manager with reparent-on-navigate (single hub for mock but pattern-correct)
- [ ] **Phase 8** — local backend runtime
  - `src/lib/prism/local-backend/{index,router,fake-db}.ts` + `handlers/` dynamically loaded from .prism backends/
- [ ] **Phase 9** — integration
  - `src/components/prism-player/PrismHost.tsx` — canvas + mount
  - `src/app/page.tsx` — swap `LivePreview` import → `PrismHost`
  - `src/stores/useGraphEditorStore.ts` — add `prismGraph` + `setGraphFromPrism`
- [ ] **Phase 10** — toy SHR
  - `shr/{telemetry,divergence,local-repair-mock}.ts`
  - Hidden `window.__prismBreakNode(nodeId)` dev tool
- [ ] **Phase 11** — verify the 25 success criteria
- [ ] **Phase 12** — final commit/push (draft PR #1 already open)

## Key decisions — locked

1. **Every visible pixel must come from a fal.ai-generated atlas image.** No `PIXI.Graphics` rectangles for chrome. No `PIXI.Text`. Three text methods only: `sharp-svg` composited at build, `msdf` BitmapText at runtime, `diffusion` baked at gen.
2. **Three animation methods coexist.** Method 1 (i2v frame cycle) used on at least one element (hero-section-bg). Method 2 (GSAP transforms) ubiquitous. Method 3 (overlay layers) for glow/shimmer/ripple etc. — overlays are reusable atlas regions, not drawn.
3. **State transitions are layer swaps.** toggle-off.png + toggle-on.png + button-default/hover/pressed.png — each state is its own atlas region; code controls visibility.
4. **Only the graph pane components are sacred.** Everything in `src/components/editor/graph/`, `src/components/editor/overlays/`, `src/components/editor/panels/`, `src/components/editor/icons/` stays byte-identical. Only `src/components/editor/preview/LivePreview.tsx` gets replaced (via the `src/app/page.tsx` import swap to `PrismHost`).

## Budget caveat

This phase plan will consume many K tokens across phases. I'll commit after each phase so progress is never lost.
