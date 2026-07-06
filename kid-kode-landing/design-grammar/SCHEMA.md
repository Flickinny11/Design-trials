# PRISM DESIGN GRAMMAR — corpus v1 (`prism-dg-v1`)

A structured, machine-usable taxonomy of premium web design **TECHNIQUE
FAMILIES** (never templates), distilled per PRISM-DESIGN-SUPREMACY-PLAN.md §3
from live, motion-evidenced analysis of the Slider Revolution gallery,
founder-linked templates, and Awwwards winners.

## Layout

```
design-grammar/
  types.ts          — TS schema (FamilyDoc + vocabularies) — the contract
  validate.mjs      — runtime validator; CLI: node design-grammar/validate.mjs
  index.ts          — typed loader + query API (fs-based, server-side)
  families/*.json   — one FamilyDoc per technique family (id = filename stem)
  observations/     — monitor-session observation seeds (ground truth inputs)
  exemplars/        — ORIGINAL renders we generated (I-PROVENANCE-labeled)
```

## Legal doctrine (PLAN §2 — binding)

Every committed field carries **distilled principles in our own words**:
technique families, motion grammar (easing character, pacing, choreography),
palette **logic** (rules, never harvested hex values), composition rules,
lighting recipes, layering strategies, pairings. Never: source images, copy
text, code, assets, or a specific template's composition (brand/color/name
swaps included). `sources[]` entries are title+URL **citations** with our
observations. Exemplars are **original** renders generated through our own
adapters, labeled with their real generation source. Analysis screenshots are
ephemeral working notes in `/tmp/wdg1-scratch/` — deleted at wave end, never
committed.

## Evidence laws encoded in the validator

- **Motion-evidence law** — a source with `analysisDepth: 'deep'` must carry
  `motionEvidence` (how motion was observed: scroll sequence, hover states,
  slider interaction, video frames). `status: 'grounded'` requires ≥1 deep
  source. Static single screenshots prove nothing about animation-first
  design; classification is from the SEQUENCE.
- **Honesty law** — `readiness` short of `'ready'` requires `gapNotes`
  (feeds `notes/DESIGN-GRAMMAR-GAP-REPORT.md`). No capability claims without
  a demonstrated exemplar.
- **Provenance (I-PROVENANCE)** — every exemplar states `generator`, `model`,
  and `mode` (`live` vs `demo-fixture`) truthfully.

## Query axes

`queryFamilies` filters by **element type**, **mood**, **palette logic**,
**hub archetype** (matching the intake deck's archetype card:
saas/commerce/content/community + extensions), **motion character**, and
**readiness**. `selectDistinctOptions` implements the anti-repetition law:
option sets draw from distinct `antiRepetition.clusterId`s, ranked by the
caller-supplied `usageCounts` rotation seam (per-user/global usage tracking
is a later wave; the ids are load-bearing now).

## Consumers (wired in later waves)

(a) intake/streaming-chat option bubbles · (b) per-node prompt-to-element
styling · (c) Conductor whole-app theme composition · (d) Flight Recorder
taste links (`design_analysis_event`) · (e) judge rubrics.

## Capability mapping vocabulary

- `renderingRoutes`: `R1` realtime PBR · `R2` pre-rendered/pre-baked
  sequences + layered photographic cutout composites · `R3` baked-lighting
  hybrids · `R4` Gaussian splats · `2d-composition` (flat/graphic, no
  photoreal route needed).
- `genModels`: real adapters/models only (`flux-2-pro`, `tripo-v3.1`,
  `hunyuan3d-3.1`, `rodin-gen2`, `derive-material-pbr`, …).
- `primitives`: the 9 seed cinematic primitives + shipped runtime systems
  (`hub-background`, `hub-transition-preset`, `custom-cursor-layer`,
  `scroll-scrub-driver`, `inview-driver`, `msdf-text`, `extruded-text`,
  `physics-sim`, `fluid-sim`, `particle-system`, `keyframes`,
  `pbr-material`, …).

## Stability contract

Family `id`s and `antiRepetition.clusterId`s are stable identifiers —
downstream taste data keys on them. Never rename a shipped family; supersede
by adding a new family in the same cluster.
