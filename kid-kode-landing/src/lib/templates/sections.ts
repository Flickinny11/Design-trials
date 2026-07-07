// W-TPL D4 - droppable SECTION templates. Each builds fresh, seq-suffixed
// PrismNodes parented to an EXISTING hub (the picker's section-drop flow), so a
// section can be added below whatever a user already built. Unlike hub
// templates, sections are ASSET-FREE by law - they compose from parametric PBR
// meshes, native extruded text, and self-generating particle fx, so any hub can
// receive any section regardless of what imagery it does or doesn't have.
//
// Every node id incorporates `anchor.seq` (repeat drops never collide, enforced
// by tests/unit/wtpl-catalog.test.ts) and every node parents to `anchor.hubId`.
// Positions are authored relative to the anchor origin the picker supplies.
//
// Grammar grounding: each section derives from a real corpus family
// (design-grammar/families/<id>.json); the primaryFamily is asserted on disk by
// the same law test that grounds hub templates.

import type { PrismNode } from '@/lib/prism-graph/types';
import type {
  SectionAnchor,
  SectionTemplateEntry,
} from './catalog-types';
import { bind, fxNode, meshNode, textNode } from './catalog-helpers';

const GOLD = '#c9a25f';
const PAPER = '#ece6d9';

/** Local node factory: parents to the anchor hub, suffixes the id with the
 *  drop's seq, and offsets the authored (x,y) by the anchor origin. */
interface Local {
  id: string;
  caption: string;
  dx: number;
  dy: number;
  z?: number;
  w: number;
  h: number;
  scale?: number;
  rot?: [number, number, number];
  bindings?: PrismNode['animationBindings'];
}
function place(a: SectionAnchor, l: Local) {
  return {
    id: `sec-${l.id}-${a.seq}`,
    hub: a.hubId,
    caption: l.caption,
    x: a.x + l.dx,
    y: a.y + l.dy,
    z: (a.z ?? 0) + (l.z ?? 0),
    w: l.w,
    h: l.h,
    scale: l.scale,
    rot: l.rot,
    bindings: l.bindings,
  };
}

// ── Sections ────────────────────────────────────────────────────────────────

const heroSection: SectionTemplateEntry = {
  slug: 'sec-aurora-hero',
  name: 'Aurora Hero',
  kind: 'hero',
  primaryFamily: 'oversized-type-editorial',
  tagline: 'A bold headline + dek + CTA over a dust field.',
  tags: ['Hero', 'Headline', 'CTA'],
  accent: GOLD,
  height: 5,
  build: (a) => [
    fxNode({
      ...place(a, { id: 'hero-dust', caption: 'Hero dust field.', dx: 0, dy: 0, z: -1, w: 13, h: 5, bindings: [bind('dust-particles', 'time', { params: { density: 0.4 } })] }),
    }),
    textNode(place(a, { id: 'hero-h', caption: 'Section hero headline.', dx: 0, dy: 1.1, z: 0.3, w: 11, h: 1 }), 'A headline worth the scroll.', { family: 'Fraunces', weight: 600, size: 0.6, color: PAPER, glow: 1.8 }),
    textNode(place(a, { id: 'hero-dek', caption: 'Section hero dek.', dx: 0, dy: 0.2, z: 0.3, w: 8, h: 0.4, bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })] }), 'One clear line about why this matters.', { family: 'JetBrains Mono', weight: 400, size: 0.16, color: '#c3bcaa', glow: 1.2 }),
    textNode(place(a, { id: 'hero-cta', caption: 'Section hero CTA - magnetic.', dx: 0, dy: -1, z: 0.3, w: 5, h: 0.4, bindings: [bind('magnetic', 'pointer', { params: { strength: 0.55 } }), bind('hover-lift', 'pointer', {})] }), 'GET STARTED', { family: 'JetBrains Mono', weight: 400, size: 0.18, color: GOLD, glow: 2.1, reveal: false }),
  ],
};

const carouselSection: SectionTemplateEntry = {
  slug: 'sec-coverflow-strip',
  name: 'Coverflow Strip',
  kind: 'carousel',
  primaryFamily: 'coverflow-3d-carousel',
  tagline: 'Three cards on a perspective arc, active one flat.',
  tags: ['Carousel', 'Coverflow', 'Cards'],
  accent: '#f2794b',
  height: 5,
  build: (a) => {
    const cards = [
      { id: 'l', dx: -3.4, z: -1, rotY: 0.5, s: 0.86, active: false },
      { id: 'c', dx: 0, z: 0.4, rotY: 0, s: 1, active: true },
      { id: 'r', dx: 3.4, z: -1, rotY: -0.5, s: 0.86, active: false },
    ];
    return cards.map((c) =>
      meshNode(
        place(a, { id: `cf-${c.id}`, caption: `Coverflow card ${c.id}.`, dx: c.dx, dy: 0, z: c.z, w: 2.8, h: 3.4, scale: c.s, rot: [0, c.rotY, 0], bindings: [bind('spring-arrive', 'inview', {}), bind('hover-lift', 'pointer', {}), bind('float', 'time', { params: { amplitude: 0.04, periodSec: 6 + c.dx } })] }),
        { kind: 'cube', params: { width: 2.8, height: 3.4, depth: 0.12 } },
        c.active
          ? { baseColor: '#1a1712', metalness: 0.3, roughness: 0.3, clearcoat: 0.8, emissive: '#f2794b', emissiveIntensity: 0.15, envMapIntensity: 1.1 }
          : { baseColor: '#121016', metalness: 0.25, roughness: 0.42, clearcoat: 0.5, envMapIntensity: 0.85 },
      ),
    );
  },
};

const bentoSection: SectionTemplateEntry = {
  slug: 'sec-bento-quad',
  name: 'Bento Quad',
  kind: 'bento',
  primaryFamily: 'bento-grid-slider',
  tagline: 'A mixed-span four-tile bento block.',
  tags: ['Bento', 'Grid', 'Features'],
  accent: '#38e0b0',
  height: 4.5,
  build: (a) => {
    const tiles = [
      { id: 'big', dx: -2.6, dy: 0, w: 4.4, h: 3.6, c: '#141820' },
      { id: 'tr', dx: 2.4, dy: 0.95, w: 4, h: 1.6, c: '#101a17' },
      { id: 'br1', dx: 1.15, dy: -0.95, w: 1.5, h: 1.5, c: '#161318' },
      { id: 'br2', dx: 3.35, dy: -0.95, w: 2.3, h: 1.5, c: '#12161c' },
    ];
    return tiles.map((t) =>
      meshNode(
        place(a, { id: `bento-${t.id}`, caption: `Bento tile ${t.id}.`, dx: t.dx, dy: t.dy, z: 0, w: t.w, h: t.h, bindings: [bind('spring-arrive', 'inview', {}), bind('hover-lift', 'pointer', {})] }),
        { kind: 'cube', params: { width: t.w, height: t.h, depth: 0.12 } },
        { baseColor: t.c, metalness: 0.3, roughness: 0.4, clearcoat: 0.55, envMapIntensity: 0.95 },
      ),
    );
  },
};

const testimonialSection: SectionTemplateEntry = {
  slug: 'sec-testimonial-card',
  name: 'Testimonial Card',
  kind: 'testimonial',
  primaryFamily: 'coverflow-3d-carousel',
  tagline: 'A quote slab with an avatar chip and attribution.',
  tags: ['Testimonial', 'Quote', 'Social proof'],
  accent: GOLD,
  height: 3.4,
  build: (a) => [
    meshNode(place(a, { id: 'test-slab', caption: 'Testimonial slab.', dx: 0, dy: 0, z: 0, w: 8.4, h: 2.8, bindings: [bind('spring-arrive', 'inview', {}), bind('hover-lift', 'pointer', {})] }), { kind: 'cube', params: { width: 8.4, height: 2.8, depth: 0.1 } }, { baseColor: '#13161c', metalness: 0.25, roughness: 0.42, clearcoat: 0.6, envMapIntensity: 0.9 }),
    textNode(place(a, { id: 'test-quote', caption: 'Testimonial quote.', dx: 0, dy: 0.35, z: 0.25, w: 7.4, h: 1, bindings: [bind('text-cascade', 'inview', { params: { stagger: 0.03 } })] }), '"It shipped in a day and looked like a month."', { family: 'Fraunces', weight: 400, size: 0.26, color: PAPER, glow: 1.4 }),
    meshNode(place(a, { id: 'test-avatar', caption: 'Avatar chip.', dx: -2.9, dy: -0.75, z: 0.25, w: 0.5, h: 0.5, bindings: [bind('spin', 'time', { params: { speed: 0.2 } })] }), { kind: 'sphere', params: { radius: 0.25 } }, { baseColor: GOLD, metalness: 0.9, roughness: 0.25, envMapIntensity: 1.2 }),
    textNode(place(a, { id: 'test-name', caption: 'Attribution.', dx: -1.2, dy: -0.75, z: 0.25, w: 5, h: 0.3, bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })] }), 'MAYA T. - FOUNDER, NORTHWIND', { family: 'JetBrains Mono', weight: 400, size: 0.13, color: GOLD, glow: 1.5, reveal: false }),
  ],
};

const pricingSection: SectionTemplateEntry = {
  slug: 'sec-pricing-triptych',
  name: 'Pricing Triptych',
  kind: 'pricing',
  primaryFamily: 'bento-grid-slider',
  tagline: 'Three tier slabs with rolling numerals.',
  tags: ['Pricing', 'Tiers', 'Plans'],
  accent: GOLD,
  height: 4.5,
  build: (a) => {
    const tiers = [
      { id: 'a', dx: -3.4, price: '19', name: 'Start', accent: '#9fb2cc' },
      { id: 'b', dx: 0, price: '49', name: 'Grow', accent: '#f3dfae' },
      { id: 'c', dx: 3.4, price: '99', name: 'Scale', accent: '#8fd0dc' },
    ];
    return tiers.flatMap((t): PrismNode[] => [
      meshNode(place(a, { id: `price-${t.id}`, caption: `${t.name} tier slab.`, dx: t.dx, dy: 0, z: 0, w: 3, h: 3.4, bindings: [bind('spring-arrive', 'inview', {}), bind('hover-lift', 'pointer', {})] }), { kind: 'cube', params: { width: 3, height: 3.4, depth: 0.14 } }, { baseColor: '#141821', metalness: 0.3, roughness: 0.36, clearcoat: 0.6, envMapIntensity: 1 }),
      textNode(place(a, { id: `price-${t.id}-n`, caption: `${t.name} name.`, dx: t.dx, dy: 1, z: 0.25, w: 2.6, h: 0.35 }), t.name, { family: 'Fraunces', weight: 600, size: 0.24, color: PAPER, glow: 1.5, reveal: false }),
      textNode(place(a, { id: `price-${t.id}-p`, caption: `${t.name} price.`, dx: t.dx, dy: 0, z: 0.25, w: 2.6, h: 0.8, bindings: [bind('text-counter-roll', 'inview', {})] }), `$${t.price}`, { family: 'JetBrains Mono', weight: 400, size: 0.56, color: t.accent, glow: 2, reveal: false }),
    ]);
  },
};

const ctaSection: SectionTemplateEntry = {
  slug: 'sec-cta-banner',
  name: 'CTA Banner',
  kind: 'cta',
  primaryFamily: 'oversized-type-editorial',
  tagline: 'A wide banner slab with a magnetic call to action.',
  tags: ['CTA', 'Banner', 'Convert'],
  accent: GOLD,
  height: 2.6,
  build: (a) => [
    meshNode(place(a, { id: 'cta-bar', caption: 'CTA banner slab - light sweep.', dx: 0, dy: 0, z: 0, w: 11, h: 2, bindings: [bind('spring-arrive', 'inview', {}), bind('hover-lift', 'pointer', {})] }), { kind: 'cube', params: { width: 11, height: 2, depth: 0.12 } }, { baseColor: '#171310', metalness: 0.4, roughness: 0.3, clearcoat: 0.7, emissive: GOLD, emissiveIntensity: 0.12, envMapIntensity: 1 }),
    textNode(place(a, { id: 'cta-h', caption: 'CTA line.', dx: -0.6, dy: 0.2, z: 0.25, w: 7.5, h: 0.7 }), 'Ready when you are.', { family: 'Fraunces', weight: 600, size: 0.36, color: PAPER, glow: 1.6 }),
    textNode(place(a, { id: 'cta-btn', caption: 'CTA button - magnetic.', dx: 3.6, dy: -0.1, z: 0.28, w: 3, h: 0.5, bindings: [bind('magnetic', 'pointer', { params: { strength: 0.6 } }), bind('hover-lift', 'pointer', {})] }), 'START FREE', { family: 'JetBrains Mono', weight: 400, size: 0.18, color: GOLD, glow: 2.2, reveal: false }),
  ],
};

const galleryStripSection: SectionTemplateEntry = {
  slug: 'sec-gallery-strip',
  name: 'Gallery Strip',
  kind: 'gallery-strip',
  primaryFamily: 'infinite-filmstrip-gallery',
  tagline: 'A row of five tiles that drift on their own phases.',
  tags: ['Gallery', 'Strip', 'Tiles'],
  accent: '#6f7fd6',
  height: 3,
  build: (a) => {
    const xs = [-4.4, -2.2, 0, 2.2, 4.4];
    return xs.map((dx, i) =>
      meshNode(
        place(a, { id: `strip-${i}`, caption: `Gallery tile ${i}.`, dx, dy: 0, z: 0, w: 1.9, h: 2.4, bindings: [bind('spring-arrive', 'inview', {}), bind('float', 'time', { params: { amplitude: i % 2 ? 0.06 : -0.06, periodSec: 6 + i } }), bind('hover-lift', 'pointer', {})] }),
        { kind: 'cube', params: { width: 1.9, height: 2.4, depth: 0.1 } },
        { baseColor: '#12131b', metalness: 0.28, roughness: 0.4, clearcoat: 0.5, emissive: '#6f7fd6', emissiveIntensity: 0.06, envMapIntensity: 0.9 },
      ),
    );
  },
};

const statBandSection: SectionTemplateEntry = {
  slug: 'sec-stat-band',
  name: 'Stat Band',
  kind: 'stat-band',
  primaryFamily: 'oversized-type-editorial',
  tagline: 'Three big numerals that roll up on entry.',
  tags: ['Stats', 'Metrics', 'Proof'],
  accent: GOLD,
  height: 2.4,
  build: (a) => {
    const stats = [
      { id: 'a', dx: -3.6, big: '12K', small: 'PROJECTS SHIPPED' },
      { id: 'b', dx: 0, big: '99.9%', small: 'UPTIME' },
      { id: 'c', dx: 3.6, big: '40', small: 'COUNTRIES' },
    ];
    return stats.flatMap((s): PrismNode[] => [
      textNode(place(a, { id: `stat-${s.id}-b`, caption: `Stat ${s.id} numeral.`, dx: s.dx, dy: 0.2, z: 0.2, w: 3, h: 0.9, bindings: [bind('text-counter-roll', 'inview', {})] }), s.big, { family: 'JetBrains Mono', weight: 400, size: 0.5, color: PAPER, glow: 1.9, reveal: false }),
      textNode(place(a, { id: `stat-${s.id}-s`, caption: `Stat ${s.id} label.`, dx: s.dx, dy: -0.55, z: 0.2, w: 3.2, h: 0.28, bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })] }), s.small, { family: 'JetBrains Mono', weight: 400, size: 0.12, color: GOLD, glow: 1.4, reveal: false }),
    ]);
  },
};

const quoteSection: SectionTemplateEntry = {
  slug: 'sec-pull-quote',
  name: 'Pull Quote',
  kind: 'quote',
  primaryFamily: 'oversized-type-editorial',
  tagline: 'One oversized pull-quote as a compositional plate.',
  tags: ['Quote', 'Editorial', 'Type'],
  accent: GOLD,
  height: 3.4,
  build: (a) => [
    textNode(place(a, { id: 'pq-mark', caption: 'Quote mark plate.', dx: -4.4, dy: 0.6, z: 0.1, w: 3, h: 2 }), '"', { family: 'Fraunces', weight: 600, size: 1.4, color: GOLD, glow: 1.5, reveal: false }),
    textNode(place(a, { id: 'pq-body', caption: 'Pull-quote body - cascade.', dx: 0.4, dy: 0.2, z: 0.3, w: 10, h: 1.8, bindings: [bind('text-cascade', 'inview', { params: { stagger: 0.03 } })] }), 'The best interface is the one\nyou forget you are using.', { family: 'Fraunces', weight: 400, size: 0.4, color: PAPER, glow: 1.5 }),
    textNode(place(a, { id: 'pq-attr', caption: 'Quote attribution.', dx: 0.4, dy: -1.3, z: 0.3, w: 6, h: 0.3, bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })] }), '- DESIGN PRINCIPLE No. 1', { family: 'JetBrains Mono', weight: 400, size: 0.13, color: GOLD, glow: 1.4, reveal: false }),
  ],
};

const marqueeSection: SectionTemplateEntry = {
  slug: 'sec-marquee-band',
  name: 'Marquee Band',
  kind: 'marquee',
  primaryFamily: 'infinite-filmstrip-gallery',
  tagline: 'A scrolling word belt that steers with scroll.',
  tags: ['Marquee', 'Ticker', 'Motion'],
  accent: GOLD,
  height: 1.6,
  build: (a) => [
    meshNode(place(a, { id: 'mq-rail', caption: 'Marquee rail.', dx: 0, dy: 0, z: -0.1, w: 13, h: 1, bindings: [bind('spring-arrive', 'inview', {})] }), { kind: 'cube', params: { width: 13, height: 1, depth: 0.08 } }, { baseColor: '#0f1114', metalness: 0.35, roughness: 0.4, clearcoat: 0.4, envMapIntensity: 0.8 }),
    textNode(place(a, { id: 'mq-text', caption: 'Marquee word belt - scroll-steered.', dx: 0, dy: 0, z: 0.2, w: 12, h: 0.5, bindings: [bind('scroll-marquee', 'scroll', { params: { speed: 0.6 } })] }), 'DESIGN / BUILD / SHIP / REPEAT / DESIGN / BUILD / SHIP / REPEAT', { family: 'JetBrains Mono', weight: 400, size: 0.2, color: GOLD, glow: 1.8, reveal: false }),
  ],
};

export const SECTION_TEMPLATES: readonly SectionTemplateEntry[] = [
  heroSection,
  carouselSection,
  bentoSection,
  testimonialSection,
  pricingSection,
  ctaSection,
  galleryStripSection,
  statBandSection,
  quoteSection,
  marqueeSection,
];
