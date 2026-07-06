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
