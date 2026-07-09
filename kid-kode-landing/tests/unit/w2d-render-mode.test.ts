// W-2D — per-hub 2d/3d render mode: schema helpers, non-destructive toggling,
// the runtime flat-composition path (SAME camera, config only), template +
// blueprint + assembler authoring, and the grammar renderModes axis.

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

import {
  FLAT_HUB_FOV,
  distanceForFovChange,
  hubCameraComposition,
  migrateHubRenderMode,
  resolveHubRenderMode,
} from '@/lib/prism-graph/hub-render-mode';
import type { GraphSource, PrismHub, PrismNode } from '@/lib/prism-graph/types';
import { mountFromGraphSource } from '@/lib/prism/runtime/mount-graph';
import type { NodeContext } from '@/lib/prism/runtime/shared/adapter';
import { templateHub } from '@/lib/templates/node-helpers';
import { ledgerMixedGraph } from '@/lib/templates/graphs/ledger-mixed';
import {
  buildDeterministicBlueprint,
  deriveHubRenderMode,
} from '@/server/conductor/blueprint';
import { assembleGraph } from '@/server/conductor/graph-assembler';
import { resolveDirection } from '@/server/conductor/directions';
import type { BuildBrief } from '@/../packages/shared-interfaces/src/prism-intake';

const framedHeight = (fovDeg: number, dist: number) =>
  2 * dist * Math.tan((fovDeg * Math.PI) / 360);

// ─── Schema helpers ───────────────────────────────────────────────────────────

describe('W-2D hub-render-mode helpers', () => {
  it('resolveHubRenderMode: absent/legacy → 3d; explicit 2d honored', () => {
    expect(resolveHubRenderMode(undefined)).toBe('3d');
    expect(resolveHubRenderMode(null)).toBe('3d');
    expect(resolveHubRenderMode({})).toBe('3d');
    expect(resolveHubRenderMode({ renderMode: '3d' })).toBe('3d');
    expect(resolveHubRenderMode({ renderMode: '2d' })).toBe('2d');
  });

  it('migrateHubRenderMode stamps 3d when absent, preserves when present', () => {
    const legacy = { hubId: 'h' } as { hubId: string; renderMode?: '3d' | '2d' };
    const migrated = migrateHubRenderMode(legacy);
    expect(migrated.renderMode).toBe('3d');
    expect(migrated).not.toBe(legacy); // pure — new object when stamping
    const flat = { hubId: 'h', renderMode: '2d' as const };
    expect(migrateHubRenderMode(flat)).toBe(flat); // identity when present
  });

  it('distanceForFovChange preserves the framed viewport height exactly', () => {
    const d2 = distanceForFovChange(50, 10, FLAT_HUB_FOV);
    expect(framedHeight(FLAT_HUB_FOV, d2)).toBeCloseTo(framedHeight(50, 10), 10);
    // Round-trip: flattening then restoring lands on the original distance.
    expect(distanceForFovChange(FLAT_HUB_FOV, d2, 50)).toBeCloseTo(10, 10);
  });

  it('hubCameraComposition: 3d = base unchanged; 2d = telephoto + compensated', () => {
    const base = { fov: 50, distance: 10 };
    expect(hubCameraComposition('3d', base)).toEqual(base);
    const flat = hubCameraComposition('2d', base);
    expect(flat.fov).toBe(FLAT_HUB_FOV);
    expect(framedHeight(flat.fov, flat.distance)).toBeCloseTo(framedHeight(50, 10), 10);
  });
});

// ─── Non-destructive toggling (the W-2D law) ─────────────────────────────────

describe('W-2D non-destructive toggle', () => {
  it('2d→3d round trip preserves every depth datum (shallow-merge semantics)', () => {
    const original: PrismHub = {
      hubId: 'h-data',
      title: 'Data',
      layout: { viewportWidth: 1280, viewportHeight: 720, contentHeight: 720, backgroundColor: '#000' },
      cameraKeyframes: [
        { coordinateSpace: 'camera', t: 0, params: { px: 0, py: 0, pz: 18, tx: 0, ty: 0, tz: 0, fov: 45 } },
      ],
    };
    const baseline = JSON.parse(JSON.stringify(original));
    // The store's updateHub is a shallow merge: { ...hub, ...patch }.
    const to2d: PrismHub = { ...original, renderMode: '2d' };
    const back: PrismHub = { ...to2d, renderMode: '3d' };
    expect(back.cameraKeyframes).toEqual(baseline.cameraKeyframes);
    const { renderMode: _rm, ...backRest } = back;
    expect(backRest).toEqual(baseline);
    expect(resolveHubRenderMode(back)).toBe('3d');
  });
});

// ─── Runtime: the flat composition path (SAME camera, config only) ──────────

function ctxStub(): NodeContext {
  return {
    THREE: THREE as unknown as NodeContext['THREE'],
    textureLoader: {
      loadTexture: async () => new THREE.Texture(),
    } as unknown as NodeContext['textureLoader'],
    glbLoader: {
      loadGLB: async () => ({ scene: new THREE.Group() }),
    } as unknown as NodeContext['glbLoader'],
    fontAtlas: {
      ready: false,
      load: async () => {},
      createText: () => new THREE.Group(),
      dispose: () => {},
    } as unknown as NodeContext['fontAtlas'],
    primitives: {} as NodeContext['primitives'],
    emit: () => {},
  };
}

function hubFor(hubId: string, renderMode?: PrismHub['renderMode']): PrismHub {
  return {
    hubId,
    title: hubId,
    ...(renderMode ? { renderMode } : {}),
    layout: { viewportWidth: 1280, viewportHeight: 720, contentHeight: 720, backgroundColor: '#04050a' },
  };
}

function nodeFor(id: string, hub: string): PrismNode {
  return {
    nodeId: id,
    subtype: 'hero',
    parentHubId: hub,
    serviceTag: 'static',
    visual: { transform: { x: 0, y: 0, z: 0, width: 100, height: 100 } },
    intent: {
      caption: '',
      behaviorSpec: { interactions: [], apiCalls: [], dataBindings: [], emits: [], listens: [], triggersDownstream: [] },
      stateEffects: [],
      visualSpec: { textContent: [], layers: [] },
      contracts: { inputs: {}, outputs: {} },
    },
    codeRef: '',
    backendRef: null,
    renderMode: 'sprite',
    depthMapUrl: null,
    meshUrl: null,
    cinematicPrimitives: [],
  } as PrismNode;
}

describe('W-2D runtime composition (mountFromGraphSource)', () => {
  const source: GraphSource = {
    hubs: [hubFor('flat', '2d'), hubFor('deep')],
    nodes: [nodeFor('n1', 'flat'), nodeFor('n2', 'deep')],
    edges: [],
  };

  it('entry into a 2d hub lands the telephoto flat composition, framing preserved', async () => {
    const result = await mountFromGraphSource(undefined, source, ctxStub(), {
      noRenderer: true,
      entryHubId: 'flat',
    });
    const cam = result.sceneRoot.camera;
    expect(cam.fov).toBeCloseTo(FLAT_HUB_FOV, 6);
    // scene-root base: fov 50 at z=10 → framed height must be identical.
    expect(framedHeight(cam.fov, cam.position.z)).toBeCloseTo(framedHeight(50, 10), 6);
    expect(cam).toBeInstanceOf(THREE.PerspectiveCamera); // SAME camera class — no ortho swap
    result.unmount();
  });

  it('activating a 3d hub restores the base composition; 2d re-flattens (same camera object)', async () => {
    const result = await mountFromGraphSource(undefined, source, ctxStub(), {
      noRenderer: true,
      entryHubId: 'flat',
    });
    const cam = result.sceneRoot.camera;
    const flatFov = cam.fov;
    result.hubManager.activate('deep'); // wrapped manager applies composition (snap: no renderer)
    expect(result.sceneRoot.camera).toBe(cam); // one continuous camera
    expect(cam.fov).toBeCloseTo(50, 6);
    expect(cam.position.z).toBeCloseTo(10, 6);
    result.hubManager.activate('flat');
    expect(cam.fov).toBeCloseTo(flatFov, 6);
    result.unmount();
  });

  it('applyHubComposition is exposed and idempotent for the active mode', async () => {
    const result = await mountFromGraphSource(undefined, source, ctxStub(), {
      noRenderer: true,
      entryHubId: 'deep',
    });
    const cam = result.sceneRoot.camera;
    expect(cam.fov).toBeCloseTo(50, 6);
    result.applyHubComposition('flat', false);
    expect(cam.fov).toBeCloseTo(FLAT_HUB_FOV, 6);
    result.applyHubComposition('flat', false); // no-op second apply
    expect(cam.fov).toBeCloseTo(FLAT_HUB_FOV, 6);
    result.unmount();
  });
});

// ─── Templates + demo fixture ────────────────────────────────────────────────

describe('W-2D templates + mixed-app fixture', () => {
  it('templateHub passes renderMode through; absent stays absent (→ 3d)', () => {
    const flat = templateHub({ hubId: 'f', title: 'F', caption: '', backgroundColor: '#000', renderMode: '2d' });
    expect(flat.renderMode).toBe('2d');
    const legacy = templateHub({ hubId: 'l', title: 'L', caption: '', backgroundColor: '#000' });
    expect(legacy.renderMode).toBeUndefined();
    expect(resolveHubRenderMode(legacy)).toBe('3d');
  });

  it('ledger-mixed: 3d landing + 2d data hub; flat content at z=0; 3D accent present', () => {
    const byId = new Map(ledgerMixedGraph.hubs.map((h) => [h.hubId, h]));
    expect(resolveHubRenderMode(byId.get('landing'))).toBe('3d');
    expect(resolveHubRenderMode(byId.get('ledger'))).toBe('2d');
    const ledgerNodes = ledgerMixedGraph.nodes.filter((n) => n.parentHubId === 'ledger');
    expect(ledgerNodes.length).toBeGreaterThanOrEqual(10);
    // Flat page: everything authored at z=0 except the deliberate 3D accent.
    for (const n of ledgerNodes) {
      if (n.nodeId === 'ledger-accent-gyre') continue;
      expect(n.scenePosition?.z ?? 0, n.nodeId).toBe(0);
    }
    const accent = ledgerNodes.find((n) => n.nodeId === 'ledger-accent-gyre');
    expect(accent?.renderMode).toBe('mesh'); // real lit geometry layered into the 2d hub
    // The landing hub keeps genuine depth staging.
    const landingZ = ledgerMixedGraph.nodes
      .filter((n) => n.parentHubId === 'landing')
      .map((n) => n.scenePosition?.z ?? 0);
    expect(landingZ.some((z) => z !== 0)).toBe(true);
  });
});

// ─── Conductor: blueprint + assembler read the mode ──────────────────────────

function fixtureBrief(sections: string): BuildBrief {
  return {
    v: 1,
    title: 'Meridian Ops',
    prompt: 'An internal operations tool with a marketing front page and a data-heavy ledger.',
    brandProfile: {
      v: 1,
      name: 'Meridian Ops',
      palette: { primary: '#16161d', secondary: '#e8ecf2', accent: '#ff2a38' },
      toneDescriptors: ['precise', 'technical'],
    },
    chosenDirectionId: 'atelier-noir',
    lines: [
      { id: 'l-summary', key: 'summary', label: 'Summary', value: 'Ops tool with a landing page and a ledger.' },
      { id: 'l-archetype', key: 'archetype', label: 'Archetype', value: 'dashboard tool' },
      { id: 'l-sections', key: 'sections', label: 'Sections', value: sections },
    ],
    integrations: [],
    deployTarget: 'prism-cloud',
    seedsUsed: [{ kind: 'prompt', detail: 'W-2D test brief' }],
    answers: [],
    branchCount: 0,
    fastPath: false,
  };
}

describe('W-2D conductor planning + assembly', () => {
  it('deriveHubRenderMode: data-heavy titles plan flat; showcase titles stay 3d', () => {
    for (const t of ['Data', 'Ledger', 'Dashboard', 'Docs', 'Admin', 'Reports', 'Inventory']) {
      expect(deriveHubRenderMode(t), t).toBe('2d');
    }
    for (const t of ['Features', 'Showcase', 'Collection', 'Pricing', 'About']) {
      expect(deriveHubRenderMode(t), t).toBe('3d');
    }
  });

  it('blueprint tags the data section 2d; assembler stamps the hub + flattens its nodes', () => {
    const brief = fixtureBrief('Overview, Ledger, Pricing');
    const direction = resolveDirection(brief);
    const blueprint = buildDeterministicBlueprint(brief, direction);

    const ledgerBp = blueprint.hubs.find((h) => h.title === 'Ledger');
    expect(ledgerBp?.renderMode).toBe('2d');
    const home = blueprint.hubs.find((h) => h.hubId === 'hub-home');
    expect(home?.renderMode).toBeUndefined(); // landing stays 3d

    const assembled = assembleGraph(blueprint, direction, 1_700_000_000_000);
    const ledgerHub = assembled.graph.hubs.find((h) => h.title === 'Ledger');
    expect(ledgerHub?.renderMode).toBe('2d');
    const otherHubs = assembled.graph.hubs.filter((h) => h.title !== 'Ledger');
    for (const h of otherHubs) expect(h.renderMode, h.hubId).toBeUndefined();

    // 2d hub nodes are authored FLAT (z/tilt zeroed at the source)…
    const ledgerNodes = assembled.graph.nodes.filter((n) => n.parentHubId === ledgerHub!.hubId);
    expect(ledgerNodes.length).toBeGreaterThan(0);
    for (const n of ledgerNodes) {
      expect(n.scenePosition?.z ?? 0, n.nodeId).toBe(0);
      expect(n.scenePosition?.rotationX ?? 0, n.nodeId).toBe(0);
      expect(n.scenePosition?.rotationY ?? 0, n.nodeId).toBe(0);
    }
    // …while the 3d home hub keeps its depth staging (hero z, CTA z).
    const homeNodes = assembled.graph.nodes.filter((n) => n.parentHubId === 'hub-home');
    expect(homeNodes.some((n) => (n.scenePosition?.z ?? 0) !== 0)).toBe(true);
  });
});
