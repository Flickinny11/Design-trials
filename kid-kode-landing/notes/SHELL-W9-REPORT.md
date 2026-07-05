# SHELL W9 — LANDING & MARKETING SURFACE — RUN REPORT

**Status:** COMPLETE — BOTH judges PASS, 0 MUST-FIX. `PRISM-SHELL-W9: RUN COMPLETE`
**Branch:** `codex/prism-recovery-harness-20260630`
**Governing:** W9 founder prompt (2026-07-05) · PRISM-FRONTEND-SHELL-SPEC §10(S2)/§12(W6 substrate) ·
DESIGN-REFERENCES.md · DL1–DL16 · W5B/W6 reports (pricing + marketing truth) · V-STANDARD.

## Mission
Build the marketing/landing surface to an Awwwards-winning standard: the landing
page PROVES the product's live photoreal 3D capability by BEING it. WebGPU-first,
photoreal materials from our own pipeline, cinematic motion, honest copy.

## Required surface (checklist)
- [x] 1. HERO — the Forge: full-bleed WebGPU stage (TSL compute galaxy 140k/9k
  fallback, dispersive iridescent glass prism, generated-PBR pedestal, cinematic
  scroll+pointer camera, bloom); DL12 3D Build Key CTA. `LandingHero` + `forge/`.
- [x] 2. CAPABILITY SHOWCASE — `CapabilityShowcase`: one live scene, three states
  (galaxy graph / canvas artifact+gizmo / framed preview-app) with a segmented
  control; proves "one scene, three modes" by being it.
- [x] 3. HOW IT WORKS — `PipelineFlow`: a signal travels a 5-station 3D rail
  (Describe→Plan→Build→Verify→Ship), Build clustered = parallel waves; cards below.
- [x] 4. INTEGRATIONS WALL — `IntegrationsWall`: 9 real, brand-coloured 3D marks
  (reuses shipped `shell/intake/BrandMark3D`, imported not modified); DL15.
- [x] 5. PRICING — W5B shipped truth exactly: removed the invented $29; Managed
  Care $39/mo per app (code-anchored to `server/care/managed-care.ts`), free
  fix-anytime path, Prism Cloud included + host adapters + portable export.
- [x] 6. NAV — machined red hover-seam nav language + reactive brandmark; footer
  site map (W6, retained).
- [x] 7. RESPONSIVE + reduced-motion (all 4 3D sections read
  `usePrefersReducedMotion` → composed still) + WebGL2 auto-fallback.

## Invariants (diff-verified at close)
- [ ] I-CANVAS: `/` editor byte-untouched
- [ ] I-SHELL: outside (marketing) untouched
- [ ] I-SPEC: no canonical spec edits; deviations in notes/spec-deviations-w9.md BEFORE code
- [ ] I-SECRETS: no key material anywhere
- [ ] I-PERF: hero 60fps desktop; a11y=100; perf>=80 desktop
- [ ] I-EVIDENCE: every claim has a frame or command output

## Asset generation
`.assetgen/replicate.key` present + non-empty at run start → generation pipeline ACTIVE.
(Recheck before final polish.)

## Commits (this run, oldest first)
- `07461a6b` asset-provenance audit discharge (founder addendum) — regenerated 4
  PBR sets through the REAL Replicate FLUX pipeline, honest provenance in W9-D4.
- `b0815040` pricing = W5B shipped truth (req #5).
- `479c052a` Forge hero (req #1) — WebGPU showpiece + the missing forge CSS.
- `6c0b571a` integrations wall (req #4, DL15).
- `b8ae0ae1` capability showcase (req #2) + the shared WebGPU clear fix.
- `e74b98f2` how-it-works animated 3D sequence (req #3).
- `1e867d81` nav 3D-hover language (req #6) + reduced-motion wiring (req #7).
- `af544e92` tsc 0-new (forge galaxy TSL typing).
- `bf0032e1` responsive (req #7) — FitWidth for wide 3D layouts + mobile Build key.

## Gate evidence (`notes/verification/shell-w9/`, real production build)
- **npm run verify — EXIT 0**: verify:prism · repair-loop · galaxy · global-shell
  6/6 · parity-static · schema 338/338 · tenancy 35/35 GREEN.
- **tsc --noEmit**: 9 errors (pre-existing baseline); **0 new** in the marketing
  subtree (the forge-galaxy TSL typing was tightened in `af544e92`).
- **Production build**: `npm run build` compiled clean, 48/48 static pages.
- **fps**: hero **60fps** on the real Metal GPU (WebGPU), 121 rAF samples.
- **Lighthouse (desktop, production)**: `/home` — **a11y 100**, perf **81**
  (≥80), best-practices 100, SEO 100, agentic 100; LCP 1.4s, CLS 0.021.
  `/pricing` — a11y **100** after the contrast fix (`93d19042`: cadence/eligibility
  text `--pp-text-low → --pp-text-mid`, was 96 with one 3.26:1 node).
- **Bundles**: `/home` 359 kB First Load (heavy three/webgpu chunks are code-split
  and lazy behind Lazy3D posters, DL8); other marketing routes ~107 kB.
- **Frames**: `final-desktop-01..05` + `final-mobile-01..04` (hero, showcase,
  how-it-works, integrations, pricing) both viewports. metrics.json alongside.
- **Invariants**: I-CANVAS + I-SHELL — `git diff --name-only fe325d0a..HEAD -- src/`
  outside `(marketing)`/`marketing`/`lib/marketing` is EMPTY (shell files reused by
  import, never edited). I-SECRETS — `.assetgen` gitignored; provenance note carries
  prediction IDs only.

## Dual judges — BOTH PASS, 0 MUST-FIX
- **prism-criteria-reviewer**: **PASS, 0 MUST-FIX.** All 7 requirements PASS, all
  invariants PASS (I-CANVAS/I-SHELL/I-SPEC/I-SECRETS), DL11–16 + Font A PASS,
  provenance law PASS (07461a6b/W9-D4 honestly correct the d79b2214 "committed"
  misnomer; the 4 PBR sets were genuinely regenerated). 2 non-blocking nits (nav
  hover is a 2D CSS seam distilled from the shell's 3D language — honestly
  commented; BuildKey3D uses an isolated WebGL canvas).
- **user-advocate**: **FLAGSHIP / PLEASED / PASS, 0 MUST-FIX.** "A real 3D
  product, not another SaaS template." 3 non-blocking polish flags, TWO ADDRESSED
  this round (`b6600b6e`): integrations marks now settle face-forward (spin on
  hover) so every logo reads; the Preview showcase state is now brightly lit. The
  third (evidence hygiene — dev "1 Issue" pill in intermediate `w9-*` captures) is
  resolved by the clean production `final-*` recapture.

## Key gotchas (for the next session)
- **WebGPU MarketingCanvas does not auto-clear.** R3F's default WebGPU render loop
  left the transparent framebuffer uncleared, so any TRANSLATING object ghosted /
  left trails (the "concentric red coils" were orbital node trails; mode switches
  left ghost geometry). Fix: the shared `ClearedRender` helper takes over rendering
  at priority 1 and clears each frame. Scenes with their own PostProcessing pass
  (the hero) already clear and must NOT add it. Wall marks spin in place so the bug
  was invisible there until a mode with orbital motion exposed it.
- **Wide 3D layouts clip on mobile.** Fixed world-space layouts (wall ±4.4, rail
  ±5) fell off narrow canvases. `FitWidth` dollies a perspective camera back on
  narrow/portrait viewports; projected labels follow automatically.
- **Server page can't pass reduced-motion.** 3D sections rendered from the SSR page
  must read `usePrefersReducedMotion` INTERNALLY — a prop defaulting to false silently
  ignored the media query.
- **Contrast: `--pp-text-low` (#5f636c) fails AA on solid cards** (3.26:1). Use
  `--pp-text-mid` (#9aa1ac, ~7:1) for small text over `--pp-elev-*`. Lighthouse
  skips contrast for text over the transparent 3D canvas, so /home passed while
  /pricing (text over solid tier cards) flagged.
- **Dispersive glass over a dark scene** reads as a dark gem — add thin-film
  `iridescence` (surface rainbow, backdrop-independent) + a white back-rim light +
  a hot emissive core, not just `transmission`+`dispersion`.
- The **forge hero CSS did not exist** when this run resumed — the prior session
  shipped the forge TSX but no `.mk-hero-forge*`/`.mk-key*` styles, so it limped on
  leftover W6 rules. Authored in `479c052a`.

## Deviations
See notes/spec-deviations-w9.md (W9-D1 landing at /home; W9-D2 GSAP over Theatre.js;
W9-D3 three pinned at engine-verified r184; W9-D4 true provenance of d79b2214).

## Replicate / Tripo spend (this run)
- Replicate FLUX: the audit-discharge regeneration = 4 flux-2-pro images ≈ $0.24
  (the 13:38 batch was the prior session). Running W9 estimate ≈ $0.48, well
  under the ~$8 cap. No NEW hero/3D-object generations were needed — the Forge
  hero and all W9 sections are authored from committed PBR sets + procedural
  TSL/Three materials + the shipped shell BrandMark set, so no additional
  Replicate or Tripo credits were spent. Tripo: 0 credits used.

**Marker:** `PRISM-SHELL-W9: RUN COMPLETE`
