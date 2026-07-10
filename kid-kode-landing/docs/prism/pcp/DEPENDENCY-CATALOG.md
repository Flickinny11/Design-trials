# PRISM DEPENDENCY CATALOG — allow/deny per node class (W-PCP D3)

> This file is the human-readable source of truth behind the deterministic
> dependency pre-gate (`scripts/bakeoff/prepare-axis2-bundles.mjs
> ALLOWED_IMPORT_SOURCES`, and the probe's copy). A generated node module may
> import ONLY from the allowlist below. Any other import source is an
> automatic MUST-FIX recorded before judging, and the module will not resolve
> those specifiers at runtime anyway (the require-map throws).

## Versions in force (from `package.json`, 2026-07)

| Package | Version | Note |
|---|---|---|
| `three` | ^0.184.0 | ONE bundled instance (INV-R1). Node modules access it via imports below or `ctx.THREE`. |
| `gsap` | ^3.15.0 | Timelines/tweens. Kill everything in `userData.cleanup()`. |
| `three-msdf-text-webgpu` | ^2.1.0 | NEVER imported by node modules — reached exclusively through `ctx.fontAtlas`. |

## The allowlist (exact import forms)

| Source | What it is | Import form |
|---|---|---|
| `three/webgpu` | THREE classes + Node materials (`MeshStandardNodeMaterial`, `MeshBasicNodeMaterial`, `MeshPhysicalNodeMaterial`…) | `import * as THREE from 'three/webgpu'` or named imports |
| `three/tsl` | TSL shader nodes (`color, mix, positionLocal, uv, time, sin, vec3, float`…) | named imports ONLY: `import { color, mix, uv } from 'three/tsl'` |
| `gsap` | animation | `import { gsap } from 'gsap'` (named) or `import gsap from 'gsap'` |
| `@/primitives` | cinematic primitives library alias | rarely imported — prefer `ctx.primitives[name](target, params)` |
| `@/text` | MSDF text utilities alias | rarely imported — prefer `ctx.fontAtlas.createText(...)`. Exports NO `createTextMesh`. |

## Hard denials (every one observed as a real generation failure)

- `three` / `three/addons/**` / any CDN URL — second-instance crash (INV-R1).
  GLTF loading goes through `ctx.glbLoader.loadGLB`, never `GLTFLoader`.
- `three-msdf-text-webgpu` direct — WebGPU-only NodeMaterial; use `ctx.fontAtlas`.
- `react`, `@react-three/fiber`, `@react-three/drei` — node modules are
  renderer-agnostic factories, not components.
- `pixi.js`, `pixi-filters` — removed from the product entirely.
- `html-to-image` — forbidden repo-wide.
- Node built-ins (`fs`, `path`…), `fetch` to arbitrary URLs — modules run in
  the browser sandbox; data arrives via config, assets via ctx loaders.
- Raw GLSL/WGSL strings, `ShaderMaterial`, `RawShaderMaterial` — TSL only.

## Class-conditional notes (what each render mode may pull)

| Node class / renderMode | Allowed surface beyond the base | Denied even though tempting |
|---|---|---|
| `sprite` / `plane` | `three/webgpu` materials + `ctx.textureLoader` | displacement (that's parallax-plane's job) |
| `parallax-plane` | + `three/tsl` displacement nodes, `config.depthMapUrl` via `ctx.textureLoader` | loading GLBs |
| `mesh` | + `ctx.glbLoader.loadGLB(config.meshUrl)` | applying `imageUrl` as a texture override (mesh ships textured) |
| `text` | NONE — no module is generated; the runtime's default factory renders `node.textSpec` | everything |
| hero-3d (any mode) | + `three/tsl` for bespoke materials, `ctx.primitives` | postprocessing imports (composer effects are host-owned; see skill guide `postprocessing-chain`) |

## Why a pre-gate and not trust

W-BAKE measured it: models invent imports under pressure (`@/text`
`createTextMesh`, `three/addons` GLTFLoader, `MeshStandardNodeMaterial` from
`three/tsl` instead of `three/webgpu`). The gate is deterministic (import-scan
vs this list) so a violation is recorded evidence, not a runtime surprise.
