// W-TPL D1 — catalog law enforcement.
//
// 1. ANTI-REPETITION LAW (PLAN §3/§4): within each archetype, no two templates
//    share a primary grammar family.
// 2. GROUNDING: every non-`legacy:` primaryFamily names a real corpus family
//    (design-grammar/families/<id>.json on disk) — the inline-string pattern's
//    enforcement half.
// 3. STRUCTURE: every hub template is a real graph (hubs + parented nodes,
//    unique ids, non-empty route rationale).
// 4. INSTANTIATION: id remap is collision-free across repeat instantiations,
//    and the name-your-hub override lands on the primary hub.
// 5. SECTIONS: every section template builds seq-suffixed, anchor-parented
//    nodes; repeat drops never collide.

import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  HUB_TEMPLATE_CATALOG,
  SECTION_TEMPLATE_CATALOG,
  searchHubTemplates,
} from '@/lib/templates/catalog-registry';
import { TEMPLATE_ARCHETYPES } from '@/lib/templates/catalog-types';
import { instantiateHubTemplate } from '@/lib/templates/instantiate';

const FAMILIES_DIR = join(process.cwd(), 'design-grammar', 'families');

describe('W-TPL catalog — anti-repetition law', () => {
  it('no two templates in an archetype share a primary family', () => {
    for (const archetype of TEMPLATE_ARCHETYPES) {
      const entries = HUB_TEMPLATE_CATALOG.filter(
        (t) => t.archetype === archetype,
      );
      const families = entries.map((t) => t.primaryFamily);
      expect(new Set(families).size, `archetype '${archetype}' families: ${families.join(', ')}`).toBe(
        families.length,
      );
    }
  });

  it('every non-legacy primary family is a real corpus family on disk', () => {
    for (const t of HUB_TEMPLATE_CATALOG) {
      if (t.primaryFamily.startsWith('legacy:')) continue;
      const file = join(FAMILIES_DIR, `${t.primaryFamily}.json`);
      expect(existsSync(file), `${t.slug} → ${file}`).toBe(true);
    }
    for (const s of SECTION_TEMPLATE_CATALOG) {
      if (s.primaryFamily.startsWith('legacy:')) continue;
      const file = join(FAMILIES_DIR, `${s.primaryFamily}.json`);
      expect(existsSync(file), `${s.slug} → ${file}`).toBe(true);
    }
  });
});

describe('W-TPL catalog — structural validity', () => {
  it('every hub template is a real, well-formed graph', () => {
    expect(HUB_TEMPLATE_CATALOG.length).toBeGreaterThan(0);
    for (const t of HUB_TEMPLATE_CATALOG) {
      expect(t.graph.hubs.length, t.slug).toBeGreaterThanOrEqual(1);
      expect(t.graph.nodes.length, t.slug).toBeGreaterThanOrEqual(3);
      expect(t.route.rationale.trim().length, t.slug).toBeGreaterThan(0);
      const hubIds = new Set(t.graph.hubs.map((h) => h.hubId));
      const nodeIds = t.graph.nodes.map((n) => n.nodeId);
      expect(new Set(nodeIds).size, `${t.slug} node ids unique`).toBe(
        nodeIds.length,
      );
      for (const n of t.graph.nodes) {
        expect(hubIds.has(n.parentHubId), `${t.slug}/${n.nodeId} parented`).toBe(
          true,
        );
      }
    }
  });

  it('slugs are unique across the whole catalog', () => {
    const slugs = HUB_TEMPLATE_CATALOG.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('W-TPL catalog — instantiation', () => {
  it('remaps ids collision-free across repeat instantiations', () => {
    const t = HUB_TEMPLATE_CATALOG[0];
    const a = instantiateHubTemplate(t, { suffix: 'aaaa1111' });
    const b = instantiateHubTemplate(t, { suffix: 'bbbb2222' });
    const aIds = new Set([
      ...a.hubs.map((h) => h.hubId),
      ...a.nodes.map((n) => n.nodeId),
    ]);
    for (const h of b.hubs) expect(aIds.has(h.hubId)).toBe(false);
    for (const n of b.nodes) expect(aIds.has(n.nodeId)).toBe(false);
    // every remapped node parents to a remapped hub
    const aHubs = new Set(a.hubs.map((h) => h.hubId));
    for (const n of a.nodes) expect(aHubs.has(n.parentHubId)).toBe(true);
    // no id collides with the template's own local ids
    const localIds = new Set(t.graph.nodes.map((n) => n.nodeId));
    for (const n of a.nodes) expect(localIds.has(n.nodeId)).toBe(false);
  });

  it('applies the name-your-hub override to the primary hub only', () => {
    const t = HUB_TEMPLATE_CATALOG[0];
    const inst = instantiateHubTemplate(t, {
      name: 'My Boutique',
      suffix: 'cccc3333',
    });
    expect(inst.hubs[0].title).toBe('My Boutique');
    expect(inst.primaryHubId).toBe(inst.hubs[0].hubId);
    // the catalog module's own graph is untouched (deep clone)
    expect(t.graph.hubs[0].title).not.toBe('My Boutique');
  });
});

describe('W-TPL catalog — sections', () => {
  it('every section builds seq-suffixed nodes parented to the anchor hub', () => {
    for (const s of SECTION_TEMPLATE_CATALOG) {
      const anchor = { hubId: 'target-hub', x: 0, y: -4, seq: 'zzzz9999' };
      const nodes = s.build(anchor);
      expect(nodes.length, s.slug).toBeGreaterThanOrEqual(1);
      for (const n of nodes) {
        expect(n.parentHubId, `${s.slug}/${n.nodeId}`).toBe('target-hub');
        expect(n.nodeId.includes('zzzz9999'), `${s.slug}/${n.nodeId} seq`).toBe(
          true,
        );
      }
      const again = s.build({ ...anchor, seq: 'yyyy8888' });
      const first = new Set(nodes.map((n) => n.nodeId));
      for (const n of again) expect(first.has(n.nodeId), s.slug).toBe(false);
      expect(s.height, s.slug).toBeGreaterThan(0);
    }
  });
});

describe('W-TPL catalog — search', () => {
  it('finds templates by tag/mood/family and filters by archetype', () => {
    const byTag = searchHubTemplates('particles');
    expect(byTag.some((t) => t.slug === 'particle-showpiece')).toBe(true);
    const galleryOnly = searchHubTemplates('', 'gallery');
    expect(galleryOnly.every((t) => t.archetype === 'gallery')).toBe(true);
    expect(searchHubTemplates('') .length).toBe(HUB_TEMPLATE_CATALOG.length);
  });
});
