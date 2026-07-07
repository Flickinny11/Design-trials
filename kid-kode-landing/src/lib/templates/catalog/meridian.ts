// W-TPL hub template — "Meridian" (landing · layered-photo-parallax-hero).
//
// The R2 flagship: a photographic diorama hero assembled from OUR generated
// plates (public/prism-mock/photo/meridian-hero — FLUX → bria cutout → depth →
// shadow plate → teal grade; provenance in composite.json). The composite
// carries the family's signature moves: headline routed BEHIND the product,
// detached shadow plate, garnish swarm at varied scale/blur, single-hue teal
// rim discipline. Template nodes add the brand voice: manifesto, CTA with a
// glint underline, ingredient notes that cascade in on scroll, and reused
// garnish cutouts as floating accents (differentiated parallax).
//
// Route decision (planner): interaction=parallax, realism=photoreal,
// byteBudget=moderate, motion=ambient, source=photo → R2 (photo composite).

import type { GraphSource } from '@/lib/prism-graph/types';
import {
  bind,
  compositeSceneNode,
  fxNode,
  imageNode,
  meshNode,
  templateHub,
  textNode,
} from '../catalog-helpers';

const HUB = 'meridian';
const TEAL = '#2fb7c9';
const MIST = '#bfe3e9';
const INK = '#04070a';

export const meridianGraph: GraphSource = {
  hubs: [
    templateHub({
      hubId: HUB,
      title: 'Meridian — Layered Photo Hero',
      caption: 'A photographic diorama landing page in a single teal hue.',
      backgroundColor: INK,
      cursor: { style: 'ring', magnetic: true, accent: TEAL },
      transitionPreset: { kind: 'veil' },
      contentHeight: 2400,
    }),
  ],
  nodes: [
    // The R2 diorama — backdrop, occluded headline, cutout product, detached
    // shadow, garnish swarm — parallaxing per layer on scroll.
    compositeSceneNode(
      {
        id: 'mer-hero-composite',
        hub: HUB,
        caption: 'Layered-photo hero diorama — per-plane parallax, teal rim.',
        x: 0,
        y: 0.1,
        z: -0.5,
        w: 15,
        h: 9,
      },
      '/prism-mock/photo/meridian-hero/composite.json',
      { parallaxDepth: 1.35, floatAmount: 1, driftSpeed: 0.3 },
    ),
    // Fine atmospheric dust between the plates — hides seams, adds air.
    fxNode({
      id: 'mer-dust',
      hub: HUB,
      caption: 'Atmospheric dust motes between the photo planes.',
      x: 0,
      y: 0,
      z: -1.2,
      w: 13,
      h: 8,
      bindings: [bind('dust-particles', 'time', { params: { density: 0.5 } })],
    }),
    // Brand voice, upper left — small serif wordmark line.
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
      { family: 'Fraunces', weight: 400, size: 0.2, color: MIST, align: 'left', glow: 1.2, reveal: false },
    ),
    // Manifesto, lower left — under the diorama's clear zone.
    textNode(
      {
        id: 'mer-manifesto',
        hub: HUB,
        caption: 'Manifesto line — fades up on in-view.',
        x: -3.35,
        y: -1.7,
        z: 0.4,
        w: 6.4,
        h: 0.6,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.03 } })],
      },
      'A scent formed where day meets sea.',
      { family: 'Fraunces', weight: 400, size: 0.3, color: '#e8f4f6', align: 'left', glow: 1.5 },
    ),
    // CTA — data-mono utility, magnetic pull, over a glinting teal bar.
    textNode(
      {
        id: 'mer-cta',
        hub: HUB,
        caption: 'CTA — magnetic hover with lift.',
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
      { family: 'JetBrains Mono', weight: 400, size: 0.17, color: '#f2fbfc', align: 'left', glow: 2.2, reveal: false },
    ),
    meshNode(
      {
        id: 'mer-cta-bar',
        hub: HUB,
        caption: 'CTA underline bar — periodic light sweep.',
        x: -4.05,
        y: -2.78,
        z: 0.45,
        w: 3.2,
        h: 0.05,
        bindings: [bind('light-sweep', 'time', { params: { period: 4 } })],
      },
      { kind: 'cube', params: { width: 3.2, height: 0.05, depth: 0.04 } },
      { baseColor: TEAL, metalness: 0.75, roughness: 0.25, emissive: TEAL, emissiveIntensity: 0.55 },
    ),
    // Scroll cue.
    textNode(
      {
        id: 'mer-scroll-cue',
        hub: HUB,
        caption: 'Scroll cue — slow pulse.',
        x: 0,
        y: -3.85,
        z: 0.4,
        w: 2,
        h: 0.3,
        bindings: [bind('fade-pulse', 'time', { params: { period: 2.6 } })],
      },
      'SCROLL',
      { family: 'JetBrains Mono', weight: 400, size: 0.13, color: '#9fd4dc', glow: 1.4, reveal: false },
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
      { family: 'Fraunces', weight: 600, size: 0.44, color: '#eef8f9', glow: 1.6 },
    ),
    textNode(
      {
        id: 'mer-note-1',
        hub: HUB,
        caption: 'Note — eucalyptus.',
        x: -4.2,
        y: -7,
        z: 0.3,
        w: 3.4,
        h: 0.5,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })],
      },
      'Eucalyptus, cut at dawn',
      { family: 'Fraunces', weight: 400, size: 0.22, color: MIST, glow: 1.3 },
    ),
    textNode(
      {
        id: 'mer-note-2',
        hub: HUB,
        caption: 'Note — sea glass.',
        x: 0,
        y: -7.5,
        z: 0.3,
        w: 3.4,
        h: 0.5,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })],
      },
      'Sea glass, tide-worn',
      { family: 'Fraunces', weight: 400, size: 0.22, color: MIST, glow: 1.3 },
    ),
    textNode(
      {
        id: 'mer-note-3',
        hub: HUB,
        caption: 'Note — rain.',
        x: 4.2,
        y: -8,
        z: 0.3,
        w: 3.4,
        h: 0.5,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })],
      },
      'Rain, held mid-fall',
      { family: 'Fraunces', weight: 400, size: 0.22, color: MIST, glow: 1.3 },
    ),
    // Reused garnish cutouts as floating accents flanking the notes — the
    // plates are already background-free, so they read as objects in air.
    imageNode(
      {
        id: 'mer-accent-sprig',
        hub: HUB,
        caption: 'Eucalyptus cutout accent — slow float + cursor parallax.',
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
      '/prism-mock/photo/meridian-hero/garnish-sprig.png',
      false,
    ),
    imageNode(
      {
        id: 'mer-accent-droplet',
        hub: HUB,
        caption: 'Droplet cutout accent — slow float, faster parallax (nearer).',
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
      '/prism-mock/photo/meridian-hero/garnish-droplet.png',
      false,
    ),
  ],
  edges: [],
};
