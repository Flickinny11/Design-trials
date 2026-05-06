'use client';

// Zustand store that holds the canonical mock-app graph the editor reads
// through. Phase 2 of the editor-integration plan introduced eager init
// from a bundled JSON; HL03 of the harness lock-in (Plan §P4) swapped the
// source to /prism-mock/home/live-graph.json — the file the editor writes
// back to via /api/prism/regen. The bundled fixture survives at
// hubs/home-hub.legacy.json for one-off provisioning scripts.

import { create } from 'zustand';
import type { GraphSource, HomeHubJson, PrismEdge, PrismHub, PrismNode } from '@/lib/prism-graph/types';
import { loadFromHomeHub, loadFromHomeHubFile } from '@/lib/prism-graph/loader';

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
