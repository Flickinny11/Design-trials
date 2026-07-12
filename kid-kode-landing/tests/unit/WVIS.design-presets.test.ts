// W-VIS D3 — design-preset library tests: catalog floors (>=12 rigs, >=10
// framings, >=10 layouts spanning 2D+3D), DL2 palette discipline, selection
// resolution, numeric prompt block, and mood fallback determinism.

import { describe, expect, it } from 'vitest';
import {
  LIGHT_RIGS, CAMERA_FRAMINGS, COMPOSITION_LAYOUTS,
  resolvePresetSelections, buildPresetSelectionPromptBlock,
  buildPresetCatalogDigest, selectPresetsByMood,
} from '@/lib/prism/design-presets';
import { buildCodegenPrompt } from '@/lib/prism/codegen/prompts';
import type { PrismNode } from '@/lib/prism-graph/types';

describe('W-VIS D3 — catalog floors', () => {
  it('>=12 light rigs, each with a key light and mood tags', () => {
    expect(LIGHT_RIGS.length).toBeGreaterThanOrEqual(12);
    for (const r of LIGHT_RIGS) {
      expect(r.moods.length).toBeGreaterThan(0);
      expect(r.lights.some((l) => l.role === 'key' || l.role === 'rim')).toBe(true);
      expect(r.thumbUrl).toMatch(/^\/design-presets\/thumbs\//);
    }
  });

  it('>=10 camera framings with numeric fov/position/lookAt', () => {
    expect(CAMERA_FRAMINGS.length).toBeGreaterThanOrEqual(10);
    for (const c of CAMERA_FRAMINGS) {
      expect(c.fov).toBeGreaterThan(0);
      expect(c.position).toHaveLength(3);
      expect(c.lookAt).toHaveLength(3);
      expect(c.subjectHeightFraction).toBeGreaterThan(0);
      expect(c.subjectHeightFraction).toBeLessThanOrEqual(1);
    }
  });

  it('>=10 composition layouts spanning BOTH 2d and 3d', () => {
    expect(COMPOSITION_LAYOUTS.length).toBeGreaterThanOrEqual(10);
    const spans = new Set(COMPOSITION_LAYOUTS.map((l) => l.span));
    expect(spans.has('2d') || spans.has('both')).toBe(true);
    expect(spans.has('3d') || spans.has('both')).toBe(true);
    // strict: at least one pure-2d and one pure-3d layout
    expect(COMPOSITION_LAYOUTS.some((l) => l.span === '2d')).toBe(true);
    expect(COMPOSITION_LAYOUTS.some((l) => l.span === '3d')).toBe(true);
    for (const l of COMPOSITION_LAYOUTS) {
      expect(l.regions.length).toBeGreaterThan(0);
      for (const rg of l.regions) {
        for (const v of rg.rect) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
      }
      expect(l.regions.some((rg) => rg.role === l.focalRole)).toBe(true);
    }
  });

  it('DL2 palette discipline: no default-blue light colors anywhere', () => {
    for (const r of LIGHT_RIGS) {
      for (const l of r.lights) {
        const hex = l.color.replace('#', '');
        const rr = parseInt(hex.slice(0, 2), 16);
        const bb = parseInt(hex.slice(4, 6), 16);
        // blue-dominant (b significantly above r) = default-blue drift
        expect(bb).toBeLessThanOrEqual(rr + 24);
      }
    }
  });

  it('unique ids across all three catalogs', () => {
    const ids = [...LIGHT_RIGS, ...CAMERA_FRAMINGS, ...COMPOSITION_LAYOUTS].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('W-VIS D3 — selection + prompt block', () => {
  it('resolves known ids and surfaces unknown ids', () => {
    const r = resolvePresetSelections({ lightRig: 'rig-noir-crimson', cameraFraming: 'cam-hero-three-quarter', compositionLayout: 'nope' });
    expect(r.lightRig?.id).toBe('rig-noir-crimson');
    expect(r.cameraFraming?.id).toBe('cam-hero-three-quarter');
    expect(r.unknownIds).toEqual(['nope']);
  });

  it('prompt block inlines the exact preset numbers', () => {
    const block = buildPresetSelectionPromptBlock({ lightRig: 'rig-noir-crimson', cameraFraming: 'cam-low-angle-monument', compositionLayout: 'layout-type-sandwich' });
    expect(block).toContain('#ff2a38'); // the crimson rim
    expect(block).toContain('fov 44'); // low-angle monument
    expect(block).toContain('depth -1.6'); // type-sandwich headline behind subject
    expect(block).toContain('FOCAL');
  });

  it('empty selection -> empty block (freeform fallback stays byte-identical)', () => {
    expect(buildPresetSelectionPromptBlock(undefined)).toBe('');
    expect(buildPresetSelectionPromptBlock({})).toBe('');
  });

  it('catalog digest lists every id for the director', () => {
    const digest = buildPresetCatalogDigest();
    for (const p of [...LIGHT_RIGS, ...CAMERA_FRAMINGS, ...COMPOSITION_LAYOUTS]) expect(digest).toContain(p.id);
  });

  it('mood fallback is deterministic and span-aware', () => {
    const a = selectPresetsByMood(['noir', 'dramatic'], true);
    const b = selectPresetsByMood(['noir', 'dramatic'], true);
    expect(a).toEqual(b);
    const layout3d = COMPOSITION_LAYOUTS.find((l) => l.id === a.compositionLayout);
    expect(layout3d?.span === '3d' || layout3d?.span === 'both').toBe(true);
  });
});

describe('W-VIS D3 — codegen prompt wiring (additive)', () => {
  const baseNode = {
    nodeId: 'p', renderMode: 'plane',
    intent: { caption: 'x', visualSpec: { textContent: [], layers: [] } },
  } as unknown as PrismNode;

  it('node WITHOUT selections gets no preset section', () => {
    const p = buildCodegenPrompt(baseNode, { parent: null, siblings: [], children: [] }, { atlasIndex: 0, x: 0, y: 0, width: 1, height: 1 });
    expect(p.user).not.toContain('DESIGN PRESETS');
  });

  it('node WITH selections gets the numeric preset section', () => {
    const node = JSON.parse(JSON.stringify(baseNode)) as PrismNode;
    (node.intent!.visualSpec as Record<string, unknown>).presetSelections = { lightRig: 'rig-product-hero' };
    const p = buildCodegenPrompt(node, { parent: null, siblings: [], children: [] }, { atlasIndex: 0, x: 0, y: 0, width: 1, height: 1 });
    expect(p.user).toContain('DESIGN PRESETS');
    expect(p.user).toContain('rig-product-hero');
    // Key intensity reflects the physical-light retune (spot key ~x12.5 under
    // decay-2 candela; commit 4e2e9332). The prompt block emits the shipped number.
    expect(p.user).toContain('intensity 65');
  });
});
