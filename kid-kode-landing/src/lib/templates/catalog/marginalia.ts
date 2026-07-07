// W-TPL hub template — "Marginalia" (editorial · layered-photo, single-plate
// depth form).
//
// The cheapest form of the layered-photo family (DEV / gap report): ONE
// photographic plate plus its depth map on the runtime's parallax-plane
// displacement lane, so the single image gains true parallax depth as it tilts
// to the pointer — no multi-plate composite required. Marginalia is an editorial
// essay: a dawn valley plate holds the stage while the piece's title, byline,
// and margin notes float in the white space around it, the way annotations sit
// in a printed book's margins.
//
// Route decision (planner): interaction=parallax (depth tilt), realism=photoreal,
// byteBudget=tight (one plate + depth), motion=ambient, source=photo → R2 (single-
// plate depth form).

import type { GraphSource } from '@/lib/prism-graph/types';
import {
  bind,
  depthPlateNode,
  fxNode,
  templateHub,
  textNode,
} from '../catalog-helpers';

const HUB = 'marginalia';
const A = '/prism-mock/templates/marginalia';
const GOLD = '#d9b877';
const PAPER = '#e9edf1';
const INK = '#0d1418';

export const marginaliaGraph: GraphSource = {
  hubs: [
    templateHub({
      hubId: HUB,
      title: 'Marginalia — Layered Photo Essay',
      caption: 'A single valley plate with real depth, annotated in the margins.',
      backgroundColor: INK,
      cursor: { style: 'ring', magnetic: false, accent: GOLD },
      transitionPreset: { kind: 'dissolve' },
      contentHeight: 2400,
    }),
  ],
  nodes: [
    // The depth plate — one image + its depth map, tilts to the pointer for a
    // true-depth read (renderMode 'parallax-plane').
    depthPlateNode(
      {
        id: 'mar-plate',
        hub: HUB,
        caption: 'Dawn valley plate with depth — parallax tilt to the pointer.',
        x: 0,
        y: 0.6,
        z: -0.8,
        w: 12,
        h: 7,
      },
      `${A}/valley-plate.webp`,
      `${A}/valley-plate.depth.png`,
    ),
    // Fine dust so the stage breathes even without a cursor.
    fxNode({
      id: 'mar-dust',
      hub: HUB,
      caption: 'Atmospheric dust over the valley.',
      x: 0,
      y: 0.6,
      z: 0.2,
      w: 12,
      h: 7,
      bindings: [bind('dust-particles', 'time', { params: { density: 0.35 } })],
    }),
    // Title, upper-left margin.
    textNode(
      {
        id: 'mar-title',
        hub: HUB,
        caption: 'Essay title.',
        x: -3.6,
        y: 2.9,
        z: 0.4,
        w: 8,
        h: 1,
      },
      'On first light',
      { family: 'Fraunces', weight: 600, size: 0.6, color: PAPER, glow: 1.7 },
    ),
    textNode(
      {
        id: 'mar-byline',
        hub: HUB,
        caption: 'Byline — tiny.',
        x: -4.7,
        y: 2.1,
        z: 0.4,
        w: 4,
        h: 0.3,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })],
      },
      'ESSAY — E. HOLLOWAY',
      { family: 'JetBrains Mono', weight: 400, size: 0.13, color: GOLD, glow: 1.5, reveal: false },
    ),
    // Margin note, right side — floats like a pinned annotation.
    textNode(
      {
        id: 'mar-note-1',
        hub: HUB,
        caption: 'Margin note — right.',
        x: 4.7,
        y: 1,
        z: 0.5,
        w: 3,
        h: 0.9,
        bindings: [bind('float', 'time', { params: { amplitude: 0.04, periodSec: 8 } })],
      },
      'the ridge holds\nthe last of the\nblue',
      { family: 'Fraunces', weight: 400, size: 0.17, color: '#cdd7de', glow: 1.2 },
    ),
    // Pull-quote below the plate.
    textNode(
      {
        id: 'mar-pull',
        hub: HUB,
        caption: 'Pull-quote — cascade reveal.',
        x: 0,
        y: -3.4,
        z: 0.4,
        w: 10,
        h: 1.4,
        bindings: [bind('text-cascade', 'inview', { params: { stagger: 0.035 } })],
      },
      'A valley keeps two dawns:\none in the sky, one in the water.',
      { family: 'Fraunces', weight: 400, size: 0.34, color: PAPER, glow: 1.4 },
    ),
    // Body line + footnote.
    textNode(
      {
        id: 'mar-body',
        hub: HUB,
        caption: 'Body line.',
        x: 0,
        y: -5,
        z: 0.4,
        w: 9,
        h: 0.4,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.012 } })],
      },
      'We drove up before the birds, and waited for the colour to decide.',
      { family: 'Fraunces', weight: 400, size: 0.2, color: '#c2ccd4', glow: 1.2 },
    ),
    textNode(
      {
        id: 'mar-foot',
        hub: HUB,
        caption: 'Footnote — magnetic read-on.',
        x: 0,
        y: -5.9,
        z: 0.4,
        w: 6,
        h: 0.3,
        bindings: [bind('magnetic', 'pointer', { params: { strength: 0.45 } })],
      },
      'CONTINUE READING ¹ →',
      { family: 'JetBrains Mono', weight: 400, size: 0.14, color: GOLD, glow: 1.8, reveal: false },
    ),
  ],
  edges: [],
};
