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
  // (2) Dispose — userData.cleanup() on every cached Object3D for this node
  // and drop the cache entries so the next render re-invokes createNode.
  evictArtifactCacheEntry(nodeId);
  // (3) Remount signal — increment this node's rebuild-version. The keyed
  // AssembledSceneNode wrapper remounts only this node; siblings' wrapper
  // groups (and their THREE.Object3D references) stay stable.
  useGraphEditorStore.getState().bumpNodeRebuildVersion(nodeId);
  return { rebuilt: true };
}
