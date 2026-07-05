// P4 3D-OBJECT (canvas-spec §5 3D object tools) — Task A: meshPrimitive
// RENDERING + node builder + live param reshaping.
//
//   - buildPrimitiveGeometry: one real three geometry per kind; params
//     resolved over MESH_PRIMITIVE_DEFAULTS; degenerate dims fall back to the
//     kind's defaults; tessellation clamped (3..96 curved, 1..96 flat —
//     cube/plane default to 1 subdivision and stay exact there).
//   - defaultRenderModeFactory mesh branch: a node carrying meshPrimitive
//     renders the primitive SYNCHRONOUSLY — a lit, shadow-casting
//     MeshPhysicalNodeMaterial Mesh via the SAME material route as the
//     meshUrl/GLB lane (buildPhysicalMaterial + applyMaterialSpec).
//   - PRECEDENCE: a node with BOTH meshUrl AND meshPrimitive renders the
//     primitive; the GLB load is never issued.
//   - userData.meshPrimitiveHandle: setPrimitive swaps ONLY the geometry
//     (same Mesh + material identity; old geometry disposed; unchanged shape
//     no-ops); setMaterialSpec mutates the SAME material instance —
//     uniform-only writes except the documented recompile edges
//     (transparent flip / transmission–clearcoat–iridescence–dispersion
//     zero-crossings flag needsUpdate, observable as Material.version bumps).
//   - buildMeshPrimitiveNode (FROZEN seam): born-Populated 3D node accepted
//     by addNode's applyPlanRendererDefaults — renderMode 'mesh', NO meshUrl,
//     friendly 'New <Kind>' caption, distinct spawn, envelope from defaults.
//   - node-content-hash: a committed meshPrimitive change invalidates the
//     build hash (same rule as textSpec/imageSpec).

import { describe, expect, it, vi } from 'vitest';
import {
  BoxGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  applyMaterialSpecLive,
  buildPrimitiveGeometry,
  createMeshPrimitiveHandle,
  meshPrimitiveKey,
  resolveMeshPrimitiveParams,
  SEGMENTS_MAX,
  SEGMENTS_MIN_CURVED,
} from '@/lib/prism/runtime/shared/mesh-primitive';
import { defaultRenderModeFactory } from '@/lib/prism/runtime/factories/default-factory';
import { buildPhysicalMaterial } from '@/lib/prism/runtime/shared/material-system';
import {
  buildMeshPrimitiveNode,
  meshPrimitiveEnvelope,
  objectNodeCaption,
  OBJECT_SPAWN_POSITION,
} from '@/components/editor/object-tools/create-object-node';
import { applyPlanRendererDefaults } from '@/lib/prism/codegen/plan-output-hook';
import { isStage0Bubble } from '@/components/editor/add-tools/create-element-node';
import { computeNodeContentHash } from '@/lib/editor/node-content-hash';
import {
  MESH_PRIMITIVE_DEFAULTS,
  type MeshPrimitiveKind,
  type PrismNode,
} from '@/lib/prism-graph/types';
import type { NodeContext } from '@/lib/prism/runtime/shared/adapter';
import type { MeshPrimitiveHandle } from '@/lib/prism/runtime/shared/mesh-primitive';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal PrismNode (mirrors tests/editor-build/P3-image-spec fixture). */
function makeNode(overrides: Partial<PrismNode>): PrismNode {
  return {
    nodeId: 'obj-1',
    subtype: 'cube',
    parentHubId: 'home',
    serviceTag: 'main',
    visual: {
      transform: { x: 0, y: 0, z: 0, width: 0.6, height: 0.6 },
    },
    intent: {
      caption: 'New Cube',
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
    renderMode: 'mesh',
    depthMapUrl: null,
    meshUrl: null,
    cinematicPrimitives: [],
    meshPrimitive: { kind: 'cube' },
    ...overrides,
  } as PrismNode;
}

function makeCtx(): { ctx: NodeContext; loadGLB: ReturnType<typeof vi.fn> } {
  const loadGLB = vi.fn(async () => ({ scene: new Group() }));
  const ctx = {
    textureLoader: { loadTexture: async () => { throw new Error('unused'); } },
    glbLoader: { loadGLB },
    fontAtlas: {
      ready: true,
      load: async () => {},
      createText: () => new Group(),
      dispose: () => {},
    },
    primitives: {},
    emit: () => {},
  } as unknown as NodeContext;
  return { ctx, loadGLB };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

function primitiveMeshOf(group: ReturnType<typeof defaultRenderModeFactory>): Mesh {
  const mesh = group.children.find((c) => c instanceof Mesh) as Mesh | undefined;
  expect(mesh, 'factory must mount the primitive Mesh synchronously').toBeDefined();
  return mesh as Mesh;
}

// ---------------------------------------------------------------------------
// buildPrimitiveGeometry — one geometry per kind
// ---------------------------------------------------------------------------

describe('buildPrimitiveGeometry (per kind)', () => {
  const cases: Array<[MeshPrimitiveKind, unknown]> = [
    ['cube', BoxGeometry],
    ['sphere', SphereGeometry],
    ['plane', PlaneGeometry],
    ['cylinder', CylinderGeometry],
    ['cone', ConeGeometry],
    ['torus', TorusGeometry],
    ['capsule', CapsuleGeometry],
  ];
  it.each(cases)("'%s' builds the matching three geometry", (kind, ctor) => {
    const geo = buildPrimitiveGeometry({ kind });
    expect(geo).toBeInstanceOf(ctor as new () => object);
    geo.dispose();
  });

  it('default params come from MESH_PRIMITIVE_DEFAULTS (cube dims, sphere radius)', () => {
    const cube = buildPrimitiveGeometry({ kind: 'cube' }) as BoxGeometry;
    expect(cube.parameters.width).toBe(MESH_PRIMITIVE_DEFAULTS.cube.width);
    expect(cube.parameters.height).toBe(MESH_PRIMITIVE_DEFAULTS.cube.height);
    expect(cube.parameters.depth).toBe(MESH_PRIMITIVE_DEFAULTS.cube.depth);

    const sphere = buildPrimitiveGeometry({ kind: 'sphere' }) as SphereGeometry;
    expect(sphere.parameters.radius).toBe(MESH_PRIMITIVE_DEFAULTS.sphere.radius);
    expect(sphere.parameters.widthSegments).toBe(MESH_PRIMITIVE_DEFAULTS.sphere.segments);

    const torus = buildPrimitiveGeometry({ kind: 'torus' }) as TorusGeometry;
    expect(torus.parameters.radius).toBe(MESH_PRIMITIVE_DEFAULTS.torus.radius);
    expect(torus.parameters.tube).toBe(MESH_PRIMITIVE_DEFAULTS.torus.tube);

    const capsule = buildPrimitiveGeometry({ kind: 'capsule' }) as CapsuleGeometry;
    expect(capsule.parameters.radius).toBe(MESH_PRIMITIVE_DEFAULTS.capsule.radius);
    // three names the capsule mid-section `height`; our param is `length`.
    expect(capsule.parameters.height).toBe(MESH_PRIMITIVE_DEFAULTS.capsule.length);
    cube.dispose(); sphere.dispose(); torus.dispose(); capsule.dispose();
  });

  it('explicit params override defaults (cylinder radius/height land in the geometry)', () => {
    const geo = buildPrimitiveGeometry({
      kind: 'cylinder',
      params: { radius: 0.5, height: 1.2, segments: 12 },
    }) as CylinderGeometry;
    expect(geo.parameters.radiusTop).toBe(0.5);
    expect(geo.parameters.radiusBottom).toBe(0.5);
    expect(geo.parameters.height).toBe(1.2);
    expect(geo.parameters.radialSegments).toBe(12);
    geo.dispose();
  });

  it(`clamps tessellation: curved kinds to ${SEGMENTS_MIN_CURVED}..${SEGMENTS_MAX}`, () => {
    const wild = resolveMeshPrimitiveParams({ kind: 'sphere', params: { segments: 5000 } });
    expect(wild.segments).toBe(SEGMENTS_MAX);
    const broken = resolveMeshPrimitiveParams({ kind: 'sphere', params: { segments: 1 } });
    expect(broken.segments).toBe(SEGMENTS_MIN_CURVED);
    // Fractional writes round to an integer subdivision count.
    const frac = resolveMeshPrimitiveParams({ kind: 'cone', params: { segments: 24.6 } });
    expect(frac.segments).toBe(25);
  });

  it('flat kinds keep their exact default of 1 subdivision (not force-tessellated)', () => {
    expect(resolveMeshPrimitiveParams({ kind: 'cube' }).segments).toBe(1);
    expect(resolveMeshPrimitiveParams({ kind: 'plane' }).segments).toBe(1);
    expect(resolveMeshPrimitiveParams({ kind: 'plane', params: { segments: 500 } }).segments)
      .toBe(SEGMENTS_MAX);
  });

  it('degenerate dims (zero / negative / NaN) fall back to the kind defaults', () => {
    const r = resolveMeshPrimitiveParams({
      kind: 'cube',
      params: { width: 0, height: -2, depth: Number.NaN },
    });
    expect(r.width).toBe(MESH_PRIMITIVE_DEFAULTS.cube.width);
    expect(r.height).toBe(MESH_PRIMITIVE_DEFAULTS.cube.height);
    expect(r.depth).toBe(MESH_PRIMITIVE_DEFAULTS.cube.depth);
  });
});

// ---------------------------------------------------------------------------
// Factory mesh branch — lit shadow-casting physical-material Mesh
// ---------------------------------------------------------------------------

describe('defaultRenderModeFactory meshPrimitive branch', () => {
  it('builds the primitive synchronously: physical node material, LIT, casts + receives shadows', () => {
    const { ctx } = makeCtx();
    const group = defaultRenderModeFactory(makeNode({}), ctx);
    const mesh = primitiveMeshOf(group);
    expect(mesh.geometry).toBeInstanceOf(BoxGeometry);
    expect(mesh.material).toBeInstanceOf(MeshPhysicalNodeMaterial);
    // §10 decision 7 — meshes are LIT by default (no explicit receivesLighting).
    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
    expect(group.userData.nodeId).toBe('obj-1');
    expect(group.userData.meshPrimitiveHandle).toBeDefined();
  });

  it('routes node.materialSpec through the physical material (same lane as the GLB path)', () => {
    const { ctx } = makeCtx();
    const node = makeNode({
      materialSpec: { baseColor: '#ff0000', metalness: 0.8, roughness: 0.2 },
    });
    const mesh = primitiveMeshOf(defaultRenderModeFactory(node, ctx));
    const mat = mesh.material as MeshPhysicalNodeMaterial;
    expect(mat.color.getHexString()).toBe('ff0000');
    expect(mat.metalness).toBe(0.8);
    expect(mat.roughness).toBe(0.2);
  });

  it('explicit receivesLighting: false opts the primitive out of shadow casting', () => {
    const { ctx } = makeCtx();
    const mesh = primitiveMeshOf(
      defaultRenderModeFactory(makeNode({ receivesLighting: false }), ctx),
    );
    expect(mesh.castShadow).toBe(false);
    expect(mesh.receiveShadow).toBe(false);
  });

  it('PRECEDENCE: a node with BOTH meshUrl AND meshPrimitive renders the primitive — no GLB load', async () => {
    const { ctx, loadGLB } = makeCtx();
    const node = makeNode({ meshUrl: '/models/legacy.glb' });
    const group = defaultRenderModeFactory(node, ctx);
    await tick();
    const mesh = primitiveMeshOf(group);
    expect(mesh.geometry).toBeInstanceOf(BoxGeometry);
    expect(loadGLB).not.toHaveBeenCalled();
  });

  it('a meshUrl-only node still takes the GLB lane (the primitive branch never hijacks it)', async () => {
    const { ctx, loadGLB } = makeCtx();
    const node = makeNode({ meshPrimitive: undefined, meshUrl: '/models/real.glb' });
    const group = defaultRenderModeFactory(node, ctx);
    await tick();
    expect(loadGLB).toHaveBeenCalledWith('/models/real.glb');
    expect(group.userData.meshPrimitiveHandle).toBeUndefined();
  });

  it('cleanup() disposes the CURRENT geometry and the material (post-swap safe)', () => {
    const { ctx } = makeCtx();
    const group = defaultRenderModeFactory(makeNode({}), ctx);
    const mesh = primitiveMeshOf(group);
    const handle = group.userData.meshPrimitiveHandle as MeshPrimitiveHandle;
    handle.setPrimitive({ kind: 'sphere' }); // initial Box already disposed here
    const current = mesh.geometry;
    const geoDispose = vi.spyOn(current, 'dispose');
    const matDispose = vi.spyOn(mesh.material as MeshPhysicalNodeMaterial, 'dispose');

    (group.userData.cleanup as () => void)();

    expect(geoDispose).toHaveBeenCalled();
    expect(matDispose).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Live handle — setPrimitive / setMaterialSpec
// ---------------------------------------------------------------------------

describe('meshPrimitiveHandle.setPrimitive (in-place geometry swap)', () => {
  it('swaps geometry on the SAME Mesh with the SAME material; old geometry disposed', () => {
    const { ctx } = makeCtx();
    const group = defaultRenderModeFactory(makeNode({}), ctx);
    const mesh = primitiveMeshOf(group);
    const matBefore = mesh.material;
    const oldGeo = mesh.geometry;
    const oldDispose = vi.spyOn(oldGeo, 'dispose');
    const handle = group.userData.meshPrimitiveHandle as MeshPrimitiveHandle;

    handle.setPrimitive({ kind: 'sphere', params: { radius: 0.5 } });

    expect(group.children.find((c) => c instanceof Mesh)).toBe(mesh); // same Mesh
    expect(mesh.material).toBe(matBefore); // same material instance
    expect(mesh.geometry).toBeInstanceOf(SphereGeometry);
    expect((mesh.geometry as SphereGeometry).parameters.radius).toBe(0.5);
    expect(oldDispose).toHaveBeenCalled();
  });

  it('dimension edits land instantly (same kind, new params → new geometry)', () => {
    const mesh = new Mesh(
      buildPrimitiveGeometry({ kind: 'cube' }),
      buildPhysicalMaterial(null),
    );
    const handle = createMeshPrimitiveHandle(mesh, { kind: 'cube' });
    handle.setPrimitive({ kind: 'cube', params: { width: 1.5 } });
    expect((mesh.geometry as BoxGeometry).parameters.width).toBe(1.5);
    // Unspecified dims still resolve to the kind defaults.
    expect((mesh.geometry as BoxGeometry).parameters.height)
      .toBe(MESH_PRIMITIVE_DEFAULTS.cube.height);
  });

  it('no-ops on an unchanged shape (geometry identity stable — no churn per effect pass)', () => {
    const mesh = new Mesh(
      buildPrimitiveGeometry({ kind: 'torus' }),
      buildPhysicalMaterial(null),
    );
    const handle = createMeshPrimitiveHandle(mesh, { kind: 'torus' });
    const geoBefore = mesh.geometry;
    handle.setPrimitive({ kind: 'torus' }); // same resolved shape
    expect(mesh.geometry).toBe(geoBefore);
    // Same resolved params spelled explicitly are still the same shape.
    handle.setPrimitive({ kind: 'torus', params: { ...MESH_PRIMITIVE_DEFAULTS.torus } });
    expect(mesh.geometry).toBe(geoBefore);
    expect(meshPrimitiveKey({ kind: 'torus' }))
      .toBe(meshPrimitiveKey({ kind: 'torus', params: { ...MESH_PRIMITIVE_DEFAULTS.torus } }));
  });
});

describe('meshPrimitiveHandle.setMaterialSpec (live material editing)', () => {
  it('mutates the SAME material instance — roughness/metalness/color land', () => {
    const { ctx } = makeCtx();
    const group = defaultRenderModeFactory(makeNode({}), ctx);
    const mesh = primitiveMeshOf(group);
    const mat = mesh.material as MeshPhysicalNodeMaterial;
    const handle = group.userData.meshPrimitiveHandle as MeshPrimitiveHandle;

    handle.setMaterialSpec({ baseColor: '#00ff00', metalness: 1, roughness: 0.05 });

    expect(mesh.material).toBe(mat); // SAME instance — never a swap
    expect(mat.color.getHexString()).toBe('00ff00');
    expect(mat.metalness).toBe(1);
    expect(mat.roughness).toBe(0.05);
  });

  it('scalar edits inside the same shader-lobe set are uniform writes (no needsUpdate)', () => {
    const mat = buildPhysicalMaterial(null);
    const before = mat.version;
    applyMaterialSpecLive(mat, { metalness: 0.7, roughness: 0.3, baseColor: '#112233' });
    expect(mat.version).toBe(before); // pure uniform writes — no recompile
  });

  it('zero-crossings that change the compiled program flag needsUpdate (version bump)', () => {
    const mat = buildPhysicalMaterial(null);
    const v0 = mat.version;
    // transmission 0 → 0.5: useTransmission flips AND transparent flips.
    applyMaterialSpecLive(mat, { transmission: 0.5 });
    expect(mat.version).toBeGreaterThan(v0);
    const v1 = mat.version;
    // Moving WITHIN the transmission lobe: uniform write only.
    applyMaterialSpecLive(mat, { transmission: 0.8 });
    expect(mat.version).toBe(v1);
    // clearcoat 0 → 0.6 (transmission back to 0 also flips): recompile edge.
    applyMaterialSpecLive(mat, { clearcoat: 0.6 });
    expect(mat.version).toBeGreaterThan(v1);
  });
});

// ---------------------------------------------------------------------------
// buildMeshPrimitiveNode — the FROZEN cross-agent seam
// ---------------------------------------------------------------------------

describe('buildMeshPrimitiveNode (frozen seam)', () => {
  it('born-Populated 3D node: renderMode mesh, meshPrimitive {kind}, NO meshUrl', () => {
    const input = buildMeshPrimitiveNode({ parentHubId: 'home', kind: 'sphere' });
    expect(input.parentHubId).toBe('home');
    expect(input.renderMode).toBe('mesh');
    expect(input.meshPrimitive).toEqual({ kind: 'sphere' });
    expect(input.meshUrl).toBeUndefined();
    expect(input.codeRef).toBe('');
    expect(input.backendRef).toBeNull();
    expect(input.subtype).toBe('sphere');
  });

  it("plain-language caption: 'New <Kind>' (no machine ids, no jargon)", () => {
    expect(buildMeshPrimitiveNode({ parentHubId: 'home', kind: 'cube' }).intent?.caption)
      .toBe('New Cube');
    expect(objectNodeCaption('torus')).toBe('New Torus');
    expect(objectNodeCaption('capsule')).toBe('New Capsule');
  });

  it('spawns at (0.9, -0.2, 0.2) — distinct from the text/bubble/image spawn slots', () => {
    const sp = buildMeshPrimitiveNode({ parentHubId: 'home', kind: 'cone' }).scenePosition!;
    expect([sp.x, sp.y, sp.z]).toEqual([0.9, -0.2, 0.2]);
    expect(sp).toEqual(OBJECT_SPAWN_POSITION);
    expect(sp).not.toBe(OBJECT_SPAWN_POSITION); // fresh copy per node
  });

  it("visual envelope derives from the kind's default dims", () => {
    const cube = buildMeshPrimitiveNode({ parentHubId: 'home', kind: 'cube' });
    expect(cube.visual?.transform?.width).toBe(MESH_PRIMITIVE_DEFAULTS.cube.width);
    expect(cube.visual?.transform?.height).toBe(MESH_PRIMITIVE_DEFAULTS.cube.height);

    const sphere = meshPrimitiveEnvelope('sphere');
    expect(sphere.width).toBeCloseTo(MESH_PRIMITIVE_DEFAULTS.sphere.radius * 2);

    const torus = meshPrimitiveEnvelope('torus');
    expect(torus.width).toBeCloseTo(
      (MESH_PRIMITIVE_DEFAULTS.torus.radius + MESH_PRIMITIVE_DEFAULTS.torus.tube) * 2,
    );

    const capsule = meshPrimitiveEnvelope('capsule');
    expect(capsule.height).toBeCloseTo(
      MESH_PRIMITIVE_DEFAULTS.capsule.length + MESH_PRIMITIVE_DEFAULTS.capsule.radius * 2,
    );
  });

  it("is accepted by addNode's normalizer: defaults fill, meshPrimitive survives, mesh is LIT", () => {
    const input = buildMeshPrimitiveNode({ parentHubId: 'home', kind: 'cylinder' });
    const seeded = applyPlanRendererDefaults({ ...input, nodeId: 'n-test' });
    expect(seeded.renderMode).toBe('mesh');
    expect(seeded.meshUrl).toBeNull(); // normalized, never a GLB ref
    expect(seeded.meshPrimitive).toEqual({ kind: 'cylinder' });
    expect(seeded.receivesLighting).toBe(true); // §10 decision 7: meshes LIT
    expect(seeded.cinematicPrimitives).toEqual([]);
    expect(seeded.scenePosition.x).toBe(0.9);
  });

  it('is born Populated — never a Stage-0 bubble', () => {
    const input = buildMeshPrimitiveNode({ parentHubId: 'home', kind: 'cube' });
    const seeded = applyPlanRendererDefaults({ ...input, nodeId: 'n-test' });
    expect(isStage0Bubble(seeded as PrismNode)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Content-hash projection
// ---------------------------------------------------------------------------

describe('node-content-hash meshPrimitive projection', () => {
  it('a committed meshPrimitive change invalidates the build hash (deterministically)', () => {
    const base = computeNodeContentHash(makeNode({ meshPrimitive: undefined }));
    const cube = computeNodeContentHash(makeNode({}));
    const cube2 = computeNodeContentHash(makeNode({}));
    const sphere = computeNodeContentHash(makeNode({ meshPrimitive: { kind: 'sphere' } }));
    const fatCube = computeNodeContentHash(
      makeNode({ meshPrimitive: { kind: 'cube', params: { width: 1.5 } } }),
    );
    expect(cube).not.toBe(base); // adding the primitive rebuilds
    expect(sphere).not.toBe(cube); // kind change rebuilds
    expect(fatCube).not.toBe(cube); // param change rebuilds
    expect(cube2).toBe(cube); // deterministic across runs
  });
});
