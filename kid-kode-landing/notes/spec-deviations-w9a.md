# SHELL-W9A — Spec deviations / method record (recorded BEFORE the deviating code)

Wave: PRISM-SHELL-W9A — Mock watch-atelier app showpiece enhancement (founder-directed
2026-07-05). Governing vision: `docs/prism/ORRERY-NO7-VISION.md` (esp. §2 Atelier,
§7 asset-generation pipeline). These are method records — none violates a canonical-3
invariant; each is logged here per I-SPEC before the code that relies on it lands.

## W9A-D1 — Hero geometry via the vision §7 AI-3D pipeline (FLUX concept → Tripo P1)
The hero watch parts (`case-gen.glb`, `bezel-gen.glb`, `crown-gen.glb`, and the
exhibition `tourbillon.glb`) are regenerated through the committed pipeline: a FLUX
`flux-2-pro` studio concept image of the isolated part → Tripo `image_to_model`
model_version `P1-20260311` (Smart Mesh P1, `texture:true pbr:true`) → GLB with baked
PBR. This is exactly the §7 "AI 3D-gen for complex parts, gated by the art-fidelity
gate" path. **Art-fidelity gate:** each regenerated part is inspected structurally
(`glb-inspect.mjs`) and visually (rendered in the running app); the **better of
new-vs-existing ships per part** — a worse regeneration is discarded and the existing
June part is kept (honest, documented per-part in the report). Baked assets only (DL13):
committed GLB + textures, never a generation script's live output at runtime.

## W9A-D2 — Materials via the committed FLUX → matched-latent-delit PBR pipeline
Dial art (`dial-tex-*`) and tileable PBR normal/roughness maps (`metal-*`, `strap-*`,
`dial-nrm/rgh-*`) are upgraded via `.assetgen/gen-flux.py` (FLUX `flux-2-pro`) +
`.assetgen/derive-material-pbr.mjs` (matched-latent delit: albedo/normal/rough/metal/ao
all from one source plate). New maps land under
`public/prism-mock/orrery/meshes/atelier/textures/`. Where a filename is kept stable the
swap is in-place (zero mount-code change); where a new map is added, `src/lib/prism/atelier/config.ts`
material specs are updated additively. DL16: material richness everywhere — flat-black
voids are treated as MUST-FIX.

## W9A-D3 — Staging enhancements are additive, inside mock-app content
Cinematic camera/light/motion choreography is enhanced only inside
`src/lib/prism/atelier/watch-node-factory.ts` (and, if needed, `celestia/orrery-node-factory.ts`)
— documented mock-app content OUTSIDE the FP-05 runtime scope (see the file header).
Enhancements reuse the committed animatable primitives. The reduced-motion path is
preserved (verified, not assumed). No engine/runtime/canvas-editor file is touched
(I-CANVAS / I-ENGINE), diff-verified at close.

## W9A-D4 — `.prism` artifact rebaked deterministically from live-graph
`public/prism-assets/mock-app.prism` is rebaked from `public/prism-mock/home/live-graph.json`
via `npm run build:prism` (deterministic `build-live-prism.mjs`). The pre-existing 1-byte
working-tree diff on `mock-app.prism` (unrelated to this wave) is superseded by the clean
rebake. The live render path (`useGraphSourceStore` → `live-graph.json`) is what `/` and the
framed preview pane actually consume; the `.prism` artifact is the alternate unpack path.

## Certified-context note (not a deviation — scope clarification)
The ORRERY mock renders in exactly ONE of the three certified contexts by content:
(a) the W2 Task 0 framed preview pane, which iframes the unmodified `/` page →
`useGraphSourceStore` → `live-graph.json`. The (b) preview runtime `/preview/[projectId]`
and (c) W5B §14.1 ship-gate render *different* graphs (token-resolved Conductor graph /
synthesized fixture), so they are kept GREEN (verify + headless gate) but do not display
this wave's watch changes. "Runs identically in every certified context" = no regression in
any of the three; the visual upgrade lands in (a).
