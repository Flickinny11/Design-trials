// W-TPL hub template — "Ledgerline" (pricing · editorial-product-gallery).
//
// The family (corpus): each product is a full-page magazine spread — a
// full-bleed environment, a light display headline, and a small museum-label
// spec block; a slider that feels like turning pages of a curated catalog.
// Ledgerline reframes PRICING that way (distinct from Abacus's bento use of a
// different family): each tier is a spread whose "material" (obsidian, marble,
// brass — real generated cutouts, DEV-5) is the hero object, with a light tier
// headline and a museum-label inclusion block. Three spreads stacked to scroll.
//
// Route decision (planner): interaction=scroll pages, realism=photoreal (object
// cutouts on graded stages), byteBudget=moderate, motion=ambient, source=photo → R2.

import type { GraphSource, PrismNode } from '@/lib/prism-graph/types';
import { bind, imageNode, meshNode, templateHub, textNode } from '../catalog-helpers';

const HUB = 'ledgerline';
const A = '/prism-mock/templates/ledgerline';
const IVORY = '#ece4d4';
const INK = '#060606';

interface Spread {
  id: string;
  material: string;
  name: string;
  price: string;
  accent: string;
  stage: string;
  specs: string[];
  y: number;
  objLeft: boolean;
}

const SPREADS: Spread[] = [
  {
    id: 'obsidian',
    material: 'obsidian',
    name: 'Obsidian',
    price: '$0',
    accent: '#8fd0dc',
    stage: '#0a0d11',
    specs: ['One workspace', 'Community support', 'Export anytime'],
    y: 1.5,
    objLeft: true,
  },
  {
    id: 'marble',
    material: 'marble',
    name: 'Marble',
    price: '$48',
    accent: '#d7cdb8',
    stage: '#12100c',
    specs: ['Five workspaces', 'Shared library', 'Priority queue', 'Humans on support'],
    y: -3.4,
    objLeft: false,
  },
  {
    id: 'brass',
    material: 'brass',
    name: 'Brass',
    price: '$96',
    accent: '#e6c583',
    stage: '#100b06',
    specs: ['Unlimited workspaces', 'White-glove onboarding', 'Dedicated line', 'Custom SLAs'],
    y: -8.3,
    objLeft: true,
  },
];

function spreadNodes(s: Spread): PrismNode[] {
  const objX = s.objLeft ? -3.6 : 3.6;
  const txtX = s.objLeft ? 2.4 : -2.4;
  const nodes: PrismNode[] = [
    // Full-bleed stage tint behind the spread (the "environment").
    meshNode(
      {
        id: `led-stage-${s.id}`,
        hub: HUB,
        caption: `${s.name} spread stage.`,
        x: 0,
        y: s.y,
        z: -1.5,
        w: 15,
        h: 4.4,
      },
      { kind: 'plane', params: { width: 15, height: 4.4 } },
      { baseColor: s.stage, metalness: 0.1, roughness: 0.7, envMapIntensity: 0.5 },
    ),
    imageNode(
      {
        id: `led-obj-${s.id}`,
        hub: HUB,
        caption: `${s.name} tier object — ${s.material} cutout, floats + parallax.`,
        x: objX,
        y: s.y,
        z: 0.3,
        w: 4.6,
        h: 4.2,
        bindings: [
          bind('float', 'time', { params: { amplitude: 0.06, periodSec: 7 } }),
          bind('parallax', 'pointer', { params: { strength: 0.35 } }),
        ],
      },
      `${A}/${s.material}.cut.png`,
      false,
    ),
    textNode(
      {
        id: `led-name-${s.id}`,
        hub: HUB,
        caption: `${s.name} tier headline.`,
        x: txtX,
        y: s.y + 1.3,
        z: 0.4,
        w: 7,
        h: 1,
        bindings: [bind('text-mask-reveal', 'inview', { params: { stagger: 0.03 } })],
      },
      s.name,
      { family: 'Fraunces', weight: 400, size: 0.62, color: IVORY, glow: 1.6 },
    ),
    textNode(
      {
        id: `led-price-${s.id}`,
        hub: HUB,
        caption: `${s.name} price — rolls up.`,
        x: txtX,
        y: s.y + 0.35,
        z: 0.4,
        w: 5,
        h: 0.6,
        bindings: [bind('text-counter-roll', 'inview', {})],
      },
      `${s.price} / mo`,
      { family: 'JetBrains Mono', weight: 400, size: 0.26, color: s.accent, glow: 1.9, reveal: false },
    ),
  ];
  // Museum-label spec block — tiny mono lines.
  s.specs.forEach((spec, i) => {
    nodes.push(
      textNode(
        {
          id: `led-spec-${s.id}-${i}`,
          hub: HUB,
          caption: `${s.name} spec — ${spec}.`,
          x: txtX,
          y: s.y - 0.3 - i * 0.32,
          z: 0.4,
          w: 6,
          h: 0.26,
          bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })],
        },
        `— ${spec}`,
        { family: 'JetBrains Mono', weight: 400, size: 0.13, color: '#c7bfae', glow: 1.1 },
      ),
    );
  });
  return nodes;
}

export const ledgerlineGraph: GraphSource = {
  hubs: [
    templateHub({
      hubId: HUB,
      title: 'Ledgerline — Editorial Pricing',
      caption: 'Pricing tiers turned like pages of a design catalog.',
      backgroundColor: INK,
      cursor: { style: 'dot', magnetic: true, accent: '#e6c583' },
      transitionPreset: { kind: 'curtain' },
      contentHeight: 3000,
    }),
  ],
  nodes: [
    textNode(
      {
        id: 'led-masthead',
        hub: HUB,
        caption: 'Pricing masthead.',
        x: 0,
        y: 3.9,
        z: 0.5,
        w: 11,
        h: 0.8,
      },
      'Three materials. One promise.',
      { family: 'Fraunces', weight: 600, size: 0.5, color: IVORY, glow: 1.7 },
    ),
    ...SPREADS.flatMap(spreadNodes),
  ],
  edges: [],
};
