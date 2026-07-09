// W-2D demo fixture — "Meridian Ledger": a MIXED app proving per-hub render
// modes coexist with zero runtime fracture. Hub 1 (`landing`) is a classic 3d
// perspective landing: depth-staged showpiece, pointer tilt, side plates in
// z. Hub 2 (`ledger`) is a `renderMode: '2d'` FLAT data page: a table-like
// composition authored at z=0 that must feel NATIVE (not crippled) under the
// telephoto flat camera — with ONE deliberate 3D accent (a slowly turning
// brass torus) proving 3D accents stay layerable inside a 2d hub. Navigating
// landing → ledger in the runtime exercises the smooth 2d↔3d composition
// tween (mount-graph applyHubComposition). Everything is a node; both hubs
// share the SAME renderer, node contract, and hub manager.

import type { GraphSource } from '@/lib/prism-graph/types';
import { bind, meshNode, textNode, templateHub } from '../node-helpers';

const LANDING = 'landing';
const LEDGER = 'ledger';

const BONE = '#e8e4da';
const BRASS = '#d8a24a';
const ICE = '#9fc4e8';
const MID = '#aab3c5';

// Flat table geometry (scene units, z=0 plane).
const ROW_W = 8.4;
const ROW_H = 0.72;
const COL_X = [-3.2, -0.4, 2.2, 3.7]; // item · category · date · amount
const ROWS: Array<[string, string, string, string]> = [
  ['Observatory lease', 'Facilities', 'Jul 02', '1,840.00'],
  ['Brass stock, 6mm', 'Materials', 'Jul 04', '412.50'],
  ['Lens calibration', 'Services', 'Jul 07', '260.00'],
];

function ledgerRowNodes() {
  const nodes = [];
  ROWS.forEach(([item, cat, date, amount], r) => {
    const y = 0.7 - r * 0.92;
    nodes.push(
      meshNode(
        {
          id: `ledger-row-${r}`,
          hub: LEDGER,
          caption: `Ledger row ${r + 1} — flat table row plate.`,
          x: 0, y, z: 0, w: ROW_W, h: ROW_H,
        },
        { kind: 'plane', params: { width: ROW_W, height: ROW_H } },
        // Flat matte row plate — no specular blowout under the runtime key
        // light (W-TPL law: metalness low, roughness high on flat cards).
        { baseColor: r === 1 ? '#141a24' : '#10151d', metalness: 0.08, roughness: 0.85, clearcoat: 0 },
      ),
    );
    const cells: Array<[string, string, number]> = [
      [item, BONE, COL_X[0]],
      [cat, MID, COL_X[1]],
      [date, MID, COL_X[2]],
      [amount, ICE, COL_X[3]],
    ];
    cells.forEach(([text, color, x], c) => {
      nodes.push(
        textNode(
          {
            id: `ledger-cell-${r}-${c}`,
            hub: LEDGER,
            caption: `Row ${r + 1} ${['item', 'category', 'date', 'amount'][c]} cell.`,
            x, y: y + 0.02, z: 0, w: 2.4, h: 0.4,
          },
          text,
          { size: 0.2, weight: c === 0 ? 600 : 400, color, align: c === 3 ? 'right' : 'left', glow: 1.4, reveal: false },
        ),
      );
    });
  });
  return nodes;
}

export const ledgerMixedGraph: GraphSource = {
  hubs: [
    templateHub({
      hubId: LANDING,
      title: 'Meridian — Landing',
      caption: 'The 3d perspective landing page of the mixed app.',
      backgroundColor: '#070a10',
      transitionPreset: { kind: 'wipe' },
    }),
    templateHub({
      hubId: LEDGER,
      title: 'Meridian — Ledger',
      caption: 'The 2d flat data page: a native table composition.',
      backgroundColor: '#0a0d12',
      transitionPreset: { kind: 'veil' },
      // W-2D — THE point of this fixture: a flat composition hub.
      renderMode: '2d',
    }),
  ],
  nodes: [
    // ── Hub 1: 3d landing (depth-staged) ────────────────────────────────────
    textNode(
      {
        id: 'landing-headline',
        hub: LANDING,
        caption: 'Landing headline — kinetic reveal.',
        x: 0, y: 2.5, z: 0.3, w: 8.5, h: 1,
      },
      'Meridian keeps the books.',
      { weight: 700, size: 0.66, color: BONE, glow: 2.0 },
    ),
    textNode(
      {
        id: 'landing-subhead',
        hub: LANDING,
        caption: 'Landing subhead.',
        x: 0, y: 1.6, z: 0.3, w: 8, h: 0.5,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.03 } })],
      },
      'A workshop ledger with a showroom front door.',
      { weight: 400, size: 0.26, color: MID, glow: 1.5 },
    ),
    meshNode(
      {
        id: 'landing-showpiece',
        hub: LANDING,
        caption: 'Brass gyre showpiece — floats and tilts to the pointer (3d staging).',
        x: 0, y: -0.55, z: -0.4, w: 3, h: 3,
        bindings: [
          bind('float', 'time', { params: { amplitude: 0.06, periodSec: 7 } }),
          bind('pointer-tilt-3d', 'pointer', { params: { strength: 0.55 } }),
        ],
      },
      { kind: 'torus', params: { radius: 1.15, tube: 0.34 } },
      { baseColor: BRASS, metalness: 0.55, roughness: 0.5, clearcoat: 0.2 },
    ),
    meshNode(
      {
        id: 'landing-plate-left',
        hub: LANDING,
        caption: 'Depth plate, stage left (sits behind the showpiece in z).',
        x: -3.6, y: -0.2, z: -1.4, w: 2.2, h: 3, rot: [0, 0.14, 0],
      },
      { kind: 'plane', params: { width: 2.2, height: 3 } },
      { baseColor: '#101722', metalness: 0.2, roughness: 0.7, clearcoat: 0.1 },
    ),
    meshNode(
      {
        id: 'landing-plate-right',
        hub: LANDING,
        caption: 'Depth plate, stage right (sits behind the showpiece in z).',
        x: 3.6, y: -0.2, z: -1.4, w: 2.2, h: 3, rot: [0, -0.14, 0],
      },
      { kind: 'plane', params: { width: 2.2, height: 3 } },
      { baseColor: '#101722', metalness: 0.2, roughness: 0.7, clearcoat: 0.1 },
    ),
    textNode(
      {
        id: 'landing-cta',
        hub: LANDING,
        caption: 'CTA — open the ledger (navigates to the 2d data hub).',
        x: 0, y: -2.6, z: 0.5, w: 6, h: 0.5,
      },
      'Open the ledger',
      { weight: 600, size: 0.3, color: BRASS, glow: 2.2, reveal: false },
    ),

    // ── Hub 2: 2d flat ledger (authored at z=0; reads as a native data page) ─
    textNode(
      {
        id: 'ledger-title',
        hub: LEDGER,
        caption: 'Ledger page title.',
        x: -2.9, y: 2.6, z: 0, w: 5, h: 0.7,
      },
      'July ledger',
      { weight: 700, size: 0.5, color: BONE, align: 'left', glow: 1.8, reveal: false },
    ),
    textNode(
      {
        id: 'ledger-balance',
        hub: LEDGER,
        caption: 'Running balance chip.',
        x: 3.4, y: 2.6, z: 0, w: 2.6, h: 0.5,
      },
      'Balance 2,512.50',
      { weight: 600, size: 0.24, color: ICE, align: 'right', glow: 1.6, reveal: false },
    ),
    // Column headers.
    ...(['Item', 'Category', 'Date', 'Amount'] as const).map((label, c) =>
      textNode(
        {
          id: `ledger-head-${c}`,
          hub: LEDGER,
          caption: `Column header — ${label}.`,
          x: COL_X[c], y: 1.55, z: 0, w: 2.2, h: 0.35,
        },
        label.toUpperCase(),
        { weight: 600, size: 0.17, color: MID, align: c === 3 ? 'right' : 'left', glow: 1.3, reveal: false },
      ),
    ),
    ...ledgerRowNodes(),
    textNode(
      {
        id: 'ledger-footnote',
        hub: LEDGER,
        caption: 'Footnote — export hint.',
        x: -2.2, y: -2.4, z: 0, w: 5, h: 0.35,
      },
      'Exported nightly to the workshop archive.',
      { weight: 400, size: 0.18, color: MID, align: 'left', glow: 1.2, reveal: false },
    ),
    // THE 3D ACCENT inside the 2d hub — a small brass gyre that keeps turning:
    // real lit geometry layered onto the flat page (renderMode '2d' flattens
    // the COMPOSITION camera, never the node contract).
    meshNode(
      {
        id: 'ledger-accent-gyre',
        hub: LEDGER,
        caption: '3D accent inside the flat page — a small turning brass gyre.',
        x: 3.9, y: -2.35, z: 0.2, w: 0.9, h: 0.9,
        bindings: [bind('spin', 'time', { params: { speed: 0.25 } })],
      },
      { kind: 'torus', params: { radius: 0.32, tube: 0.1 } },
      { baseColor: BRASS, metalness: 0.55, roughness: 0.5, clearcoat: 0.2 },
    ),
  ],
  edges: [
    { from: 'landing-cta', to: 'ledger-title', type: 'navigation', event: 'navigate' },
  ],
};
