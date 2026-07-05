# 3D-OBJECT REPORT — P4 of the Canvas completion run

**Branch:** `prism-editor-build` · **Model:** claude-fable-5 · **Date:** 2026-06-10
**Spec:** PRISM-CANVAS-EDITOR-SPEC.md §5 (3D object tools). Additive schema: `MeshPrimitive { kind, params }` + `PrismNode.meshPrimitive` (+ `MESH_PRIMITIVE_DEFAULTS`).

## What shipped
- **7 primitive kinds** (cube/sphere/plane/cylinder/cone/torus/capsule) as real scene nodes: factory branch builds three geometries (params over per-kind defaults, clamped tessellation) with the SAME material route as the GLB lane — `buildPhysicalMaterial(materialSpec)`, LIT by default, casts + receives shadows. A node carrying `meshPrimitive` wins over `meshUrl` (GLB load never issued; documented + tested).
- **Live reshape:** `userData.meshPrimitiveHandle.setPrimitive` swaps ONLY the geometry on the same Mesh (old disposed, no-op churn guard) — dimension faders are instant, no rebuild.
- **Live material:** `setMaterialSpec` mutates the SAME `MeshPhysicalNodeMaterial` instance, flagging `needsUpdate` only on real compile edges (transparent + transmission/clearcoat/iridescence/dispersion zero-crossings). A GraphScene effect keys on (meshPrimitive, materialSpec) so the EXISTING Inspector Material tab (preview-store writes) lands live on primitives — the §11 editor is the single source of truth; the flyout only shows summary chips + an "Edit Material" jump key (`openInspector('material')`).
- **3D Object toolbar group (wired):** 7 machined shape keys with hand-drawn line glyphs, per-kind dimension faders + "Smoothness" on curved kinds, material summary + jump, lighting tip referencing the existing Receives Light toggle. Plain-language copy throughout.
- **Participation:** gizmo/Transform (scenePosition), Group/Ungroup (generic `groupId` path), animation bindings (subject = the primitive Mesh) all ride the existing paths — proven live.

## Verification
- Drive `scripts/verify-3d-object.mjs`: **5/5 PASS first run** on real GPU (webgpu attested) — physical/lit/shadowed primitives; in-place reshape (geometry uuid swapped, mesh+material identity HELD, bbox 0.92→2.52); Inspector Material edit mutated the same instance live (metalness 0→1); Transform move; float binding drift 0.227 on the primitive in preview-app. Frames 01–04 + results.json.
- **Advocate: PLEASED / PASS — first round, zero MUST-FIX** ("I tapped a donut button and got an actual shiny 3D donut … casting a real shadow"). Verdict preserved in the bundle.
- 312-catalog: result line in the ledger before AUTO-CKPT. tsc 0-new; +49 new tests (31 mesh-primitive + 18 UI helpers); full suite at the 21-fail legacy baseline.

## Honest flags
1. Two deliberate one-line carve-outs outside agent ownership (backed up, additive): `isStage0Bubble` excludes meshPrimitive nodes; `hasArtifactData` includes them — without both, a primitive would render as a bubble in canvas and vanish in preview.
2. `validatePlanRendererFields` (regen verify route, untouched) would false-flag MESH_REQUIRES_MESH_URL on meshPrimitive nodes — follow-up: treat meshPrimitive as a mesh artifact.
3. Pre-existing: `materialSpec` is not in the content-hash projection (GLB lane too) — live edits + Save-and-Rebuild cover it; flagged for a later additive line.
4. Plane primitive is single-sided (GLB-lane default); DoubleSide polish noted.
5. Advocate flags → P5: selection ring doesn't rescale with reshaped geometry; orphaned dust/particle patch below the app card tied to a stray content 404; the flat-black watch mock asset now reads cheap next to lit primitives (asset re-provision territory).

## Plain-language summary for Logan
The 3D shelf is live. Tap Cube, Sphere, Torus — any of seven shapes — and a real, lit, shadow-casting 3D object lands in your scene. Drag the shape sliders and it resculpts instantly. Hit "Edit Material" and the same material panel you use everywhere makes it glossy, metallic, glassy — live, while you watch. It moves with the transform tools, groups with anything, and takes any of the 312 animations (we bound "Float" and watched the donut bob in Preview). The advocate passed it first try.
