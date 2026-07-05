# UI EXCELLENCE — make the editor genuinely WOW + fix flagged library + full wow-grade test. (Claude Code, ultracode)
# The bar is WOW. "Acceptable/premium-ish/passes" == FAIL. Logan judges the frames; the monitor is the hard pre-judge.

## MODEL & MODE
MODEL: claude-opus-4-8 (Fable-5 DOWN, silently falls back to opus; confirm modelUsage==claude-opus-4-8 at start AND after
any resume, record in ledger; never trust the label). 1M context. ULTRACODE: Dynamic Workflows, PARALLEL subagents in
verified waves, CONTRACT-FIRST. Branch prism-editor-build, from git root. AUTO-CKPT at every VERIFIED phase (standard
exclusions; worktrees==0). LOGAN-INBOX polling at phase boundaries. ANTI-STUCK: web-search CURRENT (June 2026) technique
after ~2 fails; never downgrade a dep; NEVER fake/assert — evidence (frames + interaction) or it didn't happen. ENV:
NODE_ENV unset; kill all browsers/dev servers at each phase end; free ports. Resumable ledger:
notes/verification/UI-WOW-PROGRESS.md (continuous).

## WHY THIS RUN EXISTS (Logan, on the live app — 3rd time the UI quality has missed; close it for good)
The chrome reads as a competent-but-COLD dark dashboard, not a stunning premium creative tool. The fal/library/animation
tech is deep and amazing; the UI does NOT match it and that's a non-starter. Concrete monitor findings (verified, use them):
- FONTS: premium typefaces ARE loaded (Clash Display / Geist / JetBrains Mono) but (a) layout.tsx/globals.css has a
  `:root`-vs-next/font CASCADE RACE that likely drops chrome to UGLY SYSTEM FALLBACK in places — FIX so the premium
  fonts ALWAYS render, every surface, verified; (b) EXECUTION is cold: tiny wide-tracked mono-CAPS labels dominate and
  set a utilitarian tone; the beautiful display face is barely used; body/demo text reads generic. Rebuild the TYPE
  SYSTEM for beauty: confident expressive display type, real hierarchy, kill mono-caps as the dominant voice, premium
  body, beautiful demo-content type, correct tabular numerals.
- TOOLBARS/PANELS: cramped cold icon-rails + flat dark rectangles that OVERLAP and go semi-transparent over the scene
  (see inspector overlap). Make them genuinely BEAUTIFUL and fix the layout clutter/overlap/transparency.
- DEPENDENCIES: 26 chrome files import gsap/lenis/theatre but nothing on screen SHOWS them. DESIGN-REFERENCES.md is the
  required toolkit; every signature interaction (flyout open, mode morph, hover, scroll, cursor) must use it as a
  NOTICEABLE wow moment. Dependency-usage table required.

## READ FIRST
docs/prism/DESIGN-REFERENCES.md IN FULL. PRISM-CANVAS-EDITOR-SPEC.md §5 (toolbar), §13 (library), §11 (material/chrome),
§18/§19. src/app/layout.tsx + globals.css + design-system (the font wiring + tokens). The PREBUILT-LIBRARY-REPORT.md
honest flags. The existing chrome-layer (real-material chrome from FIDELITY-2 — build ON it, don't regress it).

## PHASE 0 — FIX THE FLAGGED LIBRARY ITEMS (from the monitor's critical review)
- Hide the scene LIGHT-SOURCE spheres (yellow/blue orbs) from ALL library preview tiles + placed-element beauty views —
  beauty-light the preview rig so previews look stunning, not demo-rig-exposed.
- Populate element SURFACES with real sample imagery (use the Prism Media Generator / fal within budget, or curated
  premium textures) so coverflow cards / hero panels / gallery tiles look photoreal and populated in the previews —
  not blank dark panels. Verify each of the 36 elements' preview now looks premium.

## PHASE 1 — TYPOGRAPHY EXCELLENCE (fonts must be BEAUTIFUL, never fall back)
Fix the cascade race → premium fonts render on EVERY surface, always (prove with computed-style checks + frames; no
system fallback anywhere). Rebuild the type system for beauty per the findings above. Research current premium type
treatment (June 2026). Evidence: before/after at DPR-2 with ZOOM CROPS on text across toolbar, panels, captions, demo
content, library. Bar: a type designer would call it beautiful and intentional.

## PHASE 2 — TOOLBAR + PANEL + CHROME BEAUTY + VISIBLE DEPENDENCIES
Make toolbars/panels genuinely stunning in the Observatory-Brass language (build on the rendered-material chrome, elevate
it): refined spacing/proportion, real depth, beautiful controls — not cold rectangles. FIX layout overlap/clutter/
transparency (the inspector must not muddily overlap the scene). Wire DESIGN-REFERENCES dependencies into NOTICEABLE
signature moments: GSAP-choreographed flyout/panel reveals, magnetic/elastic cursor on controls, Lenis-smooth panel
scroll, morph-through mode transitions, micro-motion on hover. Each must be something a user NOTICES and goes "ooh."
Dependency-usage table: surface/interaction → DESIGN-REFERENCES entry → what the user sees. Tier-gated (INV-9), mobile
clean, perf held (<100ms latency, chrome motion budget sane).

## PHASE 3 — FULL WOW-GRADE INTERACTION TEST (drive it like a human; build a real scene)
USER-ADVOCATE (computer-use, real app on GPU) BUILDS + EDITS a real scene end-to-end, DESKTOP and MOBILE: open the
library, drag-place a premium element, edit it, apply an animation from the catalog, open the keyframe editor, USE the
Prism Media Generator (fal) to regenerate an artifact and swap it in, add text (verify the FONT is beautiful), adjust
material + lighting, group — all composed in one scene, simultaneously, stable. The advocate must explicitly answer, with
cited frames: (1) Are the UI fonts BEAUTIFUL (not ugly/fallback)? (2) Is the 3D REAL 3D (depth/perspective/parallax)?
(3) Is "photorealistic" ACTUALLY photorealistic (materials/lighting)? (4) Are the dependencies visibly creating wow?
(5) Would a real user be WOW'd and find it intuitive? Bar = WOW or MUST-FIX (not "acceptable"). DPR-2 zoom crops + the
Slider-Revolution SIDE-BY-SIDE standard. Iterate fix-rounds until zero MUST-FIX at the WOW bar.

## PHASE 4 — SIGN-OFF (only if it genuinely WOWs)
No-regression (406+ catalog + 36 elements render/play/control + full suite + tsc 0-new); perf smooth/fast/responsive
desktop+mobile. Produce the system-test matrix + DPR-2 wow-evidence galleries (the monitor will review every frame and
show Logan — he is the final judge). Clear verdict: does it WOW, end to end?

## GUARDRAILS
One renderer (Three.js/TSL/WebGPU); no PixiJS/2nd renderer; no stock icons; no diffusion-drawn letterforms; no
global-fps; no dep downgrades; additive-only schema; INV-9 tiering; NO PURPLE; design-tokens-only styling; never surface
"fal" in user UI; never print FAL_KEY; secret-leak check before every checkpoint; assertion-based verification FORBIDDEN.
fal budget: same $50 account (~$0.27 spent); cumulative ledger, warn $25/$40, STOP $48.

## OUTPUT
notes/UI-WOW-REPORT.md: P0 library fixes (before/after previews); typography before/after (zoom crops, fallback-killed
proof); toolbar/panel beauty before/after + dependency-usage table (what the user sees); the wow-grade interaction
system-test matrix (desktop+mobile, the 5 explicit answers with frames); SR side-by-side; no-regression + perf; fal
ledger; honest flags; AUTO-CKPT hashes. Frames under kid-kode-landing/notes/verification/ui-wow/. Plain-language summary
+ honest WOW verdict. STOP.
