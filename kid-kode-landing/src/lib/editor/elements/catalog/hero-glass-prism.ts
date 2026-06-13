// hero-glass-prism — a dispersive cut-glass prism hero (§13 element). A central
// faceted glass prism (an upright cone — a tall crystal spire) splits light into
// chromatic fringes (real PBR transmission + dispersion), flanked by two smaller
// ice-tinted crystal shards on a shallow arc so the composition reads as a
// refraction study. A wide charcoal pedestal plane grounds it and catches the
// caustic glints; volumetric godray shafts rake across the scene from upper-left;
// and a crisp MSDF headline (real glyphs — INV-11, never diffusion) sits below,
// splitting into 3D as it reveals. The SR-smashing move: physically dispersive
// glass + volumetric godrays in ONE composed cluster — Slider Revolution can fake
// neither, it only crossfades flat layers.
//
// INTEGRATED animation (all real registry primitives, verified registered):
//   • prism      — `dispersion` (glass category): chromatic dispersion splits the
//                  fresnel rim into shifting RGB fringes. driver 'time'.
//   • prism      — `float` (transform): a slow weightless bob + tilt so the spire
//                  breathes and the dispersion catches new angles. driver 'time'.
//   • godray     — `godray` (volumetric, T2): raking light shafts. Degrades
//                  gracefully — drops out clean at T0, leaving the lit glass.
//   • headline   — `split-3d` (text): the headline splits + swings into place in
//                  3D, glyph by glyph. driver 'time'.
//
// Photorealism is procedural PBR transmission + IBL + volumetric (free) — no fal
// imagery is needed.
//
// Tier: T2 full-fidelity (godrays + screen-space dispersion). MUST still read
// clean at T0: without volumetrics/GI the prism still reads as a lit, refractive
// ice-glass spire flanked by crystal shards on a charcoal pedestal, with a crisp
// MSDF headline. Never broken. INV-9.

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';

// ── Composition (cluster-local space, origin 0,0,0) ──────────────────────────
// A centerpiece spire on a pedestal, two shards on a shallow front arc, a
// headline below, and a volumetric godray emitter behind the spire.
const SHARD_ARC_RADIUS = 1.55;
const SHARD_ANGLE = Math.PI / 5; // ~36° off-center, splayed left/right of front

// Glass recipe (premium PBR transmission) — ice-clear, faintly steel-blue.
const PRISM_GLASS = {
  baseColor: '#cfe0ea',
  metalness: 0,
  roughness: 0.05,
  transmission: 0.94,
  ior: 1.52,
  dispersion: 0.05,
  clearcoat: 1.0,
  clearcoatRoughness: 0.04,
  thickness: 0.7,
  envMapIntensity: 1.5,
} as const;

// Smaller shard glass — a touch warmer/brassier in the fringe, slightly frostier.
const SHARD_GLASS = {
  baseColor: '#d9e6ec',
  metalness: 0,
  roughness: 0.08,
  transmission: 0.9,
  ior: 1.48,
  dispersion: 0.045,
  clearcoat: 1.0,
  clearcoatRoughness: 0.06,
  thickness: 0.45,
  envMapIntensity: 1.35,
} as const;

function buildShards(): ClusterMemberTemplate[] {
  // Two crystal shards splayed on a shallow front arc, leaning slightly outward.
  return [-1, 1].map((side, i) => {
    const angle = side * SHARD_ANGLE;
    const x = Math.sin(angle) * SHARD_ARC_RADIUS;
    const z = Math.cos(angle) * SHARD_ARC_RADIUS * 0.4; // pulled forward, flat-ish arc
    return {
      localId: `shard-${i}`,
      subtype: 'element',
      serviceTag: 'decor',
      caption: `Crystal shard ${i + 1}`,
      renderMode: 'mesh',
      pose: {
        x,
        y: -0.35,
        z,
        rotationX: 0,
        rotationY: -angle,
        rotationZ: side * 0.18, // a slight outward lean
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      footprint: { width: 0.7, height: 1.2 },
      meshPrimitive: {
        // A short faceted spire — low segment count reads as cut facets.
        kind: 'cone',
        params: { radius: 0.34, height: 1.0, segments: 6 },
      },
      materialSpec: { ...SHARD_GLASS },
      receivesLighting: true,
    } satisfies ClusterMemberTemplate;
  });
}

const heroGlassPrism: ElementClusterDefinition = {
  id: 'hero-glass-prism',
  label: 'Glass Prism Hero',
  category: 'hero',
  caption: 'A dispersive cut-glass prism splitting light, with a crisp headline',
  description:
    'A faceted glass spire splits light into RGB fringes under raking godrays, with a 3D-splitting MSDF headline.',
  members: [
    // ── Pedestal — a wide charcoal plane the prism stands on; catches caustic
    // glints + grounds the composition. Unlit-by-default plane opted into
    // lighting for a soft gradient catch.
    {
      localId: 'pedestal',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Prism pedestal',
      renderMode: 'mesh',
      pose: {
        x: 0,
        y: -1.15,
        z: -0.1,
        rotationX: -Math.PI / 2, // lay the plane flat as a floor
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      footprint: { width: 4.6, height: 3.2 },
      meshPrimitive: {
        kind: 'plane',
        params: { width: 4.6, height: 3.2 },
      },
      materialSpec: {
        baseColor: '#15171f', // charcoal / obsidian floor
        metalness: 0.45,
        roughness: 0.32,
        clearcoat: 0.8,
        clearcoatRoughness: 0.25,
        envMapIntensity: 1.0,
      },
      receivesLighting: true,
    },
    // ── Prism — the dispersive centerpiece spire (tall faceted glass cone). The
    // hero artifact: real PBR transmission + dispersion. Carries the dispersion
    // + float integrated animation.
    {
      localId: 'prism',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Glass prism',
      renderMode: 'mesh',
      pose: {
        x: 0,
        y: 0.15,
        z: 0,
        rotationX: 0,
        rotationY: Math.PI / 8, // slight three-quarter turn so a facet catches light
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      footprint: { width: 1.3, height: 2.4 },
      meshPrimitive: {
        // Tall, sharply faceted cone — a hexagonal crystal prism.
        kind: 'cone',
        params: { radius: 0.62, height: 2.1, segments: 6 },
      },
      materialSpec: { ...PRISM_GLASS },
      receivesLighting: true,
      // INTEGRATED animation: chromatic dispersion on the fresnel rim, plus a
      // slow weightless float so the spire breathes (both 'time'-driven, ambient).
      animationBindings: [
        {
          id: 'ab-hero-prism-dispersion',
          primitive: 'dispersion',
          driver: 'time',
          params: { spread: 1.9, ior: 1.52, speed: 0.9 },
          order: 0,
        },
        {
          id: 'ab-hero-prism-float',
          primitive: 'float',
          driver: 'time',
          params: { speed: 0.5, amplitude: 0.12, tiltDeg: 7 },
          order: 1,
        },
      ],
    },
    // ── Shards — two smaller ice-glass crystals on a shallow front arc.
    ...buildShards(),
    // ── Godray emitter — a thin volumetric slab behind the spire that rakes
    // light shafts across the scene (T2). Degrades clean at T0 (drops the
    // shafts, leaves the lit glass). A subtle warm-brass emissive so it reads as
    // a backlight even before the volumetric kicks in.
    {
      localId: 'godrays',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Volumetric godrays',
      renderMode: 'mesh',
      pose: {
        x: -0.4,
        y: 0.6,
        z: -1.5,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      footprint: { width: 3.0, height: 3.0 },
      meshPrimitive: {
        kind: 'plane',
        params: { width: 3.0, height: 3.0 },
      },
      materialSpec: {
        baseColor: '#1a1d26',
        metalness: 0.0,
        roughness: 1.0,
        emissive: '#c9a86a', // warm brass backlight glow
        emissiveIntensity: 0.6,
        envMapIntensity: 0.4,
      },
      receivesLighting: false, // it IS a light source, not a lit surface
      // INTEGRATED animation: raking volumetric godray shafts from upper-left.
      animationBindings: [
        {
          id: 'ab-hero-godrays',
          primitive: 'godray',
          driver: 'time',
          params: { intensity: 1.3, decay: 0.96, density: 1.1, angleDeg: 35 },
          order: 0,
        },
      ],
    },
    // ── Headline — REAL MSDF text (INV-11), splitting + swinging into 3D. Font
    // size kept modest so it frames inside the tile under the prism.
    {
      localId: 'headline',
      subtype: 'text',
      serviceTag: 'decor',
      caption: 'Hero headline',
      renderMode: 'text',
      pose: {
        x: 0,
        y: -1.55,
        z: 0.6,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      footprint: { width: 3.2, height: 0.5 },
      textSpec: {
        content: 'SPLIT THE LIGHT',
        fontFamily: 'Inter',
        fontWeight: 700,
        fontSize: 0.34,
        align: 'center',
        letterSpacing: 0.05,
        fill: { kind: 'gradient', from: '#e8d6a6', to: '#9fc3d6', angleDeg: 18 },
        decompose: 'glyph',
      },
      // INTEGRATED animation: a per-glyph 3D split + swing reveal.
      animationBindings: [
        {
          id: 'ab-hero-headline-split',
          primitive: 'split-3d',
          driver: 'time',
          params: { duration: 1.2, spread: 2.6, angleDeg: 75 },
          order: 0,
        },
      ],
    },
  ],
  preview: {
    // Frame the spire + shards + headline from a three-quarter, slightly-above
    // view in a ~4:3 tile.
    camera: { distance: 6.0, polar: Math.PI / 2.3, azimuth: Math.PI * 0.08 },
    frozenPhase: 0.4,
    loopSeconds: 7,
    tier: 'T2',
  },
  // Recommend a cool studio look with a strong key (so transmission + dispersion
  // read) at place time. Additive; never forces a hub-wide change.
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.5,
    ambientIntensity: 0.22,
    shadowSoftness: 0.5,
  },
  designRefs: [
    'PBR transmission glass',
    'chromatic dispersion refraction',
    'volumetric godrays / light shafts',
    'kinetic 3D typography reveal',
  ],
  tier: 'T2',
  featured: true,
};

registerElement(heroGlassPrism);
export default heroGlassPrism;
