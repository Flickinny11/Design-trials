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
  PrismRootNode,
  ScenePosition,
} from '@/lib/prism-graph/types';
import { loadFromHomeHub, loadFromHomeHubFile } from '@/lib/prism-graph/loader';
import { applyPlanRendererDefaults } from '@/lib/prism/codegen/plan-output-hook';
import {
  composeCloneCommitCaption,
  hubTitleFor,
} from '@/lib/editor/clone-commit';

export interface SaveToServerResult {
  ok: boolean;
  error?: string;
  regeneratedAt?: string;
}

interface GraphSourceState {
  hubs: PrismHub[];
  nodes: PrismNode[];
  edges: PrismEdge[];
  // Editor-build §6 / RA-07: App_Name_World instances co-exist with PrismNode
  // in GraphSource. SC-006 constrains this to exactly one entry; validation
  // lives in validateRootNode (src/lib/prism-graph/root-node.ts). Surfaced on
  // the store so GraphScene's galaxy mode can render the central "sun"
  // without re-parsing JSON.
  rootNodes: PrismRootNode[];
  ready: boolean;
  error: string | null;
  isDirty: boolean;
  savedAt: string | null;
  load: (json: HomeHubJson) => void;
  loadFromUrl: (url: string) => Promise<void>;
  reset: () => void;
  // HL04 mutators (Plan §P5)
  addNode: (input: Partial<PrismNode> & { parentHubId: string }) => string;
  cloneNode: (sourceId: string) => string;
  // EBR2-F-05 / §R2-F SC-076 — Pointer-up commit of a Clone-drag. Re-parents
  // `cloneId` to `hubId` and rewrites the caption to advertise the new hub.
  // Returns true on success, false if either id does not resolve.
  commitClone: (cloneId: string, hubId: string) => boolean;
  updateNode: (nodeId: string, patch: Partial<PrismNode>) => void;
  // STEP5 edit-path (NE-SC-11; canvas-spec §6 Built→Dirty). Toggles the
  // per-node `dirty` flag on the source record. Used by the edit→save commit
  // (set true: built-state is now stale) and the surgical Save-and-Rebuild
  // (set false: the artifact was just rebuilt). Distinct from the graph-level
  // `isDirty` (which gates server autosave): this is the node's BUILD freshness.
  markNodeDirty: (nodeId: string, dirty: boolean) => void;
  updateRootNode: (appNameWorldId: string, patch: Partial<PrismRootNode>) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: PrismEdge) => void;
  removeEdge: (predicate: (e: PrismEdge) => boolean) => void;
  addHub: (hub: PrismHub) => void;
  setScenePosition: (nodeId: string, patch: Partial<ScenePosition>) => void;
  // STEP8 canvas-toolbar Selection group (canvas-spec §14, SC-22). Stamp a
  // single fresh `groupId` onto every listed node so their transforms cascade
  // as a unit. Additive (INV-18) + non-topological (INV-1): no edge is created.
  // Returns the minted groupId, or '' when fewer than 2 valid nodes are given.
  groupNodes: (nodeIds: string[]) => string;
  // STEP8 — dissolve a group by clearing `groupId` from every member. Each
  // node keeps its own `scenePosition`, so world transforms are preserved
  // (canvas-spec §14 "Ungroup preserves children + world transforms").
  ungroupNodes: (groupId: string) => void;
  // STEP8 — toolbar Selection "Lock". Toggles the per-node `locked` guard that
  // removes the node from transform authoring (gizmo + Transform tools skip it).
  setNodeLocked: (nodeId: string, locked: boolean) => void;
  markDirty: (dirty?: boolean) => void;
  saveToServer: () => Promise<SaveToServerResult>;
}

const EMPTY: GraphSource = { hubs: [], nodes: [], edges: [] };
const AUTOSAVE_DELAY_MS = 1000;

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
let autosaveInFlight = false;
let autosaveQueued = false;
let dirtyVersion = 0;

function clearAutosaveTimer(): void {
  if (autosaveTimer !== null) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
}

function scheduleAutosave(get: () => GraphSourceState): void {
  clearAutosaveTimer();
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    void runAutosave(get);
  }, AUTOSAVE_DELAY_MS);
}

async function runAutosave(get: () => GraphSourceState): Promise<void> {
  if (autosaveInFlight) {
    autosaveQueued = true;
    return;
  }
  if (!get().isDirty) return;

  autosaveInFlight = true;
  const result = await get().saveToServer();
  autosaveInFlight = false;

  if (autosaveQueued || (!result.ok && get().isDirty)) {
    autosaveQueued = false;
    scheduleAutosave(get);
  }
}

function markGraphDirty(get: () => GraphSourceState): void {
  dirtyVersion += 1;
  scheduleAutosave(get);
}

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
  rootNodes: [],
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
        rootNodes: graph.rootNodes ?? [],
        ready: true,
        error: null,
        isDirty: false,
      });
      clearAutosaveTimer();
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
        rootNodes: graph.rootNodes ?? [],
        ready: true,
        error: null,
        isDirty: false,
      });
      clearAutosaveTimer();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ ready: false, error: message });
    }
  },

  reset: () => {
    set({
      hubs: [],
      nodes: [],
      edges: [],
      rootNodes: [],
      ready: false,
      error: null,
      isDirty: false,
      savedAt: null,
    });
    clearAutosaveTimer();
  },

  addNode: (input) => {
    const nodeId = input.nodeId ?? generateNodeId();
    const seeded = applyPlanRendererDefaults({ ...input, nodeId });
    const created = seeded as PrismNode;
    markGraphDirty(get);
    set((s) => ({ nodes: [...s.nodes, created], isDirty: true }));
    return nodeId;
  },

  // EBR2-F-02 / §R2-F SC-075 — Inspector "Clone" entry point on the source
  // store. Deep-clones the source node, mints a fresh nodeId, suffixes
  // intent.caption with ' (clone)', and parents the clone to the source's
  // current parentHubId. The nearest-hub re-parent on drag-drop is the
  // pointer-up commit's job (EBR2-F-05 / SC-076), not this action's.
  cloneNode: (sourceId) => {
    const source = get().nodes.find((n) => n.nodeId === sourceId);
    if (!source) return '';
    const cloned = JSON.parse(JSON.stringify(source)) as PrismNode;
    cloned.nodeId = generateNodeId();
    cloned.intent = { ...cloned.intent, caption: `${source.intent.caption} (clone)` };
    markGraphDirty(get);
    set((s) => ({ nodes: [...s.nodes, cloned], isDirty: true }));
    return cloned.nodeId;
  },

  // EBR2-F-05 / §R2-F SC-076 — Pointer-up commit of a Clone-drag. The
  // GalaxyCloneDragLayer pointerup handler resolves the nearest hub via
  // findNearestHub (EBR2-F-04) and calls this action with the resolved
  // (cloneId, hubId) pair. The action:
  //   - re-parents the clone (parentHubId := hubId)
  //   - rewrites intent.caption via composeCloneCommitCaption so the
  //     Inspector reflects the new parent (subtype is intentionally
  //     untouched — it carries over from source per SC-076)
  // Returns false if either id fails to resolve; no mutation occurs in that
  // case so the operator can retry the drop without corrupting state.
  commitClone: (cloneId, hubId) => {
    const state = get();
    const clone = state.nodes.find((n) => n.nodeId === cloneId);
    const hub = state.hubs.find((h) => h.hubId === hubId);
    if (!clone || !hub) return false;
    const title = hubTitleFor(hub);
    const newCaption = composeCloneCommitCaption(clone.intent.caption, title);
    markGraphDirty(get);
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.nodeId === cloneId
          ? {
              ...n,
              parentHubId: hubId,
              intent: { ...n.intent, caption: newCaption },
            }
          : n,
      ),
      isDirty: true,
    }));
    return true;
  },

  updateNode: (nodeId, patch) => {
    markGraphDirty(get);
    set((s) => ({
      nodes: s.nodes.map((n) => (n.nodeId === nodeId ? { ...n, ...patch } : n)),
      isDirty: true,
    }));
  },

  markNodeDirty: (nodeId, dirty) => {
    const node = get().nodes.find((n) => n.nodeId === nodeId);
    if (!node || (node.dirty ?? false) === dirty) return;
    // Editor-transient build-freshness flag ONLY. It does NOT schedule the
    // durable server autosave or flip the graph-level `isDirty` — the edit that
    // triggered this already did that via `updateNode`. `dirty` is stripped from
    // the persisted payload (`saveToServer`), so a node never boots dirty
    // without a pending edit (NE-SC-11 is about live build state, not storage).
    set((s) => ({
      nodes: s.nodes.map((n) => (n.nodeId === nodeId ? { ...n, dirty } : n)),
    }));
  },

  updateRootNode: (appNameWorldId: string, patch: Partial<PrismRootNode>) => {
    markGraphDirty(get);
    set((s) => ({
      rootNodes: s.rootNodes.map((r) =>
        r.appNameWorldId === appNameWorldId ? { ...r, ...patch } : r,
      ),
      isDirty: true,
    }));
  },

  removeNode: (nodeId) => {
    markGraphDirty(get);
    set((s) => ({
      nodes: s.nodes.filter((n) => n.nodeId !== nodeId),
      edges: s.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
      isDirty: true,
    }));
  },

  addEdge: (edge) => {
    markGraphDirty(get);
    set((s) => ({ edges: [...s.edges, edge], isDirty: true }));
  },

  removeEdge: (predicate) => {
    markGraphDirty(get);
    set((s) => ({ edges: s.edges.filter((e) => !predicate(e)), isDirty: true }));
  },

  addHub: (hub) => {
    markGraphDirty(get);
    set((s) => ({ hubs: [...s.hubs, hub], isDirty: true }));
  },

  setScenePosition: (nodeId, patch) => {
    markGraphDirty(get);
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

  // STEP8 canvas-toolbar Selection group (canvas-spec §14). Mint one groupId
  // and stamp it on each listed node. Modeled as a shared `groupId` marker (a
  // contains-subtree), never an edge — graph topology rules are untouched
  // (INV-1). No-op (returns '') for <2 resolvable nodes.
  groupNodes: (nodeIds) => {
    const resolvable = nodeIds.filter((id) =>
      get().nodes.some((n) => n.nodeId === id),
    );
    if (resolvable.length < 2) return '';
    const groupId = `grp-${generateNodeId()}`;
    const idSet = new Set(resolvable);
    markGraphDirty(get);
    set((s) => ({
      nodes: s.nodes.map((n) => (idSet.has(n.nodeId) ? { ...n, groupId } : n)),
      isDirty: true,
    }));
    return groupId;
  },

  // STEP8 — Ungroup. Clear `groupId` on every member; each node retains its own
  // scenePosition so its world transform survives (canvas-spec §14).
  ungroupNodes: (groupId) => {
    if (!groupId) return;
    const hasMembers = get().nodes.some((n) => n.groupId === groupId);
    if (!hasMembers) return;
    markGraphDirty(get);
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.groupId === groupId ? { ...n, groupId: undefined } : n,
      ),
      isDirty: true,
    }));
  },

  // STEP8 — toolbar Selection "Lock"/"Unlock".
  setNodeLocked: (nodeId, locked) => {
    const node = get().nodes.find((n) => n.nodeId === nodeId);
    if (!node || (node.locked ?? false) === locked) return;
    markGraphDirty(get);
    set((s) => ({
      nodes: s.nodes.map((n) => (n.nodeId === nodeId ? { ...n, locked } : n)),
      isDirty: true,
    }));
  },

  markDirty: (dirty = true) => {
    if (dirty) {
      markGraphDirty(get);
    } else {
      clearAutosaveTimer();
    }
    set({ isDirty: dirty });
  },

  saveToServer: async () => {
    const s = get();
    const saveVersion = dirtyVersion;
    // The server expects HomeHubJson shape: { schemaVersion, hub, nodes, edges }.
    // FIDELITY-2 W3 (INV-18 additive): when the store carries MORE than one
    // hub, persist ALL of them via the optional `hubs` array (multi-hub wire
    // format) while keeping `hub: hubs[0]` for backward compat. A single-hub
    // store sends the exact legacy payload (no `hubs` key) — bit-for-bit
    // unchanged.
    const hub = s.hubs[0];
    if (!hub) {
      set({ isDirty: true });
      return { ok: false, error: 'no hub to persist' };
    }
    const multiHub = s.hubs.length > 1;
    const hubIds = new Set(s.hubs.map((h) => h.hubId));
    const graph: HomeHubJson = {
      schemaVersion: '0.1.0',
      hub,
      ...(multiHub ? { hubs: s.hubs } : {}),
      // STEP5 — strip the editor-transient `dirty` build-freshness flag from the
      // persisted payload so a node never boots dirty on reload without a real
      // pending edit. `dirty` is live build state, not durable graph data.
      // Multi-hub: include every node whose parentHubId belongs to a persisted
      // hub (same orphan-stripping semantics, widened to all hubs).
      nodes: s.nodes
        .filter((n) => (multiHub ? hubIds.has(n.parentHubId) : n.parentHubId === hub.hubId))
        .map(({ dirty: _dirty, ...n }) => n as PrismNode),
      edges: s.edges,
      // EBR2-E-04 fix — SC-006: the GraphSource invariant ("exactly one
      // PrismRootNode") survives a Save-and-Rebuild round-trip only if the
      // wire payload carries `rootNodes`. Prior persist dropped this field
      // and the server overwrote the canonical seed without it, silently
      // violating SC-006 on every save.
      rootNodes: s.rootNodes,
    };
    let res: Response;
    try {
      res = await fetch('/api/prism/regen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'persist', graph }),
      });
    } catch (err) {
      set({ isDirty: true });
      return { ok: false, error: (err as Error).message };
    }
    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch { /* ignore */ }
      set({ isDirty: true });
      return { ok: false, error: `HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}` };
    }
    let json: { ok?: boolean; regeneratedAt?: string; error?: string } = {};
    try { json = (await res.json()) as typeof json; } catch (err) {
      set({ isDirty: true });
      return { ok: false, error: `invalid JSON: ${(err as Error).message}` };
    }
    if (json.ok !== true) {
      set({ isDirty: true });
      return { ok: false, error: json.error ?? 'regen returned ok=false' };
    }
    const savedAt = json.regeneratedAt ?? new Date().toISOString();
    set({ isDirty: dirtyVersion !== saveVersion, savedAt });
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
        // EBR2-E-04 fix — without threading rootNodes here, the eager init
        // left the store at `rootNodes: []` even when the loaded graph
        // carries App_Name_World. saveToServer then echoed `[]` back to
        // disk and quietly violated SC-006 on every Save round-trip.
        rootNodes: graph.rootNodes ?? [],
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
