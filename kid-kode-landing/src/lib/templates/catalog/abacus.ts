// W-TPL hub template - "Abacus" (pricing / bento-grid-slider).
//
// Asset-free pricing page as a bento board: mixed-span PBR slabs (the material
// tells the tier story - slate, brass, deep glass), data-mono numerals, a wide
// "everything ships with" tile, staggered rise on entry, hover lift per tile.
// The grid sits at shallow depth so the 3D perspective reads premium without
// the keystone excess (DEV-4).
//
// Route decision (planner): interaction=parallax, realism=high, byteBudget=
// tight, motion=ambient, source=procedural R1 (asset-free PBR).

import type { GraphSource, PrismNode } from '@/lib/prism-graph/types';
import { bind, meshNode, templateHub, textNode } from '../catalog-helpers';

const HUB = 'abacus';
const PAPER = '#efe9dc';
const BRASS = '#b08d3f';
const INK = '#07080c';

interface TierSpec {
  id: string;
  name: string;
  price: string;
  line: string;
  x: number;
  w: number;
  h: number;
  mat: Parameters<typeof meshNode>[2];
  accent: string;
  sweep?: boolean;
}

const TIERS: TierSpec[] = [
  {
    id: 'slate',
    name: 'Essential',
    price: '19',
    line: 'One project, every core tool',
    x: -3.9,
    w: 3.3,
    h: 3.4,
    mat: { baseColor: '#22252c', metalness: 0.15, roughness: 0.55, clearcoat: 0.25, envMapIntensity: 0.9 },
    accent: '#9fb2cc',
  },
  {
    id: 'brass',
    name: 'Studio',
    price: '49',
    line: 'Five projects, shared library',
    x: 0,
    w: 3.6,
    h: 3.9,
    mat: { baseColor: BRASS, metalness: 0.55, roughness: 0.5, envMapIntensity: 1.25 },
    accent: '#f3dfae',
    sweep: true,
  },
  {
    id: 'glass',
    name: 'Atelier',
    price: '99',
    line: 'Unlimited, white-glove care',
    x: 3.9,
    w: 3.3,
    h: 3.4,
    mat: { baseColor: '#0d1016', metalness: 0.2, roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.15, envMapIntensity: 1.1 },
    accent: '#8fd0dc',
  },
];

function tierNodes(t: TierSpec): PrismNode[] {
  const y = -0.5;
  const rise = bind('spring-arrive', 'inview', { params: {} });
  return [
    meshNode(
      {
        id: `aba-tile-${t.id}`,
        hub: HUB,
        caption: `${t.name} tier slab - ${t.id} material carries the tier story.`,
        x: t.x,
        y,
        w: t.w,
        h: t.h,
        z: 0,
        bindings: [
          rise,
          bind('hover-lift', 'pointer', {}),
          ...(t.sweep ? [bind('light-sweep', 'time', { params: { period: 5 } })] : []),
        ],
      },
      { kind: 'cube', params: { width: t.w, height: t.h, depth: 0.16 } },
      t.mat,
    ),
    textNode(
      {
        id: `aba-name-${t.id}`,
        hub: HUB,
        caption: `${t.name} tier name.`,
        x: t.x,
        y: y + t.h / 2 - 0.55,
        z: 0.25,
        w: t.w - 0.4,
        h: 0.4,
      },
      t.name,
      { family: 'Fraunces', weight: 600, size: 0.28, color: PAPER, glow: 2.3, reveal: false },
    ),
    textNode(
      {
        id: `aba-price-${t.id}`,
        hub: HUB,
        caption: `${t.name} price numeral - rolls up on entry.`,
        x: t.x,
        y: y + 0.25,
        z: 0.25,
        w: t.w - 0.4,
        h: 0.9,
        bindings: [bind('text-counter-roll', 'inview', {})],
      },
      `$${t.price}`,
      { family: 'JetBrains Mono', weight: 400, size: 0.62, color: t.accent, glow: 2.3, reveal: false },
    ),
    textNode(
      {
        id: `aba-line-${t.id}`,
        hub: HUB,
        caption: `${t.name} one-line inclusion.`,
        x: t.x,
        y: y - t.h / 2 + 0.5,
        z: 0.25,
        w: t.w - 0.3,
        h: 0.3,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })],
      },
      t.line,
      { family: 'JetBrains Mono', weight: 400, size: 0.13, color: '#c9c4b8', glow: 2 },
    ),
  ];
}

export const abacusGraph: GraphSource = {
  hubs: [
    templateHub({
      hubId: HUB,
      title: 'Abacus - Bento Pricing',
      caption: 'A pricing board where the material is the tier.',
      backgroundColor: INK,
      cursor: { style: 'dot', magnetic: true, accent: BRASS },
      transitionPreset: { kind: 'wipe' },
      contentHeight: 2000,
    }),
  ],
  nodes: [
    textNode(
      {
        id: 'aba-title',
        hub: HUB,
        caption: 'Pricing headline.',
        x: 0,
        y: 3.15,
        z: 0.2,
        w: 9,
        h: 0.9,
      },
      'Pick your pace.',
      { family: 'Playfair Display', weight: 600, size: 0.58, color: PAPER, glow: 2.3 },
    ),
    textNode(
      {
        id: 'aba-sub',
        hub: HUB,
        caption: 'Pricing dek.',
        x: 0,
        y: 2.35,
        z: 0.2,
        w: 8,
        h: 0.35,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })],
      },
      'Monthly. No meters ticking behind your back.',
      { family: 'JetBrains Mono', weight: 400, size: 0.16, color: '#b9b2a2', glow: 2 },
    ),
    ...TIERS.flatMap(tierNodes),
    // The wide "ships with" bento bar under the tiers.
    meshNode(
      {
        id: 'aba-ships-bar',
        hub: HUB,
        caption: 'Wide bento bar - everything every tier ships with.',
        x: 0,
        y: -3.35,
        w: 11.1,
        h: 1.1,
        z: 0,
        bindings: [bind('spring-arrive', 'inview', {}), bind('hover-lift', 'pointer', {})],
      },
      { kind: 'cube', params: { width: 11.1, height: 1.1, depth: 0.12 } },
      { baseColor: '#14161c', metalness: 0.3, roughness: 0.5, clearcoat: 0.25, envMapIntensity: 0.9 },
    ),
    textNode(
      {
        id: 'aba-ships-copy',
        hub: HUB,
        caption: 'Ships-with line.',
        x: 0,
        y: -3.35,
        z: 0.2,
        w: 10.5,
        h: 0.3,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.012 } })],
      },
      'Every tier: unlimited viewers / version history / export anytime / humans on support',
      { family: 'JetBrains Mono', weight: 400, size: 0.15, color: PAPER, glow: 2.3 },
    ),
    // Footnote CTA.
    textNode(
      {
        id: 'aba-cta',
        hub: HUB,
        caption: 'Footnote CTA - magnetic.',
        x: 0,
        y: -4.6,
        z: 0.2,
        w: 6,
        h: 0.3,
        bindings: [bind('magnetic', 'pointer', { params: { strength: 0.5 } })],
      },
      'START ON ESSENTIAL - MOVE WHEN READY',
      { family: 'JetBrains Mono', weight: 400, size: 0.15, color: BRASS, glow: 2.3, reveal: false },
    ),
  ],
  edges: [],
};
