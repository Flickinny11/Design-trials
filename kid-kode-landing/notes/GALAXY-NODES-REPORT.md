# PRISM — Galaxy Node Semantics Fix — Report

**Author:** Claude Fable 5 (Fable-5-only run)
**Date:** 2026-07-01
**Branch:** `codex/prism-recovery-harness-20260630`
**Scope:** GALAXY node semantics + labeling only. No toolbar/keyframe work. No galaxy rewrite.
**Server used for live verification:** `http://localhost:3000` (`:3001` was not responding;
both dev servers serve the same single working tree, so `:3000` is authoritative for this branch).

---

## 1. DIAGNOSIS (evidence first)

### 1.1 Method
- Read the live projection pipeline end to end: `src/lib/prism-graph/galaxy-semantics.ts`
  (`getGalaxyNodeRole` → `shouldShowInGalaxyOverview` → `getGalaxyOverviewProjection`),
  its single galaxy consumer `GraphScene.tsx:3487`
  (`viewMode === 'galaxy' ? getGalaxyOverviewProjection(nodes) : nodes`), the label renderer
  `NodeLabels` (`GraphScene.tsx:1307`, renders `node.name`), and the gate
  `scripts/verify-galaxy-semantics.mjs` (re-implements the same role/cluster logic).
- Categorized all **327** nodes in `public/prism-mock/home/live-graph.json` with the exact
  in-code logic (`scripts/_galaxy-diagnose.mjs`, a faithful replica).
- Drove the running app in real Chrome (galaxy view, atelier hub) and read the live DOM
  labels + captured before-frames under `notes/verification/galaxy-nodes/`.

### 1.2 Global role counts (all 327 nodes)
```
content: 148   app-shell: 107   hit-target: 72   ambient-background: 0   global-overlay: 0
```

### 1.3 Per-hub breakdown (BEFORE)
| Hub | raw nodes | content (overview) | projected first-level spheres |
|---|---|---|---|
| s1-arrival | 36 | 7 | **5** |
| s2-movement | 39 | 9 | **8** |
| s3-materia | 62 | 32 | **8** |
| s4-celestia | 39 | 9 | **7** |
| s5-acquire | 48 | 18 | **11** |
| s6-atelier | 103 | 73 | **17** |
| **total** | 327 | 148 | **56** |

### 1.4 The founder's background-particle hypothesis is REFUTED by data
The 3D background (starfield / nebula / dust / motes / lighting / ambience) is **already
hub-owned data**, not galaxy nodes:
- `ambient-background` node role count = **0**; `global-overlay` = **0**.
- Every hub already carries `hub.background[]` layers (3 or 4 each), and the live app exposes
  `window.__PRISM_BG_PARTICLE_COUNTS__` / `window.__PRISM_APPLY_BG_PRESET__` — particles are a
  hub-level render layer, not nodes.
- Gate `galaxy:backgrounds-are-hub-data` already passes.

So particles/dust/nebula are **not** the inflation source. (This matters: fixing what isn't
broken would have been wasted, drift-risking work.)

### 1.5 Root cause (the actual inflation)
Two mechanisms, one dominant:

**(A) Embedded decoration leaks into the `content` role → renders as "Support layers" spheres.**
`getGalaxyNodeRole` collapses shell, hit-targets, ambient backgrounds, and global overlays,
but three **pure visual-support** subtypes fall through to `content`:
`text-scrim`, `spec-rail-edge`, `panel-chrome`. There are **7** such nodes and their own
captions describe them as decoration:

| node id | subtype | caption (self-describes as decoration) | hub |
|---|---|---|---|
| `orr-movement-sub-scrim` | text-scrim | "Dark scrim behind the Movement subhead for contrast" | s2 |
| `orr-movement-spec-rail-edge` | spec-rail-edge | "Brass hairline along the spec shelf top edge" | s2 |
| `orr-materia-sub-scrim` | text-scrim | "Dark scrim behind the Materia subhead" | s3 |
| `orr-celestia-sub-scrim` | text-scrim | "Dark scrim behind the Celestia subhead" | s4 |
| `orr-celestia-copy-scrim` | text-scrim | "Soft scrim behind the Celestia descriptive line" | s4 |
| `orr-acquire-availability-scrim` | text-scrim | "Dark scrim behind the Acquire price/availability line" | s5 |
| `orr-atelier-panel-glass` | panel-chrome | "Liquid-glass control panel chrome" | s6 |

The `b9647169` projection buckets these into a `support-layers` cluster — but that cluster
**still renders as a first-class galaxy sphere labeled "Support layers"** in 5 of 6 hubs
(s2, s3, s4, s5, s6; s1 has none, which is exactly why s1 already reads cleanly at 5 spheres).
Per the spec's Protected Ground Truth and the founder's model, embedded decoration must be
**collapsed out of the overview entirely**, not shown as a decoration sphere. **Live proof:**
the rendered galaxy DOM contained the label **"Support layers" twice** (see
`before-03-labels.png`).

**(B) Uninformative labels.** In galaxy, `NodeLabels` renders `node.name`, which is the
title-cased node id. Live DOM read returned noise like **"Orr Arrival Headline"**,
**"Orr Acquire Pedestal"**, and the degenerate cluster label **"Cta CTA"** (the arrival
hero CTAs). The `orr-<hub>-` prefix is app/hub boilerplate that carries no information — this
is the direct cause of the founder's "hard to tell what each node even is." (Labels are also
LOD-hidden when zoomed to the whole-hub overview, so the first read is a *cloud of unlabeled
spheres* — `before-02-atelier-hub.png`.)

**Not a cause:** the component clusters that DO work — material plate-frames →
"material card", atelier swatches → "category options", CTA slab/label/edge → one CTA — are
correct and stay. The material/atelier dense hubs (s3, s6) are dominated by genuine, distinct
UI element-groups (each material card, each configurator category is a real editable element),
so their count is honest, not inflated — the surgical win there is removing the decoration
sphere and labeling the rest clearly, **not** further collapsing real structure (that would be
the forbidden Galaxy rewrite).

### 1.6 One-paragraph root cause
Galaxy inflation is **not** caused by background particles/dust/nebula (those are already
hub-owned layers, 0 nodes). It is caused by (A) seven embedded-decoration nodes
(`text-scrim` / `spec-rail-edge` / `panel-chrome`) that leak through the `content` role and
surface as a meaningless "Support layers" sphere in five hubs, and (B) galaxy labels that show
the raw title-cased node id (`Orr Arrival Headline`, `Cta CTA`) instead of a clean element
name — so even the legitimate spheres are hard to identify. The fix is to classify those
decoration subtypes as a collapsed role (like ambient backgrounds) and to render a clean,
per-element label — no rewrite of the galaxy projection or the runtime graph.

---

## 2. FIX (surgical — projection + labeling only; no galaxy rewrite)

Two files changed (`git diff --stat`: 83 insertions, 16 deletions). No runtime graph
data touched (`live-graph.json` unmodified), no runtime/render path changed, no toolbar or
keyframe work. Backups in `notes/backups/galaxy-nodes-20260701/`.

### 2.1 `src/lib/prism-graph/galaxy-semantics.ts`
1. **New `embedded-decoration` role.** `getGalaxyNodeRole` now classifies the pure visual-
   support subtypes as `embedded-decoration` (checked between `ambient-background` and
   `app-shell`), so they are collapsed out of the overview exactly like ambient backgrounds:
   ```
   EMBEDDED_DECORATION_SUBTYPES = { text-scrim, spec-rail-edge, panel-chrome }
   EMBEDDED_DECORATION_RE       = /(?:^|[-_])(scrim|chrome|underlay)$/i   // tight — never
                                   // matches plate-frame-lip / cta-edge / material-plate
   ```
   The runtime graph is untouched — Canvas and Preview still build these fragments; only the
   Galaxy *overview* hides them.
2. **Removed the dead `support-layers` cluster** from `getClusterSpec` — those nodes never
   reach `content` now, so no "Support layers" sphere is produced.
3. **Clean per-element labels** (`galaxyDisplayName`): strips the `orr-<hub>-` app/hub id
   prefix so each standalone overview sphere reads as its element ("Headline", "Armillary",
   "Spec Rail", "Price") instead of "Orr Arrival Headline". Applied **only** to Galaxy
   projection output — Canvas/Preview keep the original names.
4. **Fixed CTA cluster labels** (`ctaLabel`): the degenerate `hero-cta` → "Cta CTA" and
   `orr-celestia-cta-f4bcta` → "Cta F4bcta CTA" now become **"Primary CTA"**; named CTAs
   ("Reserve", "Enquire", "Atelier") keep their name → "Reserve CTA", etc.

### 2.2 `scripts/verify-galaxy-semantics.mjs` (gate stays truthful)
- Mirrored the `embedded-decoration` role + removed the `support-layers` cluster from the
  gate's replica logic.
- **New blocking assertion** `galaxy:overview-excludes-decoration`: asserts decoration nodes
  exist in the graph, that **zero** leak into the overview, and that **no** `:support-layers`
  cluster is projected.

### 2.3 Per-hub result (AFTER)
| Hub | content (was) | projected spheres (was → now) | first-level labels |
|---|---|---|---|
| s1-arrival | 7 (7) | 5 → **5** | Headline · Subhead · Watch · Primary CTA · Atelier CTA |
| s2-movement | 7 (9) | 8 → **7** | Headline · Subhead · Watch · Tourbillon · Spec Rail · Spec Strip · Craft |
| s3-materia | 31 (32) | 8 → **7** | Headline · Subhead · Brass/Sapphire/Meteorite material card · Eyebrow · Craft Title |
| s4-celestia | 7 (9) | 7 → **6** | Headline · Subhead · Armillary · Orrery · Copy · Primary CTA |
| s5-acquire | 17 (18) | 11 → **10** | Eyebrow · Headline · Pedestal · Watch · Availability · Reserve CTA · Enquire CTA · Price · Included benefits · Assurance |
| s6-atelier | 72 (73) | 17 → **16** | Headline · Subhead · 11 configurator-category clusters · Atelier summary · Atelier controls · Watch |
| **total** | 141 (148) | 56 → **51** | every sphere = one real UI element, cleanly labeled |

The remaining s5/s6 counts are the **honest** element count for those pages (a full 11-category
watch configurator; a conversion page with two CTAs, a price, a benefits list). Collapsing them
further would hide real, editable structure and cross into the forbidden Galaxy rewrite — the
spec asks for one sphere per *real element*, which is now what renders.

---

## 3. VERIFICATION (evidence)

### 3.1 Automated gates (all green)
| Gate | Command | Result |
|---|---|---|
| Galaxy semantics | `npm run verify:galaxy` | **7/7 PASS** — overview 141 · collapsed 186 · projected 51 (22 clusters, atelier 16, materia 7); **new** `overview-excludes-decoration`: 7 decoration nodes collapsed, 0 leaked; 1 intentional `global-hub-missing` WARN (unchanged from WS-W5) |
| Global shell | `npm run verify:global-shell` | **6/6 PASS** |
| Full static chain | `npm run verify` (prism · repair-loop · galaxy · global-shell) | PASS (repair-loop soft-warn as designed) |
| Typecheck | `npm run typecheck:gate` | **PASS — 0 new** (9 total · baseline 10) |
| Live node-authorship | `node scripts/node-authorship-gate.mjs http://localhost:3000 --strict-orphans` | **9/9, 0 hard-fail, 0 page errors** — 158 node-authored artifacts all in graph (runtime unchanged) |

### 3.2 Live real-Chrome galaxy proof (`http://localhost:3000`, WebGPU)
Drove the running app in galaxy view (atelier hub). Read the rendered DOM node labels
directly (`.font-mono.font-semibold`):

| Signal | BEFORE (frame `before-03-labels.png`) | AFTER (frames `after-03..06`) |
|---|---|---|
| "Support layers" decoration spheres | **present (×2 in view)** | **absent** (`hasSupportLayers:false`) |
| "Orr <Hub> <Element>" noise labels | present ("Orr Arrival Headline", "Orr Acquire Pedestal") | **absent** (`hasOrrPrefix:false`) |
| degenerate CTA labels | "Cta CTA" | **absent** (`hasCtaCta:false`) — now "Primary CTA" |
| sample of rendered labels | — | Headline · Watch · Movement options · Case options · Dial options · Reserve CTA · Enquire CTA · Price · Included benefits · Armillary · Orrery |

Frames captured under `notes/verification/galaxy-nodes/`:
`before-01-galaxy-overview.png`, `before-02-atelier-hub.png`, `before-03-labels.png`,
`after-03-atelier-labels.png`, `after-04-atelier-closeup.png`, `after-05-atelier-cloud.png`,
`after-06-labels-crisp.png`.

### 3.3 Founder acceptance criteria
- **"one node per real UI element"** — YES: decoration collapsed (7 nodes → 0 spheres); sub-
  fragments still cluster into one card/category; every sphere maps to a real element.
- **"can tell what each node is"** — YES: every sphere carries a clean, human label.
- **"background is ambience, not spheres"** — YES (already true, now proven): 0 ambient-
  background / global-overlay nodes; all 6 hubs own `background[]` particle layers.
- **Canvas + Preview + `.prism` runtime preserved** — YES: no graph/runtime edit; node-
  authorship 9/9; label rewrite is galaxy-projection-only.

### 3.4 Fresh-context judges (Fable 5) — both PASS, 0 MUST-FIX
- **`prism-criteria-reviewer`** — **PASS**, MUST-FIX: none. Independently re-counted
  `live-graph.json` (confirmed exactly the 7 decoration nodes), verified the regex
  `(scrim|chrome|underlay)$` matches only `text-scrim`/`panel-chrome` and steals no clustered
  fragment, confirmed the projection is galaxy-gated only (`GraphScene.tsx:3487`,
  `Minimap.tsx:36`) so canvas/preview are byte-identical, confirmed the shared-chrome dedup
  path (`assembled-nodes.ts`) is unaffected, gate faithfully mirrors source, Forbidden-Drift
  scan CLEAN, Law 0 not violated. Nits (non-blocking): `TERSE_TAIL_LABELS` covers only `sub`
  today (forward-compat watch-point); no colocated `*.test.ts` (gate re-implements logic and
  could drift over time).
- **`user-advocate`** (non-technical founder, evidence-only) — **net PASS / gate PASS**,
  MUST-FIX: none. Corroborated the reduction from the running app's **own minimap** (atelier
  pill 17→16; header "51 NODES") rather than the report; confirmed clean human labels, no
  "Support layers"/"Orr …"/"Cta CTA", background is flat nebula ambience. Flags (taste, non-
  blocking): atelier's 16 is honest but at the upper edge of scan comfort (an optional future
  "Configurator" grouping could reduce load — deliberately NOT done here to avoid hiding real
  structure / a Galaxy rewrite); labels are LOD-hidden at full-hub-overview zoom, so a few
  anchor labels there would improve first-glance clarity.

### 3.5 Optional follow-ups (out of scope for this surgical run; not blocking)
1. A few always-on "anchor" node labels at mid/overview zoom so the first glance into a hub
   isn't briefly a cloud of unlabeled orbs (a `NodeLabels` LOD tweak, not a projection change).
2. A colocated `galaxy-semantics.test.ts` importing the real TS functions so the `.mjs` gate
   and the source can't silently diverge.
Neither is required to meet the founder brief; both are recorded for a future labeling/LOD pass.

---

PRISM-GALAXY-NODES: RUN COMPLETE

