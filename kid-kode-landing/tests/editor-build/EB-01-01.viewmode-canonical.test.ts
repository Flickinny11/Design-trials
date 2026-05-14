// EB-01-01 — canonical 5-mode ViewMode type.
//
// Spec refs: §6 SC-001, §7 INV-20, §9 RA-06 of PRISM-EDITOR-BUILD-SPEC.md.
//
// Runtime assertions only — the post-edit-typecheck hook blocks any test that
// fails at TS-compile time, so the canonical-shape claim is enforced separately
// by the iteration's grep verification command:
//   grep -q "'galaxy' | 'hub-world' | 'canvas' | 'preview-hub' | 'preview-app'"
//     kid-kode-landing/src/stores/useGraphEditorStore.ts
//
// What this file proves at runtime:
//   1. The store's `viewMode` initial value is one of the canonical 5
//      (the legacy `'split'` default must be remapped to `'canvas'` per RA-06).
//   2. `setViewMode` round-trips every canonical value into store state.
//   3. The legacy `'preview' | 'editor' | 'split'` triplet is accepted as a
//      transient alias and translated to its canonical equivalent per RA-06.

import { describe, it, expect } from 'vitest';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';

const CANONICAL = new Set([
  'galaxy',
  'hub-world',
  'canvas',
  'preview-hub',
  'preview-app',
]);

// Cast the setter to a string-permissive signature for the duration of the
// test. The store accepts the canonical 5 strictly + the 3 legacy strings
// transiently; both forms reduce to a canonical value once stored. This cast
// keeps the test compiling against both the pre- and post-implementation
// shape of `ViewMode`.
const setAny = useGraphEditorStore.getState().setViewMode as unknown as (
  m: string,
) => void;

describe('EB-01-01 — canonical 5-mode ViewMode', () => {
  it('initial viewMode is one of the canonical 5 (RA-06 default mapping)', () => {
    const initial = useGraphEditorStore.getState().viewMode as unknown as string;
    expect(CANONICAL.has(initial)).toBe(true);
  });

  it('setViewMode round-trips every canonical mode', () => {
    for (const m of [
      'galaxy',
      'hub-world',
      'canvas',
      'preview-hub',
      'preview-app',
    ]) {
      setAny(m);
      const stored = useGraphEditorStore.getState().viewMode as unknown as string;
      expect(stored).toBe(m);
    }
  });

  it('legacy aliases are translated per RA-06', () => {
    // editor → hub-world (default)
    setAny('editor');
    expect(useGraphEditorStore.getState().viewMode as unknown as string).toBe(
      'hub-world',
    );
    // split → canvas (superseded)
    setAny('split');
    expect(useGraphEditorStore.getState().viewMode as unknown as string).toBe(
      'canvas',
    );
    // preview → preview-hub
    setAny('preview');
    expect(useGraphEditorStore.getState().viewMode as unknown as string).toBe(
      'preview-hub',
    );
  });
});
