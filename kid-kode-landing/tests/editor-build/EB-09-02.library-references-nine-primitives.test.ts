// EB-09-02 — Library entries reference the 9 fixed cinematic primitives only.
//
// Spec refs:
//   §9 SC-048  "Library entries reference the 9 cinematic primitives from
//               CINEMATIC-PRIMITIVES-LIBRARY.md (no new primitives invented
//               — INV-12)."
//   §7 INV-12  "Cinematic primitives are a curated fixed library of exactly
//               9 primitives (orbit, depth-rotate, dissolve-morph,
//               displacement-transition, parallax-scroll, magnetic-cursor,
//               particle-emerge, fly-through, kinetic-text). The codegen
//               model selects by name; no scene-level animation authored
//               from scratch."
//
// haltCheck (from ralph-state.json EB-09-02):
//   "animation-library catalog references exactly the 9 cinematic primitives
//    from CINEMATIC-PRIMITIVES-LIBRARY.md; no entry invents a new primitive;
//    test enumerates entries and confirms."
//
// Strategy: derive the canonical primitive set from THREE sources and
// confirm pairwise set-equality. This catches doc/code drift in any
// direction:
//
//   (a) CINEMATIC-PRIMITIVES-LIBRARY.md           — the registration block
//   (b) src/lib/prism-graph/cinematic-primitives.ts — the TS union type
//   (c) src/lib/prism-graph/animation-library.ts    — the catalog entries
//
// All three MUST agree on exactly the same 9 names. The EB-09-01 test
// covers a weaker contract (catalog uses values from the union); this test
// pins the doc → type → catalog chain in lockstep with INV-12's "curated
// fixed library of exactly 9".

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ANIMATION_LIBRARY,
} from '@/lib/prism-graph/animation-library';
import type { CinematicPrimitiveName } from '@/lib/prism-graph/cinematic-primitives';

const repoRoot = join(__dirname, '..', '..');
const primitivesDocPath = join(
  repoRoot,
  'docs',
  'prism',
  'CINEMATIC-PRIMITIVES-LIBRARY.md',
);
const primitivesTypePath = join(
  repoRoot,
  'src',
  'lib',
  'prism-graph',
  'cinematic-primitives.ts',
);

function readDocPrimitiveNames(): string[] {
  // Parse the `primitives = { 'name': fn, ... }` registration block in the
  // doc — that is the canonical wire-name list per §11 / Primitive 1..9.
  const src = readFileSync(primitivesDocPath, 'utf8');
  const blockMatch = src.match(
    /export\s+const\s+primitives\s*=\s*\{([\s\S]*?)\};/,
  );
  if (!blockMatch) {
    throw new Error(
      'CINEMATIC-PRIMITIVES-LIBRARY.md: could not locate `export const primitives = { ... }` registration block',
    );
  }
  const names: string[] = [];
  const entryRe = /['"]([a-z][a-z0-9-]*)['"]\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(blockMatch[1])) !== null) {
    names.push(m[1]);
  }
  return names;
}

function readTypeUnionPrimitiveNames(): string[] {
  // Parse the `export type CinematicPrimitiveName = 'a' | 'b' | ...` union.
  const src = readFileSync(primitivesTypePath, 'utf8');
  const unionMatch = src.match(
    /export\s+type\s+CinematicPrimitiveName\s*=\s*([^;]+);/,
  );
  if (!unionMatch) {
    throw new Error(
      'cinematic-primitives.ts: could not locate `export type CinematicPrimitiveName = ...` union',
    );
  }
  const names: string[] = [];
  const literalRe = /['"]([a-z][a-z0-9-]*)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = literalRe.exec(unionMatch[1])) !== null) {
    names.push(m[1]);
  }
  return names;
}

const DOC_NAMES = readDocPrimitiveNames();
const UNION_NAMES = readTypeUnionPrimitiveNames();
const CATALOG_NAMES: string[] = ANIMATION_LIBRARY.map((e) => e.primitive);

describe('EB-09-02 — library references exactly the 9 fixed cinematic primitives (SC-048, INV-12)', () => {
  describe('CINEMATIC-PRIMITIVES-LIBRARY.md is the source of truth for 9 names', () => {
    it('doc registration block declares exactly 9 primitive names', () => {
      expect(DOC_NAMES).toHaveLength(9);
    });

    it('doc lists the canonical 9 (orbit, depth-rotate, ...)', () => {
      expect(new Set(DOC_NAMES)).toEqual(
        new Set([
          'orbit',
          'depth-rotate',
          'dissolve-morph',
          'displacement-transition',
          'parallax-scroll',
          'magnetic-cursor',
          'particle-emerge',
          'fly-through',
          'kinetic-text',
        ]),
      );
    });
  });

  describe('CinematicPrimitiveName type union matches the doc exactly', () => {
    it('union has exactly 9 string literals', () => {
      expect(UNION_NAMES).toHaveLength(9);
    });

    it('union set equals doc set (no extras, no omissions)', () => {
      expect(new Set(UNION_NAMES)).toEqual(new Set(DOC_NAMES));
    });
  });

  describe('animation-library catalog references exactly those 9 (SC-048 / INV-12)', () => {
    it('catalog references at least one entry per primitive', () => {
      const seen = new Set(CATALOG_NAMES);
      expect(seen).toEqual(new Set(DOC_NAMES));
    });

    it('catalog set equals the doc set — no invented primitive', () => {
      const catalogSet = new Set(CATALOG_NAMES);
      // Reject any primitive in catalog not present in doc.
      for (const name of catalogSet) {
        expect(DOC_NAMES).toContain(name);
      }
      // Reject any primitive in doc not surfaced by catalog (curated library
      // means every entry has a place; INV-12's "fixed library" must be
      // visible end-to-end).
      for (const name of DOC_NAMES) {
        expect(catalogSet).toContain(name);
      }
    });

    it('every catalog entry is typed by the canonical union (no string-cast escapes)', () => {
      for (const entry of ANIMATION_LIBRARY) {
        // Static check: type assignment compiles only because entry.primitive
        // is CinematicPrimitiveName. Runtime check: still within the union.
        const checked: CinematicPrimitiveName = entry.primitive;
        expect(UNION_NAMES).toContain(checked);
      }
    });
  });

  describe('enumeration: every entry confirms (haltCheck)', () => {
    it('enumerates each ANIMATION_LIBRARY entry and confirms its primitive ∈ doc set', () => {
      // Explicit per-entry enumeration as called for in the haltCheck.
      let enumerated = 0;
      for (const entry of ANIMATION_LIBRARY) {
        enumerated += 1;
        expect(DOC_NAMES).toContain(entry.primitive);
      }
      expect(enumerated).toBe(ANIMATION_LIBRARY.length);
      expect(enumerated).toBeGreaterThanOrEqual(9);
    });
  });
});
