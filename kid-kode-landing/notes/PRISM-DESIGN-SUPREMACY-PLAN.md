# PRISM DESIGN SUPREMACY — PROGRAM PLAN (founder-directed 2026-07-06)
# Status: plan-canonical on founder OK. Grounded in live template analysis +
# fresh-dated research (2026-07-06). Does NOT interrupt in-flight work.

## 1. THE DIAGNOSIS (why the mock watches "look digital")
Live analysis of the reference templates exposed the industry's actual method:
- Zero Point ("3D soda can"): NOT realtime 3D. Layered photographic/pre-
  rendered cutouts (can + separate shadow plate + floating fruit PNGs + four
  full-bleed background plates) choreographed with motion/parallax + post.
- Fluid Dynamics: realtime GPU fluid shaders OVER photographic plates/cutouts.
- The genre is IMAGERY-FIRST, EFFECTS-LAYERED. Their own tooling pitch is AI
  image gen + background removal.
Our mock app pushed everything through realtime geometry + realtime materials
— the hardest possible route to photorealism. Fresh 2026 industry practice
names FOUR routes: (R1) realtime PBR, (R2) pre-rendered/pre-baked sequences
driven by scroll/interaction, (R3) baked-lighting hybrids, (R4) Gaussian
splatting (production-mature 2026; three.js-compatible viewers; "photo you
can walk around"). Premium studios charge $20K-$200K/site for this. We used
only R1. The fix is a RENDERING ROUTE PLANNER: per element, choose the route
that maximizes realism per byte — usually R2/R3 composites from our own
FLUX-generated photoreal imagery (+ background removal, depth maps, relight,
color grade via Replicate/fal), R1 for objects needing free interaction
(Tripo/Hunyuan meshes UNDER a proper cinematic pipeline), R4 splats for
walkaround-real hero objects. Plus the R1 cinematic floor we currently lack:
HDRI/IBL environment lighting, modern filmic tone mapping, imperfection maps
(dust/scratches/fingerprints — perfection reads as digital), contact
shadows, DOF, grain, bloom, LUT color grade.

## 2. LEGAL DOCTRINE (binding, all waves)
Design PRINCIPLES, technique families, motion grammars, palette logic:
extractable, learnable, usable. Their images, copy text, code, assets, and
near-identical compositions: NEVER — and cosmetic swaps (brand/color/name)
on an otherwise-identical recreation are NOT a safe harbor. The public
catalog ships ORIGINAL compositions built from the grammar. Capability
verification uses PRIVATE benchmark scenes matching technique checklists
(never their assets/compositions), judged for quality parity, never shipped.

## 3. THE DESIGN GRAMMAR (the anti-repetition engine)
A structured corpus — design-grammar/ — of TECHNIQUE FAMILIES, not templates:
each entry = {family (e.g. layered-photo parallax hero, GPU fluid overlay,
filmstrip 3D carousel, bento grid, scroll-video scrub, parallax zoom
starfield, sketch-to-product morph, seasonal theme shift, editorial gallery),
what makes it work (lighting, palette logic, motion curve character, pacing,
pairings), required capabilities (which of R1-R4 + which gen models + which
primitives), when to use / when NOT to, and 2-3 ORIGINAL exemplar renders we
generate ourselves}. Sources: the full Slider Revolution gallery + Awwwards
winners + other premium showcases — analyzed with real browser + vision,
distilled to principles. The grammar feeds: (a) intake/streaming-chat visual
option bubbles (user asks for a carousel -> 3-4 rendered ORIGINAL carousel
options drawing on DIFFERENT families), (b) per-node prompt-to-element,
(c) the Conductor's whole-app theme composition, (d) Flight Recorder links
(which options users pick = taste training data -> self-learning program),
(e) judge rubrics ("does this hit the family's quality bar?").
Anti-repetition law: option sets MUST draw from distinct families; the
grammar tracks per-user and global usage so recommendations rotate.

## 4. WAVES (in order; each dual-judge gated; no current work interrupted)
W-DG1 HARVEST (launch now): browser+vision analysis of the full SR template
  gallery (incl. all 17 founder-linked) + top Awwwards winners -> the
  design-grammar corpus v1 + technique-capability gap report vs our stack.
W-PHOTO (after W-DG1): the rendering route planner + R2/R3 composite
  pipeline (FLUX imagery -> cutout/depth/relight/grade -> layered parallax
  scenes) + R1 cinematic floor (IBL/tone map/imperfections/post) + R4 splat
  viewer support + REMASTER THE MOCK WATCH APP as the acceptance test:
  judges gate on "would you believe this is a photograph?"
W-TPL CATALOG: original hub templates (landing/marketing/about/contact/
  gallery/pricing/etc) + SECTION templates, built FROM the grammar; searchable
  categorized picker; "new hub from template" -> planet + tethered nodes in
  galaxy, name-your-hub flow; section-drop into existing hubs; all assets
  generated, all in prism runtime.
W-2D HUB MODE: per-hub renderMode 3d|2d in hub schema. Same node contract,
  same galaxy, same preview state machine; 2d = flat/orthographic composition
  path in the SAME renderer (3D accents still layerable); depth-specific
  canvas tools greyed in 2d; models read hub mode when generating. No
  runtime fracture: the invariant is the graph + self-contained nodes, not
  perspective rendering.
W-BG BACKGROUNDS: expand 3D background primitives to 50-60 grammar-derived
  templates + prompt-to-background in the picker (context-aware: reads the
  hub's existing elements + palette; output runs in the prism runtime).

## 5. FOUNDER QUESTIONS — ANSWERS OF RECORD
Q: Can it create HD/photoreal assets (chair, can) WITHOUT user upload?
A: YES — text->image (FLUX 2 Pro, photoreal) -> cutout/depth -> composite;
   or text/image->3D (Tripo/Hunyuan/Rodin) for interactive objects; upload
   is only for the user's OWN products (image->3D / image->composite).
Q: Is the capability present today? A: Generation YES (W10). Presentation
   NO — that's W-PHOTO. Design intelligence NO — that's W-DG1 + grammar.
Q: 2D/3D per hub without fracturing? A: YES, per W-2D above.
