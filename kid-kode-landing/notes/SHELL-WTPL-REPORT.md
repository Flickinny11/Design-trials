# SHELL W-TPL — TEMPLATE CATALOG v1 (run report)

Status: **IN PROGRESS** (started 2026-07-07)
Branch: `codex/prism-recovery-harness-20260630`
Prompt of record: `../SHELL-WTPL-PROMPT.md` (founder-ratified 2026-07-06).
Binding law: `notes/PRISM-DESIGN-SUPREMACY-PLAN.md` §2 (legal doctrine) + §4 W-TPL,
`design-grammar/families/*.json`, DL11–16 + Font A, I-CANVAS / I-ENGINE /
I-SECRETS / I-PROVENANCE / I-ADDITIVE.

## 1. Mission recap

Original, grammar-derived template catalog v1 in the prism runtime:
12–16 complete hub templates (8 archetypes, anti-repetition law), 8–10 section
templates, a categorized+searchable picker with "new hub from template"
(planet + tethered nodes in galaxy → name-your-hub → canvas-editable) and
section-drop into existing hubs. Every template = real prism nodes that
preview-animate per their own schema. All assets generated via our pipelines.
Flight-recorded catalog events.

## 2. Deliverables ledger

| # | Deliverable | Status |
|---|---|---|
| D1 | Catalog data layer (types, registry, anti-repetition validation) | **DONE** (`cd45de46`) |
| D2 | Generated asset sets (FLUX composites + tile sets, spend-logged) | **DONE** (`a831c5b6`) |
| D3 | 13 new hub templates (+ 3 W8 folded in = 16 total) | **DONE** (`908a8306`, `7c7809b1`) |
| D4 | 8–10 section templates (10 shipped) | **DONE** (`+ sections.ts`) |
| D5 | Picker UI (galaxy new-hub flow + canvas section-drop) | **DONE** (`+ NewHubPicker`) |
| D6 | Flight-recorder catalog events (9th record type) | **DONE** (`+ catalog_event`) |
| D7 | Verify + evidence + dual judges | **DONE** (this report §5–7) |

## 3. The archetype × family matrix (anti-repetition law of record)

Law (PLAN §3/§4): no two templates from the same PRIMARY grammar family per
archetype. The catalog folds in the three W8 templates (Aperture, Atlas, Nova)
with metadata; new templates chosen so every archetype carries two entries with
distinct primary families.

| archetype | template A (family) | template B (family) |
|---|---|---|
| landing | Nova — particle-field-hero (W8) | **Meridian** — layered-photo-parallax-hero |
| marketing | **Cascade** — parallax-zoom-deep-dive | **Tessella** — bento-grid-slider |
| about | **Chronicle** — oversized-type-editorial | **Constellation** — particle-field-hero |
| contact | **Beacon** — hover-morph-distortion | **Waypoint** — coverflow-3d-carousel |
| gallery | Atlas — editorial-product-gallery (W8) | **Lumen** — infinite-filmstrip-gallery |
| pricing | **Ledgerline** — editorial-product-gallery | **Abacus** — bento-grid-slider |
| product-showcase | Aperture — scroll-product-hero (W8) | **Vitrine** — filmstrip-3d-carousel |
| editorial | **Folio** — oversized-type-editorial | **Marginalia** — layered-photo (single-plate depth) |

Gap-status families (cinematic-video-hero, scroll-video-scrub, glitch-cyber-fx)
are deliberately NOT used as primaries — their blockers (gen-video source,
frame-sequence asset, photosensitivity rail) are future-wave scope per the
gap report.

## 4. Spend ledger (running)

Budget: Replicate ≤ $8.00 est · Tripo ≤ 80 credits.

| when | what | model | est cost | running total |
|---|---|---|---|---|
| 07-07 01:45 | meridian-hero composite run 1 (backdrop + depth; product stage transient FLUX failure) | flux-2-pro + depth-anything-v2 | $0.083 | $0.08 |
| 07-07 01:52 | meridian-hero composite retry (product + 3 garnish + 4 bria cutouts; idempotent skip of run-1 stages) | flux-2-pro + bria | $0.40 | $0.48 |
| 07-07 01:55 | gen-wtpl-assets all sets — 24 FLUX stills + 6 bria cutouts + 1 depth (marginalia/lumen×6/vitrine×4/chronicle×3/beacon/cascade/ledgerline×3/folio×2/tessella×3/waypoint); 0 failures | flux-2-pro + bria + depth-anything-v2 | $2.36 | **$2.84** |
| 07-07 08:_ | D7 fix — meridian backdrop regenerated (luminous-teal dawn) + depth, after the original "deep near-black" plate rendered black in-runtime | flux-2-pro + depth-anything-v2 | $0.083 | **$2.92** |

Tripo: 0 credits used. Provenance (prediction ids): `public/prism-mock/photo/meridian-hero/composite.json` + `public/prism-mock/templates/provenance.json`.

## 5. Architecture

**Data layer (D1, pure — no store/React/DOM):**
- `catalog-types.ts` — `HubTemplateEntry` / `SectionTemplateEntry` / `TemplateArchetype` /
  `SectionKind` / `SectionAnchor`. Grammar family ids stay INLINE string literals (W-DG1
  pattern); the test grounds them against `design-grammar/families/*.json` on disk.
- `catalog/*.ts` — 13 hub-template graphs (one file each). Each is a real `GraphSource`
  (hub + parented `PrismNode`s) authored via `catalog-helpers` / `node-helpers`.
- `sections.ts` — 10 `SectionTemplateEntry`s; each `build(anchor)` returns seq-suffixed,
  anchor-parented nodes. Asset-free by law (PBR mesh + extruded text + particle fx).
- `catalog-registry.ts` — folds the 3 W8 templates in with archetype metadata (DEV-1) +
  the 13 new ones = 16; `SECTION_TEMPLATE_CATALOG` = the 10 sections; search + lookup.
- `instantiate.ts` — deep-clones a template's graph with every hub/node id remapped to
  fresh collision-free ids (galaxy planet free via hub-geometry hash of the fresh hubId).

**Picker UI (D5, additive editor chrome):**
- `stores/useTemplatePickerStore.ts` — tiny dedicated open/close store (`hub` | `section`).
- `components/editor/templates/NewHubPicker.tsx` — the overlay: categorized (archetype rail)
  + searchable grid, name-your-hub, live `/templates/<slug>` Preview link. Hub flow:
  `instantiateHubTemplate → addHub × hubs → addNodesBatch(nodes) → drillIntoHub(primaryHubId)`
  (galaxy → canvas). Section flow: resolve active hub → `build({hubId, y: below existing
  content, seq})` → `addNodesBatch`.
- `components/editor/templates/TemplateLauncher.tsx` — mode-aware floating button (galaxy →
  "New hub from template"; canvas → "Add a section"; hidden in preview-app).
- Both mounted in `app/page.tsx`'s modal cluster — no TopBar / CanvasToolbar edits.

**Flight recorder (D6):** `catalog_event` (9th record type) + `catalog` touchpoint in
`flight-recorder/schema.ts` + `recordCatalog` emit helper; fail-open ingest route
`/api/prism/catalog-event` + client `catalog-beacon.ts` (sendBeacon / keepalive). Each
instantiate-hub / drop-section fires a labeled "archetype + family → real graph" record.

**Preview:** the existing `/templates/[slug]` route already runs any catalog template's real
graph in the shipped `ConductorRuntime` (live scroll/pointer/inview drivers), so every
template preview-animates per its own schema.

## 6. Evidence index

Evidence dir: `notes/verification/shell-wtpl/`

| File | What it shows |
|---|---|
| `01-galaxy-launcher.png` | Galaxy view with the "New hub from template" launcher |
| `02-picker-hub-desktop.png` | The picker: 16 templates, archetype rail, route badges, family labels |
| `03-picker-selected-named.png` | Meridian selected (teal glow) + "Aurora Skincare" named + footer enabled |
| `04-canvas-new-hub.png` | The new hub drilled into CANVAS — Meridian content mounting, inspector shows the name |
| `05-preview-app-new-hub.png` | Preview-app runs cleanly (ORRERY app; zero regression from the additive chrome) |
| `06-picker-mobile.png` | The picker responsive on mobile (390px) — single-column cards, all chrome intact |
| `07-section-picker.png` | The "Add a section" picker (canvas mode) — 10 sections with kind badges |
| `hero-01-meridian.png` … `hero-10-cascade.png` | 8 template heroes running live in the runtime |

**Functional assertions (via `__PRISM_DEBUG_STORES__`):** new-hub landed a hub titled
"Aurora Skincare" (`tpl-meridian-…`) with 13 remapped nodes (hubs 6→7); section-drop landed
9 seq-suffixed pricing-triptych nodes into `s1-arrival` (39→48), collision-free. Beacon
endpoint `/api/prism/catalog-event` returns `{ok:true, recorded:true}` (D6 live).

**Runtime render notes (honest):** the image-based templates (meridian, beacon, chronicle,
lumen, vitrine, folio, marginalia, cascade) render premium in the runtime. The two
mesh-heavy ones (waypoint, ledgerline) fight the runtime's un-lit / AgX-tonemapped path —
capped clearcoat/metalness + raised roughness diffused the flat-card specular blowout
(waypoint now reads as a soft coverflow deck); ledgerline's dense extruded-text bevels still
dither under AgX (DEV-6) and is the weakest card, but reads as a material-object editorial
pricing layout. All 16 edit cleanly in canvas (which applies full lighting).

## 7. Judge verdicts

Two fresh-context judges, 0 MUST-FIX each.

**criteria-reviewer — PASS (0 MUST-FIX).** All 9 success criteria pass with executed
test/code evidence: 16 hubs across exactly 8 archetypes (2 each, anti-repetition holds),
10 sections (seq-suffixed, collision-free), grammar grounding on disk, picker additive (2
imports + 2 mounts in page.tsx, nothing removed; W8 `registry.ts` untouched), real graphs
mount in the shipped ConductorRuntime (no static mockups; 49 asset URLs resolve),
`catalog_event` is a real 9th record type (consent-quarantine + PII scrub proven), INV-19 /
I-PROVENANCE (35 real Replicate prediction ids) / I-ENGINE / I-ADDITIVE all clean, DEV-1..6
honest and code-matched. `wtpl-catalog.test.ts` 8/8, `wtpl-catalog-event.test.ts` 4/4, tsc
0 new. No forbidden patterns. Two cosmetic SHOULD-FIX nits (section stacking read, a stray
space in a test) — non-blocking.

**user-advocate (picky founder building three businesses) — PLEASED (0 MUST-FIX).**
Premium: YES ("read as things a top studio would ship, not a demo"). Distinct: YES
("emphatically… photo diorama vs oversized type vs coverflow vs filmstrip vs gallery-grid vs
depth-parallax vs terrain-relief — structurally different templates"). Mine-able: YES
("original compositions with swappable slots… swap the palette + drop in your own imagery and
it becomes your brand"). Strongest 3: **meridian, folio, cascade**. The pick→name→land→preview
flow "works." Flagged ledgerline as the one weak card ("acceptable… the other 9 carry the
catalog, NOT a dealbreaker, not a MUST-FIX").

**Post-verdict polish:** ledgerline (the advocate's one flagged card) was then reworked — each
tier now a full-bleed material photograph with clean type over the dark-slate half (DEV-6
addendum) — resolving the extruded-text-over-mesh dither. Re-verified clean + premium in the
runtime (`hero-05-ledgerline.png`).

Marker lines (verbatim, for the chain sentinels — run-surface-v2.sh watches the
SHELL-prefixed form, chain-W2D.sh watches the un-prefixed form):

PRISM-SHELL-WTPL: RUN COMPLETE
PRISM-WTPL: RUN COMPLETE

## 8. Deviations

See `notes/spec-deviations-wtpl.md`.
