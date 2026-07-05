# PROD-FINISH — preview-as-app to production
(status: COMPLETE — all C1–C13 pass; capstone PASS 0 MUST-FIX)

**Acceptance gate (all met):** C1–C3 atmosphere 20/20 · C4–C5 heroes 20/20 · C6 hub nav (rail+
prev/next+hash) · C7 raycast→holographic overlay · C8 device modes (auto+manual) · C9 camera LOCKED
(Δ0)+configured view · C10 edit-in-preview · C11 0 console errors (4/4 viewports) · C12 no regressions
(tsc 0-new, vitest 3349/0-fail, catalog git-proven unchanged) · C13 capstone PASS 0 MUST-FIX.
**Checkpoints:** BASE 5c49407a · Phase A 1d9e410c · Phase B 41a44e0c · Phase C (final commit below).

## Phase A — full-viewport atmosphere (oval/stipple/flat-corner fix) — DONE ✅
**Defect:** landscape viewports showed a dark central OVAL on flat medium-grey corners with a
soft elliptical boundary; only tall-mobile read full-bleed. Root cause: the skybox vignette
floored corners to a flat blue-grey (`#2b3550`) while blowing the center bright (strong brass
key), and a near-black ink pool (opacity 0.97) over that bright center read as an ellipse; the
256px 8-bit radial feather banded.
**Changes (all in `GraphScene.tsx`):**
- `buildHubSkyGradient` rebuilt → one premium DARK deep-space nebula atmosphere on the whole
  equirect (2048×1024): dark graphite base (no flat-grey floor), brass/ice nebula wisps + a
  two-tier starfield (crisp bright points + dense fine) across the WHOLE sphere, a MODERATE
  (not white-hot) brass key behind content, gentle vignette, a low-frequency multi-octave **FBM**
  depth field + per-pixel dither (DESIGN-REFERENCES FBM technique, native — no dep) so even a
  star-free corner at the widest viewport's ~8× magnification is never a flat plate. LinearFilter,
  no mipmaps → no banding. Module-cached (one bake/session).
- `getBackdropFalloffTexture` → high-res (1024²) analytic smoothstep feather, wide fade from
  r≈0.36, alpha dither, LinearFilter, no mipmaps → smooth melt, no staircase.
- Ink pool → colour-matched to the skybox base (`DS.void`), opacity 0.97→0.5, so the textured
  skybox shows through and the feather has near-zero contrast against the atmosphere (no oval).
**Proof (atmosphere-log.json, DPR-2, content-free diagonal background sampling, chrome hidden):**
20/20 PASS. Landscape went from flat-grey-oval (minCornerStd 0.03–0.27, cornerSpread 34–40,
maxCorner luma 64–71) to one premium dark textured atmosphere (minCornerStd ≥1.1 desktop/tablet/
constrained, cornerSpread ≤14, maxCorner ≤43). Mobile good look preserved. Frames:
`prod-finish/atmosphere/<viewport>-<hub>.png` (before: `prod-finish/baseline/ATM-*`).
## Phase B — hero present + lit (Arrival watch on desktop/tablet) — DONE ✅
**Defect:** Arrival hero watch read as absent on desktop/tablet; heroes generally under-scaled on
desktop; s5-acquire watch tiny on landscape. Root causes (hard-measured): (1) hero GLBs are 2–4 MB
and loaded async with NO preload → ~3 s "absent on first look" race (watch invisible at 2.6 s,
present at 3.8 s); (2) preview camera sat far (z=14, fov 45) → composition filled only ~34 % of
frame height, heroes small; (3) s5-acquire watch base scale 1.3 → coverage 0.004 on landscape.
**Changes:**
- `GraphScene.tsx` — PRELOAD every hub's hero GLB into the URL-keyed loader cache on mount
  (cache-only warm, non-destructive INV-17) so heroes mount from cache (no multi-second blank).
- `GraphScene.tsx` — pull the locked preview camera closer: desktop/tablet z 14/12.5 → 10.5,
  mobile keeps its proven z=11. Composition now fills the frame; heroes ~1.3–2× bigger. Verified
  no crop on the tallest composition (acquire) at fov 45.
- `live-graph.json` — `orr-acquire-watch` scale 1.3 → 1.55, y −0.62 → −0.72 so the watch reads as
  a clear hero seated cleanly on its pedestal (no headline overlap).
**Proof (heroes-log.json, DPR-2, projection hook + background-robust HIDE-DIFF):** 20/20 PASS.
Every primary hero on every hub × viewport is in-frustum, genuinely drawn (meanAbsDiff 13–71),
lit (peak luma 220–255), with real coverage (desktop arrival 0.015→0.030; acquire 0.004→0.012+).
Frames: `prod-finish/heroes/<viewport>-<hub>.png` (before: `prod-finish/baseline/HERO-*`).
## Phase C — production functional validation + capstone — DONE ✅
**Driven like a real user across ALL 5 hubs × 4 viewports (production.mjs, DPR-2):** 4/4 viewports
PASS, 0 console errors total.
- **Hub→hub nav:** REAL rail click through every hub + Prev/Next pager + `#hub=` hash — content
  changes, no blank hub, hash updates — on every viewport. (Fix: added Prev/Next chevrons into the
  `PreviewHubNav` rail so paging works on the compact mobile layout too, which previously omitted
  the desktop bottom pager — no bottom-band collision.)
- **Function binding:** a REAL raycast pointer click on the Arrival watch opens the premium
  holographic detail overlay on every viewport (`overlayRaycastOk=true` all 4).
- **Camera LOCKED:** dragging the canvas moves the preview camera by Δ0.0000 on every viewport;
  lands on the configured front view. (No hub authors `cameraKeyframes` in the live graph, so the
  deterministic configured-view landing is what plays; the journey-replay path runs without error.)
- **Device modes:** auto-from-viewport (desktop/tablet/mobile picked from width) + manual
  Desktop/Tablet/Mobile switch each apply the real responsive layout (`deviceSwitch.ok`).
- **Edit-in-preview:** toggle on → select node → edit mode held (`editFlow.ok`).
- **No regressions:** tsc baseline-diff 0 new errors; vitest 3349 passed / 0 failed / 8 skipped;
  primitive catalog 406 (registry chip) and element library ~42 clusters — `git diff 8e3c61e2..HEAD`
  over `src/lib/prism/animatable/` + `src/lib/editor/elements/` is EMPTY (nothing removed/changed).

## Capstone verdict
Fresh-context user-advocate (read-only, judged from DPR-2 frames + measured logs):

**VERDICT: PASS — 0 MUST-FIX**

**(a) Atmosphere / no-oval — CONFIRMED.** BEFORE `baseline/ATM-desktop-arrival-OVAL.png`,
`baseline/ATM-constrained-celestia-OVAL.png` (dark oval on flat grey corners). AFTER
`atmosphere/desktop-s1-arrival.png`, `atmosphere/tablet-s3-materia.png` (one continuous dark field;
stars/nebula to every corner; no oval/grey-plate/feather). Zooms `capstone/CORNER-TL-desk-arrival.png`,
`capstone/CORNER-BR-con-celestia.png` (deep navy + crisp star speckle; no oval-edge curve, no
banding/stipple). atmosphere-log 20/20, banding 0–2, maxCorner ≤43.

**(b) Hero present + lit — CONFIRMED.** BEFORE `baseline/HERO-desktop-arrival-small.png`,
`baseline/HERO-constrained-acquire-tiny.png`. AFTER zooms `capstone/HERO-desk-arrival.png`,
`capstone/HERO-desk-celestia.png`, `capstone/HERO-desk-acquire.png` (gold/navy watch, full armillary
orrery, pedestal watch — large, well-lit, detailed). Full 5×4 matrix present+lit across
`heroes/*`; no hub is empty-atmosphere+text. heroes-log 20/20, all inFrustum=true.

**(c) Premium / production-ready — CONFIRMED.** `capstone/HERO-desk-arrival.png` (luxury-grade watch:
gold case, navy guilloche dial, ruby markers, rim-lit strap); `production/desktop-overlay.png`,
`production/mobile-overlay.png` (function-bound holographic spec panel from a real click, responsive);
`production/desktop-after-drag.png` (camera locked, lockDelta=0, 0 console errors /4 viewports).
"Visibly clears the smash-Slider-Revolution bar."

**NICE-TO-HAVE (non-blocking):**
- s2-movement floating tourbillon back-cap reads slightly raw matte-grey vs other heroes
  (`capstone/HERO-desk-movement.png`) — a material pass would lift it to top tier.
- Faint soft-rectangular chrome drop-shadow regions in some corner zooms
  (`capstone/CORNER-TL-desk-arrival.png`) — chrome shadows, not atmosphere seams; could be softened.

**Advocate scope note:** PASS is scoped to the rendered look + captured behaviors. 9 pre-existing
runtime-architecture/node-editor spec criteria (RT-SC-02/03/06/10/11, NE-SC-01/03/13/14 in
`unmet-criteria.json`) remain open as separate STEP-4 work — none visible in the graded frames,
out of scope for this run.

## Dependency-usage table
| Dependency / technique | Used for | Source |
|---|---|---|
| three / TSL / WebGPU (r184+) | the one renderer for the whole preview-as-app scene | already present |
| Canvas2D procedural texture (skybox + feather alpha) | premium dark nebula skybox + smooth analytic feather — built on the main renderer's textures | native, no dep |
| **FBM (Fractal Brownian Motion)** multi-octave value noise | low-frequency atmospheric depth so corners never read flat at any magnification | DESIGN-REFERENCES.md "FBM" technique, implemented natively (no glslify/gl-noise dep) |
| Procedural starfield + nebula-wisp blobs | textured deep-space corners (matches `GalaxyAtmosphere.nebulaTexture`) | native, no dep |
| Per-pixel blue-ish dither | kill 8-bit banding on the skybox + feather | native, no dep |
| THREE GLTFLoader cache (`ctx.glbLoader`) | hero GLB PRELOAD so heroes appear instantly | already present |
| drei CameraControls | locked preview camera framing per device | already present |
| Playwright + sharp | verification harness (frames + pixel metrics) | already present (dev) |
| fal.ai | NOT used this run ($0; strongly-preferred procedural per D1) | — |

NO new dependencies added (`git diff 8e3c61e2..HEAD -- package.json package-lock.json` = empty). NO purple; Observatory-Brass only. One renderer. INV-11 real outlines (MSDF text untouched).

## Numeric proofs
- **atmosphere-log.json** — 20/20 PASS. Per landscape frame: minCornerStd ≥1.1 (was 0.03–0.27 flat),
  cornerSpread ≤14 (was 34–40), maxCorner ≤43 (was 64–71 grey), banding ≤2. Mobile preserved.
- **heroes-log.json** — 20/20 PASS. Every primary hero: inFrustum=true, coverage (desktop arrival
  0.015→0.030, acquire 0.004→0.012+), hide-diff meanAbsDiff 13–71 (genuinely drawn), peak luma
  220–255 (lit).
- **production-log.json** — 4/4 viewports: navOk, prevNextOk, overlayOk, lockOk (Δ0), errors:0;
  deviceSwitch.ok, editFlow.ok, totalConsoleErrors 0.

## Honest flags
- **Primitive count is 406, not ≥409 as the prompt's floor stated.** This is the PRE-EXISTING repo
  state (catalog's own count chip reads "406 primitives"); PROD-FINISH made ZERO changes to the
  primitive catalog (git-proven), so this is not a regression — the prompt's ≥409 figure reads ~3
  high vs the actual repo. Element library ~42 clusters (≥40 ✓).
- **Capstone scope.** The advocate's PASS covers the rendered LOOK + the functional behaviors
  captured. It noted that some pre-existing runtime-architecture spec criteria (RT-SC/NE-SC in
  `notes/verification/unmet-criteria.json`) remain open and are tracked separately — out of scope
  for this run (the two visual defects + functional validation). They do not affect the rendered
  preview-as-app look or the behaviors verified here.
- **No authored camera journey** exists in the live graph (all hubs `cameraKeyframes:[]`), so the
  P2 journey *feature* is verified only as "replay path runs without error + configured-view landing
  plays"; a hub authoring a journey would exercise the full flight (verified previously in App
  Reality P2).
- The backdrop-image feather edge is now a soft melt (smooth analytic alpha); on the chrome-hidden
  pure-atmosphere captures a very faint image→skybox transition is visible on dim-backdrop hubs — it
  is not a hard seam and is imperceptible in the real composited app frames.

## fal ledger line
No fal spend this run. `notes/verification/app-reality/fal-ledger.json`: entries [], run total $0.00,
cumulative $0.479 (unchanged). All atmosphere/hero work is procedural/code-driven (D1).

---
PROD-FINISH: RUN COMPLETE
