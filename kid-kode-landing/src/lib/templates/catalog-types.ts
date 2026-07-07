// W-TPL D1 — the template-catalog type layer. ADDITIVE beside the W8 registry
// (registry.ts is untouched; the catalog folds its three entries in with
// metadata — DEV-1 in notes/spec-deviations-wtpl.md).
//
// Grammar family ids are kept as INLINE string literals (the W-DG1 pattern:
// src never imports the design-grammar corpus types — the corpus lives outside
// src and its schema evolves independently). The catalog validation test reads
// design-grammar/families/*.json from disk and asserts every non-legacy
// primaryFamily names a real corpus family, so the coupling is enforced at
// test time without a compile-time import.

import type { GraphSource, PrismNode } from '@/lib/prism-graph/types';

/** The eight catalog archetypes of record (prompt §1). */
export type TemplateArchetype =
  | 'landing'
  | 'marketing'
  | 'about'
  | 'contact'
  | 'gallery'
  | 'pricing'
  | 'product-showcase'
  | 'editorial';

export const TEMPLATE_ARCHETYPES: readonly TemplateArchetype[] = [
  'landing',
  'marketing',
  'about',
  'contact',
  'gallery',
  'pricing',
  'product-showcase',
  'editorial',
];

/** Display labels for the picker's category rail. */
export const ARCHETYPE_LABELS: Record<TemplateArchetype, string> = {
  landing: 'Landing',
  marketing: 'Marketing',
  about: 'About',
  contact: 'Contact',
  gallery: 'Gallery',
  pricing: 'Pricing',
  'product-showcase': 'Product',
  editorial: 'Editorial',
};

/** A design-grammar family id (design-grammar/families/<id>.json), or a
 *  `legacy:`-prefixed tag for pre-corpus W8 templates (DEV-1). */
export type CatalogFamilyId = string;

/** One complete hub template: a real .prism GraphSource whose hub(s) + nodes
 *  are instantiated into the live graph by the picker. */
export interface HubTemplateEntry {
  /** URL-safe id — also the /templates/[slug] preview key. */
  slug: string;
  /** Display name. */
  name: string;
  /** Which archetype shelf the picker files this under. */
  archetype: TemplateArchetype;
  /** PRIMARY grammar family (anti-repetition law keys on this per archetype). */
  primaryFamily: CatalogFamilyId;
  /** Supporting families the composition draws on (pairing metadata). */
  supportingFamilies: readonly CatalogFamilyId[];
  /** One-line tagline (picker card). */
  tagline: string;
  /** Longer blurb (picker detail). */
  blurb: string;
  /** Search chips. */
  tags: readonly string[];
  /** Mood vocabulary (searchable; mirrors the corpus `usage.moods` values). */
  moods: readonly string[];
  /** Accent hex for the picker card jewel. */
  accent: string;
  /** Render-route decision of record for the template's hero element —
   *  the planner's pick + one-line rationale (W-PHOTO route planner). */
  route: { hero: 'R1' | 'R2' | 'R3' | 'R4'; rationale: string };
  /** The real .prism graph. Hub ids/node ids inside are template-local; the
   *  picker remaps them on instantiation. */
  graph: GraphSource;
}

/** Section kinds the picker's Sections shelf groups by. */
export type SectionKind =
  | 'hero'
  | 'carousel'
  | 'bento'
  | 'testimonial'
  | 'pricing'
  | 'cta'
  | 'gallery-strip'
  | 'stat-band'
  | 'quote'
  | 'marquee';

/** Anchor a section build receives: the target hub + the world-space origin
 *  the section should compose around, plus a uniqueness seq for node ids. */
export interface SectionAnchor {
  hubId: string;
  x: number;
  y: number;
  z?: number;
  /** Uniqueness suffix source — the picker passes a fresh value per drop. */
  seq: string;
}

/** One droppable section template: builds fresh-id PrismNodes positioned
 *  relative to the anchor, for insertion into an EXISTING hub. */
export interface SectionTemplateEntry {
  slug: string;
  name: string;
  kind: SectionKind;
  /** Primary grammar family the section derives from. */
  primaryFamily: CatalogFamilyId;
  tagline: string;
  tags: readonly string[];
  accent: string;
  /** Vertical extent (world units) — the picker uses it to place the drop and
   *  extend hub contentHeight when stacking below existing content. */
  height: number;
  /** Build the section's nodes anchored at the given origin. Every node id
   *  MUST incorporate `anchor.seq` so repeated drops never collide. */
  build: (anchor: SectionAnchor) => PrismNode[];
}
