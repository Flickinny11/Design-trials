// Material+Lighting — a hub's `lightingSpec` and a node's `lightingSpec` both
// round-trip through the save body, and a legacy node without the new fields is
// still a legal PrismNode (INV-18, additive only).
//
// Spec refs:
//   §10 — per-hub AND per-element lighting configuration (decision 5).
//   INV-18 — additive only: no rename/delete; new fields optional.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  LightingSpec,
  PrismHub,
  PrismIntent,
  PrismNode,
} from '@/lib/prism-graph/types';
import { LIGHTING_SPEC_DEFAULT } from '@/lib/prism-graph/types';
import { applyPlanRendererDefaults } from '@/lib/prism/codegen/plan-output-hook';

type StoreState = {
  hubs: PrismHub[];
  nodes: PrismNode[];
  edges: [];
  ready: boolean;
  error: string | null;
  isDirty: boolean;
  savedAt: string | null;
  addNode: (input: Partial<PrismNode> & { parentHubId: string }) => string;
  updateNode: (nodeId: string, patch: Partial<PrismNode>) => void;
  saveToServer: () => Promise<{ ok: boolean; error?: string }>;
};

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_WINDOW = (globalThis as { window?: unknown }).window;

function emptyIntent(): PrismIntent {
  return {
    caption: 'test',
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
  };
}

const nodeLightingSpec: LightingSpec = {
  tier: 'T2',
  ambientIntensity: 0.4,
  envIntensity: 1.5,
  lights: [
    { id: 'key', type: 'directional', color: '#ffffff', intensity: 1.4, castShadow: true },
  ],
};

const hubLightingSpec: LightingSpec = {
  tier: 'auto',
  shadowSoftness: 0.8,
  envMapUrl: null,
  lights: [{ id: 'fill', type: 'hemisphere', color: '#9ec5ff', groundColor: '#202028' }],
};

const seedHub: PrismHub = {
  hubId: 'home',
  title: 'Home',
  layout: {
    viewportWidth: 1280,
    viewportHeight: 720,
    contentHeight: 720,
    backgroundColor: '#04050a',
    mockupUrl: null,
  },
  lightingSpec: hubLightingSpec,
};

async function freshStore(): Promise<{
  useGraphSourceStore: { getState: () => StoreState; setState: (p: Partial<StoreState>) => void };
}> {
  vi.resetModules();
  globalThis.fetch = vi.fn(async () => {
    throw new Error('eager-init fetch suppressed in material-lighting unit test');
  }) as unknown as typeof fetch;
  (globalThis as { window?: unknown }).window = globalThis as unknown as Window;
  const mod = await import('@/stores/useGraphSourceStore');
  return mod as unknown as {
    useGraphSourceStore: { getState: () => StoreState; setState: (p: Partial<StoreState>) => void };
  };
}

function addNode(state: StoreState, patch: Partial<PrismNode>): string {
  return state.addNode({
    parentHubId: 'home',
    subtype: 'mesh-product',
    serviceTag: 'product',
    visual: { transform: { x: 0, y: 0, z: 0, width: 1, height: 1 } } as never,
    intent: { ...emptyIntent() },
    codeRef: '',
    backendRef: null,
    ...patch,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
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

describe('lightingSpec round-trip', () => {
  it('a hub.lightingSpec and a node.lightingSpec both survive the save body', async () => {
    const { useGraphSourceStore } = await freshStore();
    useGraphSourceStore.setState({
      hubs: [seedHub],
      nodes: [],
      edges: [],
      ready: true,
      error: null,
      isDirty: false,
    });

    const id = addNode(useGraphSourceStore.getState(), { renderMode: 'mesh' });
    useGraphSourceStore.getState().updateNode(id, { lightingSpec: nodeLightingSpec });

    const captured: { body?: string } = {};
    globalThis.fetch = vi.fn(async (_url: string, init: RequestInit) => {
      captured.body = String(init.body);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;

    await vi.advanceTimersByTimeAsync(1000);

    const body = JSON.parse(captured.body!);
    // Hub spec persists on the serialized hub.
    expect(body.graph.hub.lightingSpec).toEqual(hubLightingSpec);
    // Node spec persists on the serialized node.
    const persisted = body.graph.nodes.find((n: PrismNode) => n.nodeId === id);
    expect(persisted.lightingSpec).toEqual(nodeLightingSpec);

    // JSON reload preserves both verbatim.
    const reloadedHub = JSON.parse(JSON.stringify(body.graph.hub)) as PrismHub;
    const reloadedNode = JSON.parse(JSON.stringify(persisted)) as PrismNode;
    expect(reloadedHub.lightingSpec).toEqual(hubLightingSpec);
    expect(reloadedNode.lightingSpec).toEqual(nodeLightingSpec);
  });

  it('INV-18 — a legacy node without the new fields is still a legal PrismNode', () => {
    // No receivesLighting / materialSpec / lightingSpec → all undefined, and the
    // object is assignable to PrismNode (compile-time guarantee via the typed var).
    const legacy: PrismNode = {
      nodeId: 'legacy-1',
      subtype: 'caption',
      parentHubId: 'home',
      serviceTag: 'ui-text',
      visual: { transform: { x: 0, y: 0, z: 0, width: 1, height: 1 } } as never,
      intent: { ...emptyIntent() } as never,
      codeRef: '',
      backendRef: null,
    };
    expect(legacy.receivesLighting).toBeUndefined();
    expect(legacy.materialSpec).toBeUndefined();
    expect(legacy.lightingSpec).toBeUndefined();

    // Serialization drops the absent additive keys (legacy graphs unchanged).
    const round = JSON.parse(JSON.stringify(legacy));
    expect('receivesLighting' in round).toBe(false);
    expect('materialSpec' in round).toBe(false);
    expect('lightingSpec' in round).toBe(false);
  });

  it('plan-output hook passes a present lightingSpec through verbatim, absent → undefined', () => {
    const withSpec = applyPlanRendererDefaults({
      renderMode: 'mesh',
      lightingSpec: nodeLightingSpec,
    });
    expect(withSpec.lightingSpec).toEqual(nodeLightingSpec);
    expect(applyPlanRendererDefaults({ renderMode: 'mesh' }).lightingSpec).toBeUndefined();
  });

  it('LIGHTING_SPEC_DEFAULT is a sane studio default (auto tier, ambient floor)', () => {
    expect(LIGHTING_SPEC_DEFAULT.tier).toBe('auto');
    expect(LIGHTING_SPEC_DEFAULT.ambientIntensity).toBeGreaterThan(0);
    expect(Array.isArray(LIGHTING_SPEC_DEFAULT.lights)).toBe(true);
  });
});
