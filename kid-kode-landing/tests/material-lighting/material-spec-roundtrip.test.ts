// Material+Lighting — a node's `materialSpec` round-trips through the save body
// and `resolveMaterialSpec` fills defaults for any unset field.
//
// Spec refs:
//   §11 — per-node MeshPhysicalNodeMaterial params; all optional, defaults from
//         MATERIAL_SPEC_DEFAULT. INV-18 — additive only.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  MaterialSpec,
  PrismHub,
  PrismIntent,
  PrismNode,
} from '@/lib/prism-graph/types';
import { MATERIAL_SPEC_DEFAULT } from '@/lib/prism-graph/types';
import { resolveMaterialSpec } from '@/lib/prism/runtime/shared/material-system';
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

describe('materialSpec round-trip', () => {
  it('a node.materialSpec survives the save body and a JSON reload', async () => {
    const { useGraphSourceStore } = await freshStore();
    useGraphSourceStore.setState({
      hubs: [seedHub],
      nodes: [],
      edges: [],
      ready: true,
      error: null,
      isDirty: false,
    });

    const spec: MaterialSpec = {
      baseColor: '#cfd6e6',
      metalness: 0.9,
      roughness: 0.12,
      transmission: 0.85,
      ior: 1.52,
      dispersion: 0.3,
    };
    const id = addNode(useGraphSourceStore.getState(), { renderMode: 'mesh' });
    useGraphSourceStore.getState().updateNode(id, { materialSpec: spec });

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
    const persisted = body.graph.nodes.find((n: PrismNode) => n.nodeId === id);
    expect(persisted.materialSpec).toEqual(spec);

    const reloaded = JSON.parse(JSON.stringify(persisted)) as PrismNode;
    expect(reloaded.materialSpec).toEqual(spec);
  });

  it('resolveMaterialSpec fills every default for a partial spec', () => {
    const resolved = resolveMaterialSpec({ metalness: 1, transmission: 0.5 });
    // Supplied values survive.
    expect(resolved.metalness).toBe(1);
    expect(resolved.transmission).toBe(0.5);
    // Unset fields fall back to MATERIAL_SPEC_DEFAULT.
    expect(resolved.roughness).toBe(MATERIAL_SPEC_DEFAULT.roughness);
    expect(resolved.baseColor).toBe(MATERIAL_SPEC_DEFAULT.baseColor);
    expect(resolved.ior).toBe(MATERIAL_SPEC_DEFAULT.ior);
    // Every default key is present (Required<MaterialSpec>).
    for (const k of Object.keys(MATERIAL_SPEC_DEFAULT) as (keyof MaterialSpec)[]) {
      expect(resolved[k]).not.toBeUndefined();
    }
  });

  it('resolveMaterialSpec(undefined) returns the full default', () => {
    expect(resolveMaterialSpec()).toEqual(MATERIAL_SPEC_DEFAULT);
    expect(resolveMaterialSpec(null)).toEqual(MATERIAL_SPEC_DEFAULT);
  });

  it('plan-output hook normalizes a present materialSpec over defaults, leaves absent undefined', () => {
    // Present → merged over defaults (fills gaps, mirrors scenePosition spread).
    const withSpec = applyPlanRendererDefaults({
      renderMode: 'mesh',
      materialSpec: { metalness: 0.7 },
    });
    expect(withSpec.materialSpec).toBeDefined();
    expect(withSpec.materialSpec!.metalness).toBe(0.7);
    expect(withSpec.materialSpec!.roughness).toBe(MATERIAL_SPEC_DEFAULT.roughness);
    // Absent → stays undefined (we do NOT force a materialSpec onto every node).
    expect(applyPlanRendererDefaults({ renderMode: 'mesh' }).materialSpec).toBeUndefined();
    expect(applyPlanRendererDefaults({ renderMode: 'sprite' }).materialSpec).toBeUndefined();
  });
});
