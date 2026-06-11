// P3 IMAGE/MEDIA (canvas-spec §5 Image tools) — Task A: imageSpec RENDERING.
//
//   - resolveImageSpec / resolveImageSpecValues: defaults applied, crop
//     normalized + clamped.
//   - computeUvWindow: cover/contain/fill repeat-offset math incl. crop
//     windows and the flipY v-origin flip.
//   - applyImageSpec: per-node texture CLONE (the loader-cache shared Texture
//     is never mutated — Amendment 0002 §A.2); clone reused across spec
//     updates; setSpec idempotent + in-place (same Mesh/material identity for
//     fit/opacity changes); 'contain' letterboxes the MESH scale.
//   - Corner-radius mask only on the TSL path: built on node materials,
//     uniform-driven (no material swap on radius edits); a plain legacy
//     material upgrades IN PLACE to its node-material twin the first time a
//     radius > 0 arrives (safe — both factory call paths render via
//     WebGPURenderer, see default-factory.ts renderer note).
//   - defaultRenderModeFactory wiring: group.userData.imageHandle.setSpec
//     restyles in place; default nodes (no imageSpec) keep the untouched
//     shared cache texture byte-identical to before; cleanup disposes the
//     node-owned clone but NEVER the loader-cache texture; the parallax
//     displacement colorNode is mounted only while the fit/crop window is
//     identity (explicit-uv TSL samples bypass the texture matrix).

import { describe, expect, it, vi } from 'vitest';
import {
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Texture,
} from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  applyImageSpec,
  computeUvWindow,
  disposeImageSpec,
  isIdentityUvWindow,
  readImageSpecTexture,
  readImageSpecWindow,
  resolveImageSpec,
  resolveImageSpecValues,
} from '@/lib/prism/runtime/shared/image-spec';
import { defaultRenderModeFactory } from '@/lib/prism/runtime/factories/default-factory';
import { IMAGE_SPEC_DEFAULT, type ImageSpec, type PrismNode } from '@/lib/prism-graph/types';
import { computeNodeContentHash } from '@/lib/editor/node-content-hash';
import type { NodeContext } from '@/lib/prism/runtime/shared/adapter';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTex(width: number, height: number): Texture {
  const t = new Texture();
  (t as unknown as { image: { width: number; height: number } }).image = { width, height };
  return t;
}

function makeMesh(
  material: MeshBasicMaterial | MeshBasicNodeMaterial,
  planeW = 1,
  planeH = 1,
): Mesh {
  return new Mesh(new PlaneGeometry(planeW, planeH), material);
}

/** Minimal PrismNode (mirrors tests/integration/default-factory fixture). */
function makeNode(overrides: Partial<PrismNode>): PrismNode {
  return {
    nodeId: 'img-1',
    subtype: 'hero',
    parentHubId: 'home',
    serviceTag: 'static',
    visual: {
      transform: { x: 0, y: 0, z: 0, width: 1, height: 1 },
      sourceAsset: '/img/hero.png',
    },
    intent: {
      caption: '',
      behaviorSpec: {
        interactions: [], apiCalls: [], dataBindings: [], emits: [], listens: [],
        triggersDownstream: [],
      },
      stateEffects: [],
      visualSpec: { textContent: [], layers: [] },
      contracts: { inputs: {}, outputs: {} },
    },
    codeRef: '',
    backendRef: null,
    renderMode: 'plane',
    depthMapUrl: null,
    meshUrl: null,
    cinematicPrimitives: [],
    ...overrides,
  } as PrismNode;
}

/** Ctx whose textureLoader resolves dimensioned stub textures (the SAME
 *  Texture per URL — mirrors the loader cache's shared-instance semantics). */
function makeCtx(dims: Record<string, [number, number]> = {}): {
  ctx: NodeContext;
  served: Map<string, Texture>;
} {
  const served = new Map<string, Texture>();
  const ctx = {
    textureLoader: {
      loadTexture: async (url: string) => {
        let t = served.get(url);
        if (!t) {
          const [w, h] = dims[url] ?? [1000, 500];
          t = makeTex(w, h);
          served.set(url, t);
        }
        return t;
      },
    },
    glbLoader: { loadGLB: async () => ({ scene: new Group() }) },
    fontAtlas: {
      ready: true,
      load: async () => {},
      createText: () => new Group(),
      dispose: () => {},
    },
    primitives: {},
    emit: () => {},
  } as unknown as NodeContext;
  return { ctx, served };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

type MaskState = { radius: { value: number }; dims: { value: { x: number; y: number } } };
function maskOf(mesh: Mesh): MaskState | undefined {
  return (mesh.material as Mesh['material'] & { userData: Record<string, unknown> }).userData
    .__imageSpecMask as MaskState | undefined;
}
function opacityNodeOf(mesh: Mesh): unknown {
  return (mesh.material as unknown as { opacityNode?: unknown }).opacityNode;
}
function isNodeMat(mesh: Mesh): boolean {
  return (mesh.material as unknown as { isNodeMaterial?: boolean }).isNodeMaterial === true;
}

// ---------------------------------------------------------------------------
// resolveImageSpec
// ---------------------------------------------------------------------------

describe('resolveImageSpec / resolveImageSpecValues', () => {
  it('applies IMAGE_SPEC_DEFAULT for an absent spec', () => {
    const r = resolveImageSpec(makeNode({}));
    expect(r.fit).toBe('cover');
    expect(r.cornerRadius).toBe(0);
    expect(r.opacity).toBe(1);
    expect(r.crop).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it('merges a partial spec over the defaults', () => {
    const r = resolveImageSpecValues({ fit: 'contain', opacity: 0.4 });
    expect(r.fit).toBe('contain');
    expect(r.opacity).toBe(0.4);
    expect(r.cornerRadius).toBe(0);
  });

  it('clamps radius/opacity to 0..1 and keeps the crop window inside the texture', () => {
    const r = resolveImageSpecValues({
      cornerRadius: 2,
      opacity: -1,
      crop: { x: 0.5, y: 0.8, width: 0.9, height: 0.9 },
    });
    expect(r.cornerRadius).toBe(1);
    expect(r.opacity).toBe(0);
    expect(r.crop.x).toBe(0.5);
    expect(r.crop.width).toBeCloseTo(0.5); // clamped to 1 - x
    expect(r.crop.height).toBeCloseTo(0.2); // clamped to 1 - y
  });

  it('a crop window can never collapse to zero area', () => {
    const r = resolveImageSpecValues({ crop: { width: 0, height: -3 } });
    expect(r.crop.width).toBeGreaterThan(0);
    expect(r.crop.height).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// computeUvWindow — fit/crop math
// ---------------------------------------------------------------------------

describe('computeUvWindow', () => {
  const resolved = (spec: ImageSpec) => resolveImageSpecValues(spec);

  it("'fill' with no crop is the identity window", () => {
    const w = computeUvWindow(resolved({ fit: 'fill' }), 1000, 500, 1, 1);
    expect(w.repeat).toEqual([1, 1]);
    expect(w.offset).toEqual([0, 0]);
    expect(w.scale).toEqual([1, 1]);
    expect(isIdentityUvWindow(w)).toBe(true);
  });

  it("'cover' crops a wide texture horizontally, centered", () => {
    // 2:1 texture on a 1:1 plane → half the width visible, centered.
    const w = computeUvWindow(resolved({ fit: 'cover' }), 1000, 500, 1, 1);
    expect(w.repeat[0]).toBeCloseTo(0.5);
    expect(w.repeat[1]).toBeCloseTo(1);
    expect(w.offset[0]).toBeCloseTo(0.25);
    expect(w.offset[1]).toBeCloseTo(0);
    expect(w.scale).toEqual([1, 1]);
    expect(isIdentityUvWindow(w)).toBe(false);
  });

  it("'cover' crops a tall texture vertically, centered", () => {
    const w = computeUvWindow(resolved({ fit: 'cover' }), 500, 1000, 1, 1);
    expect(w.repeat[0]).toBeCloseTo(1);
    expect(w.repeat[1]).toBeCloseTo(0.5);
    expect(w.offset[0]).toBeCloseTo(0);
    expect(w.offset[1]).toBeCloseTo(0.25);
  });

  it("'cover' with matched aspect is identity", () => {
    const w = computeUvWindow(resolved({ fit: 'cover' }), 800, 400, 2, 1);
    expect(isIdentityUvWindow(w)).toBe(true);
  });

  it("'contain' letterboxes via the mesh scale, never the texture matrix", () => {
    const wide = computeUvWindow(resolved({ fit: 'contain' }), 1000, 500, 1, 1);
    expect(wide.repeat).toEqual([1, 1]);
    expect(wide.offset).toEqual([0, 0]);
    expect(wide.scale[0]).toBeCloseTo(1);
    expect(wide.scale[1]).toBeCloseTo(0.5);
    // contain's scale is NOT texture-matrix state → still an identity window.
    expect(isIdentityUvWindow(wide)).toBe(true);

    const tall = computeUvWindow(resolved({ fit: 'contain' }), 500, 1000, 1, 1);
    expect(tall.scale[0]).toBeCloseTo(0.5);
    expect(tall.scale[1]).toBeCloseTo(1);
  });

  it("'fill' + crop maps the crop window over the plane (flipY v-origin)", () => {
    const spec = resolved({ fit: 'fill', crop: { x: 0.25, y: 0.1, width: 0.5, height: 0.5 } });
    const flipped = computeUvWindow(spec, 1000, 1000, 1, 1, true);
    expect(flipped.repeat).toEqual([0.5, 0.5]);
    expect(flipped.offset[0]).toBeCloseTo(0.25);
    expect(flipped.offset[1]).toBeCloseTo(0.4); // 1 - y - height (top-left-origin crop)
    const unflipped = computeUvWindow(spec, 1000, 1000, 1, 1, false);
    expect(unflipped.offset[1]).toBeCloseTo(0.1);
  });

  it("'cover' + crop re-crops WITHIN the crop window, centered", () => {
    // Left half of a square texture (window aspect 0.5) on a 2:1 plane →
    // cover crops the window vertically to a quarter of the texture height.
    const spec = resolved({ fit: 'cover', crop: { x: 0, y: 0, width: 0.5, height: 1 } });
    const w = computeUvWindow(spec, 1000, 1000, 2, 1);
    expect(w.repeat[0]).toBeCloseTo(0.5);
    expect(w.repeat[1]).toBeCloseTo(0.25);
    expect(w.offset[0]).toBeCloseTo(0);
    expect(w.offset[1]).toBeCloseTo(0.375); // window bottom 0 + (1 - 0.25) / 2
  });

  it('isIdentityUvWindow treats a missing window as identity', () => {
    expect(isIdentityUvWindow(null)).toBe(true);
    expect(isIdentityUvWindow(undefined)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applyImageSpec — clone identity + in-place semantics
// ---------------------------------------------------------------------------

describe('applyImageSpec (texture clone discipline)', () => {
  it('clones the shared cache texture per node — the cache Texture is NEVER mutated', () => {
    const cacheTex = makeTex(1000, 500);
    const mat = new MeshBasicMaterial({ transparent: true });
    mat.map = cacheTex;
    const mesh = makeMesh(mat);

    applyImageSpec(mesh, { fit: 'cover' });

    const clone = mat.map as Texture;
    expect(clone).not.toBe(cacheTex);
    expect(readImageSpecTexture(mesh)).toBe(clone);
    // The cache texture keeps its untouched defaults.
    expect(cacheTex.repeat.toArray()).toEqual([1, 1]);
    expect(cacheTex.offset.toArray()).toEqual([0, 0]);
    expect(cacheTex.userData).toEqual({});
    // The clone carries the cover window (and shares the GPU image).
    expect(clone.repeat.x).toBeCloseTo(0.5);
    expect(clone.offset.x).toBeCloseTo(0.25);
    expect(clone.image).toBe(cacheTex.image);
  });

  it('reuses the SAME clone + material across spec updates (fit/opacity in place)', () => {
    const cacheTex = makeTex(1000, 500);
    const mat = new MeshBasicMaterial({ transparent: true });
    mat.map = cacheTex;
    const mesh = makeMesh(mat);

    applyImageSpec(mesh, { fit: 'cover' });
    const clone = mat.map as Texture;

    applyImageSpec(mesh, { fit: 'fill', opacity: 0.5 });
    expect(mesh.material).toBe(mat); // same material identity
    expect(mat.map).toBe(clone); // same clone identity
    expect(clone.repeat.toArray()).toEqual([1, 1]);
    expect(mat.opacity).toBe(0.5);

    // Idempotent: re-applying the same spec changes nothing.
    applyImageSpec(mesh, { fit: 'fill', opacity: 0.5 });
    expect(mesh.material).toBe(mat);
    expect(mat.map).toBe(clone);
    expect(mat.opacity).toBe(0.5);
  });

  it("'contain' letterboxes the MESH scale and 'cover' restores it", () => {
    const mat = new MeshBasicMaterial({ transparent: true });
    mat.map = makeTex(1000, 500);
    const mesh = makeMesh(mat);

    applyImageSpec(mesh, { fit: 'contain' });
    expect(mesh.scale.x).toBeCloseTo(1);
    expect(mesh.scale.y).toBeCloseTo(0.5);
    expect(mesh.scale.z).toBe(1);
    expect(readImageSpecWindow(mesh)?.repeat).toEqual([1, 1]);

    applyImageSpec(mesh, { fit: 'cover' });
    expect(mesh.scale.y).toBeCloseTo(1);
  });

  it('skips the window while the texture has no dims, applies opacity anyway', () => {
    const mat = new MeshBasicMaterial({ transparent: true });
    const mesh = makeMesh(mat); // no map at all yet
    applyImageSpec(mesh, { fit: 'cover', opacity: 0.25 });
    expect(mat.opacity).toBe(0.25);
    expect(readImageSpecWindow(mesh)).toBeNull();
  });

  it('disposeImageSpec releases the clone but never the cache texture', () => {
    const cacheTex = makeTex(1000, 500);
    const cacheDispose = vi.spyOn(cacheTex, 'dispose');
    const mat = new MeshBasicMaterial({ transparent: true });
    mat.map = cacheTex;
    const mesh = makeMesh(mat);
    applyImageSpec(mesh, { fit: 'cover' });
    const clone = mat.map as Texture;
    const cloneDispose = vi.spyOn(clone, 'dispose');

    disposeImageSpec(mesh);

    expect(cloneDispose).toHaveBeenCalled();
    expect(cacheDispose).not.toHaveBeenCalled();
    expect(readImageSpecTexture(mesh)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// applyImageSpec — corner-radius mask (TSL path only)
// ---------------------------------------------------------------------------

describe('applyImageSpec (corner-radius mask)', () => {
  it('builds the uniform-driven opacityNode mask on a node material', () => {
    const mat = new MeshBasicNodeMaterial();
    mat.transparent = true;
    mat.map = makeTex(800, 800);
    const mesh = makeMesh(mat);

    applyImageSpec(mesh, { cornerRadius: 0.5 });

    expect(mesh.material).toBe(mat); // mask never swaps a node material
    expect(opacityNodeOf(mesh)).toBeTruthy();
    const mask = maskOf(mesh)!;
    expect(mask).toBeDefined();
    // radius fraction × half-min-dimension of the (1×1) plane.
    expect(mask.radius.value).toBeCloseTo(0.25);
    expect(mask.dims.value.x).toBeCloseTo(1);
    expect(mask.dims.value.y).toBeCloseTo(1);
  });

  it('radius edits are uniform writes — material identity is stable, 0 disables', () => {
    const mat = new MeshBasicNodeMaterial();
    mat.map = makeTex(800, 800);
    const mesh = makeMesh(mat);
    applyImageSpec(mesh, { cornerRadius: 0.5 });
    const opacityNode = opacityNodeOf(mesh);

    applyImageSpec(mesh, { cornerRadius: 0 });
    expect(mesh.material).toBe(mat);
    expect(opacityNodeOf(mesh)).toBe(opacityNode); // same compiled node graph
    expect(maskOf(mesh)!.radius.value).toBe(0); // select() collapses to 1

    applyImageSpec(mesh, { cornerRadius: 1 });
    expect(maskOf(mesh)!.radius.value).toBeCloseTo(0.5);
  });

  it('plain material + radius 0 stays plain — NO mask off the TSL path', () => {
    const mat = new MeshBasicMaterial({ transparent: true });
    mat.map = makeTex(800, 800);
    const mesh = makeMesh(mat);
    applyImageSpec(mesh, { fit: 'cover', cornerRadius: 0 });
    expect(mesh.material).toBe(mat);
    expect(isNodeMat(mesh)).toBe(false);
    expect(opacityNodeOf(mesh)).toBeUndefined();
  });

  it('plain material + radius > 0 upgrades IN PLACE to the node-material twin', () => {
    const mat = new MeshBasicMaterial({ transparent: true, opacity: 0.8 });
    mat.map = makeTex(800, 800);
    const mesh = makeMesh(mat);

    applyImageSpec(mesh, { cornerRadius: 0.4 });

    expect(mesh.material).not.toBe(mat);
    expect(isNodeMat(mesh)).toBe(true);
    expect(opacityNodeOf(mesh)).toBeTruthy();
    const next = mesh.material as MeshBasicNodeMaterial;
    expect(next.transparent).toBe(true); // factory-set props carried over
    expect(next.map).toBe(readImageSpecTexture(mesh)); // the clone rides along
    // Further fit/opacity edits keep the upgraded material stable.
    applyImageSpec(mesh, { cornerRadius: 0.4, fit: 'contain', opacity: 0.5 });
    expect(mesh.material).toBe(next);
  });

  it('mask dims/radius track the letterboxed (effective) plane under contain', () => {
    const mat = new MeshBasicNodeMaterial();
    mat.map = makeTex(1000, 500); // 2:1 image in a 1:1 plane → eff dims 1×0.5
    const mesh = makeMesh(mat);
    applyImageSpec(mesh, { fit: 'contain', cornerRadius: 1 });
    const mask = maskOf(mesh)!;
    expect(mask.dims.value.x).toBeCloseTo(1);
    expect(mask.dims.value.y).toBeCloseTo(0.5);
    expect(mask.radius.value).toBeCloseTo(0.25); // 1 × min(1, 0.5)/2
  });
});

// ---------------------------------------------------------------------------
// defaultRenderModeFactory wiring (sprite/plane + parallax-plane)
// ---------------------------------------------------------------------------

describe('defaultRenderModeFactory imageSpec wiring', () => {
  it('default node (no imageSpec): shared cache texture lands untouched — no clone', async () => {
    const { ctx, served } = makeCtx({ '/img/hero.png': [1000, 500] });
    const group = defaultRenderModeFactory(makeNode({}), ctx);
    await tick();
    const mesh = group.children.find((c) => c instanceof Mesh) as Mesh;
    const mat = mesh.material as MeshBasicNodeMaterial;
    const cacheTex = served.get('/img/hero.png')!;
    expect(mat.map).toBe(cacheTex); // byte-identical legacy path
    expect(cacheTex.repeat.toArray()).toEqual([1, 1]);
    expect(readImageSpecTexture(mesh)).toBeNull();
    expect(group.userData.imageHandle).toBeDefined(); // restyle stays available
  });

  it('node WITH imageSpec: window applied to a per-node clone after the texture resolves', async () => {
    const { ctx, served } = makeCtx({ '/img/hero.png': [1000, 500] });
    const node = makeNode({ imageSpec: { fit: 'cover', opacity: 0.9 } });
    const group = defaultRenderModeFactory(node, ctx);
    await tick();
    const mesh = group.children.find((c) => c instanceof Mesh) as Mesh;
    const mat = mesh.material as MeshBasicNodeMaterial;
    const cacheTex = served.get('/img/hero.png')!;
    expect(mat.map).not.toBe(cacheTex);
    expect(cacheTex.repeat.toArray()).toEqual([1, 1]); // cache never mutated
    expect((mat.map as Texture).repeat.x).toBeCloseTo(0.5);
    expect(mat.opacity).toBeCloseTo(0.9);
  });

  it('userData.imageHandle.setSpec restyles in place (same Mesh + material identity)', async () => {
    const { ctx } = makeCtx({ '/img/hero.png': [1000, 500] });
    const group = defaultRenderModeFactory(makeNode({}), ctx);
    await tick();
    const mesh = group.children.find((c) => c instanceof Mesh) as Mesh;
    const matBefore = mesh.material;

    const handle = group.userData.imageHandle as { setSpec: (s: ImageSpec) => void };
    handle.setSpec({ ...IMAGE_SPEC_DEFAULT, fit: 'contain' });
    expect(mesh.material).toBe(matBefore);
    expect(mesh.scale.y).toBeCloseTo(0.5);
    const clone = readImageSpecTexture(mesh)!;
    expect(clone).toBeTruthy();

    handle.setSpec({ ...IMAGE_SPEC_DEFAULT, fit: 'fill', opacity: 0.6 });
    expect(mesh.material).toBe(matBefore); // fit/opacity never swap material
    expect(readImageSpecTexture(mesh)).toBe(clone); // clone reused
    expect(mesh.scale.y).toBeCloseTo(1);
    expect((mesh.material as MeshBasicNodeMaterial).opacity).toBeCloseTo(0.6);
  });

  it('cleanup() disposes the node-owned clone but NEVER the loader-cache texture', async () => {
    const { ctx, served } = makeCtx({ '/img/hero.png': [1000, 500] });
    const node = makeNode({ imageSpec: { fit: 'cover' } });
    const group = defaultRenderModeFactory(node, ctx);
    await tick();
    const mesh = group.children.find((c) => c instanceof Mesh) as Mesh;
    const cacheTex = served.get('/img/hero.png')!;
    const clone = readImageSpecTexture(mesh)!;
    const cacheDispose = vi.spyOn(cacheTex, 'dispose');
    const cloneDispose = vi.spyOn(clone, 'dispose');

    (group.userData.cleanup as () => void)();

    expect(cloneDispose).toHaveBeenCalled();
    expect(cacheDispose).not.toHaveBeenCalled();
  });

  it('parallax-plane: identity window keeps the displacement colorNode (clone-backed)', async () => {
    const { ctx } = makeCtx({
      '/img/stack.png': [1000, 500],
      '/img/stack.depth.png': [500, 250],
    });
    const node = makeNode({
      renderMode: 'parallax-plane',
      visual: { transform: { x: 0, y: 0, z: 0, width: 2, height: 1 }, sourceAsset: '/img/stack.png' },
      depthMapUrl: '/img/stack.depth.png',
      imageSpec: { fit: 'fill' }, // identity window
    });
    const group = defaultRenderModeFactory(node, ctx);
    await tick();
    const mesh = group.children.find((c) => c instanceof Mesh) as Mesh;
    const mat = mesh.material as unknown as { colorNode?: unknown; map?: Texture };
    expect(mat.colorNode).toBeTruthy();
    expect(readImageSpecTexture(mesh)).toBeTruthy();
  });

  it('parallax-plane: a non-identity fit/crop window drops the explicit-uv colorNode', async () => {
    const { ctx } = makeCtx({
      '/img/stack.png': [1000, 500],
      '/img/stack.depth.png': [500, 250],
    });
    const node = makeNode({
      renderMode: 'parallax-plane',
      visual: { transform: { x: 0, y: 0, z: 0, width: 1, height: 1 }, sourceAsset: '/img/stack.png' },
      depthMapUrl: '/img/stack.depth.png',
      imageSpec: { fit: 'cover' }, // 2:1 image on a 1:1 plane → non-identity
    });
    const group = defaultRenderModeFactory(node, ctx);
    await tick();
    const mesh = group.children.find((c) => c instanceof Mesh) as Mesh;
    const mat = mesh.material as unknown as { colorNode?: unknown; map?: Texture };
    expect(mat.colorNode ?? null).toBeNull(); // matrix-respecting .map path instead
    expect((mat.map as Texture).repeat.x).toBeCloseTo(0.5);
  });

  it('parallax-plane default (no imageSpec) keeps the legacy colorNode wiring', async () => {
    const { ctx, served } = makeCtx({
      '/img/stack.png': [1000, 500],
      '/img/stack.depth.png': [500, 250],
    });
    const node = makeNode({
      renderMode: 'parallax-plane',
      visual: { transform: { x: 0, y: 0, z: 0, width: 2, height: 1 }, sourceAsset: '/img/stack.png' },
      depthMapUrl: '/img/stack.depth.png',
    });
    const group = defaultRenderModeFactory(node, ctx);
    await tick();
    const mesh = group.children.find((c) => c instanceof Mesh) as Mesh;
    const mat = mesh.material as unknown as { colorNode?: unknown; map?: Texture };
    expect(mat.colorNode).toBeTruthy();
    expect(mat.map).toBe(served.get('/img/stack.png')); // shared cache texture untouched
  });
});

// ---------------------------------------------------------------------------
// Content-hash projection
// ---------------------------------------------------------------------------

describe('node-content-hash imageSpec projection', () => {
  it('a committed imageSpec change invalidates the build hash', () => {
    const a = computeNodeContentHash(makeNode({}));
    const b = computeNodeContentHash(makeNode({ imageSpec: { cornerRadius: 0.3 } }));
    const c = computeNodeContentHash(makeNode({ imageSpec: { cornerRadius: 0.3 } }));
    expect(a).not.toBe(b);
    expect(b).toBe(c); // deterministic
  });
});
