// EB-01-02 — page.tsx + Inspector.tsx migrated to canonical viewMode.
//
// Spec refs: §1 SC-001, §1 SC-002, §1 INV-20, §1 RA-06 of
// PRISM-EDITOR-BUILD-SPEC.md.
//
// EB-01-01 widened the store's setter signature and shipped a
// `normalizeViewMode` mapping per RA-06. EB-01-02 consumes that work:
//
//   1. The store's initial `viewMode` value is one of the canonical 5
//      (the EB-01-01 haltCheck explicitly deferred remapping the initial
//      value to this task).
//   2. Toggling through every canonical mode at the store layer never
//      mutates `selectedNodeId` or `selectedHubId` (SC-002, INV-20). The
//      camera pose is allowed to vary per mode but selection must survive.
//   3. `app/page.tsx` references each of the 5 canonical literals and no
//      longer assigns the legacy strings via `id:` toggle entries or
//      direct equality checks.
//   4. `components/editor/panels/Inspector.tsx` calls
//      `setViewMode('preview-hub')` rather than the legacy
//      `setViewMode('preview')` (per RA-06 mapping preview → preview-hub).
//
// Source-shape assertions (#3 + #4) read the files directly because the
// component trees lift state from the global Zustand store and the
// haltCheck's UI-toggle requirement is verified at the bundle layer by
// the two-runtime snapshot, not by the unit test.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';

const CANONICAL = ['galaxy', 'hub-world', 'canvas', 'preview-hub', 'preview-app'] as const;
const LEGACY = ['preview', 'editor', 'split'] as const;
const repoRoot = join(__dirname, '..', '..');

describe('EB-01-02 — canonical viewMode migration of page.tsx + Inspector', () => {
  beforeEach(() => {
    useGraphEditorStore.setState({
      selectedNodeId: null,
      selectedHubId: null,
    });
  });

  it('store initial viewMode is one of the canonical 5 (SC-001 + RA-06 default)', () => {
    // Re-import to read the *initial* value the store boots with, not whatever
    // a prior test left behind. zustand's `create` runs once per module, so we
    // assert what the store was constructed with by checking the legacy
    // literal isn't the default any more.
    const src = readFileSync(
      join(repoRoot, 'src', 'stores', 'useGraphEditorStore.ts'),
      'utf8',
    );
    // The initial state declaration is the only place `viewMode:` appears as
    // an object property (the other `viewMode` mentions are on type defs or
    // selectors). Pull every `viewMode: 'X'` and confirm every match is
    // canonical.
    const matches = Array.from(src.matchAll(/viewMode:\s*['"]([a-zA-Z-]+)['"]/g));
    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches) {
      expect(CANONICAL).toContain(m[1] as (typeof CANONICAL)[number]);
      expect(LEGACY).not.toContain(m[1] as never);
    }
  });

  it('toggling all 5 canonical modes preserves selectedNodeId (SC-002, INV-20)', () => {
    useGraphEditorStore.getState().selectNode('node-alpha');
    expect(useGraphEditorStore.getState().selectedNodeId).toBe('node-alpha');

    for (const mode of CANONICAL) {
      useGraphEditorStore.getState().setViewMode(mode);
      expect(useGraphEditorStore.getState().viewMode).toBe(mode);
      expect(useGraphEditorStore.getState().selectedNodeId).toBe('node-alpha');
    }
  });

  it('toggling all 5 canonical modes preserves selectedHubId (SC-002, INV-20)', () => {
    useGraphEditorStore.getState().selectHub('hub-beta');
    expect(useGraphEditorStore.getState().selectedHubId).toBe('hub-beta');

    for (const mode of CANONICAL) {
      useGraphEditorStore.getState().setViewMode(mode);
      expect(useGraphEditorStore.getState().viewMode).toBe(mode);
      expect(useGraphEditorStore.getState().selectedHubId).toBe('hub-beta');
    }
  });

  it('page.tsx references all 5 canonical viewMode literals (RA-06)', () => {
    const src = readFileSync(join(repoRoot, 'src', 'app', 'page.tsx'), 'utf8');
    for (const mode of CANONICAL) {
      expect(src).toMatch(new RegExp(`['"]${mode}['"]`));
    }
  });

  it('page.tsx no longer wires legacy literals through id-array / equality (RA-06)', () => {
    const src = readFileSync(join(repoRoot, 'src', 'app', 'page.tsx'), 'utf8');
    // `id: 'preview'|'split'|'editor'` was the legacy 3-button toggle shape.
    expect(src).not.toMatch(/id:\s*['"](preview|split|editor)['"]/);
    // viewMode equality checks against legacy literals — the legacy strings
    // must no longer drive any pane visibility branch.
    expect(src).not.toMatch(/viewMode\s*===?\s*['"](preview|split|editor)['"]/);
    expect(src).not.toMatch(/viewMode\s*!==?\s*['"](preview|split|editor)['"]/);
  });

  it('Inspector.tsx calls setViewMode("preview-hub") not legacy "preview" (RA-06)', () => {
    const src = readFileSync(
      join(repoRoot, 'src', 'components', 'editor', 'panels', 'Inspector.tsx'),
      'utf8',
    );
    expect(src).toMatch(/setViewMode\(\s*['"]preview-hub['"]\s*\)/);
    expect(src).not.toMatch(/setViewMode\(\s*['"](preview|split|editor)['"]\s*\)/);
  });
});
