// image-spec.ts — P3 IMAGE/MEDIA (canvas-spec §5 Image tools, INV-8 additive).
//
// The per-node `ImageSpec` presentation layer for image-bearing render modes
// (sprite / plane / parallax-plane): how the source texture sits in its plane.
// The artifact itself stays `visual.sourceAsset`; this module NEVER re-renders
// or re-encodes the texture — everything is UV-window math, a TSL corner mask,
// and a material-opacity multiply, applied in place on the mounted Mesh.
//
// Mechanisms (investigated 2026-06-10, P3 Task A):
//
//   FIT + CROP — the texture transform (`tex.repeat` / `tex.offset`) on a
//   PER-NODE texture instance. The loader cache shares Texture objects across
//   nodes (Amendment 0002 §A.2), so the cache texture is cloned ONCE per mesh
//   before any mutation; the clone shares the GPU image via `Texture.source`
//   (renderer uploads are source-keyed + refcounted — cheap) and is reused
//   across spec updates. Both material lanes respect the texture matrix:
//   classic materials via the standard uv-transform path, node materials via
//   `MaterialNode.getTexture('map')` (a default-uv TextureNode, which calls
//   `setUpdateMatrix(true)` — three/src/nodes/accessors/TextureNode.js:173).
//
//   'cover'   — repeat shrinks the (cropped) window along one axis so the
//               visible region matches the plane aspect; offset centers it.
//   'contain' — the full (cropped) window maps to the plane and the PLANE's
//               Mesh is letterbox-scaled to the image aspect within the node's
//               authored envelope (`visual.transform` width/height baked into
//               PlaneGeometry — the least invasive correct mechanism: the
//               factory group, selection ring, and gizmo all key off the
//               authored envelope, while the mesh scale only narrows the
//               drawn rect; nothing else reads mesh.scale on image planes).
//   'fill'    — the (cropped) window stretches over the plane (repeat=crop).
//
//   CORNER RADIUS — a rounded-rect SDF mask multiplied into the material's
//   `opacityNode` (pattern: src/lib/prism/text/msdf-material.ts — clamp(-sd/aa
//   + 0.5) with aa = fwidth(sd), ~1px screen-space AA edge). Radius + plane
//   dims are TSL *uniforms*, so radius edits are uniform writes (no shader
//   recompile, same material identity). The mask only exists on node
//   materials; a plain (legacy) material that first needs a radius > 0 is
//   upgraded IN PLACE to its node-material twin. This is safe: per the P1
//   findings (see default-factory.ts text-branch note) both call paths that
//   pass `nodeMaterials:false` — the editor (ArtifactNode → GraphScene's
//   createUnifiedRenderer) and the runtime player (mount-graph →
//   createSceneRoot) — render exclusively through `WebGPURenderer` from
//   three/webgpu, whose WebGL2 *backend* fallback still compiles TSL node
//   materials. No classic-WebGL call path exists, so the upgrade can never
//   crash a WebGL context.
//
//   OPACITY — `material.opacity` multiply (image-plane materials are already
//   transparent:true; the node-material mask multiplies `materialOpacity`, so
//   opacity stays a live property write on both lanes).
//
// DOM-free; relative imports only (runtime dep-guard).

import {
  ClampToEdgeWrapping,
  Vector2,
  type Material,
  type Mesh,
  type MeshBasicMaterial,
  type MeshStandardMaterial,
  type PlaneGeometry,
  type Texture,
} from 'three';
import {
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  type Node,
} from 'three/webgpu';
import {
  clamp,
  float,
  fwidth,
  materialOpacity,
  max,
  min,
  select,
  uniform,
  uv,
  vec2,
} from 'three/tsl';
import {
  IMAGE_SPEC_DEFAULT,
  type ImageCrop,
  type ImageSpec,
  type PrismNode,
} from '../../../prism-graph/types';

// ---------------------------------------------------------------------------
// Resolution (defaults applied)
// ---------------------------------------------------------------------------

/** Fully-resolved ImageSpec: every field defined, crop normalized + clamped. */
export interface ResolvedImageSpec {
  fit: 'cover' | 'contain' | 'fill';
  crop: Required<ImageCrop>;
  cornerRadius: number;
  opacity: number;
}

const MIN_CROP = 1e-4;

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

/** Resolve a (possibly partial / absent) spec over IMAGE_SPEC_DEFAULT. The
 *  crop window is normalized so it always stays inside the texture and never
 *  collapses to zero area. */
export function resolveImageSpecValues(spec?: ImageSpec | null): ResolvedImageSpec {
  const merged = { ...IMAGE_SPEC_DEFAULT, ...(spec ?? {}) };
  const rawCrop = merged.crop ?? {};
  const x = clamp01(rawCrop.x ?? 0);
  const y = clamp01(rawCrop.y ?? 0);
  const width = Math.max(MIN_CROP, Math.min(1 - x, rawCrop.width ?? 1 - x));
  const height = Math.max(MIN_CROP, Math.min(1 - y, rawCrop.height ?? 1 - y));
  return {
    fit: merged.fit ?? 'cover',
    crop: { x, y, width, height },
    cornerRadius: clamp01(merged.cornerRadius ?? 0),
    opacity: clamp01(merged.opacity ?? 1),
  };
}

/** FROZEN SEAM — resolve a node's imageSpec with defaults applied. */
export function resolveImageSpec(node: PrismNode): ResolvedImageSpec {
  return resolveImageSpecValues(node.imageSpec ?? null);
}

// ---------------------------------------------------------------------------
// UV-window math (exported for unit tests)
// ---------------------------------------------------------------------------

/** The computed texture-transform window + letterbox scale for one apply. */
export interface UvWindow {
  /** `tex.repeat` (u, v). */
  repeat: [number, number];
  /** `tex.offset` (u, v). */
  offset: [number, number];
  /** Mesh letterbox scale (x, y) — identity except for 'contain'. */
  scale: [number, number];
}

/** Pure fit/crop math. `flipY` mirrors `Texture.flipY` (TextureLoader default
 *  true): crop x/y are authored as a TOP-LEFT-origin window over the source
 *  image (frozen contract), while UV v runs bottom-up when flipY is set. */
export function computeUvWindow(
  resolved: ResolvedImageSpec,
  texWidth: number,
  texHeight: number,
  planeWidth: number,
  planeHeight: number,
  flipY = true,
): UvWindow {
  const c = resolved.crop;
  const croppedAspect = (texWidth * c.width) / (texHeight * c.height);
  const planeAspect = planeWidth / planeHeight;

  let repU = c.width;
  let repV = c.height;
  let offU = c.x;
  // Window bottom edge in UV space (v runs bottom-up when flipY).
  let offV = flipY ? 1 - c.y - c.height : c.y;
  let scaleX = 1;
  let scaleY = 1;

  if (resolved.fit === 'cover') {
    if (croppedAspect > planeAspect) {
      // Image (window) relatively wider — crop horizontally, centered.
      const visW = c.width * (planeAspect / croppedAspect);
      offU = c.x + (c.width - visW) / 2;
      repU = visW;
    } else if (croppedAspect < planeAspect) {
      // Image (window) relatively taller — crop vertically, centered.
      const visH = c.height * (croppedAspect / planeAspect);
      offV = offV + (c.height - visH) / 2;
      repV = visH;
    }
  } else if (resolved.fit === 'contain') {
    // Full window shown; the PLANE letterboxes to the image aspect.
    if (croppedAspect > planeAspect) {
      scaleY = planeAspect / croppedAspect;
    } else if (croppedAspect < planeAspect) {
      scaleX = croppedAspect / planeAspect;
    }
  }
  // 'fill' — window stretches over the plane (repeat = crop) — base values.

  return { repeat: [repU, repV], offset: [offU, offV], scale: [scaleX, scaleY] };
}

const IDENTITY_EPS = 1e-6;

/** True when a window leaves the texture transform untouched (repeat 1,1 /
 *  offset 0,0). A null/absent window (no spec applied yet) is identity. The
 *  letterbox scale is NOT part of identity — it lives on the mesh, not the
 *  texture matrix, so an explicit-uv TSL sample still renders it correctly. */
export function isIdentityUvWindow(window: UvWindow | null | undefined): boolean {
  if (!window) return true;
  return (
    Math.abs(window.repeat[0] - 1) < IDENTITY_EPS &&
    Math.abs(window.repeat[1] - 1) < IDENTITY_EPS &&
    Math.abs(window.offset[0]) < IDENTITY_EPS &&
    Math.abs(window.offset[1]) < IDENTITY_EPS
  );
}

// ---------------------------------------------------------------------------
// Per-mesh state
// ---------------------------------------------------------------------------

interface ImageSpecMeshState {
  /** The loader-cache texture this mesh's clone was made from (NEVER mutated,
   *  NEVER disposed here — Amendment 0002 §A.2). */
  sourceTexture: Texture | null;
  /** The per-node clone (node-owned: repeat/offset/wrap live here). */
  texture: Texture | null;
  /** Last computed window (parallax colorNode gating reads this). */
  window: UvWindow | null;
}

const STATE_KEY = '__imageSpecState';

function getMeshState(mesh: Mesh): ImageSpecMeshState {
  const userData = mesh.userData as Record<string, unknown>;
  let state = userData[STATE_KEY] as ImageSpecMeshState | undefined;
  if (!state) {
    state = { sourceTexture: null, texture: null, window: null };
    userData[STATE_KEY] = state;
  }
  return state;
}

/** The per-node texture clone currently driving this mesh (null before the
 *  first apply / before the source texture resolves). */
export function readImageSpecTexture(mesh: Mesh): Texture | null {
  const state = (mesh.userData as Record<string, unknown>)[STATE_KEY] as
    | ImageSpecMeshState
    | undefined;
  return state?.texture ?? null;
}

/** The last applied UV window (null = identity / nothing applied). */
export function readImageSpecWindow(mesh: Mesh): UvWindow | null {
  const state = (mesh.userData as Record<string, unknown>)[STATE_KEY] as
    | ImageSpecMeshState
    | undefined;
  return state?.window ?? null;
}

/** Dispose the node-owned texture clone (NEVER the loader-cache source —
 *  GPU uploads are source-keyed + refcounted, so this only releases this
 *  node's handle) and clear the per-mesh state. Factory cleanup calls this. */
export function disposeImageSpec(mesh: Mesh): void {
  const userData = mesh.userData as Record<string, unknown>;
  const state = userData[STATE_KEY] as ImageSpecMeshState | undefined;
  if (!state) return;
  if (state.texture) {
    try {
      state.texture.dispose();
    } catch {
      /* best effort */
    }
  }
  delete userData[STATE_KEY];
}

// ---------------------------------------------------------------------------
// Corner-radius mask (TSL, node materials only)
// ---------------------------------------------------------------------------

interface CornerMaskState {
  /** Plane-unit corner radius (fraction already multiplied out). */
  radius: { value: number };
  /** Effective plane dims (authored envelope × letterbox scale). */
  dims: { value: Vector2 };
}

const MASK_KEY = '__imageSpecMask';

type NodeMaterialLike = Material & {
  isNodeMaterial?: boolean;
  opacityNode?: unknown;
  map?: Texture | null;
};

function isNodeMaterial(mat: Material): mat is NodeMaterialLike {
  return (mat as NodeMaterialLike).isNodeMaterial === true;
}

/** Build the rounded-rect SDF opacity mask ONCE per material. Radius + dims
 *  are uniforms, so later spec edits never recompile the shader. With the
 *  radius uniform at 0 the `select` collapses to a constant 1 — the default
 *  square plane keeps its exact legacy coverage (no edge feather). */
function buildCornerMask(mat: NodeMaterialLike): CornerMaskState {
  const radiusU = uniform(0);
  const dimsU = uniform(new Vector2(1, 1));

  // Work in (letterbox-scaled) plane units, centered: p ∈ ±dims/2.
  const p = uv().sub(vec2(0.5, 0.5)).mul(dimsU);
  // Rounded-rect SDF: q = |p| - (half - r); sd = |max(q,0)| + min(max(q.x,q.y),0) - r.
  const q = p.abs().sub(dimsU.mul(0.5).sub(radiusU));
  const sd = q
    .max(0.0)
    .length()
    .add(min(max(q.x, q.y), float(0)))
    .sub(radiusU);
  // ~1px screen-space AA edge via fwidth (msdf-material.ts pattern).
  const aa = max(fwidth(sd), float(1e-4));
  const coverage = clamp(sd.negate().div(aa).add(0.5), 0, 1);
  const mask = select(radiusU.greaterThan(float(0)), coverage, float(1));

  // materialOpacity = the live mat.opacity (typed re-pin per msdf-material.ts).
  const liveOpacity = materialOpacity as unknown as Node<'float'>;
  mat.opacityNode = mask.mul(liveOpacity);
  mat.needsUpdate = true;

  const state: CornerMaskState = {
    radius: radiusU as unknown as { value: number },
    dims: dimsU as unknown as { value: Vector2 },
  };
  (mat.userData as Record<string, unknown>)[MASK_KEY] = state;
  return state;
}

function readCornerMask(mat: Material): CornerMaskState | null {
  return ((mat.userData as Record<string, unknown>)[MASK_KEY] as CornerMaskState) ?? null;
}

/** Upgrade a legacy plain material to its node-material twin IN PLACE on the
 *  mesh (see module header: every call path renders via WebGPURenderer, so
 *  this can never crash a classic-WebGL context). Properties the factory's
 *  image-plane branches set are carried over; the replaced material is
 *  disposed (its texture is NOT — materials never own textures). */
function upgradeToNodeMaterial(mesh: Mesh): NodeMaterialLike {
  const old = mesh.material as MeshBasicMaterial | MeshStandardMaterial;
  const standard = (old as MeshStandardMaterial).isMeshStandardMaterial === true;
  const next = standard ? new MeshStandardNodeMaterial() : new MeshBasicNodeMaterial();
  next.transparent = old.transparent;
  next.opacity = old.opacity;
  next.toneMapped = old.toneMapped;
  next.side = old.side;
  next.depthWrite = old.depthWrite;
  next.color.copy(old.color);
  next.map = old.map ?? null;
  if (standard) {
    const oldStd = old as MeshStandardMaterial;
    const nextStd = next as MeshStandardNodeMaterial;
    nextStd.displacementMap = oldStd.displacementMap;
    nextStd.displacementScale = oldStd.displacementScale;
    nextStd.displacementBias = oldStd.displacementBias;
    nextStd.roughness = oldStd.roughness;
    nextStd.metalness = oldStd.metalness;
  }
  mesh.material = next;
  try {
    old.dispose();
  } catch {
    /* best effort */
  }
  return next as NodeMaterialLike;
}

// ---------------------------------------------------------------------------
// applyImageSpec — FROZEN SEAM
// ---------------------------------------------------------------------------

function planeDims(mesh: Mesh): { width: number; height: number } {
  const params = (mesh.geometry as PlaneGeometry).parameters as
    | { width?: number; height?: number }
    | undefined;
  return {
    width: params?.width && params.width > 0 ? params.width : 1,
    height: params?.height && params.height > 0 ? params.height : 1,
  };
}

/**
 * Apply an ImageSpec to a mounted image-plane Mesh, idempotently and in
 * place. Never re-renders the texture:
 *
 *   - fit/crop  → repeat/offset on the per-node texture clone (+ letterbox
 *                 mesh scale for 'contain');
 *   - radius    → TSL rounded-rect opacityNode mask, uniform-driven (node
 *                 materials; a plain material upgrades in place the first
 *                 time a radius > 0 arrives);
 *   - opacity   → `material.opacity` multiply.
 *
 * Re-calling with the same spec is a no-op-equivalent (same Mesh, same
 * material, same clone). fit/crop/opacity changes never change material
 * identity; only the FIRST radius > 0 on a legacy plain material swaps the
 * material (documented upgrade above).
 *
 * `opts.nodeMaterials` mirrors the factory flag for symmetry/diagnostics —
 * the actual lane is detected from the live material (the factory may have
 * built either kind), so the apply is always honest about what is mounted.
 */
export function applyImageSpec(
  mesh: Mesh,
  spec: ImageSpec,
  opts: { nodeMaterials?: boolean } = {},
): void {
  void opts; // lane detection is live (see doc comment); flag kept for the frozen seam.
  const resolved = resolveImageSpecValues(spec);
  const state = getMeshState(mesh);

  // 1. Radius needs the TSL mask → ensure a node material first so the rest
  //    of the apply targets the final material instance.
  let mat = mesh.material as Material;
  if (resolved.cornerRadius > 0 && !isNodeMaterial(mat)) {
    mat = upgradeToNodeMaterial(mesh);
  }
  const matWithMap = mat as Material & { map?: Texture | null; needsUpdate: boolean };

  // 2. Per-node texture clone (Amendment 0002 §A.2 — the shared cache Texture
  //    is never mutated). Re-clone iff the material carries a texture we do
  //    not own (first apply, or the factory resolved/replaced the source).
  const current = matWithMap.map ?? null;
  if (current && current !== state.texture) {
    if (current !== state.sourceTexture) {
      if (state.texture) {
        try {
          state.texture.dispose();
        } catch {
          /* best effort */
        }
      }
      const clone = current.clone();
      // clone() copies userData by reference in three — give the clone its
      // own object so tagging it can never leak onto the cache texture.
      clone.userData = { __imageSpecClone: true };
      clone.wrapS = ClampToEdgeWrapping;
      clone.wrapT = ClampToEdgeWrapping;
      // The clone shares `source` with the original; needsUpdate registers it
      // with the (source-keyed, refcounted) renderer cache — no re-upload.
      clone.needsUpdate = true;
      state.sourceTexture = current;
      state.texture = clone;
    }
    if (state.texture) {
      matWithMap.map = state.texture;
      matWithMap.needsUpdate = true;
    }
  }

  // 3. FIT + CROP — texture-transform window + letterbox scale. Needs the
  //    image's native dims; before the source resolves this is skipped (the
  //    factory re-applies when the texture lands).
  const { width: planeW, height: planeH } = planeDims(mesh);
  const tex = state.texture;
  const img = tex?.image as { width?: number; height?: number } | undefined;
  if (tex && img && img.width && img.height) {
    const window = computeUvWindow(
      resolved,
      img.width,
      img.height,
      planeW,
      planeH,
      tex.flipY !== false,
    );
    tex.repeat.set(window.repeat[0], window.repeat[1]);
    tex.offset.set(window.offset[0], window.offset[1]);
    // matrixAutoUpdate is true by default — the renderer recomposes the
    // matrix per frame; no needsUpdate (that would re-register the upload).
    mesh.scale.set(window.scale[0], window.scale[1], mesh.scale.z || 1);
    state.window = window;
  }

  // 4. CORNER RADIUS — uniform-driven mask, node materials only. Built once;
  //    radius back to 0 keeps the material and just zeroes the uniform.
  if (isNodeMaterial(mat)) {
    let mask = readCornerMask(mat);
    if (!mask && resolved.cornerRadius > 0) {
      mask = buildCornerMask(mat as NodeMaterialLike);
    }
    if (mask) {
      const effW = planeW * (mesh.scale.x || 1);
      const effH = planeH * (mesh.scale.y || 1);
      mask.dims.value.set(effW, effH);
      mask.radius.value = resolved.cornerRadius * (Math.min(effW, effH) / 2);
    }
  }

  // 5. OPACITY — live property multiply (image planes are transparent:true
  //    from the factory; keep that guaranteed when fading).
  mat.opacity = resolved.opacity;
  if (resolved.opacity < 1) mat.transparent = true;
}
