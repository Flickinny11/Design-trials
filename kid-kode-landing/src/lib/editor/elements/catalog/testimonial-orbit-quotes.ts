// testimonial-orbit-quotes — a photoreal 3D testimonial whose customer avatar
// discs orbit a central glass quote panel inside a living halo of orbital light
// rings (§13 element; catalog roster "TESTIMONIAL"). The SR-smashing move:
// where Slider Revolution rotates flat avatar pngs on a CSS circle, this is a
// real transmission-glass quote plaque framed by a brushed-brass ring, three
// polished-chrome avatar medallions turning on a ring, and a true THREE.Points
// Keplerian ring system (orbit-rings) sweeping around the whole composition —
// all under studio IBL + real MSDF letterforms (INV-11, never diffusion-baked).
//
// Composition (cluster-local, origin 0,0,0):
//   • backdrop     — large softly-lit charcoal panel (depth + reflections).
//   • quote-panel  — a frosted transmission-glass plaque: the central card the
//                    avatars orbit. Real transmission/ior/clearcoat PBR.
//   • frame-ring   — brushed-brass torus framing the quote (Observatory Brass).
//   • quote-text   — REAL MSDF quote (+ attribution) on the glass, revealed
//                    glyph-by-glyph.
//   • avatar-0/1/2 — polished-chrome/brass avatar medallions on a ring around
//                    the panel; each turns in place (spin) so the ring reads as
//                    a slow orbital turntable of faces.
//   • orbit-halo   — an EMPTY member carrying `orbit-rings`: nested rings of
//                    icy points orbiting the quote at Keplerian rates. The
//                    literal "orbit" move and the photoreal centerpiece flourish.
//
// INTEGRATED animation (all three verified registered):
//   • orbit-halo  — `orbit-rings` (particles): self-generated THREE.Points ring
//     system orbiting the quote. driver:'time'. This IS the orbit move.
//   • avatar-0/1/2 — `spin` (transform): each medallion turns about Y in sync,
//     so the ring of faces reads as a slow orbital turntable. driver:'time'.
//   • quote-text  — `text-fade-up-each` (text): each glyph rises + fades in,
//     staggered — the kinetic-quote reveal. driver:'time'.
//
// Photorealism is procedural PBR (transmission glass + brushed brass + polished
// chrome) + studio IBL (free) — no hero imagery needed. Palette: Observatory
// Brass (brass/gold #c9a86a + ice-steel blues + charcoal). No purple.
//
// Tier: T1 full-fidelity; MUST still read clean at T0 — the glass plaque, brass
// ring, chrome medallions, particle halo and crisp MSDF quote remain a legible,
// composed testimonial without screen-space GI (INV-9).

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';
import type { ScenePosition } from '@/lib/prism-graph/types';

// Identity pose helper — keeps each member's 9-field ScenePosition explicit
// while staying terse. Callers override only the axes they move.
function pose(p: Partial<ScenePosition>): ScenePosition {
  return {
    x: 0,
    y: 0,
    z: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    ...p,
  };
}

// ── Avatar ring layout ──────────────────────────────────────────────────────
// Three medallions on a ring in front of the quote, fanned across the top arc
// so all three face the camera in the tile. Polished-chrome and brass recipes
// alternate (Observatory Brass). Each is a thin upright cylinder (a coin-like
// disc) laid on its side so the circular face fronts the camera.
const AVATAR_RADIUS = 1.95;
const AVATAR_Y = 0.15;
const AVATAR_Z = 0.55; // pulled toward camera so the ring sits in front of glass

const AVATAR_PALETTE = [
  // polished chrome
  { baseColor: '#d6dde6', metalness: 1.0, roughness: 0.08, clearcoat: 1.0 },
  // brass
  { baseColor: '#c9a86a', metalness: 0.95, roughness: 0.18, clearcoat: 0.6 },
  // ice steel
  { baseColor: '#9fc3d6', metalness: 0.85, roughness: 0.14, clearcoat: 0.7 },
];

function buildAvatars(): ClusterMemberTemplate[] {
  // Fan three discs across the top arc: -50°, 0°, +50° from straight up, so the
  // composition reads as faces orbiting above-and-around the quote.
  const angles = [-0.87, 0, 0.87]; // radians, measured from +Y around Z
  return angles.map((a, i) => {
    const x = Math.sin(a) * AVATAR_RADIUS;
    const y = AVATAR_Y + Math.cos(a) * (AVATAR_RADIUS * 0.62);
    const pal = AVATAR_PALETTE[i % AVATAR_PALETTE.length];
    return {
      localId: `avatar-${i}`,
      subtype: 'element',
      serviceTag: 'decor',
      caption: `Customer avatar ${i + 1}`,
      renderMode: 'mesh',
      // Cylinder laid on its side (rotationX = 90°) so its circular face fronts
      // the camera as a coin-like medallion.
      pose: pose({ x, y, z: AVATAR_Z, rotationX: Math.PI / 2 }),
      footprint: { width: 0.78, height: 0.78 },
      meshPrimitive: {
        kind: 'cylinder',
        params: { radius: 0.38, height: 0.1, segments: 64 },
      },
      materialSpec: {
        baseColor: pal.baseColor,
        metalness: pal.metalness,
        roughness: pal.roughness,
        clearcoat: pal.clearcoat,
        clearcoatRoughness: 0.12,
        envMapIntensity: 1.5,
      },
      receivesLighting: true,
      // INTEGRATED animation: each medallion turns in place about Y, in sync, so
      // the ring of faces reads as a slow orbital turntable. (registry 'spin',
      // transform category, verified registered.)
      animationBindings: [
        {
          id: `ab-orbit-quotes-avatar-${i}`,
          primitive: 'spin',
          driver: 'time',
          params: { cycle: 6, turns: 1, axis: 'y' },
          order: 0,
        },
      ],
    };
  });
}

const testimonialOrbitQuotes: ElementClusterDefinition = {
  id: 'testimonial-orbit-quotes',
  label: 'Orbit Quotes',
  category: 'testimonial',
  caption: 'Customer avatars orbit a central glass quote panel',
  description:
    'Chrome avatar medallions turn on a ring around a transmission-glass quote, wrapped in orbiting rings of light.',
  members: [
    // ── Backdrop ── large, softly-lit charcoal panel set behind the
    // composition so the glass plaque, brass ring and chrome medallions have
    // depth and something to refract/reflect. Unlit-by-default plane opted into
    // lighting for a subtle gradient catch.
    {
      localId: 'backdrop',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Testimonial backdrop',
      renderMode: 'mesh',
      pose: pose({ y: 0.2, z: -1.6 }),
      footprint: { width: 5.6, height: 3.4 },
      meshPrimitive: {
        kind: 'plane',
        params: { width: 5.6, height: 3.4 },
      },
      materialSpec: {
        baseColor: '#1b1f27',
        metalness: 0.4,
        roughness: 0.58,
        clearcoat: 0.2,
        clearcoatRoughness: 0.3,
        envMapIntensity: 0.85,
      },
      receivesLighting: true,
    },
    // ── Quote panel ── the central card the avatars orbit: a thin upright
    // frosted-glass plaque (real transmission PBR — transmission/ior/dispersion/
    // clearcoat). A glass quote card that catches the halo's icy light.
    {
      localId: 'quote-panel',
      subtype: 'card',
      serviceTag: 'decor',
      caption: 'Quote panel',
      renderMode: 'mesh',
      pose: pose({ y: 0.15, z: 0 }),
      footprint: { width: 2.6, height: 1.7 },
      meshPrimitive: {
        kind: 'cube',
        params: { width: 2.6, height: 1.7, depth: 0.1 },
      },
      materialSpec: {
        baseColor: '#dfe7ee',
        metalness: 0.0,
        roughness: 0.08,
        transmission: 0.9,
        ior: 1.5,
        dispersion: 0.04,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        thickness: 0.45,
        envMapIntensity: 1.4,
      },
      receivesLighting: true,
    },
    // ── Frame ring ── a brushed-brass torus framing the quote plaque (born in
    // the XY plane already facing +Z). Premium brushed-metal recipe — high
    // metalness, mid roughness, strong env reflection. (Observatory Brass.)
    {
      localId: 'frame-ring',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Brass frame ring',
      renderMode: 'mesh',
      pose: pose({ y: 0.15, z: -0.02 }),
      footprint: { width: 3.0, height: 3.0 },
      meshPrimitive: {
        kind: 'torus',
        params: { radius: 1.42, tube: 0.06, segments: 96 },
      },
      materialSpec: {
        baseColor: '#c9a86a',
        metalness: 0.95,
        roughness: 0.32,
        clearcoat: 0.5,
        clearcoatRoughness: 0.25,
        envMapIntensity: 1.3,
      },
      receivesLighting: true,
    },
    // ── Quote text ── REAL MSDF text (INV-11) on the glass plaque, revealed
    // glyph-by-glyph. Modest fontSize so the two short lines frame inside the
    // plaque. Two lines via '\n'.
    {
      localId: 'quote-text',
      subtype: 'text',
      serviceTag: 'decor',
      caption: 'Quote text',
      renderMode: 'text',
      pose: pose({ y: 0.32, z: 0.09 }),
      footprint: { width: 2.3, height: 0.9 },
      textSpec: {
        content: '"It changed\nhow we ship."\n— AVERY KANE',
        fontFamily: 'Inter',
        fontWeight: 600,
        fontSize: 0.26,
        lineHeight: 1.22,
        align: 'center',
        letterSpacing: 0.01,
        fill: { kind: 'gradient', from: '#f0e6cd', to: '#9fc3d6', angleDeg: 18 },
        decompose: 'glyph',
      },
      // INTEGRATED animation: a kinetic per-glyph rise-and-fade reveal of the
      // quote. (registry 'text-fade-up-each', text category, verified.)
      animationBindings: [
        {
          id: 'ab-orbit-quotes-reveal',
          primitive: 'text-fade-up-each',
          driver: 'time',
          params: { duration: 1.4, stagger: 0.05, rise: 0.3 },
          order: 0,
        },
      ],
    },
    // ── Avatar medallions ── three polished-chrome/brass discs on a ring,
    // each turning in place so the ring reads as an orbital turntable of faces.
    ...buildAvatars(),
    // ── Orbit halo ── an EMPTY member (no geometry) carrying `orbit-rings`:
    // the primitive self-generates a THREE.Points ring system — nested bands of
    // icy points orbiting the quote at Keplerian rates. Centered on the plaque,
    // pulled a touch forward so the rings wrap around the composition. This is
    // the literal "orbit" move and the photoreal centerpiece flourish.
    {
      localId: 'orbit-halo',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Orbital ring halo',
      renderMode: 'mesh',
      pose: pose({ y: 0.15, z: 0.1 }),
      footprint: { width: 3.6, height: 3.6 },
      // INTEGRATED animation: nested orbital rings of light around the quote.
      animationBindings: [
        {
          id: 'ab-orbit-quotes-halo',
          primitive: 'orbit-rings',
          driver: 'time',
          params: { rings: 5, speed: 0.9, tilt: 0.28, size: 0.04 },
          order: 0,
        },
      ],
    },
  ],
  preview: {
    // Frame the whole composition head-on, very slightly above, so the glass
    // quote, brass ring, the three medallions and the orbital halo all sit in a
    // ~4:3 tile.
    camera: { distance: 6.0, polar: Math.PI / 2.15, azimuth: 0 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T1',
  },
  // Recommend a warm-key studio look at place time (additive; never forces a
  // hub-wide change unless the placement opts in). Lets the glass transmission +
  // brass/chrome reflections read fully.
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.3,
    ambientIntensity: 0.28,
    shadowSoftness: 0.55,
  },
  designRefs: [
    'orbital avatar ring layout',
    'PBR transmission glass quote panel',
    'orbit-rings particle ring system',
    'brushed-brass + polished-chrome studio IBL',
    'kinetic typography reveal',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(testimonialOrbitQuotes);
export default testimonialOrbitQuotes;
