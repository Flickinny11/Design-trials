// W-TPL hub template — "Beacon" (contact · hover-morph-distortion).
//
// The family (corpus): a shader-driven liquid warp liquefies the hero
// photograph under the cursor — displacement trails the pointer with viscous
// follow; the LAYOUT never moves; type and subject cutouts stay razor-sharp.
// Beacon is a contact page: a maritime sky plate that liquefies where the
// cursor passes (hover-liquid-distort — the runtime's mountable displacement
// primitive, DEV-2), a lighthouse cutout that stays sharp above the warp, and
// the ways-to-reach-us held in still, legible type.
//
// Route decision (planner): interaction=hover-warp, realism=photoreal, byte
// budget=moderate, motion=pointer-reactive, source=photo → R2.

import type { GraphSource } from '@/lib/prism-graph/types';
import { bind, imageNode, templateHub, textNode } from '../catalog-helpers';

const HUB = 'beacon';
const A = '/prism-mock/templates/beacon';
const BEAM = '#ffd66b';
const MIST = '#cdd8e6';
const NAVY = '#060a14';

export const beaconGraph: GraphSource = {
  hubs: [
    templateHub({
      hubId: HUB,
      title: 'Beacon — Hover-Morph Contact',
      caption: 'A contact page whose sky liquefies where you touch it.',
      backgroundColor: NAVY,
      cursor: { style: 'beam', magnetic: true, accent: BEAM },
      transitionPreset: { kind: 'veil' },
      contentHeight: 1900,
    }),
  ],
  nodes: [
    // The warping hero: the sky plate liquefies under the cursor, viscous follow.
    imageNode(
      {
        id: 'bea-sky',
        hub: HUB,
        caption: 'Maritime sky plate — liquefies under the cursor (hover-morph).',
        x: 0,
        y: 0.4,
        z: -1.4,
        w: 17,
        h: 10,
        bindings: [bind('hover-liquid-distort', 'pointer', { params: { strength: 0.6, viscosity: 0.85 } })],
      },
      `${A}/sky-plate.webp`,
    ),
    // The lighthouse cutout — stays razor-sharp above the warp; only a slow float.
    imageNode(
      {
        id: 'bea-lighthouse',
        hub: HUB,
        caption: 'Lighthouse cutout — sharp above the liquefying sky.',
        x: 3.9,
        y: -0.4,
        z: 0.5,
        w: 5,
        h: 7.5,
        bindings: [
          bind('float', 'time', { params: { amplitude: 0.05, periodSec: 8 } }),
          bind('parallax', 'pointer', { params: { strength: 0.18 } }),
        ],
      },
      `${A}/lighthouse.cut.png`,
      false,
    ),
    // Headline — razor sharp, the layout never moves (family invariant).
    textNode(
      {
        id: 'bea-h1',
        hub: HUB,
        caption: 'Contact headline — sharp.',
        x: -3.1,
        y: 2.5,
        z: 0.8,
        w: 9,
        h: 1.1,
      },
      'Signal us.',
      { family: 'Fraunces', weight: 600, size: 0.66, color: '#f6f1e4', glow: 1.8 },
    ),
    textNode(
      {
        id: 'bea-dek',
        hub: HUB,
        caption: 'Contact dek.',
        x: -3.1,
        y: 1.7,
        z: 0.8,
        w: 7.6,
        h: 0.4,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })],
      },
      'Drag the horizon. Then tell us what you are building.',
      { family: 'JetBrains Mono', weight: 400, size: 0.16, color: MIST, glow: 1.2 },
    ),
    // Ways to reach — still, legible; each magnetic on hover.
    ...(
      [
        { id: 'mail', y: -0.1, label: 'hello@beacon.studio', tag: 'EMAIL' },
        { id: 'studio', y: -1.05, label: 'Pier 9, Harbour West', tag: 'STUDIO' },
        { id: 'call', y: -2, label: '+1 (555) 018-2244', tag: 'DIRECT' },
      ] as const
    ).flatMap((r) => [
      textNode(
        {
          id: `bea-${r.id}-tag`,
          hub: HUB,
          caption: `${r.tag} label.`,
          x: -5.2,
          y: r.y,
          z: 0.8,
          w: 2,
          h: 0.3,
          bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })],
        },
        r.tag,
        { family: 'JetBrains Mono', weight: 400, size: 0.12, color: BEAM, glow: 1.6, reveal: false },
      ),
      textNode(
        {
          id: `bea-${r.id}-val`,
          hub: HUB,
          caption: `${r.tag} value — magnetic on hover.`,
          x: -1.9,
          y: r.y,
          z: 0.8,
          w: 6,
          h: 0.4,
          bindings: [bind('magnetic', 'pointer', { params: { strength: 0.4 } })],
        },
        r.label,
        { family: 'Fraunces', weight: 400, size: 0.24, color: '#eef3f8', glow: 1.3, reveal: false },
      ),
    ]),
    // CTA.
    textNode(
      {
        id: 'bea-cta',
        hub: HUB,
        caption: 'Contact CTA — magnetic + lift.',
        x: -3.1,
        y: -3.3,
        z: 0.9,
        w: 6,
        h: 0.5,
        bindings: [
          bind('magnetic', 'pointer', { params: { strength: 0.6 } }),
          bind('hover-lift', 'pointer', {}),
        ],
      },
      'START A PROJECT →',
      { family: 'JetBrains Mono', weight: 400, size: 0.2, color: BEAM, glow: 2.2, reveal: false },
    ),
  ],
  edges: [],
};
