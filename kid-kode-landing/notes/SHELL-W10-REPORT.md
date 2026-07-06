# SHELL W10 — GENERATIVE 3D CAPABILITY FAMILY IN THE EDITOR — RUN REPORT

**Branch:** `codex/prism-recovery-harness-20260630` · **Baseline HEAD:** `26494682`
**Governing:** `SHELL-W10-PROMPT.md` (founder-directed 2026-07-05) ·
`docs/prism/PRISM-NODE-EDITOR-SPEC-V2.md` (criteria B/C) · INV-NEV2-4 (D1) · INV-19 ·
`notes/spec-deviations-w10.md` (method records, written first).
**Status:** IN PROGRESS.

## Mission
Expose generative-3D powers (object generation, PBR texturing, auto-rig, part
segmentation, world generation, mesh ops) as NATIVE, user-facing capabilities inside
the node editor + builder — metered against user credits — through the existing
provider-agnostic capability architecture. Tiles named MODEL + FUNCTION, never vendor
platform tiles; adapters do the vendor work behind the interface.

## Architecture map (located before touching anything)
- `src/lib/capabilities/provider.ts` — CapabilityProvider (D1); live-vs-stub precedent
  (McpReferenceAdapter live; Pipedream/Composio typed stubs; Nango gated-real).
- `src/server/capabilities/capability-provider.ts` — factory seam; server-only.
- `/api/prism/capabilities` — single dispatch route; client never imports adapters.
- `FunctionsTab.tsx` (outside panels/, FP-15-exempt updateNode precedent) +
  `IntegrationsTab.tsx` — where tiles surface; mounted by `panels/Inspector.tsx`.
- `/api/material-gen` — server-only key discipline precedent (spawns the committed
  `.assetgen` pipeline; key read only by the child).
- `.data/*.json` — LocalStore persistence precedent (snippets).
- Asset store paths: `public/prism-mock/editor/textures/generated/<id>/`,
  meshes under `public/prism-mock/editor/meshes/`.

## Fresh-dated research (2026-07-05)
See `notes/spec-deviations-w10.md` §W10-D6 — Tripo task types/costs, Replicate model
probes (`tencent/hunyuan-3d-3.1`, `hyper3d/rodin`), Marble World API status. Tripo
balance at start: 460 credits.

## What shipped
_(to be filled as work lands)_

- [ ] `GenerativeCapabilityAdapter` interface (`src/lib/capabilities/generative.ts`)
- [ ] Tripo live adapter (generate3D / textureMesh / rigMesh / segmentMesh)
- [ ] Replicate live adapter (Hunyuan 3D 3.1 + Rodin Gen-2 generate3D)
- [ ] FLUX 2 Pro material adapter (reuses committed gen-material.sh pipeline)
- [ ] Marble / Meshy / Mesh-ops typed stubs
- [ ] `/api/prism/generative` dispatch route (server-only keys)
- [ ] CapabilityUsage metering ledger (`.data/capability-usage.json`)
- [ ] Generate category tiles (DL14 glyphs) + Inspector invoke flow + attach
- [ ] Usage ledger view (dev-grade)
- [ ] Real E2E demos per live capability + evidence
- [ ] verify EXIT 0 + tsc 0-new + dual judges 0 MUST-FIX

## Evidence
`notes/verification/shell-w10/` — frames (tiles, invoke flow, job progress, attached
result; desktop+mobile), metrics.json, usage-ledger screenshot, verify output.

## Spend
_(recorded at close; caps: Tripo ~120cr, Replicate ~$3)_

## Judge verdicts
_(criteria-reviewer + user-advocate, fresh-context, 0 MUST-FIX gate)_
