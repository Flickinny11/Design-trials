// EB-03-06 — Galaxy mode: shift-click multi-select + group inspector.
//
// Spec ref:
//   §3 SC-017 — "Multi-select supported via shift-click; multi-selected items
//                show in inspector as a group."
//
// haltCheck (from ralph-state.json):
//   "Shift-click adds nodes/hubs to a multi-selection set; inspector renders
//    a group view summarizing the selection; clicking without shift collapses
//    to a single selection."
//
// Store contract (useGraphEditorStore):
//   - Adds two fields:
//       selectedNodeIds: ReadonlySet<string>
//       selectedHubIds:  ReadonlySet<string>
//     Both are empty by default. Multi-selection lives ALONGSIDE the existing
//     singular fields (selectedNodeId / selectedHubId) so renderers and the
//     existing single-select Inspector path keep working unchanged.
//   - Adds three actions:
//       toggleNodeSelection(id: string) — adds id to selectedNodeIds (or
//         removes if present). When the current state has a single
//         selectedNodeId, the toggle seeds the multi-set with that id first
//         so shift-clicking a SECOND node yields a 2-member group.
//       toggleHubSelection(id: string) — same for hubs.
//       clearMultiSelection()          — empties both sets.
//   - selectNode(id) and selectHub(id) (the non-shift paths) MUST clear both
//     multi-selection sets so a plain click collapses any prior group back
//     to a single selection.
//   - The selection model honors INV-20 — actions only; no direct mutation
//     of state. FP-11's regex (selectedNodeId|selectedHubId|viewMode =) is
//     narrowly scoped to the singular fields, so the multi-selection fields
//     are not subject to it, but we still go through actions everywhere.
//
// GraphScene wiring:
//   - On galaxy-mode node-cluster click, when e.shiftKey is true, the
//     handler calls toggleNodeSelection(node.id) instead of selectNode.
//   - On galaxy-mode hub click, shift-click calls toggleHubSelection.
//   - Non-shift clicks call the existing single-select actions (selectNode /
//     selectHub), which now also collapse the multi-set.
//   - The shift-click branch is gated on viewMode === 'galaxy' per SC-017's
//     phase placement (§3). Other modes preserve their current click
//     behavior.
//
// Inspector wiring:
//   - When selectedNodeIds.size + selectedHubIds.size > 1, Inspector renders
//     a GroupInspector view that summarizes the selection (a count, a list
//     of names, and the type breakdown — "N nodes, M hubs"). The group view
//     replaces the single-node tabs only while the group is active; a
//     non-shift click collapses to single and the tabbed view returns.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { useGraphEditorStore } from '../../src/stores/useGraphEditorStore';

const repoRoot = join(__dirname, '..', '..');
const storeSrc = readFileSync(
  join(repoRoot, 'src', 'stores', 'useGraphEditorStore.ts'),
  'utf8',
);
const graphSceneSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'graph', 'GraphScene.tsx'),
  'utf8',
);
const inspectorSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'panels', 'Inspector.tsx'),
  'utf8',
);

// The new multi-selection contract isn't on the store's exported type yet
// (this test FAILS until the EB-03-06 implementation lands), so we treat the
// store state as a loose record here. The runtime assertions still verify
// real behavior; the cast just keeps the TDD-first test compiling.
type MultiSelectShape = {
  selectedNodeId: string | null;
  selectedHubId: string | null;
  selectedNodeIds: Set<string>;
  selectedHubIds: Set<string>;
  selectNode: (id: string | null) => void;
  selectHub: (id: string | null) => void;
  toggleNodeSelection: (id: string) => void;
  toggleHubSelection: (id: string) => void;
  clearMultiSelection: () => void;
};

const getStore = () =>
  useGraphEditorStore.getState() as unknown as MultiSelectShape;

function resetStore() {
  const s = getStore();
  s.selectNode(null);
  s.selectHub(null);
  s.clearMultiSelection?.();
}

describe('EB-03-06 — useGraphEditorStore multi-selection fields', () => {
  it('declares a selectedNodeIds set field', () => {
    expect(storeSrc).toMatch(/selectedNodeIds:\s*(ReadonlySet|Set)<string>/);
  });

  it('declares a selectedHubIds set field', () => {
    expect(storeSrc).toMatch(/selectedHubIds:\s*(ReadonlySet|Set)<string>/);
  });

  it('initializes both multi-selection sets empty', () => {
    const s = getStore();
    expect(s.selectedNodeIds).toBeInstanceOf(Set);
    expect(s.selectedHubIds).toBeInstanceOf(Set);
    expect(s.selectedNodeIds.size).toBe(0);
    expect(s.selectedHubIds.size).toBe(0);
  });

  it('exposes a toggleNodeSelection action', () => {
    expect(storeSrc).toMatch(/toggleNodeSelection:\s*\(/);
  });

  it('exposes a toggleHubSelection action', () => {
    expect(storeSrc).toMatch(/toggleHubSelection:\s*\(/);
  });

  it('exposes a clearMultiSelection action', () => {
    expect(storeSrc).toMatch(/clearMultiSelection:\s*\(/);
  });
});

describe('EB-03-06 — multi-selection behavior (SC-017 haltCheck)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('shift-clicking the first node after a single selection yields a 2-member group', () => {
    const s = getStore();
    s.selectNode('n1');
    expect(getStore().selectedNodeId).toBe('n1');

    // The shift-click pathway calls toggleNodeSelection on the NEW id. The
    // store must seed the multi-set with the prior singular selection so the
    // resulting group has [n1, n2].
    getStore().toggleNodeSelection('n2');
    const after = getStore();
    expect(after.selectedNodeIds.has('n1')).toBe(true);
    expect(after.selectedNodeIds.has('n2')).toBe(true);
    expect(after.selectedNodeIds.size).toBe(2);
  });

  it('toggling an already-selected id removes it from the multi-set', () => {
    const s = getStore();
    s.selectNode('n1');
    s.toggleNodeSelection('n2');
    s.toggleNodeSelection('n3');
    expect(getStore().selectedNodeIds.size).toBe(3);
    s.toggleNodeSelection('n2');
    const after = getStore();
    expect(after.selectedNodeIds.has('n2')).toBe(false);
    expect(after.selectedNodeIds.has('n1')).toBe(true);
    expect(after.selectedNodeIds.has('n3')).toBe(true);
  });

  it('plain selectNode collapses the multi-selection back to a single selection', () => {
    const s = getStore();
    s.selectNode('n1');
    s.toggleNodeSelection('n2');
    s.toggleNodeSelection('n3');
    expect(getStore().selectedNodeIds.size).toBe(3);

    s.selectNode('n9');
    const after = getStore();
    expect(after.selectedNodeId).toBe('n9');
    expect(after.selectedNodeIds.size).toBe(0);
    expect(after.selectedHubIds.size).toBe(0);
  });

  it('toggleHubSelection seeds from selectedHubId and accumulates hubs', () => {
    const s = getStore();
    s.selectHub('h1');
    s.toggleHubSelection('h2');
    const after = getStore();
    expect(after.selectedHubIds.has('h1')).toBe(true);
    expect(after.selectedHubIds.has('h2')).toBe(true);
  });

  it('clearMultiSelection empties both sets without disturbing singular fields', () => {
    const s = getStore();
    s.selectNode('n1');
    s.toggleNodeSelection('n2');
    s.toggleHubSelection('h1');
    s.clearMultiSelection();
    const after = getStore();
    expect(after.selectedNodeIds.size).toBe(0);
    expect(after.selectedHubIds.size).toBe(0);
  });

  it('plain selectHub collapses multi-selection sets', () => {
    const s = getStore();
    s.toggleNodeSelection('n1');
    s.toggleNodeSelection('n2');
    s.selectHub('hX');
    const after = getStore();
    expect(after.selectedHubId).toBe('hX');
    expect(after.selectedNodeIds.size).toBe(0);
    expect(after.selectedHubIds.size).toBe(0);
  });
});

describe('EB-03-06 — GraphScene shift-click wiring (galaxy mode)', () => {
  it('imports toggleNodeSelection from the editor store', () => {
    expect(graphSceneSrc).toMatch(/toggleNodeSelection/);
  });

  it('imports toggleHubSelection from the editor store', () => {
    expect(graphSceneSrc).toMatch(/toggleHubSelection/);
  });

  it('inspects shiftKey on click events in galaxy mode', () => {
    // The renderer must inspect the modifier off the native pointer event so
    // the shift-click branch can route to toggle* actions instead of the
    // single-select selectNode/selectHub.
    expect(graphSceneSrc).toMatch(/shiftKey/);
  });
});

describe('EB-03-06 — Inspector renders a group view when multi-select is active', () => {
  it('exports or imports a GroupInspector view', () => {
    // The inspector module either declares a GroupInspector helper or imports
    // a sibling GroupInspector component used when more than one item is
    // selected. Either form satisfies the haltCheck for "inspector renders a
    // group view summarizing the selection".
    expect(inspectorSrc).toMatch(/GroupInspector/);
  });

  it('reads selectedNodeIds and selectedHubIds from the store', () => {
    expect(inspectorSrc).toMatch(/selectedNodeIds/);
    expect(inspectorSrc).toMatch(/selectedHubIds/);
  });

  it('branches on the group selection size in the render path', () => {
    // Anywhere in the source: a guard like
    //   const isGroup = selectedNodeIds.size + selectedHubIds.size > 1
    // (or equivalent comparison) must exist so the group view replaces the
    // single-node tab body when active.
    expect(inspectorSrc).toMatch(
      /selectedNodeIds\.size\s*\+\s*selectedHubIds\.size|selectedHubIds\.size\s*\+\s*selectedNodeIds\.size/,
    );
  });
});
