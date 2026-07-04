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
// EDITOR-EXP P7 (C32) — zundo temporal middleware gives useGraphSourceStore an
// undo/redo timeline. It is a pure zustand middleware (no renderer, fits the
// repo's zustand ^5), allowlisted in dependency-allowlist-check.py.
import { temporal } from 'zundo';
import type { TemporalState, ZundoOptions } from 'zundo';
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
  // §13 prebuilt element library (criterion 21). Batch-create many nodes in ONE
  // commit (single dirty-cycle + single autosave schedule + single re-render) so
  // drag-to-place instantiates a whole cluster atomically. Each input is the
  // same shape `addNode` takes (flows through applyPlanRendererDefaults); a
  // pre-stamped shared `groupId` makes the placed nodes a group. Returns the
  // minted node ids in input order. Additive (INV-18), non-topological (INV-1).
  addNodesBatch: (inputs: Array<Partial<PrismNode> & { parentHubId: string }>) => string[];
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
  // APP-REALITY P2 (INV-8 additive) — patch a hub's own fields (e.g. the
  // `cameraKeyframes` journey). Mirrors updateNode/updateRootNode: marks the
  // graph dirty + schedules the durable autosave. The shared source of truth.
  updateHub: (hubId: string, patch: Partial<PrismHub>) => void;
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

// ── EDITOR-EXP P7 (C32/C33) — temporal-history scaffolding ──────────────────
//
// `TrackedGraph` is the slice zundo records per undo step. Only durable schema
// data is tracked; editor-transient fields (the graph-level `isDirty`/`error`/
// `ready`/`savedAt` flags, and the per-node build-freshness `dirty` flag) are
// excluded via `partialize` so (a) toggling them never creates a phantom undo
// step and (b) an undo never resurrects a stale `dirty` marker. `locked` and
// `groupId` ARE durable graph data and stay tracked.
export interface TrackedGraph {
  hubs: PrismHub[];
  nodes: PrismNode[];
  edges: PrismEdge[];
  rootNodes: PrismRootNode[];
}

// C33 — a parallel metadata log kept in lockstep with `temporal.pastStates`.
// zundo's `pastStates` are bare partialized snapshots (no labels), so the
// human-readable description + timestamp for each step lives here. `onSave`
// pushes one entry per recorded past-state; the coherence wrappers
// (lib/editor/history-coherence.ts) splice it on undo/redo/jump/clear so
// index `i` of `historyMeta` always describes `pastStates[i]`.
export interface HistoryEntryMeta {
  description: string;
  timestamp: number;
}

const HISTORY_LIMIT = 100;
const HISTORY_DEBOUNCE_MS = 400;

const historyMeta: HistoryEntryMeta[] = [];

// The label the NEXT recorded past-state should carry. Mutators set this right
// before the state change they cause; `onSave` reads + clears it. When unset,
// a generic "Edit" label is used (still timestamped).
let pendingHistoryLabel: string | null = null;

/** Mutators call this to label the undo step their change is about to create. */
function labelNextHistoryStep(label: string): void {
  pendingHistoryLabel = label;
}

/**
 * Read-only accessor for the UI (the EditHistoryPanel). Self-heals against the
 * authoritative `pastStates.length`: the meta log is appended/spliced in
 * lockstep with zundo's pastStates, but a stray `temporal.clear()` (or a
 * boundary edge) could leave it longer. Returning the trailing N entries
 * (N = pastStates.length) keeps the panel's row count exactly aligned with the
 * number of undoable states, so the jump math never indexes a phantom row.
 */
export function getHistoryMeta(): readonly HistoryEntryMeta[] {
  let pastLen = historyMeta.length;
  try {
    pastLen = (useGraphSourceStore.temporal as unknown as {
      getState: () => { pastStates: unknown[] };
    }).getState().pastStates.length;
  } catch {
    /* temporal not ready — fall back to the raw log */
  }
  if (historyMeta.length > pastLen) {
    return historyMeta.slice(historyMeta.length - pastLen);
  }
  return historyMeta;
}

/**
 * Typed accessor for zundo's temporal store. zundo attaches `.temporal` to the
 * zustand store via the `temporal` mutator; this helper hands the UI a strongly
 * typed `TemporalState<TrackedGraph>` (pastStates/futureStates/undo/redo/clear)
 * without each consumer re-deriving the cast.
 */
export function getTemporalStore() {
  return useGraphSourceStore.temporal as unknown as {
    getState: () => TemporalState<TrackedGraph>;
    subscribe: (listener: () => void) => () => void;
  };
}

// A bulk graph load (initial fetch / load / loadFromUrl / reset) must NOT be an
// undoable step — pressing Cmd+Z right after boot should never wipe the app back
// to an empty graph. `runBulkLoad` runs the load with zundo tracking PAUSED so
// no past-state is recorded (zundo's handleSet early-returns while paused, even
// for our debounced wrapper), then clears any residual history + the metadata
// log so the freshly-loaded graph is the clean baseline. Safe only after store
// creation (runtime) — all call sites are action bodies / the eager init.
function runBulkLoad(apply: () => void): void {
  const temporal = useGraphSourceStore.temporal as unknown as {
    getState: () => { pause: () => void; resume: () => void; clear: () => void };
  };
  let paused = false;
  try {
    temporal.getState().pause();
    paused = true;
  } catch {
    /* temporal not ready (should not happen post-creation) — proceed unpaused */
  }
  try {
    apply();
  } finally {
    if (paused) {
      try {
        temporal.getState().clear();
        temporal.getState().resume();
      } catch {
        /* ignore */
      }
    }
    historyMeta.length = 0;
    pendingHistoryLabel = null;
    onNewEditRecorded?.(); // also clears the coherence module's futureMeta mirror
  }
}

/** Internal: history-coherence wrappers reconcile the meta log after a jump. */
export function _spliceHistoryMeta(
  mutate: (log: HistoryEntryMeta[]) => void,
): void {
  mutate(historyMeta);
}

// The coherence module owns a `futureMeta` mirror of zundo's `futureStates`.
// zundo wipes `futureStates` whenever a NEW edit is recorded (a fresh past-
// state truncates the redo branch), so the store must wipe the mirror too. To
// avoid a circular import (coherence → store), the coherence module REGISTERS a
// callback here that `onSave` invokes on every recorded edit.
let onNewEditRecorded: (() => void) | null = null;
export function _setOnNewEditRecorded(cb: (() => void) | null): void {
  onNewEditRecorded = cb;
}

// Human-readable caption for a node id (best-effort; falls back to a short id).
function describeNode(nodeId: string, nodes: PrismNode[]): string {
  const n = nodes.find((x) => x.nodeId === nodeId);
  const cap = n?.intent?.caption?.trim();
  if (cap) return cap;
  return `node ${nodeId.slice(0, 6)}`;
}

// Pick a verb for an updateNode patch from its top-level keys, so the timeline
// reads like "Recolor headline" / "Move Orr Arrival Watch" rather than a raw
// field dump. Falls back to a generic "Edit".
function describeNodePatch(patch: Partial<PrismNode>): string {
  const keys = Object.keys(patch);
  if (keys.includes('scenePosition') || keys.includes('canvasTransform') || keys.includes('editorTransform')) {
    return 'Move';
  }
  if (keys.includes('visual')) return 'Restyle';
  if (keys.includes('intent')) {
    const intent = patch.intent as { caption?: unknown; visualSpec?: unknown } | undefined;
    if (intent && typeof intent.caption === 'string') return 'Rename';
    if (intent && intent.visualSpec) return 'Recolor';
    return 'Edit';
  }
  if (keys.includes('cinematicPrimitives') || keys.includes('renderMode')) return 'Reanimate';
  return 'Edit';
}

export const useGraphSourceStore = create<GraphSourceState>()(temporal(subscribeWithSelector((set, get) => ({
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
      // Bulk load — not undoable (resetHistoryBaseline via runBulkLoad).
      runBulkLoad(() =>
        set({
          hubs: graph.hubs,
          nodes: graph.nodes,
          edges: graph.edges,
          rootNodes: graph.rootNodes ?? [],
          ready: true,
          error: null,
          isDirty: false,
        }),
      );
      clearAutosaveTimer();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ ready: false, error: message });
    }
  },

  loadFromUrl: async (url) => {
    try {
      const graph = await loadFromHomeHubFile(url);
      // Bulk load — not undoable.
      runBulkLoad(() =>
        set({
          hubs: graph.hubs,
          nodes: graph.nodes,
          edges: graph.edges,
          rootNodes: graph.rootNodes ?? [],
          ready: true,
          error: null,
          isDirty: false,
        }),
      );
      clearAutosaveTimer();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ ready: false, error: message });
    }
  },

  reset: () => {
    // Bulk reset — not undoable (you can't Cmd+Z back into a discarded graph).
    runBulkLoad(() =>
      set({
        hubs: [],
        nodes: [],
        edges: [],
        rootNodes: [],
        ready: false,
        error: null,
        isDirty: false,
        savedAt: null,
      }),
    );
    clearAutosaveTimer();
  },

  addNode: (input) => {
    const nodeId = input.nodeId ?? generateNodeId();
    const seeded = applyPlanRendererDefaults({ ...input, nodeId });
    const created = seeded as PrismNode;
    const cap = created.intent?.caption?.trim();
    labelNextHistoryStep(`Add ${cap || created.subtype || 'node'}`);
    markGraphDirty(get);
    set((s) => ({ nodes: [...s.nodes, created], isDirty: true }));
    return nodeId;
  },

  // §13 prebuilt element library (criterion 21) — atomic multi-node create.
  addNodesBatch: (inputs) => {
    if (inputs.length === 0) return [];
    const ids: string[] = [];
    const created = inputs.map((input) => {
      const nodeId = input.nodeId ?? generateNodeId();
      ids.push(nodeId);
      return applyPlanRendererDefaults({ ...input, nodeId }) as PrismNode;
    });
    labelNextHistoryStep(`Add ${created.length} elements`);
    markGraphDirty(get);
    set((s) => ({ nodes: [...s.nodes, ...created], isDirty: true }));
    return ids;
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
    labelNextHistoryStep(`Clone ${source.intent?.caption?.trim() || source.subtype || 'node'}`);
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
    labelNextHistoryStep(`Place ${clone.intent?.caption?.trim() || 'clone'} in ${title}`);
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
    const name = describeNode(nodeId, get().nodes);
    labelNextHistoryStep(`${describeNodePatch(patch)} ${name}`);
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
    labelNextHistoryStep('Edit App World');
    markGraphDirty(get);
    set((s) => ({
      rootNodes: s.rootNodes.map((r) =>
        r.appNameWorldId === appNameWorldId ? { ...r, ...patch } : r,
      ),
      isDirty: true,
    }));
  },

  // APP-REALITY P2 (INV-8 additive) — patch a hub's own fields.
  updateHub: (hubId, patch) => {
    const hub = get().hubs.find((h) => h.hubId === hubId);
    labelNextHistoryStep(`Edit hub ${hub ? hubTitleFor(hub) : hubId.slice(0, 6)}`);
    markGraphDirty(get);
    set((s) => ({
      hubs: s.hubs.map((h) => (h.hubId === hubId ? { ...h, ...patch } : h)),
      isDirty: true,
    }));
  },

  removeNode: (nodeId) => {
    labelNextHistoryStep(`Delete ${describeNode(nodeId, get().nodes)}`);
    markGraphDirty(get);
    set((s) => ({
      nodes: s.nodes.filter((n) => n.nodeId !== nodeId),
      edges: s.edges.filter((e) => e.from !== nodeId && e.to !== nodeId),
      isDirty: true,
    }));
  },

  addEdge: (edge) => {
    labelNextHistoryStep('Connect nodes');
    markGraphDirty(get);
    set((s) => ({ edges: [...s.edges, edge], isDirty: true }));
  },

  removeEdge: (predicate) => {
    labelNextHistoryStep('Remove connection');
    markGraphDirty(get);
    set((s) => ({ edges: s.edges.filter((e) => !predicate(e)), isDirty: true }));
  },

  addHub: (hub) => {
    labelNextHistoryStep(`Add hub ${hubTitleFor(hub)}`);
    markGraphDirty(get);
    set((s) => ({ hubs: [...s.hubs, hub], isDirty: true }));
  },

  setScenePosition: (nodeId, patch) => {
    labelNextHistoryStep(`Move ${describeNode(nodeId, get().nodes)}`);
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
    labelNextHistoryStep(`Group ${resolvable.length} nodes`);
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
    labelNextHistoryStep('Ungroup nodes');
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
    labelNextHistoryStep(`${locked ? 'Lock' : 'Unlock'} ${describeNode(nodeId, get().nodes)}`);
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
      // FINISH-F3 — GLOBAL ELEMENTS (isGlobalElement, parentHubId '') are not
      // hub orphans: they are the app's overlay elements (APP-REALITY P7).
      // The old filter silently dropped them from every save, so the first
      // autosave after boot deleted the overlay cards from the persisted app.
      nodes: s.nodes
        .filter((n) =>
          n.isGlobalElement || (multiHub ? hubIds.has(n.parentHubId) : n.parentHubId === hub.hubId),
        )
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
})),
  // ── EDITOR-EXP P7 (C32) — zundo temporal options ──────────────────────────
  {
    // C32 — keep ≥100 undo steps.
    limit: 100,
    // Track only durable schema graph. Strip the transient flags and the
    // per-node build-freshness `dirty` so undo never resurrects a stale marker
    // and a flag flip never costs an undo step.
    partialize: (state): TrackedGraph => ({
      hubs: state.hubs,
      nodes: state.nodes.map(({ dirty: _dirty, ...n }) => n as PrismNode),
      edges: state.edges,
      rootNodes: state.rootNodes,
    }),
    // Coalesce a burst of edits (e.g. a slider drag firing updateNode on every
    // frame, or rapid typing) into ONE undo step: debounce the snapshot by
    // 400ms. The recorded undo target must be the state from BEFORE the burst
    // began (the FIRST call's pastState), so an undo reverts the whole drag —
    // not just its last frame. We therefore latch the first pastState of a
    // burst and only release it (with the burst's final current/delta) once the
    // edits go quiet for HISTORY_DEBOUNCE_MS.
    handleSet: ((handleSet: (
      pastState: TrackedGraph,
      replace: unknown,
      currentState: TrackedGraph,
      deltaState?: Partial<TrackedGraph> | null,
    ) => void) => {
      // zundo TYPES the received `handleSet` as zustand's 2-arg `setState`, but
      // at RUNTIME it passes the temporal store's 4-arg `_handleSet`
      // (pastState, replace, currentState, deltaState). The cast on the option
      // itself (below) bridges the known quirk so we can forward the burst's
      // final args.
      let t: ReturnType<typeof setTimeout> | null = null;
      let latchedPast: TrackedGraph | null = null;
      return (
        pastState: TrackedGraph,
        replace: unknown,
        currentState: TrackedGraph,
        deltaState?: Partial<TrackedGraph> | null,
      ) => {
        if (latchedPast === null) latchedPast = pastState;
        if (t !== null) clearTimeout(t);
        t = setTimeout(() => {
          t = null;
          const past = latchedPast as TrackedGraph;
          latchedPast = null;
          handleSet(past, replace, currentState, deltaState);
        }, HISTORY_DEBOUNCE_MS);
      };
    }) as ZundoOptions<GraphSourceState, TrackedGraph>['handleSet'],
    // Drop no-op steps: if the tracked schema is byte-identical, don't record.
    // (Guards against transient-only sets slipping past partialize.)
    equality: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    // C33 — stamp the parallel metadata log each time a past-state is pushed.
    // `onSave(pastState, currentState)` runs once per recorded step; we read +
    // clear the pending label set by the mutator that caused the change.
    onSave: () => {
      const description = pendingHistoryLabel ?? 'Edit';
      pendingHistoryLabel = null;
      historyMeta.push({ description, timestamp: Date.now() });
      // Keep the meta log bounded in lockstep with the 100-step limit. zundo
      // shifts the oldest pastState off the front when it overflows, so we
      // mirror that here (drop oldest meta entries beyond the limit).
      while (historyMeta.length > HISTORY_LIMIT) historyMeta.shift();
      // A new edit truncates zundo's redo branch (futureStates := []); wipe the
      // coherence module's futureMeta mirror in lockstep.
      onNewEditRecorded?.();
    },
  },
));

// Eager init: fetch the canonical live graph (the file /api/prism/regen
// writes back to). The `'use client'` directive at the top of the file
// keeps the module out of server bundles, but we still gate on `window`
// to avoid SSR fetches and to stay safe if the file is imported
// transitively from server code in the future.
if (typeof window !== 'undefined') {
  void loadFromHomeHubFile('/prism-mock/home/live-graph.json').then(
    (graph) => {
      // EDITOR-EXP P7 — the eager boot load is the history baseline, not an
      // undoable step. Run it through runBulkLoad so Cmd+Z right after boot
      // can't revert into the empty pre-fetch graph.
      runBulkLoad(() =>
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
        }),
      );
    },
    (e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      useGraphSourceStore.setState({ ready: false, error: message });
    },
  );
}
