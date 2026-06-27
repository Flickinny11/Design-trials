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

// I-2 SCENE-toolbar state (additive): the editorial backdrop + the lighting rig
// each expose a small set of presets the docked toolbar's SCENE buttons cycle,
// so Background/Lighting are REAL, observable operations on the editor scene.
export type EditorBackdrop = 'studio' | 'noir' | 'warm';
export type EditorLighting = 'studio' | 'cool' | 'warm';
// I-2 TRANSFORM-toolbar groundwork (additive): the select/transform interaction
// mode (gizmos land in I-3; this is the toggled state they build on).
export type EditorMode = 'idle' | 'transform';

const BACKDROPS: EditorBackdrop[] = ['studio', 'noir', 'warm'];
const LIGHTINGS: EditorLighting[] = ['studio', 'cool', 'warm'];

interface EditorShellState {
  view: EditorShellView;
  activeHubId: string | null;
  selectedId: string | null;
  editorMode: EditorMode;
  backdrop: EditorBackdrop;
  lighting: EditorLighting;
  setView: (v: EditorShellView) => void;
  setActiveHub: (hubId: string | null) => void;
  select: (id: string | null) => void;
  setEditorMode: (m: EditorMode) => void;
  cycleBackdrop: () => void;
  cycleLighting: () => void;
}

export const useEditorShellStore = create<EditorShellState>((set) => ({
  view: 'canvas',
  activeHubId: null,
  selectedId: null,
  editorMode: 'idle',
  backdrop: 'studio',
  lighting: 'studio',
  setView: (view) => set({ view }),
  setActiveHub: (activeHubId) => set({ activeHubId }),
  select: (selectedId) => set({ selectedId }),
  setEditorMode: (editorMode) => set({ editorMode }),
  cycleBackdrop: () =>
    set((s) => ({ backdrop: BACKDROPS[(BACKDROPS.indexOf(s.backdrop) + 1) % BACKDROPS.length] })),
  cycleLighting: () =>
    set((s) => ({ lighting: LIGHTINGS[(LIGHTINGS.indexOf(s.lighting) + 1) % LIGHTINGS.length] })),
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
