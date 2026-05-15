// EB-05-04 — Inspector + keyframe tools reachable from canvas mode.
//
// Spec refs:
//   §5 Phase 5 — SC-026 "Inspector remains reachable from `canvas`; keyframe
//                       tools accessible from the animation tab."
//
// haltCheck (from ralph-state.json):
//   "From canvas mode, opening a node's inspector preserves all tabs;
//    animation tab's keyframe UI is reachable without changing viewMode."
//
// Coverage in this file (source-level guarantees):
//   1. The desktop branch of `src/app/page.tsx` mounts RightPane whenever
//      `viewMode === 'canvas'` — i.e. the inspector is reachable in canvas
//      mode without first leaving the mode. This is the SC-026 entrypoint.
//   2. The Inspector body renders all 7 canonical tabs (including
//      'animation') unconditionally — no viewMode gating hides any tab when
//      the user is in canvas mode (corollary of SC-026 + SC-020).
//   3. AnimationTab inside Inspector renders keyframe-editor UI when the
//      'animation' tab is active — the keyframe property editors and
//      activeFrame controls live in that component, not in a separate
//      modal that would require leaving canvas mode.
//   4. Inspector.tsx contains no `setViewMode(` call inside the AnimationTab
//      (or any tab) that would silently flip viewMode when the user
//      interacts with keyframe UI from canvas mode. The only setViewMode
//      call in Inspector.tsx is the explicit "Preview in App UI" button.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { type InspectorTab } from '../../src/stores/useGraphEditorStore';

const repoRoot = join(__dirname, '..', '..');
const pageSrc = readFileSync(join(repoRoot, 'src', 'app', 'page.tsx'), 'utf8');
const inspectorSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'panels', 'Inspector.tsx'),
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

describe('EB-05-04 — page.tsx mounts RightPane in canvas mode (SC-026 entrypoint)', () => {
  it('derives showsSplit from viewMode === "canvas"', () => {
    // The split-pane branch (which mounts the graph pane + RightPane) must
    // be active in canvas mode so the inspector is reachable without
    // leaving the mode.
    expect(pageSrc).toMatch(/showsSplit\s*=\s*viewMode\s*===\s*['"]canvas['"]/);
  });

  it('includes canvas (via showsSplit) in showsGraph so the graph pane mounts', () => {
    // showsGraph guards the JSX block that mounts <RightPane />. Canvas
    // mode must be part of this derived flag, otherwise the inspector
    // would disappear the moment the user enters canvas.
    const match = pageSrc.match(/showsGraph\s*=\s*([^;]+);/);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/showsSplit/);
  });

  it('renders <RightPane /> inside the showsGraph branch (desktop)', () => {
    // The desktop branch wraps the graph + overlays in `{showsGraph && (...)}`.
    // Inspector mount lives inside this block.
    const guardIdx = pageSrc.indexOf('{showsGraph && (');
    expect(guardIdx).toBeGreaterThan(-1);
    // Find the matching closing for this conditional block.
    const tail = pageSrc.slice(guardIdx);
    const closeIdx = tail.indexOf(')}');
    expect(closeIdx).toBeGreaterThan(-1);
    const block = tail.slice(0, closeIdx);
    expect(block).toMatch(/<RightPane\s*\/>/);
  });
});

describe('EB-05-04 — Inspector renders all 7 tabs without viewMode gating (SC-026 + SC-020)', () => {
  it('renders the TABS array body unconditionally (no viewMode check around the tab bar)', () => {
    // The tab bar block is `{TABS.map((t) => { ... })}`. There must NOT be
    // a `viewMode !==` or `viewMode ===` guard wrapping it that would hide
    // any tab when the user enters canvas mode.
    const tabBarIdx = inspectorSrc.indexOf('{TABS.map((t)');
    expect(tabBarIdx).toBeGreaterThan(-1);
    // Walk back ~400 chars to inspect immediate ancestor expressions for a
    // viewMode gate. The 400-char window is generous enough to capture a
    // wrapping ternary or `viewMode ===` JSX guard without false positives.
    const ancestor = inspectorSrc.slice(Math.max(0, tabBarIdx - 400), tabBarIdx);
    expect(ancestor).not.toMatch(/viewMode\s*[!=]==/);
  });

  it('has a render branch for every canonical tab id (no canvas-mode hidden tab)', () => {
    for (const id of CANONICAL_TABS) {
      expect(inspectorSrc).toMatch(new RegExp(`tab\\s*===\\s*['"]${id}['"]`));
    }
  });

  it('mounts <AnimationTab .../> on the animation tab branch', () => {
    expect(inspectorSrc).toMatch(/tab\s*===\s*['"]animation['"]\s*&&\s*<AnimationTab\b/);
  });
});

describe('EB-05-04 — AnimationTab keyframe UI is reachable without viewMode change (SC-026)', () => {
  // Lock the structural shape of AnimationTab: it must contain the
  // keyframe-editor surface (active-frame controls + per-frame property
  // editors) directly inside the inspector body, not gated behind a
  // viewMode flip or a separate route.
  const animationTabIdx = inspectorSrc.indexOf('function AnimationTab(');
  const tail = animationTabIdx === -1 ? '' : inspectorSrc.slice(animationTabIdx);
  const nextFnIdx = tail.indexOf('\nfunction ', 1);
  const animationTabBody = nextFnIdx === -1 ? tail : tail.slice(0, nextFnIdx);

  it('AnimationTab function exists in Inspector.tsx', () => {
    expect(animationTabIdx).toBeGreaterThan(-1);
  });

  it('AnimationTab body renders keyframe-editor surface (activeFrame state + property editors)', () => {
    // The keyframe editor uses `activeFrame` as the cursor into `frames`
    // and renders per-frame property controls. Both are required for
    // SC-026's "keyframe tools accessible from the animation tab".
    expect(animationTabBody).toMatch(/setActiveFrame/);
    expect(animationTabBody).toMatch(/Keyframe property editors|Keyframe \{/);
  });

  it('AnimationTab does NOT call setViewMode (would violate SC-026 "without changing viewMode")', () => {
    expect(animationTabBody).not.toMatch(/setViewMode\s*\(/);
  });
});

describe('EB-05-04 — only the explicit "Preview in App UI" button calls setViewMode (SC-026 corollary)', () => {
  it('setViewMode in Inspector.tsx is bound only to data-role="preview-in-app-ui"', () => {
    // There may be one setViewMode call in Inspector.tsx for the explicit
    // "Preview in App UI" affordance — that is opt-in user action, not
    // implicit viewMode flipping. Any *other* setViewMode call would
    // violate the SC-026 "without changing viewMode" clause.
    const calls = [...inspectorSrc.matchAll(/setViewMode\s*\(/g)];
    // 0 or 1 call is acceptable (1 for the preview button; 0 if removed).
    expect(calls.length).toBeLessThanOrEqual(1);
    if (calls.length === 1) {
      // Confirm the single call belongs to the preview-in-app-ui handler.
      // Walk back ~300 chars to find the role marker / handler function.
      const idx = calls[0].index!;
      const ancestor = inspectorSrc.slice(Math.max(0, idx - 600), idx);
      expect(ancestor).toMatch(/preview-in-app-ui|handlePreviewInAppUi/);
    }
  });
});
