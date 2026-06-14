# UI WOW 2 — Progress Ledger (resumable)

Branch: `prism-editor-build` · Bar: **WOW** (not "passes"). Evidence (frames+interaction) or it didn't happen.

## Model
- 2026-06-14: session running as **claude-opus-4-8** (confirmed via environment system prompt: "exact model ID is claude-opus-4-8"). Fable-5 down → opus fallback is the intended state. Recorded at start.

## fal ledger
- Starting cumulative (from prior runs, ui-wow/fal-ledger.json): **$0.431**. Warn $25/$40, STOP $48.

## Phase status
- [x] RECON — done. 7 notes under notes/verification/ui-wow-2/recon/. Key findings below.
- [x] P0 MOBILE EXCELLENCE — DONE + VERIFIED. Gates: vitest 3349 pass/8 skip/0 fail (==baseline), tsc 0-new, 0 console errors + 0 bad-responses + webgpu backend on ALL 3 viewports, purple 0.000%, secret-leak clean. Visual: embedded 560px pane clean (was crammed desktop), mobile dock+sheets premium, desktop byte-identical. AUTO-CKPT below. Container-density engine (ResizeObserver on main), BottomSheet system, compact horizontal tool dock + flyout-as-sheet, Inspector family → sheets, MobileModeToggle + HubNav pane-relative. Density proven (constrained: innerW=1440 mainW=560 → compact). tsc 0-new; 0 console errors all 3 viewports.
  NEW files: stores/useEditorLayoutStore.ts, stores/useBottomSheetStore.ts, components/editor/layout/{useEditorLayoutObserver.ts,BottomSheet.tsx}; tokens.css (z+safe-area+sheet vars). EDITS: page.tsx, CanvasToolbar.tsx, HubNav.tsx, panels/{Inspector,HubInspector}.tsx (subagent). Harness: scripts/uiwow2-capture.mjs (3 profiles incl. constrained=clamped main in wide viewport).
- [x] P1 KEYFRAME EDITOR — DONE + VERIFIED. vitest 3349/0 (==baseline), tsc 0-new, purple 0.000%, 0 console errors webgpu. Visual: desktop clip-expand strip + compact bottom-sheet, both premium + data-bound (populated diamonds across Translate/Scale/Rotate from captured keys, Opacity empty per model; "3 KEYS" count). Reveal sequence frames show clip-expand + lane cascade. AUTO-CKPT below.
  IMPL: Extracted to NEW components/editor/overlays/KeyframeEditor.tsx (de-bloats CanvasToolbar). (1) Smoky EXPANDING reveal: GSAP timeline — desktop clip-expand(inset 100→0 round) envelope + dissipating brass/ice smoke blobs + high-tech scan sweep + lane cascade + diamond back.out pop (~0.55s, reduced-motion safe). (2) Data-bound: lanes derived from real node.keyframes (source⊕preview), grouped by param (Opacity/Translate/Scale/Rotate); empty-state hint when none. (3) Live: play transport sweeps playhead (rAF), click-diamond-to-seek, "+" captures keyframe at playhead via captureCanvasTransformAsKeyframe→usePreviewStateStore (FP-15 intent). (4) Compact: re-housed as BottomSheet (full snap) so it never fights the dock. tsc 0-new.
- [x] P2 GALAXY VIEW WOW — DONE + VERIFIED. NEW components/editor/graph/GalaxyAtmosphere.tsx (additive emissive geometry, works under WebGPU where bloom-composer + drei Stars are off): GalaxyStarfield (twinkling parallax points), GalaxyNebula (additive haze billboards = real 3D depth), GalaxyOrbitRings (the 3 tilted orrery rings as glowing torus bands — were invisible), SunCorona (layered additive shells → sun reads as a STAR). + upgraded GalaxyHubTethers from 1px grey lines → glowing additive bowed tubes (orbit-arcs) with energy pulse. Tier-scaled (quality low/high). NO post-bloom render-loop surgery (safe). Verified: glowing sun/rings/tethers + atmosphere on desktop+mobile+constrained-embedded, 0 console errors webgpu, purple 0.000%, vitest 3349/0, tsc 0-new. AUTO-CKPT below. (deferred: TSL fresnel node-glass, WebGPU post-bloom, camera auto-orbit — noted, not blocking.)
- [ ] P3 CANVAS + TOOLBAR WOW POLISH — combined-dep signature effects; prompt→texture on TEXT (poured textures + 3D depth + shadows)
- [ ] P4 PERFORMANCE — lightning-fast mobile+constrained+desktop; tier-gated (INV-9); frame budget + <100ms latency + memory; deviceLost 0
- [ ] P5 FULL INTERACTION VERIFICATION — advocate builds+edits a real scene across desktop+mobile+constrained; 5 wow Qs; 0 MUST-FIX

## Recon key findings (the contract inputs)
- **Chrome is already WOW** (prior UI-WOW run: Observatory Brass, 3-voice type, magnetic cursor, Lenis, GSAP flyouts, TSL glass slabs). UI-WOW-2 = the NEXT layer: mobile/container responsiveness + keyframe + galaxy + perf-for-embedding.
- **Renderer**: ONE three/webgpu canvas (GraphScene). Chrome = GPU slabs via `useChromeSlab` (tier-gated: inert below t2 → CSS .ds-glass stands). **INV-R14: WebGPU SKIPS @react-three/postprocessing EffectComposer** → galaxy glow must be TSL emissive/additive geometry, NOT the postprocessing dep.
- **Responsive today = BROKEN for embedding**: page swaps desktop/mobile JSX trees on `window.innerWidth>=900` (page.tsx:139,206-211,658,815) — keys off VIEWPORT not CONTAINER, so a narrow preview-pane in a wide browser renders the desktop tree crammed into the pane. Tailwind md/lg utils same blindness. ChromeSlabLayer is already rect-driven so it tracks reflow once DOM layout is container-aware.
- **Toolbar** (CanvasToolbar.tsx): `left-3` vertical rail of 11 GPU-slab keys, flyouts open right (252/424px) → 424px Animation flyout overflows phones. Zero responsive logic. Radix Tooltip installed but unused (native title= only).
- **Panels** (Inspector/Hub/World/Group via RightPane): one mounts at a time; mobile = full-bleed `rounded-none` edge-pinned takeovers occluding the scene. Writes route via `usePreviewStateStore` (FP-15). useChromeSlab hooks run before early returns.
- **Verify**: harness `scripts/ui-wow-capture.mjs` (channel:'chrome', headless:false, WEBGPU_ARGS = real Metal). Backend check: `window.__PRISM_RENDERER_BACKEND__==='webgpu'` (else SwiftShader=invalid). Hooks: `__PRISM_EDITOR_SET_VIEW_MODE__(galaxy|canvas|preview-app)`, `__PRISM_DEBUG_STORES__.{graphEditor,graphSource}`. No-reg: `npx vitest run` (3349 pass/8 skip/0 fail), `npm run typecheck:gate` (0-new ~9 baseline), `npm run verify:catalog`, purple-scan, perf-probe.

## P0 ARCHITECTURE (decided)
1. **Container-density engine**: `useEditorLayoutStore` (zustand) + ResizeObserver on `<main>` (switch main `w-screen h-screen`→`w-full h-full`). Publishes `{width, density: compact|regular|wide}`. Replaces `isDesktop`/innerWidth. `data-density` on main. compact<760, regular 760–1180, wide≥1180. THE headline fix (embedded-pane correct).
2. **BottomSheetHost + useBottomSheetStore** (NEW): draggable glass sheet, snap points peek/half/full, GSAP `back.out` spring + drag, Lenis momentum body, useChromeSlab glass (degrade <t2), safe-area-inset-bottom. Replaces full-bleed mobile panel takeovers + hosts compact toolbar flyouts.
3. **Responsive toolbar (compact)**: vertical rail → horizontal scroll-snap bottom dock; flyouts → bottom-sheets. Desktop unchanged.
4. **Radix Tooltip** upgrade (brass plates) + `--ds-z-*` tokens.
Discipline: pure-DOM overlays (one renderer intact), tokens-only, no purple, no 4th viewMode, additive stores.

## Log
- 2026-06-14: Session start. Recon complete on environment: node v22.22.1 (nvm path), branch clean at 8eda1ba2 (launch-kit scaffolding only — P0-P5 are greenfield). Deps for combining confirmed. Keyframe UI is embedded in AnimationFlyout/Inspector (no standalone file). Galaxy renders via GraphScene galaxy mode.
