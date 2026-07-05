'use client';

/**
 * STEP5 edit-path — builtSnapshot cache (runtime-spec §7, canvas-spec §11,
 * RT-SC-08 / RT-SC-09).
 *
 * "Every node stores a `builtSnapshot` keyed by a content hash over its
 *  build-relevant inputs … Canvas and preview-app load snapshots instantly. A
 *  snapshot is rebuilt iff its content hash changes. A single-node edit +
 *  rebuild evicts and recomputes only that node's snapshot; sibling snapshots
 *  are untouched."
 *
 * This store is the per-node snapshot registry. The editor artifact factory
 * (`ArtifactNode.resolveArtifactObject`) records into it every time it actually
 * (re)builds a node — recording the content hash, the verify status, and any
 * repair that fired. Because the surgical rebuild remounts exactly one node,
 * exactly one snapshot entry changes per Save-and-Rebuild; every other node's
 * `hash` is byte-identical to before. That property is what the STEP5
 * "only the edited node's snapshot changed" assertion reads.
 *
 * It is ALSO the build-health source the Inspector subscribes to for the
 * dirty / built / repaired / failed badge, and the window bridge
 * (`window.__prismBuiltSnapshots`) the functional-verification layer reads via
 * Chrome DevTools MCP / KripVerify `kv_evaluate`.
 *
 * NOTE: this is an editor-shell store (not a runtime/node module), so the
 * `window` bridge is permitted (FP-R11/FP-05 scope only `src/lib/prism/runtime`
 * + node modules + `components/prism-player`). It mirrors the existing
 * `window.__artifactBuildCount` diagnostic in `ArtifactNode.tsx`.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export type BuiltSnapshotStatus = 'built' | 'repaired' | 'failed';

export interface BuiltSnapshot {
  nodeId: string;
  /** Content hash over build-relevant inputs (node-content-hash.ts). */
  hash: string;
  layout: string;
  status: BuiltSnapshotStatus;
  /** Machine reason when status !== 'built' (e.g. 'fallback-stand-in'). */
  reason?: string;
  /** Repair strategy taken when status === 'repaired'. */
  repairStrategy?: string;
  /** Monotonic build sequence (not wall-clock — stable, ordering-only). */
  builtAt: number;
  /** How many times this node has (re)built since load. */
  buildCount: number;
}

export type RecordInput = Omit<BuiltSnapshot, 'builtAt' | 'buildCount'>;

/** Cap on the append-only history so a long editing session cannot grow it
 *  without bound. The metadata library keeps the most recent builds; older
 *  entries roll off (the live `snapshots` map always holds the current state). */
const HISTORY_LIMIT = 500;

interface BuiltSnapshotState {
  /** Current builtSnapshot per node (last-write-wins; fast lookup). */
  snapshots: Record<string, BuiltSnapshot>;
  /** Append-only log of every (re)built snapshot, oldest→newest (INV-R7 /
   *  canvas §11 "superseded snapshots persist in the artifact library so prior
   *  built states remain recoverable"). The prototype retains snapshot
   *  *metadata* (hash + status + build sequence); the disposed Object3D itself
   *  is not retained (that would leak GPU memory), but the record of each prior
   *  built state — and which content hash produced it — is recoverable here. */
  history: BuiltSnapshot[];
  record: (input: RecordInput) => void;
  get: (nodeId: string) => BuiltSnapshot | undefined;
  /** Prior built snapshots for a node, oldest→newest (excludes none — the
   *  current entry is the last element). */
  historyFor: (nodeId: string) => BuiltSnapshot[];
  reset: () => void;
}

let buildSeq = 0;

export const useBuiltSnapshotStore = create<BuiltSnapshotState>()(
  subscribeWithSelector((set, getState) => ({
    snapshots: {},
    history: [],
    record: (input) =>
      set((s) => {
        const prev = s.snapshots[input.nodeId];
        const next: BuiltSnapshot = {
          ...input,
          builtAt: ++buildSeq,
          buildCount: (prev?.buildCount ?? 0) + 1,
        };
        const history = [...s.history, next];
        // Append-only, bounded: drop the oldest once over the cap.
        if (history.length > HISTORY_LIMIT) history.splice(0, history.length - HISTORY_LIMIT);
        return { snapshots: { ...s.snapshots, [input.nodeId]: next }, history };
      }),
    get: (nodeId) => getState().snapshots[nodeId],
    historyFor: (nodeId) => getState().history.filter((h) => h.nodeId === nodeId),
    reset: () => {
      buildSeq = 0;
      set({ snapshots: {}, history: [] });
    },
  })),
);

/** Install a read-only window bridge so the functional-verification layer
 *  (Chrome DevTools MCP / KripVerify `kv_evaluate`) can snapshot the registry
 *  and assert which node's hash changed across a rebuild. Editor-shell scope
 *  only; safe to call from a browser effect. */
export function installBuiltSnapshotBridge(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as {
    __prismBuiltSnapshots?: () => Record<string, BuiltSnapshot>;
    __prismBuiltSnapshotHistory?: () => BuiltSnapshot[];
  };
  w.__prismBuiltSnapshots = () => useBuiltSnapshotStore.getState().snapshots;
  w.__prismBuiltSnapshotHistory = () => useBuiltSnapshotStore.getState().history;
}
