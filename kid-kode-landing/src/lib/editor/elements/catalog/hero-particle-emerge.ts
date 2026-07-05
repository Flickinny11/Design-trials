// hero-particle-emerge — a photoreal 3D hero: a polished obsidian mark sits
// FULLY PRESENT inside a brushed-brass ring while an ambient point-cloud orbits
// around it and an MSDF headline glows (§13 element; catalog roster "HEROES").
// The mark never assembles-from-nothing and the headline is never masked away —
// every member runs a CONTINUOUS, always-visible motion, so the composition is
// complete and premium at every phase of the hover-preview loop. Where Slider
// Revolution fakes "particle to logo" with sprite-sheet overlays, this is a real
// THREE.Points ring system + real PBR centerpiece + real MSDF letterforms
// (INV-11, never diffusion-baked text).
//
// PREVIEW-RIG FIT: the cluster rig plays time-driven bindings on a loop and does
// NOT drive scroll/pointer in the preview. Reveal/transition primitives (e.g.
// particle-assemble, text-mask-reveal) would leave the element absent for part
// of the loop, so this element uses only CONTINUOUS primitives whose categories
// the binding player actually mounts (transform / text / particles — NOT the
// material-swap shimmer/glass/etc. categories the player skips on a mounted
// artifact).
//
// Composition (cluster-local, origin 0,0,0):
//   • backdrop      — large softly-lit charcoal panel (depth + reflections).
//   • frame-ring    — brushed-brass torus framing the mark; CONTINUOUS slow spin.
//   • mark-disc     — polished obsidian cylinder centerpiece; CONTINUOUS float.
//   • particle-field— an empty member carrying `orbit-rings`: an ambient nested
//                     ring system of points that continuously orbits the mark.
//   • headline      — REAL MSDF text below, with a continuous emissive glow pulse.
//
// INTEGRATED animation (all CONTINUOUS / always-visible, all driver:'time'):
//   • frame-ring     — `spin` (transform): slow brushed-brass ring rotation.
//   • mark-disc      — `float` (transform): gentle bob + tilt idle loop.
//   • particle-field — `orbit-rings` (particles): nested Keplerian orbital rings.
//   • headline       — `text-glow-pulse` (text): calm emissive shimmer pulse.
//
// Photorealism is procedural PBR + studio IBL (free) — no hero imagery needed.
// Palette: Observatory Brass (brass/gold + ice-steel + charcoal/obsidian). No
// purple. Tier: T2 full-fidelity (the additive orbit field + GI reflections
// shine at T2); MUST still read clean at T0 — the obsidian disc, brass ring and
// crisp MSDF headline remain a legible, composed hero without GI (INV-9).

import { registerElement } from '../registry';
import type { ElementClusterDefinition } from '../contract';
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

const heroParticleEmerge: ElementClusterDefinition = {
  id: 'hero-particle-emerge',
  label: 'Particle Emerge Hero',
  category: 'hero',
  caption: 'A point-cloud orbits a glowing obsidian mark inside a spinning brass ring',
  description:
    'A real point-cloud orbits a present obsidian mark inside a slow-spinning brass ring, with a glowing MSDF headline.',
  members: [
    // ── Backdrop ── large, softly-lit charcoal panel set well behind the
    // composition so the brass ring + obsidian disc have something to reflect
    // and the particle field reads against depth. Unlit-by-default plane opted
    // into lighting for a subtle gradient catch.
    {
      localId: 'backdrop',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Hero backdrop',
      renderMode: 'mesh',
      pose: pose({ y: 0.25, z: -1.6 }),
      footprint: { width: 5.4, height: 3.2 },
      meshPrimitive: {
        kind: 'plane',
        params: { width: 5.4, height: 3.2 },
      },
      // The backdrop now carries a real atmospheric landscape (misty golden-hour
      // peaks) instead of a flat charcoal fill — a wide 5.4×3.2 panel paired with
      // a landscape ref so orientation matches. baseColor white so the photo shows;
      // a dark-leaning glossy recipe keeps it premium and reflective so the brass
      // ring + obsidian medallion still have depth to read against (it stays a
      // recessed backdrop, never competing with the hero medallion in front).
      materialSpec: {
        baseColor: '#ffffff',
        baseColorMapUrl: '/prism-mock/library-content/landscape-peak.png',
        metalness: 0.2,
        roughness: 0.5,
        clearcoat: 0.25,
        clearcoatRoughness: 0.3,
        envMapIntensity: 0.9,
      },
      receivesLighting: true,
    },
    // ── Frame ring ── a brushed-brass torus standing upright (rotated to face
    // camera) that frames the mark. Premium brushed-metal recipe — high
    // metalness, mid roughness, strong env reflection. (Observatory Brass.)
    {
      localId: 'frame-ring',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Brass frame ring',
      renderMode: 'mesh',
      // Torus is born in the XY plane already facing +Z — no rotation needed.
      pose: pose({ y: 0.15, z: 0 }),
      footprint: { width: 2.6, height: 2.6 },
      meshPrimitive: {
        kind: 'torus',
        params: { radius: 1.18, tube: 0.07, segments: 96 },
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
      // ALWAYS-VISIBLE motion: a slow continuous spin about the ring's facing
      // axis (Z). Because the torus is rotationally symmetric, spinning it reads
      // as a brushed-brass ring shimmer/rotation that catches the studio IBL —
      // the ring is fully present at every phase (transform primitive, looping).
      animationBindings: [
        {
          id: 'ab-hero-emerge-ring-spin',
          primitive: 'spin',
          driver: 'time',
          params: { cycle: 5.4, turns: 1, axis: 'z' },
          order: 0,
        },
      ],
    },
    // ── Mark disc ── the polished-obsidian centerpiece the cloud assembles
    // around: a thin upright cylinder reading as a dark medallion/mark. Obsidian
    // recipe — near-black base, high metalness, glassy clearcoat.
    {
      localId: 'mark-disc',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Obsidian mark',
      renderMode: 'mesh',
      // Lay the cylinder on its side so its circular face fronts the camera.
      pose: pose({ y: 0.15, z: 0, rotationX: Math.PI / 2 }),
      footprint: { width: 1.6, height: 1.6 },
      meshPrimitive: {
        kind: 'cylinder',
        params: { radius: 0.78, height: 0.12, segments: 96 },
      },
      // The obsidian medallion's circular face now PRESENTS a real hero subject —
      // a luxury astronomical watch on black (on-theme with the Observatory
      // aesthetic, and a near-square ref that fronts the round disc cleanly). The
      // base map MULTIPLIES baseColor, so baseColor is pulled to white to show the
      // photo at full luminance; a glossy photo-print recipe (mid roughness +
      // strong clearcoat) keeps the premium screen/print sheen the obsidian had.
      materialSpec: {
        baseColor: '#ffffff',
        baseColorMapUrl: '/prism-mock/orrery/refs/watch-hero.png',
        metalness: 0.0,
        roughness: 0.42,
        clearcoat: 0.6,
        clearcoatRoughness: 0.12,
        envMapIntensity: 1.0,
      },
      receivesLighting: true,
      // ALWAYS-VISIBLE motion: the obsidian mark gently floats (sine bob + slow
      // tilt), a continuous idle loop (duration Infinity) so the centerpiece is
      // FULLY PRESENT and premium at every phase — never assembled-from-nothing.
      animationBindings: [
        {
          id: 'ab-hero-emerge-mark-float',
          primitive: 'float',
          driver: 'time',
          params: { speed: 0.9, amplitude: 0.06, tiltDeg: 3 },
          order: 0,
        },
      ],
    },
    // ── Particle field ── an EMPTY member (no geometry) carrying the
    // `orbit-rings` primitive: the primitive builds its own THREE.Points (540
    // icy-blue additive points) orbiting in nested Keplerian rings (radius
    // 0.45→1.7) centered on the mark. This is an AMBIENT ring system that is
    // ALWAYS PRESENT and continuously orbiting — it drifts AROUND the present
    // obsidian mark rather than assembling-from-nothing on the loop, so the
    // composition never goes scattered/empty for any part of the time loop.
    {
      localId: 'particle-field',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Ambient orbit-ring field',
      renderMode: 'mesh',
      pose: pose({ y: 0.15, z: 0.05 }),
      footprint: { width: 2.3, height: 2.3 },
      // INTEGRATED animation: continuous nested orbital rings (looping forever,
      // duration Infinity) — an ambient drift around the always-present mark.
      animationBindings: [
        {
          id: 'ab-hero-emerge-orbit',
          primitive: 'orbit-rings',
          driver: 'time',
          params: { rings: 5, speed: 0.9, tilt: 0.26, size: 0.035 },
          order: 0,
        },
      ],
    },
    // ── Headline ── REAL MSDF text (INV-11) below the mark. ALWAYS LEGIBLE: a
    // continuous soft emissive glow pulse (never a mask that hides glyphs). The
    // full word "EMERGE" reads at every phase of the loop. Modest fontSize so the
    // line frames inside the tile.
    {
      localId: 'headline',
      subtype: 'text',
      serviceTag: 'decor',
      caption: 'Hero headline',
      renderMode: 'text',
      pose: pose({ y: -1.35, z: 0.2 }),
      footprint: { width: 3.6, height: 0.5 },
      textSpec: {
        content: 'EMERGE',
        fontFamily: 'Inter',
        fontWeight: 700,
        fontSize: 0.42,
        align: 'center',
        letterSpacing: 0.08,
        fill: { kind: 'gradient', from: '#e8d6a6', to: '#9fc3d6', angleDeg: 18 },
        decompose: 'glyph',
      },
      // INTEGRATED animation: a calm continuous emissive glow pulse with a gentle
      // per-glyph phase offset (a travelling shimmer along the word). Looping
      // (duration Infinity) — the headline is FULLY PRESENT and readable at every
      // phase; nothing is ever masked or wiped.
      animationBindings: [
        {
          id: 'ab-hero-emerge-headline',
          primitive: 'text-glow-pulse',
          driver: 'time',
          params: { speed: 1.3, loGlow: 0.45, hiGlow: 1.7, phaseStep: 0.3 },
          order: 0,
        },
      ],
    },
  ],
  preview: {
    // Frame the whole composition head-on, very slightly above, so the brass
    // ring, obsidian disc, particle shell and headline all sit in a ~4:3 tile.
    camera: { distance: 5.6, polar: Math.PI / 2.1, azimuth: 0 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T2',
  },
  // Recommend a warm-key studio look at place time (additive; never forces a
  // hub-wide change). T2 GI lets the obsidian + brass reflections read fully.
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.35,
    ambientIntensity: 0.26,
    shadowSoftness: 0.55,
  },
  designRefs: [
    'orbital particle ring system',
    'continuous idle float + ring spin',
    'kinetic typography glow shimmer',
    'PBR obsidian + brushed-brass studio IBL',
  ],
  tier: 'T2',
  featured: true,
};

registerElement(heroParticleEmerge);
export default heroParticleEmerge;
