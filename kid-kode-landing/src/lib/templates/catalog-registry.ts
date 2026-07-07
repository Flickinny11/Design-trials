// W-TPL D1 — the catalog registry: every hub template + section template the
// picker can instantiate, with archetype/family metadata for categorization,
// search, and the anti-repetition law (report §3 matrix; enforced by
// tests/unit/wtpl-catalog.test.ts).
//
// ADDITIVE beside the W8 registry: the three W8 templates are folded in with
// retro metadata (DEV-1, notes/spec-deviations-wtpl.md) — their graphs are the
// same objects the dashboard/marketing galleries already ship.

import { TEMPLATE_CATALOG } from './registry';
import type {
  HubTemplateEntry,
  SectionTemplateEntry,
  TemplateArchetype,
} from './catalog-types';

// ---------------------------------------------------------------------------
// W8 fold-ins (DEV-1). `legacy:` family tags mark pre-corpus compositions.
// ---------------------------------------------------------------------------

const W8_META: Record<
  string,
  Pick<
    HubTemplateEntry,
    'archetype' | 'primaryFamily' | 'supportingFamilies' | 'moods' | 'route'
  >
> = {
  'kinetic-scroll-hero': {
    archetype: 'product-showcase',
    primaryFamily: 'legacy:scroll-product-hero',
    supportingFamilies: ['oversized-type-editorial'],
    moods: ['cinematic', 'luxury'],
    route: {
      hero: 'R1',
      rationale:
        'GLB product must rotate/scale live with scroll — only realtime PBR manipulates.',
    },
  },
  'cursor-gallery': {
    archetype: 'gallery',
    primaryFamily: 'editorial-product-gallery',
    supportingFamilies: ['hover-morph-distortion'],
    moods: ['editorial', 'tactile'],
    route: {
      hero: 'R1',
      rationale:
        'Tiles tilt/parallax to cursor velocity — responsive motion needs live transforms.',
    },
  },
  'particle-showpiece': {
    archetype: 'landing',
    primaryFamily: 'particle-field-hero',
    supportingFamilies: [],
    moods: ['nocturnal', 'technical'],
    route: {
      hero: 'R1',
      rationale: 'Procedural GPU particles — no imagery source; realtime is the only route.',
    },
  },
};

const W8_ENTRIES: HubTemplateEntry[] = TEMPLATE_CATALOG.map((t) => ({
  slug: t.slug,
  name: t.name,
  tagline: t.tagline,
  blurb: t.blurb,
  tags: t.tags,
  accent: t.accent,
  graph: t.graph,
  ...W8_META[t.slug],
}));

// ---------------------------------------------------------------------------
// W-TPL hub templates (report §3 matrix) — appended per authoring batch.
// ---------------------------------------------------------------------------

const WTPL_ENTRIES: HubTemplateEntry[] = [];

export const HUB_TEMPLATE_CATALOG: readonly HubTemplateEntry[] = [
  ...W8_ENTRIES,
  ...WTPL_ENTRIES,
];

// ---------------------------------------------------------------------------
// W-TPL section templates — appended per authoring batch.
// ---------------------------------------------------------------------------

export const SECTION_TEMPLATE_CATALOG: readonly SectionTemplateEntry[] = [];

// ---------------------------------------------------------------------------
// Lookup + search
// ---------------------------------------------------------------------------

const HUB_BY_SLUG = new Map(HUB_TEMPLATE_CATALOG.map((t) => [t.slug, t]));
const SECTION_BY_SLUG = new Map(
  SECTION_TEMPLATE_CATALOG.map((t) => [t.slug, t]),
);

export function getHubTemplate(slug: string): HubTemplateEntry | undefined {
  return HUB_BY_SLUG.get(slug);
}

export function getSectionTemplate(
  slug: string,
): SectionTemplateEntry | undefined {
  return SECTION_BY_SLUG.get(slug);
}

export function hubTemplatesByArchetype(
  archetype: TemplateArchetype,
): HubTemplateEntry[] {
  return HUB_TEMPLATE_CATALOG.filter((t) => t.archetype === archetype);
}

function matchScore(haystacks: string[], q: string): number {
  let score = 0;
  for (const h of haystacks) {
    const lower = h.toLowerCase();
    if (lower === q) score += 4;
    else if (lower.startsWith(q)) score += 2;
    else if (lower.includes(q)) score += 1;
  }
  return score;
}

/** Case-insensitive substring search over name/tagline/tags/moods/family/
 *  archetype. Empty query returns everything (optionally archetype-filtered),
 *  preserving catalog order. */
export function searchHubTemplates(
  query: string,
  archetype?: TemplateArchetype,
): HubTemplateEntry[] {
  const pool = archetype ? hubTemplatesByArchetype(archetype) : [...HUB_TEMPLATE_CATALOG];
  const q = query.trim().toLowerCase();
  if (!q) return pool;
  return pool
    .map((t) => ({
      t,
      score: matchScore(
        [
          t.name,
          t.slug,
          t.tagline,
          t.archetype,
          t.primaryFamily,
          ...t.tags,
          ...t.moods,
        ],
        q,
      ),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.t);
}

export function searchSectionTemplates(query: string): SectionTemplateEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...SECTION_TEMPLATE_CATALOG];
  return SECTION_TEMPLATE_CATALOG.map((t) => ({
    t,
    score: matchScore([t.name, t.slug, t.tagline, t.kind, ...t.tags], q),
  }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.t);
}
