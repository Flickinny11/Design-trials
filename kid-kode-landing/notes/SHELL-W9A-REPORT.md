# SHELL W9A — MOCK WATCH APP SHOWPIECE ENHANCEMENT — RUN REPORT

**Branch:** `codex/prism-recovery-harness-20260630` · **Baseline HEAD:** `56c44516`
**Governing:** `docs/prism/ORRERY-NO7-VISION.md` (§2 Atelier, §7 asset pipeline) ·
founder prompt `SHELL-W9A-PROMPT.md` · provenance law (W9 addendum) · DL13/DL16.
**Status:** IN PROGRESS (skeleton written before code).

## Mission
Enhance the ORRERY No.7 mock watch-atelier app — the capability proof inside the
framed preview pane — into a stronger showpiece using the live generation pipelines:
Tripo (hero-grade watch geometry, Smart Mesh PBR) + Replicate FLUX (richer tileable
materials + dial art) + more cinematic staging — while every certified behavior stays
green.

## Architecture map (located before touching anything)
- **Hero watch** = graph node `orr-atelier-watch`, `codeRef: builtin:atelier-watch` →
  `src/lib/prism/atelier/watch-node-factory.ts` (HYBRID: GLB parts `case-gen.glb` /
  `bezel-gen.glb` / `crown-gen.glb` + `tourbillon.glb` movement, dressed with procedural
  dial/hands/indices/crystal/strap). Materials from `src/lib/prism/atelier/config.ts`.
- **Assets:** `public/prism-mock/orrery/meshes/atelier/` (part GLBs) + `.../textures/`
  (dial art + PBR maps).
- **Render path (context a):** `useGraphSourceStore` fetches
  `public/prism-mock/home/live-graph.json`; `/` mounts it; the W2 Task-0 engine-frame
  iframes `/`. Contexts (b) preview-runtime + (c) W5B ship-gate render different graphs
  (kept green, no visual change expected there).
- **Off-limits (I-ENGINE/I-CANVAS):** `src/lib/prism/runtime/**`, `prism-player/**`,
  `app/page.tsx`, editor graph/overlays, `default-factory.ts`, `coderef-*`.
- **Editable (mock-app content):** `atelier/watch-node-factory.ts`, `atelier/config.ts`,
  `celestia/orrery-node-factory.ts`, `live-graph.json`, `public/prism-mock/orrery/**`.

## Fresh-dated research (2026-07-05)
- **Tripo:** REST `api.tripo3d.ai/v2/openapi/task`; `image_to_model` model_version
  `P1-20260311` (Smart Mesh P1 — PBR + part segmentation); `texture:true pbr:true
  texture_quality:detailed`. Smart Mesh P1.0 is Studio-first with API access; the P1
  image model is the production path. **Balance at start: 640 credits.** Driver:
  `.assetgen/tripo.py`.
- **Replicate:** `black-forest-labs/flux-2-pro` for images/textures/dial art (2MP,
  `output_quality:95`). Material chain `gen-material.sh` → `derive-material-pbr.mjs`
  (matched-latent delit PBR: albedo/normal/rough/metal/ao from one plate). Drivers:
  `.assetgen/gen-flux.py`, `.assetgen/derive-material-pbr.mjs`.

## Deviations / method record
Recorded BEFORE code in `notes/spec-deviations-w9a.md` (W9A-D1..D4 + context note).

## Spend log
| Pipeline | Item | Cost | Balance after |
|---|---|---|---|
| Tripo | (start) | — | 640 credits |
| _pending_ | | | |

## What shipped
_pending_

## Hero geometry (Tripo) — per-part art-fidelity decisions
_pending_

## Materials (Replicate) — per-map upgrades
_pending_

## Staging enhancements
_pending_

## Integrity
- `npm run build:prism` (rebake mock-app.prism): _pending_
- `npm run verify`: _pending_
- W5B §14.1 headless ship gate: _pending_
- I-CANVAS / I-ENGINE diff-verify: _pending_

## Evidence
- Frames (desktop + mobile, real build): `notes/verification/shell-w9a/` — _pending_
- `metrics.json`: _pending_

## Judges
- prism-criteria-reviewer: _pending_
- user-advocate ("is this watch app a jaw-dropping showpiece?"): _pending_

## Marker
`PRISM-SHELL-W9A: RUN COMPLETE` (on completion) — else
`PRISM-SHELL-W9A: BLOCKED-NEEDS-FOUNDER`.
