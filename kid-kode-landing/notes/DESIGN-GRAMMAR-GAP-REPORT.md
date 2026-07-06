# DESIGN GRAMMAR — CAPABILITY GAP REPORT (W-DG1)

_Generated 2026-07-06 by the W-DG1 orchestrator from the `capabilities.readiness`
+ `capabilities.gapNotes` fields of the committed corpus
(`design-grammar/families/*.json`). This report is the honest ledger of which
premium technique families our stack can execute at parity **today** and what a
future wave must add for the rest._

## Honesty law (binding)

No family is claimed as shippable on the strength of a screenshot. The W-DG1
exemplars (`design-grammar/exemplars/`) are ORIGINAL FLUX renders that
demonstrate a family's **aesthetic target** — palette logic, composition, and
lighting — as a still. They do **not** demonstrate runtime motion, driver
behavior, or in-engine composition. A family's `readiness` therefore grades our
stack's ability to *execute the technique in the prism runtime*, which a still
exemplar never proves. `ready` here means "the mechanic has been demonstrated in
a prior shipped wave"; it does not mean "motion parity with the source is
proven." That proof is a per-family future-wave verification, not a W-DG1 claim.

## Readiness tally (14 families)

| readiness | count | families |
|---|---|---|
| `ready` | 2 | oversized-type-editorial, particle-field-hero |
| `partial` | 9 | bento-grid-slider, coverflow-3d-carousel, editorial-product-gallery, filmstrip-3d-carousel, gpu-fluid-overlay, hover-morph-distortion, infinite-filmstrip-gallery, layered-photo-parallax-hero, parallax-zoom-deep-dive |
| `gap` | 3 | cinematic-video-hero, glitch-cyber-fx, scroll-video-scrub |

`ready` families still have `whenNotToUse` limits and none has a **motion**
exemplar; they are the two whose core mechanic (extruded/MSDF type; GPU particle
field with cursor repulsion) already shipped (W8/W9). Everything else is blocked
on one of the five capability clusters below.

## The five blocking clusters (ranked by how many families each unblocks)

### 1. W-PHOTO — the R1 cinematic floor + R2 photographic composite pipeline
**Unblocks the most families of any single wave.** Two related pieces:

- **R1 cinematic floor (post stack in the prism runtime):** soft contact
  shadows, per-object motion blur, bloom, unified LUT/color-grade, vignette,
  legibility scrim over media. Today bloom exists only in the *marketing* stack
  (W9), not as a runtime floor. Blocks the "weight/craft" read for:
  coverflow-3d-carousel (contact shadows), filmstrip-3d-carousel (motion blur),
  gpu-fluid-overlay (bloom), parallax-zoom-deep-dive (center-bloom/edge-vignette),
  editorial-product-gallery + layered-photo-parallax-hero + cinematic-video-hero
  + scroll-video-scrub (LUT grade / scrim).
- **R2 composite pipeline:** automated **background removal / cutout**,
  depth-map extraction, per-plane relight, and a **unified grade across a
  generated set** (grade-as-curation). Blocks: layered-photo-parallax-hero
  (the industry's core photoreal method — the single most load-bearing family,
  5 of 17 deep sources build on it), hover-morph-distortion (stable-subject
  sandwich), editorial-product-gallery (set coherence), infinite-filmstrip
  (30+ cohesive single-hue images), parallax-zoom (depth-plane assembly).

> **Concrete verification W-PHOTO must discharge (from the layered-photo seed):**
> confirm that automated **background-removal** and **detached-shadow-plate
> synthesis** exist in the media-gen adapters. Today `PrismNode` carries
> `renderMode:'parallax-plane'` + `depthMapUrl` and FLUX produces source imagery,
> but the cutout/shadow/relight steps between them are hand-assembled.

### 2. Runtime driver primitives (candidate: a W-DRIVERS wave)
Not photographic — these are missing **state-machine primitives**. Each is
currently hand-choreographed per instance, which does not scale to Conductor
authoring:

- **carousel driver** — an N-cells-on-an-arc advance/retreat state machine.
  Needed by filmstrip-3d-carousel, coverflow-3d-carousel, bento-grid-slider.
- **seamless-loop column driver** — wrap-around repositioning with no visible
  seam. Needed by infinite-filmstrip-gallery.
- **multi-node "theme-token" swap driver** — one coordinated
  material/texture/palette switch across many nodes. Needed by
  infinite-filmstrip-gallery (whole-board theme swap) and bento-grid-slider
  (coordinated all-tile content swap).
- **pointer-velocity warp field** — continuous displacement whose intensity maps
  to cursor velocity with viscous lag + decay (vs. the one-shot
  `displacement-transition`). Needed by hover-morph-distortion.
- **cursor-force + dye-source fluid binding** — pointer force injecting dye into
  the fluid sim as a *hub background* layer. Needed by gpu-fluid-overlay.
- **bento grid layout solver** — mixed-span tiles + uniform gutters. Needed by
  bento-grid-slider (Conductor cannot hand-place every tile).

### 3. Transition presets (extend the shipped 5: curtain/veil/dissolve/wipe/glass-sweep)
- **glitch pass** — RGB channel split + scanline slice + quantized-jitter
  displacement as a TSL transition. Needed by glitch-cyber-fx. **Ships only with
  the safety rail in cluster 5.**
- **zoom-through preset** — holds two layered scenes simultaneously mid-flight
  (the `fly-through` primitive alone does not). Needed by parallax-zoom-deep-dive.

### 4. Video / new asset types (candidate: a gen-video adapter + W-PHOTO)
- **video-texture plane primitive** — muted, autoplaying, seamless-loop,
  reduced-motion-aware background layer. Hub backgrounds today are procedural/3D
  presets only. Needed by cinematic-video-hero.
- **frame-sequence / render-to-frames asset type** — a pre-rendered sequence the
  existing scroll-scrub driver (W8) can scrub. Needed by scroll-video-scrub.
- **generative video source** — the capability family is image + 3D only; there
  is no path to "footage without user upload." A future gen-video adapter or the
  render-our-own-3D-scenes-to-frames path (W-PHOTO) must decide the source.

### 5. Safety rails + verification gates (small but blocking)
- **photosensitivity safety** — flash-rate limits + a reduced-motion crossfade
  fallback. This is a **precondition** for offering glitch-cyber-fx at all, and
  does not exist yet.
- **cross-plane light-temperature gate** — no gate verifies that composited
  photographic planes share light direction/temperature; a mismatch silently
  breaks every layered-photo composite.
- **pinned-section scroll behavior** — section holds while scroll drives an
  internal timeline; unproven in the prism runtime's preview scroll model
  (blocks scroll-video-scrub choreography).
- **W-2D flat/orthographic hub mode** — true flat composition; in 3D perspective
  today, tile grids keystone at frame edges (bento-grid-slider,
  infinite-filmstrip-gallery).

## Per-family gap index

| family | readiness | primary blocker cluster |
|---|---|---|
| oversized-type-editorial | ready | — (shipped MSDF/extruded type) |
| particle-field-hero | ready | — (shipped W9 forge particle field) |
| layered-photo-parallax-hero | partial | 1 (R2 composite: cutout + shadow-plate + grade) |
| editorial-product-gallery | partial | 1 (unified set grade) |
| coverflow-3d-carousel | partial | 1 (contact shadows) + 2 (carousel driver) |
| filmstrip-3d-carousel | partial | 1 (motion blur) + 2 (carousel driver) |
| gpu-fluid-overlay | partial | 1 (bloom floor) + 2 (dye-source binding) |
| hover-morph-distortion | partial | 1 (cutout pipeline) + 2 (velocity warp field) |
| infinite-filmstrip-gallery | partial | 2 (loop-column + theme-token) + 5 (W-2D) |
| bento-grid-slider | partial | 2 (grid solver + theme-token) + 5 (W-2D) |
| parallax-zoom-deep-dive | partial | 1 (bloom/vignette floor) + 3 (zoom-through preset) |
| cinematic-video-hero | gap | 4 (video-texture + gen-video source) |
| scroll-video-scrub | gap | 4 (frame-sequence asset) + 5 (pinned-section) |
| glitch-cyber-fx | gap | 3 (glitch pass) + 5 (photosensitivity rail) |

## Recommended wave sequencing

1. **W-PHOTO** first — it unblocks the largest, most load-bearing set (all of
   cluster 1; feeds clusters 3–4). The layered-photo family alone justifies it.
2. **W-DRIVERS** (cluster 2) — pure runtime primitives, no gen dependency; makes
   the carousel/gallery/shader families Conductor-authorable instead of
   hand-built. Can run in parallel with W-PHOTO.
3. **Transition presets + safety rails** (clusters 3, 5) — small, and gate the
   `gap` families; glitch cannot ship without the photosensitivity rail.
4. **Video asset types + gen-video** (cluster 4) — the deepest net-new
   dependency; the two video families stay `gap` until it lands.

_When any of these ships, the corresponding family's `readiness` is upgraded
**only** after a runtime motion exemplar is captured — not on this report's
say-so._
