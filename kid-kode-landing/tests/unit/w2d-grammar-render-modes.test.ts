// W-2D — design-grammar renderModes axis: every family carries an honest
// 2d/3d appropriateness claim, the query API filters on it, anti-repetition
// selection composes with it, and the validator enforces the vocabulary.

import { describe, it, expect } from 'vitest';
import path from 'node:path';

import {
  loadGrammar,
  queryFamilies,
  selectDistinctOptions,
  validateFamilyDoc,
} from '../../design-grammar';

const grammar = loadGrammar(path.join(process.cwd(), 'design-grammar'));

describe('W-2D grammar renderModes', () => {
  it('the corpus loads clean and every family declares renderModes', () => {
    expect(grammar.errors).toEqual([]);
    expect(grammar.families.length).toBeGreaterThanOrEqual(14);
    for (const f of grammar.families) {
      expect(Array.isArray(f.capabilities.renderModes), f.id).toBe(true);
      expect(f.capabilities.renderModes!.length, f.id).toBeGreaterThan(0);
      for (const m of f.capabilities.renderModes!) {
        expect(['2d', '3d'], f.id).toContain(m);
      }
      // Every family is renderable in a 3d hub — '2d' is the affirmative claim.
      expect(f.capabilities.renderModes, f.id).toContain('3d');
    }
  });

  it('depth-essence families are honestly 3d-only', () => {
    for (const id of [
      'coverflow-3d-carousel',
      'filmstrip-3d-carousel',
      'layered-photo-parallax-hero',
      'parallax-zoom-deep-dive',
      'particle-field-hero',
    ]) {
      const f = grammar.byId.get(id);
      expect(f, id).toBeDefined();
      expect(f!.capabilities.renderModes, id).toEqual(['3d']);
    }
  });

  it('queryFamilies renderMode axis: 2d returns only 2d-appropriate families', () => {
    const flat = queryFamilies(grammar, { renderMode: '2d' });
    expect(flat.length).toBeGreaterThan(0);
    for (const f of flat) {
      expect(f.capabilities.renderModes, f.id).toContain('2d');
    }
    // 3d returns the whole corpus (every family carries '3d').
    expect(queryFamilies(grammar, { renderMode: '3d' })).toHaveLength(grammar.families.length);
    // A family with NO renderModes counts as ["3d"] (honesty default).
    const stripped = grammar.families.map((f) => ({
      ...f,
      capabilities: { ...f.capabilities, renderModes: undefined },
    }));
    const legacy = { ...grammar, families: stripped };
    expect(queryFamilies(legacy, { renderMode: '2d' })).toHaveLength(0);
  });

  it('selectDistinctOptions composes with the renderMode axis (anti-repetition intact)', () => {
    const picks = selectDistinctOptions(grammar, { renderMode: '2d' }, 4);
    expect(picks.length).toBeGreaterThan(1);
    const clusters = new Set(picks.map((p) => p.antiRepetition.clusterId));
    expect(clusters.size).toBe(picks.length); // one per cluster
    for (const p of picks) expect(p.capabilities.renderModes).toContain('2d');
  });

  it('validator: bad renderModes values are rejected; absent is legal', () => {
    const base = JSON.parse(JSON.stringify(grammar.families[0]));
    base.capabilities.renderModes = ['flat'];
    expect(validateFamilyDoc(base).some((e) => e.includes('renderModes'))).toBe(true);
    base.capabilities.renderModes = [];
    expect(validateFamilyDoc(base).some((e) => e.includes('renderModes'))).toBe(true);
    delete base.capabilities.renderModes;
    expect(validateFamilyDoc(base).filter((e) => e.includes('renderModes'))).toEqual([]);
  });
});
