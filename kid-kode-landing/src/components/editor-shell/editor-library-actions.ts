'use client';

// PRISM EDITOR INTEGRATION — I-2: the docked LIBRARY's drop → REAL graph bridge.
//
// In the lab, dropping a palette tile instantiates into the library-local store.
// Docked into the editor, the drop routes HERE: the entry's EntrySpec is projected
// to real PrismNode(s) via the SAME pure factories the lab uses (entryToGraphNodes
// = buildInstance → instanceNodes), re-parented to the active hub, and pushed into
// the LIVE app graph (useGraphSourceStore.addNodesBatch). The dragged primitive /
// material / fluid / composite becomes a genuine node that appears in galaxy +
// canvas (INV-0.3) — not a library-local instance.

import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { entryToGraphNodes } from '@/components/editor/library/use-library-store';
import type { LibraryEntry } from '@/components/editor/library/library-catalog';
import type { PrismNode } from '@/lib/prism-graph/types';
import { resolveActiveHubId, useEditorShellStore } from './use-editor-shell-store';

// Non-stacking drop slots in the active hub's local scene band (FitGroup re-fits
// the whole hub, so absolute world drop coords are moot — these keep successive
// drops from landing on top of each other).
const DROP_SPREAD: { x: number; y: number }[] = [
  { x: 0, y: -0.8 },
  { x: 1.1, y: -0.3 },
  { x: -1.1, y: -0.3 },
  { x: 0.6, y: 0.6 },
  { x: -0.6, y: 0.6 },
  { x: 0, y: 0.2 },
];
let dropCount = 0;

/** Instantiate a library catalog entry into the LIVE app graph under the active
 *  hub. Returns the new node id(s) (a primitive/fluid → 1, a composite → N). */
export function instantiateLibraryEntryIntoGraph(entry: LibraryEntry): string[] {
  const hub = resolveActiveHubId();
  if (!hub) return [];
  const slot = DROP_SPREAD[dropCount % DROP_SPREAD.length];
  dropCount += 1;

  const nodes = entryToGraphNodes(entry, { x: slot.x, y: slot.y, z: 0.2 });
  if (nodes.length === 0) return [];

  const inputs = nodes.map((n) => {
    const input: Partial<PrismNode> & { parentHubId: string } = { ...n, parentHubId: hub };
    // let the graph store mint a fresh uuid so repeated drops never collide.
    delete (input as Partial<PrismNode>).nodeId;
    return input;
  });

  const ids = useGraphSourceStore.getState().addNodesBatch(inputs);
  const shell = useEditorShellStore.getState();
  if (ids[0]) shell.select(ids[0]);
  if (shell.view === 'preview-app') shell.setView('canvas');
  return ids;
}
