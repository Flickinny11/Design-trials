"use client";

/**
 * EDITOR-EXP P7 (C32 / C34) — coherence layer for the undo/redo timeline.
 *
 * zundo's `temporal.undo/redo` restores the *partialized schema* slice
 * (`{ hubs, nodes, edges, rootNodes }`) onto `useGraphSourceStore` via the raw
 * zustand set. That bypasses the store's own mutators, so on its own a temporal
 * restore is INERT in two ways that would cause divergence:
 *
 *   1. The 1s debounced server autosave never re-fires → the reverted state is
 *      not persisted (C32.a).
 *   2. The BUILT scene keeps its stale `THREE.Object3D` artifacts → the visual
 *      contradicts the restored schema (C32.b). The scene re-realizes a node
 *      only when its keyed wrapper remounts, i.e. when
 *      `useGraphEditorStore.bumpNodeRebuildVersion(nodeId)` is called and the
 *      cached artifact is evicted.
 *   3. A pending preview overlay (`usePreviewStateStore`) would keep ghosting an
 *      edit that the restore just undid (C34).
 *
 * Every consumer (the global Cmd+Z/Cmd+Shift+Z keybinds and the History panel's
 * jump-to-state) MUST route through these wrappers, never call
 * `temporal.undo/redo` directly, so the three coherence steps always run.
 *
 * This module lives under lib/editor (NOT an Inspector or panels file), so
 * FP-15 does not apply; and it touches `useGraphEditorStore` only by CALLING the
 * existing `bumpNodeRebuildVersion` action — it never edits that store's file.
 */

import {
  useGraphSourceStore,
  _spliceHistoryMeta,
  _setOnNewEditRecorded,
} from "@/stores/useGraphSourceStore";
import { useGraphEditorStore } from "@/stores/useGraphEditorStore";
import { usePreviewStateStore } from "@/stores/usePreviewStateStore";
import { evictArtifactCacheEntry } from "@/components/editor/graph/ArtifactNode";
import { computeNodeContentHash } from "@/lib/editor/node-content-hash";
import type { PrismNode } from "@/lib/prism-graph/types";

// Mirror stack for the description metadata of states that have been undone
// (and could be redone). Kept module-local + in lockstep with the source
// store's `historyMeta` via the coherent wrappers below.
const futureMeta: { description: string; timestamp: number }[] = [];

// A new edit (recorded via the store's `onSave`) truncates zundo's redo branch,
// so the futureMeta mirror must be wiped in lockstep. Register the callback at
// module load — both modules are 'use client' editor code loaded together.
_setOnNewEditRecorded(() => {
  futureMeta.length = 0;
});

function nodeMapByContentHash(nodes: PrismNode[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const n of nodes) {
    try {
      m.set(n.nodeId, computeNodeContentHash(n));
    } catch {
      // computeNodeContentHash should never throw on a valid node; if it does,
      // treat the node as "changed" by stamping a unique marker so the rebuild
      // path still re-realizes it rather than silently skipping.
      m.set(n.nodeId, `__unhashable__${Math.random()}`);
    }
  }
  return m;
}

/**
 * Run the three coherence steps after a temporal restore mutated the source
 * graph. `before` is the snapshot of `nodes` taken immediately BEFORE the
 * temporal op ran; `after` is read live from the store.
 */
function reconcileAfterRestore(before: PrismNode[]): void {
  const editor = useGraphEditorStore.getState();
  const after = useGraphSourceStore.getState().nodes;

  // (C32.b) — diff the schema by per-node content hash. Any node whose build-
  // relevant content changed (added, removed, or mutated) gets its artifact
  // evicted + rebuild-version bumped so the keyed AssembledSceneNode wrapper
  // remounts and `createNode` re-realizes it from the restored schema. Nodes
  // that are byte-identical across the restore keep their stable Object3D
  // identity (no needless dispose/remount).
  const beforeHashes = nodeMapByContentHash(before);
  const afterHashes = nodeMapByContentHash(after);

  const touched = new Set<string>();
  for (const [id, h] of afterHashes) {
    if (beforeHashes.get(id) !== h) touched.add(id);
  }
  for (const id of beforeHashes.keys()) {
    if (!afterHashes.has(id)) touched.add(id); // removed by the restore
  }

  for (const id of touched) {
    evictArtifactCacheEntry(id);
    editor.bumpNodeRebuildVersion(id);
  }

  // (C34) — a pending preview overlay would keep ghosting an edit the restore
  // just reverted. Clearing every buffered patch reconciles the ghost with the
  // restored source so the rendered `source ⊕ preview` reads the restored
  // schema unmodified. (discardAll, not per-node, because an undo can move the
  // whole graph; the user's in-flight tweak is intentionally dropped — the
  // restored state is now authoritative.)
  usePreviewStateStore.getState().discardAll();

  // (C32.a) — re-fire the durable autosave so the server persists the reverted
  // state. `markDirty()` flips graph-level isDirty AND schedules the existing 1s
  // debounced autosave in useGraphSourceStore.
  useGraphSourceStore.getState().markDirty(true);
}

/** True iff there is at least one past state to undo into. */
export function canUndo(): boolean {
  return useGraphSourceStore.temporal.getState().pastStates.length > 0;
}

/** True iff there is at least one future state to redo into. */
export function canRedo(): boolean {
  return useGraphSourceStore.temporal.getState().futureStates.length > 0;
}

/**
 * C32 — coherent undo. Steps the temporal store back one state, then runs the
 * three coherence steps. No-op when there is nothing to undo.
 */
export function coherentUndo(): void {
  const temporal = useGraphSourceStore.temporal.getState();
  if (temporal.pastStates.length === 0) return;
  const before = useGraphSourceStore.getState().nodes;
  // The metadata entry for the state we are leaving moves from past → future so
  // the panel's "redo" affordance can re-label it. Pop the last past-meta and
  // push it onto a future-meta stack mirror.
  _spliceHistoryMeta((log) => {
    const m = log.pop();
    if (m) futureMeta.push(m);
  });
  temporal.undo(1);
  reconcileAfterRestore(before);
}

/**
 * C32 — coherent redo. Steps the temporal store forward one state, then runs the
 * three coherence steps. No-op when there is nothing to redo.
 */
export function coherentRedo(): void {
  const temporal = useGraphSourceStore.temporal.getState();
  if (temporal.futureStates.length === 0) return;
  const before = useGraphSourceStore.getState().nodes;
  _spliceHistoryMeta((log) => {
    const m = futureMeta.pop();
    if (m) log.push(m);
  });
  temporal.redo(1);
  reconcileAfterRestore(before);
}

/**
 * C33 — jump to an arbitrary point in the timeline. `pastIndex` indexes into
 * `temporal.pastStates` (0 = oldest). Jumping to a past index N undoes
 * (pastStates.length - N) steps; jumping into the future (negative offset
 * semantics) redoes. Implemented by repeatedly calling the single-step coherent
 * wrappers so every intermediate restore still runs the coherence steps and the
 * meta log stays in lockstep — then one final reconcile is implied by the last
 * step. `target` is expressed as a signed step count: negative = undo that many,
 * positive = redo that many.
 */
export function coherentJumpBy(steps: number): void {
  if (steps < 0) {
    for (let i = 0; i < -steps; i += 1) coherentUndo();
  } else if (steps > 0) {
    for (let i = 0; i < steps; i += 1) coherentRedo();
  }
}

/** Read-only snapshot of the redo-able metadata (oldest-undone first → newest). */
export function getFutureMeta(): readonly {
  description: string;
  timestamp: number;
}[] {
  // futureMeta is a stack (last pushed = most-recently undone). The panel wants
  // chronological order (the next redo target last), so present it reversed.
  return [...futureMeta].reverse();
}
