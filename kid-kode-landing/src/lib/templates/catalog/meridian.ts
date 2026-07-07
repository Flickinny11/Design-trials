// W-TPL hub template - "Meridian" (landing / layered-photo-parallax-hero).
//
// A photographic diorama landing hero assembled from OUR generated plates
// (public/prism-mock/photo/meridian-hero - FLUX backdrop + bria cutouts + depth
// + shadow plate + teal grade; provenance in composite.json). The family's
// signature moves are composed from real graph nodes (DEV-6): a luminous teal
// backdrop held far back, a colossal headline routed BEHIND the flacon, the
// flacon cutout forward with its detached soft shadow, and a garnish swarm at
// varied depth/scale - every plane parallaxing at its own rate on the pointer.
// Single-hue teal discipline throughout.
//
// Route decision (planner): interaction=parallax, realism=photoreal,
// byteBudget=moderate, motion=ambient, source=photo R2 (photo plates).

import type { GraphSource } from '@/lib/prism-graph/types';
import {
  bind,
  imageNode,
  meshNode,
  templateHub,
  textNode,
} from '../catalog-helpers';

const HUB = 'meridian';
const A = '/prism-mock/photo/meridian-hero';
const TEAL = '#2fb7c9';
const MIST = '#bfe3e9';
const INK = '#04070a';

export const meridianGraph: GraphSource = {
  hubs: [
    templateHub({
      hubId: HUB,
      title: 'Meridian - Layered Photo Hero',
      caption: 'A photographic diorama landing page in a single teal hue.',
      backgroundColor: INK,
      cursor: { style: 'ring', magnetic: true, accent: TEAL },
      transitionPreset: { kind: 'veil' },
      contentHeight: 2400,
      // Hub-owned ambience/backdrop (galaxy law: backgrounds are hub DATA,
      // never first-class nodes). The luminous teal stage plate is a parallax
      // background layer; the inter-plane dust is a camera-locked mote field.
      background: [
        {
          id: 'mer-bg-plate',
          attachment: 'parallax',
          sourceUrl: `${A}/backdrop.png`,
          z: -3.2,
          parallaxDepth: 0.12,
          opacity: 1,
        },
        {
          id: 'mer-bg-motes',
          attachment: 'camera-locked',
          kind: 'particle-field',
          z: -30,
          opacity: 0.8,
          parallaxDepth: 0.1,
          params: { palette: 'ice', density: 0.4, drift: 0.4, intensity: 0.55, variant: 'motes' },
        },
      ],
    }),
  ],
  nodes: [
    // ── The diorama: occluded headline shadow flacon garnish ──
    // (Backdrop plate + atmospheric dust live on hub.background above.)
    // Colossal headline routed BEHIND the flacon (the family's occlusion move).
    textNode(
      {
        id: 'mer-headline',
        hub: HUB,
        caption: 'Colossal headline - occluded by the flacon.',
        x: -0.6,
        y: 1.2,
        z: -1,
        w: 13,
        h: 2,
      },
      'MERIDIAN',
      { family: 'Fraunces', weight: 600, size: 1.35, color: '#eaf6f8', glow: 2.3 },
    ),
    // Detached soft shadow plate under the flacon (photoreal grounding).
    imageNode(
      {
        id: 'mer-shadow',
        hub: HUB,
        caption: 'Detached soft shadow plate - grounds the flacon.',
        x: 2.7,
        y: -2.5,
        z: -0.4,
        w: 5,
        h: 2.2,
        bindings: [bind('parallax', 'pointer', { params: { strength: 0.3 } })],
      },
      `${A}/product.shadow.png`,
      false,
    ),
    // The flacon cutout, forward - floats + parallaxes fastest (nearest).
    imageNode(
      {
        id: 'mer-flacon',
        hub: HUB,
        caption: 'Handblown teal flacon cutout - floats, forward parallax.',
        x: 2.7,
        y: -0.1,
        z: 0.5,
        w: 5.2,
        h: 6.6,
        bindings: [
          bind('float', 'time', { params: { amplitude: 0.05, periodSec: 7 } }),
          bind('parallax', 'pointer', { params: { strength: 0.55 } }),
        ],
      },
      `${A}/product.png`,
      false,
    ),
    // Garnish swarm at varied depth/scale.
    imageNode(
      {
        id: 'mer-garnish-sprig',
        hub: HUB,
        caption: 'Eucalyptus sprig cutout - mid depth, slow float.',
        x: -3.6,
        y: 1.9,
        z: -0.2,
        w: 2.6,
        h: 2.6,
        bindings: [
          bind('float', 'time', { params: { amplitude: 0.07, periodSec: 8 } }),
          bind('parallax', 'pointer', { params: { strength: 0.28 } }),
        ],
      },
      `${A}/garnish-sprig.png`,
      false,
    ),
    imageNode(
      {
        id: 'mer-garnish-seaglass',
        hub: HUB,
        caption: 'Sea-glass pebble cutout - near, faster parallax.',
        x: -1.6,
        y: -2.7,
        z: 0.6,
        w: 1.5,
        h: 1.5,
        bindings: [
          bind('float', 'time', { params: { amplitude: 0.09, periodSec: 5.5 } }),
          bind('parallax', 'pointer', { params: { strength: 0.5 } }),
        ],
      },
      `${A}/garnish-seaglass.png`,
      false,
    ),
    imageNode(
      {
        id: 'mer-garnish-droplet',
        hub: HUB,
        caption: 'Water droplet cutout - nearest, strongest parallax.',
        x: 5.4,
        y: 2.4,
        z: 0.7,
        w: 1.2,
        h: 1.2,
        bindings: [
          bind('float', 'time', { params: { amplitude: 0.1, periodSec: 5 } }),
          bind('parallax', 'pointer', { params: { strength: 0.6 } }),
        ],
      },
      `${A}/garnish-droplet.png`,
      false,
    ),
    // ── Brand voice ──
    textNode(
      {
        id: 'mer-brand',
        hub: HUB,
        caption: 'Brand wordmark line.',
        x: -4.9,
        y: 3.65,
        z: 0.3,
        w: 4,
        h: 0.4,
      },
      'Meridian Atelier',
      { family: 'Fraunces', weight: 400, size: 0.2, color: MIST, align: 'left', glow: 2, reveal: false },
    ),
    textNode(
      {
        id: 'mer-manifesto',
        hub: HUB,
        caption: 'Manifesto line - fades up on in-view.',
        x: -3.35,
        y: -1.7,
        z: 0.4,
        w: 6.4,
        h: 0.6,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.03 } })],
      },
      'A scent formed where day meets sea.',
      { family: 'Fraunces', weight: 400, size: 0.3, color: '#e8f4f6', align: 'left', glow: 2.3 },
    ),
    textNode(
      {
        id: 'mer-cta',
        hub: HUB,
        caption: 'CTA - magnetic hover with lift.',
        x: -4.05,
        y: -2.5,
        z: 0.5,
        w: 3.4,
        h: 0.4,
        bindings: [
          bind('magnetic', 'pointer', { params: { strength: 0.5 } }),
          bind('hover-lift', 'pointer', {}),
        ],
      },
      'DISCOVER THE FIRST POUR',
      { family: 'JetBrains Mono', weight: 400, size: 0.17, color: '#f2fbfc', align: 'left', glow: 2.3, reveal: false },
    ),
    meshNode(
      {
        id: 'mer-cta-bar',
        hub: HUB,
        caption: 'CTA underline bar.',
        x: -4.05,
        y: -2.78,
        z: 0.45,
        w: 3.2,
        h: 0.05,
      },
      { kind: 'cube', params: { width: 3.2, height: 0.05, depth: 0.04 } },
      { baseColor: TEAL, metalness: 0.55, roughness: 0.5, emissive: TEAL, emissiveIntensity: 0.3 },
    ),
    textNode(
      {
        id: 'mer-scroll-cue',
        hub: HUB,
        caption: 'Scroll cue - slow pulse.',
        x: 0,
        y: -3.85,
        z: 0.4,
        w: 2,
        h: 0.3,
        bindings: [bind('fade-pulse', 'time', { params: { period: 2.6 } })],
      },
      'SCROLL',
      { family: 'JetBrains Mono', weight: 400, size: 0.13, color: '#9fd4dc', glow: 2.3, reveal: false },
    ),
    // ── Section 2: ingredient notes (cascade in as they enter view) ──
    textNode(
      {
        id: 'mer-notes-title',
        hub: HUB,
        caption: 'Notes section title.',
        x: 0,
        y: -5.6,
        z: 0.3,
        w: 8,
        h: 0.8,
        bindings: [bind('text-cascade', 'inview', { params: { stagger: 0.04 } })],
      },
      'Three notes. One line of light.',
      { family: 'Fraunces', weight: 600, size: 0.44, color: '#eef8f9', glow: 2.3 },
    ),
    textNode(
      {
        id: 'mer-note-1',
        hub: HUB,
        caption: 'Note - eucalyptus.',
        x: -4.2,
        y: -7,
        z: 0.3,
        w: 3.4,
        h: 0.5,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })],
      },
      'Eucalyptus, cut at dawn',
      { family: 'Fraunces', weight: 400, size: 0.22, color: MIST, glow: 2.2 },
    ),
    textNode(
      {
        id: 'mer-note-2',
        hub: HUB,
        caption: 'Note - sea glass.',
        x: 0,
        y: -7.5,
        z: 0.3,
        w: 3.4,
        h: 0.5,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })],
      },
      'Sea glass, tide-worn',
      { family: 'Fraunces', weight: 400, size: 0.22, color: MIST, glow: 2.2 },
    ),
    textNode(
      {
        id: 'mer-note-3',
        hub: HUB,
        caption: 'Note - rain.',
        x: 4.2,
        y: -8,
        z: 0.3,
        w: 3.4,
        h: 0.5,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })],
      },
      'Rain, held mid-fall',
      { family: 'Fraunces', weight: 400, size: 0.22, color: MIST, glow: 2.2 },
    ),
    // Reused garnish cutouts as floating accents flanking the notes.
    imageNode(
      {
        id: 'mer-accent-sprig',
        hub: HUB,
        caption: 'Eucalyptus cutout accent - slow float + cursor parallax.',
        x: -5.6,
        y: -6.6,
        z: -0.3,
        w: 1.7,
        h: 1.7,
        bindings: [
          bind('float', 'time', { params: { amplitude: 0.07, periodSec: 7 } }),
          bind('parallax', 'pointer', { params: { strength: 0.3 } }),
        ],
      },
      `${A}/garnish-sprig.png`,
      false,
    ),
    imageNode(
      {
        id: 'mer-accent-droplet',
        hub: HUB,
        caption: 'Droplet cutout accent - slow float, faster parallax (nearer).',
        x: 5.5,
        y: -7.4,
        z: 0.6,
        w: 1.1,
        h: 1.1,
        bindings: [
          bind('float', 'time', { params: { amplitude: 0.09, periodSec: 5 } }),
          bind('parallax', 'pointer', { params: { strength: 0.5 } }),
        ],
      },
      `${A}/garnish-droplet.png`,
      false,
    ),
  ],
  edges: [],
};
