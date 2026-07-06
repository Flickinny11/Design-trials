# SHELL-W10 — Spec deviations / method record (recorded BEFORE the deviating code)

Wave: PRISM-SHELL-W10 — Generative 3D capability family in the editor (founder-directed
2026-07-05: "integrate all of tripo's platform capabilities into the canvas editor so
users can choose"). These are method records — none violates a canonical-3 invariant;
each is logged per I-SPEC before the code that relies on it lands.

## W10-D1 — Generative adapters are a SIBLING family to CapabilityProvider (same D1 law)
The generative-3D surface ships as `GenerativeCapabilityAdapter` — a sibling interface to
`CapabilityProvider` in `src/lib/capabilities/` — because its shape is inherently
job-based (submit → poll → asset ref) rather than search/validate/connect. The D1
provider-agnostic law and INV-NEV2-4 are carried over verbatim: every vendor REST call
lives ONLY inside its adapter file under `src/server/capabilities/generative/`; the
client reaches capabilities only through `/api/prism/generative`; swapping or adding a
vendor is an adapter file + registry entry, zero UI rework. Live adapters: Tripo
(generate3D / textureMesh / rigMesh / segmentMesh), Replicate (generate3D alt:
Hunyuan 3D 3.1 + Rodin Gen-2), FLUX material (wraps the EXISTING committed
`.assetgen/gen-material.sh` pipeline — reused, not forked, same spawn pattern as
`/api/material-gen`). Typed stubs (documented live SDK, no key): Marble (World Labs
World API, launched 2026-01-21 — async world generation, REST + SDK, worlds render in
browser/engines), Meshy (texturing + animation), Mesh-ops aggregator (retopo / repair /
format-convert, e.g. 3D AI Studio). Stubs follow the exact `AggregatorStub` precedent.

## W10-D2 — Secrets: keys server-only via the material-gen precedent (INV-19)
Tripo/Replicate keys are read server-side from the Design-trials root
`.assetgen/tripo.key` / `.assetgen/replicate.key` (gitignored, exactly where the
committed pipelines already keep them) with env-var override (`TRIPO_API_KEY`,
`REPLICATE_API_TOKEN`). Keys never appear in the graph, the client bundle, logs,
reports, or API responses. When a key is absent the adapter reports `live:false` and
serves demo-safe offline results (the established live-vs-stub pattern), so build +
verify never break on a keyless machine.

## W10-D3 — Naming + icon law for generation tiles (founder law, DL14)
Generation capability tiles are named MODEL + FUNCTION ("Smart Mesh P1 — image to 3D",
"FLUX 2 Pro — PBR material", "Marble — explorable world") — never a vendor platform
tile ("Tripo integration" is FORBIDDEN in this family). Tile icons are NEW custom
glyphs in the DL14 black/white/red language (no stock icons, no brand marks) — brand
marks remain correct for the *integration* family (Stripe/GitHub), which is untouched.

## W10-D4 — Additive schema: `PrismNode.generativeAssets?`
Result assets attach to a node via a NEW optional field
`generativeAssets?: GenerativeAssetAttachment[]` (id, capabilityId, model, kind, url,
label, createdAt, meta). Additive-only per the schema discipline — no existing field is
deleted, renamed, or re-typed. "Use as mesh" applies the asset through the EXISTING
optional fields (`meshUrl`, `renderMode: 'mesh'`) via the established FunctionsTab
`updateNode` write path (outside panels/, FP-15 does not govern it — same precedent as
functionTiles). Generated assets land under the existing project asset store paths
(`public/prism-mock/editor/models/generated/<id>/`, textures under the existing
`textures/generated/`). Baked, committed samples only for demo fixtures (DL13).

## W10-D5 — Metering now, charging later (E20 pattern)
Every invocation records a `CapabilityUsage` event server-side —
`{ id, capabilityId, model, provider, userId, projectId, costBasis (credits|$ est.),
jobId, resultAssetRef, at }` — appended to `.data/capability-usage.json` (same
LocalStore pattern as `.data/snippets.json`). Charging is deferred to the billing
phase; the ledger view shipped now is dev-grade (a panel listing events + totals),
which the prompt explicitly allows.

## W10-D6 — Fresh-verified vendor surface (2026-07-05)
- Tripo v2 openapi task types verified live: `text_to_model`, `image_to_model`,
  `texture_model` (10cr base, +10 detailed), `animate_rig` (25cr; `animate_prerigcheck`
  free), `mesh_segmentation` (40cr). P1 textured image→3D = 50cr; text→3D 10–40cr.
  Balance at run start: **460 credits** (`tripo.py balance`). Budget cap ~120cr.
- Replicate models verified via authenticated API probe: `tencent/hunyuan-3d-3.1`
  (inputs: image|prompt, enable_pbr, face_count; latest version `a2838628…`) and
  `hyper3d/rodin` ("Generate complex 3D models from images with Rodin Gen-2").
  Cap ~$3 — the alt-gen live demo runs ONE Hunyuan job; Rodin is live-wired but not
  demo-spent.
- Marble: World Labs **World API** public since 2026-01-21 (text/image/video →
  navigable 3D world, async, REST). No key on this machine → typed stub.

## W10-D7 — Scope of editor touch (I-ADDITIVE)
UI lands only as: (a) a "Generate" category section INSIDE the existing FunctionsTab
render tree (new sibling component `GeneratePanel.tsx` under
`src/components/editor/functions/`), (b) the invoke flow inside that panel (params →
job progress → attach), (c) a dev-grade ledger list inside the same panel. No existing
editor code path is deleted or rewritten; Inspector.tsx is not modified (FunctionsTab
already mounts there); the `/` canvas editor prototype gets these hooks only through
the already-mounted Inspector surface. Diff-verified additive at close.

## W10-D8 — Vendor clients extended in the committed .assetgen pipeline (post-impl record)
The Tripo REST for the downstream ops (texture / rig / segment / prerig) was added
to the EXISTING committed Tripo client `.assetgen/tripo.py` as new subcommands
(`texture`/`rig`/`segment`/`prerig`), and a new sibling client
`.assetgen/replicate-3d.py` was added for the Replicate 3D models (Hunyuan 3D 3.1
`tencent/hunyuan-3d-3.1`, Rodin Gen-2 `hyper3d/rodin`). This keeps ALL vendor REST
for each provider in ONE swappable client (INV-NEV2-4 spirit): the `src/server`
adapter is the thin interface impl that spawns it, exactly as `/api/material-gen`
spawns `gen-material.sh`. `.assetgen/` is gitignored (keys live there; INV-19), so
these clients are NOT committed — on a fresh clone the adapters see the scripts
absent, report `live:false`, and serve the committed demo fixtures. The demo
fixtures under `public/prism-mock/editor/models/generated/demo-*` and
`textures/generated/demo-flux-brass` ARE committed (DL13, baked real output).
Model note: the catalog names the Replicate object-gen tile "Hunyuan 3D 3.1",
which is the exact Replicate model used (`tencent/hunyuan-3d-3.1`, prompt-capable).
