// carousel-cylinder-billboard — a 3D rotating billboard: premium panels wrapped
// around the circumference of a slowly turning cylindrical drum, framed by a
// brass cap ring, with a floating MSDF headline. This is the Slider-Revolution
// "rotating 3D carousel" move done with REAL PBR + IBL instead of CSS skews: an
// obsidian core drum, six curved-billboard panels tangent to it (alternating
// brushed brass and ice-glass), a polished brass top cap (torus), and a kinetic
// title. The INTEGRATED motion is a slow continuous turntable `spin` about Y on
// the drum + every panel (the billboard revolves), while one feature panel
// carries a `cylinder-unroll` so a panel face periodically rolls open like a
// parchment poster being unfurled on the revolving drum — the two bindings read
// together as a living, rotating advertising column.
//
// Every member is a real, editable PrismNode (move / recolor / re-skin / swap
// animation post-place). Photorealism is procedural PBR + lighting (free) — no
// generated imagery needed. Palette is Observatory Brass: warm brass / gold,
// cool ice / steel blues, charcoal-obsidian. NEVER purple.
//
// Tier: T1 full-fidelity (key/fill/rim + soft shadows make the brushed metal
// and the glass panels sing); clean fallback to T0 (IBL + ambient still reads
// the drum + panels as lit, framed billboard — never broken). INV-9.

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';
import type { ScenePosition } from '@/lib/prism-graph/types';

// ── Drum + panel geometry (cluster-local scene units) ───────────────────────
const PANEL_COUNT = 5;
const DRUM_RADIUS = 1.15; // the cylinder core radius
const DRUM_HEIGHT = 2.0;
const PANEL_RADIUS = DRUM_RADIUS + 0.13; // panels sit just proud of the drum
const PANEL_W = 1.18; // panel chord width (a touch under the arc gap)
const PANEL_H = 1.62;
const PANEL_DEPTH = 0.07;

/** A full ScenePosition with all nine fields (the contract requires it). */
function pose(
  x: number,
  y: number,
  z: number,
  rotationY: number,
  opts?: Partial<ScenePosition>,
): ScenePosition {
  return {
    x,
    y,
    z,
    rotationX: 0,
    rotationY,
    rotationZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    ...opts,
  };
}

// Alternating premium content for the wrapped panels: three OPAQUE poster panels
// that each carry a real premium photo (portrait-oriented to match the tall panel
// footprint), interleaved with two ice-glass refractive panels (kept transmissive,
// NO photo — they read as the glass between the posters). The photo panels use a
// glossy "photo-print" PBR (white base so the map shows true color, light clearcoat
// gloss) so the imagery sings under IBL instead of sitting flat. Observatory Brass
// is preserved for the glass tint and all chrome. NEVER purple.
const PANEL_PALETTE: Array<{
  baseColor: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness?: number;
  baseColorMapUrl?: string; // photo skin for the opaque poster panels
  transmission?: number;
  ior?: number;
  dispersion?: number;
  thickness?: number;
  envMapIntensity: number;
}> = [
  // poster 1 — flowing amber/teal silk (portrait): the brass-feature panel that unrolls
  {
    baseColor: '#ffffff',
    metalness: 0.0,
    roughness: 0.42,
    clearcoat: 0.6,
    clearcoatRoughness: 0.12,
    baseColorMapUrl: '/prism-mock/library-content/editorial-silk.png',
    envMapIntensity: 1.0,
  },
  // ice glass — refractive panel between posters (no photo, stays transmissive)
  { baseColor: '#9fc3d6', metalness: 0.0, roughness: 0.06, clearcoat: 1, transmission: 0.92, ior: 1.5, dispersion: 0.04, thickness: 0.5, envMapIntensity: 1.6 },
  // poster 2 — luxury perfume bottle, studio (portrait)
  {
    baseColor: '#ffffff',
    metalness: 0.0,
    roughness: 0.42,
    clearcoat: 0.6,
    clearcoatRoughness: 0.12,
    baseColorMapUrl: '/prism-mock/library-content/product-scent.png',
    envMapIntensity: 1.0,
  },
  // steel-frost glass — refractive panel between posters (no photo, stays transmissive)
  { baseColor: '#aebfcb', metalness: 0.0, roughness: 0.07, clearcoat: 1, transmission: 0.9, ior: 1.5, dispersion: 0.04, thickness: 0.5, envMapIntensity: 1.55 },
  // poster 3 — premium headphones, studio (portrait)
  {
    baseColor: '#ffffff',
    metalness: 0.0,
    roughness: 0.42,
    clearcoat: 0.6,
    clearcoatRoughness: 0.12,
    baseColorMapUrl: '/prism-mock/library-content/product-audio.png',
    envMapIntensity: 1.0,
  },
];

function buildMembers(): ClusterMemberTemplate[] {
  const members: ClusterMemberTemplate[] = [];

  // ── 1. The obsidian core drum (the billboard column). A polished-charcoal
  // cylinder the panels wrap; it spins as one with the panels (turntable). ──
  members.push({
    localId: 'drum',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Billboard drum',
    renderMode: 'mesh',
    pose: pose(0, 0, 0, 0),
    footprint: { width: DRUM_RADIUS * 2, height: DRUM_HEIGHT },
    meshPrimitive: {
      kind: 'cylinder',
      params: { radius: DRUM_RADIUS, height: DRUM_HEIGHT, segments: 64 },
    },
    materialSpec: {
      baseColor: '#15171f', // obsidian charcoal
      metalness: 0.7,
      roughness: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.15,
      envMapIntensity: 1.4,
    },
    receivesLighting: true,
    // The whole billboard column revolves — slow, continuous, looping.
    animationBindings: [
      {
        id: 'ab-cbb-drum-spin',
        primitive: 'spin',
        driver: 'time',
        params: { cycle: 6, turns: 1, axis: 'y' },
        order: 0,
      },
    ],
  });

  // ── 2. The wrapped billboard panels — tangent to the drum, facing outward,
  // alternating brushed brass and ice-glass. Each revolves with the drum. ──
  for (let i = 0; i < PANEL_COUNT; i++) {
    const angle = (i / PANEL_COUNT) * Math.PI * 2;
    const x = Math.sin(angle) * PANEL_RADIUS;
    const z = Math.cos(angle) * PANEL_RADIUS;
    const pal = PANEL_PALETTE[i % PANEL_PALETTE.length];
    members.push({
      localId: `panel-${i}`,
      subtype: 'card',
      serviceTag: 'decor',
      caption: `Billboard panel ${i + 1}`,
      renderMode: 'mesh',
      // Panel faces radially outward from the drum axis (rotationY = angle).
      pose: pose(x, 0, z, angle),
      footprint: { width: PANEL_W, height: PANEL_H },
      meshPrimitive: {
        kind: 'cube',
        params: { width: PANEL_W, height: PANEL_H, depth: PANEL_DEPTH },
      },
      materialSpec: {
        baseColor: pal.baseColor,
        metalness: pal.metalness,
        roughness: pal.roughness,
        clearcoat: pal.clearcoat,
        clearcoatRoughness: pal.clearcoatRoughness ?? 0.12,
        // Opaque poster panels carry a real photo on the outward-facing front
        // face (the map multiplies the white base, so the image shows true).
        ...(pal.baseColorMapUrl !== undefined ? { baseColorMapUrl: pal.baseColorMapUrl } : {}),
        ...(pal.transmission !== undefined ? { transmission: pal.transmission } : {}),
        ...(pal.ior !== undefined ? { ior: pal.ior } : {}),
        ...(pal.dispersion !== undefined ? { dispersion: pal.dispersion } : {}),
        ...(pal.thickness !== undefined ? { thickness: pal.thickness } : {}),
        envMapIntensity: pal.envMapIntensity,
      },
      receivesLighting: true,
      // Every panel turns with the drum at the same cadence (the turntable).
      // The first (brass feature) panel additionally UNROLLS like a parchment
      // poster unfurling on the revolving column — the SR-smashing reveal.
      animationBindings:
        i === 0
          ? [
              {
                id: 'ab-cbb-panel-0-spin',
                primitive: 'spin',
                driver: 'time',
                params: { cycle: 6, turns: 1, axis: 'y' },
                order: 0,
              },
              {
                id: 'ab-cbb-panel-0-unroll',
                primitive: 'cylinder-unroll',
                driver: 'time',
                params: { duration: 4.5, radius: 0.14, direction: 'left', overshoot: 0.3 },
                order: 1,
              },
            ]
          : [
              {
                id: `ab-cbb-panel-${i}-spin`,
                primitive: 'spin',
                driver: 'time',
                params: { cycle: 6, turns: 1, axis: 'y' },
                order: 0,
              },
            ],
    });
  }

  // ── 3. Polished-brass top cap ring — frames the column like a real rotating
  // billboard fixture (a torus crowning the drum), spinning with it. ──
  members.push({
    localId: 'cap-top',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Brass cap ring',
    renderMode: 'mesh',
    pose: pose(0, DRUM_HEIGHT / 2 + 0.06, 0, 0, { rotationX: Math.PI / 2 }),
    footprint: { width: (DRUM_RADIUS + 0.18) * 2, height: (DRUM_RADIUS + 0.18) * 2 },
    meshPrimitive: {
      kind: 'torus',
      params: { radius: DRUM_RADIUS + 0.05, tube: 0.1, segments: 64 },
    },
    materialSpec: {
      baseColor: '#c9a86a', // polished chrome-brass crown
      metalness: 1,
      roughness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.6,
    },
    receivesLighting: true,
    animationBindings: [
      {
        id: 'ab-cbb-cap-spin',
        primitive: 'spin',
        driver: 'time',
        params: { cycle: 6, turns: 1, axis: 'y' },
        order: 0,
      },
    ],
  });

  // ── 4. The kinetic MSDF headline floating in front of the column (INV-11:
  // real letterforms, never baked into a texture). Modest fontSize so it frames
  // cleanly above the drum rather than overwhelming the billboard. ──
  members.push({
    localId: 'headline',
    subtype: 'text',
    serviceTag: 'decor',
    caption: 'Billboard headline',
    renderMode: 'text',
    pose: pose(0, DRUM_HEIGHT / 2 + 0.55, PANEL_RADIUS + 0.05, 0),
    footprint: { width: 2.4, height: 0.5 },
    textSpec: {
      content: 'ON THE TURN',
      fontFamily: 'Inter',
      fontSize: 0.38,
      fontWeight: 700,
      letterSpacing: 0.04,
      align: 'center',
      fill: { kind: 'gradient', from: '#e9d6a6', to: '#9fc3d6', angleDeg: 90 },
      opacity: 1,
      decompose: 'glyph',
    },
  });

  return members;
}

const carouselCylinderBillboard: ElementClusterDefinition = {
  id: 'carousel-cylinder-billboard',
  label: 'Cylinder Billboard Carousel',
  category: 'carousel',
  caption: 'Premium panels wrapped on a slowly rotating 3D billboard drum',
  description:
    'A revolving billboard column: brushed-brass and ice-glass panels wrap an obsidian drum, one panel unrolling like a poster.',
  members: buildMembers(),
  preview: {
    // Frame the whole column three-quarter from slightly above so the wrap of
    // panels reads as a cylinder and the headline sits in frame (~4:3 tile).
    camera: { distance: 6.4, polar: Math.PI / 2.4, azimuth: Math.PI * 0.12 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T1',
  },
  // Warm-key studio look recommended at place time (additive; never forces a
  // hub-wide change unless the placement opts in).
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.3,
    ambientIntensity: 0.28,
    shadowSoftness: 0.6,
  },
  designRefs: [
    'Slider Revolution rotating 3D carousel',
    'PBR transmission glass',
    'brushed-metal / polished-chrome PBR',
    'cylinder-unroll parchment reveal',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(carouselCylinderBillboard);
export default carouselCylinderBillboard;
