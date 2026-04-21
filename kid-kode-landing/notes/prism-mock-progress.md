# Prism Mock App — Progress Log

Running log, updated after every phase. Resumption-friendly.

Current branch: `prism-main` (single-branch work per user instruction).
Working directory: `kid-kode-landing/` inside the `Design-trials` repo root.

## Completed

- [x] **Phase 0** — skills (`.claude/skills/prism-{architecture,atlas,fal,pixijs}/`), `CLAUDE.md`, specs (`docs/prism/PRISM-{ENGINE-SPEC-V3,MOCK-APP-BUILD-SPEC}.md`), `notes/prism-mock-plan.md`, Inter-Variable font, package.json deps + scripts, `.gitignore`. Merged as `3f40748` via PR #1.
- [x] **Phase 1 (reapplied locally on Mac, 2026-04-21)** — dir tree, `.env.local` with FAL_KEY, `npm install` clean.

## In-progress

- [ ] **Phase 1.5 — anti-drift hardening (THIS SESSION)**
  - `.claude/settings.json` — hooks checked in.
  - `.claude/hooks/anti-drift-check.sh` — PreToolUse Write/Edit enforces §1.4 forbidden patterns inside prism runtime/build code.
  - `.claude/hooks/spec-presence-check.sh` — SessionStart announces spec locations + sanity checks them.
  - `notes/prism-spec-extract.md` — 1336-line literal extract from the mock spec (every node, schema, code template, §10 success criteria). Durable reference so future sessions don't have to re-read the full spec.
  - `notes/prism-mock-progress.md` (this file).

## Completed (this session continued)

- [x] **Phase 2** — `src/lib/prism/mock-app-source/hubs/home-hub.json` authored (40 nodes, 15 edges, single hub). Validated unique IDs + resolvable edges. Commit `0d29c84`.
- [x] **Phase 3** — `provision-assets.mjs` with style-lock, idempotency via intent hash, retry with backoff, ffmpeg-static frame extraction. Models locked: flux-2 (base), ideogram/v3 (diffusion text), kling-video/v2.6/pro (i2v).
- [x] **Phase 4** — `build-atlas.mjs` + `build-stubs.mjs`. Atlas: 4096×4096, AVIF q=75, MAX_REGION_LONG_SIDE=1024 (full-canvas bgs downsampled, player stretches). Deterministic (assetKey-sorted pack order).
- [x] **Phase 5** — `build-msdf.mjs` via msdf-bmfont-xml → `font-inter.msdf.{fnt,png}` in public/prism-assets/.
- [x] **Phase 6** — `build-prism.mjs`. JSZip DEFLATE, SHA256 per entry, rollup `artifactHash` = sha256 of sorted `path:hash` list. Manifest registers assets with hashes.

### Pipeline smoke test (with stubs)

`npm run build:stubs && npm run build:atlas && npm run build:msdf && npm run build:prism` produces a valid 301KB `mock-app.prism` with:
- 10 zip entries (graph.json + 4 assets + meta/ + manifest.json)
- 40 nodes, 15 edges, 1 hub
- atlas 188KB (79/80 source images packed; 1 overflow in bin 2 — acceptable, real FAL-generated images will have different dimensions)
- artifactHash: `4ffb7c7eaae55f52e47be8ec588f197164d3cfbcd3513e5952fe34a123b67e1d` (stub-based baseline; will change when real FAL assets are used)

## Pending

- [ ] **Phase 7** — 40 per-node `createNode()` modules in `src/lib/prism/mock-app-source/nodes/`.
- [ ] **Phase 8** — backend handlers in `src/lib/prism/mock-app-source/backends/`.
- [ ] **Phase 9** — PixiJS runtime player in `src/lib/prism/player/` (boot, atlas-loader, hub-manager, scroll-viewport, event-bus, state-manager, module-registry).
- [ ] **Phase 10** — LocalBackend + FakeDb in `src/lib/prism/local-backend/`.
- [ ] **Phase 11** — SHR (telemetry watchdog, divergence detection, toy repair, `window.__prismBreakNode`) in `src/lib/prism/shr/`.
- [ ] **Phase 12** — `src/components/prism-player/PrismHost.tsx` + wire into `src/app/page.tsx` (replace the React-based `LivePreview`).
- [ ] **Phase 13** — QA: grep checks vs §1.4 forbidden patterns + verify 25 success criteria.

## Resumption prompt (for a fresh session if this one dies)

Copy-paste verbatim into a new Claude Code session on this repo:

> I'm continuing the Prism mock-app build in `kid-kode-landing/` on the `prism-main` branch. Read `notes/prism-mock-progress.md` for current phase state, `notes/prism-mock-plan.md` for the full phase plan, and `notes/prism-spec-extract.md` for the literal spec reference (so you do not need to re-read the full 2000-line spec). Load these skills: prism-architecture, prism-pixijs, prism-atlas, prism-fal. Anti-drift hooks are live (`.claude/settings.json`) — they will block `PIXI.Text`, unchecked `PIXI.Graphics`, `innerHTML`, `fillText`/`strokeText` inside `src/lib/prism/**`. Resume from the first unchecked phase in the progress log. Commit after each phase and update the progress log. Before context compaction, write a handoff summary and a new resumption prompt.

## Deterministic-artifact contract

- `home-hub.json` → stable key ordering: `nodeId, subtype, parentHubId, serviceTag, visual, intent, codeRef, backendRef`. Nodes in spec-declared section order (page-bg → navbar → hero → feature-grid → settings → stats → footer).
- `.prism` manifest includes SHA256 of every asset + aggregate `artifactHash` (SHA256 of sorted asset-hash concatenation). `build-prism.mjs` prints the hash; tests assert against a locked value in `notes/prism-mock-progress.md` once baseline is set.
- Atlas packing seed locked to `0` for reproducibility across runs.
- All JSON files written with 2-space indent, LF line endings, trailing newline.

## Spec ambiguities resolved

- **`signin-modal`, `build-panel`, `user-preferences-store`** referenced in `triggersDownstream` but not defined as nodes. Resolution: emit them as `triggers` edges with external `to` targets; the home-hub graph contains only home-hub nodes, but these edges document intent for future hubs. Graph pane renders them as "dangling-out" edges with no target sphere.
- **`hub-router`** is a virtual target (not a node). Nav-link triggers emit edges `to: "hub-router"`; the scroll engine resolves them to section-id scroll targets at runtime.
- **pnpm vs npm.** Spec §8.3 uses `pnpm`. Repo uses npm (has `package-lock.json`). Decision: npm throughout. Already reflected in `package.json`.
- **`msdf-atlas-gen` vs `msdf-bmfont-xml`.** `msdf-atlas-gen` is a C++ binary flaky on macOS; `msdf-bmfont-xml` is pure JS and outputs PixiJS-v8-compatible data. Decision: `msdf-bmfont-xml` via a `build-msdf.mjs` script (not the CLI invocation in spec §5.3).
