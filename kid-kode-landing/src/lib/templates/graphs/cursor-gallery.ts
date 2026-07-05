// W8 E11 template (b) — "Cursor Gallery": a cursor-reactive editorial gallery.
// SR-flagship-class (their pointer-reactive showcase) rebuilt as a real .prism
// graph: a grid of macro-material tiles that each tilt + parallax toward the
// pointer (E9 pointer field, generalizing M1's rig), a magnetic beam cursor
// (E9 custom-cursor layer), an editorial headline, and a veil scene transition
// (E10). Every tile is a node, editable in canvas / node editors.

import type { GraphSource, PrismNode } from '@/lib/prism-graph/types';
import { bind, imageNode, textNode, templateHub } from '../node-helpers';

const HUB = 'gallery';

const TILES: Array<{ id: string; asset: string; x: number; y: number }> = [
  { id: 'g-brass', asset: '/prism-mock/orrery/materia/brass-macro.png', x: -3.6, y: 1.5 },
  { id: 'g-sapphire', asset: '/prism-mock/orrery/materia/sapphire-macro.png', x: 0, y: 1.5 },
  { id: 'g-meteor', asset: '/prism-mock/orrery/materia/meteorite-macro.png', x: 3.6, y: 1.5 },
  { id: 'g-meteor-dark', asset: '/prism-mock/orrery/materia/meteorite-dark.png', x: -3.6, y: -1.4 },
  { id: 'g-plate', asset: '/prism-mock/orrery/materia/meteorite-plate.png', x: 0, y: -1.4 },
  { id: 'g-backdrop', asset: '/prism-mock/orrery/materia/backdrop.png', x: 3.6, y: -1.4 },
];

const tileNodes: PrismNode[] = TILES.map((t, i) =>
  imageNode(
    {
      id: t.id,
      hub: HUB,
      caption: `Gallery tile — tilts + parallaxes toward the pointer; magnetically pulls the cursor.`,
      x: t.x,
      y: t.y,
      z: 0,
      w: 3.1,
      h: 2.5,
      bindings: [
        bind('pointer-tilt-3d', 'pointer', { params: { strength: 0.6 } }),
        bind('parallax', 'pointer', { params: { strength: 0.35 } }),
        // Staggered fade-up reveal as each tile enters the frame.
        bind('fade-scale', 'inview', { params: { delay: i * 0.06 } }),
      ],
    },
    t.asset,
  ),
);

export const cursorGalleryGraph: GraphSource = {
  hubs: [
    templateHub({
      hubId: HUB,
      title: 'Atlas — Cursor Gallery',
      caption: 'A cursor-reactive editorial gallery.',
      backgroundColor: '#08070c',
      cursor: { style: 'beam', magnetic: true, accent: '#e7c98a' },
      transitionPreset: { kind: 'veil' },
    }),
  ],
  nodes: [
    // Atmospheric backdrop — gives the grid depth AND lets the extruded
    // (metallic) title/footer catch light so they read on the dark page.
    imageNode(
      {
        id: 'gallery-backdrop',
        hub: HUB,
        caption: 'Atmospheric backdrop behind the grid.',
        x: 0,
        y: 0,
        z: -5,
        w: 17,
        h: 10,
        bindings: [bind('parallax', 'pointer', { params: { strength: 0.08 } })],
      },
      '/prism-mock/orrery/materia/backdrop.png',
    ),
    textNode(
      {
        id: 'gallery-title',
        hub: HUB,
        caption: 'Editorial masthead.',
        x: 0,
        y: 3.1,
        z: 0.3,
        w: 9,
        h: 0.8,
      },
      'MATERIA, a study in surfaces',
      { size: 0.46, color: '#f0e6cf' },
    ),
    ...tileNodes,
    textNode(
      {
        id: 'gallery-foot',
        hub: HUB,
        caption: 'Footer note — move the cursor across the tiles.',
        x: 0,
        y: -2.95,
        z: 0.3,
        w: 8,
        h: 0.4,
      },
      'Move the cursor. The surfaces answer.',
      { size: 0.24, color: '#cbb789' },
    ),
  ],
  edges: [],
};
