# SHELL W-PHOTO — PHOTOREALISM PIPELINE (run report)

_Status: IN PROGRESS — skeleton committed first per run protocol._
_Orchestrator: claude-fable-5, started 2026-07-06. Branch: `codex/prism-recovery-harness-20260630`._

## 0. Mission recap

Kill "looks digital" (PRISM-DESIGN-SUPREMACY-PLAN.md §1). Build the four-route
rendering system (R1 realtime PBR / R2 pre-rendered composite / R3 baked hybrid /
R4 gaussian splat) and remaster the mock watch app as the acceptance test.
Requirements ledger: `notes/DESIGN-GRAMMAR-GAP-REPORT.md` + `design-grammar/families/*.json`
(12 of 14 families route gaps here).

## 1. Deliverables checklist

| # | Deliverable | Status |
|---|---|---|
| D1 | Route planner (`src/lib/render-routes/`) + decision-table doc | pending |
| D2 | Composite pipeline (`src/lib/photo-pipeline/`): gen → cutout/layer → depth → shadow plate → harmonize → LUT grade → layered parallax scene | pending |
| D3 | Carousel driver + loop-column driver (motion exemplars = frame sequences) | pending |
| D4 | R1 cinematic floor: IBL/HDRI, filmic tone mapping, imperfection maps, contact shadows, DOF/grain/bloom/LUT post chain | pending |
| D5 | R4 splat viewer: component + loader + asset slot | pending |
| D6 | Watch remaster (acceptance test): before/after frames per scene; W5B gate green | pending |
| D7 | Stretch: scroll-video-scrub + cinematic-video-hero | triage pending |
| D8 | Flight-record all gen/build events | pending |

## 2. Fresh-dated research findings (2026-07-06)

_(to fill: verified model slugs/endpoints for bg-removal, depth, relight, layer
separation (Qwen-Image-Layered), FLUX.2 edit / Nano Banana 2, splat viewer lib
choice for three r184, tone-mapping best practice)_

## 3. Spend ledger

| ts | provider | model | purpose | est. cost | running total |
|---|---|---|---|---|---|
| — | — | — | — | — | Replicate $0.00 / Tripo 0cr |

Budget: Replicate ≤ $10, Tripo ≤ 100 credits. Founder alert thresholds: <$5 Replicate remaining / <100 Tripo remaining.

**fal.ai key status:** `.assetgen/fal.key` ABSENT at run start (checked 2026-07-06). Per prompt: fal adapter is TYPED but STUBBED. Will re-check before watch remaster (founder may drop mid-run).

## 4. Architecture decisions

_(to fill)_

## 5. Evidence index

Evidence root: `notes/verification/shell-wphoto/`
- `watch-before/` — pre-remaster frames per scene (captured BEFORE any change)
- `watch-after/` — post-remaster frames per scene
- `composite-stages/` — one full pipeline example: gen → layers → depth → shadow → grade → scene
- `drivers/` — motion frame sequences (carousel, loop-column)
- `gates/` — verify + W5B output

## 6. Deviations

See `notes/spec-deviations-wphoto.md` (written BEFORE deviating code).

## 7. Judge verdicts

_(to fill: criteria-reviewer + user-advocate "art director with a loupe")_

## 8. Gap-report deltas

_(to fill: which family readiness upgrades are earned by runtime motion exemplars, per the gap report's honesty law)_
