'use client';

// Zustand store that holds the canonical mock-app graph the editor reads
// through. Phase 1 introduced the surface; Phase 2 wires Inspector +
// GraphScene to read from it and eagerly initializes from home-hub.json.
//
// Plan ref: /Users/loganbaird/.claude/plans/i-recently-made-changes-effervescent-church.md §Phase 2.

import { create } from 'zustand';
import type { GraphSource, HomeHubJson, PrismEdge, PrismHub, PrismNode } from '@/lib/prism-graph/types';
import { loadFromHomeHub, loadFromHomeHubFile } from '@/lib/prism-graph/loader';
import homeHubJson from '@/lib/prism/mock-app-source/hubs/home-hub.json';

interface GraphSourceState {
  hubs: PrismHub[];
  nodes: PrismNode[];
  edges: PrismEdge[];
  ready: boolean;
  error: string | null;
  load: (json: HomeHubJson) => void;
  loadFromUrl: (url: string) => Promise<void>;
  reset: () => void;
}

const EMPTY: GraphSource = { hubs: [], nodes: [], edges: [] };

export const useGraphSourceStore = create<GraphSourceState>()((set) => ({
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

  loadFromUrl: async (url) => {
    try {
      const graph = await loadFromHomeHubFile(url);
      set({ hubs: graph.hubs, nodes: graph.nodes, edges: graph.edges, ready: true, error: null });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ ready: false, error: message });
    }
  },

  reset: () => set({ hubs: [], nodes: [], edges: [], ready: false, error: null }),
}));

// Eagerly initialize from the bundled home-hub.json so consumers see a ready
// store on first render. The `load` action is sync and idempotent; running it
// at module scope means the editor never has to wait for an async fetch
// before mounting Inspector or GraphScene.
useGraphSourceStore.getState().load(homeHubJson as unknown as HomeHubJson);
