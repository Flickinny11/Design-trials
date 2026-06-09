// Material+Lighting — `receivesLighting` round-trips through the save body and
// reload, and legacy nodes resolve a safe default per render mode.
//
// Spec refs:
//   §10 decision 7 — image-bearing render modes default UNLIT; meshes LIT.
//   INV-18 — additive only: a legacy node without `receivesLighting` is still a
//            legal PrismNode and resolves a concrete boolean default.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismHub, PrismIntent, PrismNode } from '@/lib/prism-graph/types';
import { receivesLightingDefault } from '@/lib/prism-graph/types';
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
    subtype: 'caption',
    serviceTag: 'ui-text',
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

describe('receivesLighting round-trip', () => {
  it('a node with receivesLighting:true survives the save body and reload', async () => {
    const { useGraphSourceStore } = await freshStore();
    useGraphSourceStore.setState({
      hubs: [seedHub],
      nodes: [],
      edges: [],
      ready: true,
      error: null,
      isDirty: false,
    });

    const litId = addNode(useGraphSourceStore.getState(), {});
    useGraphSourceStore.getState().updateNode(litId, { receivesLighting: true });

    const captured: { body?: string } = {};
    const fetchSpy = vi.fn(async (_url: string, init: RequestInit) => {
      captured.body = String(init.body);
      return new Response(JSON.stringify({ ok: true, regeneratedAt: '2026-06-08T00:00:00Z' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const body = JSON.parse(captured.body!);
    const persisted = body.graph.nodes.find((n: PrismNode) => n.nodeId === litId);
    expect(persisted.receivesLighting).toBe(true);

    // Reload: the persisted body re-hydrates the field verbatim.
    const reloaded = JSON.parse(JSON.stringify(persisted)) as PrismNode;
    expect(reloaded.receivesLighting).toBe(true);
  });

  it('a node with receivesLighting:false also round-trips', async () => {
    const { useGraphSourceStore } = await freshStore();
    useGraphSourceStore.setState({
      hubs: [seedHub],
      nodes: [],
      edges: [],
      ready: true,
      error: null,
      isDirty: false,
    });

    const unlitId = addNode(useGraphSourceStore.getState(), {});
    useGraphSourceStore.getState().updateNode(unlitId, { receivesLighting: false });

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
    const persisted = body.graph.nodes.find((n: PrismNode) => n.nodeId === unlitId);
    expect(persisted.receivesLighting).toBe(false);
  });

  it('legacy node (no receivesLighting) resolves the safe default per render mode', () => {
    // Image planes default UNLIT; meshes default LIT (§10 decision 7).
    expect(receivesLightingDefault('sprite')).toBe(false);
    expect(receivesLightingDefault('plane')).toBe(false);
    expect(receivesLightingDefault('parallax-plane')).toBe(false);
    expect(receivesLightingDefault('mesh')).toBe(true);
    expect(receivesLightingDefault(undefined)).toBe(false);
  });

  it('plan-output hook stamps a concrete receivesLighting per render mode', () => {
    expect(applyPlanRendererDefaults({ renderMode: 'mesh' }).receivesLighting).toBe(true);
    expect(applyPlanRendererDefaults({ renderMode: 'sprite' }).receivesLighting).toBe(false);
    // Legacy plan with no renderMode → sprite default → unlit.
    expect(applyPlanRendererDefaults({}).receivesLighting).toBe(false);
    // An explicit boolean wins over the per-render-mode default.
    expect(
      applyPlanRendererDefaults({ renderMode: 'sprite', receivesLighting: true }).receivesLighting,
    ).toBe(true);
    expect(
      applyPlanRendererDefaults({ renderMode: 'mesh', receivesLighting: false }).receivesLighting,
    ).toBe(false);
  });
});
