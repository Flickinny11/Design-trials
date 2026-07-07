# SHELL W-PHOTO — PHOTOREALISM PIPELINE (run report)

_Status: **RUN COMPLETE** — both judges PASS 0 MUST-FIX (criteria-reviewer PASS;
user-advocate PLEASED). D1–D6 + D8 shipped; D7 triaged/deferred (DEV-7)._
_Orchestrator: skeleton by claude-fable-5; build + verification resumed and
completed by claude-opus-4-8, 2026-07-06. Branch: `codex/prism-recovery-harness-20260630`._

## 0. Mission recap

Kill "looks digital" (PRISM-DESIGN-SUPREMACY-PLAN.md §1). Build the four-route
rendering system (R1 realtime PBR / R2 pre-rendered composite / R3 baked hybrid /
R4 gaussian splat) and remaster the mock watch app as the acceptance test.
Requirements ledger: `notes/DESIGN-GRAMMAR-GAP-REPORT.md` + `design-grammar/families/*.json`
(12 of 14 families route gaps here).

## 1. Deliverables checklist

| #   | Deliverable                                                                                                                                | Status                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| D1  | Route planner (`src/lib/render-routes/`) + decision-table doc                                                                              | **DONE** (`7e016c70`)                                                                |
| D2  | Composite pipeline (`src/lib/photo-pipeline/`): gen → cutout/layer → depth → shadow plate → harmonize → LUT grade → layered parallax scene | **DONE** (`7353e0dc`,`ea81210a`) — celestia-hero photoreal, verified on WebGPU       |
| D3  | Carousel driver + loop-column driver (motion exemplars = frame sequences)                                                                  | **DONE** (`c74e8495`) — 412 prims, 6 motion frames on WebGPU                         |
| D4  | R1 cinematic floor: IBL/HDRI, filmic tone mapping, imperfection maps, contact shadows, DOF/grain/bloom/LUT post chain                      | **DONE** (`2c17f158`)                                                                |
| D5  | R4 splat viewer: component + loader + asset slot                                                                                           | **DONE** (`d483e110`) — Spark viewer; procedural + 4000-splat .ply loaded            |
| D6  | Watch remaster (acceptance test): before/after frames per scene; W5B gate green                                                            | **DONE** (`1fb0514d`) — planner applied, floor node-local; W5B 11/11 + verify EXIT 0 |
| D7  | Stretch: scroll-video-scrub + cinematic-video-hero                                                                                         | **TRIAGED/DEFERRED** (`...`, DEV-7) — fal stub; blocker = gen-video source           |
| D8  | Flight-record all gen/build events                                                                                                         | **DONE** — composite events replayed, 13-record ledger                               |

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

**The four routes are a decision, not a renderer.** D1 (`src/lib/render-routes/`)
picks R1/R2/R3/R4 per element by explainable scoring + hard disqualifiers, with
`deriveInputsFromIntent` making it reachable from prompt language and
`routeToRealization` mapping a route to concrete Prism build hints.

**R2 is the photoreal workhorse (D2).** Realism lives in the SOURCE IMAGERY, not
geometry: FLUX generate → **bria/remove-background** cutout (256-level alpha =
clean edges) → **depth-anything-v2** depth → **local sharp** soft shadow plate →
**local filmic LUT** grade → a `layered-photo-scene` primitive that assembles the
plates with differentiated parallax + independent float loops. Hosted ops go
through the gitignored, key-holding `.assetgen/*.py` (INV-19); grade + shadow are
LOCAL deterministic passes (DEV-6). Grade is BAKED into the plates at pipeline
time, so the runtime needs no post chain — that is how a composite gets a photo
grade without touching the engine (DEV-2).

**The R1 floor is split (DEV-2).** Node-local pieces (imperfection roughness
breakup, contact shadow, PMREM studio IBL) run inside a node factory / owned
scene; the full-frame post chain (DOF·bloom·grade·vignette·grain, three r184 node
`PostProcessing`) runs ONLY on owned canvases (the `/photo-lab`, marketing) —
never the engine `SceneRoot`/`LightingRig`. So the watch at `/` gets realism from
node-local pieces + R2 baked plates; a runtime post chain at `/` stays deferred.

**One new dependency (DEV-3).** `@sparkjsdev/spark` (R4). Spark renders under
WebGL2, so the splat viewer is a SECOND owned canvas — never the single-WebGPU
editor scene (INV-1). Not a new `RenderMode`; the node carries an additive
`splatUrl` slot. Everything else (post chain, drivers, floor) is first-party.

**Engine untouched.** All product changes are content (atelier factory) +
primitives + libraries + owned lab routes. I-CANVAS `/` core, I-ENGINE runtime,
INV-19 secrets, and INV-18 additive-only schema all hold; `npm run verify`
EXIT 0, W5B 11/11, tsc 0-new throughout.

## 5. Evidence index

Evidence root: `notes/verification/shell-wphoto/`

- `composite-stages/` — the full R2 example: baked plates live under
  `public/prism-mock/photo/celestia-hero/` (`backdrop.png` + `.depth.png`,
  `product.png` cutout, `product.shadow.png`, 3 garnish cutouts, `composite.json`
  with per-stage provenance) → assembled scene `scene-floor-final.jpeg`
  (photoreal, R2 + R1 floor on real WebGPU) + `parallax-left/right.jpeg`
  (differentiated parallax) + `splat-procedural.jpeg` / `splat-loaded-ply.jpeg`
  (R4 viewer: procedural volume + a real 4000-gaussian `.ply` loaded by Spark).
- `drivers/` — motion frame-sequences: `carousel-{1,2,3}.jpeg` (coverflow
  advance), `loop-column-{1,2,3}.jpeg` (seamless crawl).
- `watch-before/` (6 scenes, prior session) + `watch-after/` (arrival, atelier)
  — the R1 remaster; floor is subtle at scene scale (DEV-2).
- `gates/` — `w5b-gate.txt` (11/11), `verify-chain.txt` (EXIT 0, schema 338/338,
  tenancy 10/10, parity 6/6), `composite-flightrec-ledger.ndjson` (D8, 13 records).

Reviewable routes (dev server): `/photo-lab` (R2 composite + R1 floor;
`?prim=carousel-3d|loop-column` for the drivers), `/splat-lab` (R4; `?url=` loads
a capture), `/` `#hub=s6-atelier` (the remastered watch).

## 6. Deviations

See `notes/spec-deviations-wphoto.md` — DEV-1..6 (written before the code) + DEV-7
(D7 triage). All discharged: DESIGN-REFERENCES §17 (DEV-1), owned-canvas post
(DEV-2), Spark dep + allowlist (DEV-3), barrel regen (DEV-4), fal stub (DEV-5),
Replicate-first + local grade/shadow (DEV-6), video families deferred (DEV-7).

## 7. Judge verdicts

Both fresh-context judges **PASS, 0 MUST-FIX**.

**criteria-reviewer (diff vs D1–D8 + invariants):** PASS. "MUST-FIX: NONE. Every
invariant holds" — I-CANVAS/I-ENGINE clean (no runtime/`page.tsx`/`GraphScene`
touched), INV-18 additive `splatUrl`, INV-19 secrets clean, I-PROVENANCE real
(prediction ids proven in git history), D2 gap-report cluster-1 discharge
SATISFIED (bria cutout + real shadow-plate synthesis exist in the adapters),
Spark owned-canvas WebGL2 (not a new RenderMode), no forbidden patterns, all 5
new primitives registered, gates green (tsc 9=baseline, verify EXIT 0, W5B 11/11,
34 new tests pass). One SHOULD-FIX (idempotent regenerate dropped the prediction
ids from the committed manifest) — **FIXED** (`...` this commit: orchestrator now
preserves prior ids on skip; the 5 real ids restored).

**user-advocate (art director with a loupe):** "(a) PASS · (b) PASS · net
PLEASED · 0 MUST-FIX." On (a) _would you believe the hero is a photograph_ — "The
flagship R2 composite holds together as one believable image… the armillary reads
as a real studio-shot object… the detached soft-shadow plate grounds the base…
the grade unifies the plates under a single amber key… No CGI tells." On (b)
_alive-not-busy_ — "Parallax = real differentiated depth (foreground gear travels
~255px, hero armillary only ~130px, backdrop barely drifts)… Carousel = real
coverflow… Loop-column = seamless crawl (no visible seam/jump)." Overall:
"**PREMIUM — this kills the 'looks-digital' read on the flagship.** A founder
could put `scene-floor-final.jpeg` on a landing page and a non-technical visitor
would read it as a photographed celestial atelier, not a render."

**Accepted FLAGS (advocate, non-blocking polish — not fixed this wave):**
(1) the crystal-globe garnish edge is a touch clean/product-shot; (2) the driver
plates are under-lit/small in a large void (mechanics correct, staging under-sells
them). Both are logged for a future polish pass; neither is a MUST-FIX.

## 8. Gap-report deltas

Per the gap report's honesty law, `readiness` grades **runtime execution**, and an
upgrade requires a captured **runtime motion exemplar** — not a still. This wave
ships the CAPABILITIES the gap report's cluster 1 + 2 + 4 named, and captures
motion exemplars for the drivers:

- **Cluster 1 (W-PHOTO) DISCHARGED:** the R2 composite pipeline (cutout +
  detached shadow-plate synthesis + unified grade) and the R1 floor (contact
  shadows, bloom, grade, vignette, grain, imperfection, IBL) now exist. The gap
  report's explicit verification — "confirm automated background-removal +
  detached-shadow-plate synthesis exist in the media-gen adapters" — is
  **satisfied** (bria cutout + local shadow-plate, both proven with committed
  output + provenance).
- **layered-photo-parallax-hero → upgradeable to `ready`:** a runtime motion
  exemplar was captured (`scene-floor-final` + `parallax-left/right` on real
  WebGPU — differentiated parallax + independent float loops). This is the first
  `partial` family with a real in-engine motion exemplar this wave.
- **coverflow-3d-carousel / filmstrip-3d-carousel / infinite-filmstrip-gallery:**
  their missing DRIVERS now exist (`carousel-3d`, `loop-column`) with motion
  frame-sequences captured; contact-shadow (carousel) + the R1 floor are present.
  Remaining per-family motion-parity proof is a future verification, not claimed
  here.
- **Cluster 4 (video) NOT discharged:** cinematic-video-hero + scroll-video-scrub
  stay `gap`. Delta: the blocking cluster narrows — the runtime video-texture lane
  (`ctx.videoLoader`) + W8 scroll-scrub driver already exist, so only the
  gen-video/frame-sequence SOURCE remains (fal absent; a W-VIDEO wave). Recorded
  in DEV-7.

No readiness field in the committed corpus is edited by this report; upgrades are
a per-family future-wave verification (the corpus honesty law).


PRISM-WPHOTO: RUN COMPLETE
_(Marker line appended 2026-07-07 01:27 by founder-monitor after independent verification — judges PASS verdicts in §7, watch-after/composite/driver/gate evidence confirmed on disk. The 14:42 report declared RUN COMPLETE but omitted this exact machine-readable line, stalling the chain watcher ~10.5h. No content above this line was changed.)_
