// HL04 — Store mutators on useGraphSourceStore.
//
// Spec refs:
//   - Plan §P5
//   - Spec §10 (verifier reused via applyPlanRendererDefaults inside addNode)
//
// Acceptance (haltCheck):
//   useGraphSourceStore gains 9 mutators:
//     addNode/updateNode/removeNode/addEdge/removeEdge/addHub/
//     setScenePosition/markDirty/saveToServer.
//   - addNode: generates crypto.randomUUID nodeId, applies plan-output-hook
//     defaults, returns id.
//   - removeNode: cascades incident edges.
//   - setScenePosition: hot-path slider write.
//   - saveToServer: POSTs { action:'persist', graph } to /api/prism/regen,
//     updates isDirty/savedAt.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  PrismEdge,
  PrismHub,
  PrismIntent,
  PrismNode,
} from '@/lib/prism-graph/types';

// We import lazily inside each test/beforeEach so vi.resetModules() can
// clear the eager-init effect at the top of useGraphSourceStore.
type StoreState = {
  hubs: PrismHub[];
  nodes: PrismNode[];
  edges: PrismEdge[];
  ready: boolean;
  error: string | null;
  isDirty: boolean;
  savedAt: string | null;
  load: (json: unknown) => void;
  loadFromUrl: (url: string) => Promise<void>;
  reset: () => void;
  addNode: (input: Partial<PrismNode> & { parentHubId: string }) => string;
  updateNode: (nodeId: string, patch: Partial<PrismNode>) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: PrismEdge) => void;
  removeEdge: (predicate: (e: PrismEdge) => boolean) => void;
  addHub: (hub: PrismHub) => void;
  setScenePosition: (
    nodeId: string,
    patch: Partial<PrismNode['scenePosition']>,
  ) => void;
  markDirty: (dirty?: boolean) => void;
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

async function freshStore(): Promise<{
  useGraphSourceStore: { getState: () => StoreState; setState: (p: Partial<StoreState>) => void };
}> {
  vi.resetModules();
  // Suppress the eager-init fetch by failing it loudly but letting the test
  // continue. Each test then drives state via mutators / load() directly.
  globalThis.fetch = vi.fn(async () => {
    throw new Error('eager-init fetch suppressed in HL04 unit test');
  }) as unknown as typeof fetch;
  // Keep window defined so the eager-init branch fires; the suppressed
  // fetch above means it ends with `ready=false, error=...` until we call
  // load() / reset() to seed state explicitly.
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

describe('HL04 — useGraphSourceStore mutators (Plan §P5)', () => {
  describe('addNode', () => {
    it('generates a uuid nodeId, applies plan-output-hook defaults, returns the id', async () => {
      const { useGraphSourceStore } = await freshStore();
      useGraphSourceStore.setState({
        hubs: [],
        nodes: [],
        edges: [],
        ready: true,
        error: null,
      });

      const id = useGraphSourceStore.getState().addNode({
        parentHubId: 'home',
        subtype: 'caption',
        serviceTag: 'ui-text',
        visual: { transform: { x: 0, y: 0, z: 0, width: 1, height: 1 } },
        intent: emptyIntent(),
        codeRef: '',
        backendRef: null,
      });

      expect(typeof id).toBe('string');
      // crypto.randomUUID v4 shape (8-4-4-4-12 hex)
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

      const state = useGraphSourceStore.getState();
      expect(state.nodes).toHaveLength(1);
      const created = state.nodes[0];
      expect(created.nodeId).toBe(id);
      expect(created.parentHubId).toBe('home');
      // plan-output-hook defaults
      expect(created.renderMode).toBe('sprite');
      expect(created.cinematicPrimitives).toEqual([]);
      expect(created.depthMapUrl).toBeNull();
      expect(created.meshUrl).toBeNull();
      expect(created.scenePosition).toMatchObject({
        x: 0, y: 0, z: 0,
        rotationX: 0, rotationY: 0, rotationZ: 0,
        scaleX: 1, scaleY: 1, scaleZ: 1,
      });
      // isDirty is set so an editor save knows there are unsaved changes
      expect(state.isDirty).toBe(true);
    });

    it('honors caller-supplied nodeId when provided', async () => {
      const { useGraphSourceStore } = await freshStore();
      useGraphSourceStore.setState({ hubs: [], nodes: [], edges: [], ready: true, error: null });

      const id = useGraphSourceStore.getState().addNode({
        nodeId: 'home-explicit',
        parentHubId: 'home',
        subtype: 'caption',
        serviceTag: 'ui-text',
        visual: { transform: { x: 0, y: 0, z: 0, width: 1, height: 1 } },
        intent: emptyIntent(),
        codeRef: '',
        backendRef: null,
      });

      expect(id).toBe('home-explicit');
      expect(useGraphSourceStore.getState().nodes[0].nodeId).toBe('home-explicit');
    });
  });

  describe('updateNode', () => {
    it('patches the matching node and leaves siblings untouched', async () => {
      const { useGraphSourceStore } = await freshStore();
      useGraphSourceStore.setState({
        hubs: [],
        nodes: [
          {
            nodeId: 'a',
            subtype: 's',
            parentHubId: 'home',
            serviceTag: 't',
            visual: { transform: { x: 0, y: 0, z: 0, width: 1, height: 1 } },
            intent: emptyIntent(),
            codeRef: '',
            backendRef: null,
          },
          {
            nodeId: 'b',
            subtype: 's',
            parentHubId: 'home',
            serviceTag: 't',
            visual: { transform: { x: 0, y: 0, z: 0, width: 1, height: 1 } },
            intent: emptyIntent(),
            codeRef: '',
            backendRef: null,
          },
        ],
        edges: [],
        ready: true,
        error: null,
      });

      useGraphSourceStore.getState().updateNode('a', { subtype: 'updated' });

      const state = useGraphSourceStore.getState();
      expect(state.nodes.find((n) => n.nodeId === 'a')?.subtype).toBe('updated');
      expect(state.nodes.find((n) => n.nodeId === 'b')?.subtype).toBe('s');
      expect(state.isDirty).toBe(true);
    });
  });

  describe('removeNode', () => {
    it('removes the node and cascades incident edges', async () => {
      const { useGraphSourceStore } = await freshStore();
      useGraphSourceStore.setState({
        hubs: [],
        nodes: [
          { nodeId: 'a', subtype: 's', parentHubId: 'home', serviceTag: 't', visual: { transform: { x: 0, y: 0, z: 0, width: 1, height: 1 } }, intent: emptyIntent(), codeRef: '', backendRef: null },
          { nodeId: 'b', subtype: 's', parentHubId: 'home', serviceTag: 't', visual: { transform: { x: 0, y: 0, z: 0, width: 1, height: 1 } }, intent: emptyIntent(), codeRef: '', backendRef: null },
          { nodeId: 'c', subtype: 's', parentHubId: 'home', serviceTag: 't', visual: { transform: { x: 0, y: 0, z: 0, width: 1, height: 1 } }, intent: emptyIntent(), codeRef: '', backendRef: null },
        ],
        edges: [
          { from: 'a', to: 'b', type: 'data-flow' },
          { from: 'b', to: 'c', type: 'triggers' },
          { from: 'a', to: 'c', type: 'triggers' },
        ],
        ready: true,
        error: null,
      });

      useGraphSourceStore.getState().removeNode('b');

      const state = useGraphSourceStore.getState();
      expect(state.nodes.map((n) => n.nodeId)).toEqual(['a', 'c']);
      // edges incident to 'b' are gone; the 'a→c' edge survives
      expect(state.edges).toEqual([{ from: 'a', to: 'c', type: 'triggers' }]);
      expect(state.isDirty).toBe(true);
    });
  });

  describe('addEdge / removeEdge', () => {
    it('appends a new edge and removes the predicate match', async () => {
      const { useGraphSourceStore } = await freshStore();
      useGraphSourceStore.setState({
        hubs: [],
        nodes: [],
        edges: [{ from: 'a', to: 'b', type: 'data-flow' }],
        ready: true,
        error: null,
      });

      useGraphSourceStore.getState().addEdge({ from: 'b', to: 'c', type: 'triggers' });
      let state = useGraphSourceStore.getState();
      expect(state.edges).toEqual([
        { from: 'a', to: 'b', type: 'data-flow' },
        { from: 'b', to: 'c', type: 'triggers' },
      ]);
      expect(state.isDirty).toBe(true);

      useGraphSourceStore
        .getState()
        .removeEdge((e) => e.from === 'a' && e.to === 'b');
      state = useGraphSourceStore.getState();
      expect(state.edges).toEqual([{ from: 'b', to: 'c', type: 'triggers' }]);
    });
  });

  describe('addHub', () => {
    it('appends a new hub', async () => {
      const { useGraphSourceStore } = await freshStore();
      useGraphSourceStore.setState({ hubs: [], nodes: [], edges: [], ready: true, error: null });

      useGraphSourceStore.getState().addHub({
        hubId: 'about',
        title: 'About',
        layout: {
          viewportWidth: 1280,
          viewportHeight: 720,
          contentHeight: 720,
          backgroundColor: '#04050a',
          mockupUrl: null,
        },
      });

      const state = useGraphSourceStore.getState();
      expect(state.hubs).toHaveLength(1);
      expect(state.hubs[0].hubId).toBe('about');
      expect(state.isDirty).toBe(true);
    });
  });

  describe('setScenePosition (hot-path slider write)', () => {
    it('patches scenePosition without resetting other fields', async () => {
      const { useGraphSourceStore } = await freshStore();
      useGraphSourceStore.setState({
        hubs: [],
        nodes: [
          {
            nodeId: 'a',
            subtype: 's',
            parentHubId: 'home',
            serviceTag: 't',
            visual: { transform: { x: 0, y: 0, z: 0, width: 1, height: 1 } },
            intent: emptyIntent(),
            codeRef: '',
            backendRef: null,
            scenePosition: {
              x: 0, y: 0, z: 0,
              rotationX: 0, rotationY: 0, rotationZ: 0,
              scaleX: 1, scaleY: 1, scaleZ: 1,
            },
          },
        ],
        edges: [],
        ready: true,
        error: null,
      });

      useGraphSourceStore.getState().setScenePosition('a', { x: 2.5, scaleX: 1.5 });

      const node = useGraphSourceStore.getState().nodes[0];
      expect(node.scenePosition).toMatchObject({
        x: 2.5,
        y: 0,
        z: 0,
        scaleX: 1.5,
        scaleY: 1,
        scaleZ: 1,
      });
      expect(useGraphSourceStore.getState().isDirty).toBe(true);
    });
  });

  describe('markDirty', () => {
    it('sets isDirty=true by default and false when passed false', async () => {
      const { useGraphSourceStore } = await freshStore();
      useGraphSourceStore.setState({ hubs: [], nodes: [], edges: [], ready: true, error: null, isDirty: false });

      useGraphSourceStore.getState().markDirty();
      expect(useGraphSourceStore.getState().isDirty).toBe(true);

      useGraphSourceStore.getState().markDirty(false);
      expect(useGraphSourceStore.getState().isDirty).toBe(false);
    });
  });

  describe('saveToServer', () => {
    it('POSTs { action: "persist", graph } to /api/prism/regen and clears isDirty', async () => {
      const { useGraphSourceStore } = await freshStore();
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
      useGraphSourceStore.setState({
        hubs: [seedHub],
        nodes: [],
        edges: [],
        ready: true,
        error: null,
        isDirty: true,
      });

      const fetchSpy = vi.fn(async () => {
        return new Response(
          JSON.stringify({ ok: true, regeneratedAt: '2026-05-06T03:30:00Z' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const result = await useGraphSourceStore.getState().saveToServer();
      expect(result.ok).toBe(true);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe('/api/prism/regen');
      expect(init.method).toBe('POST');
      const body = JSON.parse(String(init.body));
      expect(body.action).toBe('persist');
      expect(body.graph).toBeDefined();
      expect(body.graph.hub).toMatchObject({ hubId: 'home' });
      expect(Array.isArray(body.graph.nodes)).toBe(true);
      expect(Array.isArray(body.graph.edges)).toBe(true);

      const state = useGraphSourceStore.getState();
      expect(state.isDirty).toBe(false);
      expect(typeof state.savedAt).toBe('string');
    });

    it('returns { ok: false } and leaves isDirty=true on HTTP error', async () => {
      const { useGraphSourceStore } = await freshStore();
      useGraphSourceStore.setState({
        hubs: [
          {
            hubId: 'home',
            title: 'Home',
            layout: {
              viewportWidth: 1280,
              viewportHeight: 720,
              contentHeight: 720,
              backgroundColor: '#04050a',
              mockupUrl: null,
            },
          },
        ],
        nodes: [],
        edges: [],
        ready: true,
        error: null,
        isDirty: true,
      });

      globalThis.fetch = vi.fn(async () => new Response('boom', { status: 500 })) as unknown as typeof fetch;

      const result = await useGraphSourceStore.getState().saveToServer();
      expect(result.ok).toBe(false);
      expect(useGraphSourceStore.getState().isDirty).toBe(true);
    });
  });
});
