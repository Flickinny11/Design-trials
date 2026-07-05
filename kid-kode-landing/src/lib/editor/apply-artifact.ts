'use client';

// CANVAS-FINAL — apply a Change Artifact swap / restore to a node through the
// SANCTIONED edit path (canvas-spec §12.2 "Use This"; criterion 20). Mirrors
// ImageFlyout's replace idiom exactly: source-store updateNode (the toolbar is
// not an Inspector tab, so it writes the source store directly — the same rule
// Transform/Image/Lighting use), then the surgical Save-and-Rebuild
// (rebuild-node) so ONE node remounts and siblings' Object3D refs stay stable.
//
// The prior artifact is retained in node.artifactLibrary BEFORE the swap
// (buildArtifactSwap snapshots it), so "Use This" never loses the outgoing
// artifact (§11 append-only library). Restore is symmetric (the then-current
// artifact is retained in turn).

import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { rebuildNode } from '@/lib/editor/rebuild-node';
import {
  buildArtifactRestore,
  buildArtifactSwap,
  type ArtifactPayload,
} from '@/lib/editor/artifact-library';
import type { ArtifactLibraryEntry } from '@/lib/prism-graph/types';

/** Install `payload` as the node's active artifact (Use This). Retains the
 *  node's prior artifact in its library, then rebuilds the single node.
 *  Returns false if the node no longer exists. */
export function applyArtifactSwap(nodeId: string, payload: ArtifactPayload): boolean {
  const node = useGraphSourceStore.getState().nodes.find((n) => n.nodeId === nodeId);
  if (!node) return false;
  const { patch } = buildArtifactSwap(node, payload, { retainPrior: true });
  useGraphSourceStore.getState().updateNode(nodeId, patch);
  rebuildNode(nodeId);
  return true;
}

/** Restore a prior artifact from the node's library (the then-current artifact
 *  is retained in turn — append-only, never lossy). */
export function restoreArtifact(nodeId: string, entry: ArtifactLibraryEntry): boolean {
  const node = useGraphSourceStore.getState().nodes.find((n) => n.nodeId === nodeId);
  if (!node) return false;
  const { patch } = buildArtifactRestore(node, entry);
  useGraphSourceStore.getState().updateNode(nodeId, patch);
  rebuildNode(nodeId);
  return true;
}
