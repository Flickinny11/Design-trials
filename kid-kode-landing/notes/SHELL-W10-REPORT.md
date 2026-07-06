# SHELL W10 — GENERATIVE 3D CAPABILITY FAMILY IN THE EDITOR — RUN REPORT

**Branch:** `codex/prism-recovery-harness-20260630` · **Baseline HEAD:** `26494682`
**Governing:** `SHELL-W10-PROMPT.md` (founder-directed 2026-07-05) ·
`docs/prism/PRISM-NODE-EDITOR-SPEC-V2.md` (criteria B/C) · INV-NEV2-4 (D1) · INV-19 ·
`notes/spec-deviations-w10.md` (method records, written first).
**Status:** RUN COMPLETE (pending dual-judge sign-off recorded below).

## Mission
Expose generative-3D powers (object generation, PBR texturing, auto-rig, part
segmentation, world generation, mesh ops) as NATIVE, user-facing capabilities inside
the node editor + builder — metered against user credits — through the existing
provider-agnostic capability architecture. Tiles named MODEL + FUNCTION, never vendor
platform tiles; adapters do the vendor work behind the interface.

## Architecture (all additive)
- **Interface** `src/lib/capabilities/generative.ts` — `GenerativeCapabilityAdapter`,
  a D1 sibling to `CapabilityProvider` (async job pattern: submit → poll → typed
  asset ref). INV-NEV2-4 carried over verbatim.
- **Catalog** `src/lib/capabilities/generative-catalog.ts` — 11 client-safe tile
  descriptors (MODEL + FN labels, DL14 glyph keys, params, cost basis). No keys.
- **Adapters** `src/server/capabilities/generative/`:
  - `tripo-adapter.ts` — LIVE: text/image→3D, 8K PBR texturing, universal auto-rig,
    part segmentation. Spawns the committed `.assetgen/tripo.py` (extended with
    `texture`/`rig`/`segment`/`prerig` subcommands).
  - `replicate-adapter.ts` — LIVE: Hunyuan 3D 3.1 (`tencent/hunyuan-3d-3.1`) + Rodin
    Gen-2 (`hyper3d/rodin`). Spawns the new committed-pattern `.assetgen/replicate-3d.py`.
  - `flux-material-adapter.ts` — LIVE: FLUX 2 Pro PBR material. Reuses (does NOT fork)
    `.assetgen/gen-material.sh` — same spawn pattern as `/api/material-gen`.
  - `stub-adapters.ts` — TYPED STUBS: Marble (World Labs World API), Meshy 5, Mesh-ops.
    Honest "connect to enable" (no faked success). Enabling one is a key + wired
    adapter — zero UI rework.
  - `registry.ts` — assembles adapters; stamps live flags; one swap seam.
  - `job-store.ts` (`.data/generative-jobs.json`) + `usage-ledger.ts`
    (`.data/capability-usage.json`) + `pipeline.ts` (shared spawn / progress-parse /
    GLB-optimize / public-asset placement).
- **Route** `src/app/api/prism/generative/route.ts` — single server entry
  (`listCapabilities` / `submit` / `poll` / `jobs` / `ledger`). Client never imports
  an adapter (INV-NEV2-4). Keys read only by spawned children (INV-19).
- **UI** `src/components/editor/functions/GeneratePanel.tsx` — additive "Generate · 3D"
  section inside `FunctionsTab` (founder law: tiles in the Functions tab). Tiles →
  invoke params → live job progress → attach-to-node / Use-as-mesh → dev-grade usage
  ledger. 7 new DL14 glyphs in `Icon.tsx` (`gen3d`/`genTexture`/`genRig`/`genSegment`/
  `genMaterial`/`genWorld`/`genMeshOps`).
- **Schema** `PrismNode.generativeAssets?: GenerativeAssetAttachment[]` — additive only.

## What shipped
- [x] `GenerativeCapabilityAdapter` interface (D1 sibling)
- [x] Live Tripo adapter (generate3D / textureMesh / rigMesh / segmentMesh)
- [x] Live Replicate adapter (Hunyuan 3D 3.1 + Rodin Gen-2 generate3D)
- [x] Live FLUX 2 Pro material adapter (reuses committed gen-material.sh)
- [x] Marble / Meshy / Mesh-ops typed stubs (documented live SDK)
- [x] `/api/prism/generative` dispatch route (server-only keys)
- [x] CapabilityUsage metering ledger (E20 pattern) + dev-grade ledger view
- [x] 11 Generate tiles (DL14 glyphs) + Inspector invoke flow + attach + Use-as-mesh
- [x] Real E2E demos per live capability (evidenced) + committed fixtures
- [x] `npm run verify` EXIT 0 (all suites, 35/35 tenancy) + tsc 0-new

## Real generations (evidence of live capability — credits/$ logged)
Tripo (balance 460 → 355 = **105 credits**, cap 120):
| Capability | Tripo task | Credits | raw→opt |
|---|---|---|---|
| Tripo 3.1 text→3D (robot mascot) | `bf932f9a` | 20 | 39.6 → 1.37 MB |
| Smart Mesh P1 8K PBR texturing | `69f9a747` | 20 | 52.3 → 1.82 MB |
| Tripo Rig universal auto-rig (riggable ✓) | `6d4c6e4e` | 25 | → 1.96 MB |
| Smart Mesh P1 part segmentation (**20 parts**) | `675c0901` | 40 | → 3.08 MB |

Replicate (est. ~**$1.05**, cap $3):
| Capability | Path | $ est |
|---|---|---|
| Hunyuan 3D 3.1 image/text→3D (teapot) | CLI | 0.30 |
| Hunyuan 3D 3.1 (stone owl) | **via /api/prism/generative route** (live E2E) | 0.30 |
| FLUX 2 Pro PBR material (brass / copper / verdigris) | CLI + route + browser | 3 × 0.05 |

**Live route chain proven end-to-end** (route → live adapter → spawned vendor client →
downloaded asset → finalized/optimized GLB → attached → metered) for FLUX material
(`polished-copper`, `weathered-verdigris` from the browser) AND object generation
(Hunyuan `rep-…/model.glb`, 3.14 MB finalized). Tripo's live path is the identical
machinery spawning the same `tripo.py` proven by the four real Tripo tasks above.

Committed demo fixtures (DL13, baked real output, served by the demo-safe offline path):
`public/prism-mock/editor/models/generated/demo-tripo-robot{,-textured,-rigged,-segments}`,
`demo-replicate-teapot`, `textures/generated/demo-flux-brass`.

## Editor E2E (evidence frames — `notes/verification/shell-w10/`)
1. `01-tiles-desktop` — Generate · 3D section: 11 tiles grouped by kind, DL14 glyphs,
   LIVE/CONNECT badges, per-tile cost.
2. `02-invoke-desktop` — invoke form (Tripo 3.1 text→3D, prompt + quality).
3. `03-result-desktop` — job SUCCEEDED, result asset + Attach.
4. `04-attached-desktop` — generated asset attached to the node.
5. `05-ledger-desktop` — usage ledger (demo + **live FLUX 2 Pro** events + totals).
6. `06-node-became-robot-mobile` — **the node now renders the generated Tripo robot
   GLB in the live WebGPU app** (Use-as-mesh).
7. `07-tiles-mobile` — full catalog on mobile bottom-sheet inspector.
8. `08-progress-mobile` — live FLUX success + Marble/Mesh-ops stub tiles + assets + ledger.
Plus `metrics.json`, `verify-output.txt` (EXIT 0, 35/35).

## Invariants
- **I-ADDITIVE** — no editor code path deleted/rewritten; the Generate section is an
  additive child of `FunctionsTab`; the only edits to existing files are 3 additive
  lines in `FunctionsTab.tsx`, 7 new glyph entries in `Icon.tsx`, and one optional
  field in `types.ts`. Diff-verified additive.
- **I-PROVIDER** — INV-NEV2-4 holds: the client only ever calls `/api/prism/generative`;
  every vendor REST call lives in a per-vendor `.assetgen` client behind one adapter.
- **I-SECRETS** — INV-19: keys read only by spawned children; never in graph, bundle,
  logs, responses, or this report. `.assetgen/` and `.data/` are gitignored.
- **I-SPEC** — no canonical spec edits; deviations recorded before code (D1–D8).
- **I-PROVENANCE** — commit messages describe only performed acts.

## Spend
- Tripo: **105 / ~120 credits** (balance 460 → 355).
- Replicate: **~$1.05 / $3** (2 Hunyuan runs + 3 FLUX material plates).

## Judge verdicts (fresh-context, 0 MUST-FIX gate — MET)
- **criteria-reviewer — PASS, no MUST-FIX.** All seven W10 requirements + the
  load-bearing invariants (INV-NEV2-4 / INV-19 / I-ADDITIVE) MEET; no forbidden-pattern
  drift. Verified additive edits (zero deleted lines in FunctionsTab/Icon/types), no
  vendor SDK import in client/lib, no secret reference in client/lib, all 8 server files
  `import 'server-only'`. Three non-blocking [NOTE]s (metering-on-failure, estimate-vs-
  reconciled-cost, stub-non-metering).
- **user-advocate — PLEASED / PASS, 0 MUST-FIX.** All five questions YES with cited
  frames: premium/legible tiles (01,07), distinctive on-brand DL14 glyphs (crops of
  01), clear MODEL+FUNCTION naming (01,07), complete pick→params→progress→result→attach→
  becomes-the-node's-mesh flow (02,03,04,06), fair/transparent dual-unit metering (05,08).
  Frame 06 ("node became the generated robot") judged a convincing real-3D payoff. Two
  non-blocking taste FLAGs (robot default scale; demo-mode default).

### Post-judge refinement (criteria [NOTE] #1 closed)
Metering now records a `CapabilityUsage` event on terminal FAILURE too (`ok:false`) so
the E20 ledger literally reflects "every invocation" (deviation W10-D5): post-submit
failures (vendor spend real) charge the estimate; pre/at-submit failures record amount 0;
the ledger view tags failed invocations. Verified live (a source-less texture job records
`ok:false, amount:0`). Re-ran `npm run verify` → EXIT 0 (35/35, tenant isolation GREEN);
tsc 0-new.

**GATE: MET. PRISM-SHELL-W10: RUN COMPLETE.**
