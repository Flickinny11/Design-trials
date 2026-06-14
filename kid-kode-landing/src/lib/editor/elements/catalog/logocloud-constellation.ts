// logocloud-constellation — a logo cloud rendered as a living constellation
// (§13 / catalog plan, LOGO-CLOUD). Six premium logo "chips" (thin beveled
// mesh plates wearing brushed-brass / ice-steel / obsidian / iridescent PBR)
// float at varying depths in an organic scatter, and a transparent net
// backplate threads them together with hairline starlight: the SR-smashing
// move is `constellation-net` (a living net of drifting star motes that form
// and dissolve proximity links as they wander) wiring the brand marks into one
// slowly breathing constellation, while each chip drifts on its own gentle
// ambient bob (`float`) AND parallaxes by depth under the cursor
// (`parallax-layers`). The chips sit at different z, so the whole cloud reads
// as a 3D star map of logos — real PBR + IBL + an instanced TSL particle net,
// not CSS sprites.
//
// Every member is a real, editable PrismNode: move / recolor / re-skin (drop a
// brand mark onto any chip via the Change-Artifact upload), or re-bind any
// animation post-place. Photorealism is procedural PBR + lighting (free) —
// NO hero imagery is needed for the look. Palette = Observatory Brass
// (brass/gold + ice/steel blues + charcoal/obsidian + a faint iridescent
// accent chip). NO purple.
//
// Tier: T1 full-fidelity — the chips read as lit beveled plates and the net as
// luminous starlight at T1; degraded to T0 (IBL + ambient only) the chips
// still read as clean metal/glass plates and the net's additive motes still
// glow, so it is never broken (INV-9). Text is real MSDF (INV-11), never
// diffusion.

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';
import type { ScenePosition } from '@/lib/prism-graph/types';

// A clean ScenePosition with all 9 required fields populated.
function pose(
  x: number,
  y: number,
  z: number,
  opts?: Partial<Pick<ScenePosition, 'rotationX' | 'rotationY' | 'rotationZ' | 'scaleX' | 'scaleY' | 'scaleZ'>>,
): ScenePosition {
  return {
    x,
    y,
    z,
    rotationX: opts?.rotationX ?? 0,
    rotationY: opts?.rotationY ?? 0,
    rotationZ: opts?.rotationZ ?? 0,
    scaleX: opts?.scaleX ?? 1,
    scaleY: opts?.scaleY ?? 1,
    scaleZ: opts?.scaleZ ?? 1,
  };
}

const CHIP_DEPTH = 0.07; // thin beveled plate

// Six logo chips scattered as a constellation (organic, NOT a ring): varied
// x/y and — crucially — varied z (depth) so the cloud reads as a 3D star map
// and the pointer parallax separates the layers. Each chip carries its own PBR
// recipe from the Observatory-Brass palette + a per-chip ambient `float` cadence
// (deeper chips drift slower / smaller) so the constellation breathes.
interface ChipSpec {
  id: string;
  x: number;
  y: number;
  z: number;
  rot: number; // gentle in-plane tilt (rad)
  w: number;
  h: number;
  material: ClusterMemberTemplate['materialSpec'];
  // float cadence — deeper (more negative z) chips drift slower + less.
  floatSpeed: number;
  floatAmp: number;
  floatTilt: number;
}

const CHIPS: ChipSpec[] = [
  {
    // Brushed-brass mark, front-right, the brightest anchor of the cloud — now
    // wearing a brushed-brass macro so the chip reads as a real metal brand tile.
    id: 'logo-0',
    x: 1.25, y: 0.62, z: 0.55, rot: -0.08, w: 0.92, h: 0.62,
    material: {
      baseColor: '#ffffff', baseColorMapUrl: '/prism-mock/orrery/materia/brass-macro.png',
      metalness: 0.0, roughness: 0.42,
      clearcoat: 0.6, clearcoatRoughness: 0.12, envMapIntensity: 1.0,
    },
    floatSpeed: 1.35, floatAmp: 0.16, floatTilt: 7,
  },
  {
    // Upper-left mark — a liquid-gold/brass swirl macro for a glossy abstract
    // brand tile that catches the warm key.
    id: 'logo-1',
    x: -1.32, y: 0.84, z: 0.18, rot: 0.1, w: 0.78, h: 0.56,
    material: {
      baseColor: '#ffffff', baseColorMapUrl: '/prism-mock/library-content/abstract-gold.png',
      metalness: 0.0, roughness: 0.42,
      clearcoat: 0.6, clearcoatRoughness: 0.12, envMapIntensity: 1.0,
    },
    floatSpeed: 1.15, floatAmp: 0.14, floatTilt: 6,
  },
  {
    // Center-low mark, mid depth — a sapphire-crystal macro for an icy-blue
    // brand tile that balances the warm chips.
    id: 'logo-2',
    x: -0.18, y: -0.78, z: 0.3, rot: -0.04, w: 0.86, h: 0.58,
    material: {
      baseColor: '#ffffff', baseColorMapUrl: '/prism-mock/orrery/materia/sapphire-macro.png',
      metalness: 0.0, roughness: 0.42,
      clearcoat: 0.6, clearcoatRoughness: 0.12, envMapIntensity: 1.0,
    },
    floatSpeed: 1.05, floatAmp: 0.13, floatTilt: 5,
  },
  {
    // Right-low accent mark — a dark iridescent glass-dispersion macro for the
    // soap-bubble shimmer that gives the cloud its premium glint (NOT purple).
    // Keep a touch of thin-film iridescence over the photo for the glint.
    id: 'logo-3',
    x: 1.05, y: -0.66, z: -0.1, rot: 0.06, w: 0.72, h: 0.5,
    material: {
      baseColor: '#ffffff', baseColorMapUrl: '/prism-mock/library-content/abstract-glass.png',
      metalness: 0.0, roughness: 0.42,
      iridescence: 0.5, iridescenceIOR: 1.3,
      clearcoat: 0.6, clearcoatRoughness: 0.12, envMapIntensity: 1.0,
    },
    floatSpeed: 0.92, floatAmp: 0.11, floatTilt: 5,
  },
  {
    // Left-mid mark, deeper — a meteorite macro for a dark, weighty brand tile
    // that anchors the cloud.
    id: 'logo-4',
    x: -1.5, y: -0.32, z: -0.35, rot: -0.12, w: 0.7, h: 0.5,
    material: {
      baseColor: '#ffffff', baseColorMapUrl: '/prism-mock/orrery/materia/meteorite-macro.png',
      metalness: 0.0, roughness: 0.42,
      clearcoat: 0.6, clearcoatRoughness: 0.12, envMapIntensity: 1.0,
    },
    floatSpeed: 0.8, floatAmp: 0.1, floatTilt: 4,
  },
  {
    // Top-center mark, deepest — a cosmic brass-planet macro for the faintest,
    // slowest-drifting star tile, warm-gold to echo the brass anchor.
    id: 'logo-5',
    x: 0.32, y: 1.02, z: -0.5, rot: 0.05, w: 0.66, h: 0.46,
    material: {
      baseColor: '#ffffff', baseColorMapUrl: '/prism-mock/orrery/celestia/planet-brass.png',
      metalness: 0.0, roughness: 0.42,
      clearcoat: 0.6, clearcoatRoughness: 0.12, envMapIntensity: 1.0,
    },
    floatSpeed: 0.7, floatAmp: 0.09, floatTilt: 4,
  },
];

function buildChips(): ClusterMemberTemplate[] {
  return CHIPS.map((c) => ({
    localId: c.id,
    subtype: 'card',
    serviceTag: 'decor',
    caption: `Brand logo ${Number(c.id.split('-')[1]) + 1}`,
    renderMode: 'mesh',
    pose: pose(c.x, c.y, c.z, { rotationZ: c.rot }),
    footprint: { width: c.w, height: c.h },
    // Thin beveled plate — the logo chip. Drop a brand mark onto its front face
    // post-place via the Change-Artifact upload; the geometry IS the artifact.
    meshPrimitive: {
      kind: 'cube',
      params: { width: c.w, height: c.h, depth: CHIP_DEPTH },
    },
    materialSpec: c.material,
    receivesLighting: true,
    // INTEGRATED animation, two layers, both verified registry names:
    //  • `float` (transform/time) — a gentle ambient bob, per-depth cadence, so
    //    the whole constellation visibly drifts even before the cursor moves.
    //  • `parallax-layers` (pointer) — depth-reactive parallax under the cursor
    //    (the catalog-plan suggested binding). It is the documented depth-
    //    parallax primitive and stays fully swappable via the Animation Picker.
    animationBindings: [
      {
        id: `ab-logocloud-${c.id}-float`,
        primitive: 'float',
        driver: 'time',
        params: { speed: c.floatSpeed, amplitude: c.floatAmp, tiltDeg: c.floatTilt },
        order: 0,
      },
      {
        id: `ab-logocloud-${c.id}-parallax`,
        primitive: 'parallax-layers',
        driver: 'pointer',
        // Deeper chips parallax a touch more for a convincing 3D star map.
        params: { strength: 0.55, depthSpread: 1.1, invert: false },
        order: 1,
      },
    ],
  }));
}

const logocloudConstellation: ElementClusterDefinition = {
  id: 'logocloud-constellation',
  label: 'Constellation Logo Cloud',
  category: 'logo-cloud',
  caption: 'Brand logos floating as a slowly drifting, cursor-parallaxed constellation',
  description: 'PBR logo chips threaded by a living net of starlight — a 3D constellation of brand marks.',
  members: [
    // ── The constellation net — a transparent backplate carrying
    // `constellation-net` (verified registry primitive, category 'particles',
    // subject 'empty', time-driven). It spawns its own drifting star motes and
    // threads hairline proximity links between them, so the logo chips read as
    // wired into one breathing constellation. Sits behind the chips (negative z),
    // unlit (the net is additive starlight, not a PBR surface). The net is the
    // centerpiece SR-smashing move.
    {
      localId: 'constellation-net',
      subtype: 'element',
      serviceTag: 'decor',
      caption: 'Constellation net',
      renderMode: 'mesh',
      pose: pose(0, 0, -0.7),
      footprint: { width: 4.4, height: 3.2 },
      // A near-invisible carrier plate — the net primitive adds its own motes /
      // links to this object; the plate itself stays dark + transparent so only
      // the starlight reads.
      meshPrimitive: {
        kind: 'plane',
        params: { width: 4.4, height: 3.2, segments: 1 },
      },
      materialSpec: {
        baseColor: '#0c0e14',
        metalness: 0,
        roughness: 1,
        opacity: 0.0,
        envMapIntensity: 0,
      },
      receivesLighting: false,
      // INTEGRATED animation: the living constellation net (time-driven).
      // Tuned warm/ice to the Observatory-Brass world; a generous link reach so
      // the marks read as wired together, a lazy drift so it breathes.
      animationBindings: [
        {
          id: 'ab-logocloud-net',
          primitive: 'constellation-net',
          driver: 'time',
          params: {
            starCount: 54,
            linkDistance: 0.72,
            driftSpeed: 0.38,
            linkBrightness: 1.35,
            coreColor: '#eaf2ff',
            brassColor: '#e8b873',
          },
          order: 0,
        },
      ],
    },
    // ── The logo chips (each floats + parallaxes; see buildChips).
    ...buildChips(),
    // ── Cloud caption — REAL MSDF text (INV-11), modest size so it frames at
    // the foot of the constellation rather than dominating it. Sits in front of
    // the chips on a brass→ice gradient fill.
    {
      localId: 'cloud-label',
      subtype: 'text',
      serviceTag: 'decor',
      caption: 'Logo cloud caption',
      renderMode: 'text',
      pose: pose(0, -1.5, 0.7),
      footprint: { width: 2.6, height: 0.4 },
      textSpec: {
        content: 'TRUSTED BY',
        fontFamily: 'Inter',
        fontWeight: 600,
        fontSize: 0.32,
        align: 'center',
        letterSpacing: 0.08,
        fill: { kind: 'gradient', from: '#e8d6a6', to: '#9fc3d6', angleDeg: 16 },
        decompose: 'glyph',
      },
    },
  ],
  preview: {
    // Frame the whole scatter head-on from slightly above so all six chips, the
    // net, and the caption read inside a ~4:3 tile. Slight azimuth gives the
    // depth layers a touch of separation.
    camera: { distance: 6.4, polar: Math.PI / 2.25, azimuth: Math.PI * 0.06 },
    frozenPhase: 0.4,
    loopSeconds: 8,
    tier: 'T1',
  },
  // Warm-key studio look recommendation at place time (additive; never forces a
  // hub-wide change unless the placement opts in).
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.3,
    ambientIntensity: 0.3,
    shadowSoftness: 0.55,
  },
  designRefs: [
    'TSL/WebGPU particle constellation net',
    'depth parallax (pointer-driven layers)',
    'PBR clearcoat metal + thin-film iridescence',
    'kinetic MSDF typography',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(logocloudConstellation);
export default logocloudConstellation;
