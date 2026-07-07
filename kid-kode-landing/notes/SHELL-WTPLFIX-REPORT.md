# SHELL W-TPLFIX — Galaxy Semantics Remediation Report

Status: **COMPLETE** — both judges 0 MUST-FIX (§5). Working branch:
`codex/prism-recovery-harness-20260630`.

Remediation of the two failing checks in the launch-preflight galaxy-semantics
gate (`scripts/verify-galaxy-semantics.mjs`), post W-TPL:

1. `galaxy:overview-projects-components` — projected first-level nodes 77 > 64.
2. `galaxy:backgrounds-are-hub-data` — first-class ambient node
   `mer-dust--ba4c1363` in the live graph.

## §1 Diagnosis (root-cause first)

Full diagnosis: `notes/spec-deviations-wtplfix.md` (authored before any fix;
commit `d6f0a4bc`, with one scoping CORRECTION recorded during Fix B).

Summary: (1) W-TPL browser-verification residue (one instantiated Meridian
template hub + one dropped pricing section, 23 objects) was persisted by the
editor save path and swept into boundary commit `98342e31`, pushing the
projection from 56 → 77 and landing the ambient `mer-dust--ba4c1363` node;
(2) the deeper defect — the W-TPL template catalog authors hub-level ambience
(dust fields, far backdrop plates) as first-class nodes, and `templateHub()`
could not carry `background[]` at all, so **no catalog template could
conform** to `backgrounds-are-hub-data`, while the schema
(`PrismHub.background?: PrismHubBackgroundLayer[]`) and both render paths
(editor `HubBackgroundStack`, runtime `mount-graph` SC-033 / `compiled-view`
SC-037) already fully support hub-owned backgrounds.

Scoping correction (recorded in the diagnosis file): the W8-era `graphs/`
templates were originally scoped out as unreachable, but W-TPL's
`catalog-registry.ts` folded them into `HUB_TEMPLATE_CATALOG` as `legacy:`
picker entries — same instantiation path, same failure mode — so they were
conformed in Fix B too.

## §2 Fixes

- **Fix A (graph), commit `d96f3005`:** restored
  `public/prism-mock/home/live-graph.json` to the pre-residue `98342e31^`
  content. The W-TPL diff was purely additive, so this removed exactly the
  residue (hub `tpl-meridian-ba4c1363` + 13 nodes, 9 `sec-price-*` nodes in
  `s1-arrival`) and nothing else. Projection 77 → 56; ambient nodes 1 → 0.
- **Fix B (template registration / hub-schema conformance), commit
  `37b5b091`:**
  - `templateHub()` gains optional `background?: PrismHubBackgroundLayer[]`,
    forwarded verbatim (additive, INV-18).
  - `catalog/meridian.ts`: `mer-backdrop` + `mer-dust` nodes → hub
    `background: [mer-bg-plate (parallax image), mer-bg-motes (camera-locked
    particle-field)]`.
  - `catalog/marginalia.ts`: `mar-dust` node → `mar-bg-motes` layer.
  - `catalog/constellation.ts`: `con-dust` node → `con-bg-dust` layer
    (`con-fireflies` stays a node — signature motion element, not ambience).
  - `catalog/cascade.ts`: `cas-backdrop` node → `cas-bg-plate` layer.
  - `graphs/scroll-hero.ts`: `hero-backdrop` node → `hero-bg-plate` layer.
  - `graphs/particle-showpiece.ts`: `nova-backdrop`/`nova-galaxy`/`nova-nebula`
    nodes → image plate + `particle-field` starfield + `volumetric-nebula`
    layers (mirrors the mock app's own s1-arrival stack). `nova-field` (cursor
    attract/repel) stays a node — the interactive star, not ambience.
  - `graphs/cursor-gallery.ts`: `gallery-backdrop` node → `gallery-bg-plate`
    layer; content tile `g-backdrop` **renamed** `g-atmos` (it is a real
    grid tile whose misnamed id tripped the ambient classifier — the node is
    content; the name was the lie).
  - `sections.ts` Aurora Hero: `hero-dust` node deleted outright — a droppable
    section must not inject ambience nodes into a host hub; hub-wide
    atmosphere is the host hub's `background[]` job.
  - New "galaxy law" test block in `tests/unit/wtpl-catalog.test.ts`: every
    catalog instantiation and every section drop asserted to yield ZERO
    `ambient-background`-classified nodes (via the real `getGalaxyNodeRole`
    classifier), and hub `background[]` asserted to survive
    `instantiateHubTemplate` verbatim.
- **Gate files and projection/role law untouched (I-GATE):**
  `git diff 98342e31..HEAD -- scripts/verify-galaxy-semantics.mjs
  scripts/lib/galaxy-roles.mjs src/lib/prism-graph/galaxy-semantics.ts` is
  empty.

## §3 Gate battery (verbatim outputs committed)

| Check | Result | Evidence |
|---|---|---|
| `node scripts/verify-galaxy-semantics.mjs` | **7/7 PASS**, exit 0 (projection 56 first-level / 22 clusters from 146 atoms; 6/6 hubs carry background layers; known intentional WARN `galaxy:global-hub-missing` unchanged) | `notes/verification/wtplfix/gate-galaxy-semantics.txt` |
| `node scripts/prism-autonomy-preflight.mjs` | **CLEAR: preflight passed**, exit 0 | `notes/verification/wtplfix/gate-preflight.txt` |
| `npm run verify` | **EXIT 0** | `notes/verification/wtplfix/verify-aggregate.txt` |
| W5B ship gate (`tests/unit/shell-w5b-ship-anywhere.test.ts`) | **11/11 PASS** | run log in session; suite green |
| `tsc` | **9 = 9 baseline, 0 new** (none in templates) | session run |
| Template unit suite (`tests/unit/wtpl-catalog.test.ts`) | **11/11 PASS** incl. the 3 new galaxy-law tests | session run |

The galaxy gate was re-run AFTER the browser-evidence session + artifact
restore (§4) and re-confirmed 7/7.

## §4 Browser evidence (live, port 3009, fresh dev server)

Captured by driving the REAL flow — galaxy view → "+New hub from template" →
Meridian → Create hub — with Playwright/Chromium (WebGPU on):

- `notes/verification/wtplfix/01-galaxy-overview.png` — Galaxy first-level
  view: 6 hub planets with GROUPED component clusters in orbit (hub rail:
  Arrival 6 / The Movement 8 / Materia 8 / Celestia 7 / Acquire 10 /
  The Atelier 17 — the projected counts, not the 146 raw atoms).
- `notes/verification/wtplfix/02-picker-open.png` — the template picker.
- `notes/verification/wtplfix/03-meridian-instantiated.png` — the instantiated
  Meridian hub rendering (MERIDIAN headline over the hub-background plate) with
  the hub panel open.
- `notes/verification/wtplfix/04-galaxy-with-template-hub.png` — Galaxy with
  the new template hub focused: ONLY content nodes in its orbit; the hub panel
  ("Meridian - Layered Photo Hero") reads its background stack as hub data.
- `notes/verification/wtplfix/store-evidence.json` — the store dump
  (inspector-level evidence): instantiated hub `tpl-meridian-9fc5f2b2` carries
  `background: [mer-bg-plate, mer-bg-motes]` verbatim; 17 content nodes;
  **whole-graph ambient-id matches: `[]`** across all 355 nodes / 7 hubs
  (6 mock-app + the live instance); all 7 hubs carry `background[]`.

**Artifact hygiene:** the picker flow persisted the live instance into
`public/prism-mock/home/live-graph.json` — the exact EDIT-I2 mechanism that
caused the original residue. The file was `git checkout`-restored immediately
after capture and the gate re-run (7/7). The committed graph is untouched by
the evidence session.

## §5 Judge verdicts (fresh-context, 0 MUST-FIX required)

- `prism-criteria-reviewer` — **PASS, 0 MUST-FIX.** All 7 criteria PASS with
  executed evidence (re-ran the gate 7/7 exit 0, the 11/11 unit suite, tsc
  9=baseline; verified the gate-file diff over `98342e31..HEAD` is EMPTY and
  the gate reads the raw graph unfiltered — no special-casing; verified Fix A
  is a byte-identical restore via `git diff 98342e31^ HEAD -- live-graph.json`
  = empty; scrutinized the `g-backdrop → g-atmos` rename and ruled it HONEST —
  a real 6th grid tile with the same pointer-tilt/parallax/fade bindings as
  its content peers, while the actual 17×10 z=−5 ambient plate was separately
  moved to `hub.background`). One SHOULD-FIX: commit the evidence directory
  (untracked at review time) — **done in this commit**.
- `user-advocate` as "prism runtime purist: is the graph law actually
  restored, or papered over?" — **PLEASED, 0 MUST-FIX. Verdict: ACTUALLY
  RESTORED at the source, not papered over.** Independently re-ran the gate
  (7/7), the parity gate (DIRECTION A/B PASS, 146 atoms → 56 first-class,
  0 dropped), the unit suite (11/11), and an independent regex scan of the
  committed graph (0 ambient nodes, 6/6 hubs with background[]). Confirmed the
  `.mjs` classifier is byte-identical to the TS source of truth; confirmed the
  purist line is drawn correctly (passive backdrop = hub data;
  cursor-reactive `nova-field`/`con-fireflies` = content nodes); ruled the
  Aurora Hero `hero-dust` deletion SOUND and law-required
  (`SectionTemplateEntry` has no background seam, so relocation was
  impossible; injection is forbidden). Notes the law is now "more than
  restored — enforced by a test that blocks any future template from
  re-landing an ambient node."
  - SHOULD-FIX 1 (non-blocking): make the Aurora Hero's reliance on host-hub
    atmosphere an explicit contract rather than a silent absence. **Addressed
    in-code already**: `sections.ts` carries the contract comment ("hub-level
    ambience is the HOST hub's background[] job… the hero rides the host
    hub's own atmosphere") and the honest tagline; the diagnosis records why
    a drop-time background merge was REJECTED (hub-wide layers have no anchor
    extent — a drop would silently restyle the whole hub). An additive
    `SectionTemplateEntry.background?` seam remains a possible future wave
    item, deliberately not smuggled into this minimal-diff remediation.
  - SHOULD-FIX 2 (non-blocking, pre-existing): `galaxy:global-hub-missing`
    WARN — the standing WS-W4 intentional deferral, out of this wave's scope.

PRISM-WTPLFIX: RUN COMPLETE

## §6 Evidence index

- Diagnosis: `notes/spec-deviations-wtplfix.md` (`d6f0a4bc`, corrected in
  `37b5b091`).
- Fix A: commit `d96f3005` (live-graph restore).
- Fix B: commit `37b5b091` (12 files, templates + tests + notes).
- Gate outputs: `notes/verification/wtplfix/gate-galaxy-semantics.txt`,
  `notes/verification/wtplfix/gate-preflight.txt`,
  `notes/verification/wtplfix/verify-aggregate.txt`.
- Browser frames + store dump: `notes/verification/wtplfix/*.png`,
  `notes/verification/wtplfix/store-evidence.json`.
