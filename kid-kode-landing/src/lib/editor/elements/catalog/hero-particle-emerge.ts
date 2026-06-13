// hero-particle-emerge — a photoreal 3D hero whose mark ASSEMBLES from a
// particle cloud as the headline reveals (§13 element; catalog roster "HEROES").
// The SR-smashing move: a scattered chaos cloud of points converges onto a
// crisp sphere-shell formation around a polished obsidian mark-disc, while a
// brushed-brass framing ring catches the studio IBL and an MSDF headline sweeps
// in edge-to-edge through a soft reveal front. Where Slider Revolution fakes
// "particle to logo" with sprite-sheet overlays, this is a real THREE.Points
// field driven by a deterministic assembly primitive + real PBR centerpiece +
// real MSDF letterforms (INV-11, never diffusion-baked text).
//
// Composition (cluster-local, origin 0,0,0):
//   • backdrop      — large softly-lit charcoal panel (depth + reflections).
//   • frame-ring    — brushed-brass torus framing the mark (Observatory Brass).
//   • mark-disc     — polished obsidian cylinder centerpiece (the assembled mark).
//   • particle-field— an empty member carrying `particle-assemble`: the chaos
//                     cloud that converges onto a sphere shell around the mark.
//   • headline      — REAL MSDF text below, revealed via `text-mask-reveal`.
//
// INTEGRATED animation (both verified registered):
//   • particle-field — `particle-assemble` (particles category): scatter → snap
//     into a sphere-shell formation. driver:'time'. This IS the emerge move.
//   • headline       — `text-mask-reveal` (text category): a soft alpha front
//     sweeps the line left→right as the cloud lands. driver:'time'.
//
// Photorealism is procedural PBR + studio IBL (free) — no hero imagery needed.
// Palette: Observatory Brass (brass/gold + ice-steel + charcoal/obsidian). No
// purple. Tier: T2 full-fidelity (the additive particle field + GI reflections
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
  caption: 'A mark assembles from a particle cloud as the headline reveals',
  description:
    'A real point-cloud converges onto an obsidian mark inside a brass ring, with an MSDF headline sweeping in.',
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
      materialSpec: {
        baseColor: '#15171f',
        metalness: 0.7,
        roughness: 0.18,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.5,
      },
      receivesLighting: true,
    },
    // ── Particle field ── an EMPTY member (no geometry) carrying the
    // `particle-assemble` primitive: the primitive builds its own THREE.Points,
    // scattering ~520 points then converging onto a sphere shell (~radius 1.05)
    // centered on the mark. This is the literal "emerge" move. Sits just in
    // front of the disc so the assembling shell wraps the medallion.
    {
      localId: 'particle-field',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Emerge particle field',
      renderMode: 'mesh',
      pose: pose({ y: 0.15, z: 0.05 }),
      footprint: { width: 2.3, height: 2.3 },
      // INTEGRATED animation: the chaos-cloud → sphere-shell assembly.
      animationBindings: [
        {
          id: 'ab-hero-emerge-assemble',
          primitive: 'particle-assemble',
          driver: 'time',
          params: { duration: 2.4, shape: 'sphere', scatter: 3.4, count: 520, size: 0.045 },
          order: 0,
        },
      ],
    },
    // ── Headline ── REAL MSDF text (INV-11) below the mark, revealed by a soft
    // alpha front sweeping left→right as the cloud lands. Modest fontSize so the
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
      // INTEGRATED animation: a soft reveal front sweeps the headline edge-to-
      // edge, timed to land with the particle assembly.
      animationBindings: [
        {
          id: 'ab-hero-emerge-headline',
          primitive: 'text-mask-reveal',
          driver: 'time',
          params: { duration: 1.8, softness: 0.22, direction: 'ltr' },
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
    'image-to-particles emergence',
    'particle-assemble formation',
    'kinetic typography reveal',
    'PBR obsidian + brushed-brass studio IBL',
  ],
  tier: 'T2',
  featured: true,
};

registerElement(heroParticleEmerge);
export default heroParticleEmerge;
