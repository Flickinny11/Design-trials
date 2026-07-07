# PRISM-WDG1 — DESIGN GRAMMAR HARVEST (founder-directed 2026-07-06)

You are the W-DG1 orchestrator. Working dir:
/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing
Branch: current checkout. Do NOT switch branches.

## MISSION
Build design-grammar/ corpus v1: a structured, machine-usable taxonomy of
premium web design TECHNIQUE FAMILIES, distilled from live analysis of the
full Slider Revolution template gallery (including all 17 founder-linked
templates listed in notes/PRISM-DESIGN-SUPREMACY-PLAN.md sources appendix
below) plus top Awwwards winners. This corpus becomes the intelligence layer
behind intake option bubbles, prompt-to-node styling, Conductor theme
composition, and judge rubrics. Read the PLAN (notes/PRISM-DESIGN-SUPREMACY-
PLAN.md) FIRST — §2 LEGAL DOCTRINE and §3 grammar structure are binding.

## LEGAL DOCTRINE (BINDING — violation = MUST-FIX, no exceptions)
Extract PRINCIPLES: technique families, motion grammar (easing character,
pacing, choreography patterns), palette logic, composition rules, lighting
recipes, layering strategies, what-pairs-with-what.
NEVER: copy or store their images, copy text, code, or assets; never
reproduce a specific template's composition; never treat brand/color/name
swaps as making a recreation acceptable. Corpus exemplars are ORIGINAL
renders WE generate (FLUX/Tripo via existing adapters, demo-mode fixtures
fine). Screenshots taken during analysis are working notes ONLY — they stay
in a gitignored scratch dir and are DELETED before wave end; only distilled
principles + original exemplars are committed.

## METHOD
1. Enumerate the SR template gallery (start sliderrevolution.com/templates/)
   + the 17 founder links + top ~30 recent Awwwards winners (awwwards.com).
2. For each: load in real browser, observe motion (scroll, hover, autoplay),
   screenshot key states to scratch, classify into technique families.
3. Distill each FAMILY (not each template) into design-grammar/families/
   <family>.json per the §3 schema: what-makes-it-work, capability
   requirements mapped to OUR stack (R1-R4 routes, gen models, primitives
   from docs/prism/DESIGN-REFERENCES.md), when-to-use/when-not, pairing
   rules, palette logic, motion character.
4. Generate 2-3 ORIGINAL exemplar renders per top-20 family (demo-mode ok;
   live gen where cheap: Replicate <= $6 total, Tripo <= 80 credits).
5. GAP REPORT: notes/DESIGN-GRAMMAR-GAP-REPORT.md — technique families our
   stack CANNOT yet execute at parity, each mapped to what W-PHOTO or a
   future wave must add. Honesty law applies: no capability claims without
   a demonstrated exemplar.
6. INDEX + API: design-grammar/index.ts — typed loader + query (by element
   type, mood, palette, hub archetype) ready for intake/Conductor wiring
   (wiring itself is a LATER wave; ship the corpus + loader only).
7. Flight-record the harvest (analysis events) via src/lib/flight-recorder/.
8. notes/spec-deviations-wdg1.md BEFORE any deviating code.

## INVARIANTS
I-LEGAL (doctrine above); I-ADDITIVE (new dirs only; zero product-surface
changes this wave); I-SECRETS/INV-19; I-PROVENANCE (commit messages truthful;
exemplars labeled with their real generation source); npm run verify EXIT 0.

## EVIDENCE + JUDGES + MARKERS
Evidence to notes/verification/shell-wdg1/: family taxonomy summary, 6-10
exemplar renders, gap report, corpus stats. Dual judges fresh-context:
criteria-reviewer + user-advocate as "creative director": is this grammar
rich enough to generate NON-REPETITIVE premium options across wildly
different briefs, and are the exemplars genuinely original? 0 MUST-FIX gate.
Report: notes/SHELL-WDG1-REPORT.md (skeleton first).
Complete: PRISM-WDG1: RUN COMPLETE
Blocked: PRISM-WDG1: BLOCKED-NEEDS-FOUNDER

## SOURCES APPENDIX (founder-provided 17; enumerate gallery for the rest)
editorial-product-gallery-slider-wordpress; filmstrip-hero-3d-image-carousel-
collection; carousel-design-templates-wordpress-pack; scoop-society-ice-cream
-shop-website-slider; mood-board-infinite-filmstrip-media-gallery; prime-
luxury-product-microsite-template; from-sketch-to-product-slider-template;
4-seasons-wordpress-parallax-theme; dj-website-template-with-scroll-video;
wordpress-media-gallery-slider; zero-point-energy-drink-showcase-template;
bento-grid-travel-slider; urban-oven-pizza-slider-template; modern-web-agency
-website-template; fluid-dynamics-effect-showcase; starry-night-parallax-zoom
-effect-slider; raven-cinematic-video-hero-template (all under
sliderrevolution.com/templates/).

## FOUNDER ADDENDUM — 2026-07-06 10:45 (binding on this resume)

### DIVISION OF LABOR — EFFECTIVE IMMEDIATELY
Your static-screenshot browsing is producing invalid analysis (animation-
heavy templates read as static) and zero commits in 25 minutes. STOP
primary browsing. The founder's monitor session (full interactive browser +
vision) is performing the flagship visual analysis and writing observation
seeds to design-grammar/observations/*.md as they complete. Those seeds are
GROUND TRUTH. Your job, starting now, in priority order:
1. Corpus schema + typed loader/query API (§3 of the PLAN) — commit within
   30 minutes.
2. Process observation seeds into families/<family>.json as they arrive.
3. Original exemplar generation for completed families.
4. Gap report entries per family.
5. SECONDARY browsing for gallery breadth ONLY under the protocol below.

### MOTION-EVIDENCE LAW (violation = analysis invalid = MUST-FIX)
A template analysis is VALID only with motion evidence. Static single
screenshots prove nothing about animation-first design. Required protocol
per page (Playwright): load + 3s settle; capture; scripted scroll through
FULL page height in 5-6 steps capturing each step; hover primary nav +
first card/CTA, capture hover states; click slider arrows/dots if present,
capture 2-3 slide states; where motion is continuous, record Playwright
video for 8-10s and extract a 3x3 frame grid (ffmpeg) for vision analysis.
Classify from the SEQUENCE, never a single frame. If a page cannot be
interacted with, mark it UNANALYZED — never guess.

### CADENCE
Commit every completed family individually. No silent 25-minute stretches:
if nothing commits in 15 minutes, commit a progress note to the report.
