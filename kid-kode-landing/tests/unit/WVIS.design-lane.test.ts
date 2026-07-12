// W-VIS D4/D5 — reference-frame conditioning + design-lane contract tests.

import { describe, expect, it } from 'vitest';
import {
  buildCompositionFramePrompt,
  buildFrameDescriptionFallback,
  buildReferenceFrameBlock,
  FRAME_FIDELITY_RUBRIC_ADDENDUM,
} from '@/lib/prism/codegen/reference-frame';
import {
  DESIGN_LANE_DEFAULT,
  classifyDesignCriticality,
  buildSelfRevisionPrompt,
  mayIterate,
} from '@/lib/prism/codegen/design-lane';
import type { PrismNode } from '@/lib/prism-graph/types';

const NODE = {
  nodeId: 'n', renderMode: 'mesh', subtype: 'product-hero',
  intent: {
    caption: 'Orbit product hero — machined metal on a plinth',
    visualSpec: {
      textContent: [], layers: [],
      colors: { background: '#0b0b10', accent: '#ff2a38' },
      effects: 'key+rim lighting, slow orbital presentation',
      presetSelections: { lightRig: 'rig-product-hero', cameraFraming: 'cam-hero-three-quarter', compositionLayout: 'layout-pedestal-stage' },
    },
  },
} as unknown as PrismNode;

describe('W-VIS D4 — reference-frame conditioning', () => {
  it('FLUX prompt carries palette + preset intents and forbids text', () => {
    const p = buildCompositionFramePrompt(NODE);
    expect(p).toContain('#0b0b10');
    expect(p).toContain('#ff2a38');
    expect(p.toLowerCase()).toContain('no text');
    expect(p).toContain('45°'); // product-hero rig intent
  });

  it('text fallback is a structured description derived from the same spec', () => {
    const d = buildFrameDescriptionFallback(NODE);
    expect(d).toContain('REFERENCE COMPOSITION');
    expect(d).toContain('#ff2a38');
    expect(d).toContain('Pedestal stage');
    expect(d).toContain('Focal element: subject');
    expect(d).toContain('fov 38');
  });

  it('arm block: image arm instructs reference-not-texture; none arm is empty', () => {
    expect(buildReferenceFrameBlock('image', NODE)).toContain('REFERENCE, not a texture');
    expect(buildReferenceFrameBlock('text-fallback', NODE)).toContain('structured description');
    expect(buildReferenceFrameBlock('none', NODE)).toBe('');
  });

  it('critic addendum defines the frameFidelity axis', () => {
    expect(FRAME_FIDELITY_RUBRIC_ADDENDUM).toContain('frameFidelity');
  });
});

describe('W-VIS D5 — design-lane contract', () => {
  it('see-then-revise is the DEFAULT with OD11 budget caps (hero 2 / standard 1)', () => {
    expect(DESIGN_LANE_DEFAULT.seeThenRevise).toBe(true);
    expect(DESIGN_LANE_DEFAULT.budgets.hero.maxSeenIterations).toBe(2);
    expect(DESIGN_LANE_DEFAULT.budgets.standard.maxSeenIterations).toBe(1);
    expect(DESIGN_LANE_DEFAULT.slo).toEqual({ targetScore: 85, targetRate: 0.8 });
  });

  it('criticality classifier: 3D showcase = hero, footer = standard, plan override wins', () => {
    expect(classifyDesignCriticality(NODE, true)).toBe('hero');
    const footer = { nodeId: 'f', renderMode: 'plane', subtype: 'footer', intent: { caption: 'Footer colophon' } } as unknown as PrismNode;
    expect(classifyDesignCriticality(footer, false)).toBe('standard');
    const overridden = { ...footer, intent: { ...footer.intent, designCriticality: 'hero' } } as unknown as PrismNode;
    expect(classifyDesignCriticality(overridden, false)).toBe('hero');
  });

  it('mayIterate enforces the budget and the config gate', () => {
    expect(mayIterate(DESIGN_LANE_DEFAULT, 'hero', 0)).toBe(true);
    expect(mayIterate(DESIGN_LANE_DEFAULT, 'hero', 2)).toBe(false);
    expect(mayIterate(DESIGN_LANE_DEFAULT, 'standard', 1)).toBe(false);
    expect(mayIterate({ ...DESIGN_LANE_DEFAULT, seeThenRevise: false }, 'hero', 0)).toBe(false);
  });

  it('self-revision prompt: with critique carries anchored defects; without critique asks self-review', () => {
    const withCritique = buildSelfRevisionPrompt({
      iteration: 1, maxIterations: 2, hasFrame: true,
      critique: { score: 22, mustFix: [{ defect: 'FLAT_VOID', region: 'right half' }], notes: 'empty stage' },
      l3: 'SPEC', previousModule: 'MODULE',
    });
    expect(withCritique).toContain('FLAT_VOID — right half');
    expect(withCritique).toContain('22/100');
    const selfReview = buildSelfRevisionPrompt({ iteration: 1, maxIterations: 2, hasFrame: true, critique: null, l3: 'SPEC', previousModule: 'MODULE' });
    expect(selfReview).toContain('Self-review');
  });
});
