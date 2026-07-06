# W-PHOTO spec deviations + binding interpretations

_Written BEFORE the deviating/interpreting code, per run protocol. Each entry
names the prompt clause, the interpretation or deviation, and why._

## DEV-1 — "registered in DESIGN-REFERENCES conventions" (interpretation)

`docs/prism/DESIGN-REFERENCES.md` is a technique/vocabulary reference catalog,
not a registration manifest — there is no registration procedure defined in it.
Interpretation: the R1 cinematic-floor primitives are (a) registered in the
repo's REAL registries — the open Animatable catalog
(`src/lib/prism/animatable/registry.ts`) for node-attachable pieces — and
(b) documented in a new "Prism cinematic floor" section appended to
`DESIGN-REFERENCES.md` following that file's existing entry format, so AI
authoring surfaces that consume the reference see them.

## DEV-2 — I-ENGINE boundary for the R1 post chain (interpretation)

The runtime's renderer/tone-mapping is owned by `SceneRoot` +
`LightingRig` (engine files — untouchable this wave). The R1 cinematic floor is
therefore built as a **reusable library** (`src/lib/prism/cinematic-floor/`,
new directory = "primitives + pipeline" scope) whose pieces are:

- node-local applicable (IBL env maps, imperfection maps, contact-shadow
  plates) — consumed by mock-app CONTENT (atelier factory), per the W9A
  node-local-lights precedent;
- full-frame post (bloom/DOF/grain/vignette/LUT) applied on canvases we OWN
  (new lab/demo route, marketing-stack pattern) — NOT by editing
  `SceneRoot`/`LightingRig`.
  The watch remaster at `/` gets realism from R2 composite plates (grade baked
  at pipeline time) + the node-local floor pieces; it does NOT get a runtime
  post chain this wave. That residual gap is recorded in §8 of the report and
  the gap report.

## DEV-3 — R4 splat viewer dependency (planned deviation, additive)

A gaussian-splat loader/renderer is net-new capability requiring one new
dependency (final choice recorded in report §2 after research). Actions:

- additive `package.json` entry;
- additive allowlist entry in `.claude/hooks/dependency-allowlist-check.sh`
  (the hook file itself documents this as the sanctioned procedure);
- viewer implemented as a codeRef-registered component/factory OR an owned-
  canvas component — NOT a new `RenderMode` in `default-factory.ts` (engine).
- additive optional `PrismNode.splatUrl?: string | null` schema field only if
  needed (INV-18 additive-only law; `BackgroundLayerKind` already contains
  `'splat'`, so the schema anticipated this).

## DEV-4 — Animatable barrel regeneration

Adding catalog primitives (carousel driver, loop-column driver, floor pieces)
requires regenerating the auto-generated barrel
`src/lib/prism/animatable/primitives/index.ts` via `notes/catalog-wire-barrel.mjs`
— a generated file, not a hand-edit of engine code.

## DEV-5 — fal.ai adapter stub

`.assetgen/fal.key` is ABSENT at run start. The fal adapter is TYPED (provider-
adapter law) but returns `live: false` and rejects submits with an honest
"key absent" error. Re-check for the key before the watch-remaster phase
(founder may drop it mid-run, per W9 precedent).

## DEV-6 — Replicate-hosted ops preferred

Product-photo ops (cutout, depth, shadow, relight) use Replicate-hosted models
FIRST (we hold a key). Shadow-plate synthesis and LUT grade are implemented as
LOCAL deterministic stages (sharp: alpha-derived soft shadow; 3D-LUT/color
matrix grade) where a hosted model adds cost without quality — recorded
per-stage in the pipeline doc with the honest provenance of each stage.

## DEV-7 — D7 stretch families deferred (honest triage)

`scroll-video-scrub` and `cinematic-video-hero` (both `gap` in the W-DG1 gap
report, cluster 4) are DEFERRED this wave, per the prompt's "triage honestly; if
deferred, record in deviations + gap report." Rationale:

- **The blocker is the video/frame-sequence SOURCE, not the primitives.** The
  runtime already carries a video-texture lane (`ctx.videoLoader` +
  `node.videoTextureUrl`, FIDELITY-2 W3) and the W8 scroll-scrub driver already
  scrubs a timeline by scroll. So cinematic-video-hero's video-texture plane and
  scroll-video-scrub's scrubber are closer than the gap report implied. What is
  missing is a way to PRODUCE the footage / frame-sequence "without user upload".
- **fal is absent (checked twice, 2026-07-06).** fal is the likely host for a
  gen-video / instruction-edit adapter. Per DEV-5 the fal adapter is now TYPED
  but STUBBED (`src/lib/photo-pipeline/adapters.ts`, `falAdapter.live = false`)
  so the path is wired for when the founder drops `.assetgen/fal.key`.
- **Render-our-own-scenes-to-frames** (the gap report's alternative source) is a
  real path — the R2/R3 pipelines could render a parallax scene to a frame
  sequence — but it is a distinct build (encode + a frame-sequence asset type +
  pinned-section scroll) that belongs to a future **W-VIDEO** wave, not this one.

**Gap-report delta (recorded in report §8):** cinematic-video-hero + scroll-
video-scrub remain `gap`, but the blocking cluster narrows from "video-texture
primitive + gen-video source" to "gen-video/frame-sequence SOURCE only" — the
video-texture lane + scroll-scrub driver already exist. No readiness upgrade is
claimed (no runtime motion exemplar for either was captured this wave).
