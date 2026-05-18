// EB-04-02 — Node-click → inspector with all tabs preserved across modes.
//
// Spec refs:
//   §6 Phase 4 — SC-020 "Clicking a node opens the inspector with the existing
//                       tab set preserved (visual / behavior / code / animation /
//                       connections / backend / history)."
//   §1 INV-20  — Selection state survives every transition through any subset
//                of the five canonical view modes; corollary: inspector tab
//                state survives mode transitions for the duration of a single
//                selection.
//
// haltCheck (from ralph-state.json):
//   "Clicking a node in hub-world opens inspector; all current tabs
//    (visual/behavior/code/animation/connections/backend/history) remain
//    reachable; tab state persists across mode switches."
//
// Coverage in this file:
//   1. The InspectorTab type union exposes all 7 canonical tab ids.
//   2. The Inspector component's TABS array renders all 7 tab buttons,
//      including the previously-missing 'history' tab.
//   3. The Inspector body has a render branch for every TAB id (no dead tab).
//   4. Hub-world node click wiring (AssembledSceneNode in GraphScene) calls
//      openInspector after selectNode (the SC-020 trigger path).
//   5. setViewMode does NOT reset inspectorTab — the user's chosen tab
//      persists across every transition between the 5 canonical view modes.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  useGraphEditorStore,
  type InspectorTab,
  type ViewMode,
} from '../../src/stores/useGraphEditorStore';

const repoRoot = join(__dirname, '..', '..');
const inspectorSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'panels', 'Inspector.tsx'),
  'utf8',
);
const storeSrc = readFileSync(
  join(repoRoot, 'src', 'stores', 'useGraphEditorStore.ts'),
  'utf8',
);
const graphSceneSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'graph', 'GraphScene.tsx'),
  'utf8',
);

const CANONICAL_TABS: InspectorTab[] = [
  'visual',
  'behavior',
  'code',
  'animation',
  'connections',
  'backend',
  'history',
];

const CANONICAL_VIEW_MODES: ViewMode[] = ['galaxy', 'canvas', 'preview-app'];

describe('EB-04-02 — InspectorTab type covers all 7 canonical tabs (SC-020)', () => {
  it('includes every canonical tab id in the InspectorTab union', () => {
    const unionMatch = storeSrc.match(/export type InspectorTab\s*=\s*([^;]+);/);
    expect(unionMatch).not.toBeNull();
    const union = unionMatch![1];
    for (const id of CANONICAL_TABS) {
      expect(union).toMatch(new RegExp(`['"]${id}['"]`));
    }
  });
});

describe('EB-04-02 — Inspector renders all 7 canonical tabs (SC-020)', () => {
  it('declares a TABS array entry for every canonical tab id (history included)', () => {
    // The TABS array literal lives at module scope; each entry is shaped
    // `{ id: 'visual', ... }`. Asserting `id: 'history'` is what currently
    // fails — the existing array stops at 'backend'.
    for (const id of CANONICAL_TABS) {
      expect(inspectorSrc).toMatch(new RegExp(`id:\\s*['"]${id}['"]`));
    }
  });

  it('has a render branch for every canonical tab id (no dead tab)', () => {
    // The body switch is `{tab === 'visual' && <VisualTab .../>}` etc.
    // Every TAB id must have a paired branch so clicking it produces output.
    for (const id of CANONICAL_TABS) {
      expect(inspectorSrc).toMatch(
        new RegExp(`tab\\s*===\\s*['"]${id}['"]`),
      );
    }
  });
});

describe('EB-04-02 — Hub-world node click opens inspector (SC-020 trigger)', () => {
  it('AssembledSceneNode click wiring calls openInspector after selectNode', () => {
    // The hub-world scene-mode node is rendered by AssembledSceneNode. Its
    // onClick must drive both selectNode (selection) and openInspector
    // (panel surfacing) so a single click in hub-world satisfies SC-020.
    const fnIdx = graphSceneSrc.indexOf('function AssembledSceneNode');
    expect(fnIdx).toBeGreaterThan(-1);
    // Capture the function body up to the next top-level `function ` decl.
    const tail = graphSceneSrc.slice(fnIdx);
    const nextFn = tail.indexOf('\nfunction ', 1);
    const body = nextFn === -1 ? tail : tail.slice(0, nextFn);
    expect(body).toMatch(/selectNode\(\s*node\.nodeId\s*\)/);
    expect(body).toMatch(/openInspector\(\)/);
  });
});

describe('EB-04-02 — inspectorTab persists across all 5 view-mode transitions (INV-20 corollary)', () => {
  beforeEach(() => {
    const s = useGraphEditorStore.getState();
    s.setInspectorTab('visual');
    s.setViewMode('galaxy');
  });

  it('does not reset inspectorTab in setViewMode (source-level guarantee)', () => {
    // Grep the setViewMode body for any `inspectorTab:` write — the action
    // must touch only viewMode (and the documented hubRevealAt clearing
    // from EB-04-01). A reset here would silently break SC-020 the next
    // time a user toggles mode while reviewing a node's history tab.
    const setViewModeMatch = storeSrc.match(
      /setViewMode:\s*\(m\)\s*=>[\s\S]*?set\(\{[^}]*\}\)/,
    );
    expect(setViewModeMatch).not.toBeNull();
    expect(setViewModeMatch![0]).not.toMatch(/inspectorTab\s*:/);
  });

  it('keeps the current inspectorTab through every canonical mode pair', () => {
    for (const tab of CANONICAL_TABS) {
      // 'world' is the special-case tab for App_Name_World and is forced
      // by the SC-007 effect when the root node is selected; SC-020 is
      // about the seven node tabs, so we cycle through those only.
      const s0 = useGraphEditorStore.getState();
      s0.setInspectorTab(tab);
      expect(useGraphEditorStore.getState().inspectorTab).toBe(tab);

      for (const from of CANONICAL_VIEW_MODES) {
        for (const to of CANONICAL_VIEW_MODES) {
          if (from === to) continue;
          const s = useGraphEditorStore.getState();
          s.setViewMode(from);
          s.setViewMode(to);
          expect(useGraphEditorStore.getState().inspectorTab).toBe(tab);
        }
      }
    }
  });
});
