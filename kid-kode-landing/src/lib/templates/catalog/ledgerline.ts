// W-TPL hub template - "Ledgerline" (pricing / editorial-product-gallery).
//
// The family (corpus): each product is a full-page magazine spread - a
// full-bleed environment, a light display headline, and a small museum label; a
// slider that feels like turning pages of a curated catalog. Ledgerline reframes
// PRICING that way (distinct from Abacus's bento use of a different family):
// each tier is a spread whose "material" (obsidian, marble, brass - real
// generated cutouts, DEV-5) is the hero object on a self-lit graded "page", with
// a large light tier name, a large price, and ONE inclusion line. Deliberately
// sparse + large type: small dense extruded text bevels read noisy in
// ConductorRuntime (DEV-6 family), so the spread carries few, big, clean words.
//
// Route decision (planner): interaction=scroll pages, realism=photoreal (object
// cutouts on graded stages), byteBudget=moderate, motion=ambient, source=photo R2.

import type { GraphSource, PrismNode } from '@/lib/prism-graph/types';
import { bind, imageNode, meshNode, templateHub, textNode } from '../catalog-helpers';

const HUB = 'ledgerline';
const A = '/prism-mock/templates/ledgerline';
const IVORY = '#f2ece0';
const INK = '#060606';

interface Spread {
  id: string;
  material: string;
  name: string;
  price: string;
  line: string;
  accent: string;
  stage: string;
  y: number;
  objLeft: boolean;
}

const SPREADS: Spread[] = [
  {
    id: 'obsidian',
    material: 'obsidian',
    name: 'Obsidian',
    price: 'Free',
    line: 'One workspace. Community support. Export anytime.',
    accent: '#9fd8e4',
    stage: '#171d24',
    y: 1.5,
    objLeft: true,
  },
  {
    id: 'marble',
    material: 'marble',
    name: 'Marble',
    price: '$48',
    line: 'Five workspaces. Shared library. Humans on support.',
    accent: '#e4d9c0',
    stage: '#1d1810',
    y: -3.4,
    objLeft: false,
  },
  {
    id: 'brass',
    material: 'brass',
    name: 'Brass',
    price: '$96',
    line: 'Unlimited everything. White-glove onboarding. Custom SLAs.',
    accent: '#f0cf8c',
    stage: '#1d1408',
    y: -8.3,
    objLeft: true,
  },
];

function spreadNodes(s: Spread): PrismNode[] {
  const objX = s.objLeft ? -3.7 : 3.7;
  const txtX = s.objLeft ? 2.5 : -2.5;
  return [
    // Full-bleed graded "page" behind the spread. ConductorRuntime applies no
    // hub lighting, so a self-lit emissive tint makes the page visible (a subtle
    // ground the object + type sit on) without over-lighting the type bevels.
    meshNode(
      {
        id: `led-stage-${s.id}`,
        hub: HUB,
        caption: `${s.name} spread page - a graded editorial ground.`,
        x: 0,
        y: s.y,
        z: -1.5,
        w: 15,
        h: 4.4,
      },
      { kind: 'plane', params: { width: 15, height: 4.4 } },
      // A subtle DARK graded ground (very low emissive so it reads as a tinted
      // band, not pure black). Light-emissive type over it stays crisp - a bright
      // emissive page made extruded text bevels bloom red under AgX (DEV-6).
      { baseColor: s.stage, emissive: s.stage, emissiveIntensity: 0.3, metalness: 0.1, roughness: 0.8 },
    ),
    imageNode(
      {
        id: `led-obj-${s.id}`,
        hub: HUB,
        caption: `${s.name} tier object - ${s.material} cutout, floats + parallax.`,
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
        caption: `${s.name} tier name.`,
        x: txtX,
        y: s.y + 1.15,
        z: 0.4,
        w: 7,
        h: 1,
      },
      s.name,
      { family: 'Fraunces', weight: 400, size: 0.72, color: IVORY, glow: 2, reveal: false },
    ),
    textNode(
      {
        id: `led-price-${s.id}`,
        hub: HUB,
        caption: `${s.name} price - rolls up on entry.`,
        x: txtX,
        y: s.y + 0.15,
        z: 0.4,
        w: 5,
        h: 0.7,
      },
      s.price,
      { family: 'Fraunces', weight: 600, size: 0.5, color: s.accent, glow: 2, reveal: false },
    ),
    textNode(
      {
        id: `led-line-${s.id}`,
        hub: HUB,
        caption: `${s.name} inclusion line.`,
        x: txtX,
        y: s.y - 0.85,
        z: 0.4,
        w: 6.6,
        h: 0.5,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.015 } })],
      },
      s.line,
      { family: 'Fraunces', weight: 400, size: 0.2, color: '#cfc7b8', glow: 1.7, reveal: false },
    ),
  ];
}

export const ledgerlineGraph: GraphSource = {
  hubs: [
    templateHub({
      hubId: HUB,
      title: 'Ledgerline - Editorial Pricing',
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
        w: 12,
        h: 0.9,
      },
      'Three materials. One promise.',
      { family: 'Fraunces', weight: 600, size: 0.56, color: IVORY, glow: 2.3 },
    ),
    ...SPREADS.flatMap(spreadNodes),
  ],
  edges: [],
};
