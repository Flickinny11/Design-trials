// EB-09-01 — Animation library catalog UI: three methodologies preserved.
//
// Spec refs:
//   §9 SC-047  "Animation library catalog UI in Inspector → Animation tab;
//               preserves all three methodologies (frame-based/i2v,
//               code-based, hybrid overlay) as distinct categories."
//   §9 SC-048  "Library entries reference the 9 cinematic primitives from
//               CINEMATIC-PRIMITIVES-LIBRARY.md (no new primitives invented
//               — INV-12)."
//   §9 INV-12  "Cinematic primitives are a curated fixed library of exactly
//               9 primitives (orbit, depth-rotate, dissolve-morph,
//               displacement-transition, parallax-scroll, magnetic-cursor,
//               particle-emerge, fly-through, kinetic-text). The codegen
//               model selects by name; no scene-level animation authored
//               from scratch."
//
// haltCheck (from ralph-state.json EB-09-01):
//   "Inspector's Animation tab shows a Library section with three category
//    tabs: 'i2v Frame-based', 'Code-based', 'Hybrid Overlay'. Each
//    category lists at least one entry. Methodologies are never collapsed
//    into a single list."
//
// Source-shape strategy: matches established editor-build pattern. The
// fully rendered UI is exercised by the two-runtime snapshot at
// notes/ralph-snapshots/EB-09-01/. These assertions verify the *data
// contract* (catalog module) and the *source-shape contract* (Inspector
// renders the three category tabs from the canonical methodologies tuple).

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  ANIMATION_METHODOLOGIES,
  ANIMATION_LIBRARY,
  getLibraryByMethodology,
  type AnimationMethodology,
  type AnimationLibraryEntry,
} from '@/lib/prism-graph/animation-library';
import type { CinematicPrimitiveName } from '@/lib/prism-graph/cinematic-primitives';

const repoRoot = join(__dirname, '..', '..');
const inspectorSrc = readFileSync(
  join(repoRoot, 'src', 'components', 'editor', 'panels', 'Inspector.tsx'),
  'utf8',
);
const librarySrc = readFileSync(
  join(repoRoot, 'src', 'lib', 'prism-graph', 'animation-library.ts'),
  'utf8',
);

const NINE_PRIMITIVES: CinematicPrimitiveName[] = [
  'orbit',
  'depth-rotate',
  'dissolve-morph',
  'displacement-transition',
  'parallax-scroll',
  'magnetic-cursor',
  'particle-emerge',
  'fly-through',
  'kinetic-text',
];

describe('EB-09-01 — animation library catalog (SC-047, SC-048, INV-12)', () => {
  describe('SC-047: three methodologies preserved as distinct categories', () => {
    it('ANIMATION_METHODOLOGIES contains exactly the three canonical methodologies', () => {
      expect(ANIMATION_METHODOLOGIES).toEqual([
        'i2v Frame-based',
        'Code-based',
        'Hybrid Overlay',
      ]);
    });

    it('ANIMATION_METHODOLOGIES length is exactly 3 (never collapsed)', () => {
      expect(ANIMATION_METHODOLOGIES).toHaveLength(3);
    });

    it('every methodology has at least one library entry', () => {
      for (const m of ANIMATION_METHODOLOGIES) {
        const entries = getLibraryByMethodology(m);
        expect(entries.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('every library entry is tagged with one of the three methodologies', () => {
      for (const entry of ANIMATION_LIBRARY) {
        expect(ANIMATION_METHODOLOGIES).toContain(entry.methodology);
      }
    });
  });

  describe('SC-048 + INV-12: entries reference the 9 cinematic primitives', () => {
    it('every entry references a primitive name from the canonical 9', () => {
      for (const entry of ANIMATION_LIBRARY) {
        expect(NINE_PRIMITIVES).toContain(entry.primitive);
      }
    });

    it('library contains no entry that invents a non-canonical primitive', () => {
      const primitiveNames = new Set(ANIMATION_LIBRARY.map((e) => e.primitive));
      for (const name of primitiveNames) {
        expect(NINE_PRIMITIVES).toContain(name);
      }
    });

    it('library surfaces all 9 cinematic primitives at least once across methodologies', () => {
      const seen = new Set(ANIMATION_LIBRARY.map((e) => e.primitive));
      for (const name of NINE_PRIMITIVES) {
        expect(seen).toContain(name);
      }
    });

    it('every entry has a non-empty id and label', () => {
      for (const entry of ANIMATION_LIBRARY) {
        expect(entry.id).toMatch(/^[a-z0-9-]+$/);
        expect(entry.label.length).toBeGreaterThan(0);
      }
    });

    it('entry ids are unique', () => {
      const ids = ANIMATION_LIBRARY.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('types: AnimationLibraryEntry and AnimationMethodology shape', () => {
    it('AnimationMethodology is the union of the three string literals', () => {
      const sample: AnimationMethodology = 'i2v Frame-based';
      expect(ANIMATION_METHODOLOGIES).toContain(sample);
    });

    it('AnimationLibraryEntry carries { id, label, methodology, primitive }', () => {
      const sample: AnimationLibraryEntry = ANIMATION_LIBRARY[0];
      expect(sample).toHaveProperty('id');
      expect(sample).toHaveProperty('label');
      expect(sample).toHaveProperty('methodology');
      expect(sample).toHaveProperty('primitive');
    });
  });

  describe('source-shape: Inspector Animation tab renders the library', () => {
    it('Inspector.tsx imports the animation-library module', () => {
      expect(inspectorSrc).toMatch(
        /from\s+['"]@\/lib\/prism-graph\/animation-library['"]/,
      );
    });

    it('Inspector.tsx renders an animation-library test-id surface', () => {
      expect(inspectorSrc).toMatch(/data-testid=["']animation-library["']/);
    });

    it('Inspector.tsx renders a category-tabs test-id surface', () => {
      expect(inspectorSrc).toMatch(/data-testid=["']animation-library-tabs["']/);
    });

    it('Inspector.tsx drives the category tabs from ANIMATION_METHODOLOGIES (not a hardcoded literal)', () => {
      // Either map over the constant or destructure it — but the canonical
      // tuple MUST be the source of the three tabs so SC-047 stays in lockstep
      // with the type definition.
      expect(inspectorSrc).toMatch(/ANIMATION_METHODOLOGIES/);
    });

    it('animation-library module is the single source of truth for the three labels (no inline duplicates in Inspector)', () => {
      // Defense: an inline string-literal array of the three methodologies
      // in Inspector.tsx would let a refactor silently drift the UI away
      // from the canonical tuple. The labels are read from the module.
      const inlineArrayPattern =
        /\[\s*['"]i2v Frame-based['"]\s*,\s*['"]Code-based['"]\s*,\s*['"]Hybrid Overlay['"]\s*\]/;
      expect(inlineArrayPattern.test(inspectorSrc)).toBe(false);
    });

    it('library module exposes the three methodology literals once (source of truth)', () => {
      // Sanity: the canonical tuple lives in the library module.
      expect(librarySrc).toMatch(/['"]i2v Frame-based['"]/);
      expect(librarySrc).toMatch(/['"]Code-based['"]/);
      expect(librarySrc).toMatch(/['"]Hybrid Overlay['"]/);
    });
  });

  describe('snapshot directory (post-implementation gate)', () => {
    it('EB-09-01 snapshot directory contains outer.png + inner.png + state.json', () => {
      const dir = join(repoRoot, 'notes', 'ralph-snapshots', 'EB-09-01');
      expect(existsSync(dir)).toBe(true);
      const files = readdirSync(dir);
      for (const name of ['outer.png', 'inner.png', 'state.json']) {
        expect(files).toContain(name);
      }
    });
  });
});
