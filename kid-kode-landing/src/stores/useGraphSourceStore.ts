'use client';

// Zustand store that holds the canonical mock-app graph the editor reads
// through. Phase 2 of the editor-integration plan introduced eager init
// from a bundled JSON; HL03 of the harness lock-in (Plan §P4) swapped the
// source to /prism-mock/home/live-graph.json — the file the editor writes
// back to via /api/prism/regen. The bundled fixture survives at
// hubs/home-hub.legacy.json for one-off provisioning scripts.
//
// HL04 (Plan §P5): the store gains 9 mutators so the editor can author the
// graph in place. Every mutator that changes graph state flips
// `isDirty=true`; saveToServer POSTs the full graph snapshot to
// /api/prism/regen and clears the flag once the server confirms persist.

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  GraphSource,
  HomeHubJson,
  PrismEdge,
  PrismHub,
  PrismNode,
  ScenePosition,
} from '@/lib/prism-graph/types';
import { loadFromHomeHub, loadFromHomeHubFile } from '@/lib/prism-graph/loader';
import { applyPlanRendererDefaults } from '@/lib/prism/codegen/plan-output-hook';

export interface SaveToServerResult {
  ok: boolean;
  error?: string;
  regeneratedAt?: string;
}

interface GraphSourceState {
  hubs: PrismHub[];
  nodes: PrismNode[];
  edges: PrismEdge[];
  ready: boolean;
  error: string | null;
  isDirty: boolean;
  savedAt: string | null;
  load: (json: HomeHubJson) => void;
  loadFromUrl: (url: string) => Promise<void>;
  reset: () => void;
  // HL04 mutators (Plan §P5)
  addNode: (input: Partial<PrismNode> & { parentHubId: string }) => string;
  updateNode: (nodeId: string, patch: Partial<PrismNode>) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: PrismEdge) => void;
  removeEdge: (predicate: (e: PrismEdge) => boolean) => void;
  addHub: (hub: PrismHub) => void;
  setScenePosition: (nodeId: string, patch: Partial<ScenePosition>) => void;
  markDirty: (dirty?: boolean) => void;
  saveToServer: () => Promise<SaveToServerResult>;
}

const EMPTY: GraphSource = { hubs: [], nodes: [], edges: [] };

function generateNodeId(): string {
  // crypto.randomUUID is available in modern browsers + Node ≥19 + jsdom.
  // Vitest's node env provides it through `globalThis.crypto`.
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  // Fallback (extremely unlikely path): RFC4122-ish pseudo-uuid.
  const rnd = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${rnd()}${rnd()}-${rnd()}-${rnd()}-${rnd()}-${rnd()}${rnd()}${rnd()}`;
}

export const useGraphSourceStore = create<GraphSourceState>()(subscribeWithSelector((set, get) => ({
  hubs: EMPTY.hubs,
  nodes: EMPTY.nodes,
  edges: EMPTY.edges,
  ready: false,
  error: null,
  isDirty: false,
  savedAt: null,

  load: (json) => {
    try {
      const graph = loadFromHomeHub(json);
      set({
        hubs: graph.hubs,
        nodes: graph.nodes,
        edges: graph.edges,
        ready: true,
        error: null,
        isDirty: false,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ ready: false, error: message });
    }
  },

  loadFromUrl: async (url) => {
    try {
      const graph = await loadFromHomeHubFile(url);
      set({
        hubs: graph.hubs,
        nodes: graph.nodes,
        edges: graph.edges,
        ready: true,
        error: null,
        isDirty: false,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ ready: false, error: message });
    }
  },

  reset: () =>
    set({
      hubs: [],
      nodes: [],
      edges: [],
      ready: false,
      error: null,
      isDirty: false,
      savedAt: null,
    }),

  addNode: (input) => {
    const nodeId = input.nodeId ?? generateNodeId();
    const seeded = applyPlanRendererDefaults({ ...input, nodeId });
    const created = seeded as PrismNode;
    set((s) => ({ nodes: [...s.nodes, created], isDirty: true }));
    return nodeId;
  },

  updateNode: (nodeId, patch) => {
    set((s) => ({
      nodes: s.nodes.map((n) => (n.nodeId === nodeId ? { ...n, ...patch } : n)),
      isDirty: true,
    }));
  },

  removeNode: (nodeId) => {
    set((s) => ({
      nodes: s.nodes.filter((n) => n.nodeId !== nodeId),
      edges: s.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
      isDirty: true,
    }));
  },

  addEdge: (edge) => {
    set((s) => ({ edges: [...s.edges, edge], isDirty: true }));
  },

  removeEdge: (predicate) => {
    set((s) => ({ edges: s.edges.filter((e) => !predicate(e)), isDirty: true }));
  },

  addHub: (hub) => {
    set((s) => ({ hubs: [...s.hubs, hub], isDirty: true }));
  },

  setScenePosition: (nodeId, patch) => {
    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (n.nodeId !== nodeId) return n;
        const base = n.scenePosition ?? {
          x: 0, y: 0, z: 0,
          rotationX: 0, rotationY: 0, rotationZ: 0,
          scaleX: 1, scaleY: 1, scaleZ: 1,
        };
        return { ...n, scenePosition: { ...base, ...patch } };
      }),
      isDirty: true,
    }));
  },

  markDirty: (dirty = true) => set({ isDirty: dirty }),

  saveToServer: async () => {
    const s = get();
    // The server expects HomeHubJson shape: { schemaVersion, hub, nodes, edges }.
    // The store carries an array of hubs (the editor will eventually author
    // multi-hub graphs); persist the FIRST hub plus its nodes/edges. Legal
    // because the live-graph.json contract is single-hub today.
    const hub = s.hubs[0];
    if (!hub) {
      return { ok: false, error: 'no hub to persist' };
    }
    const graph: HomeHubJson = {
      schemaVersion: '0.1.0',
      hub,
      nodes: s.nodes.filter((n) => n.parentHubId === hub.hubId),
      edges: s.edges,
    };
    let res: Response;
    try {
      res = await fetch('/api/prism/regen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'persist', graph }),
      });
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch { /* ignore */ }
      return { ok: false, error: `HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}` };
    }
    let json: { ok?: boolean; regeneratedAt?: string; error?: string } = {};
    try { json = (await res.json()) as typeof json; } catch (err) {
      return { ok: false, error: `invalid JSON: ${(err as Error).message}` };
    }
    if (json.ok !== true) {
      return { ok: false, error: json.error ?? 'regen returned ok=false' };
    }
    const savedAt = json.regeneratedAt ?? new Date().toISOString();
    set({ isDirty: false, savedAt });
    return { ok: true, regeneratedAt: savedAt };
  },
})));

// Eager init: fetch the canonical live graph (the file /api/prism/regen
// writes back to). The `'use client'` directive at the top of the file
// keeps the module out of server bundles, but we still gate on `window`
// to avoid SSR fetches and to stay safe if the file is imported
// transitively from server code in the future.
if (typeof window !== 'undefined') {
  void loadFromHomeHubFile('/prism-mock/home/live-graph.json').then(
    (graph) => {
      useGraphSourceStore.setState({
        hubs: graph.hubs,
        nodes: graph.nodes,
        edges: graph.edges,
        ready: true,
        error: null,
      });
    },
    (e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      useGraphSourceStore.setState({ ready: false, error: message });
    },
  );
}
