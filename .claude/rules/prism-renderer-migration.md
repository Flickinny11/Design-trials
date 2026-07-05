# Prism Renderer Migration — additive override rules

> ## ⛔ RETIRED / INERT (2026-06-05, STEP 3)
> The PixiJS → Three.js/WebGPU renderer migration is **DONE**. The
> `.ralph-migration-active` marker has been removed, so per the activation
> clause below these override rules are **inert** and `migration-forbidden-patterns.sh`
> no longer fires. This file is retained for **traceability only**.
>
> The migration's still-binding invariants were **carried forward** into the
> canonical-3 specs (renderer foundations → `PRISM-RUNTIME-SPEC.md` §9 INV-R9/R11/R12;
> see `docs/prism/SPEC-INDEX.md` S8) and remain enforced live by
> `anti-drift-check.sh` (editor-build block FP-05/FP-09, active via
> `.prism-editor-build-active`). The migration spec itself now lives at
> `docs/prism/archive/PRISM-RENDERER-MIGRATION-SPEC.md`. **Do not re-create the
> marker or re-run the Ralph loop** (drivers archived under
> `kid-kode-landing/scripts/archive/`).

Active while `.ralph-migration-active` markers exist at repo root or
`kid-kode-landing/`. These rules **add to** (do not replace) the existing
project rules in `kid-kode-landing/CLAUDE.md` and the inner-spec invariants
encoded in `kid-kode-landing/.claude/hooks/anti-drift-check.sh`.

When the migration completes (all 10 tasks `done` in
`kid-kode-landing/notes/ralph-state.json`), the override clauses below become
inert (the file is retained for traceability; the markers are removed).
**↑ This has now happened — see the RETIRED banner above.**

## Renderer

- Runtime renderer is `three/webgpu` with automatic WebGL2 fallback.
- TSL only: shaders are written via `three/tsl`, never raw GLSL.
- Editor uses `@react-three/fiber` v9 + `@react-three/drei` v9 with the async
  `gl` factory pattern for WebGPU init.

## Dependencies

- **Required additions**: `three-msdf-text-webgpu`. (`three`, `gsap`,
  `@react-three/*` are already present.)
- **Required removals (Phase 5 only)**: `pixi.js`, `pixi-filters`, any
  `@pixi/*` add-ons.
- **Forbidden** (continuation of existing rules): `html-to-image`. The
  migration does NOT loosen this.

The `dependency-allowlist-check.sh` hook is the source of truth. Update it
additively when introducing new approved imports.

## Schema (`PrismNode` in `src/lib/prism-graph/types.ts`)

The 5 new fields are **additive only**. Never delete or rename existing
fields:

| Field | Type | Default for legacy graphs |
|---|---|---|
| `renderMode` | `'sprite' \| 'plane' \| 'parallax-plane' \| 'mesh'` | `'sprite'` |
| `depthMapUrl` | `string \| null` | `null` |
| `meshUrl` | `string \| null` | `null` |
| `cinematicPrimitives` | `CinematicPrimitiveRef[]` | `[]` |
| `scenePosition` | `{ x, y, z, rotationXYZ, scaleXYZ }` | identity |

Note: the migration spec calls the type `GraphNode`. **In this repo it is
`PrismNode`.** Read accordingly.

## `createNode` contract (spec §8)

```ts
export default function createNode(config: NodeConfig, ctx: NodeContext): THREE.Object3D
```

- **Synchronous.** Async loading happens inside primitives via `ctx.textureLoader`
  / `ctx.glbLoader` / `ctx.fontAtlas`, all of which return cached resources.
- Return value: `THREE.Object3D` (typically `THREE.Group`).
- `userData.cleanup()` MUST dispose geometries, materials, textures, and kill
  GSAP timelines.
- `userData.handlers.{onPointerOver,onClick,…}` for events. Never call
  `renderer.domElement.addEventListener`.
- The function MUST NOT add to the scene directly. The hub manager mounts.

## Cinematic primitives (spec §7, CINEMATIC-PRIMITIVES-LIBRARY.md)

- 9 primitives, fixed library: `orbit`, `depth-rotate`, `dissolve-morph`,
  `displacement-transition`, `parallax-scroll`, `magnetic-cursor`,
  `particle-emerge`, `fly-through`, `kinetic-text`.
- Apply via `ctx.primitives[primitive.name](targetObject, primitive.params)`.
- **Never inline primitive logic** in node code.
- Every node ships with at least one primitive applied unless the plan
  explicitly sets `cinematicPrimitives: []`.

## Text

- Render via `ctx.fontAtlas` (MSDF + `three-msdf-text-webgpu`).
- Never use `THREE.TextGeometry`.
- Never render text into FLUX.2 images for production output (negative prompt
  must include "no text, no letters, no labels").
- Never use DOM overlays for text.

## DOM access

Forbidden in node modules and runtime code:
- `document.*` (any access)
- `window.*` (any access)

Single allowed exception: `window.devicePixelRatio`.

## Out of scope (DO NOT MODIFY)

- Cortex engine (entirely separate code path).
- `modal/app.py` (Cortex integration, may be elsewhere or absent in this repo).
- Plan generation logic (pipeline §1–5).
- FLUX.2 / SAM 3 integration paths.
- Backend pipeline (contract-first generation).
- Database schema (none in this repo, but if encountered).
- SSE event channel.
- Self-healing tier ladder (post-migration project).
- Non-renderer editor surfaces (chat panel, plan view, deployment).

## Ralph discipline

- One task per Claude session. The `/ralph-step` command exits after
  step 14; do not pick up a second task.
- TDD where `tddRequired === true`: failing test committed before
  implementation; tests not edited during implementation.
- Each iteration ends with `spec-reviewer` subagent review on `HEAD`.
  MUST FIX items block the commit.
- Each iteration appends one line to
  `kid-kode-landing/notes/prism-renderer-progress.md`.
- Each iteration ends with `git push origin prism-renderer-ralph`.

## Phase 5 marker

When PixiJS removal is complete, `/ralph-step` for T05 touches
`.ralph-phase5-pixi-removed`. After that marker exists,
`migration-forbidden-patterns.sh` blocks any new `from 'pixi'` import.
