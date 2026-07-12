// W-VIS D6 — exemplar retrieval: 2 NEAREST worked exemplars by node
// class/style, replacing the "generic six" (DESIGN-PLAYBOOK.md §5.1-5.6 as an
// undifferentiated block). Each entry is an annotated digest of a COMMITTED
// code+frame pair — the annotation is the payload (what makes it work), the
// refs let a reviewer verify the pair exists.
//
// Selection is deterministic: tag-overlap score against the node's derived
// style tags, sha-stable tiebreak by id. Always returns at most 2 (the
// playbook's own guidance: two sharply relevant beats six generic).

import type { PrismNode } from '@/lib/prism-graph/types';

export type ExemplarTag =
  | '3d' | '2d' | 'product' | 'hero' | 'type' | 'editorial' | 'photo'
  | 'pricing' | 'gallery' | 'metrics' | 'nav' | 'panel' | 'cta' | 'material'
  | 'lighting' | 'composite';

export interface WorkedExemplar {
  id: string;
  title: string;
  tags: ExemplarTag[];
  /** Committed code path (verifiable). */
  codeRef: string;
  /** Committed frame path (verifiable). */
  frameRef: string;
  /** The annotated lesson — the part the generator actually consumes. */
  lesson: string;
}

// Digests of the committed playbook §5 pairs + W-BG/W-TPL catalog pairs.
export const WORKED_EXEMPLARS: readonly WorkedExemplar[] = [
  {
    id: 'ex-w9a-watch-hero',
    title: 'W9A watch atelier hero (flagship 3D product node)',
    tags: ['3d', 'product', 'hero', 'material', 'lighting'],
    codeRef: 'src/lib/prism/atelier/watch-node-factory.ts',
    frameRef: 'notes/verification/shell-w9a/w9a-desktop-01-hero.png',
    lesson: 'Node-local 3-point rig (bounded PointLights INSIDE the factory — scene gives only ambient+key); generated PBR so every surface has micro-detail; champagne/brass support palette over a dark stage (DL16 rich-never-void); ONE hero object at ~60% frame height, face-on; UI chrome kept flat-and-quiet so the lit object owns the frame; deep nebula backdrop = stage gradient, never flat black.',
  },
  {
    id: 'ex-wtpl-meridian',
    title: 'W-TPL Meridian (photo-composite hero, R2 route)',
    tags: ['2d', 'photo', 'hero', 'composite', 'editorial'],
    codeRef: 'src/lib/templates/catalog/meridian.ts',
    frameRef: 'notes/verification/shell-wtpl/hero-01-meridian.png',
    lesson: 'Light-field photography carries the lighting — the node adds only composition; oversized display word BEHIND the subject (type sandwich = depth); subject sharp centered-right, supporting copy low-left (bimodal type); mono CTA with tracked caps; light temperature consistent because all planes come from one composite.',
  },
  {
    id: 'ex-wtpl-cascade',
    title: 'W-TPL Cascade (architectural photo stage + editorial type)',
    tags: ['2d', 'photo', 'editorial', 'type', 'lighting'],
    codeRef: 'src/lib/templates/catalog/cascade.ts',
    frameRef: 'notes/verification/shell-wtpl/hero-10-cascade.png',
    lesson: 'Single hot light source (the lit doorway) gives the frame a focal engine; headline in warm off-white self-lights the upper third; mono subline tiny beneath (bimodal); everything else graded dark. ONE brightest element, decided in advance.',
  },
  {
    id: 'ex-wtpl-ledgerline',
    title: 'W-TPL Ledgerline (pricing tiers as material objects)',
    tags: ['2d', 'pricing', 'panel', 'material', 'cta'],
    codeRef: 'src/lib/templates/catalog/ledgerline.ts',
    frameRef: 'notes/verification/shell-wtpl/hero-04-ledgerline.png',
    lesson: 'Pricing tiers read as machined plates, not flat cards — each tier a lit slab with edge highlights; the recommended tier carries the single red accent and sits proud of the row (depth = hierarchy); numbers oversized mono, features whisper-small; CTA reads as a physical object (DL12).',
  },
  {
    id: 'ex-wtpl-folio',
    title: 'W-TPL Folio (editorial gallery family)',
    tags: ['2d', 'gallery', 'editorial', 'type'],
    codeRef: 'src/lib/templates/catalog/folio.ts',
    frameRef: 'notes/verification/shell-wtpl/hero-07-folio.png',
    lesson: 'Gallery cells breathe: generous gutters, no borders — separation by tone shift alone; one cell enlarged breaks the grid rhythm (focal); captions set micro, tracked wide, all-caps; nothing competes with the imagery.',
  },
  {
    id: 'ex-wbake-contrast',
    title: 'CONTRAST — one-shot ceiling reference (W-BAKE best render)',
    tags: ['2d', 'type', 'editorial', 'hero'],
    codeRef: 'notes/bakeoff/corpus/visual/cases/v-09-editorial-oversized-type.json',
    frameRef: 'notes/bakeoff-b/frames/claude-fable-5/v-18-nav-dock-r2.png',
    lesson: 'The single 0-MUST-FIX render of 369: near-black field, ONE oversized word with real weight, signal-red accent used exactly once, nav items in quiet mono caps with even optical spacing, hairline separators — discipline beats decoration; adding a second idea would have broken it.',
  },
  {
    id: 'ex-wbg-observatory',
    title: 'W-BG observatory deep background (graded 3D stage)',
    tags: ['3d', 'lighting', 'material'],
    codeRef: 'src/lib/editor/backgrounds/presets.ts',
    frameRef: 'public/three-d-bg/thumbs/observatoryDeep.webp',
    lesson: 'A stage is never flat black: graded depth fog + faint architectural geometry + one warm practical glow give every hero an atmosphere to sit in; background luminance stays under the subject key so the subject wins.',
  },
  {
    id: 'ex-orrery-mechanism',
    title: 'ORRERY No.7 mechanism (kinetic 3D showpiece)',
    tags: ['3d', 'hero', 'product', 'metrics'],
    codeRef: 'src/lib/prism/atelier/watch-node-factory.ts',
    frameRef: 'notes/verification/shell-w9a/w9a-desktop-02-orrery.png',
    lesson: 'Mechanical motion sells materiality: slow constant-rate rotation on nested pivots, metal that catches the rim light as it turns; motion is weighty (no easing bounce), and every moving part has a static counterweight in the frame.',
  },
];

/** Derive style tags for a node from subtype/caption/category signals. */
export function deriveNodeTags(node: PrismNode, is3d?: boolean): ExemplarTag[] {
  const tags = new Set<ExemplarTag>();
  const hay = [
    node.subtype ?? '',
    node.intent?.caption ?? '',
    JSON.stringify(node.intent?.visualSpec?.effects ?? ''),
  ].join(' ').toLowerCase();
  if (is3d != null) tags.add(is3d ? '3d' : '2d');
  else if (node.renderMode === 'mesh' || /3d|orbit|orrery|mesh|glass|particle|pedestal/.test(hay)) tags.add('3d');
  else tags.add('2d');
  if (/hero|showcase|flagship/.test(hay)) tags.add('hero');
  if (/product|watch|device|object/.test(hay)) tags.add('product');
  if (/type|headline|editorial|word/.test(hay)) tags.add('type');
  if (/editorial|magazine|column|folio/.test(hay)) tags.add('editorial');
  if (/photo|composite|film/.test(hay)) tags.add('photo');
  if (/pricing|price|tier/.test(hay)) tags.add('pricing');
  if (/gallery|carousel|strip|wall|grid/.test(hay)) tags.add('gallery');
  if (/metric|bento|data|ribbon|dashboard/.test(hay)) tags.add('metrics');
  if (/nav|dock|footer|menu/.test(hay)) tags.add('nav');
  if (/panel|card|testimonial|empty/.test(hay)) tags.add('panel');
  if (/cta|button|action/.test(hay)) tags.add('cta');
  if (/material|metal|glass|brass|titanium/.test(hay)) tags.add('material');
  if (/light|glow|lume|rim|illumin/.test(hay)) tags.add('lighting');
  return [...tags];
}

/** 2 nearest exemplars by tag overlap; deterministic (id tiebreak). */
export function selectNearestExemplars(node: PrismNode, k = 2, is3d?: boolean): WorkedExemplar[] {
  const nodeTags = new Set(deriveNodeTags(node, is3d));
  return [...WORKED_EXEMPLARS]
    .map((ex) => ({ ex, score: ex.tags.filter((t) => nodeTags.has(t)).length }))
    .sort((a, b) => (b.score - a.score) || a.ex.id.localeCompare(b.ex.id))
    .slice(0, k)
    .map((s) => s.ex);
}

export function buildExemplarBlock(exemplars: WorkedExemplar[]): string {
  if (exemplars.length === 0) return '';
  const lines = ['WORKED EXEMPLARS (nearest to this node — study the lessons, do not copy the subjects):'];
  for (const ex of exemplars) {
    lines.push(`- ${ex.title}: ${ex.lesson}`);
  }
  return lines.join('\n');
}
