# Post-Ralph Tweaks: e2ff5e8 → 1564852

**Purpose.** This file is the engineering record of the 22 commits that followed the original 15-phase Ralph Loop and got the mock app from "spec-correct but flat-looking" to "reads as a real interactive app." Each commit is logged with what was wrong, what changed, what files were touched, and which **lesson bucket** the change belongs to.

**Audience.** You / Claude Code today; the Prism engine's parallel models tomorrow. The buckets tell future automation where each lesson lives — universal pipeline scripts, caption-driven per-element parameters, graph-as-plan structural shifts, or "tried and abandoned, do not revive."

**Cross-reference.** For the forward-looking pipeline (how a new mockup flows through the build today, what's caption-driven vs. hardcoded), see [mockup-pipeline.md](./mockup-pipeline.md).

---

## The four lesson buckets

- **A. Universal pipeline techniques** — apply for *any* mockup. Live in build scripts. The *how* is fixed; the *parameters per-element* are caption-driven (Bucket B).
- **B. Caption-driven dynamic parameters** — per-mockup, per-element. Live in the graph (`hub.caption`, `intent.caption`, `intent.samHints`, `intent.alphaCutout`, `intent.visualSpec.layers`, `intent.animationSpec`, `intent.visualNeighbors`, `intent.interactionNeighbors`, `intent.responsiveSizing`). Drive what the universal techniques do per element.
- **C. Graph-as-plan structural shifts** — the architectural pivots (mockup-first; text-as-layer-not-string; rich captions are the source of truth).
- **D. Tried, abandoned** — recorded so we don't repeat them; not part of the active approach.

---

## Chronological ledger (22 commits)

### Group 0 — Loop end + scaffolding (no behavior change)

These commits set up the Vercel deployment and screenshot baselines that the subsequent visual phases needed to diff against. No production behavior changed.

| SHA | Title | Bucket |
|---|---|---|
| `e2ff5e8` | ralph: loop complete — all tasks done | (state-flip) |
| `858fcb5` | prism-mock: ship .prism to Vercel + regenerate assets (Spatial/3D direction) | A (deploy infra) |
| `2902bf3` | prism-mock: add live-vercel smoke script + baseline screenshot | A (smoke infra) |
| `23d99c6` | prism-mock: add live-modes smoke + baseline screenshots of all 3 view modes | A (smoke infra) |
| `74c50c1` | chore: retrigger Vercel build (transient github 500) | (chore) |
| `ec45cb0` | prism-mock: Phase A baseline screenshots | (baseline) |
| `fe94987` | prism-mock: Phase D baseline screenshots (drop shadows visible) | (baseline) |

**Files added that we kept:** [scripts/live-vercel-smoke.mjs](../scripts/live-vercel-smoke.mjs), [scripts/live-modes-smoke.mjs](../scripts/live-modes-smoke.mjs), [scripts/live-preview-zoom.mjs](../scripts/live-preview-zoom.mjs).

---

### Phase A — Responsive layout + viewport presets (3 commits)

**`ab81390` prism-mock: responsive container + Preview/Editor/Visual-Editor toggle**
- Symptom: editor was hardcoded to one viewport; couldn't QA or demo at mobile/tablet/desktop, and the editor pane couldn't be dismissed for a clean preview.
- Fix: added a Preview / Editor / Visual-Editor view-mode toggle to [src/app/page.tsx](../src/app/page.tsx); responsive container in [PrismHost.tsx](../src/components/prism-player/PrismHost.tsx) with viewport scaling logic; new `live-preview-zoom.mjs` smoke.
- Files: page.tsx (+100), PrismHost.tsx (+28), boot.ts (+68), scroll-viewport.ts (+22), player/index.ts (+2), home-hub.png updated.
- Bucket: **A** (universal — host shell pattern; reusable for any .prism).

**`f86868a` prism-mock: Phase A — responsive layout + viewport presets** *(initial deploy errored out then corrected)*
- Symptom: 1536-wide layout assumed; mobile/tablet rendered cropped or wrong-scaled.
- Fix: added desktop / tablet / mobile viewport presets (1920 / 1024 / 640); home-hub.json layout block extended; [PrismHost.tsx](../src/components/prism-player/PrismHost.tsx) gained scaler + preset-toolbar.
- Files: PrismHost.tsx (+105 churn), home-hub.json (+2386 churn — many per-node transforms updated for responsive math), boot.ts (+51), scripts/live-modes-smoke.mjs (+31).
- Bucket: **A** (universal) + **B** (per-mockup transforms — now expressed via `hub.responsiveBreakpoints` + per-node `intent.responsiveSizing`).

**`1074466` prism-mock: fix preset-toolbar overlap w/ view-mode toggle**
- Symptom: viewport-preset toolbar visually collided with the view-mode toggle.
- Fix: 2-line offset adjustment in [PrismHost.tsx](../src/components/prism-player/PrismHost.tsx).
- Bucket: A.

---

### Phase B — Build-time shape masking (1 commit)

**`93e2961` prism-mock: Phase B — build-time shape masking**
- Symptom: rectangular FAL crops produced sharp 90° corners on what were supposed to be round buttons / pills / circles / ovals (icons, CTA, signin button, theme selector).
- Fix: [build-atlas.mjs](../src/lib/prism/mock-app-source/assets/build-atlas.mjs) gained `applyShapeMaskIfNeeded()` (lines 99–136). Builds a white-fill SVG mask matching the node's `visual.shape` (rect | rounded | pill | circle | oval) at the post-resize dimensions, composites with `blend: 'dest-in'` to alpha-intersect the source pixels with the shape — corners outside the shape become transparent in the atlas region. Build-time only; no runtime masking infra needed since the sprite arrives already shape-clipped.
- Files: build-atlas.mjs (+59), home-hub.json (per-node shape hints added — now `intent.visualSpec.layers[].mask` mirrors this declaratively), atlas-regions.json regenerated.
- Bucket: **A** (universal technique — apply for any mockup) with caption-driven shape selection from `visual.shape` / `visual.shapeRadius` (**B**).

**Reuse mechanism:** node-level `visual.shape` and `visual.shapeRadius` are the contract; `build-atlas.mjs` honors them. Authoring per-node shape happens in caption time when the graph is being populated.

---

### Phase D — Depth hierarchy + drop-shadows (2 commits)

**`eb5fd71` prism-mock: Phase D — depth hierarchy**
- Symptom: composition was flat; sprites all looked like they sat on the same plane.
- Fix: drop-shadow filter (pixi-filters package) wired in [boot.ts](../src/lib/prism/player/boot.ts), applied per-sprite based on z-index. Added `pixi-filters` to deps.
- Files: boot.ts (+35), package.json (+1 dep), home-hub.json (z values per node).
- Bucket: **A** (universal — apply for any mockup).

**`8a0a62c` prism-mock: Phase E3 — softer drop-shadows**
- Symptom: initial drop-shadow values overpowered content; whole UI looked muddy.
- Fix: 3-line tweak in [boot.ts](../src/lib/prism/player/boot.ts) — reduced shadow alpha + blur radius.
- Bucket: A. (Numbers are part of the universal technique; if a mockup later wants stronger shadows, this becomes caption-derivable from a `intent.shadowProfile` field — not present today.)

---

### Phase E1+E2 — MSDF text + state-drift fix + center-anchor + remaining-text-msdf + strip-static-textContent (4 commits)

**`5489558` prism-mock: Phase E1+E2 — MSDF text + state-drift fix**
- Symptom: text quality issues from sharp-svg compositing at small sizes; state drifted between editor and preview pane (visual editor's overlays didn't match preview's).
- Fix: flipped most text-bearing nodes from sharp-svg to MSDF runtime BitmapText. State-drift fix in player. Updates across 7 node modules: [footer-link.js](../src/lib/prism/mock-app-source/nodes/footer-link.js), [hero-card-cta.js](../src/lib/prism/mock-app-source/nodes/hero-card-cta.js), [navbar-link.js](../src/lib/prism/mock-app-source/nodes/navbar-link.js), [navbar-signin-btn.js](../src/lib/prism/mock-app-source/nodes/navbar-signin-btn.js), [static-text.js](../src/lib/prism/mock-app-source/nodes/static-text.js), [stats-card-bg.js](../src/lib/prism/mock-app-source/nodes/stats-card-bg.js), [theme-selector-button.js](../src/lib/prism/mock-app-source/nodes/theme-selector-button.js). [verify-prism.mjs](../scripts/verify-prism.mjs) updated. Atlas shrunk (442→326KB) since text was no longer baked into substrates.
- Bucket: **A** (universal — text always rendered as a separate MSDF layer on top of its element substrate, never baked into the image) + **C** (the principle is the structural shift).

**`e2cd680` prism-mock: center-anchor MSDF text against transform.width**
- Symptom: MSDF text positioned via raw x/y didn't visually center on its host substrate.
- Fix: anchor-mapping in [static-text.js](../src/lib/prism/mock-app-source/nodes/static-text.js) — for `anchor: "center"`, position becomes (transform.width/2, transform.height/2); for `right`, (transform.width − x, y); for `left`, (x, y).
- Bucket: A.

**`aaa5be2` prism-mock: remaining text nodes textOnly + msdf**
- Symptom: a few text-only nodes (footer links etc.) still had sharp-svg paths from Ralph; inconsistent rendering.
- Fix: [footer-link.js](../src/lib/prism/mock-app-source/nodes/footer-link.js) (+59) handles textOnly+msdf; home-hub.json textContent fields updated; atlas dropped to 301KB.
- Bucket: A + C.

**`bcdde02` prism-mock: strip static textContent, let mockup crops carry text** *(re-evaluated 2026-04-27)*
- Original symptom (then): post-Phase F mockup crops baked the labels into the substrate, so JSON `textContent` was redundant and stripping it kept the source of truth singular.
- **Re-evaluation (this doc):** the durable principle is the **opposite** — text is always a separate MSDF layer over the element substrate, **never baked into the image**. The substrate may be transparent / blank / minimal; the text comes from `intent.visualSpec.textContent[]` or a layer of type `text`. The 2026-04-23 commit was correct given that day's mockup style (Recraft-V4-pro renders readable text natively); but for the engine going forward, do **not** rely on baked text — populate `textContent[]`.
- Files: home-hub.json (−380), [verify-prism.mjs](../scripts/verify-prism.mjs) (+16/−).
- Bucket: **C** (graph-as-plan: text-as-layer principle, regardless of mockup style) with the original 2026-04-23 expediency captured here as historical context.

---

### Phase F — Mockup-first architecture (THE BIG PIVOT) (1 commit)

**`84bcf07` prism-mock: Phase F — mockup-first architecture**
- Symptom: per-element FAL provisioning produced ~40 isolated images that didn't compose well — different lighting, different angle, different scene per element. The result looked like a collage, not a UI.
- Fix: pivoted to a single-mockup-PNG source of truth. Generate one cohesive mockup, segment it with SAM-3 into element bboxes, extract per-node crops from the same image. New scripts: [scripts/generate-mockup.mjs](../scripts/generate-mockup.mjs) (recraft-v4-pro), [scripts/florence-ground.mjs](../scripts/florence-ground.mjs) (florence/sam grounding experiment), [scripts/segment-mockup.mjs](../scripts/segment-mockup.mjs), [scripts/segment-mockup-retry.mjs](../scripts/segment-mockup-retry.mjs), [scripts/extract-from-mockup.mjs](../scripts/extract-from-mockup.mjs). New inputs in [notes/mockup-candidates/](./mockup-candidates/) (`recraft-v4-pro.png`, `bbox-map.json`, `segmentation.json`, `debug-bboxes.png`).
- home-hub.json: lost 1150 lines (mostly static `textContent` blocks and intermediate visualSpec), each node's `visual.sourceAsset` now sources from the cropped mockup.
- Bucket: **C** — the architectural pivot.

**Reuse mechanism (today):** the recraft-flow scripts in this commit are *superseded* by the scifi-flow (commit `160dfd5`); both flows are *conceptually subsumed* by the caption-driven model in [mockup-pipeline.md](./mockup-pipeline.md). Going forward, neither the recraft scripts nor the scifi scripts are the right primitive — captions drive the segmentation, extraction, and cutout decisions.

---

### Phase G — Per-element FLUX.2-pro enrichment (1 commit) — **TRIED, ABANDONED**

**`eeb483a` prism-mock: Phase G — per-element enrichment via FLUX.2-pro image-to-image**
- Idea: feed each cropped element back through FLUX.2-pro image-to-image to "enrich" texture and lighting per element.
- Result: introduced inconsistency between elements (each gets a fresh diffusion pass with its own variance), partially defeating the cohesion gain from Phase F.
- Files: [scripts/enrich-elements.mjs](../scripts/enrich-elements.mjs) (+112). Still on disk for historical reference.
- **Status (per direction 2026-04-27):** **NOT in the active pipeline.** We do not generate additional images beyond the mockup. The script is preserved as a "do not revive" record.
- Bucket: **D** (tried, abandoned).

---

### Sci-fi mockup pivot (1 commit)

**`160dfd5` prism-mock: sci-fi mockup → per-node image extraction**
- Symptom: the recraft-v4-pro mockup looked like a flat dashboard / figma export — code-rendered chrome, gradient buttons, text-baked everywhere. It "looked like an app" but didn't read as something only-images-can-produce.
- Fix: new mockup style — cosmic / sculpted-physical-objects — generated with fal.ai flux-2-pro and a long detailed prompt + heavy negative prompt that explicitly excludes text, letters, words, typography, CSS gradients, rounded rectangles, glass-morphism clichés, flat UI, dashboard, figma. New scripts dedicated to the sci-fi flow: [generate-scifi-mockup.mjs](../scripts/generate-scifi-mockup.mjs), [segment-scifi.mjs](../scripts/segment-scifi.mjs), [extract-scifi-elements.mjs](../scripts/extract-scifi-elements.mjs), [debug-scifi-boxes.mjs](../scripts/debug-scifi-boxes.mjs), [one-button.mjs](../scripts/one-button.mjs). New inputs: `notes/mockup-candidates/{scifi-mockup-v1.png, scifi-segmentation.json, scifi-bbox-map.json, scifi-debug.png}`.
- home-hub.json: rewired (318 lines churn) for new mockup positions/sizes; many nodes that aren't in this composition (footer, pricing link, hero text) became TINY (2x2 invisible) placeholders.
- Bucket: **C** — proves the pipeline is mockup-style-portable. The recraft-era scripts and the scifi-era scripts are functionally equivalent — both consume per-mockup config; the durable pattern is "captions tell the pipeline what to do per-element," not "this set of scripts is the pipeline."

**Important constraint surfaced in this commit:** the negative prompt is load-bearing. Excluding text/UI-clichés/figma-style is what makes the result "use images for things code cannot produce." This belongs in caption guidance for any future mockup generator: don't constrain prompts to what code can render.

---

### Alpha cutout (1 commit) — current HEAD

**`1564852` prism-mock: alpha-cutout crops via luminance threshold**
- Symptom: per-node crops from the sci-fi mockup included dark "negative space" between sculpted objects (atmospheric backdrop, empty canvas). Elements looked glued onto their crop rectangles instead of floating in the cosmic scene.
- Fix: [scripts/alpha-cutout.mjs](../scripts/alpha-cutout.mjs) post-processes each `source-images/base/{nodeId}.png`: per-pixel luminance ≤ 18 → fully transparent, ≥ 55 → fully opaque, linear interpolation between. SKIP set protects section/page backgrounds (their dark areas are atmospheric, not negative space). Tiny placeholders (<3×3) are skipped.
- Files: [scripts/alpha-cutout.mjs](../scripts/alpha-cutout.mjs) (+55 NEW).
- Bucket: **A** (universal technique — apply for any mockup with isolated lit elements over dark bg) with **B** parameters (LOW/HIGH thresholds + SKIP set should derive from per-element `intent.alphaCutout` — see [mockup-pipeline.md §"Today vs. caption-driven"](./mockup-pipeline.md#what-works-today-vs-whats-caption-driven)).

---

## Bucket-assignment matrix (22 commits)

| SHA | Bucket | Key takeaway |
|---|---|---|
| `e2ff5e8` | (state-flip) | Ralph end |
| `858fcb5` | A | Vercel + regenerate assets (deploy infra) |
| `2902bf3` | A | Vercel smoke script |
| `ab81390` | A | Responsive container + Preview/Editor/Visual-Editor toggle |
| `23d99c6` | A | Live-modes smoke |
| `f86868a` | A + B | Viewport presets; per-mockup transform tuning becomes caption-driven |
| `74c50c1` | (chore) | Retrigger build |
| `1074466` | A | Toolbar overlap fix |
| `ec45cb0` | (baseline) | Phase A screenshots |
| `93e2961` | A + B | Build-time shape masking via SVG dest-in; shape per node from caption |
| `eb5fd71` | A | Drop-shadow filter via pixi-filters |
| `fe94987` | (baseline) | Phase D screenshots |
| `5489558` | A + C | MSDF runtime text on a separate layer (text-as-layer) |
| `8a0a62c` | A | Softer drop-shadows |
| `e2cd680` | A | Center-anchor MSDF against transform.width |
| `aaa5be2` | A + C | Remaining text nodes flipped to textOnly+msdf |
| `84bcf07` | C | Mockup-first architecture (THE PIVOT) |
| `bcdde02` | C | Strip static textContent — re-evaluated as text-as-layer principle |
| `eeb483a` | **D** | Per-element FLUX.2-pro enrichment — abandoned, do not revive |
| `160dfd5` | C | Sci-fi mockup; negative-prompt rules surfaced |
| `1564852` | A + B | Alpha-cutout via luminance — thresholds become caption-driven |

**Bucket totals:** A = 12 commits (universal techniques), B = 4 commits (per-element parameters), C = 5 commits (graph-as-plan), D = 1 commit (abandoned), plus 4 baseline/chore/state-flip commits.

---

## What "this codebase as of 1564852" carries forward

- All Bucket A techniques are **kept and reused for any future mockup**: shape masking, alpha cutout, drop-shadows, MSDF text on a separate layer, atlas+MaxRects+AVIF, responsive sizing infrastructure.
- All Bucket B parameters now have **a home in the graph schema** (the rich captions + structured fields added 2026-04-27 — see [mockup-pipeline.md](./mockup-pipeline.md#the-caption-contract)). What's hardcoded in scripts today (SAM PROMPTS, alpha LOW/HIGH, BBOX map) is *captured in captions* and will be *consumed from captions* as the pipeline evolves.
- All Bucket C shifts are **structural and durable**. The graph IS the plan; mockup-first; text-as-layer.
- The Bucket D commit (`eeb483a`) is preserved as a record of an approach we evaluated and rejected. The script ([enrich-elements.mjs](../scripts/enrich-elements.mjs)) sits in `scripts/` for reference; do not invoke it as part of the active pipeline.

## What's next (out of scope for this doc)

The two work items that follow this documentation pass:
1. UI tweaks: continue refining the mock app's visual quality where needed.
2. Node editor integration: wire the existing node editor to the .prism graph so that editing the graph (captions, layers, etc.) updates the running preview.

Both are tracked separately. This doc captures the work *up to and including the post-Ralph tweaks at commit 1564852* plus the 2026-04-27 caption-enrichment pass that made the lessons machine-readable.
