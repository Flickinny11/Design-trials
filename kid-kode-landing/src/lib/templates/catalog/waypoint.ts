// W-TPL hub template - "Waypoint" (contact / coverflow-3d-carousel).
//
// The coverflow grammar (corpus): cards travel a perspective arc with real 3D
// rotation - the active card faces flat at centre while flankers tilt away,
// shrink, dim, and step back. Waypoint is a contact page: three ways-to-reach
// laid out as a coverflow deck over a topographic relief map. Distinct cards
// (not one echoed subject - DEV-5), each composed on the arc with a hover lift
// and gentle idle drift so the deck is alive at rest.
//
// Route decision (planner): interaction=hover/parallax, realism=high (relief
// backdrop + PBR cards), byteBudget=moderate, motion=ambient, source=mixed
// R2 backdrop, R1 cards.

import type { GraphSource, PrismNode } from '@/lib/prism-graph/types';
import { bind, imageNode, meshNode, templateHub, textNode } from '../catalog-helpers';

const HUB = 'waypoint';
const A = '/prism-mock/templates/waypoint';
const ORANGE = '#f2794b';
const PAPER = '#eae2d2';
const INK = '#0b1210';

interface CardSpec {
  id: string;
  tag: string;
  value: string;
  x: number;
  z: number;
  rotY: number;
  scale: number;
  period: number;
}

// The perspective arc: centre card flat & forward, flankers tilt + recede.
const CARDS: CardSpec[] = [
  { id: 'studio', tag: 'STUDIO', value: 'Ridge Road 12,\nBoulder CO', x: -3.7, z: -1.1, rotY: 0.5, scale: 0.86, period: 7 },
  { id: 'email', tag: 'EMAIL', value: 'say@waypoint.co', x: 0, z: 0.5, rotY: 0, scale: 1, period: 6 },
  { id: 'social', tag: 'SOCIAL', value: '@waypoint.studio', x: 3.7, z: -1.1, rotY: -0.5, scale: 0.86, period: 8 },
];

function cardNodes(c: CardSpec): PrismNode[] {
  const active = c.id === 'email';
  return [
    meshNode(
      {
        id: `way-card-${c.id}`,
        hub: HUB,
        caption: `Contact card - ${c.tag}; ${active ? 'active, faces flat' : 'flanker, tilted + receded'}.`,
        x: c.x,
        y: 0,
        z: c.z,
        w: 3,
        h: 3.7,
        scale: c.scale,
        rot: [0, c.rotY, 0],
        bindings: [
          bind('spring-arrive', 'inview', {}),
          bind('hover-lift', 'pointer', {}),
          bind('float', 'time', { params: { amplitude: 0.05, periodSec: c.period } }),
        ],
      },
      { kind: 'cube', params: { width: 3, height: 3.7, depth: 0.12 } },
      active
        ? { baseColor: '#161c1a', metalness: 0.3, roughness: 0.5, clearcoat: 0.25, emissive: ORANGE, emissiveIntensity: 0.18, envMapIntensity: 1.1 }
        : { baseColor: '#10130f', metalness: 0.25, roughness: 0.5, clearcoat: 0.25, envMapIntensity: 0.85 },
    ),
    textNode(
      {
        id: `way-tag-${c.id}`,
        hub: HUB,
        caption: `${c.tag} label.`,
        x: c.x,
        y: 1.2 * c.scale,
        z: c.z + 0.3,
        w: 2.6,
        h: 0.3,
        rot: [0, c.rotY, 0],
      },
      c.tag,
      { family: 'JetBrains Mono', weight: 400, size: 0.13, color: ORANGE, glow: 2.3, reveal: false },
    ),
    textNode(
      {
        id: `way-val-${c.id}`,
        hub: HUB,
        caption: `${c.tag} value.`,
        x: c.x,
        y: -0.1 * c.scale,
        z: c.z + 0.3,
        w: 2.7,
        h: 0.9,
        rot: [0, c.rotY, 0],
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })],
      },
      c.value,
      { family: 'Fraunces', weight: active ? 600 : 400, size: 0.22, color: PAPER, glow: 2.2 },
    ),
  ];
}

export const waypointGraph: GraphSource = {
  hubs: [
    templateHub({
      hubId: HUB,
      title: 'Waypoint - Coverflow Contact',
      caption: 'Ways to reach us, dealt like a coverflow deck.',
      backgroundColor: INK,
      cursor: { style: 'ring', magnetic: true, accent: ORANGE },
      transitionPreset: { kind: 'glass-sweep' },
      contentHeight: 1700,
    }),
  ],
  nodes: [
    imageNode(
      {
        id: 'way-relief',
        hub: HUB,
        caption: 'Topographic relief backdrop - slow pointer parallax.',
        x: 0,
        y: -0.3,
        z: -2.6,
        w: 18,
        h: 11,
        bindings: [bind('parallax', 'pointer', { params: { strength: 0.14 } })],
      },
      `${A}/relief-map.webp`,
    ),
    textNode(
      {
        id: 'way-h1',
        hub: HUB,
        caption: 'Contact headline.',
        x: 0,
        y: 3.2,
        z: 0.8,
        w: 11,
        h: 1,
      },
      'Find your way to us.',
      { family: 'Fraunces', weight: 600, size: 0.58, color: '#f4ede0', glow: 2.3 },
    ),
    textNode(
      {
        id: 'way-dek',
        hub: HUB,
        caption: 'Contact dek.',
        x: 0,
        y: 2.42,
        z: 0.8,
        w: 8,
        h: 0.35,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })],
      },
      'Three routes in. Pick the one that suits the day.',
      { family: 'JetBrains Mono', weight: 400, size: 0.16, color: '#b7c4b3', glow: 2 },
    ),
    ...CARDS.flatMap(cardNodes),
    textNode(
      {
        id: 'way-cta',
        hub: HUB,
        caption: 'CTA - magnetic.',
        x: 0,
        y: -3.2,
        z: 0.8,
        w: 6,
        h: 0.45,
        bindings: [bind('magnetic', 'pointer', { params: { strength: 0.55 } })],
      },
      'OR JUST WAVE - WE SEE YOU',
      { family: 'JetBrains Mono', weight: 400, size: 0.16, color: ORANGE, glow: 2.3, reveal: false },
    ),
  ],
  edges: [],
};
