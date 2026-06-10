// P2-add-element — Add-Element bubble (canvas-spec §6 state 1; P2 Task C).
//
// Spec refs:
//   - Canvas-spec §6: "Bubble — a translucent liquid sphere (3D,
//     MeshPhysicalMaterial transmission). Draggable. Only Add Object enabled.
//     Not yet rendered as a UI element in Canvas/Preview."
//   - §6 rule: "Adding a node in Canvas MUST create a graph node tethered to
//     the current hub (INV-7)."
//
// Covers:
//   1. buildBubbleElementNode output is accepted by useGraphSourceStore.addNode
//      and lands as a Stage-0 node: NO artifact data (codeRef '', backendRef
//      null, no visual.sourceAsset, no meshUrl), tethered to the hub, with
//      scenePosition set to the bubble spawn point.
//   2. The bubble spawn point differs from the Add Text spawn point (the two
//      fresh-node flows never stack).
//   3. buildBubbleArtifact returns a Group whose sphere Mesh carries a
//      MeshPhysicalMaterial with transmission > 0.8 (the §6 liquid look),
//      plus the createNode-contract userData (nodeId, cleanup).
//   4. isStage0Bubble keys ONLY on artifact-less non-text nodes.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Group, Mesh, MeshPhysicalMaterial } from 'three';
import type { PrismHub, PrismNode } from '@/lib/prism-graph/types';
import {
  BUBBLE_CAPTION_DEFAULT,
  BUBBLE_RADIUS,
  BUBBLE_SPAWN_POSITION,
  buildBubbleArtifact,
  buildBubbleElementNode,
  isStage0Bubble,
} from '@/components/editor/add-tools/create-element-node';
import { buildTextNode } from '@/lib/prism/text/create-text-node';

type StoreState = {
  hubs: PrismHub[];
  nodes: PrismNode[];
  edges: unknown[];
  ready: boolean;
  error: string | null;
  isDirty: boolean;
  addNode: (input: Partial<PrismNode> & { parentHubId: string }) => string;
};

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_WINDOW = (globalThis as { window?: unknown }).window;

function makeHub(hubId: string, title: string): PrismHub {
  return {
    hubId,
    title,
    layout: {
      viewportWidth: 1440,
      viewportHeight: 900,
      contentHeight: 900,
      backgroundColor: '#101218',
    },
  };
}

// Same fresh-store harness as EBR2-F-02: suppress the store's eager
// live-graph fetch and give it a window so the browser-only init path is the
// one exercised.
async function freshStore(): Promise<{
  useGraphSourceStore: {
    getState: () => StoreState;
    setState: (p: Partial<StoreState>) => void;
  };
}> {
  vi.resetModules();
  globalThis.fetch = vi.fn(async () => {
    throw new Error('eager-init fetch suppressed in P2-add-element unit test');
  }) as unknown as typeof fetch;
  (globalThis as { window?: unknown }).window = globalThis as unknown as Window;
  const mod = await import('@/stores/useGraphSourceStore');
  return mod as unknown as {
    useGraphSourceStore: {
      getState: () => StoreState;
      setState: (p: Partial<StoreState>) => void;
    };
  };
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  if (ORIGINAL_FETCH === undefined) {
    delete (globalThis as { fetch?: unknown }).fetch;
  } else {
    globalThis.fetch = ORIGINAL_FETCH;
  }
  if (ORIGINAL_WINDOW === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window?: unknown }).window = ORIGINAL_WINDOW;
  }
});

describe('P2 Task C — buildBubbleElementNode → addNode (canvas-spec §6 stage 1)', () => {
  it('addNode accepts the bubble shape: Stage-0, tethered, scenePosition set', async () => {
    const { useGraphSourceStore } = await freshStore();
    useGraphSourceStore.setState({
      hubs: [makeHub('home', 'Home')],
      nodes: [],
      edges: [],
      ready: true,
      error: null,
      isDirty: false,
    });

    const id = useGraphSourceStore
      .getState()
      .addNode(buildBubbleElementNode({ parentHubId: 'home' }));

    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);

    const node = useGraphSourceStore.getState().nodes.find((n) => n.nodeId === id);
    expect(node).toBeDefined();
    if (!node) throw new Error('bubble node missing');

    // INV-7 — tethered to the current hub.
    expect(node.parentHubId).toBe('home');

    // Stage-0: NO artifact data of any kind.
    expect(node.codeRef).toBe('');
    expect(node.backendRef).toBeNull();
    expect(node.visual?.sourceAsset).toBeUndefined();
    expect(node.meshUrl ?? null).toBeNull();

    // Minimal Stage-0 conventions (mirrors create-text-node / AddNodeDialog).
    expect(node.subtype).toBe('element');
    expect(node.serviceTag).toBe('main');
    expect(node.intent.caption).toBe(BUBBLE_CAPTION_DEFAULT);
    expect(node.intent.visualSpec.textContent).toEqual([]);

    // scenePosition set to the bubble spawn point (plan-defaults preserved it).
    expect(node.scenePosition).toMatchObject({
      x: BUBBLE_SPAWN_POSITION.x,
      y: BUBBLE_SPAWN_POSITION.y,
      z: BUBBLE_SPAWN_POSITION.z,
    });

    // The store flags the edit for autosave.
    expect(useGraphSourceStore.getState().isDirty).toBe(true);

    // And the created node IS a Stage-0 bubble for the scene path.
    expect(isStage0Bubble(node)).toBe(true);
  });

  it('bubble spawn point differs from the Add Text spawn point', () => {
    const bubble = buildBubbleElementNode({ parentHubId: 'home' });
    const text = buildTextNode({ parentHubId: 'home' });

    expect(bubble.scenePosition).toBeDefined();
    expect(text.scenePosition).toBeDefined();
    const b = bubble.scenePosition!;
    const t = text.scenePosition!;

    // Not the same point — a fresh bubble and a fresh text block never stack.
    expect([b.x, b.y, b.z]).not.toEqual([t.x, t.y, t.z]);
    // Specifically offset on x (text spawns lower-center at x=0).
    expect(b.x).not.toBe(t.x);
    expect(b.x).toBeCloseTo(0.9, 5);
  });
});

describe('P2 Task C — buildBubbleArtifact (§6 translucent liquid sphere)', () => {
  it('returns a Group with one sphere Mesh in MeshPhysicalMaterial, transmission > 0.8', () => {
    const obj = buildBubbleArtifact('node-test-1');

    expect(obj).toBeInstanceOf(Group);
    expect(obj.name).toBe('node:node-test-1');
    // Never the tagged failure stand-in.
    expect(obj.name.endsWith(':fallback')).toBe(false);
    expect(obj.userData.nodeId).toBe('node-test-1');
    expect(obj.userData.stage0Bubble).toBe(true);

    const meshes: Mesh[] = [];
    obj.traverse((c) => {
      if ((c as Mesh).isMesh) meshes.push(c as Mesh);
    });
    // Exactly one raycast-hittable Mesh (verifyBuiltNode would count it
    // renderable; R3F raycasting hits it for selection).
    expect(meshes).toHaveLength(1);

    const mat = meshes[0].material as MeshPhysicalMaterial;
    expect(mat).toBeInstanceOf(MeshPhysicalMaterial);
    expect(mat.transmission).toBeGreaterThan(0.8);
    expect(mat.roughness).toBeLessThanOrEqual(0.1);
    expect(mat.ior).toBeCloseTo(1.4, 5);
    expect(mat.clearcoat).toBeGreaterThan(0);
    expect(mat.transparent).toBe(true);

    // Radius matches the §6 bubble scale contract (~0.28).
    const geo = meshes[0].geometry as { parameters?: { radius?: number } };
    expect(geo.parameters?.radius).toBeCloseTo(BUBBLE_RADIUS, 5);
  });

  it('carries a userData.cleanup that disposes geometry + material (INV-14)', () => {
    const obj = buildBubbleArtifact('node-test-2');
    const cleanup = obj.userData.cleanup as (() => void) | undefined;
    expect(typeof cleanup).toBe('function');
    expect(() => cleanup!()).not.toThrow();
  });
});

describe('P2 Task C — isStage0Bubble predicate', () => {
  function baseNode(patch: Partial<PrismNode> = {}): PrismNode {
    return {
      nodeId: 'n1',
      subtype: 'element',
      parentHubId: 'home',
      serviceTag: 'main',
      visual: { transform: { x: 0, y: 0, z: 0, width: 1, height: 1 } },
      intent: {
        caption: 'x',
        behaviorSpec: {
          interactions: [],
          apiCalls: [],
          dataBindings: [],
          emits: [],
          listens: [],
          triggersDownstream: [],
        },
        stateEffects: [],
        visualSpec: { textContent: [], layers: [] },
        contracts: { inputs: {}, outputs: {} },
      },
      codeRef: '',
      backendRef: null,
      ...patch,
    } as PrismNode;
  }

  it('true for an artifact-less non-text node', () => {
    expect(isStage0Bubble(baseNode())).toBe(true);
  });

  it('false once the node carries artifact data or is a text node', () => {
    expect(
      isStage0Bubble(
        baseNode({
          visual: {
            sourceAsset: '/x.avif',
            transform: { x: 0, y: 0, z: 0, width: 1, height: 1 },
          },
        }),
      ),
    ).toBe(false);
    expect(isStage0Bubble(baseNode({ meshUrl: '/m.glb' }))).toBe(false);
    expect(isStage0Bubble(baseNode({ codeRef: 'nodes/foo.js' }))).toBe(false);
    expect(isStage0Bubble(baseNode({ renderMode: 'text' }))).toBe(false);
  });

  it('false for legacy §13 runtime-label nodes (they keep the factory path)', () => {
    const node = baseNode();
    node.intent.visualSpec.textContent = [
      { text: 'Label', role: 'label', renderMethod: 'msdf' },
    ];
    expect(isStage0Bubble(node)).toBe(false);
  });
});
