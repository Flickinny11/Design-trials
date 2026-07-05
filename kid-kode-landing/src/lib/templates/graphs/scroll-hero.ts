// W8 E11 template (a) — "Kinetic Scroll Hero": a scroll-driven one-page hero
// journey. SR-flagship-class (their signature scroll-scrub hero) rebuilt as a
// real .prism graph: a photoreal product hero that rotates + scales with scroll
// (E8 scroll driver), section-relative material plates that scrub as they pass
// (E8 section scrub), a kinetic headline that reveals on in-view (E8 inview), a
// cursor-parallax field, a brass-ring custom cursor (E9), and a dissolve scene
// transition (E10). Everything is a node; everything is editable in canvas.

import type { GraphSource } from '@/lib/prism-graph/types';
import { bind, glbNode, imageNode, textNode, templateHub } from '../node-helpers';

const HUB = 'hero';

export const scrollHeroGraph: GraphSource = {
  hubs: [
    templateHub({
      hubId: HUB,
      title: 'Aperture — Kinetic Hero',
      caption: 'A scroll-driven one-page hero journey.',
      backgroundColor: '#05060d',
      cursor: { style: 'ring', magnetic: true, accent: '#d8a24a' },
      transitionPreset: { kind: 'dissolve' },
      contentHeight: 2200,
    }),
  ],
  nodes: [
    // Rich atmospheric backdrop plane (parallaxes gently to the cursor for depth).
    imageNode(
      {
        id: 'hero-backdrop',
        hub: HUB,
        caption: 'Atmospheric backdrop — subtle cursor parallax for depth.',
        x: 0,
        y: 0,
        z: -4,
        w: 15,
        h: 9,
        bindings: [bind('parallax', 'pointer', { params: { strength: 0.12 } })],
      },
      '/prism-mock/orrery/materia/backdrop.png',
    ),
    // The product hero — floats on idle, tilts toward the cursor, and scales
    // through the scroll scrub as you descend.
    glbNode(
      {
        id: 'hero-product',
        hub: HUB,
        caption: 'Photoreal product hero — floats, tilts to the pointer, scales with scroll.',
        x: 0,
        y: -0.2,
        z: 0.4,
        w: 3.4,
        h: 3.4,
        scale: 3.2,
        bindings: [
          bind('float', 'time', { params: { amplitude: 0.05, periodSec: 6 } }),
          bind('pointer-tilt-3d', 'pointer', { params: { strength: 0.5 } }),
          bind('scroll-zoom', 'scroll', { params: { from: 1, to: 1.35 } }),
        ],
      },
      '/prism-mock/orrery/meshes/watch.glb',
    ),
    // Kinetic headline — reveals glyph-by-glyph the moment it scrolls into view.
    textNode(
      {
        id: 'hero-headline',
        hub: HUB,
        caption: 'Hero headline — kinetic glyph reveal on in-view.',
        x: 0,
        y: 2.4,
        z: 0.3,
        w: 8,
        h: 1,
        bindings: [bind('text-cascade', 'inview', { params: { stagger: 0.04 } })],
      },
      'Time, Reimagined.',
      { weight: 700, size: 0.72, color: '#f4ead2' },
    ),
    // Subhead — soft fade-up on in-view.
    textNode(
      {
        id: 'hero-subhead',
        hub: HUB,
        caption: 'Subhead — fades up on in-view.',
        x: 0,
        y: 1.55,
        z: 0.3,
        w: 8,
        h: 0.5,
        bindings: [bind('text-fade-up-each', 'inview', { params: { stagger: 0.03 } })],
      },
      'Scroll to set it in motion.',
      { weight: 400, size: 0.24, color: '#b9c2d8' },
    ),
    // Left material plate — parallaxes to the cursor and scrubs section-relative.
    imageNode(
      {
        id: 'hero-plate-brass',
        hub: HUB,
        caption: 'Brass macro plate — cursor parallax + section scroll scrub.',
        x: -4.1,
        y: 0.1,
        z: -0.4,
        w: 2.0,
        h: 1.7,
        scale: 0.9,
        bindings: [
          bind('parallax', 'pointer', { params: { strength: 0.25 } }),
          bind('scroll-rotate-3d', 'scroll', { params: { degrees: 22 }, section: true }),
        ],
      },
      '/prism-mock/orrery/materia/brass-macro.png',
    ),
    // Right material plate — mirror of the left.
    imageNode(
      {
        id: 'hero-plate-sapphire',
        hub: HUB,
        caption: 'Sapphire macro plate — cursor parallax + section scroll scrub.',
        x: 4.1,
        y: 0.1,
        z: -0.4,
        w: 2.0,
        h: 1.7,
        scale: 0.9,
        bindings: [
          bind('parallax', 'pointer', { params: { strength: 0.25 } }),
          bind('scroll-rotate-3d', 'scroll', { params: { degrees: -22 }, section: true }),
        ],
      },
      '/prism-mock/orrery/materia/sapphire-macro.png',
    ),
    // Lower reveal section — starts below the fold; slides in on in-view (replay
    // so it re-fires each time you scroll it back). This is the real E8 inview.
    textNode(
      {
        id: 'hero-reveal-line',
        hub: HUB,
        caption: 'Lower reveal — slides in on in-view, replays on re-entry.',
        x: 0,
        y: -4.2,
        z: 0.3,
        w: 9,
        h: 0.7,
        bindings: [bind('text-elastic-in', 'inview', { replay: true })],
      },
      'Engineered in the browser. Shipped as a running app.',
      { weight: 600, size: 0.34, color: '#e8dcc0' },
    ),
    // Scroll progress indicator that fills as you scroll (global scroll scrub).
    textNode(
      {
        id: 'hero-cta',
        hub: HUB,
        caption: 'CTA — rises on scroll.',
        x: 0,
        y: -2.6,
        z: 0.3,
        w: 5,
        h: 0.5,
        bindings: [bind('scroll-stagger-rise', 'scroll', { params: { distance: 1.2 } })],
      },
      'Remix this hero →',
      { weight: 500, size: 0.28, color: '#d8a24a' },
    ),
  ],
  edges: [],
};
