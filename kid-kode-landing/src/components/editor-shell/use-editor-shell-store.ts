'use client';

// PRISM EDITOR INTEGRATION — I-1 shell store.
//
// Holds the EDITOR-SHELL UI state only (the view tri-state, the active hub, the
// current selection). The LIVE APP GRAPH itself lives in useGraphSourceStore
// (loaded from public/prism-mock/home/live-graph.json) — this store never copies
// it; it reads it live. The editor edits the user's real app graph (INV-0), it
// is not a demo.
//
// Canonical view tri-state (RA-06b): galaxy = the unbuilt graph (dormant seeds),
// canvas = the 3D editing surface (realized active-hub nodes), preview-app = the
// running app (an honest placeholder this phase; wired in I-4).

import { create } from 'zustand';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import type { PrismNode } from '@/lib/prism-graph/types';

export type EditorShellView = 'galaxy' | 'canvas' | 'preview-app';

interface EditorShellState {
  view: EditorShellView;
  activeHubId: string | null;
  selectedId: string | null;
  setView: (v: EditorShellView) => void;
  setActiveHub: (hubId: string | null) => void;
  select: (id: string | null) => void;
}

export const useEditorShellStore = create<EditorShellState>((set) => ({
  view: 'canvas',
  activeHubId: null,
  selectedId: null,
  setView: (view) => set({ view }),
  setActiveHub: (activeHubId) => set({ activeHubId }),
  select: (selectedId) => set({ selectedId }),
}));

// ── derived reads over the live app graph ──────────────────────────────────

/** Every node in the live app graph (the editor's working set). */
export function allGraphNodes(): PrismNode[] {
  return useGraphSourceStore.getState().nodes;
}

/** Resolve the active hub id, defaulting to the first hub once the graph loads. */
export function resolveActiveHubId(): string | null {
  const { activeHubId } = useEditorShellStore.getState();
  if (activeHubId) return activeHubId;
  const hubs = useGraphSourceStore.getState().hubs;
  return hubs[0]?.hubId ?? null;
}

/** The active hub's nodes — the set the CANVAS view realizes. */
export function activeHubNodes(): PrismNode[] {
  const hubId = resolveActiveHubId();
  if (!hubId) return [];
  return useGraphSourceStore.getState().nodes.filter((n) => n.parentHubId === hubId);
}

/** Every hub id in the live app graph (for the hub switcher / probes). */
export function allHubIds(): string[] {
  return useGraphSourceStore.getState().hubs.map((h) => h.hubId);
}
