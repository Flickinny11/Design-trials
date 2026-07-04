import type { PrismNode } from './types';
import { getGalaxyNodeRole } from './galaxy-semantics';

export interface AssembledNodeScope {
  activeHubId: string | null;
  nodes: PrismNode[];
  hubNodes: PrismNode[];
  globalSlotNodes: PrismNode[];
  hiddenDuplicateChromeIds: string[];
}

export function isRenderableGlobalSlotNode(node: PrismNode): boolean {
  return !node.isGlobalElement && (node.globalSlot === 'header' || node.globalSlot === 'footer');
}

function normalizeShellId(nodeId: string): string {
  return nodeId.replace(/^shell-\d+_[a-z0-9]+-/i, 'shell-');
}

export function getSharedChromeSignature(node: Pick<PrismNode, 'nodeId' | 'subtype' | 'globalSlot' | 'isGlobalElement' | 'parentHubId'>): string | null {
  const role = getGalaxyNodeRole({
    id: node.nodeId,
    subtype: node.subtype,
    parentHubId: node.parentHubId,
    isGlobalElement: node.isGlobalElement,
    globalSlot: node.globalSlot,
  });
  if (role !== 'app-shell' && role !== 'hit-target') return null;
  return `${role}:${node.subtype}:${normalizeShellId(node.nodeId)}`;
}

export function resolveAssembledNodesForHub(
  sourceNodes: readonly PrismNode[],
  activeHubId: string | null | undefined,
): AssembledNodeScope {
  const hubId = activeHubId ?? null;
  const globalSlotNodes = sourceNodes.filter(isRenderableGlobalSlotNode);
  const globalChromeSignatures = new Set(
    globalSlotNodes
      .map(getSharedChromeSignature)
      .filter((signature): signature is string => Boolean(signature)),
  );
  const hiddenDuplicateChromeIds: string[] = [];

  const nodes = sourceNodes.filter((node) => {
    if (node.isGlobalElement) return false;
    if (isRenderableGlobalSlotNode(node)) return true;
    if (!hubId || node.parentHubId !== hubId) return false;

    const signature = getSharedChromeSignature(node);
    if (signature && globalChromeSignatures.has(signature)) {
      hiddenDuplicateChromeIds.push(node.nodeId);
      return false;
    }

    return true;
  });

  return {
    activeHubId: hubId,
    nodes,
    hubNodes: nodes.filter((node) => !isRenderableGlobalSlotNode(node)),
    globalSlotNodes,
    hiddenDuplicateChromeIds,
  };
}
