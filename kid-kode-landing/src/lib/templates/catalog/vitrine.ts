// W-TPL hub template - "Vitrine" (product-showcase / filmstrip-3d-carousel).
//
// The family (corpus): portrait image frames drift and rescale continuously
// along an implied Z-arc like film cells sliding past a lens; the frames never
// fully settle - a perpetual drift keeps the hero alive between interactions.
// Vitrine is an eyewear showcase: four DISTINCT generated frames (not one
// echoed subject - DEV-5) composed on a Z-arc, each drifting weightlessly on
// its own phase with pointer parallax, so the hero is alive at rest.
//
// Route decision (planner): interaction=parallax/ambient, realism=photoreal
// (campaign stills), byteBudget=moderate, motion=perpetual drift, source=photo R2.

import type { GraphSource, PrismNode } from '@/lib/prism-graph/types';
import { bind, imageNode, templateHub, textNode } from '../catalog-helpers';

const HUB = 'vitrine';
const A = '/prism-mock/templates/vitrine';
const AMBER = '#e0a558';
const PAPER = '#efe6d7';
const INK = '#14100c';

interface Frame {
  n: number;
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY: number;
  period: number;
  up: boolean;
}

// The implied Z-arc: centre frame forward & upright, flankers recede + tilt.
const FRAMES: Frame[] = [
  { n: 1, x: -4.4, y: 0.2, z: -1.6, scale: 0.8, rotY: 0.42, period: 8, up: true },
  { n: 2, x: -1.7, y: -0.1, z: -0.3, scale: 0.95, rotY: 0.18, period: 6.5, up: false },
  { n: 3, x: 1.7, y: 0.15, z: 0.2, scale: 1, rotY: -0.18, period: 7.2, up: true },
  { n: 4, x: 4.4, y: -0.1, z: -1.4, scale: 0.82, rotY: -0.42, period: 9, up: false },
];

function frameNode(f: Frame): PrismNode {
  return imageNode(
    {
      id: `vit-f${f.n}`,
      hub: HUB,
      caption: `Eyewear frame ${f.n} - drifts weightlessly along the Z-arc.`,
      x: f.x,
      y: f.y,
      z: f.z,
      w: 3.1,
      h: 4,
      scale: f.scale,
      rot: [0, f.rotY, 0],
      bindings: [
        bind('weightless-drift', 'time', { params: { amount: 0.5 } }),
        bind('float', 'time', { params: { amplitude: f.up ? 0.1 : -0.1, periodSec: f.period } }),
        bind('parallax', 'pointer', { params: { strength: 0.4 } }),
      ],
    },
    `${A}/frame-${f.n}.webp`,
  );
}

export const vitrineGraph: GraphSource = {
  hubs: [
    templateHub({
      hubId: HUB,
      title: 'Vitrine - Filmstrip Product Showcase',
      caption: 'Frames that drift past the lens, alive between glances.',
      backgroundColor: INK,
      cursor: { style: 'ring', magnetic: true, accent: AMBER },
      transitionPreset: { kind: 'veil' },
      contentHeight: 1900,
    }),
  ],
  nodes: [
    ...FRAMES.map(frameNode),
    textNode(
      {
        id: 'vit-h1',
        hub: HUB,
        caption: 'Showcase headline.',
        x: 0,
        y: 3,
        z: 0.9,
        w: 11,
        h: 1,
      },
      'The new season, in frame.',
      { family: 'Fraunces', weight: 600, size: 0.56, color: PAPER, glow: 2.3 },
    ),
    textNode(
      {
        id: 'vit-dek',
        hub: HUB,
        caption: 'Showcase dek.',
        x: 0,
        y: 2.25,
        z: 0.9,
        w: 8,
        h: 0.35,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })],
      },
      'Four silhouettes. Hand-polished acetate. Made to be looked through.',
      { family: 'JetBrains Mono', weight: 400, size: 0.15, color: '#c9b79a', glow: 2 },
    ),
    textNode(
      {
        id: 'vit-price',
        hub: HUB,
        caption: 'From-price - rolls up.',
        x: 0,
        y: -2.7,
        z: 0.9,
        w: 5,
        h: 0.5,
        bindings: [bind('text-counter-roll', 'inview', {})],
      },
      'FROM $180',
      { family: 'JetBrains Mono', weight: 400, size: 0.22, color: AMBER, glow: 2.3, reveal: false },
    ),
    textNode(
      {
        id: 'vit-cta',
        hub: HUB,
        caption: 'Showcase CTA - magnetic + lift.',
        x: 0,
        y: -3.5,
        z: 0.9,
        w: 6,
        h: 0.45,
        bindings: [
          bind('magnetic', 'pointer', { params: { strength: 0.55 } }),
          bind('hover-lift', 'pointer', {}),
        ],
      },
      'TRY THE COLLECTION',
      { family: 'JetBrains Mono', weight: 400, size: 0.17, color: PAPER, glow: 2.3, reveal: false },
    ),
  ],
  edges: [],
};
