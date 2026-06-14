# UI-WOW — Progress Ledger (resumable)

**Run:** UI EXCELLENCE — make the editor genuinely WOW + fix flagged library + full wow-grade test.
**Branch:** `prism-editor-build` · **Model contract:** claude-opus-4-8 (Fable-5 down → falls back to Opus; verify modelUsage each resume).
**Bar:** WOW. "Acceptable/premium-ish/passes" == FAIL. Logan judges the frames; the monitor (this orchestrator) is the hard pre-judge — evidence (frames + interaction) or it didn't happen.
**Started:** 2026-06-13.

## Model ledger
| Checkpoint | modelUsage observed | note |
|---|---|---|
| start | claude-opus-4-8 (env-reported) | Opus 4.8, 1M ctx, ultracode |

## fal ledger (cumulative — same $50 account)
| Run | spend | cumulative | note |
|---|---|---|---|
| prior (all runs to date) | — | ~$0.263 / $50 | per PREBUILT-LIBRARY-REPORT |
| this run P0 imagery | $0.148 | ~$0.411 / $50 | 12 premium FLUX-2 sample images → public/prism-mock/library-content/ (arch/landscape/abstract/product/portrait/editorial/botanical) |
| (running total) | $0.148 | ~$0.411 / $50 | warn $25/$40, STOP $48 |

## Harness facts (verified)
- node: `/opt/homebrew/bin/node` v24 (PATH must include it). nvm default v22 also works.
- dev server: `npx next dev -p <PORT>` (prebuilt `public/prism-assets/mock-app.prism` present — no build:prism rebuild needed). Editor at `http://localhost:<PORT>/`.
- real GPU: Playwright `chromium.launch({ channel:'chrome', headless:false, args:['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-features=Vulkan,WebGPU'] })`. DPR-2 via `newContext({ deviceScaleFactor:2 })`. Mobile: 390×844 DPR-3.
- editor view-mode hook: `window.__PRISM_EDITOR_SET_VIEW_MODE__('galaxy'|'canvas'|'preview-app')`. Boot default = preview-app (RA-17).
- capture harness: `scripts/ui-wow-capture.mjs` (this run). Evidence → `notes/verification/ui-wow/`.

## Phase status
- [x] P0 — library fixes — DONE + pushed (commit c45c844f). Studio softbox backdrop (orbs killed) + premium imagery on 36 content surfaces; tsc 0-new; real-GPU verified (coverflow/gallery/sliders/feature-grid/testimonials all premium).
- [x] P1 — typography — DONE. Cascade-race CLOSED (font-after.json: every surface resolves to a loaded next/font face ui/display/mono, ZERO serif). 3-voice hierarchy live: mode-toggle/nav/buttons/breadcrumb/body→Geist, wordmark/panel-titles/library-header→Clash, numerals/IDs/shortcuts/kicker→mono. Foundation: tokens.css (cascade fix + scale + ds-track/fs/lh tokens), materials.css (ds-label/ds-btn/ds-input→Geist, +.ds-display/.ds-headline/.ds-body/.ds-num). Sweep: 8 always-visible surfaces (page mode toggle, TopBar, HubNav, library browser+tile, CanvasToolbar SectionLabel/keys/flyout-title, Inspector, DetailCard). tsc 0-new (9 baseline); 0 console errors; real-GPU DPR-2 crops in notes/verification/ui-wow/p1/. NOTE for P2: centered mode pill overlaps TopBar zoom readout (layout fix); panels still flat (beauty).
- [ ] P1 — typography excellence (cascade-race fix + type rebuild)
- [ ] P2 — chrome beauty + visible dependencies
- [ ] P3 — wow-grade interaction test (advocate, desktop+mobile, fix-rounds → 0 MUST-FIX)
- [ ] P4 — sign-off (no-regression + perf + report + verdict)

## Key file map (from recon)
- Layout/fonts: `src/app/layout.tsx` (next/font/local), `src/app/globals.css`, `src/components/editor/design-system/tokens.css` + `materials.css` + `tier.ts`.
- Layout spine / mount / z-stack: `src/app/page.tsx`.
- Toolbar: `src/components/editor/overlays/CanvasToolbar.tsx` (KeyframeEditorPanel ~1540 = CSS shell "CATALOG FORTHCOMING").
- Inspector: `src/components/editor/panels/Inspector.tsx` (+ `HubInspector.tsx`, `RightPane.tsx`).
- Chrome GPU layer: `src/components/editor/chrome-layer/` (useChromeSlab, ChromeSlabLayer, ModeTransitionConductor, material, registry).
- Library: `src/components/editor/elements/ElementLibraryBrowser.tsx`; preview rig `cluster-tile-renderer.ts` (light spheres :279-292); animation-catalog `shared-tile-renderer.ts` (spheres :404-411).
- Element catalog: `src/lib/editor/elements/` (contract/registry/instantiate) + `catalog/*.ts` (36 elements, all flat baseColors, no maps). Texture path: instantiate.ts:120-128 → default-factory.ts (plane sourceAsset→map :233-250, mesh baseColorMapUrl→map :401-413, faceTextures :391-396). Imagery in `public/prism-mock/{home/nodes,orrery}/`, `public/prism-assets/chrome/`.
- Change-Artifact wizard (media gen): `src/components/editor/change-artifact/` (ChangeArtifactWizard, PromptWizard, UploadWizard).
- Deps: gsap 3.13 wired (~13 files, `magnetic.ts`, ModeTransitionConductor); **lenis ^1.3 installed but NEVER imported (dead → wire it)**; **@theatre/core NOT installed (keyframe panel is a shell)**; use-tilt.ts solid but only on showcase page.
- Typography audit: ds-kicker ×86, ds-label ×23 (mono-caps ×109) vs ds-title ×20 → mono-caps dominate (the cold tone).

## FONT GROUND-TRUTH (font-probe.json, real GPU) — the cascade-race, located
- Premium faces DO load, but ONLY under next/font generated names `display`/`ui`/`mono` (status "loaded"). `--ds-font-*` chains start with those → currently renders correctly (widths distinct from fallbacks: ds_display 727.67 vs serif 639 / sans 679).
- **BUG:** tokens.css fallback names `'Clash Display'`/`'Geist'`/`'JetBrains Mono'` are NOT registered → they render as **serif** (measured 639.09 == serif). `document.fonts.check()` returns true (misleading — true means "nothing pending", not "face exists"). So the "safety net" the comment claims degrades to a clean sans actually degrades to **serif** — the cascade-race the monitor flagged. ANY subtree missing the next/font var → ugly serif.
- **P1 fix:** replace the booby-trapped literal-name fallbacks in tokens.css `--ds-font-*` with real system fallbacks (`ui-sans-serif, system-ui, sans-serif` / `ui-monospace,...`), so the degraded path is clean sans, never serif. Then verify computed first-family is a loaded face on every surface.

## Decision log
- (start) Orchestrator owns visual judgment + tight iteration with real-GPU DPR-2 frames it actually reads; Workflows for parallel breadth; user-advocate subagent for P3.
- (P0) Light "spheres" = 4 emissive bokeh in cluster-tile-renderer `addBackdrop` :279-292 (intentional refraction targets, but read as exposed light orbs). Fix = replace with a premium studio backdrop (soft softbox strips + gradient, no discrete orbs); mirror in animation-catalog shared-tile-renderer.
- (P0) Sample imagery: reuse existing premium orrery/home library ($0) for material/hero elements + generate a small DIVERSE premium set via fal for galleries/coverflows/sliders/avatars (watch-cosmos theme alone would read repetitive). Wire via member `sourceAsset` (plane) / `materialSpec.baseColorMapUrl` (mesh) → default-factory.

## P1 TYPE-SYSTEM DESIGN (planned)
Roles: **Clash Display** = signature voice (titles/headlines/hero numbers — currently barely used, ds-title ×20). **Geist** = workhorse readable voice (labels, buttons, body, inputs, descriptions — must REPLACE the mono-caps bulk). **JetBrains Mono** = SPICE only (numeric readouts, small instrument kickers/tags, shortcuts).
Tailwind: `font-display`→Clash, `font-ui`/`font-sans`→Geist, `font-mono`→JetBrains. `font-mono` used in 64 chrome files (the cold dominance); `font-display` in ~3.
Changes:
1. Cascade fix (tokens.css): replace booby-trapped `'Clash Display'`/`'Geist'`/`'JetBrains Mono'` var() fallbacks (render serif) with `ui-sans-serif…`/`ui-monospace…` so the degraded path is clean sans, never serif.
2. Rebalance the shared ds-* classes (materials.css) — improves all usages at once: `.ds-btn` mono→Geist 600; `.ds-label` mono-caps→Geist refined; `.ds-input`/`.ds-select` mono→Geist (tnum where numeric); `.ds-title` → more confident Clash (weight/size). Keep `.ds-kicker`/`.ds-chip` mono as the accent. Add `.ds-display`/`.ds-headline` (big Clash), `.ds-body` (Geist readable), `.ds-num` (mono tabular).
3. Targeted surface upgrades: panel/modal/flyout/library titles → display; descriptions → ds-body; numeric values → ds-num.
Verify: computed first-family is a loaded face on every surface (no serif); DPR-2 zoom crops before/after on toolbar/panels/captions/library/demo.

## Checkpoints (AUTO-CKPT at each VERIFIED phase)
| Phase | commit | what |
|---|---|---|
| (pending) | | |
