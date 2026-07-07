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
import { meridianGraph } from './catalog/meridian';
import { constellationGraph } from './catalog/constellation';
import { abacusGraph } from './catalog/abacus';
import { cascadeGraph } from './catalog/cascade';
import { tessellaGraph } from './catalog/tessella';
import { chronicleGraph } from './catalog/chronicle';
import { beaconGraph } from './catalog/beacon';

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

const WTPL_ENTRIES: HubTemplateEntry[] = [
  {
    slug: 'meridian',
    name: 'Meridian',
    archetype: 'landing',
    primaryFamily: 'layered-photo-parallax-hero',
    supportingFamilies: ['oversized-type-editorial'],
    tagline: 'A photographic diorama landing page in a single teal hue.',
    blurb:
      'Generated photo plates — cutout product, detached shadow, floating garnish — parallax at their own depths behind an occluded headline. The industry photoreal method, as your landing page.',
    tags: ['Hero', 'Photoreal', 'Parallax', 'Product'],
    moods: ['cinematic', 'luxury', 'organic'],
    accent: '#2fb7c9',
    route: {
      hero: 'R2',
      rationale:
        'Photoreal + parallax-only interaction: composite plates beat realtime geometry on realism-per-byte.',
    },
    graph: meridianGraph,
  },
  {
    slug: 'constellation',
    name: 'Constellation',
    archetype: 'about',
    primaryFamily: 'particle-field-hero',
    supportingFamilies: ['oversized-type-editorial'],
    tagline: 'An about page as a living constellation of values.',
    blurb:
      'A pointer-aware constellation net with firefly drift; your values pinned at the vertices, glowing as visitors approach; stats that roll up as they scroll. Fully asset-free.',
    tags: ['About', 'Particles', 'Team', 'Values'],
    moods: ['nocturnal', 'calm', 'technical'],
    accent: '#8fb8ff',
    route: {
      hero: 'R1',
      rationale: 'Procedural particle field must answer the cursor live — realtime only.',
    },
    graph: constellationGraph,
  },
  {
    slug: 'abacus',
    name: 'Abacus',
    archetype: 'pricing',
    primaryFamily: 'bento-grid-slider',
    supportingFamilies: [],
    tagline: 'A bento pricing board where the material is the tier.',
    blurb:
      'Slate, brass, and deep glass slabs carry the tier story; mono numerals roll up on entry; tiles lift to the pointer. Asset-free PBR — instant to load, easy to make yours.',
    tags: ['Pricing', 'Bento', 'Tiers', 'PBR'],
    moods: ['precise', 'warm', 'grounded'],
    accent: '#b08d3f',
    route: {
      hero: 'R1',
      rationale: 'Material slabs + hover response, no imagery source — asset-free realtime PBR.',
    },
    graph: abacusGraph,
  },
  {
    slug: 'cascade',
    name: 'Cascade',
    archetype: 'marketing',
    primaryFamily: 'parallax-zoom-deep-dive',
    supportingFamilies: ['oversized-type-editorial'],
    tagline: 'A marketing page you fall forward through, chapter by chapter.',
    blurb:
      'Foreground archways rush past a held valley backdrop as you scroll — every screen a place, not a paragraph. The dolly-through grammar, as a product narrative.',
    tags: ['Marketing', 'Parallax', 'Scroll', 'Cinematic'],
    moods: ['cinematic', 'immersive', 'bold'],
    accent: '#d98a3d',
    route: {
      hero: 'R2',
      rationale:
        'Photoreal depth planes with scroll-driven dolly — composite plates beat realtime geometry on realism-per-byte.',
    },
    graph: cascadeGraph,
  },
  {
    slug: 'tessella',
    name: 'Tessella',
    archetype: 'marketing',
    primaryFamily: 'bento-grid-slider',
    supportingFamilies: [],
    tagline: 'A marketing grid where every tile earns its span.',
    blurb:
      'Mixed-span tiles — some carrying a generated feature shot, some asset-free PBR slabs whose material is the accent — rise staggered and lift to the pointer. Instant to make yours.',
    tags: ['Marketing', 'Bento', 'Features', 'PBR'],
    moods: ['precise', 'modern', 'confident'],
    accent: '#38e0b0',
    route: {
      hero: 'R2',
      rationale:
        'Imagery tiles are photoreal (R2); material accent slabs are asset-free PBR (R1) — a mixed board.',
    },
    graph: tessellaGraph,
  },
  {
    slug: 'chronicle',
    name: 'Chronicle',
    archetype: 'about',
    primaryFamily: 'oversized-type-editorial',
    supportingFamilies: ['layered-photo-parallax-hero'],
    tagline: 'An about page where the founding year is the artwork.',
    blurb:
      'A colossal year holds the top as a compositional plate; era photographs step down the page behind museum labels; the studio story arrives in the giant-word / tiny-label rhythm.',
    tags: ['About', 'Editorial', 'Timeline', 'Type'],
    moods: ['editorial', 'archival', 'warm'],
    accent: '#c9a25f',
    route: {
      hero: 'R2',
      rationale:
        'Monumental extruded type over flat era plates — text is native MSDF, plates are composite (R2).',
    },
    graph: chronicleGraph,
  },
  {
    slug: 'beacon',
    name: 'Beacon',
    archetype: 'contact',
    primaryFamily: 'hover-morph-distortion',
    supportingFamilies: [],
    tagline: 'A contact page whose sky liquefies where you touch it.',
    blurb:
      'A maritime sky plate liquefies under the cursor with viscous follow while the lighthouse cutout and every way-to-reach-us stay razor-sharp. Tactile GPU craft with a calm idle.',
    tags: ['Contact', 'Hover', 'Distortion', 'Tactile'],
    moods: ['tactile', 'atmospheric', 'maritime'],
    accent: '#ffd66b',
    route: {
      hero: 'R2',
      rationale:
        'A photographic plate warped live under the pointer — R2 composite driven by the mountable displacement primitive.',
    },
    graph: beaconGraph,
  },
];

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
