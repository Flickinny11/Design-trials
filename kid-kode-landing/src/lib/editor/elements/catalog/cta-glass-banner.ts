// cta-glass-banner — a wide glass call-to-action bar (§13 prebuilt library, cta
// category). The SR-smashing move: a thick beveled-glass panel spanning the
// banner, lit so the chamfered edges glint, with a single crisp specular band
// sweeping diagonally across the surface (`light-sweep`) — the kind of premium
// glass-bar CTA Slider Revolution fakes with CSS gradients, here rendered with
// real PBR transmission glass + IBL + a moving emissive streak.
//
// COMPOSITION (cluster-local, origin 0,0,0):
//   • frame  — a brushed-brass plinth bar behind/under the glass, giving the
//     panel a premium machined surround the glass refracts + reflects.
//   • glass  — the wide beveled-glass banner panel (the centerpiece). Carries
//     BOTH integrated effects: `bevel-glass` (chamfered glinting edges) and
//     `light-sweep` (the diagonal specular band). Transmission glass material
//     so it reads as real thick glass standalone at T1.
//   • headline — REAL MSDF text (INV-11, never diffusion), rising glyph-by-
//     glyph via `text-fade-up-each`, framed inside the bar.
//   • button — a polished-chrome rounded CTA pill (a flat capsule) with a warm
//     emissive lift, sitting to the right inside the banner.
//   • label   — a small MSDF caption on the button ("GET STARTED").
//
// Integrated animation = bevel-glass + light-sweep + text-fade-up-each — exactly
// the suggested trio, all verified real registry names:
//   grep -rl "name: 'bevel-glass'"     src/lib/prism/animatable/primitives/  ✓
//   grep -rl "name: 'light-sweep'"     src/lib/prism/animatable/primitives/  ✓
//   grep -rl "name: 'text-fade-up-each'" src/lib/prism/animatable/primitives/ ✓
//
// Photorealism is procedural PBR + IBL (free) — no fal imagery needed.
//
// Tier: T1 full-fidelity (transmission glass + bevel glint + sweep). Clean T0
// fallback: the glass still reads as a lit, beveled, slightly-tinted panel with
// a brass frame + crisp MSDF headline even without screen-space transmission /
// GI (the bevel-glass primitive already degrades alpha-only — see its header).
// INV-9.

import { registerElement } from '../registry';
import type { ElementClusterDefinition } from '../contract';

// Banner dimensions (scene units) — a wide, shallow bar.
const BANNER_W = 4.2;
const BANNER_H = 1.2;
const GLASS_DEPTH = 0.22;

const ctaGlassBanner: ElementClusterDefinition = {
  id: 'cta-glass-banner',
  label: 'Glass CTA Banner',
  category: 'cta',
  caption: 'A wide glass call-to-action bar with a sweeping light streak',
  description: 'A beveled glass banner that glints and sweeps, with a kinetic headline and a chrome button.',
  members: [
    // ── Frame — a brushed-brass plinth bar behind/under the glass. Gives the
    // glass a premium machined surround to refract + reflect, and reads as a
    // solid CTA bar even at T0. A thin wide box.
    {
      localId: 'frame',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Banner frame',
      renderMode: 'mesh',
      pose: {
        x: 0,
        y: 0,
        z: -0.16,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      footprint: { width: BANNER_W + 0.24, height: BANNER_H + 0.24 },
      meshPrimitive: {
        kind: 'cube',
        params: { width: BANNER_W + 0.24, height: BANNER_H + 0.24, depth: 0.18 },
      },
      // Brushed brass: high metalness, mid-low roughness, warm Observatory-brass
      // base, generous env reflection so the studio IBL catches the surround.
      materialSpec: {
        baseColor: '#c9a86a',
        metalness: 0.95,
        roughness: 0.32,
        clearcoat: 0.4,
        clearcoatRoughness: 0.25,
        envMapIntensity: 1.3,
      },
      receivesLighting: true,
    },
    // ── Glass — the wide beveled-glass banner panel (the centerpiece). Real
    // transmission glass material so it reads photoreal standalone; carries the
    // two integrated surface effects.
    {
      localId: 'glass',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Glass banner panel',
      renderMode: 'mesh',
      pose: {
        x: 0,
        y: 0,
        z: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      footprint: { width: BANNER_W, height: BANNER_H },
      meshPrimitive: {
        kind: 'cube',
        params: { width: BANNER_W, height: BANNER_H, depth: GLASS_DEPTH },
      },
      // Premium glass recipe: high transmission, ior 1.5, faint dispersion,
      // full clearcoat, very low roughness, real slab thickness. A barely-cool
      // ice tint (NOT purple) so the edges read green/steel under Beer–Lambert.
      materialSpec: {
        baseColor: '#dfe9ee',
        metalness: 0.0,
        roughness: 0.06,
        transmission: 0.92,
        ior: 1.5,
        dispersion: 0.04,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        thickness: 0.5,
        envMapIntensity: 1.5,
      },
      receivesLighting: true,
      // INTEGRATED animation: chamfered glinting edges (bevel-glass) + a crisp
      // diagonal specular band sweeping across the surface (light-sweep). Both
      // are real registry primitives, time-driven for ambient motion.
      animationBindings: [
        {
          id: 'ab-cta-glass-bevel',
          primitive: 'bevel-glass',
          driver: 'time',
          params: { bevel: 0.2, thickness: 1.6, ior: 1.5, shimmer: 0.5 },
          order: 0,
        },
        {
          id: 'ab-cta-glass-sweep',
          primitive: 'light-sweep',
          driver: 'time',
          params: { speed: 0.9, width: 0.16, angleDeg: 32, intensity: 1.7, tint: '#f4e9cf' },
          order: 1,
        },
      ],
    },
    // ── Headline — REAL MSDF text (INV-11), rising glyph-by-glyph, framed
    // inside the left of the bar. Modest fontSize so it sits inside the panel.
    {
      localId: 'headline',
      subtype: 'text',
      serviceTag: 'decor',
      caption: 'Banner headline',
      renderMode: 'text',
      pose: {
        x: -1.0,
        y: 0.0,
        z: 0.16,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      footprint: { width: 2.2, height: 0.5 },
      textSpec: {
        content: 'START BUILDING',
        fontFamily: 'Inter',
        fontWeight: 700,
        fontSize: 0.34,
        align: 'center',
        letterSpacing: 0.03,
        fill: { kind: 'gradient', from: '#f0e2bd', to: '#a9c8d8', angleDeg: 12 },
        decompose: 'glyph',
      },
      // INTEGRATED animation: a kinetic per-glyph rise-and-fade reveal.
      animationBindings: [
        {
          id: 'ab-cta-headline-reveal',
          primitive: 'text-fade-up-each',
          driver: 'time',
          params: { duration: 1.1, stagger: 0.06, rise: 0.35 },
          order: 0,
        },
      ],
    },
    // ── Button — a polished-chrome rounded CTA pill (a flat capsule on its
    // side), warm emissive lift so it reads as the actionable element. Sits to
    // the right inside the banner.
    {
      localId: 'button',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'CTA button',
      renderMode: 'mesh',
      pose: {
        x: 1.32,
        y: 0,
        z: 0.16,
        rotationX: 0,
        rotationY: 0,
        rotationZ: Math.PI / 2,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      footprint: { width: 1.2, height: 0.46 },
      meshPrimitive: {
        kind: 'capsule',
        params: { radius: 0.22, length: 0.78, segments: 32 },
      },
      // Polished chrome with a warm brass tint + emissive lift so it pops as the
      // primary action.
      materialSpec: {
        baseColor: '#d8b878',
        metalness: 1.0,
        roughness: 0.08,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.6,
        emissive: '#3a2c12',
        emissiveIntensity: 0.4,
      },
      receivesLighting: true,
    },
    // ── Button label — small MSDF caption on the button face (INV-11).
    {
      localId: 'button-label',
      subtype: 'text',
      serviceTag: 'decor',
      caption: 'Button label',
      renderMode: 'text',
      pose: {
        x: 1.32,
        y: 0,
        z: 0.4,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      footprint: { width: 1.0, height: 0.28 },
      textSpec: {
        content: 'GET STARTED',
        fontFamily: 'Inter',
        fontWeight: 700,
        fontSize: 0.14,
        align: 'center',
        letterSpacing: 0.04,
        fill: { kind: 'solid', color: '#1d1a12' },
      },
    },
  ],
  preview: {
    // Frame the whole wide bar from slightly above, gentle three-quarter view so
    // the bevel + sweep + button all read in a ~4:3 tile.
    camera: { distance: 6.4, polar: Math.PI / 2.2, azimuth: Math.PI * 0.06 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T1',
  },
  // Recommend a warm-key studio look at place time (additive; never forces a
  // hub-wide change unless the placement opts in).
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.4,
    ambientIntensity: 0.26,
    shadowSoftness: 0.5,
  },
  designRefs: [
    'PBR transmission glass',
    'beveled glass edge glint',
    'sweeping specular light band',
    'kinetic typography reveal',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(ctaGlassBanner);
export default ctaGlassBanner;
