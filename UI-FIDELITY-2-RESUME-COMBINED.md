# RESUME MODE — a prior session of this run was interrupted. Read notes/verification/UI-FIDELITY-2-PROGRESS.md + git
log (AUTO-CKPT/SAFETY-CKPT) FIRST. Verify the ledger's claims cheaply (files exist, tsc baseline, latest frames), do
NOT redo verified work, continue from the first incomplete wave. Check notes/LOGAN-INBOX.md. Be token-efficient.
# UI FIDELITY 2 — REAL rendered materials. Kill the "AI-built" look for good. (Claude Code, ultracode, post-completion-run)

## VERDICT THIS EXISTS TO FIX (Logan, on the live app)
"It doesn't look high-fidelity. It looks AI-built: flat, bland, basic, boring text. The runtime can render photoreal
glass and fire, and the UI looks like this?" Observatory Brass v1 used CSS approximations of materials; CSS gradients
read FLAT in person. This pass replaces approximation with REAL RENDERING.

## MODEL & MODE
claude-fable-5 (confirm line 1). ULTRACODE waves, contract-first. Branch prism-editor-build, from git root.
AUTO-CKPT at verified wave boundaries (standard exclusions). LOGAN-INBOX polling rule applies. ANTI-STUCK: web-search
CURRENT (2026) techniques — research award-level WebGPU UI chrome before building; do not default to habit.

## DECISIONS
1. ONE renderer: Three.js/TSL/WebGPU (already proven photoreal in this codebase). Babylon was suggested in spirit —
   the SPIRIT is "real 3D rendering for chrome"; a 2nd engine is forbidden (INV) and unnecessary. Theatre.js remains
   the motion clock.
2. REAL material chrome: toolbar docks, buttons, panels, flyouts, sliders become RENDERED surfaces (shared offscreen
   WebGPU layer(s) or in-scene quads): true Fresnel edge response, ambient refraction from the scene env, specular
   bevels with perspective, micro-normal materials (brushed metal, smoked glass, ceramic). Pointer-reactive (light
   responds to cursor). CSS remains only for layout/text flow — anything VISIBLE as a surface is rendered.
   Capability-tiered per INV-9 (T0 gets the v1 CSS look as fallback; T1+ gets real materials; never broken).
3. TYPOGRAPHY OVERHAUL: deliberate, professional system — premium variable font(s) with optical sizing, tracked
   micro-labels, numeric tabular alignment, real hierarchy. Nothing that reads "default". MSDF where text lives
   in-scene; tack-sharp at DPR 2 everywhere.
4. EVIDENCE BAR: every before/after judged at devicePixelRatio 2 with ZOOMED CROPS; advocate standard = "would a
   professional 3D designer sign this?" + Logan's finish-line quote. Perf budget: T1 holds frame rate; chrome layer
   <2ms/frame median; mobile clean fallback.

## SCOPE
All editor chrome: CanvasToolbar + flyouts/buttons/sliders, inspector/detail panels, catalog frame (tiles already GPU
-rendered — unify their frames into the material language), overlays, HUD/mode toggle, keyframe shell, boot. 312
no-regression + all completed-phase features keep working (text, picker, media, 3D objects).

## OUTPUT
notes/UI-FIDELITY-2-REPORT.md: per-surface before/after WITH zoom crops at DPR2, advocate verdicts, perf table,
honest flags. AUTO-CKPTs. Plain-language summary. STOP.

## AMENDMENT (2026-06-10, from Logan — this is now the CENTER of this run)
READ docs/prism/DESIGN-REFERENCES.md IN FULL BEFORE ANY DESIGN WORK. It is the canonical 1,066-line catalog of the
premium libraries + techniques this product is built around (GSAP/ScrollTrigger choreography, Lenis-class inertia,
curtains-style distortion, mouse-follower/magnetic cursor physics, WebGPU compute particles, ray-marching/SDF, view
transitions, + ~29 libraries with difficulty notes). THE EDITOR IS THE SHOWCASE: every toolbar, button, panel, element,
animation, and style in the chrome must demonstrably use this stack — directly where the dependency fits the
one-renderer/WebGPU architecture, or as a faithful TSL/WebGPU-native implementation of the catalogued technique where
the library is DOM/2D-era. The report must include a DEPENDENCY-USAGE TABLE: each chrome surface → which
DESIGN-REFERENCES entries it uses and how. A surface using none of them is a MUST-FIX. Logan's words: "I don't see how
we can offer this to a user as a premium builder while our UI itself doesn't even use those dependencies."

## THE BENCHMARK (2026-06-10, from Logan — make it concrete)
The named competitive bar is Slider Revolution-class tools: premium templates, morphing/3D page transitions,
story-driven pages you "morph into." Ours must not match — it must VISIBLY SMASH it. At build time, RESEARCH their
current pages/templates/showcases (June 2026 web) and write a short "what makes theirs feel premium" analysis FIRST;
then design ours to outclass it: morph-through transitions between editor states (picker→canvas→preview should feel
like morphing INTO the workspace, not panel swaps), story-grade choreography on boot/mode changes, the
DESIGN-REFERENCES stack visibly at work. ADVOCATE STANDARD: side-by-side judgment — "set our editor next to a Slider
Revolution showcase: which looks like the more premium, more advanced product?" If the answer isn't OURS, decisively,
it's a MUST-FIX. Our tech is lightyears ahead; the chrome must look like it.

## ADDENDUM 2 (2026-06-11, post-completion-run): THE SHOWCASE SCENE
The §13 demo content (the mock app users see on boot) is sparse, never-designed, 1024²-mock filler — it is a huge part
of the "looks AI-built" impression because it's the hero surface. BUILD A FLAGSHIP SHOWCASE SCENE as part of this run:
a demo app/scene worthy of the engine — story-grade, morph-through sections, photoreal materials, text with poured
textures, bound animations across all five drivers, 3D objects under the lighting rig — the thing a first-time user
sees and says Logan's quote verbatim. Provision hi-res assets (kill the 1024² ceiling per the carried flag). Also fix
the carried gizmo-offset bug (anchor double-transform) and migrate editor-chrome canvas2D labels → MSDF while in there.

## ADDENDUM 3 (2026-06-11): FAL.AI CREATIVE MANDATE — Logan's words: "have fun with it; design something incredibly badass"
- KEY: read FAL_KEY from kid-kode-landing/.env.local (NEVER print it; validate with one minimal call at start; if
  absent/invalid, flag honestly and proceed with non-fal scope). BUDGET: $50 HARD CAP — keep a running spend ledger
  (every call: model, purpose, est. cost), warn yourself at $25/$40, STOP fal calls at $48. Spend ledger goes in the report.
- RE-VERIFY CURRENT BEST MODELS (June 2026 — do NOT assume training-era): fal's catalog for (a) hi-res image gen,
  (b) the NEW generation of 3D object generators (complete 3D from prompt alone or single image — Logan notes these now
  substantially outperform multi-view stitching; use multi-view→3D only if it measurably wins), (c) video gen for
  video-texture moments. Pick deliberately; note choices + why in the report.
- USE IT FOR BOTH TARGETS: (1) THE 5-HUB MOCK APP — design a flagship showcase app with FIVE hubs/pages, story-grade,
  morph-through navigation between hubs, photoreal generated 3D objects placed as real scene nodes, generated hi-res
  imagery (kills the 1024² ceiling), video where it elevates, text with poured textures, primitives bound across all
  five drivers, the DESIGN-REFERENCES stack visibly everywhere. It must make a first-time user say Logan's finish-line
  quote. (2) THE EDITOR UI — generated assets in service of the real-material chrome (env/HDRI maps for chrome lighting,
  micro-material textures, accent assets); generated assets FEED the TSL materials — they never replace real rendering.
- CREATIVE LATITUDE GRANTED: this is the one place Logan has said "have fun — make it awesome." Take real swings.
  VERIFY WITH YOUR OWN EYES (vision-critique every generated asset + composed scene against the photoreal/premium bar
  before the advocate sees it; reject and regenerate weak assets — budget permitting).

## RESUMABILITY + LEDGER
Maintain notes/verification/UI-FIDELITY-2-PROGRESS.md continuously (wave, surfaces done, advocate verdicts, fal spend
ledger, last AUTO-CKPT). Sessions may be killed by limits; a sentinel auto-relaunches the resume prompt — every session
reads the ledger + git log first, verifies cheaply, continues from the first incomplete wave. Never restart from zero.
If FAL_KEY is absent at start, RE-CHECK kid-kode-landing/.env.local at every wave boundary and at the showcase phase.
