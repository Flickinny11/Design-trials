// W-TPL hub template — "Lumen" (gallery · infinite-filmstrip-gallery).
//
// The family (corpus): vertical columns of media tiles crawl endlessly in
// opposing directions forming a continuously moving mood-board wall, while a
// rock-steady oversized headline holds the centre. Lumen is a ceramics gallery:
// six DISTINCT generated vessels (not one echoed subject — DEV-5) flank a still
// centre headline in two columns, each tile floating on its own phase with
// pointer parallax so the wall is alive; a scroll colour-shift nods to the
// family's whole-board theme swap.
//
// Route decision (planner): interaction=parallax/scroll, realism=photoreal
// (studio product stills), byteBudget=moderate, motion=ambient, source=photo → R2.

import type { GraphSource, PrismNode } from '@/lib/prism-graph/types';
import { bind, imageNode, templateHub, textNode } from '../catalog-helpers';

const HUB = 'lumen';
const A = '/prism-mock/templates/lumen';
const INDIGO = '#6f7fd6';
const PAPER = '#e7e9f2';
const INK = '#0a0a0d';

interface Tile {
  n: number;
  x: number;
  y: number;
  w: number;
  h: number;
  period: number;
  up: boolean;
}

// Two flanking columns; centre kept clear for the steady headline.
const TILES: Tile[] = [
  { n: 1, x: -4.9, y: 2.4, w: 3, h: 3.4, period: 7, up: true },
  { n: 2, x: -4.6, y: -1.3, w: 3.2, h: 2.6, period: 8.5, up: true },
  { n: 3, x: -4.9, y: -4.6, w: 3, h: 2.9, period: 6.5, up: true },
  { n: 4, x: 4.9, y: 2.7, w: 3, h: 2.8, period: 8, up: false },
  { n: 5, x: 4.6, y: -0.8, w: 3.2, h: 3.3, period: 6.8, up: false },
  { n: 6, x: 4.9, y: -4.4, w: 3, h: 2.7, period: 9, up: false },
];

function tileNode(t: Tile): PrismNode {
  return imageNode(
    {
      id: `lum-v${t.n}`,
      hub: HUB,
      caption: `Vessel ${t.n} — floats on its own phase (${t.up ? 'up' : 'down'} column).`,
      x: t.x,
      y: t.y,
      z: -0.4,
      w: t.w,
      h: t.h,
      bindings: [
        bind('float', 'time', { params: { amplitude: t.up ? 0.12 : -0.12, periodSec: t.period } }),
        bind('parallax', 'pointer', { params: { strength: 0.3 } }),
        bind('scroll-color-shift', 'scroll', { params: { hue: 0.08 } }),
      ],
    },
    `${A}/vessel-${t.n}.webp`,
  );
}

export const lumenGraph: GraphSource = {
  hubs: [
    templateHub({
      hubId: HUB,
      title: 'Lumen — Infinite Filmstrip Gallery',
      caption: 'A moving wall of work around a still headline.',
      backgroundColor: INK,
      cursor: { style: 'halo', magnetic: false, accent: INDIGO },
      transitionPreset: { kind: 'dissolve' },
      contentHeight: 2200,
    }),
  ],
  nodes: [
    ...TILES.map(tileNode),
    // The rock-steady centre — the headline the moving wall orbits.
    textNode(
      {
        id: 'lum-h1',
        hub: HUB,
        caption: 'Steady gallery headline — the still centre.',
        x: 0,
        y: 1.1,
        z: 0.6,
        w: 6.5,
        h: 2.2,
      },
      'Held\nin\nclay',
      { family: 'Fraunces', weight: 600, size: 0.72, color: PAPER, glow: 1.8 },
    ),
    textNode(
      {
        id: 'lum-dek',
        hub: HUB,
        caption: 'Gallery dek.',
        x: 0,
        y: -1.5,
        z: 0.6,
        w: 4.6,
        h: 0.7,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })],
      },
      'Fifty vessels. One glaze. A wall that never sits still.',
      { family: 'JetBrains Mono', weight: 400, size: 0.15, color: '#b6bde0', glow: 1.2 },
    ),
    textNode(
      {
        id: 'lum-cta',
        hub: HUB,
        caption: 'Gallery CTA — magnetic.',
        x: 0,
        y: -3,
        z: 0.6,
        w: 4.4,
        h: 0.4,
        bindings: [bind('magnetic', 'pointer', { params: { strength: 0.5 } })],
      },
      'ENTER THE COLLECTION →',
      { family: 'JetBrains Mono', weight: 400, size: 0.15, color: INDIGO, glow: 2.0, reveal: false },
    ),
  ],
  edges: [],
};
