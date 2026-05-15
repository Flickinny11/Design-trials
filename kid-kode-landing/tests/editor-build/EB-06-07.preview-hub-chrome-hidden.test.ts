// EB-06-07 — Editor-clutter hide layer in preview-hub.
//
// Spec refs:
//   §6 SC-034 "Editor clutter (handles, gizmos, mode bar except a minimal
//              'back' affordance) is hidden in preview-hub."
//   §6 SC-032 (constrained camera) and SC-033 (compiled background) define
//             the broader preview-hub stance this layer participates in.
//   §8 INV-23 The scene's edges and any blank background are never visible
//             in preview-hub. Editor chrome must not paint over the
//             compiled view either.
//
// haltCheck (from ralph-state.json):
//   "In preview-hub mode, transform handles/gizmos, viewport frame, and
//    overlays are hidden; a minimal 'back' affordance remains; snapshot
//    diff against EB-05-02 confirms clean preview chrome."
//
// Coverage in this file:
//   1. The 5-button view-mode toggle (data-component="view-mode-toggle")
//      is gated on viewMode !== 'preview-hub' in src/app/page.tsx.
//   2. A minimal back affordance (data-component="preview-back") is
//      rendered in src/app/page.tsx when viewMode === 'preview-hub'.
//   3. The back affordance invokes setViewMode with a non-preview mode
//      sourced from a tracked previousAuthoringMode field.
//   4. The graph overlays (TopBar, HubNav, Minimap, DetailCard, RightPane,
//      GalaxyFilterOverlay) and GraphScene are NOT rendered in preview-hub
//      — i.e. their render blocks remain gated on showsGraph, which is
//      false in preview-hub.
//   5. PrismHost's CanvasTransformGizmo and CanvasViewportFrame are inside
//      GraphScene and therefore unmounted in preview-hub (smoke check via
//      source inspection — they live in GraphScene.tsx, not page.tsx).
//   6. useGraphEditorStore exposes a previousAuthoringMode field that
//      defaults to a non-preview mode and tracks the last non-preview
//      viewMode set via setViewMode.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { useGraphEditorStore } from '../../src/stores/useGraphEditorStore';

const repoRoot = join(__dirname, '..', '..');
const pageSrc = readFileSync(
  join(repoRoot, 'src', 'app', 'page.tsx'),
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

describe('EB-06-07 — view-mode toggle is hidden in preview-hub (SC-034)', () => {
  it('the 5-button mode bar (data-component="view-mode-toggle") is gated on viewMode !== "preview-hub"', () => {
    // Find the JSX block whose root carries data-component="view-mode-toggle".
    // The block must be reached only when viewMode is not preview-hub. We
    // enforce this by requiring that the toggle JSX sits inside an
    // expression that mentions a !== 'preview-hub' guard (or an equivalent
    // condition that excludes preview-hub).
    const toggleIdx = pageSrc.indexOf('data-component="view-mode-toggle"');
    expect(toggleIdx).toBeGreaterThan(0);

    // Walk backwards up to ~800 chars to find the enclosing render guard.
    const lookback = pageSrc.slice(Math.max(0, toggleIdx - 800), toggleIdx);
    // Accept either an explicit !== 'preview-hub' guard or a guard that
    // depends on a boolean flag derived from it (e.g. `!isPreviewHub`).
    const guarded =
      /viewMode\s*!==\s*['"]preview-hub['"]/.test(lookback) ||
      /!\s*isPreviewHub/.test(lookback) ||
      /!\s*isPreviewMode/.test(lookback) ||
      /showsModeBar/.test(lookback);
    expect(guarded).toBe(true);
  });
});

describe('EB-06-07 — minimal back affordance is rendered in preview-hub (SC-034)', () => {
  it('renders an element with data-component="preview-back" somewhere in page.tsx', () => {
    expect(pageSrc).toMatch(/data-component="preview-back"/);
  });

  it('the back affordance is rendered only when viewMode === "preview-hub"', () => {
    const backIdx = pageSrc.indexOf('data-component="preview-back"');
    expect(backIdx).toBeGreaterThan(0);
    const lookback = pageSrc.slice(Math.max(0, backIdx - 800), backIdx);
    const guarded =
      /viewMode\s*===\s*['"]preview-hub['"]/.test(lookback) ||
      /isPreviewHub/.test(lookback);
    expect(guarded).toBe(true);
  });

  it('the back affordance carries a click handler that calls setViewMode', () => {
    // Search a window around the back element for an onClick that invokes
    // setViewMode. The previous authoring mode is supplied by the store.
    const backIdx = pageSrc.indexOf('data-component="preview-back"');
    expect(backIdx).toBeGreaterThan(0);
    const window = pageSrc.slice(backIdx, backIdx + 600);
    expect(window).toMatch(/onClick=\{[^}]*setViewMode\(/);
  });

  it('the back affordance ultimately returns the user to a non-preview mode (previousAuthoringMode or an authoring literal)', () => {
    const backIdx = pageSrc.indexOf('data-component="preview-back"');
    const window = pageSrc.slice(backIdx, backIdx + 600);
    const usesStoreField = /previousAuthoringMode/.test(window);
    const usesAuthoringLiteral =
      /setViewMode\(\s*['"](?:hub-world|canvas|galaxy)['"]\s*\)/.test(window);
    expect(usesStoreField || usesAuthoringLiteral).toBe(true);
  });
});

describe('EB-06-07 — graph overlays remain hidden in preview-hub (SC-034)', () => {
  // page.tsx already gates the graph overlays + GraphScene on `showsGraph`,
  // which is false in preview-hub. These tests pin that contract so a
  // future refactor cannot accidentally re-introduce the chrome.
  const GUARDED_RENDERS = [
    '<GraphScene />',
    '<TopBar />',
    '<HubNav />',
    '<Minimap />',
    '<DetailCard />',
    '<RightPane />',
    '<GalaxyFilterOverlay />',
  ];

  for (const tag of GUARDED_RENDERS) {
    it(`${tag} is rendered inside a showsGraph gate`, () => {
      const idx = pageSrc.indexOf(tag);
      expect(idx).toBeGreaterThan(0);
      const lookback = pageSrc.slice(Math.max(0, idx - 1200), idx);
      // Either showsGraph or the equivalent disjunction must appear in the
      // enclosing JSX block (mobile branch always mounts, so we accept the
      // desktop branch's showsGraph as sufficient).
      const desktopGuard = /showsGraph\s*&&/.test(lookback);
      expect(desktopGuard).toBe(true);
    });
  }

  it('CanvasTransformGizmo lives inside GraphScene (not in page.tsx) so preview-hub never mounts it', () => {
    expect(graphSceneSrc).toMatch(/CanvasTransformGizmo/);
    expect(pageSrc).not.toMatch(/CanvasTransformGizmo/);
  });

  it('CanvasViewportFrame lives inside GraphScene (not in page.tsx)', () => {
    expect(graphSceneSrc).toMatch(/CanvasViewportFrame/);
    expect(pageSrc).not.toMatch(/CanvasViewportFrame/);
  });
});

describe('EB-06-07 — store tracks previousAuthoringMode for the back affordance', () => {
  beforeEach(() => {
    // Reset to a known authoring mode before every spec.
    useGraphEditorStore.setState({ viewMode: 'hub-world' });
  });

  it('useGraphEditorStore exposes a previousAuthoringMode field with a non-preview default', () => {
    const s = useGraphEditorStore.getState() as unknown as {
      previousAuthoringMode?: string;
    };
    expect(s.previousAuthoringMode).toBeDefined();
    expect(['galaxy', 'hub-world', 'canvas']).toContain(
      s.previousAuthoringMode!,
    );
  });

  it('setViewMode("canvas") updates previousAuthoringMode to "canvas"', () => {
    useGraphEditorStore.getState().setViewMode('canvas');
    const s = useGraphEditorStore.getState() as unknown as {
      previousAuthoringMode?: string;
    };
    expect(s.previousAuthoringMode).toBe('canvas');
  });

  it('setViewMode("preview-hub") DOES NOT overwrite previousAuthoringMode', () => {
    useGraphEditorStore.getState().setViewMode('galaxy');
    useGraphEditorStore.getState().setViewMode('preview-hub');
    const s = useGraphEditorStore.getState() as unknown as {
      previousAuthoringMode?: string;
    };
    expect(s.previousAuthoringMode).toBe('galaxy');
    expect(useGraphEditorStore.getState().viewMode).toBe('preview-hub');
  });

  it('setViewMode("preview-app") DOES NOT overwrite previousAuthoringMode', () => {
    useGraphEditorStore.getState().setViewMode('hub-world');
    useGraphEditorStore.getState().setViewMode('preview-app');
    const s = useGraphEditorStore.getState() as unknown as {
      previousAuthoringMode?: string;
    };
    expect(s.previousAuthoringMode).toBe('hub-world');
  });

  it('GraphEditorState declares previousAuthoringMode typed as a non-preview ViewMode', () => {
    // Type-layer pin: the interface field must reference a non-preview
    // ViewMode subset (one of 'galaxy' | 'hub-world' | 'canvas') or the
    // full ViewMode union if implementation latitude is preferred.
    expect(storeSrc).toMatch(/previousAuthoringMode\s*:/);
  });
});
