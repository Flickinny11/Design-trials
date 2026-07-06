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

| #   | Deliverable                                                                                                                                | Status                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| D1  | Route planner (`src/lib/render-routes/`) + decision-table doc                                                                              | **DONE** (`7e016c70`)                                                          |
| D2  | Composite pipeline (`src/lib/photo-pipeline/`): gen → cutout/layer → depth → shadow plate → harmonize → LUT grade → layered parallax scene | **DONE** (`7353e0dc`,`ea81210a`) — celestia-hero photoreal, verified on WebGPU |
| D3  | Carousel driver + loop-column driver (motion exemplars = frame sequences)                                                                  | in progress                                                                    |
| D4  | R1 cinematic floor: IBL/HDRI, filmic tone mapping, imperfection maps, contact shadows, DOF/grain/bloom/LUT post chain                      | **DONE** (`2c17f158`)                                                          |
| D5  | R4 splat viewer: component + loader + asset slot                                                                                           | pending                                                                        |
| D6  | Watch remaster (acceptance test): before/after frames per scene; W5B gate green                                                            | pending                                                                        |
| D7  | Stretch: scroll-video-scrub + cinematic-video-hero                                                                                         | triage pending                                                                 |
| D8  | Flight-record all gen/build events                                                                                                         | **DONE** (`c...`, composite events)                                            |

## 2. Fresh-dated research findings (2026-07-06)

Verified against live sources on 2026-07-06 (WebSearch). We hold a **Replicate**
key + **Tripo** key; **fal is absent** (DEV-5). Replicate-hosted models are
preferred (DEV-6).

**Composite-pipeline models (Replicate):**

| stage                       | model slug                                                        | notes / cost                                                                                                     |
| --------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| background removal / cutout | `bria/remove-background` (RMBG-2.0, BiRefNet arch)                | **non-binary 256-level alpha** → clean anti-aliased edges (vs harsh binary masks); the load-bearing cutout step. |
| depth map                   | `chenxwh/depth-anything-v2`                                       | Depth-Anything-V2; ~$0.0026/run, ~3 s on A100. Feeds `depthMapUrl` parallax + shadow-plate projection.           |
| relight / harmonize         | `zsxkib/ic-light` (IC-Light, lllyasviel)                          | text- or bg-conditioned relight, 5 light directions; harmonizes a cutout to a target key/temperature.            |
| generation (base plate)     | `black-forest-labs/flux-2-pro` (existing `.assetgen/gen-flux.py`) | already funded/proven (W-DG1 exemplars).                                                                         |

- **Layer separation (Qwen-Image-Layered):** a documented research lead for
  prompt-driven subject/layer split with multi-image output. NOT confirmed
  first-party on Replicate as of 2026-07-06; the `bria/remove-background` +
  `depth-anything-v2` pair covers the load-bearing cutout+plate need, so
  Qwen-Image-Layered is recorded as a **future upgrade path** in the pipeline
  doc rather than wired this wave (honest triage).
- **FLUX.2 edit / Nano Banana 2 Edit:** instruction-based edit models; not
  needed for the composite path (generation + cutout + relight covers it).
  Recorded as the edit-op lead for a later "remix an existing plate" feature.

**Splat viewer (D5):** `@sparkjsdev/spark` **v2.1.0** (latest, ~22 days old) —
"advanced 3DGS renderer built for THREE.js + WebGL2, 98%+ support", loads
`.PLY`/`.SPZ`/`.SPLAT`/`.KSPLAT`/`.SOG` via `SplatMesh` (URL or raw bytes).
Spark renders under **WebGL2** by design, which is why it is used on an
**owned second canvas** (DEV-3) — NOT injected into the single-WebGPU editor
scene (INV-1). The existing `SplatLayer.tsx` (THREE-D-BACKGROUNDS wave,
`040c5b05`) already renders RGBD pseudo-gaussians natively under WebGPU and
documents Spark's decoded-array shape as its swap-in; D5 adds the real
file **loader** + owned-canvas true-gaussian **viewer** + **asset slot**.
`@sparkjsdev` was an empty leftover dir at run start (not actually installed);
D5 does a real `npm install` + allowlist add.

**Tone mapping (R1 floor, three r184):** AgX (Blender-4 default, better than
ACES/Filmic for HDR/artistic) and **Khronos PBR Neutral** (photoreal PBR,
accurate sRGB base color) are both first-class constants in r184
(`AgXToneMapping`, `NeutralToneMapping`). WebGPU post is the node-based
`PostProcessing`/RenderPipeline path (EffectComposer is legacy WebGL-only, no
forward path). r184 ships every TSL display node the floor needs natively —
`BloomNode`, `DepthOfFieldNode` (`dof`), `FilmNode` (`film`, grain),
`Lut3DNode` (`lut3D`, 3D LUT grade), `MotionBlur`, `GTAONode` — so the post
chain needs **no new dependency** (Spark is the only new dep this wave).

## 3. Spend ledger

| ts    | provider  | model                     | purpose                                           | est. cost | running total |
| ----- | --------- | ------------------------- | ------------------------------------------------- | --------- | ------------- |
| 07-06 | replicate | depth-anything-v2         | endpoint probe ×2                                 | ~$0.006   | ~$0.006       |
| 07-06 | replicate | flux-2-pro ×4             | celestia-hero plates (backdrop+product+3 garnish) | ~$0.32    | ~$0.33        |
| 07-06 | replicate | bria/remove-background ×3 | product + garnish cutouts                         | ~$0.06    | ~$0.39        |
| 07-06 | replicate | depth-anything-v2         | backdrop depth map                                | ~$0.003   | **~$0.39**    |

Replicate spent ~**$0.39** of $10 (>$9.6 remaining — no founder alert). Tripo 0/100cr.
Every hosted call carries a prediction id in `composite.json` provenance (I-PROVENANCE).

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
