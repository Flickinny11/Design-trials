# PROD-FINISH — preview-as-app to production
(status: in progress)

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
## Phase B — hero present + lit (Arrival watch on desktop/tablet) — TODO
## Phase C — production functional validation + capstone — TODO

---
## Dependency-usage table
(filled at completion)

## Numeric proofs
(filled at completion — atmosphere/heroes/production logs)

## Capstone verdict
(filled at completion — frame-cited)

## Honest flags
(filled as discovered)

## fal ledger line
(filled at completion)
