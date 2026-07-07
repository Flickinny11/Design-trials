// W-TPL hub template - "Cascade" (marketing / parallax-zoom-deep-dive).
//
// The family's core move (corpus summary): slide advances FLY THE CAMERA
// FORWARD - foreground occluders separate and rush past while distant layers
// hold, so every scroll reads as a dolly-through, travelling DEEPER into the
// world. Cascade builds the single-hub form (DEV-3): a deep generated backdrop
// that holds, two arch cutouts that rush the viewer past as they scroll, and a
// marketing narrative that arrives chapter by chapter as the dive advances.
//
// Route decision (planner): interaction=parallax/scroll, realism=photoreal
// (generated arches + deep backdrop), byteBudget=moderate, motion=cinematic,
// source=photo R2 (composite plates).

import type { GraphSource } from '@/lib/prism-graph/types';
import { bind, imageNode, templateHub, textNode } from '../catalog-helpers';

const HUB = 'cascade';
const A = '/prism-mock/templates/cascade';
const AMBER = '#d98a3d';
const HAZE = '#cfe0e6';
const INK = '#081015';

export const cascadeGraph: GraphSource = {
  hubs: [
    templateHub({
      hubId: HUB,
      title: 'Cascade - Parallax Deep-Dive',
      caption: 'A marketing page you fall forward through, chapter by chapter.',
      backgroundColor: INK,
      cursor: { style: 'ring', magnetic: true, accent: AMBER },
      transitionPreset: { kind: 'dissolve' },
      contentHeight: 2600,
    }),
  ],
  nodes: [
    // The deep backdrop - held far back, drifts only slightly to the pointer so
    // the near planes read as rushing past it (the dolly tell).
    imageNode(
      {
        id: 'cas-backdrop',
        hub: HUB,
        caption: 'Deep valley backdrop - holds far, slow pointer parallax.',
        x: 0,
        y: 0,
        z: -3.2,
        w: 18,
        h: 10.5,
        bindings: [bind('parallax', 'pointer', { params: { strength: 0.12 } })],
      },
      `${A}/deep-backdrop.webp`,
    ),
    // Mid arch - separates and dollies forward on scroll.
    imageNode(
      {
        id: 'cas-arch-mid',
        hub: HUB,
        caption: 'Mid archway - dollies forward on scroll, occludes the deep.',
        x: 1.4,
        y: -0.2,
        z: -1.1,
        w: 8,
        h: 9,
        bindings: [
          bind('scroll-depth-dolly', 'scroll', { params: { depth: 2.4 } }),
          bind('parallax', 'pointer', { params: { strength: 0.3 } }),
        ],
      },
      `${A}/arch-2.cut.png`,
      false,
    ),
    // Near arch - rushes past fastest, the strongest sense of travel.
    imageNode(
      {
        id: 'cas-arch-near',
        hub: HUB,
        caption: 'Near archway - rushes past, strongest dolly.',
        x: -2.2,
        y: 0.1,
        z: 0.4,
        w: 7,
        h: 9.5,
        bindings: [
          bind('scroll-depth-dolly', 'scroll', { params: { depth: 4.2 } }),
          bind('parallax', 'pointer', { params: { strength: 0.55 } }),
        ],
      },
      `${A}/arch-1.cut.png`,
      false,
    ),
    // Chapter I - the hero claim, floating over the mouth of the arch.
    textNode(
      {
        id: 'cas-h1',
        hub: HUB,
        caption: 'Hero headline - kinetic reveal.',
        x: 0,
        y: 2.2,
        z: 0.9,
        w: 11,
        h: 1.1,
      },
      'Go deeper than a scroll.',
      { family: 'Fraunces', weight: 600, size: 0.6, color: '#f4ede1', glow: 2.3 },
    ),
    textNode(
      {
        id: 'cas-dek',
        hub: HUB,
        caption: 'Hero dek.',
        x: 0,
        y: 1.35,
        z: 0.9,
        w: 9,
        h: 0.4,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })],
      },
      'Each screen is a place, not a paragraph.',
      { family: 'JetBrains Mono', weight: 400, size: 0.18, color: HAZE, glow: 2 },
    ),
    textNode(
      {
        id: 'cas-scroll-cue',
        hub: HUB,
        caption: 'Scroll cue - pulse.',
        x: 0,
        y: -3.9,
        z: 0.9,
        w: 4,
        h: 0.3,
        bindings: [bind('fade-pulse', 'time', { params: { period: 2.6 } })],
      },
      'FALL FORWARD',
      { family: 'JetBrains Mono', weight: 400, size: 0.14, color: AMBER, glow: 2.3, reveal: false },
    ),
    // Chapter II - the value, arriving as the second place resolves.
    textNode(
      {
        id: 'cas-c2-title',
        hub: HUB,
        caption: 'Chapter II title - cascade reveal.',
        x: -3.4,
        y: -5.4,
        z: 0.6,
        w: 8,
        h: 0.8,
        bindings: [bind('text-cascade', 'inview', { params: { stagger: 0.04 } })],
      },
      'The product, in situ.',
      { family: 'Fraunces', weight: 600, size: 0.46, color: '#f0e7db', glow: 2.3 },
    ),
    textNode(
      {
        id: 'cas-c2-body',
        hub: HUB,
        caption: 'Chapter II body.',
        x: -3.4,
        y: -6.3,
        z: 0.6,
        w: 7.4,
        h: 0.9,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.015 } })],
      },
      'We drop you inside the world your product lives in - then let the story pull you through it.',
      { family: 'Fraunces', weight: 400, size: 0.22, color: HAZE, glow: 2.2 },
    ),
    // Chapter III - the CTA at the deepest point.
    textNode(
      {
        id: 'cas-cta',
        hub: HUB,
        caption: 'CTA - magnetic pull at the base of the dive.',
        x: 0,
        y: -8.2,
        z: 0.9,
        w: 6,
        h: 0.5,
        bindings: [
          bind('magnetic', 'pointer', { params: { strength: 0.55 } }),
          bind('hover-lift', 'pointer', {}),
        ],
      },
      'BEGIN THE DESCENT',
      { family: 'JetBrains Mono', weight: 400, size: 0.2, color: AMBER, glow: 2.3, reveal: false },
    ),
  ],
  edges: [],
};
