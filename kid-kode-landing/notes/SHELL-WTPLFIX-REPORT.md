# SHELL W-TPLFIX — Galaxy Semantics Remediation Report

Status: IN PROGRESS (skeleton). Working branch:
`codex/prism-recovery-harness-20260630`.

Remediation of the two failing checks in the launch-preflight galaxy-semantics
gate (`scripts/verify-galaxy-semantics.mjs`), post W-TPL:

1. `galaxy:overview-projects-components` — projected first-level nodes 77 > 64.
2. `galaxy:backgrounds-are-hub-data` — first-class ambient node
   `mer-dust--ba4c1363` in the live graph.

## §1 Diagnosis (root-cause first)

Full diagnosis: `notes/spec-deviations-wtplfix.md` (authored before any fix).

Summary: (1) W-TPL browser-verification residue (one instantiated Meridian
template hub + one dropped pricing section, 23 objects) was persisted by the
editor save path and swept into boundary commit `98342e31`, pushing the
projection from 56 → 77; (2) the W-TPL template catalog authors hub-level
ambience (dust fields, far backdrop plates) as first-class nodes, and
`templateHub()` cannot carry `background[]` at all — so no template hub could
conform to `backgrounds-are-hub-data`, while the schema and both render paths
(editor `HubBackgroundStack`, runtime `mount-graph` SC-033/SC-037) already
fully support hub-owned backgrounds.

## §2 Fixes

- **Fix A (graph):** _pending_ — restore `public/prism-mock/home/live-graph.json`
  to the pre-residue `98342e31^` content (the W-TPL diff was purely additive).
- **Fix B (template registration / hub-schema conformance):** _pending_ —
  `templateHub()` gains optional `background?: PrismHubBackgroundLayer[]`;
  meridian/marginalia/constellation/cascade move ambience+backdrop nodes into
  hub `background[]` layers; Aurora Hero section drops its `hero-dust` node.
- Gate files and projection/role law untouched (I-GATE).

## §3 Gate battery (to be committed verbatim)

- `node scripts/verify-galaxy-semantics.mjs` — _pending_
- `node scripts/prism-autonomy-preflight.mjs` — _pending_
- `npm run verify` — _pending_
- W5B ship gate (`tests/unit/shell-w5b-ship-anywhere.test.ts`) — _pending_
- `tsc` 0-new — _pending_
- Template unit suite (`tests/unit/wtpl-catalog.test.ts`) — _pending_

## §4 Browser evidence

_pending_ — galaxy frames (grouped first-level view) + a live-instantiated
template hub whose background is hub-data (inspector/store evidence), captured
without re-polluting the committed graph.

## §5 Judge verdicts (fresh-context, 0 MUST-FIX required)

- `prism-criteria-reviewer` — _pending_
- `user-advocate` as "prism runtime purist: is the graph law actually
  restored, or papered over?" — _pending_

## §6 Evidence index

_pending_
