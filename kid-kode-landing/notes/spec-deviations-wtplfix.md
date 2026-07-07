# PRISM-WTPLFIX — galaxy-semantics gate failures: root-cause diagnosis

Authored 2026-07-07, BEFORE any fix (per the WTPLFIX rules). Gate under
diagnosis: `scripts/verify-galaxy-semantics.mjs` (invoked by `verify:galaxy`
and by the harness launch preflight `scripts/prism-autonomy-preflight.mjs`).
Per I-GATE the gate definitions are READ-ONLY LAW; this document diagnoses why
the GRAPH and the TEMPLATE CODE stopped conforming to them.

## Observed failures (HEAD = 98342e31)

```
[FAIL] galaxy:overview-projects-components   projected first-level nodes still too high: 77   (cap 64)
[FAIL] galaxy:backgrounds-are-hub-data       ambient background nodes found: mer-dust--ba4c1363
```

Pre-W-TPL (98342e31^) the same gate passed: 338 nodes, 146 overview,
**56 projected**, **0 ambient nodes**.

## Failure 1 — `galaxy:overview-projects-components` (77 > 64)

**Root cause: W-TPL browser-verification residue was committed into the
shipped mock-app graph.**

Boundary commit `98342e31` ("WTPL evidence re-renders …") added 2,322 lines to
`public/prism-mock/home/live-graph.json` — **purely additive** (0 deletions).
The additions are exactly the residue of two live browser-verification acts
from the W-TPL wave:

1. **One instantiated hub template** — hub `tpl-meridian-ba4c1363` plus its 13
   nodes (`mer-*--ba4c1363`: 12 content-role + 1 ambient `mer-dust`). This is
   the Meridian catalog entry instantiated through the real
   `instantiateHubTemplate → addHub → addNodesBatch` flow during picker
   verification. (The instance is the earlier composite-hero form —
   `mer-hero-composite`, subtype `photo-composite-scene` — predating the
   later layered-imageNode rework of `catalog/meridian.ts`.)
2. **One dropped section** — 9 `sec-price-*-52afb624` nodes (pricing-tier
   section) parented into **`s1-arrival`** during section-drop verification.

Mechanism: the editor's save path (`EditorSaveControl` → `/api/prism/regen`
`persist`) atomic-writes `public/prism-mock/home/live-graph.json`. The
verification session's save flushed the instantiated template + dropped
section into the file, and the boundary commit swept the file in wholesale.
This is the **known EDIT-I2 failure mode** ("autosave pollutes live-graph →
git checkout") recurring at a commit boundary.

Arithmetic: 56 (pre) + 12 (meridian content atoms — template atoms match no
`clusterSpecFor` component-cluster rule, so all 12 pass through projection) +
9 (sec-price atoms in s1-arrival: 6 → 15) = **77**.

The projection LAW is untouched and correct: the mock app (ORRERY) projects to
56. The graph stopped conforming because non-product residue was committed
into the product artifact.

## Failure 2 — `galaxy:backgrounds-are-hub-data`

**Root cause (data): the residue includes `mer-dust--ba4c1363`** — subtype
`fx-field`, id matching the ambient classifier
(`starfield|nebula|dust|motes|scatter|particle-field|background|backdrop|ambient`)
— as a first-class graph node. Its parent hub `tpl-meridian-ba4c1363` carries
**no `background[]` data at all** (every real mock-app hub carries 3–4 layers).

**Root cause (code — the deeper defect): the W-TPL template catalog authors
hub-level ambience as first-class nodes, and the template hub factory cannot
even express hub-owned backgrounds.**

- `templateHub()` (`src/lib/templates/node-helpers.ts`) accepts no
  `background` field and emits hubs with `background` absent — so **no
  catalog template CAN conform** to `backgrounds-are-hub-data` today.
- Offending template nodes (id matches the ambient classifier):
  | File | Node | What it is |
  |---|---|---|
  | `catalog/meridian.ts` | `mer-dust` | fxNode, `dust-particles` ambience |
  | `catalog/meridian.ts` | `mer-backdrop` | full-bleed far photo plate, slow parallax |
  | `catalog/marginalia.ts` | `mar-dust` | fxNode, `dust-particles` ambience |
  | `catalog/constellation.ts` | `con-dust` | fxNode, far `dust-particles` field |
  | `catalog/cascade.ts` | `cas-backdrop` | full-bleed deep photo plate, slow parallax |
  | `sections.ts` (Aurora Hero) | `hero-dust` | fxNode, `dust-particles` ambience dropped INTO a host hub |
- Any future instantiation or section-drop of these entries that reaches a
  saved graph re-violates the gate. The committed residue is one instance of
  a systemic authoring gap, exactly as the WTPLFIX prompt suspected.

**The schema and BOTH render paths already support the lawful form** — the
templates simply never registered onto it:

- Schema: `PrismHub.background?: PrismHubBackgroundLayer[]` with
  `kind: 'image' | 'volumetric-nebula' | 'particle-field' | 'parallax-plane' |
  'splat'`, `attachment` (incl. `parallax`, `camera-locked`, `world`),
  `sourceUrl`, `z`, `opacity`, `parallaxDepth`, `params.variant` (`motes`,
  `starfield`, `embers`) — dust fields and far backdrop plates are literally
  what this schema was built for (the mock app's `s4-celestia` carries
  `bg-planetarium`: `attachment: 'parallax'` + `sourceUrl: …/backdrop.png`).
- Editor render: `HubBackgroundStack` (GraphScene:4336) renders
  `hub.background` by kind for ANY hub, schema-driven (FP-3: no per-hub
  hard-coding).
- Runtime render: `compiled-view.ts` §7 SC-037 compiles `hub.background[]` →
  `CompiledHubBackgroundLayer[]`; `mount-graph.ts` EB-06-06/§6 SC-033 renders
  the stack (viewport-fixed / world / parallax / camera-locked roles).

## Fix plan (code conforms to the gate; gate untouched)

1. **Graph remediation:** restore `public/prism-mock/home/live-graph.json` to
   its `98342e31^` content. The W-TPL diff was purely additive, so this
   removes exactly the 1 residue hub + 22 residue nodes and nothing else →
   projection returns to 56, ambient nodes to 0. (Precedented: EDIT-I2.)
2. **Template registration conformance (minimal diff):**
   - `HubSpec`/`templateHub()` gain optional
     `background?: PrismHubBackgroundLayer[]`, forwarded verbatim (additive,
     INV-18).
   - `meridian`: delete the `mer-dust` and `mer-backdrop` NODES; author the
     hub with `background: [parallax image plate (backdrop.png), particle-field
     motes]`.
   - `marginalia`: delete `mar-dust` node → particle-field motes layer.
   - `constellation`: delete `con-dust` node → particle-field motes layer.
   - `cascade`: delete `cas-backdrop` node → parallax image plate layer.
   - `sections.ts` Aurora Hero: delete the `hero-dust` node outright. A
     droppable section lands INSIDE an existing hub; hub-level ambience is the
     host hub's `background[]` job, and a section must not inject ambience
     nodes into someone else's hub. (Merging layers into the host hub's
     `background[]` on drop was considered and rejected: background layers are
     hub-wide with no anchor extent, so a drop would silently restyle the
     whole hub — a scope surprise.)
3. **Explicitly NOT touched:**
   - The gate files and the projection/role law
     (`verify-galaxy-semantics.mjs`, `scripts/lib/galaxy-roles.mjs`,
     `src/lib/prism-graph/galaxy-semantics.ts`) — I-GATE.
   - `con-fireflies` (constellation): does not match the ambient classifier
     and is a mid-scene signature motion element of the family, not stage
     ambience. Left as a node.

**CORRECTION (2026-07-07, during Fix B):** this diagnosis originally scoped
the W8-era `graphs/` templates (`cursor-gallery`, `scroll-hero`,
`particle-showpiece`) out as "cannot reach the gate-checked mock artifact —
their only live path is `store.remixTemplate`". That premise is **stale**: the
W-TPL `catalog-registry.ts` folded all three into `HUB_TEMPLATE_CATALOG` as
`legacy:`-family picker entries (DEV-1), so they are instantiable through the
same `instantiateHubTemplate → addHub → addNodesBatch` flow into the live
graph — the exact failure mode that produced the residue. They are therefore
**in scope for Fix B** and were conformed in the same pattern:

   | File | Was (node) | Now (hub `background[]`) |
   |---|---|---|
   | `graphs/scroll-hero.ts` | `hero-backdrop` image plate | parallax image layer (`hero-bg-plate`) |
   | `graphs/particle-showpiece.ts` | `nova-backdrop` plate, `nova-galaxy` deep field, `nova-nebula` glow | image plate + `particle-field` starfield + `volumetric-nebula` (mirrors the mock app's own s1-arrival stack) |
   | `graphs/cursor-gallery.ts` | `gallery-backdrop` image plate | parallax image layer (`gallery-bg-plate`) |

   `nova-field` (the cursor attract/repel field) stays a NODE — it is the
   interactive star of the showpiece, not passive ambience (the
   `con-fireflies` principle). `nova-galaxy` moved to hub data even though its
   id does not trip the classifier: it is described and used as a passive deep
   backdrop, and leaving it a node while moving its siblings would restore the
   letter of the law but not the law.

   One honest RENAME (not a migration): cursor-gallery's `g-backdrop` is a
   CONTENT tile in the six-tile grid (pointer-tilt + magnetic + reveal, peer
   of `g-brass`/`g-sapphire`) whose id happened to trip the ambient
   classifier — as named, the Galaxy overview would silently collapse a real
   content tile. Renamed `g-atmos` so the graph semantics are true. This is
   the one place WTPLFIX changes an id rather than moving data to the hub,
   and it is the correct direction: the node IS content; the name was the lie.

   Enforcement at the source: `tests/unit/wtpl-catalog.test.ts` gained a
   "galaxy law" block — every catalog instantiation and every section drop is
   asserted to yield ZERO `ambient-background`-classified nodes (via the real
   `getGalaxyNodeRole` classifier), and hub `background[]` is asserted to
   survive `instantiateHubTemplate` verbatim.

## Process note (for the founder/monitor)

The residue entered at a **boundary commit** that swept `git status` wholesale
while a verification dev-server session had persisted editor state. The gate
did its job — it caught the drift at the next launch preflight. Boundary
commits that touch `public/prism-mock/home/live-graph.json` should run
`npm run verify:galaxy` first (it is already part of `npm run verify` and the
preflight; no new gate is needed — only the discipline of running it before
sweeping).
