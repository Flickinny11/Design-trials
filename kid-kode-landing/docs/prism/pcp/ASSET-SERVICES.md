# PRISM ASSET-GENERATION SERVICES — exact call recipes (W-PCP D3)

> How assets that nodes consume (`imageUrl`, `depthMapUrl`, `meshUrl`,
> backdrop plates, PBR maps) get MADE. Generation happens at BUILD/PLAN time
> by the pipeline — never inside a node module and never per-pageview (DL13:
> baked, versioned, committed with evidence). Node modules only ever see
> public URLs through `ctx.textureLoader` / `ctx.glbLoader`.
>
> Key material lives in the gitignored `../.assetgen/` directory (Replicate,
> Tripo, provider keys; one raw token per file, chmod 600). No key value ever
> appears in graph data, module code, logs, or commits (INV-19 / I-P4).

## 1. FLUX image/texture/background pipeline (the shipped W-BG path)

**Client:** `../.assetgen/gen-flux.py` (Replicate `flux-2-pro`; strict arg
order: `python3 gen-flux.py <out.png> <width> <height> "<prompt>"`).

**Committed pipeline exemplar:** `scripts/three-d-backgrounds/gen-wbg-plates.mjs`
— per plate: FLUX composition → `depth-anything-v2` full-frame depth → local
deterministic filmic grade (saturation trim + contrast lift + vignette via
sharp) → baked to `public/three-d-bg/plates/<id>.webp` + `<id>-depth.webp`,
per-call ledger with prediction ids (I-PROVENANCE: idempotent skip PRESERVES
ids; never regenerate over committed provenance).

**Prompt discipline (proven):**
- Always append the negative clause: `no text, no letters, no labels, no
  watermark, no logo, no people` — FLUX slips maker's-mark text onto surfaces
  otherwise (W9A dial finding).
- Backdrops: "empty middle ground, no centered focal subject, dark-leaning
  but LIT" — literal "deep near-black" prompts render TRUE black (W-PHOTO).
- PBR derivation: `../.assetgen/derive-material-pbr.mjs` turns a FLUX
  texture into albedo/roughness/normal maps (W9A dial + metal path). Inject
  roughness via material factory (`center: 0.9` pattern) — roughnessMap
  MULTIPLIES base roughness.

**Replicate transport gotchas (committed knowledge, W-PHOTO):** community
models need the VERSION endpoint `/v1/predictions` + `User-Agent: curl/8.4.0`
(Cloudflare 1010 otherwise); `depth-anything-v2` returns a dict — read
`grey_depth`.

**Cost bands (ledgered 2026-07):** flux-2-pro ~$0.06 per ~2MP call;
depth-anything-v2 ~$0.01.

## 2. Photo-composite heroes (R2 route — the "reads as a photograph" path)

**Committed pipeline:** `scripts/build-photo-composite.mjs`
(`src/lib/photo-pipeline/`): FLUX composition → bria cutout (subject
isolation) → depth-anything-v2 → local shadow plate → filmic grade →
`layered-photo-scene` primitive consumes the layer stack. Use for hero nodes
that must read photographic (the W-TPL meridian/folio class). Compose R2
heroes as layered imageNodes — `material.map` hot-swap on a mounted mesh does
NOT recompile under WebGPU (plates stay near-black).

## 3. Tripo3D for 3D objects (meshUrl lane)

**Client:** `../.assetgen/tripo.py`.
- Text→3D: `python3 tripo.py text <out-dir> "<concept>"` (version id needs
  the date suffix, e.g. `v3.1-20260211`).
- Image→3D: `python3 tripo.py image <out-dir> P1-20260311 <concept-image>`
  (P1 REJECTS `face_limit` — omit it, then decimate locally).
- Texture / rig / part-segmentation re-reference the ORIGINAL `task_id`.

**Post-process (always):** `optimize-glb` dir-based pass (1024px textures /
45K tris — 40MB→1.4MB proven) before the GLB lands in `public/`. Force-add
load-bearing GLBs if the directory is gitignored (W9A DL13 lesson).

**Alternates (typed adapters, `src/lib/capabilities/generative.ts`):**
Replicate-hosted Hunyuan 3D 3.1 and Rodin Gen-2; Tripo credits are metered —
check the CapabilityUsage ledger before batch generation.

## 4. When to GENERATE vs when to USE PRIMITIVES

Generate an asset when the visual requires **organic/photographic detail**:
- product/hero objects with real materials → Tripo/Hunyuan mesh
- photographic backdrops, graded plates, texture surfaces → FLUX (+depth)
- PBR material sets (brushed metal, marble, leather) → FLUX + derive-pbr

Stay procedural (TSL + primitives + geometry) when the visual is
**geometric/graphic/animated**:
- gradients, glass, emissive cores, particle fields, kinetic type — TSL
  nodes beat baked images (resolution-independent, animatable, zero cost)
- motion of any kind → `ctx.primitives` / gsap, never baked video unless the
  spec provides a `videoUrl`
- UI chrome (cards, hairlines, docks) → geometry + §3.5 PBR ranges

Decision rule of thumb: if a still camera couldn't tell your procedural
version from the generated one, don't spend the credits. If the surface needs
to read as a PHOTOGRAPH or a MANUFACTURED OBJECT, generate — flat-color
stand-ins are a DL9/DL11 MUST-FIX.
