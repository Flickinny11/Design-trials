# SHELL W-DG1 — DESIGN GRAMMAR HARVEST — RUN REPORT

Status: EVIDENCE COMPLETE — awaiting dual-judge verdicts (§8)
Started: 2026-07-06
Branch: codex/prism-recovery-harness-20260630 (current checkout, unchanged)
Orchestrator working dir: kid-kode-landing/
Division of labor: founder monitor session performed the interactive
motion-evidenced visual analysis and wrote ground-truth seeds; this
orchestrator built the schema/loader, distilled seeds → families, generated
original exemplars, wrote the gap report, and wired flight-recording.

## 1. Mission recap

Build `design-grammar/` corpus v1: a structured, machine-usable taxonomy of
premium web design TECHNIQUE FAMILIES distilled from live analysis of the
Slider Revolution template gallery (incl. all 17 founder-linked templates)
plus top Awwwards winners. Legal doctrine (PLAN §2) binding: principles only,
original exemplars only, analysis screenshots ephemeral.

## 2. Deliverables checklist

- [x] D1 Source enumeration (243 SR templates; 17 founder links deep-analyzed)
- [x] D2 Live browser analysis (motion-evidenced by the monitor session; scratch screenshots only, deleted §3)
- [x] D3 `design-grammar/families/*.json` per PLAN §3 schema — 14 families, all grounded
- [x] D4 Original exemplar renders — 11 across 11 families (budget-capped, §6)
- [x] D5 `notes/DESIGN-GRAMMAR-GAP-REPORT.md`
- [x] D6 `design-grammar/index.ts` typed loader + query API (+ types.ts + validate.mjs)
- [x] D7 Flight-recorded harvest events (8th record type, per DEV-1; ledger evidence)
- [x] D8 Evidence at `notes/verification/shell-wdg1/`
- [ ] D9 Dual judges (criteria-reviewer + user-advocate creative director), 0 MUST-FIX — §8
- [x] D10 `npm run verify` EXIT 0; scratch dir deleted at wave end (§3)

## 3. Legal-doctrine compliance ledger

- Analysis screenshots: `/tmp/wdg1-scratch/` (OUTSIDE the repo — cannot be
  committed). 43 source screenshots + the monitor's raw analysis JSONs live
  there and are DELETED at wave end. Binding check PASSED: `git ls-files`
  shows **zero** harvested raster assets (png/jpg) tracked anywhere in the repo.
- No source images/text/code/assets stored in the repo. Family JSONs carry
  distilled principles in our own vocabulary only.
- Exemplars: 11 ORIGINAL renders (Replicate flux-2-pro), each with a subject
  deliberately DIFFERENT from any analyzed source template, each labeled with
  its real generation source (I-PROVENANCE). Spot-checked visually: the
  cold-brew product / neon-noir portrait / editorial "FORM" spread / coverflow
  card-arc etc. are original compositions, not recreations.

## 4. Source coverage

- **Enumerated:** 243 Slider Revolution templates (full gallery listing;
  `sr-slugs.txt` / `sr-templates-all.txt` in scratch).
- **Deep-analyzed (motion protocol):** 17 templates — the complete set of
  founder-linked sources (editorial-product-gallery, filmstrip-hero-3d,
  carousel-pack, scoop-society, mood-board, prime-luxury, from-sketch,
  4-seasons, dj-website, media-gallery, zero-point, bento-travel, urban-oven,
  web-agency, fluid-dynamics, starry-night, raven-cinematic) plus an
  ai-particle-cluster hero. Each analyzed live (scroll sequence + hover +
  slider interaction / video frames) — never from a single static frame
  (MOTION-EVIDENCE LAW).
- **Grounding:** 27 deep sources cited across 14 families; **0 listing-only
  sources** — every family is `grounded` on ≥1 deep, motion-evidenced source.
  Ground-truth kinds: `monitor-observation` + `founder-plan`.

## 5. Corpus stats (see `notes/verification/shell-wdg1/corpus-stats.json`)

- **14 families**, all `grounded` (0 provisional).
- **Readiness:** 2 ready · 9 partial · 3 gap (honesty gate; §7).
- **8 anti-repetition clusters:** carousel, gallery-wall, photo-composite-hero,
  scene-transition, shader-field, transition-fx, typography, video-hero.
- **16 element types** covered (hero×12, gallery×5, background×5, slider×4, …).
- **21 distinct moods**; **4 rendering routes** exercised (R1×10, R2×8, R3×3,
  2d-composition×3; R4 Gaussian-splat not yet — noted in the gap report).
- **11 exemplars** registered.
- Query API: `queryFamilies` (by element/mood/palette/archetype/motion/
  readiness) + `selectDistinctOptions` (one-per-cluster anti-repetition with a
  `usageCounts` rotation seam). Validator `validate.mjs` OK on 14/14.

## 6. Exemplar generation ledger

Pipeline: root `.assetgen/gen-flux.py` → Replicate `black-forest-labs/flux-2-pro`
(the proven W9 pipeline), 1 MP, webp. Driver: `scripts/wdg1/gen-exemplars.sh`
(prompts only, no key material). Registration: `scripts/wdg1/register-exemplars.mjs`.

| # | family | mode | aspect | notes |
|---|---|---|---|---|
| 1 | layered-photo-parallax-hero | live | 4:5 | cold-brew bottle, amber rim, floating beans/cardamom, detached shadow |
| 2 | cinematic-video-hero | live | 16:9 | rain-slick silhouette, teal-orange grade |
| 3 | editorial-product-gallery | live | 3:2 | crystal perfume bottle, museum sweep, negative space |
| 4 | glitch-cyber-fx | live | 3:2 | neon-noir portrait, RGB ghost, acid accent |
| 5 | hover-morph-distortion | live | 3:2 | high-key fashion cutout + flat coral shape |
| 6 | particle-field-hero | live | 16:9 | emergent nucleus + link-lines, cyan→violet |
| 7 | gpu-fluid-overlay | live | 16:9 | iridescent oily ink bloom |
| 8 | parallax-zoom-deep-dive | live | 16:9 | rocky arch → nebula → starfield depth stack |
| 9 | oversized-type-editorial | live | 4:5 | giant "FORM" serif, portrait interleaved, vermilion rule |
| 10 | bento-grid-slider | live | 16:9 | mixed-span rounded tiles, uniform gutters |
| 11 | coverflow-3d-carousel | live | 16:9 | 5-card arc, center-sharp/sides-blurred, glass-floor reflections |

- **Spend:** Replicate ≈ **$0.66** (11 images × ~$0.06) — well under the $6 cap.
  Tripo **0 credits** (no 3D exemplar needed for v1). All `mode: live`.
- **Not exemplared (3 pure-motion families):** filmstrip-3d-carousel,
  infinite-filmstrip-gallery, scroll-video-scrub — a single still cannot fairly
  represent a motion-defined technique; noted honestly rather than faked.

## 7. Gap report summary (`notes/DESIGN-GRAMMAR-GAP-REPORT.md`)

Five blocking clusters, ranked by families unblocked:
1. **W-PHOTO** (R1 cinematic floor + R2 photographic composite pipeline) — the
   dominant dependency; unblocks the most families incl. the load-bearing
   layered-photo hero.
2. **Runtime driver primitives** (candidate W-DRIVERS) — carousel/loop-column/
   theme-token/pointer-velocity/dye-source/grid-solver drivers.
3. **Transition presets** — glitch pass, zoom-through preset.
4. **Video asset types** — video-texture plane + frame-sequence + gen-video.
5. **Safety rails + gates** — photosensitivity limit, light-temperature gate,
   pinned-section scroll, W-2D flat mode.
Honesty law: `readiness` grades runtime execution; exemplars prove only the
aesthetic target, never runtime motion.

## 8. Verification + judges

- `npm run verify` **EXIT 0** (prism 15/15, repair-loop, galaxy, global-shell,
  parity-static, schema, tenancy **35/35**, flight-recorder **PASS**).
- `tsc --noEmit` = **9 errors = baseline, 0 new**.
- `design-grammar/validate.mjs` = **14/14 valid** (dangling pairing refs are
  forward-references to not-yet-authored families — warnings, not errors).
- Flight-recorder: `verify:flight-recorder` PASS (schema-doc freshness +
  invariant suite); new `wdg1-design-analysis` suite 4/4; replayed corpus →
  35-record ledger (`harvest-ledger.ndjson`).
- **Dual judges:** _pending — verdicts recorded here._

## 9. Deviations

See `notes/spec-deviations-wdg1.md` (DEV-1 flight-recorder additive extension;
DEV-2 enumerate-all + deep-sample; DEV-3 /tmp scratch; DEV-4 progress-log).
