// W-TPL hub template — "Chronicle" (about · oversized-type-editorial).
//
// The oversized-type grammar (corpus): one colossal display word used as a
// compositional PLATE that other elements occlude and inlay into, with a
// deliberately bimodal scale — the giant word plus tiny labels, almost nothing
// between. Chronicle tells an about-page as a timeline: a monumental founding
// year holds the top, three era photographs step down the page behind small
// museum labels, and the studio story arrives in the giant/tiny rhythm.
//
// Route decision (planner): interaction=scroll reveal, realism=photoreal (era
// stills as flat plates), byteBudget=tight, motion=ambient, source=photo → R2
// for the era plates, text is native MSDF-extruded.

import type { GraphSource } from '@/lib/prism-graph/types';
import { bind, imageNode, templateHub, textNode } from '../catalog-helpers';

const HUB = 'chronicle';
const A = '/prism-mock/templates/chronicle';
const GOLD = '#c9a25f';
const PAPER = '#efe6d4';
const INK = '#0c0a08';

export const chronicleGraph: GraphSource = {
  hubs: [
    templateHub({
      hubId: HUB,
      title: 'Chronicle — Oversized Editorial About',
      caption: 'An about page where the founding year is the artwork.',
      backgroundColor: INK,
      cursor: { style: 'dot', magnetic: false, accent: GOLD },
      transitionPreset: { kind: 'curtain' },
      contentHeight: 2600,
    }),
  ],
  nodes: [
    // The colossal year — the compositional plate. Behind it, the first era.
    imageNode(
      {
        id: 'chr-era-1',
        hub: HUB,
        caption: 'Era I photograph — occluded by the year plate.',
        x: 2.6,
        y: 1.7,
        z: -1,
        w: 6.5,
        h: 4.2,
        bindings: [bind('parallax', 'pointer', { params: { strength: 0.22 } })],
      },
      `${A}/era-1.webp`,
    ),
    textNode(
      {
        id: 'chr-year',
        hub: HUB,
        caption: 'Colossal founding year — the plate.',
        x: -1.2,
        y: 2,
        z: 0.4,
        w: 12,
        h: 2.6,
      },
      '2013',
      { family: 'Fraunces', weight: 600, size: 1.7, color: PAPER, glow: 1.9 },
    ),
    textNode(
      {
        id: 'chr-kicker',
        hub: HUB,
        caption: 'Tiny kicker label — the bimodal small half.',
        x: -4.3,
        y: 3.55,
        z: 0.5,
        w: 4,
        h: 0.3,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.03 } })],
      },
      'EST. — A STUDIO OF FOUR',
      { family: 'JetBrains Mono', weight: 400, size: 0.13, color: GOLD, glow: 1.5, reveal: false },
    ),
    textNode(
      {
        id: 'chr-lede',
        hub: HUB,
        caption: 'Studio lede.',
        x: -3.5,
        y: 0.2,
        z: 0.5,
        w: 7,
        h: 0.6,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.015 } })],
      },
      'We started in a borrowed room with one rule: make the thing you would be proud to sign.',
      { family: 'Fraunces', weight: 400, size: 0.24, color: '#d8cdb6', glow: 1.3 },
    ),
    // Era II — the middle chapter, giant caption word + tiny label.
    textNode(
      {
        id: 'chr-word-2',
        hub: HUB,
        caption: 'Chapter word II — plate.',
        x: -2.4,
        y: -2.6,
        z: 0.4,
        w: 11,
        h: 1.6,
      },
      'GREW',
      { family: 'Fraunces', weight: 600, size: 1.15, color: PAPER, glow: 1.8 },
    ),
    imageNode(
      {
        id: 'chr-era-2',
        hub: HUB,
        caption: 'Era II photograph.',
        x: 3.4,
        y: -2.7,
        z: -0.5,
        w: 5.4,
        h: 3.6,
        bindings: [bind('parallax', 'pointer', { params: { strength: 0.3 } })],
      },
      `${A}/era-2.webp`,
    ),
    textNode(
      {
        id: 'chr-label-2',
        hub: HUB,
        caption: 'Tiny label II.',
        x: -4,
        y: -3.75,
        z: 0.5,
        w: 5,
        h: 0.3,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.02 } })],
      },
      '2017 — FOUR BECAME TWELVE',
      { family: 'JetBrains Mono', weight: 400, size: 0.13, color: GOLD, glow: 1.5, reveal: false },
    ),
    // Era III — today.
    imageNode(
      {
        id: 'chr-era-3',
        hub: HUB,
        caption: 'Era III photograph — today.',
        x: -3,
        y: -6.6,
        z: -0.5,
        w: 5.6,
        h: 3.6,
        bindings: [bind('parallax', 'pointer', { params: { strength: 0.3 } })],
      },
      `${A}/era-3.webp`,
    ),
    textNode(
      {
        id: 'chr-word-3',
        hub: HUB,
        caption: 'Chapter word III — plate, occluding era III.',
        x: 2.2,
        y: -6.4,
        z: 0.4,
        w: 11,
        h: 1.6,
      },
      'STAYED',
      { family: 'Fraunces', weight: 600, size: 1.05, color: GOLD, glow: 1.9 },
    ),
    textNode(
      {
        id: 'chr-label-3',
        hub: HUB,
        caption: 'Tiny closing label.',
        x: 2.4,
        y: -7.65,
        z: 0.5,
        w: 6,
        h: 0.3,
        bindings: [bind('text-cascade', 'inview', { params: { stagger: 0.03 } })],
      },
      'TODAY — SAME RULE, LONGER TABLE',
      { family: 'JetBrains Mono', weight: 400, size: 0.13, color: '#d8cdb6', glow: 1.4, reveal: false },
    ),
  ],
  edges: [],
};
