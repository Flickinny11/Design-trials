'use client';

/**
 * EBR2-E-04 / §R2-E SC-074 + INV-26 + RA-16 — Save and Rebuild orchestration.
 *
 * Single-node visual artifact re-render: persists the preview overlay to the
 * source store (the "Save" half via `commitPreviewToSource` — keeps FP-15's
 * Inspector→source indirection intact), evicts the cached artifact Object3D
 * for that node (running its `userData.cleanup()` to release GPU resources
 * and kill GSAP timelines per INV-14), and bumps the per-node rebuild-version
 * counter in `useGraphEditorStore`. The `AssembledSceneNode` parent in
 * `GraphScene.tsx` keys its child by `nodeId + ':' + version`, so the bump
 * remounts *exactly one* wrapper group on the next render frame — the
 * factory re-runs (synchronous `createNode`, INV-14 / renderer-migration §8),
 * a fresh `THREE.Object3D` lands at the same `scenePosition` (untouched on
 * the source record), and other nodes' Object3D references stay stable
 * (RA-16 / SC-074: "Other nodes' `THREE.Object3D` references are stable").
 *
 * INV-26 — Full `.prism` artifact rebuilds remain a build-time operation
 * (`npm run build:prism`) and are NOT invoked from inside the app.
 */

import { commitPreviewToSource } from '@/lib/editor/preview-commit';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { evictArtifactCacheEntry } from '@/components/editor/graph/ArtifactNode';
import { computeNodeContentHash } from '@/lib/editor/node-content-hash';
import { useBuiltSnapshotStore } from '@/stores/useBuiltSnapshotStore';

export interface RebuildNodeResult {
  rebuilt: boolean;
}

export function rebuildNode(nodeId: string): RebuildNodeResult {
  const exists = useGraphSourceStore.getState().nodes.some((n) => n.nodeId === nodeId);
  if (!exists) return { rebuilt: false };
  // (1) Save — flush the preview overlay through the legal FP-15 indirection
  // so the rebuilt factory reads the just-committed config (and the existing
  // 1s debounced autosave picks the change up for the server).
  commitPreviewToSource(nodeId);
  // (2) INV-R7 / RT-SC-09 gate — "a snapshot is rebuilt IFF its content hash
  // changes". Compute the just-committed node's content hash and compare it to
  // the hash of the node's current builtSnapshot. If nothing build-relevant
  // changed, there is nothing to rebuild: clear dirty and return without a
  // dispose/remount (no wasted createNode). The first build of a node has no
  // prior snapshot, so it always proceeds.
  const node = useGraphSourceStore.getState().nodes.find((n) => n.nodeId === nodeId);
  const newHash = node ? computeNodeContentHash(node) : null;
  const prevSnap = useBuiltSnapshotStore.getState().get(nodeId);
  if (prevSnap && newHash !== null && prevSnap.hash === newHash) {
    useGraphSourceStore.getState().markNodeDirty(nodeId, false);
    return { rebuilt: false };
  }
  // (3) Dispose — userData.cleanup() on every cached Object3D for this node
  // and drop the cache entries so the next render re-invokes createNode.
  evictArtifactCacheEntry(nodeId);
  // (4) Remount signal — increment this node's rebuild-version. The keyed
  // AssembledSceneNode wrapper remounts only this node; siblings' wrapper
  // groups (and their THREE.Object3D references) stay stable.
  useGraphEditorStore.getState().bumpNodeRebuildVersion(nodeId);
  // (5) STEP5 edit-path (NE-SC-11, canvas-spec §6 Dirty→Built): the artifact was
  // just rebuilt, so the node's built-state is fresh again. Clear the dirty
  // flag. The remount re-runs the factory (ArtifactNode.resolveArtifactObject),
  // which verifies the new artifact, runs caption-driven repair on failure, and
  // refreshes ONLY this node's builtSnapshot entry.
  useGraphSourceStore.getState().markNodeDirty(nodeId, false);
  return { rebuilt: true };
}
