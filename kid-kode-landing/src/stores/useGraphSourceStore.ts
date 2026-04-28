'use client';

// Zustand store that holds the canonical mock-app graph the editor reads
// through. Phase 1 introduces the surface; Phase 2 wires Inspector +
// GraphScene to read from it.
//
// Plan ref: /Users/loganbaird/.claude/plans/i-recently-made-changes-effervescent-church.md §Phase 1.

import { create } from 'zustand';
import type { GraphSource, HomeHubJson, PrismEdge, PrismHub, PrismNode } from '@/lib/prism-graph/types';
import { loadFromHomeHub } from '@/lib/prism-graph/loader';

interface GraphSourceState {
  hubs: PrismHub[];
  nodes: PrismNode[];
  edges: PrismEdge[];
  ready: boolean;
  error: string | null;
  load: (json: HomeHubJson) => void;
  loadFromUrl: (url?: string) => Promise<void>;
  reset: () => void;
}

const EMPTY: GraphSource = { hubs: [], nodes: [], edges: [] };

export const useGraphSourceStore = create<GraphSourceState>((set) => ({
  hubs: EMPTY.hubs,
  nodes: EMPTY.nodes,
  edges: EMPTY.edges,
  ready: false,
  error: null,

  load: (json) => {
    try {
      const graph = loadFromHomeHub(json);
      set({ hubs: graph.hubs, nodes: graph.nodes, edges: graph.edges, ready: true, error: null });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ ready: false, error: message });
    }
  },

  loadFromUrl: async (url = '/api/mock/home-hub.json') => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
      const json = (await res.json()) as HomeHubJson;
      const graph = loadFromHomeHub(json);
      set({ hubs: graph.hubs, nodes: graph.nodes, edges: graph.edges, ready: true, error: null });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ ready: false, error: message });
    }
  },

  reset: () => set({ hubs: [], nodes: [], edges: [], ready: false, error: null }),
}));
