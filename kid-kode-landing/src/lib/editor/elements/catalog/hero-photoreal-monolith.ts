// hero-photoreal-monolith — a photoreal 3D hero section (§13 reference element
// #2). A centerpiece mesh (a richly-PBR'd sphere monolith: high metalness +
// clearcoat + iridescence — a soap-bubble / oil-slick sheen), an MSDF text
// headline member (renderMode:'text', real glyphs — INV-11, never diffusion),
// and a subtle backdrop panel so the hero reads photoreal standalone.
//
// INTEGRATED animation:
//   • monolith — a slow `float` (gentle bob + tilt; registry 'float',
//     transform category, verified registered) so the centerpiece breathes.
//   • headline — a `text-fade-up-each` kinetic reveal (registry
//     'text-fade-up-each', text category, verified registered): each glyph
//     rises + fades in, staggered — the kinetic-text flourish.
//
// This is a TEMPLATE Phase 2 copies. Photorealism is procedural PBR + IBL
// (free); no fal imagery is needed for this element.
//
// Tier: T1 full-fidelity, clean T0 fallback (the monolith still reads as a lit
// iridescent sphere + crisp MSDF headline without screen-space GI). INV-9.

import type { ElementClusterDefinition } from '../contract';

export const heroPhotorealMonolith: ElementClusterDefinition = {
  id: 'hero-photoreal-monolith',
  label: 'Photoreal Monolith Hero',
  category: 'hero',
  caption: 'An iridescent centerpiece with a kinetic headline',
  description: 'A PBR monolith that floats, with a glyph-by-glyph MSDF headline.',
  members: [
    // ── Backdrop — a large, softly-lit pewter panel behind the hero so the
    // monolith has structure to reflect + reads with depth. Unlit-by-default
    // plane opted into lighting for a subtle gradient catch.
    {
      localId: 'backdrop',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Hero backdrop',
      renderMode: 'mesh',
      pose: {
        x: 0,
        y: 0.2,
        z: -1.4,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      footprint: { width: 5, height: 3 },
      meshPrimitive: {
        kind: 'plane',
        params: { width: 5, height: 3 },
      },
      materialSpec: {
        baseColor: '#2b3340',
        metalness: 0.35,
        roughness: 0.55,
        clearcoat: 0.2,
        envMapIntensity: 0.8,
      },
      receivesLighting: true,
    },
    // ── Monolith — the iridescent centerpiece sphere.
    {
      localId: 'monolith',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Hero monolith',
      renderMode: 'mesh',
      pose: {
        x: 0,
        y: 0.1,
        z: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      footprint: { width: 1.5, height: 1.5 },
      meshPrimitive: {
        kind: 'sphere',
        params: { radius: 0.85, segments: 64 },
      },
      materialSpec: {
        baseColor: '#cdb98a',
        metalness: 1.0,
        roughness: 0.16,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
        iridescence: 0.9,
        iridescenceIOR: 1.6,
        envMapIntensity: 1.4,
      },
      receivesLighting: true,
      // INTEGRATED animation: a slow float (gentle bob + tilt) so the
      // centerpiece breathes.
      animationBindings: [
        {
          id: 'ab-hero-monolith-float',
          primitive: 'float',
          driver: 'time',
          params: { speed: 0.6, amplitude: 0.16, tiltDeg: 8 },
          order: 0,
        },
      ],
    },
    // ── Headline — REAL MSDF text (INV-11), rising glyph-by-glyph.
    {
      localId: 'headline',
      subtype: 'text',
      serviceTag: 'decor',
      caption: 'Hero headline',
      renderMode: 'text',
      pose: {
        x: 0,
        y: -1.25,
        z: 0.2,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      footprint: { width: 3.4, height: 0.5 },
      textSpec: {
        content: 'BUILD IN 3D',
        fontFamily: 'Inter',
        fontWeight: 700,
        fontSize: 0.42,
        align: 'center',
        letterSpacing: 0.04,
        fill: { kind: 'gradient', from: '#e8d6a6', to: '#9fc3d6', angleDeg: 20 },
        decompose: 'glyph',
      },
      // INTEGRATED animation: a kinetic per-glyph rise-and-fade reveal.
      animationBindings: [
        {
          id: 'ab-hero-headline-reveal',
          primitive: 'text-fade-up-each',
          driver: 'time',
          params: { duration: 1.2, stagger: 0.07, rise: 0.4 },
          order: 0,
        },
      ],
    },
  ],
  preview: {
    camera: { distance: 5.2, polar: Math.PI / 2.15, azimuth: 0 },
    frozenPhase: 0.55,
    loopSeconds: 5,
    tier: 'T1',
  },
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.3,
    ambientIntensity: 0.28,
    shadowSoftness: 0.55,
  },
  designRefs: ['iridescent hero centerpiece', 'kinetic typography reveal'],
  tier: 'T1',
  featured: true,
};
