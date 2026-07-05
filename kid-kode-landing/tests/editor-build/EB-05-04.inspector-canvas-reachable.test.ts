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
// Coverage in this file (source-level guarantees, as amended by the
// canonical unified-scene architecture — RT-SC-03 / INV-R3 / FP-R5/FP-R6):
//   1. `src/app/page.tsx` mounts ONE GraphScene for all three modes and
//      renders the editor overlay set (incl. RightPane → Inspector) whenever
//      the user is NOT in preview-app — so the inspector is reachable in
//      canvas mode without leaving the mode. The split-pane-era
//      showsSplit/showsGraph derivations are superseded and must not return.
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
//      calls in Inspector.tsx are explicit user actions: the "Preview in
//      App UI" button (→ 'preview-app') and the Clone auto-switch
//      (→ 'galaxy', SC-075).

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

describe('EB-05-04 — page.tsx keeps the inspector reachable in canvas mode (SC-026 entrypoint, unified scene)', () => {
  it('the split-pane-era showsSplit/showsGraph derivations are gone (FP-R6 — one scene, modes are states not panes)', () => {
    // The Round-1 page derived showsSplit/showsGraph and mounted a separate
    // graph pane behind them. The canonical architecture mounts ONE
    // GraphScene unconditionally; either derivation returning is drift.
    expect(pageSrc).not.toMatch(/showsSplit/);
    expect(pageSrc).not.toMatch(/showsGraph/);
  });

  it('mounts ONE unconditional GraphScene inside the graph pane (RT-SC-03 / INV-R3)', () => {
    // GraphScene mounts in every mode; viewMode drives what renders INSIDE
    // it. No <PrismHost> compiled mount may reappear in page.tsx (FP-R5).
    expect(pageSrc).toMatch(/data-pane="graph"/);
    expect(pageSrc).toMatch(/<GraphScene\s*\/>/);
    expect(pageSrc).not.toMatch(/<PrismHost\b/);
  });

  it('renders <RightPane /> inside the !isPreviewApp overlay block — reachable from canvas without leaving the mode', () => {
    // Editor chrome (TopBar, RightPane → Inspector, toolbar) renders whenever
    // the user is NOT in preview-app, i.e. in BOTH galaxy and canvas. The
    // inspector therefore stays reachable in canvas mode (SC-026), and
    // preview-app reads as the running app with chrome hidden (INV-R4).
    const guardIdx = pageSrc.indexOf('{!isPreviewApp && (');
    expect(guardIdx).toBeGreaterThan(-1);
    const tail = pageSrc.slice(guardIdx);
    const closeIdx = tail.indexOf(')}');
    expect(closeIdx).toBeGreaterThan(-1);
    const block = tail.slice(0, closeIdx);
    expect(block).toMatch(/<RightPane\s*\/>/);
    // The overlay block must not be additionally gated on viewMode ===
    // 'canvas' only — galaxy keeps the inspector too (mode-agnostic chrome).
    expect(block).not.toMatch(/viewMode\s*===\s*['"]canvas['"]\s*&&\s*<RightPane/);
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

describe('EB-05-04 — setViewMode in Inspector.tsx fires only on explicit user actions (SC-026 corollary)', () => {
  it('every setViewMode call is a canonical-3 literal inside an explicit handler (Clone → galaxy per SC-075; Preview in App UI → preview-app per RA-06b)', () => {
    // SC-026's "without changing viewMode" clause forbids IMPLICIT mode
    // flips (e.g. keyframe UI silently leaving canvas). Two explicit,
    // user-initiated affordances are the only legal call sites:
    //   - handleClone: auto-switch to 'galaxy' so the user can re-parent
    //     the fresh clone (SC-075).
    //   - handlePreviewInAppUi: 'preview-app' (preview-hub folded in,
    //     RA-06b).
    const literalCalls = [
      ...inspectorSrc.matchAll(/setViewMode\s*\(\s*['"]([a-z-]+)['"]\s*\)/g),
    ];
    const allCalls = [...inspectorSrc.matchAll(/setViewMode\s*\(/g)];
    // No variable-argument calls may hide a non-canonical target.
    expect(allCalls.length).toBe(literalCalls.length);
    expect(literalCalls.length).toBeLessThanOrEqual(2);
    for (const call of literalCalls) {
      // FP-12 — only canonical-3 literals; an Inspector action never lands
      // the user in a superseded mode.
      expect(['galaxy', 'preview-app']).toContain(call[1]);
      const idx = call.index!;
      const ancestor = inspectorSrc.slice(Math.max(0, idx - 600), idx);
      expect(ancestor).toMatch(/handleClone|handlePreviewInAppUi|preview-in-app-ui/);
    }
  });
});
