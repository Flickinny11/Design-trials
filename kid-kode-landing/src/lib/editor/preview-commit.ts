'use client';

/**
 * EBR2-E-03 / §R2-E SC-072 + SC-073 — the legal seam between
 * `usePreviewStateStore` (Inspector tab write surface) and
 * `useGraphSourceStore` (durable graph + 1s debounced autosave).
 *
 * FP-15 forbids files matching `**\/Inspector*.tsx` or `**\/panels/*Tab.tsx`
 * from calling `useGraphSourceStore.getState().updateNode` directly. This
 * helper is the only legal indirection: the Save button (and any future
 * Save-and-Rebuild flow) call `commitPreviewToSource(nodeId)`; the helper
 * pulls the patch off the preview store, copies it onto the source store
 * via `updateNode`, and the existing 1s autosave in `useGraphSourceStore`
 * flushes to the server.
 *
 * Contract:
 *   - Returns `{ committed: false, patch: null }` when the preview buffer
 *     is empty for `nodeId` (no-op).
 *   - Returns `{ committed: true, patch }` when a non-empty patch existed.
 *     The preview buffer for `nodeId` is cleared (per SC-073, single-node
 *     clear; other nodes' buffers stay intact — that semantics belongs to
 *     `usePreviewStateStore.commit`).
 *   - Calls `useGraphSourceStore.getState().updateNode(nodeId, patch)`,
 *     which marks the source dirty and schedules the existing autosave.
 */

import type { PrismNode } from '@/lib/prism-graph/types';
import { usePreviewStateStore } from '@/stores/usePreviewStateStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';

export interface CommitPreviewResult {
  committed: boolean;
  patch: Partial<PrismNode> | null;
}

export function commitPreviewToSource(nodeId: string): CommitPreviewResult {
  const patch = usePreviewStateStore.getState().commit(nodeId);
  if (patch === null) return { committed: false, patch: null };
  useGraphSourceStore.getState().updateNode(nodeId, patch);
  return { committed: true, patch };
}
