# PREBUILT ELEMENT LIBRARY — the premium element catalog (§13, criterion 21). Production-ready. (Claude Code, ultracode)

## MODEL & MODE
MODEL: claude-opus-4-8 (Fable-5 is DOWN and silently falls back to opus; confirm modelUsage==claude-opus-4-8 at start
AND after any sentinel resume, record in ledger; never trust the label). 1M context. ULTRACODE: Dynamic Workflows,
PARALLEL subagents in verified waves, CONTRACT-FIRST per phase. Branch prism-editor-build, from git root. AUTO-CKPT at
every VERIFIED phase (standard exclusions; verify `git ls-files | grep -c worktrees`==0). LOGAN-INBOX polling at phase
boundaries. ANTI-STUCK: web-search CURRENT (June 2026) technique after ~2 fails; never downgrade a dep; NEVER fake or
assert — evidence (frames + interaction) or it didn't happen. ENV: NODE_ENV unset; kill all browsers/dev servers at each
phase end; free ports. Maintain notes/verification/PREBUILT-LIBRARY-PROGRESS.md continuously (resumable).

## THE BAR (Logan's words — this is the make-or-break catalog)
"This is where we can really screw it all up if we don't deliver stunning, photorealistic 3D elements." The element
library MUST be the most premium thing in the editor. Bar: at minimum match, and decisively SMASH, Slider Revolution —
their morphing-through-3D pages, their photorealistic rotating 3D carousels. Every element: stunning, photorealistic 3D,
real materials + lighting so it reads photoreal when dropped into a scene individually, smooth, premium, robust
animation. Hover previews must be EVEN MORE robust/premium than the animation-primitive tiles — on hover the tile shows
the user exactly what the element is AND its animation, in very smooth visuals. If a senior 3D designer wouldn't call it
best-in-class, it is a MUST-FIX.

## WHAT ALREADY EXISTS (reuse — do NOT rebuild; integrate INTO it)
The ~406-primitive animation catalog, the Animation Picker (hover-play tiles + ControlSchema panel), the Keyframe Editor,
from-scratch bespoke authoring, the Material editor + Lighting system (IBL/key/fill/rim, T0/T1/T2, receivesLighting),
groupId node-groups, animationBindings, materialSpec/lightingSpec/scenePosition/builtSnapshotHash (all additive),
the Change-Artifact→fal generator (Prism Media Generator), the Observatory-Brass design system, docs/prism/
DESIGN-REFERENCES.md (the 1,066-line premium dependency+technique catalog — REQUIRED toolkit here, with a dependency-
usage table in the report). The hybrid customization model is ALREADY POSSIBLE via these — this run wires elements into them.

## READ FIRST
PRISM-CANVAS-EDITOR-SPEC.md §13 (prebuilt library), §8/§8.3/§8.4 (animation system/picker/keyframe), §10/§11 (material/
lighting), §12 (Change Artifact), §14 (grouping), §18 criteria 21+23, §19 forbidden, §20 re-verify. DESIGN-REFERENCES.md
IN FULL. The existing toolbar (Add/Image/3D/Text/Animation/Lighting groups) for the integration point + design language.

## PHASE 0 — CONTRACT (frozen before any element is built)
Define the element-cluster model: a cluster = a named, captioned group of member nodes (positions/materials/lighting/
default animationBindings) + a hover-preview + a builtSnapshot, instantiated as a groupId subtree (criterion 21:
drag-to-place creates ALL member nodes in the graph, tethered to the current hub, INV-7). Additive schema only. Define
the library data model + the hover-preview contract + the toolbar integration point. Freeze it; subagents build against it.

## PHASE 1 — LIBRARY UI (toolbar + selection menu + drag-to-place)
Intuitive toolbar entry in the Observatory-Brass language (an "Elements"/"Library" group/affordance that fits the
existing toolbar, not bolted on). The selection menu: robust, premium, smooth, with hover-playable preview tiles that
are MORE robust than the primitive tiles — each shows the element and its animation on hover in very smooth visuals
(real rendered preview, not a thumbnail). Search/browse by category. Drag-to-place instantiates the cluster (criterion
21) tethered to the hub, member nodes in the graph + Galaxy (INV-7 parity). Mobile-aware (touch place, responsive menu).

## PHASE 2 — BUILD THE ELEMENTS (the big parallel wave; quality over count, but COMPREHENSIVE)
Build a comprehensive premium catalog covering EVERY §13 category — carousels, wheels, sliders, heroes, banners — PLUS
more UI-enhancer categories, with MULTIPLE best-in-class variants each (do not ship a token few; this must read as "the
most premium thing of all"). Each element: photorealistic 3D with real materials + lighting opt-in (reads photoreal
standalone in a scene); premium imagery where apt (use the Prism Media Generator / fal for hero assets within budget);
DESIGN-REFERENCES techniques visibly at work (morph-through-3D transitions, scroll choreography, distortion, cursor
physics, etc. — the SR-smashing moves); a default "integrated animation" (its own primitive bindings); a smooth
hover-preview; a caption; a builtSnapshot; and full customizability (every member node editable). One subagent per
element/variant against the frozen contract. Dependency-usage table: each element → which DESIGN-REFERENCES entries it uses.

## PHASE 3 — HYBRID CUSTOMIZATION + REAL INTEGRATION (features work TOGETHER, not one at a time)
Prove a placed element is a fully-editable node-group plugged into the existing systems: (a) its integrated animation is
editable AND swappable for any of the ~406 catalog primitives via the Animation Picker; (b) the Keyframe Editor fully
customizes it; (c) every visual element (material, lighting, geometry, text, per-face image) is customizable; (d) "take
just the object" works — place, then manually add/stack animation dependencies via the toolbar; (e) it COMPOSES with
everything else live — add a text element beside it, regen one member via Change-Artifact, group it, change scene
lighting — all simultaneously, stable, no feature locking out another. This integration is the critical production
requirement.

## PHASE 4 — INTERACTION-BASED VERIFICATION + PRODUCTION SIGN-OFF (drive it like a human; not just visual)
USER-ADVOCATE (computer-use, real app on GPU) must INTERACT, not just inspect: hover tiles (previews play smoothly),
browse, DRAG-TO-PLACE, then CUSTOMIZE (swap an animation, open keyframe editor, change a material/light), then COMBINE
with other features in the same scene — DESKTOP and MOBILE. Evidence-required verdicts (cite frame + the exact
interaction); rubric "could a first-timer do this unprompted? is it intuitive, smooth, navigable, stable, a real
capability enhancement for building beautiful 3D scenes?" + Logan's finish-line quote + DPR-2 zoom crops + the
Slider-Revolution SIDE-BY-SIDE standard ("ours visibly smashes theirs"). MUST-FIX blocks; taste = FLAG. Criterion 21
proven; builtSnapshot/criterion 23 holds; full no-regression (406+ catalog render/play/control + 3,342 suite + tsc 0-new);
perf smooth/fast/responsive on T1 + mobile (<100ms interaction). Produce the criterion-by-criterion + system-test matrix
and a clear PRODUCTION-READY verdict for the library.

## GUARDRAILS
One renderer (Three.js/TSL/WebGPU); no PixiJS/2nd renderer; no stock icons; no diffusion-drawn letterforms; no
global-fps; no dep downgrades; additive-only schema; INV-9 tiering (premium on T1+, clean fallback on T0 — never broken);
NO PURPLE; design-tokens-only styling; never surface "fal" in user UI; never print FAL_KEY; secret-leak check before
every checkpoint; assertion-based verification FORBIDDEN. fal budget: same $50 account (prior runs ~$0.27 cumulative);
keep a running cumulative ledger, warn $25/$40, STOP at $48.

## OUTPUT
notes/PREBUILT-LIBRARY-REPORT.md: the contract; the library UI (toolbar + menu, before/after); the element catalog
galleries by category (hover-preview stills + placed-in-scene shots, DPR-2); the dependency-usage table; the hybrid-
customization + real-integration proof (interaction evidence); the interaction-based system-test matrix (desktop+mobile);
criterion 21/23 proof; SR side-by-side; no-regression + perf; fal spend ledger; honest flags; AUTO-CKPT hashes. Frames
under kid-kode-landing/notes/verification/prebuilt-library/. Plain-language summary + production-ready verdict. STOP.
