// Mesh primitives — P4 3D-OBJECT (canvas-spec §5 3D object tools; INV-8
// additive). A node carrying `meshPrimitive` renders real generated geometry
// built here from `kind` + `params` resolved over MESH_PRIMITIVE_DEFAULTS.
// The surface routes through the EXISTING material system (the same
// buildPhysicalMaterial / applyMaterialSpec lane the meshUrl/GLB path uses),
// so primitives are LIT by default and ride the lighting rig untouched.
//
// Live editing contract (the Inspector's dimension + Material tab writes):
//   • `createMeshPrimitiveHandle(mesh)` → { setPrimitive, setMaterialSpec }.
//   • setPrimitive swaps ONLY the BufferGeometry on the SAME Mesh (mesh +
//     material identity stable; the old geometry is disposed) — a dimension
//     edit is instant, never a rebuild.
//   • setMaterialSpec applies the spec onto the SAME MeshPhysicalNodeMaterial
//     instance via applyMaterialSpec. Scalar/color edits (metalness,
//     roughness, baseColor, emissive…) are pure uniform writes — no
//     recompile. `needsUpdate` is flagged ONLY when a property flip changes
//     the compiled node program: MeshPhysicalNodeMaterial gates whole shader
//     lobes on zero-crossings (useTransmission ⇔ transmission > 0,
//     useClearcoat ⇔ clearcoat > 0, useIridescence ⇔ iridescence > 0,
//     useDispersion needs transmission too) and `transparent` changes the
//     pipeline blend state. (three r184 MeshPhysicalNodeMaterial.js — the
//     use* getters feed PhysicalLightingModel at setup time.)
//
// DOM-free (INV-R12) + RELATIVE imports only (dep-guard for src/lib/prism/**).

import {
  BoxGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
  type Mesh,
  type Texture,
} from 'three';
import type { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  FACE_SLOT_COUNT,
  MESH_PRIMITIVE_DEFAULTS,
  type FaceTexture,
  type MaterialSpec,
  type MeshPrimitive,
} from '../../../prism-graph/types';
import { applyMaterialSpec, buildPhysicalMaterial, resolveMaterialSpec } from './material-system';

/** Tessellation bounds. Curved kinds need ≥ 3 segments to be a surface at
 *  all; 96 caps runaway vertex counts from a wild param write. Flat kinds
 *  (cube/plane) are exact at 1 subdivision — their per-kind default IS 1
 *  (MESH_PRIMITIVE_DEFAULTS), so they clamp to 1..96 instead of being
 *  force-tessellated. */
export const SEGMENTS_MIN_CURVED = 3;
export const SEGMENTS_MIN_FLAT = 1;
export const SEGMENTS_MAX = 96;

const CURVED_KINDS: ReadonlySet<MeshPrimitive['kind']> = new Set([
  'sphere',
  'cylinder',
  'cone',
  'torus',
  'capsule',
]);

type ResolvedPrimitiveParams = Required<NonNullable<MeshPrimitive['params']>>;

/** A finite, strictly positive dimension or the per-kind default. Guards the
 *  geometry constructors against zero/negative/NaN scene-unit dims that would
 *  build degenerate (invisible or inside-out) surfaces. */
function dimOrDefault(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

/** Resolve a primitive's params over MESH_PRIMITIVE_DEFAULTS[kind]: every
 *  dimension defined, degenerate values replaced by the kind's default, and
 *  `segments` clamped to a sane integer band (3..96 curved, 1..96 flat). */
export function resolveMeshPrimitiveParams(prim: MeshPrimitive): ResolvedPrimitiveParams {
  const defaults = MESH_PRIMITIVE_DEFAULTS[prim.kind];
  const p = prim.params ?? {};
  const min = CURVED_KINDS.has(prim.kind) ? SEGMENTS_MIN_CURVED : SEGMENTS_MIN_FLAT;
  const rawSegments =
    typeof p.segments === 'number' && Number.isFinite(p.segments)
      ? Math.round(p.segments)
      : defaults.segments;
  return {
    width: dimOrDefault(p.width, defaults.width),
    height: dimOrDefault(p.height, defaults.height),
    depth: dimOrDefault(p.depth, defaults.depth),
    radius: dimOrDefault(p.radius, defaults.radius),
    tube: dimOrDefault(p.tube, defaults.tube),
    length: dimOrDefault(p.length, defaults.length),
    segments: Math.min(SEGMENTS_MAX, Math.max(min, rawSegments)),
  };
}

/** Build the BufferGeometry for a mesh primitive. Pure + synchronous: params
 *  resolve over the kind's defaults; the caller owns disposal. Constructor
 *  mappings (three r184):
 *    cube     → BoxGeometry(width, height, depth, s, s, s)
 *    sphere   → SphereGeometry(radius, s, s)
 *    plane    → PlaneGeometry(width, height, s, s)
 *    cylinder → CylinderGeometry(radius, radius, height, s)
 *    cone     → ConeGeometry(radius, height, s)
 *    torus    → TorusGeometry(radius, tube, s, s)
 *    capsule  → CapsuleGeometry(radius, length, s, s)  // length = mid-section
 */
export function buildPrimitiveGeometry(prim: MeshPrimitive): BufferGeometry {
  const r = resolveMeshPrimitiveParams(prim);
  const s = r.segments;
  switch (prim.kind) {
    case 'cube':
      return new BoxGeometry(r.width, r.height, r.depth, s, s, s);
    case 'sphere':
      return new SphereGeometry(r.radius, s, s);
    case 'plane':
      return new PlaneGeometry(r.width, r.height, s, s);
    case 'cylinder':
      return new CylinderGeometry(r.radius, r.radius, r.height, s);
    case 'cone':
      return new ConeGeometry(r.radius, r.height, s);
    case 'torus':
      return new TorusGeometry(r.radius, r.tube, s, s);
    case 'capsule':
      return new CapsuleGeometry(r.radius, r.length, s, s);
  }
}

// ── Per-face image mapping (CANVAS-FINAL §12.1, criterion 19) ────────────────

/** The texture loader the factory hands in (ctx.textureLoader). Async; the
 *  material shows its resolved baseColor until the texture lands. */
export interface FaceTextureLoaderLike {
  loadTexture(url: string): Promise<Texture>;
}

/** Apply a normalized 0..1 crop window to a texture via offset/repeat (the
 *  texture is never re-rendered). y is flipped to texture space. */
function applyFaceCrop(tex: Texture, crop?: FaceTexture['crop']): void {
  if (!crop) return;
  const x = clamp01(crop.x ?? 0);
  const y = clamp01(crop.y ?? 0);
  const w = clamp01(crop.width ?? 1);
  const h = clamp01(crop.height ?? 1);
  if (w <= 0 || h <= 0) return;
  tex.offset.set(x, Math.max(0, 1 - y - h));
  tex.repeat.set(w, h);
  tex.needsUpdate = true;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
}

export interface FaceMaterialBuild {
  /** Single material, or a per-face array when `faceTextures` are present. */
  material: MeshPhysicalNodeMaterial | MeshPhysicalNodeMaterial[];
  /** The shared base material (un-textured faces + baseColorMap target). */
  base: MeshPhysicalNodeMaterial;
  /** Every distinct material to register for disposal. */
  dispose: MeshPhysicalNodeMaterial[];
}

/** Build the surface material(s) for a primitive. With no `faceTextures` this
 *  returns the single base material (existing behavior). With face textures it
 *  returns a per-group material ARRAY (Box=6, Cone=2, Cylinder=3, Sphere=1 —
 *  three's geometry groups), each textured face a clone of the base spec with
 *  the assigned image poured into `.map` (sRGB, crop applied, opacity honored).
 *  Un-textured slots reuse the shared base material. */
export function buildFaceMaterials(
  prim: MeshPrimitive,
  faceTextures: FaceTexture[] | undefined,
  baseSpec: MaterialSpec | null | undefined,
  loader: FaceTextureLoaderLike,
): FaceMaterialBuild {
  const resolved = resolveMaterialSpec(baseSpec);
  const base = buildPhysicalMaterial(resolved);
  applyMaterialSpec(base, resolved);

  const slots = FACE_SLOT_COUNT[prim.kind] ?? 1;
  const byFace = new Map<number, FaceTexture>();
  if (faceTextures) {
    for (const ft of faceTextures) {
      if (ft && typeof ft.url === 'string' && ft.url.length > 0 && ft.faceIndex >= 0 && ft.faceIndex < slots) {
        byFace.set(ft.faceIndex, ft);
      }
    }
  }
  if (byFace.size === 0 || slots <= 1) {
    // Sphere/plane/torus/capsule are single-group; a lone face texture still
    // maps onto the one slot via the base material's map (set below) when
    // present, else the plain base material.
    const only = byFace.get(0);
    if (only && slots <= 1) {
      void loader
        .loadTexture(only.url)
        .then((tex) => {
          (tex as { colorSpace?: string }).colorSpace = 'srgb';
          applyFaceCrop(tex, only.crop);
          (base as unknown as { map: Texture | null; needsUpdate: boolean }).map = tex;
          (base as unknown as { needsUpdate: boolean }).needsUpdate = true;
          if (typeof only.opacity === 'number' && only.opacity < 1) {
            base.opacity = only.opacity;
            base.transparent = true;
          }
        })
        .catch(() => { /* missing → base color stands */ });
    }
    return { material: base, base, dispose: [base] };
  }

  const dispose: MeshPhysicalNodeMaterial[] = [base];
  const arr: MeshPhysicalNodeMaterial[] = [];
  for (let i = 0; i < slots; i += 1) {
    const ft = byFace.get(i);
    if (!ft) {
      arr.push(base);
      continue;
    }
    const m = buildPhysicalMaterial(resolved);
    applyMaterialSpec(m, resolved);
    if (typeof ft.opacity === 'number' && ft.opacity < 1) {
      m.opacity = ft.opacity;
      m.transparent = true;
    }
    void loader
      .loadTexture(ft.url)
      .then((tex) => {
        (tex as { colorSpace?: string }).colorSpace = 'srgb';
        applyFaceCrop(tex, ft.crop);
        (m as unknown as { map: Texture | null; needsUpdate: boolean }).map = tex;
        (m as unknown as { needsUpdate: boolean }).needsUpdate = true;
      })
      .catch(() => { /* missing → base color stands */ });
    arr.push(m);
    dispose.push(m);
  }
  return { material: arr, base, dispose };
}

/** Stable identity key for a primitive (kind + resolved params) so the live
 *  handle can no-op repeat writes of the same shape instead of churning
 *  geometry every effect pass. */
export function meshPrimitiveKey(prim: MeshPrimitive): string {
  const r = resolveMeshPrimitiveParams(prim);
  return `${prim.kind}|${r.width}|${r.height}|${r.depth}|${r.radius}|${r.tube}|${r.length}|${r.segments}`;
}

/** Apply a MaterialSpec onto an existing physical material instance LIVE —
 *  the same applyMaterialSpec lane the build path uses, plus the recompile
 *  edge detection documented in the header: `needsUpdate` is flagged only
 *  when a shader-lobe zero-crossing (transmission / clearcoat / iridescence /
 *  dispersion) or a `transparent` blend-state flip changes the compiled
 *  program. Pure value moves inside the same lobe set stay uniform writes. */
export function applyMaterialSpecLive(
  mat: MeshPhysicalNodeMaterial,
  spec?: MaterialSpec | null,
): void {
  const wasTransparent = mat.transparent === true;
  const hadTransmission = (mat.transmission ?? 0) > 0;
  const hadClearcoat = (mat.clearcoat ?? 0) > 0;
  const hadIridescence = (mat.iridescence ?? 0) > 0;
  const hadDispersion =
    ((mat as unknown as { dispersion?: number }).dispersion ?? 0) > 0;
  applyMaterialSpec(mat, resolveMaterialSpec(spec));
  const nowDispersion =
    ((mat as unknown as { dispersion?: number }).dispersion ?? 0) > 0;
  if (
    mat.transparent !== wasTransparent ||
    ((mat.transmission ?? 0) > 0) !== hadTransmission ||
    ((mat.clearcoat ?? 0) > 0) !== hadClearcoat ||
    ((mat.iridescence ?? 0) > 0) !== hadIridescence ||
    nowDispersion !== hadDispersion
  ) {
    mat.needsUpdate = true;
  }
}

/** The live-edit surface the factory mounts at
 *  `group.userData.meshPrimitiveHandle` and the editor's AssembledSceneNode
 *  effect drives. Both writes are in-place and instant — never a rebuild. */
export interface MeshPrimitiveHandle {
  /** Swap the GEOMETRY in place (same Mesh + material identity; the previous
   *  geometry is disposed). No-ops when the resolved shape is unchanged. */
  setPrimitive(next: MeshPrimitive): void;
  /** Apply a MaterialSpec to the SAME physical material instance (see
   *  applyMaterialSpecLive for the needsUpdate edge rules). */
  setMaterialSpec(spec?: MaterialSpec | null): void;
  /** Load a base-color texture URL and set .map on the material (async, cached). */
  setColorMap(url: string | null, loader: FaceTextureLoaderLike): void;
  /** Load a tangent-space normal map (linear) + set normalScale (PHASE1, SC-V-A3). */
  setNormalMap(url: string | null, loader: FaceTextureLoaderLike, scale?: number): void;
  /** Load a roughness map (linear, green channel) onto .roughnessMap (PHASE1). */
  setRoughnessMap(url: string | null, loader: FaceTextureLoaderLike): void;
}

/** Build the handle for a mounted primitive Mesh. `mesh.geometry` must be the
 *  geometry built from `initial`; `mesh.material` must be the node's
 *  MeshPhysicalNodeMaterial. */
export function createMeshPrimitiveHandle(
  mesh: Mesh,
  initial: MeshPrimitive,
): MeshPrimitiveHandle {
  let currentKey = meshPrimitiveKey(initial);
  return {
    setPrimitive(next: MeshPrimitive): void {
      const nextKey = meshPrimitiveKey(next);
      if (nextKey === currentKey) return;
      const old = mesh.geometry;
      mesh.geometry = buildPrimitiveGeometry(next);
      currentKey = nextKey;
      try {
        old.dispose();
      } catch {
        /* ignore */
      }
    },
    setMaterialSpec(spec?: MaterialSpec | null): void {
      const mat = mesh.material;
      if (Array.isArray(mat)) {
        // Per-face material array: apply to each DISTINCT physical material
        // (the shared base may appear in multiple slots — dedupe).
        const seen = new Set<unknown>();
        for (const m of mat) {
          if (m && !seen.has(m)) {
            seen.add(m);
            applyMaterialSpecLive(m as MeshPhysicalNodeMaterial, spec);
          }
        }
      } else {
        applyMaterialSpecLive(mat as MeshPhysicalNodeMaterial, spec);
      }
    },
    setColorMap(url: string | null, loader: FaceTextureLoaderLike): void {
      const mat = Array.isArray(mesh.material) ? (mesh.material as { map?: Texture | null; needsUpdate: boolean }[])[0] : mesh.material as unknown as { map?: Texture | null; needsUpdate: boolean };
      if (!mat) return;
      if (!url) {
        mat.map = null;
        (mat as { needsUpdate: boolean }).needsUpdate = true;
        return;
      }
      void loader
        .loadTexture(url)
        .then((tex) => {
          (tex as { colorSpace?: string }).colorSpace = 'srgb';
          mat.map = tex;
          (mat as { needsUpdate: boolean }).needsUpdate = true;
        })
        .catch(() => { /* missing map → baseColor stands */ });
    },
    setNormalMap(url: string | null, loader: FaceTextureLoaderLike, scale = 1): void {
      const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as unknown as {
        normalMap?: Texture | null; normalScale?: { set: (x: number, y: number) => void }; needsUpdate: boolean;
      } | undefined;
      if (!mat) return;
      if (!url) { mat.normalMap = null; mat.needsUpdate = true; return; }
      void loader.loadTexture(url).then((tex) => {
        mat.normalMap = tex;
        mat.normalScale?.set(scale, scale);
        mat.needsUpdate = true;
      }).catch(() => { /* missing → flat normal */ });
    },
    setRoughnessMap(url: string | null, loader: FaceTextureLoaderLike): void {
      const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as unknown as {
        roughnessMap?: Texture | null; needsUpdate: boolean;
      } | undefined;
      if (!mat) return;
      if (!url) { mat.roughnessMap = null; mat.needsUpdate = true; return; }
      void loader.loadTexture(url).then((tex) => {
        mat.roughnessMap = tex;
        mat.needsUpdate = true;
      }).catch(() => { /* missing → scalar roughness */ });
    },
  };
}
