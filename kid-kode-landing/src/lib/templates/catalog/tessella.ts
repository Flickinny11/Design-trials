// W-TPL hub template — "Tessella" (marketing · bento-grid-slider).
//
// The bento grammar as a MARKETING feature wall (distinct from Abacus's pricing
// use of the same family, different archetype — anti-repetition holds): mixed-
// span tiles, some carrying a generated feature image, some asset-free PBR
// slabs whose material IS the accent. Tiles rise staggered on entry and lift to
// the pointer; a keystone hero tile anchors the top-left. Shallow depth keeps
// the 3D read premium without the perspective excess (DEV-4).
//
// Route decision (planner): interaction=parallax/hover, realism=high (PBR +
// generated tile imagery), byteBudget=moderate, motion=ambient, source=mixed →
// R2 for the imagery tiles, R1 for the material slabs.

import type { GraphSource, PrismNode } from '@/lib/prism-graph/types';
import { bind, imageNode, meshNode, templateHub, textNode } from '../catalog-helpers';

const HUB = 'tessella';
const A = '/prism-mock/templates/tessella';
const MINT = '#38e0b0';
const PAPER = '#e7efee';
const INK = '#0b0e12';

const rise = () => bind('spring-arrive', 'inview', {});
const lift = () => bind('hover-lift', 'pointer', {});

export const tessellaGraph: GraphSource = {
  hubs: [
    templateHub({
      hubId: HUB,
      title: 'Tessella — Bento Feature Wall',
      caption: 'A marketing grid where every tile earns its span.',
      backgroundColor: INK,
      cursor: { style: 'ring', magnetic: true, accent: MINT },
      transitionPreset: { kind: 'wipe' },
      contentHeight: 2200,
    }),
  ],
  nodes: [
    textNode(
      {
        id: 'tes-title',
        hub: HUB,
        caption: 'Marketing headline.',
        x: 0,
        y: 3.5,
        z: 0.2,
        w: 11,
        h: 0.9,
      },
      'Everything, arranged.',
      { family: 'Fraunces', weight: 600, size: 0.56, color: PAPER, glow: 1.7 },
    ),
    textNode(
      {
        id: 'tes-sub',
        hub: HUB,
        caption: 'Marketing dek.',
        x: 0,
        y: 2.72,
        z: 0.2,
        w: 8,
        h: 0.35,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })],
      },
      'One board. Every capability, sized to how much it matters.',
      { family: 'JetBrains Mono', weight: 400, size: 0.16, color: '#a7c4bd', glow: 1.2 },
    ),
    // Keystone image tile — the biggest span, top-left, carries the flagship shot.
    imageNode(
      {
        id: 'tes-tile-hero',
        hub: HUB,
        caption: 'Keystone feature tile — generated flagship image.',
        x: -3.1,
        y: 0.55,
        z: 0,
        w: 5.2,
        h: 3.4,
        bindings: [rise(), lift(), bind('parallax', 'pointer', { params: { strength: 0.25 } })],
      },
      `${A}/tile-1.webp`,
    ),
    // Two stacked image tiles, right column.
    imageNode(
      {
        id: 'tes-tile-b',
        hub: HUB,
        caption: 'Feature tile B — generated image.',
        x: 1.7,
        y: 1.55,
        z: 0,
        w: 4.4,
        h: 1.5,
        bindings: [rise(), lift(), bind('parallax', 'pointer', { params: { strength: 0.35 } })],
      },
      `${A}/tile-2.webp`,
    ),
    imageNode(
      {
        id: 'tes-tile-c',
        hub: HUB,
        caption: 'Feature tile C — generated image.',
        x: 4.35,
        y: 1.55,
        z: 0,
        w: 1.9,
        h: 1.5,
        bindings: [rise(), lift()],
      },
      `${A}/tile-3.webp`,
    ),
    // Asset-free PBR accent slab — the material IS the accent (mint glass).
    meshNode(
      {
        id: 'tes-slab-accent',
        hub: HUB,
        caption: 'Mint glass accent slab — material carries the brand colour.',
        x: 2.55,
        y: -0.55,
        z: 0,
        w: 3.2,
        h: 1.6,
        bindings: [rise(), lift()],
      },
      { kind: 'cube', params: { width: 3.2, height: 1.6, depth: 0.14 } },
      { baseColor: '#0e2b25', metalness: 0.25, roughness: 0.14, clearcoat: 0.9, emissive: MINT, emissiveIntensity: 0.35, envMapIntensity: 1.1 },
    ),
    // Copy tile over the accent slab.
    textNode(
      {
        id: 'tes-slab-copy',
        hub: HUB,
        caption: 'Accent-slab feature copy.',
        x: 2.55,
        y: -0.55,
        z: 0.3,
        w: 3,
        h: 0.7,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })],
      },
      'Ships in a day, not a quarter.',
      { family: 'Fraunces', weight: 600, size: 0.22, color: PAPER, glow: 1.5, reveal: false },
    ),
    // Dark utility slabs, bottom row — three even spans, mono labels.
    ...(
      [
        { id: 'sla', x: -3.6, label: 'Version history' },
        { id: 'slb', x: 0, label: 'Export anytime' },
        { id: 'slc', x: 3.6, label: 'Humans on support' },
      ] as const
    ).flatMap((t): PrismNode[] => [
      meshNode(
        {
          id: `tes-${t.id}`,
          hub: HUB,
          caption: `Utility tile — ${t.label}.`,
          x: t.x,
          y: -2.55,
          z: 0,
          w: 3.3,
          h: 1.2,
          bindings: [rise(), lift()],
        },
        { kind: 'cube', params: { width: 3.3, height: 1.2, depth: 0.1 } },
        { baseColor: '#14171d', metalness: 0.3, roughness: 0.45, clearcoat: 0.5, envMapIntensity: 0.9 },
      ),
      textNode(
        {
          id: `tes-${t.id}-t`,
          hub: HUB,
          caption: `Utility label — ${t.label}.`,
          x: t.x,
          y: -2.55,
          z: 0.25,
          w: 3,
          h: 0.3,
          bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })],
        },
        t.label,
        { family: 'JetBrains Mono', weight: 400, size: 0.15, color: '#cfe6df', glow: 1.3 },
      ),
    ]),
  ],
  edges: [],
};
