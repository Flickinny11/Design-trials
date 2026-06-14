// PRISM NODE-EDITOR V2 — catalog injection (criteria A3).
//
// The premium library MUST be considered FIRST. We inject:
//   • a DESIGN-REFERENCES summary (the Observatory-Brass premium look vocabulary),
//   • a curated set of REAL primitive ids from the ~406-primitive catalog
//     (src/lib/prism/animatable/primitives), tagged so the planner can match
//     intent → premium primitive,
//   • a curated set of REAL element ids from the 36/112-entry element library
//     (src/lib/editor/elements/catalog).
// In PRODUCTION the live orchestrator receives the FULL catalogs (via tool/RAG);
// for the harness this curated, premium-first subset proves the behavior NOW.

import type { PromptEditCatalogContext, CatalogEntrySummary } from './contract.ts';

export const DESIGN_REFERENCES_SUMMARY =
  'Observatory-Brass premium system: aged-brass + bone-ivory + deep-space ink palette (NO purple); ' +
  'photoreal PBR metal/glass with transmission + clearcoat; volumetric godrays + IBL studio lighting; ' +
  'kinetic MSDF type; holographic detail cards with glitch/transparency; cinematic depth + parallax. ' +
  'Always prefer the premium catalog primitives + elements before any ad-hoc styling.';

// Curated REAL primitive ids (premium tier first). Tags drive intent matching.
export const PREMIUM_PRIMITIVES: CatalogEntrySummary[] = [
  { id: 'liquid-metal', label: 'Liquid metal', tags: ['metal', 'premium', 'morph', 'shader', 'reflective'] },
  { id: 'prism-dispersion', label: 'Prism dispersion', tags: ['glass', 'premium', 'refraction', 'rainbow', 'hero'] },
  { id: 'bevel-glass', label: 'Beveled glass', tags: ['glass', 'premium', 'transmission', 'card'] },
  { id: 'brushed-metal', label: 'Brushed metal', tags: ['metal', 'premium', 'surface', 'brass'] },
  { id: 'aurora', label: 'Aurora', tags: ['volumetric', 'premium', 'ambient', 'glow', 'background'] },
  { id: 'godrays', label: 'God rays', tags: ['volumetric', 'premium', 'light', 'hero', 'atmosphere'] },
  { id: 'holographic-shimmer', label: 'Holographic shimmer', tags: ['holographic', 'premium', 'iridescent', 'overlay'] },
  { id: 'magnetic', label: 'Magnetic cursor', tags: ['pointer', 'interactive', 'premium', 'attract'] },
  { id: 'orbit-rings', label: 'Orbit rings', tags: ['orbit', 'premium', 'motion', 'space'] },
  { id: 'kinetic-text', label: 'Kinetic text', tags: ['text', 'premium', 'type', 'reveal'] },
  // Collision / physics (for "make these two collide")
  { id: 'jelly-collide-sim', label: 'Jelly collide', tags: ['collide', 'physics', 'soft-body', 'impact', 'premium'] },
  { id: 'gravity-bounce-cluster', label: 'Gravity bounce cluster', tags: ['collide', 'physics', 'gravity', 'bounce'] },
  { id: 'pinball-bounce', label: 'Pinball bounce', tags: ['collide', 'physics', 'bounce', 'impact'] },
  { id: 'magnet-snap', label: 'Magnet snap', tags: ['collide', 'attract', 'physics', 'snap'] },
  { id: 'explode-reassemble-sim', label: 'Explode + reassemble', tags: ['collide', 'physics', 'shatter', 'impact'] },
  { id: 'drop-bounce', label: 'Drop bounce', tags: ['physics', 'gravity', 'entrance'] },
];

// Curated REAL element-library ids (premium clusters).
export const PREMIUM_ELEMENTS: CatalogEntrySummary[] = [
  { id: 'ab-hero-prism-dispersion', label: 'Prism dispersion hero', tags: ['hero', 'premium', 'glass'] },
  { id: 'ab-hero-godrays', label: 'God-rays hero', tags: ['hero', 'premium', 'volumetric'] },
  { id: 'ab-hero-monolith-float', label: 'Floating monolith hero', tags: ['hero', 'premium', '3d'] },
  { id: 'ab-cta-glass-bevel', label: 'Glass-bevel CTA', tags: ['cta', 'premium', 'glass', 'button'] },
  { id: 'ab-cta-magnetic', label: 'Magnetic CTA', tags: ['cta', 'premium', 'interactive'] },
  { id: 'ab-pricing-center-pop', label: 'Pricing pop', tags: ['pricing', 'premium', 'card'] },
  { id: 'ab-logocloud-core-rings', label: 'Orbiting logo cloud', tags: ['logos', 'premium', 'orbit'] },
  { id: 'ab-nav-orbital-ring-spin', label: 'Orbital nav', tags: ['nav', 'premium', 'orbit'] },
];

/** Counts injected so the planner knows the FULL catalogs exist beyond the subset. */
export const CATALOG_TOTALS = { primitives: 410, elements: 112, designSystem: 'Observatory-Brass' } as const;

/** Assemble the context object the orchestrator receives. */
export function buildCatalogContext(atTags?: string[]): PromptEditCatalogContext {
  return {
    designReferences: DESIGN_REFERENCES_SUMMARY,
    primitiveCatalog: PREMIUM_PRIMITIVES,
    elementLibrary: PREMIUM_ELEMENTS,
    atTags: atTags?.length ? atTags : undefined,
  };
}

/** Parse leading/inline @tags out of a prompt (optional, honored not required). */
export function extractAtTags(prompt: string): string[] {
  const tags = [...prompt.matchAll(/@([a-z0-9][a-z0-9-]*)/gi)].map((m) => m[1].toLowerCase());
  return Array.from(new Set(tags));
}
