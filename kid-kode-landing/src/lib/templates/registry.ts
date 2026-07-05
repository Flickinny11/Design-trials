// W8 E2 — the unified template registry. ONE entry per template lights up the
// landing gallery (W6), the dashboard gallery (W4), the /templates/[slug]
// preview, AND the Remix-into-your-account fork. Replaces the two disconnected
// hard-coded arrays (marketing content.ts TEMPLATES + dashboard STARTERS) with
// a single source of truth carrying the real .prism GraphSource.

import type { GraphSource } from '@/lib/prism-graph/types';
import { scrollHeroGraph } from './graphs/scroll-hero';
import { cursorGalleryGraph } from './graphs/cursor-gallery';
import { particleShowpieceGraph } from './graphs/particle-showpiece';

export interface TemplateEntry {
  /** URL-safe id used across galleries, the preview route, and the fork. */
  slug: string;
  /** Display name. */
  name: string;
  /** One-line marketing tagline (landing gallery). */
  tagline: string;
  /** Longer blurb (dashboard card). */
  blurb: string;
  /** Chips shown on the card. */
  tags: readonly string[];
  /** Accent hex — read by the 3D thumbnail jewel. */
  accent: string;
  /** Seed prompt used if a visitor starts a fresh build from this template. */
  seed: string;
  /** Which W8 capabilities this template showcases (report + card badges). */
  capabilities: readonly string[];
  /** The real .prism graph this template forks into the user's account. */
  graph: GraphSource;
}

export const TEMPLATE_CATALOG: readonly TemplateEntry[] = [
  {
    slug: 'kinetic-scroll-hero',
    name: 'Aperture',
    tagline: 'A scroll-driven one-page hero that sets a product in motion.',
    blurb:
      'Scroll-scrub product hero with kinetic type, cursor parallax, and a dissolve transition — a running app, not a slide.',
    tags: ['Hero', 'Scroll', '3D Product'],
    accent: '#d8a24a',
    seed: 'A scroll-driven one-page hero for a premium product, with a photoreal 3D hero object that rotates and scales as you scroll, kinetic headline, and cursor parallax.',
    capabilities: ['E8 scroll scrub', 'E8 in-view reveal', 'E9 cursor field', 'E10 dissolve'],
    graph: scrollHeroGraph,
  },
  {
    slug: 'cursor-gallery',
    name: 'Atlas',
    tagline: 'A cursor-reactive editorial gallery that answers the pointer.',
    blurb:
      'Editorial macro-material grid where every tile tilts and parallaxes to the cursor, with a magnetic beam cursor and a veil transition.',
    tags: ['Gallery', 'Cursor', 'Editorial'],
    accent: '#e7c98a',
    seed: 'A cursor-reactive editorial gallery: a grid of image tiles that tilt and parallax toward the pointer, with a custom magnetic cursor.',
    capabilities: ['E9 pointer field', 'E9 custom cursor', 'E8 in-view stagger', 'E10 veil'],
    graph: cursorGalleryGraph,
  },
  {
    slug: 'particle-showpiece',
    name: 'Nova',
    tagline: 'A WebGL particle showpiece you bend with your cursor.',
    blurb:
      'Layered galaxy + nebula + firefly fields with a cursor attract/repel force, a halo cursor, and a glass-sweep transition. Fully asset-free.',
    tags: ['Particles', 'WebGL', 'Interactive'],
    accent: '#7fb2ff',
    seed: 'A WebGL particle showpiece: layered galaxy and nebula particle fields that react to the cursor as an attract/repel force, with a kinetic headline.',
    capabilities: ['E9 cursor force field', 'E10 glass sweep', 'Particle layers'],
    graph: particleShowpieceGraph,
  },
];

const BY_SLUG = new Map(TEMPLATE_CATALOG.map((t) => [t.slug, t]));

export function getTemplate(slug: string): TemplateEntry | undefined {
  return BY_SLUG.get(slug);
}

/** The graph for a template slug, or null. Used by the fork server path. */
export function templateGraph(slug: string): GraphSource | null {
  return BY_SLUG.get(slug)?.graph ?? null;
}

/** Lightweight card view (no graph payload) for gallery listings. */
export interface TemplateCard {
  slug: string;
  name: string;
  tagline: string;
  blurb: string;
  tags: readonly string[];
  accent: string;
  seed: string;
  capabilities: readonly string[];
}

export function listTemplateCards(): TemplateCard[] {
  return TEMPLATE_CATALOG.map(({ graph: _graph, ...card }) => card);
}
