// EB-01-01 — canonical 5-mode ViewMode type.
//
// Spec refs: §6 SC-001, §7 INV-20, §9 RA-06 of PRISM-EDITOR-BUILD-SPEC.md.
//
// EB-01-01 is the *type-shape* task: it establishes the canonical `ViewMode`
// union and the legacy→canonical mapping table for EB-01-02 to consume.
// Migrating the UI call sites (page.tsx, Inspector.tsx) and remapping the
// initial state is EB-01-02's job; arming FP-12 against the legacy literals
// is EB-01-03's. So this file asserts only the surface area EB-01-01 owns:
//
//   1. The store accepts every canonical value via `setViewMode` and stores
//      it verbatim (proving the setter signature has been widened to include
//      the canonical union).
//   2. A `normalizeViewMode` helper is exported and implements the RA-06
//      mapping `editor → hub-world | split → canvas | preview → preview-hub`
//      so EB-01-02 can call it during the page.tsx / Inspector.tsx rewrite.
//   3. The store's initial `viewMode` is one of `AnyViewMode` (canonical or
//      legacy) — the haltCheck explicitly permits legacy values to remain as
//      a transient alias during this task.
//
// The canonical *type alias* shape (`ViewMode = 'galaxy' | 'hub-world' | ...`)
// is enforced separately by the iteration's grep verification command, since
// the post-edit-typecheck hook blocks any test that would force a tsc error.

import { describe, it, expect } from 'vitest';
import {
  useGraphEditorStore,
  normalizeViewMode,
} from '@/stores/useGraphEditorStore';

const CANONICAL = ['galaxy', 'hub-world', 'canvas', 'preview-hub', 'preview-app'] as const;
const LEGACY = ['preview', 'editor', 'split'] as const;

describe('EB-01-01 — canonical 5-mode ViewMode', () => {
  it('setViewMode accepts and stores every canonical value', () => {
    const setViewMode = useGraphEditorStore.getState().setViewMode;
    for (const m of CANONICAL) {
      setViewMode(m);
      expect(useGraphEditorStore.getState().viewMode as unknown as string).toBe(m);
    }
  });

  it('normalizeViewMode maps legacy → canonical per §9 RA-06', () => {
    expect(normalizeViewMode('editor')).toBe('hub-world');
    expect(normalizeViewMode('split')).toBe('canvas');
    expect(normalizeViewMode('preview')).toBe('preview-hub');
  });

  it('normalizeViewMode is the identity on every canonical value', () => {
    for (const m of CANONICAL) {
      expect(normalizeViewMode(m)).toBe(m);
    }
  });

  it('initial viewMode is one of AnyViewMode (canonical ∪ legacy transient)', () => {
    const initial = useGraphEditorStore.getState().viewMode as unknown as string;
    const allowed = new Set<string>([...CANONICAL, ...LEGACY]);
    expect(allowed.has(initial)).toBe(true);
  });
});
