// P1 TEXT SYSTEM (Task B) — pure-helper tests for the Text toolbar group.
// Node env; no DOM (the helpers are DOM-free by construction).

import { describe, expect, it } from 'vitest';
import { TEXT_SPEC_DEFAULT } from '@/lib/prism-graph/types';
import type { TextSpec } from '@/lib/prism-graph/types';
import type { FontManifestEntry } from '@/lib/prism/text/contract';
import {
  TEXT_PRESETS,
  applyPreset,
  clampWeight,
  coerceFill,
  effectiveTextSpec,
  filterFonts,
  rawTextSpec,
  weightsFor,
} from '@/components/editor/text-tools/text-tool-helpers';

const FONTS: FontManifestEntry[] = [
  { family: 'Inter', category: 'sans-serif', weights: [400, 700], core: true },
  { family: 'Playfair Display', category: 'serif', weights: [400, 500, 700], core: true },
  { family: 'Zilla Slab', category: 'serif', weights: [300, 400], core: false },
  { family: 'Space Mono', category: 'monospace', weights: [400], core: false },
];

describe('effectiveTextSpec / rawTextSpec', () => {
  it('resolves over TEXT_SPEC_DEFAULT when nothing is set', () => {
    const eff = effectiveTextSpec(undefined, undefined);
    expect(eff.fontFamily).toBe(TEXT_SPEC_DEFAULT.fontFamily);
    expect(eff.fontSize).toBe(TEXT_SPEC_DEFAULT.fontSize);
    expect(eff.fill).toEqual(TEXT_SPEC_DEFAULT.fill);
  });

  it('source overrides defaults; preview wholesale-replaces source', () => {
    const source: TextSpec = { fontFamily: 'Lora', fontSize: 0.7 };
    expect(effectiveTextSpec(source, undefined).fontFamily).toBe('Lora');
    // Preview replaces the whole sub-object (MaterialTab semantics):
    const preview: TextSpec = { fontFamily: 'Inter' };
    const eff = effectiveTextSpec(source, preview);
    expect(eff.fontFamily).toBe('Inter');
    // fontSize from SOURCE does not leak through a preview that replaced it —
    // it falls back to the default (preview buffers always carry the whole
    // merged spec in practice, built via rawTextSpec).
    expect(eff.fontSize).toBe(TEXT_SPEC_DEFAULT.fontSize);
  });

  it('rawTextSpec prefers preview, then source, never expands defaults', () => {
    expect(rawTextSpec(undefined, undefined)).toEqual({});
    expect(rawTextSpec({ fontSize: 0.7 }, undefined)).toEqual({ fontSize: 0.7 });
    expect(rawTextSpec({ fontSize: 0.7 }, { fontSize: 0.9 })).toEqual({ fontSize: 0.9 });
  });
});

describe('coerceFill', () => {
  it('switches kinds with sensible carries', () => {
    const solid = coerceFill('solid', undefined);
    expect(solid).toEqual({ kind: 'solid', color: '#e8e4da' });

    const grad = coerceFill('gradient', { kind: 'solid', color: '#112233' });
    expect(grad.kind).toBe('gradient');
    if (grad.kind === 'gradient') {
      expect(grad.from).toBe('#112233');
      expect(typeof grad.to).toBe('string');
      expect(grad.angleDeg).toBe(0);
    }

    const backToSolid = coerceFill('solid', grad);
    expect(backToSolid).toEqual({ kind: 'solid', color: '#112233' });
  });

  it('carries texture url into and out of ai-texture', () => {
    const ai = coerceFill('ai-texture', undefined);
    expect(ai).toEqual({ kind: 'ai-texture', prompt: '' });

    const aiWithUrl = { kind: 'ai-texture' as const, prompt: 'molten', url: 'data:x' };
    const tex = coerceFill('texture', aiWithUrl);
    expect(tex).toEqual({ kind: 'texture', url: 'data:x' });

    const ai2 = coerceFill('ai-texture', aiWithUrl);
    expect(ai2).toEqual({ kind: 'ai-texture', prompt: 'molten', url: 'data:x' });
  });
});

describe('filterFonts', () => {
  it('is case-insensitive over family and category', () => {
    expect(filterFonts(FONTS, 'zilla').entries.map((f) => f.family)).toEqual(['Zilla Slab']);
    const serif = filterFonts(FONTS, 'SERIF');
    // 'sans-serif' and 'serif' categories both contain "serif".
    expect(serif.total).toBe(3);
  });

  it('caps entries but reports the true total', () => {
    const r = filterFonts(FONTS, '', 2);
    expect(r.entries).toHaveLength(2);
    expect(r.total).toBe(4);
  });

  it('surfaces core families first on an empty query', () => {
    const r = filterFonts(FONTS, '');
    expect(r.entries[0].core).toBe(true);
    expect(r.entries[1].core).toBe(true);
    expect(r.entries[2].core).toBe(false);
  });
});

describe('weightsFor / clampWeight', () => {
  it('reads the manifest entry with a 400 fallback', () => {
    expect(weightsFor(FONTS, 'Playfair Display')).toEqual([400, 500, 700]);
    expect(weightsFor(FONTS, 'Nope')).toEqual([400]);
    expect(weightsFor(null, 'Inter')).toEqual([400]);
  });

  it('keeps the desired weight when available, else 400, else first', () => {
    expect(clampWeight([400, 700], 700)).toBe(700);
    expect(clampWeight([400, 700], 500)).toBe(400);
    expect(clampWeight([300, 600], 500)).toBe(300);
    expect(clampWeight([], 500)).toBe(400);
  });
});

describe('TEXT_PRESETS / applyPreset', () => {
  it('ships 6-8 presets, all naming a real fill and a font family', () => {
    expect(TEXT_PRESETS.length).toBeGreaterThanOrEqual(6);
    expect(TEXT_PRESETS.length).toBeLessThanOrEqual(8);
    for (const p of TEXT_PRESETS) {
      expect(p.spec.fontFamily).toBeTruthy();
      expect(p.spec.fill?.kind).toMatch(/^(solid|gradient)$/);
      // Presets must never touch content.
      expect('content' in p.spec).toBe(false);
    }
  });

  it('merges onto the current spec without touching content', () => {
    const current: TextSpec = { content: 'Hello\nPrism', fontSize: 0.9 };
    const preset = TEXT_PRESETS.find((p) => p.id === 'outline-wire')!;
    const next = applyPreset(current, preset);
    expect(next.content).toBe('Hello\nPrism');
    expect(next.fontFamily).toBe('Inter');
    expect(next.outline?.width).toBeGreaterThan(0);
    // fontSize survives when the preset doesn't specify it.
    expect(next.fontSize).toBe(0.9);
  });

  it('replaces fill wholesale (no cross-kind field bleed)', () => {
    const current: TextSpec = {
      content: 'X',
      fill: { kind: 'texture', url: 'data:y' },
    };
    const preset = TEXT_PRESETS.find((p) => p.id === 'display-brass')!;
    const next = applyPreset(current, preset);
    expect(next.fill?.kind).toBe('gradient');
    expect((next.fill as { url?: string }).url).toBeUndefined();
  });
});
