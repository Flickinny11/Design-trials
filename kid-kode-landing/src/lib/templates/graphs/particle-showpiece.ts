// W8 E11 template (c) — "Particle Showpiece": a WebGL particle/fluid showpiece.
// SR-flagship-class (their particle hero) rebuilt as a real .prism graph: a
// layered particle field (galaxy + nebula + fireflies) that reacts to the
// cursor as an attract/repel field (E9 pointer field), a halo custom cursor
// (E9), a kinetic headline, and a glass-sweep scene transition (E10). Fully
// asset-free — every particle field is a node the runtime factory realizes.

import type { GraphSource } from '@/lib/prism-graph/types';
import { bind, fxNode, textNode, templateHub } from '../node-helpers';

const HUB = 'showpiece';

export const particleShowpieceGraph: GraphSource = {
  hubs: [
    templateHub({
      hubId: HUB,
      title: 'Nova — Particle Showpiece',
      caption: 'A cursor-reactive WebGL particle showpiece.',
      backgroundColor: '#030309',
      cursor: { style: 'halo', magnetic: false, accent: '#7fb2ff' },
      transitionPreset: { kind: 'glass-sweep' },
      // Hub-owned ambience/backdrop stack (galaxy law: passive star/nebula/
      // backdrop layers are hub DATA, never first-class nodes) — deep plate,
      // slow galaxy starfield, nebula glow. The cursor attract/repel field
      // below stays a NODE: it is the interactive star of the showpiece, not
      // stage ambience.
      background: [
        {
          id: 'nova-bg-plate',
          attachment: 'parallax',
          sourceUrl: '/prism-mock/orrery/materia/backdrop.png',
          z: -6,
          parallaxDepth: 0.05,
          opacity: 1,
        },
        {
          id: 'nova-bg-galaxy',
          attachment: 'world',
          kind: 'particle-field',
          z: -150,
          opacity: 1,
          parallaxDepth: 0.6,
          params: { palette: 'deep', density: 0.6, drift: 0.3, intensity: 0.6, variant: 'starfield' },
        },
        {
          id: 'nova-bg-nebula',
          attachment: 'infinite-environment',
          kind: 'volumetric-nebula',
          z: -400,
          opacity: 0.8,
          parallaxDepth: 0.95,
          params: { palette: 'ice', density: 0.5, drift: 0.4, intensity: 0.5 },
        },
      ],
    }),
  ],
  nodes: [
    // (Deep plate + galaxy starfield + nebula glow live on hub.background.)
    // Cursor-reactive attract/repel field — the star of the showpiece. As the
    // pointer moves, this field's particles are pulled toward / pushed from it.
    fxNode({
      id: 'nova-field',
      hub: HUB,
      caption: 'Cursor attract/repel particle field — reacts to the pointer.',
      x: 0,
      y: 0,
      z: 0,
      w: 12,
      h: 8,
      bindings: [
        bind('attractor', 'pointer', { params: { strength: 0.9, radius: 2.4 } }),
        bind('fireflies', 'time', { params: { count: 260 } }),
      ],
    }),
    // Kinetic headline over the field.
    textNode(
      {
        id: 'nova-headline',
        hub: HUB,
        caption: 'Kinetic headline — glyphs assemble on in-view.',
        x: 0,
        y: 0.6,
        z: 1,
        w: 10,
        h: 1.2,
      },
      'Particles, on command.',
      { size: 0.82, color: '#eaf2ff' },
    ),
    textNode(
      {
        id: 'nova-sub',
        hub: HUB,
        caption: 'Subhead.',
        x: 0,
        y: -0.55,
        z: 1,
        w: 9,
        h: 0.5,
      },
      'Move the cursor to bend the field',
      { size: 0.28, color: '#9fb4d8' },
    ),
  ],
  edges: [],
};
