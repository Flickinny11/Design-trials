'use client';

/**
 * usePreviewStateStore — ephemeral per-node edit buffer.
 *
 * EBR2-E-01 / §R2-E SC-072 (with SC-073 setting commit semantics):
 *   Inspector tab fader/knob writes route through this store, not directly
 *   through `useGraphSourceStore.updateNode` (FP-15 enforces the routing in
 *   EBR2-E-02). The renderer reads `sourceNode ⊕ peek(nodeId)` so live
 *   preview is real-time; "Save" (EBR2-E-03) commits the buffer → source
 *   store and clears the buffer for that node, after which the existing 1s
 *   debounced autosave on `useGraphSourceStore` persists to the server.
 *
 * Surface (frozen by EBR2-E-01.preview-state-store.test.ts haltCheck):
 *   - set(nodeId, patch)   merge patch into the buffer for nodeId
 *   - peek(nodeId)         return current patch or null
 *   - isDirty(nodeId)      true iff a non-empty patch exists for nodeId
 *   - commit(nodeId)       return current patch and clear that node's buffer
 *   - discard(nodeId)      clear that node's buffer
 *   - discardAll()         clear every buffered patch (test/teardown only)
 *
 * Purity: in-memory only. No localStorage, no IndexedDB, no network. The
 * source store owns persistence; this store owns the live-preview overlay.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { PrismNode } from '@/lib/prism-graph/types';

export type PreviewNodePatch = Partial<PrismNode>;

interface PreviewStateStore {
  patches: Record<string, PreviewNodePatch>;
  set: (nodeId: string, patch: PreviewNodePatch) => void;
  peek: (nodeId: string) => PreviewNodePatch | null;
  isDirty: (nodeId: string) => boolean;
  commit: (nodeId: string) => PreviewNodePatch | null;
  discard: (nodeId: string) => void;
  discardAll: () => void;
}

function isEmptyPatch(patch: PreviewNodePatch): boolean {
  return Object.keys(patch).length === 0;
}

/**
 * EBR2-E-02 / §R2-E SC-072 — Pure helper: compose a source PrismNode with
 * its preview-state patch (if any) so the renderer reads
 * `sourceNode ⊕ previewState[nodeId]` in a single value. Returns the source
 * node unchanged when `patch` is null/empty; otherwise returns a shallow
 * merge of `node` and `patch`. Never mutates `node`.
 *
 * Intentionally a shallow merge: the preview patch is whole-field replacement
 * (e.g. `canvasTransform`, `caption`); deeper structural merges would mask
 * intent at the call site. Inspector tabs that want to update one sub-field
 * (e.g. just `canvasTransform.x`) construct the full sub-object before
 * calling `set()`.
 */
export function composeNodeWithPreview(
  node: PrismNode,
  patch: PreviewNodePatch | null,
): PrismNode {
  if (patch === null || isEmptyPatch(patch)) return node;
  return { ...node, ...patch };
}

export const usePreviewStateStore = create<PreviewStateStore>()(
  subscribeWithSelector((zSet, get) => ({
    patches: {},

    set: (nodeId, patch) => {
      if (isEmptyPatch(patch)) return;
      zSet((state) => {
        const prev = state.patches[nodeId];
        const merged: PreviewNodePatch = prev ? { ...prev, ...patch } : { ...patch };
        return { patches: { ...state.patches, [nodeId]: merged } };
      });
    },

    peek: (nodeId) => {
      const patch = get().patches[nodeId];
      return patch ?? null;
    },

    isDirty: (nodeId) => {
      const patch = get().patches[nodeId];
      return patch !== undefined && !isEmptyPatch(patch);
    },

    commit: (nodeId) => {
      const patch = get().patches[nodeId];
      if (patch === undefined) return null;
      zSet((state) => {
        const next = { ...state.patches };
        delete next[nodeId];
        return { patches: next };
      });
      return patch;
    },

    discard: (nodeId) => {
      if (get().patches[nodeId] === undefined) return;
      zSet((state) => {
        const next = { ...state.patches };
        delete next[nodeId];
        return { patches: next };
      });
    },

    discardAll: () => {
      zSet({ patches: {} });
    },
  }))
);
