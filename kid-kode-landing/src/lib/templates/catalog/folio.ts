// W-TPL hub template - "Folio" (editorial / oversized-type-editorial).
//
// The oversized-type grammar again, but a different archetype than Chronicle
// (anti-repetition holds) and a different composition: Folio is a magazine
// COVER - a colossal masthead word as a plate that a full-bleed cover photo
// sits behind and a small detail plate inlays into, with the bimodal giant /
// tiny type rhythm (issue line, standfirst, contributor label). Bold vermillion
// editorial register.
//
// Route decision (planner): interaction=scroll reveal, realism=photoreal (cover
// + detail plates), byteBudget=tight, motion=ambient, source=photo R2; the
// masthead is native extruded type.

import type { GraphSource } from '@/lib/prism-graph/types';
import { bind, imageNode, templateHub, textNode } from '../catalog-helpers';

const HUB = 'folio';
const A = '/prism-mock/templates/folio';
const VERMILLION = '#e2402f';
const PAPER = '#f2ede3';
const INK = '#0a0a0a';

export const folioGraph: GraphSource = {
  hubs: [
    templateHub({
      hubId: HUB,
      title: 'Folio - Editorial Cover',
      caption: 'A masthead word big enough to be the artwork.',
      backgroundColor: INK,
      cursor: { style: 'dot', magnetic: false, accent: VERMILLION },
      transitionPreset: { kind: 'wipe' },
      contentHeight: 2300,
    }),
  ],
  nodes: [
    // Full-bleed cover photo - sits behind the masthead plate.
    imageNode(
      {
        id: 'fol-cover',
        hub: HUB,
        caption: 'Full-bleed cover photograph - slow pointer parallax.',
        x: 0.5,
        y: 0.6,
        z: -1.2,
        w: 13,
        h: 9.5,
        bindings: [bind('parallax', 'pointer', { params: { strength: 0.16 } })],
      },
      `${A}/cover-plate.webp`,
    ),
    // The colossal masthead - the plate.
    textNode(
      {
        id: 'fol-masthead',
        hub: HUB,
        caption: 'Colossal masthead word - the plate.',
        x: 0,
        y: 2.3,
        z: 0.5,
        w: 13,
        h: 2.4,
      },
      'FOLIO',
      { family: 'Fraunces', weight: 600, size: 1.55, color: PAPER, glow: 2.3 },
    ),
    textNode(
      {
        id: 'fol-issue',
        hub: HUB,
        caption: 'Tiny issue line.',
        x: -4.6,
        y: 3.75,
        z: 0.6,
        w: 5,
        h: 0.3,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })],
      },
      'ISSUE 14 - THE QUIET MACHINES',
      { family: 'JetBrains Mono', weight: 400, size: 0.13, color: VERMILLION, glow: 2.3, reveal: false },
    ),
    // Standfirst - the giant/tiny rhythm's mid note.
    textNode(
      {
        id: 'fol-standfirst',
        hub: HUB,
        caption: 'Cover standfirst.',
        x: -3.4,
        y: -2.4,
        z: 0.5,
        w: 7.2,
        h: 1,
        bindings: [bind('text-cascade', 'inview', { params: { stagger: 0.03 } })],
      },
      'A field guide to the tools that disappear when they work.',
      { family: 'Fraunces', weight: 400, size: 0.3, color: PAPER, glow: 2.3 },
    ),
    // Detail plate inlaid lower-right, with a museum caption.
    imageNode(
      {
        id: 'fol-detail',
        hub: HUB,
        caption: 'Inlaid detail plate - floats.',
        x: 3.8,
        y: -3,
        z: 0.3,
        w: 4,
        h: 3,
        bindings: [
          bind('float', 'time', { params: { amplitude: 0.05, periodSec: 7 } }),
          bind('parallax', 'pointer', { params: { strength: 0.32 } }),
        ],
      },
      `${A}/detail-plate.webp`,
    ),
    textNode(
      {
        id: 'fol-caption',
        hub: HUB,
        caption: 'Detail caption - tiny.',
        x: 3.8,
        y: -4.75,
        z: 0.5,
        w: 4.4,
        h: 0.3,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })],
      },
      'PLATE 07 - DETAIL, WORKSHOP FLOOR',
      { family: 'JetBrains Mono', weight: 400, size: 0.12, color: '#c8c0b2', glow: 1.9, reveal: false },
    ),
    // Contributor / CTA line.
    textNode(
      {
        id: 'fol-cta',
        hub: HUB,
        caption: 'Read-the-issue CTA - magnetic.',
        x: -3.4,
        y: -3.5,
        z: 0.5,
        w: 6,
        h: 0.4,
        bindings: [bind('magnetic', 'pointer', { params: { strength: 0.5 } })],
      },
      'OPEN THE ISSUE',
      { family: 'JetBrains Mono', weight: 400, size: 0.16, color: VERMILLION, glow: 2.3, reveal: false },
    ),
  ],
  edges: [],
};
