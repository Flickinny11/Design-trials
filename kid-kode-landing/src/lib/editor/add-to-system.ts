'use client';

/**
 * STEP8 canvas-toolbar Build group — "Add to System" (canvas-spec §5, §6
 * lifecycle Built→In System; §15.2 captions-as-the-bridge; SC-7).
 *
 * "On Add to System: caption written into the graph (builder-visible)." For a
 * text node the caption is *self-derived* from its properties (§7.6, no VLM);
 * for a visual node the canonical spec re-captions via an in-browser VLM at
 * liveness and a cloud VLM at build-finalize (§15.3). Neither VLM ships in this
 * prototype, so Add-to-System composes a deterministic **self-caption** from the
 * node's own authored properties (subtype, role, the just-authored transform)
 * and clears the node's `dirty` build-freshness flag — the same observable
 * contract the criteria read (caption refreshed + dirty cleared). When the VLM
 * lands it replaces `composeSelfCaption` for visual nodes; the surface here is
 * unchanged.
 *
 * Routing: this is NOT an Inspector tab, so FP-15 does not apply — it writes
 * through `useGraphSourceStore.updateNode` directly (the legitimate authoring
 * path), mirroring `clone-commit.ts` and `rebuild-node.ts`.
 */

import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import type { PrismNode } from '@/lib/prism-graph/types';

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Compose a deterministic, human-legible self-caption from a node's own
 * properties. Pure — no store access, no I/O — so it is unit-testable and the
 * AI round-trip (§15.2) can read the same string.
 */
export function composeSelfCaption(node: PrismNode): string {
  const role = (node.subtype || 'element').replace(/[-_]/g, ' ').trim();
  const sp = node.scenePosition;
  const parts: string[] = [];
  parts.push(role.charAt(0).toUpperCase() + role.slice(1));
  if (node.renderMode && node.renderMode !== 'sprite') {
    parts.push(`(${node.renderMode})`);
  }
  if (sp) {
    parts.push(
      `at [${round(sp.x ?? 0)}, ${round(sp.y ?? 0)}, ${round(sp.z ?? 0)}]`,
    );
    const sx = sp.scaleX ?? 1;
    const sy = sp.scaleY ?? 1;
    const sz = sp.scaleZ ?? 1;
    if (sx !== 1 || sy !== 1 || sz !== 1) {
      parts.push(`scaled ${round(sx)}×${round(sy)}×${round(sz)}`);
    }
  }
  return parts.join(' ');
}

export interface AddToSystemResult {
  ok: boolean;
  caption?: string;
}

/**
 * Add-to-System: re-caption the node from its current properties and clear its
 * `dirty` build-freshness flag. Returns the new caption for UI feedback.
 */
export function addNodeToSystem(nodeId: string): AddToSystemResult {
  const store = useGraphSourceStore.getState();
  const node = store.nodes.find((n) => n.nodeId === nodeId);
  if (!node) return { ok: false };
  const caption = composeSelfCaption(node);
  store.updateNode(nodeId, {
    intent: { ...node.intent, caption },
  });
  // Build freshness: the node is now (re-)captioned and in system.
  store.markNodeDirty(nodeId, false);
  return { ok: true, caption };
}
