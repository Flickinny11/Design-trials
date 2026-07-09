// UXV-B2 regression — the stub planner must not shred compound intake option
// labels ("Home / landing", "Catalog / library"), must not duplicate the
// seeded Home hub, and must carry the user's own typed sections into hubs.
// Persona evidence: notes/verification/wuxv/p1-novice/ (Mia asked for a
// "cake ordering page" and "About Us"; the plan built
// "Home · Home · Landing · Catalog · Library" and dropped both).
import { describe, it, expect } from 'vitest';

import { buildDeterministicBlueprint } from '@/server/conductor/blueprint';
import { resolveDirection } from '@/server/conductor/directions';
import type { BuildBrief } from '@/../packages/shared-interfaces/src/prism-intake';

function fixtureBrief(sections: string): BuildBrief {
  return {
    v: 1,
    title: 'Warm, inviting website for my bakery',
    prompt: 'a warm, inviting website for my bakery with an online cake ordering form',
    brandProfile: {
      v: 1,
      name: 'Mia’s Bakery',
      palette: { primary: '#16161d', secondary: '#e8ecf2', accent: '#ff2a38' },
      toneDescriptors: ['warm', 'inviting'],
    },
    chosenDirectionId: 'walnut-studio',
    lines: [
      { id: 'l-summary', key: 'summary', label: 'Summary', value: 'Bakery storefront with cake ordering.' },
      { id: 'l-archetype', key: 'archetype', label: 'Archetype', value: 'storefront' },
      { id: 'l-sections', key: 'sections', label: 'Sections', value: sections },
    ],
    integrations: [],
    deployTarget: 'prism-cloud',
    seedsUsed: [{ kind: 'prompt', detail: 'WUXV-B2 regression brief' }],
    answers: [],
    branchCount: 0,
    fastPath: false,
  };
}

describe('UXV-B2 — stub planner section derivation', () => {
  it('keeps compound labels whole, never duplicates Home, and carries custom sections', () => {
    // Exactly the P1 persona sections line: two compound intake labels plus
    // two user-typed custom sections.
    const brief = fixtureBrief('Home / landing, Catalog / library, cake ordering page, About Us');
    const direction = resolveDirection(brief);
    const blueprint = buildDeterministicBlueprint(brief, direction);

    const titles = blueprint.hubs.map((h) => h.title);

    // One and only one Home (the seeded home hub); no orphaned "Landing"
    // or "Library" fragments from the `/`-split.
    expect(titles.filter((t) => t.toLowerCase() === 'home')).toHaveLength(1);
    expect(titles.map((t) => t.toLowerCase())).not.toContain('landing');
    expect(titles.map((t) => t.toLowerCase())).not.toContain('library');

    // The compound label survives as its head word, and BOTH user-typed
    // custom sections materialize as hubs.
    expect(titles.map((t) => t.toLowerCase())).toContain('catalog');
    expect(titles.map((t) => t.toLowerCase())).toContain('cake ordering page');
    expect(titles.map((t) => t.toLowerCase())).toContain('about us');

    // Hub ids are unique.
    const ids = blueprint.hubs.map((h) => h.hubId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('dedupes repeated section names case-insensitively', () => {
    const brief = fixtureBrief('Pricing, pricing, PRICING, Features');
    const direction = resolveDirection(brief);
    const blueprint = buildDeterministicBlueprint(brief, direction);
    const titles = blueprint.hubs.map((h) => h.title.toLowerCase());
    expect(titles.filter((t) => t === 'pricing')).toHaveLength(1);
    expect(titles).toContain('features');
  });

  it('defaults still apply when the sections line is empty', () => {
    const brief = fixtureBrief('');
    const direction = resolveDirection(brief);
    const blueprint = buildDeterministicBlueprint(brief, direction);
    // storefront archetype defaults
    const titles = blueprint.hubs.map((h) => h.title.toLowerCase());
    expect(titles).toContain('catalog');
    expect(blueprint.hubs.length).toBeGreaterThanOrEqual(3);
  });
});
