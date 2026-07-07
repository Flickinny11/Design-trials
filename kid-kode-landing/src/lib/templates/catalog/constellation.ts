// W-TPL hub template — "Constellation" (about · particle-field-hero).
//
// Asset-free about page: the team/values story told as a living constellation.
// A GPU constellation net + firefly field carries the family's core mechanic
// (particle field with pointer response); the values are extruded serif words
// pinned at net vertices, glowing as the cursor nears (proximity-rim-glow) and
// floating phase-desynced so the field never freezes. Stats roll in with a
// counter on scroll — data-mono per DL3.
//
// Route decision (planner): interaction=parallax, realism=stylized (procedural
// field), byteBudget=tight, motion=responsive, source=procedural → R1.

import type { GraphSource } from '@/lib/prism-graph/types';
import { bind, fxNode, templateHub, textNode } from '../catalog-helpers';

const HUB = 'constellation';
const GLOW = '#8fb8ff';
const STAR = '#e9efff';
const INK = '#05070f';

function valueNode(
  id: string,
  word: string,
  x: number,
  y: number,
  period: number,
): ReturnType<typeof textNode> {
  return textNode(
    {
      id,
      hub: HUB,
      caption: `Value — ${word}; glows on approach, drifts on its own phase.`,
      x,
      y,
      z: 0.2,
      w: 2.6,
      h: 0.5,
      bindings: [
        bind('proximity-rim-glow', 'pointer', { params: { radius: 2.2 } }),
        bind('float', 'time', { params: { amplitude: 0.06, periodSec: period } }),
        bind('text-pop-each', 'inview', { params: { stagger: 0.05 } }),
      ],
    },
    word,
    { family: 'Fraunces', weight: 600, size: 0.3, color: STAR, glow: 1.7 },
  );
}

export const constellationGraph: GraphSource = {
  hubs: [
    templateHub({
      hubId: HUB,
      title: 'Constellation — Living About',
      caption: 'An about page as a constellation of values and people.',
      backgroundColor: INK,
      cursor: { style: 'halo', magnetic: false, accent: GLOW },
      transitionPreset: { kind: 'glass-sweep' },
      contentHeight: 2200,
    }),
  ],
  nodes: [
    // The field: a constellation net + fireflies + slow galaxy dust, all
    // pointer-aware. Three layers at different depths = parallax for free.
    fxNode({
      id: 'con-net',
      hub: HUB,
      caption: 'Constellation net — vertices link as lines, pointer-aware.',
      x: 0,
      y: 0.3,
      z: -1.6,
      w: 14,
      h: 8,
      bindings: [bind('constellation-net', 'pointer', { params: { linkRadius: 2.4 } })],
    }),
    fxNode({
      id: 'con-fireflies',
      hub: HUB,
      caption: 'Firefly drift layer.',
      x: 0,
      y: 0,
      z: -0.8,
      w: 13,
      h: 7.5,
      bindings: [bind('fireflies', 'time', { params: { count: 26 } })],
    }),
    fxNode({
      id: 'con-dust',
      hub: HUB,
      caption: 'Far dust field.',
      x: 0,
      y: 0,
      z: -2.6,
      w: 16,
      h: 9,
      bindings: [bind('dust-particles', 'time', { params: { density: 0.4 } })],
    }),
    // Headline + dek.
    textNode(
      {
        id: 'con-headline',
        hub: HUB,
        caption: 'About headline — kinetic wave reveal.',
        x: 0,
        y: 2.3,
        z: 0.3,
        w: 10,
        h: 1,
      },
      'Formed from points of light.',
      { family: 'Fraunces', weight: 600, size: 0.62, color: STAR, glow: 1.8 },
    ),
    textNode(
      {
        id: 'con-dek',
        hub: HUB,
        caption: 'Dek — the studio one-liner.',
        x: 0,
        y: 1.45,
        z: 0.3,
        w: 9,
        h: 0.4,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })],
      },
      'A small studio. A long orbit. Work that holds together.',
      { family: 'JetBrains Mono', weight: 400, size: 0.18, color: '#aebfe4', glow: 1.3 },
    ),
    // The four values pinned at net vertices.
    valueNode('con-val-craft', 'Craft', -4.4, -0.4, 6.5),
    valueNode('con-val-candor', 'Candor', -1.5, -1.3, 7.5),
    valueNode('con-val-curiosity', 'Curiosity', 1.9, -0.5, 5.8),
    valueNode('con-val-care', 'Care', 4.6, -1.2, 8.2),
    // ── Scroll section: the story + rolled-in stats ──
    textNode(
      {
        id: 'con-story-title',
        hub: HUB,
        caption: 'Story section title.',
        x: 0,
        y: -4.9,
        z: 0.3,
        w: 9,
        h: 0.7,
        bindings: [bind('text-cascade', 'inview', { params: { stagger: 0.035 } })],
      },
      'Twelve years in one sentence',
      { family: 'Fraunces', weight: 600, size: 0.42, color: STAR, glow: 1.6 },
    ),
    textNode(
      {
        id: 'con-story-body',
        hub: HUB,
        caption: 'Story body line.',
        x: 0,
        y: -5.7,
        z: 0.3,
        w: 10,
        h: 0.4,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.015 } })],
      },
      'We kept the team small so the standard could stay tall.',
      { family: 'Fraunces', weight: 400, size: 0.24, color: '#cfdbf4', glow: 1.4 },
    ),
    // Stats band — mono numerals rolling up on entry.
    textNode(
      {
        id: 'con-stat-years',
        hub: HUB,
        caption: 'Stat — years, counter-rolls on in-view.',
        x: -3.6,
        y: -7,
        z: 0.3,
        w: 2.6,
        h: 0.8,
        bindings: [bind('text-counter-roll', 'inview', {})],
      },
      '12 YEARS',
      { family: 'JetBrains Mono', weight: 400, size: 0.34, color: GLOW, glow: 2.1, reveal: false },
    ),
    textNode(
      {
        id: 'con-stat-hands',
        hub: HUB,
        caption: 'Stat — hands, counter-rolls on in-view.',
        x: 0,
        y: -7,
        z: 0.3,
        w: 2.6,
        h: 0.8,
        bindings: [bind('text-counter-roll', 'inview', {})],
      },
      '40 HANDS',
      { family: 'JetBrains Mono', weight: 400, size: 0.34, color: GLOW, glow: 2.1, reveal: false },
    ),
    textNode(
      {
        id: 'con-stat-promise',
        hub: HUB,
        caption: 'Stat — one promise.',
        x: 3.6,
        y: -7,
        z: 0.3,
        w: 2.6,
        h: 0.8,
        bindings: [bind('text-counter-roll', 'inview', {})],
      },
      '1 PROMISE',
      { family: 'JetBrains Mono', weight: 400, size: 0.34, color: GLOW, glow: 2.1, reveal: false },
    ),
  ],
  edges: [],
};
