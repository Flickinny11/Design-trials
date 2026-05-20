// EBR2-F-02 — cloneNode(sourceId) action on useGraphSourceStore.
//
// Spec refs:
//   - §R2-F SC-075: source-store gains a deep-cloned node, new id,
//     suffixed caption.
//   - Task EBR2-F-02 haltCheck: cloneNode(sourceId): newNodeId action exists.
//     Deep-clones the source node, generates new id (UUID or hash-based),
//     suffixes caption with ' (clone)', initially parents to source's parent
//     hub. Returns new id. Unit test: clone shares no object refs with source.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  PrismEdge,
  PrismHub,
  PrismIntent,
  PrismNode,
} from '@/lib/prism-graph/types';

type StoreState = {
  hubs: PrismHub[];
  nodes: PrismNode[];
  edges: PrismEdge[];
  ready: boolean;
  error: string | null;
  isDirty: boolean;
  savedAt: string | null;
  addNode: (input: Partial<PrismNode> & { parentHubId: string }) => string;
  cloneNode: (sourceId: string) => string;
};

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_WINDOW = (globalThis as { window?: unknown }).window;

function emptyIntent(caption = 'source caption'): PrismIntent {
  return {
    caption,
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

function makeSourceNode(id: string, parentHubId: string, caption: string): PrismNode {
  return {
    nodeId: id,
    subtype: 'caption',
    parentHubId,
    serviceTag: 'ui-text',
    visual: { transform: { x: 1, y: 2, z: 3, width: 4, height: 5 } },
    intent: emptyIntent(caption),
    codeRef: '',
    backendRef: null,
    renderMode: 'sprite',
    cinematicPrimitives: [{ name: 'orbit', params: { radius: 2 }, trigger: 'load' }],
    scenePosition: {
      x: 7, y: 8, z: 9,
      rotationX: 0, rotationY: 0, rotationZ: 0,
      scaleX: 1, scaleY: 1, scaleZ: 1,
    },
  };
}

async function freshStore(): Promise<{
  useGraphSourceStore: { getState: () => StoreState; setState: (p: Partial<StoreState>) => void };
}> {
  vi.resetModules();
  globalThis.fetch = vi.fn(async () => {
    throw new Error('eager-init fetch suppressed in EBR2-F-02 unit test');
  }) as unknown as typeof fetch;
  (globalThis as { window?: unknown }).window = globalThis as unknown as Window;
  const mod = await import('@/stores/useGraphSourceStore');
  return mod as unknown as {
    useGraphSourceStore: { getState: () => StoreState; setState: (p: Partial<StoreState>) => void };
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

describe('EBR2-F-02 — useGraphSourceStore.cloneNode (§R2-F SC-075)', () => {
  it('exposes a cloneNode(sourceId): newNodeId action', async () => {
    const { useGraphSourceStore } = await freshStore();
    const state = useGraphSourceStore.getState();
    expect(typeof state.cloneNode).toBe('function');
  });

  it('deep-clones the source node, mints new id, suffixes caption, and returns new id', async () => {
    const { useGraphSourceStore } = await freshStore();
    const source = makeSourceNode('node-a', 'home', 'Hello World');
    useGraphSourceStore.setState({
      hubs: [],
      nodes: [source],
      edges: [],
      ready: true,
      error: null,
    });

    const newId = useGraphSourceStore.getState().cloneNode('node-a');

    expect(typeof newId).toBe('string');
    expect(newId.length).toBeGreaterThan(0);
    expect(newId).not.toBe('node-a');

    const nodes = useGraphSourceStore.getState().nodes;
    expect(nodes).toHaveLength(2);
    const clone = nodes.find((n) => n.nodeId === newId);
    expect(clone).toBeDefined();
    if (!clone) throw new Error('clone missing');

    // Caption suffix
    expect(clone.intent.caption).toBe('Hello World (clone)');
    // Source caption is untouched
    expect(nodes.find((n) => n.nodeId === 'node-a')?.intent.caption).toBe('Hello World');

    // Initially parents to source's parent hub
    expect(clone.parentHubId).toBe('home');

    // Carries over other fields verbatim
    expect(clone.subtype).toBe('caption');
    expect(clone.serviceTag).toBe('ui-text');
    expect(clone.renderMode).toBe('sprite');
    expect(clone.scenePosition).toEqual({
      x: 7, y: 8, z: 9,
      rotationX: 0, rotationY: 0, rotationZ: 0,
      scaleX: 1, scaleY: 1, scaleZ: 1,
    });
  });

  it('clone shares NO object refs with source (deep clone)', async () => {
    const { useGraphSourceStore } = await freshStore();
    const source = makeSourceNode('node-a', 'home', 'Original');
    useGraphSourceStore.setState({
      hubs: [],
      nodes: [source],
      edges: [],
      ready: true,
      error: null,
    });

    const newId = useGraphSourceStore.getState().cloneNode('node-a');
    const nodes = useGraphSourceStore.getState().nodes;
    const sourceAfter = nodes.find((n) => n.nodeId === 'node-a');
    const clone = nodes.find((n) => n.nodeId === newId);
    if (!sourceAfter || !clone) throw new Error('source or clone missing');

    expect(clone).not.toBe(sourceAfter);
    expect(clone.intent).not.toBe(sourceAfter.intent);
    expect(clone.visual).not.toBe(sourceAfter.visual);
    expect(clone.visual.transform).not.toBe(sourceAfter.visual.transform);
    expect(clone.scenePosition).not.toBe(sourceAfter.scenePosition);
    expect(clone.cinematicPrimitives).not.toBe(sourceAfter.cinematicPrimitives);
    expect(clone.cinematicPrimitives?.[0]).not.toBe(sourceAfter.cinematicPrimitives?.[0]);

    // Mutating the clone must not bleed into source.
    clone.intent.caption = 'mutated';
    expect(sourceAfter.intent.caption).toBe('Original');
  });

  it('marks the store dirty so autosave will pick it up', async () => {
    const { useGraphSourceStore } = await freshStore();
    const source = makeSourceNode('node-a', 'home', 'X');
    useGraphSourceStore.setState({
      hubs: [],
      nodes: [source],
      edges: [],
      ready: true,
      error: null,
      isDirty: false,
    });

    useGraphSourceStore.getState().cloneNode('node-a');
    expect(useGraphSourceStore.getState().isDirty).toBe(true);
  });

  it('returns empty string and is a no-op when sourceId does not exist', async () => {
    const { useGraphSourceStore } = await freshStore();
    useGraphSourceStore.setState({
      hubs: [],
      nodes: [makeSourceNode('node-a', 'home', 'X')],
      edges: [],
      ready: true,
      error: null,
      isDirty: false,
    });

    const result = useGraphSourceStore.getState().cloneNode('does-not-exist');
    expect(result).toBe('');
    expect(useGraphSourceStore.getState().nodes).toHaveLength(1);
    expect(useGraphSourceStore.getState().isDirty).toBe(false);
  });
});
