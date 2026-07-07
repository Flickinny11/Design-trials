# W-TPL — spec deviations of record

Deviations are recorded BEFORE the deviating code lands (prompt law).

## DEV-1 — W8 templates folded into the catalog with retro metadata

The prompt asks for 12–16 complete hub templates. The W8 wave already shipped
three real, judged hub templates (Aperture/Atlas/Nova, `src/lib/templates/
registry.ts`). Rather than orphan them from the picker (two disconnected
catalogs = the exact disease W8's registry cured), the new catalog registry
FOLDS THEM IN as entries with archetype/family metadata, and 13 new templates
are authored. Total = 16. The anti-repetition matrix in the report §3 covers
all 16. W8's `registry.ts` is untouched (I-ADDITIVE); the catalog wraps it.

## DEV-2 — hover-morph-distortion primary uses one-shot displacement, not a velocity warp field

The gap report (cluster 2) notes the family's full mechanic needs a
pointer-velocity warp field with viscous lag, which is W-DRIVERS scope. The
Beacon template executes the family's stable-subject sandwich composition with
the SHIPPED `displacement-transition` primitive driven per hover — an honest
adaptation within current runtime capability, recorded here so the family's
readiness is not overclaimed. The catalog entry's blurb does not promise
velocity-warp behavior.

## DEV-3 — parallax-zoom-deep-dive without the zoom-through preset

The zoom-through transition preset (holding two scenes mid-flight) is cluster-3
future scope. Cascade composes the family's depth-plane fly-through INSIDE one
hub via layered planes + scroll-driven camera-space motion + the shipped
vignette/bloom floor — the single-scene form of the family. Hub-to-hub
zoom-through remains future scope.

## DEV-4 — bento keystone (W-2D) accepted as 3D perspective

bento-grid-slider's gap notes call out tile-grid keystoning at frame edges in
3D perspective (W-2D flat mode is a future wave). Tessella/Abacus place their
grids at shallow depth and modest FOV impact, accepting the slight perspective
as part of the premium 3D read rather than simulating a flat mode that does
not exist yet.

## DEV-5 — distinct-image galleries are COMPOSED, not single-subject echoes

The `carousel-3d` and `loop-column` primitives (W-PHOTO D3) are echo-based:
they clone the mounted subject into N cells with `makeEcho` (shared geometry,
cloned materials), so every cell is the SAME image. That is correct for an
ambient repeat but wrong for a gallery whose whole point is showing DISTINCT
work (Lumen's six vessels, Vitrine's four frames, Waypoint's contact cards).

So the carousel/filmstrip/coverflow templates express their family's grammar
COMPOSITIONALLY — distinct image nodes arranged on the grammar's signature
layout (a perspective Z-arc for coverflow/filmstrip; opposing vertical columns
for the infinite filmstrip) with per-node continuous motion (float phase-
desynced, pointer parallax, scroll-driven drift/tilt) for the "alive at rest"
read. This is both the honest choice (real distinct generated imagery, not one
picture repeated) and the better-looking one. The echo primitives remain in the
catalog and are exercised by /photo-lab; a future wave can add a
multi-source carousel primitive that accepts a list of textures.

## DEV-2 addendum — beacon uses hover-liquid-distort (the mountable primitive)

Audit of the binding player (src/lib/prism/animatable/bindings.ts): the
`displacement` category is in UNMOUNTABLE_CATEGORIES and is skipped on a mounted
artifact UNLESS the primitive declares `mountable:true`. `displacement-transition`
does NOT; `hover-liquid-distort` and `hover-displacement-map` DO. Beacon
therefore binds `hover-liquid-distort` (pointer driver) so the sky plate
actually liquefies on hover in the shipped preview — honoring DEV-2's intent
(one-shot pointer-driven displacement, not a velocity warp field) with the
primitive that genuinely runs.
