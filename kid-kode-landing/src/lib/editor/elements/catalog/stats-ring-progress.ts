// stats-ring-progress — a photoreal circular-progress stat counter (§13 element).
// A row of upright progress rings sits on a brushed-metal plinth; each ring
// is a polished torus that FILLS to its percentage as the page scrolls. Behind
// every bright ring sits a recessed obsidian track ring, and a real MSDF
// percentage label is centered inside each ring (INV-11 — real glyphs, never
// diffusion). The whole assembly reads photoreal standalone: polished chrome /
// antique-brass progress rings, obsidian tracks, a satin brushed-metal base.
//
// THE SR-SMASHING MOVE: the integrated animation is `scroll-progress-fill`
// (registry-verified, scroll-driven). Each progress ring's surface carries a
// fill front that sweeps around the torus in proportion to scroll position —
// circular progress rings that visibly fill to their target percentage as the
// viewer scrolls, rendered with real PBR + IBL instead of an SVG stroke-dash.
// The base plinth adds a slow ambient `gold-glint` raking-light shimmer so the
// metal feels alive even before any scroll.
//
// This is a real, fully-editable cluster: every ring / track / label / plinth is
// a normal PrismNode (move / recolor / re-skin / re-animate post-place). The
// percentages, colors, and labels are graph data — customize freely.
//
// Tier: T1 full-fidelity, clean T0 fallback (the rings still read as lit metal
// tori + crisp MSDF labels without screen-space GI; the scroll fill degrades to
// a flat tint). INV-9.

import { registerElement } from '../registry';
import type {
  ClusterMemberTemplate,
  ElementClusterDefinition,
} from '../contract';
import type { ScenePosition } from '@/lib/prism-graph/types';

// ── Layout (cluster-local space; origin 0,0,0 — the instantiator offsets by
// the drop anchor) ──────────────────────────────────────────────────────────
const RING_COUNT = 2;
const RING_SPACING = 2.1; // centre-to-centre gap between rings along X
const RING_RADIUS = 0.74; // major radius of each torus
const RING_TUBE = 0.1; // tube radius of the bright progress ring
const TRACK_TUBE = 0.12; // slightly fatter recessed track behind it
const RING_SEGMENTS = 96; // smooth, premium torus tessellation

// Centre the row of rings on X.
const ROW_START = -((RING_COUNT - 1) * RING_SPACING) / 2;

// Per-ring data (graph data, NOT chrome). Observatory Brass palette: polished
// chrome + antique brass for the progress rings, ice-steel accent, obsidian
// tracks. NO purple anywhere. Each ring fills to `percent` of its circumference.
const RINGS = [
  {
    label: '98%',
    percent: 0.98,
    // polished chrome
    progress: { baseColor: '#dfe4ec', metalness: 1.0, roughness: 0.08, clearcoat: 1.0, env: 1.6, fill: '#cfe7ff' },
  },
  {
    label: '76%',
    percent: 0.76,
    // antique brass / gold
    progress: { baseColor: '#c9a86a', metalness: 0.95, roughness: 0.22, clearcoat: 0.8, env: 1.4, fill: '#ffd994' },
  },
];

// A full ScenePosition with all 9 fields, defaulting to identity scale.
function pose(
  x: number,
  y: number,
  z: number,
  rotationX = 0,
  rotationY = 0,
  rotationZ = 0,
): ScenePosition {
  return {
    x,
    y,
    z,
    rotationX,
    rotationY,
    rotationZ,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
  };
}

function buildMembers(): ClusterMemberTemplate[] {
  const members: ClusterMemberTemplate[] = [];

  // ── Plinth — a wide, thin brushed-metal slab the rings stand on, so they have
  // structure to cast onto and the cluster reads grounded. Carries the ambient
  // gold-glint shimmer (registry 'gold-glint', verified) — a warm raking light
  // travels across the satin metal continuously, even before scroll.
  members.push({
    localId: 'plinth',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Stat plinth',
    renderMode: 'mesh',
    pose: pose(0, -1.05, -0.05),
    footprint: { width: RING_COUNT * RING_SPACING + 1.0, height: 0.3 },
    meshPrimitive: {
      kind: 'cube',
      params: { width: RING_COUNT * RING_SPACING + 1.0, height: 0.22, depth: 1.4 },
    },
    materialSpec: {
      // brushed metal recipe
      baseColor: '#3a3f49',
      metalness: 0.95,
      roughness: 0.32,
      clearcoat: 0.3,
      clearcoatRoughness: 0.4,
      envMapIntensity: 1.3,
    },
    receivesLighting: true,
    animationBindings: [
      {
        id: 'ab-stats-plinth-glint',
        primitive: 'gold-glint',
        driver: 'time',
        params: { speed: 0.6, width: 0.22, intensity: 1.1, twinkle: 6, tint: '#ffd479' },
        order: 0,
      },
    ],
  });

  for (let i = 0; i < RING_COUNT; i++) {
    const x = ROW_START + i * RING_SPACING;
    const ring = RINGS[i];

    // ── Track ring — a recessed obsidian torus sitting just behind the bright
    // progress ring, so the unfilled remainder reads as a dark machined groove.
    members.push({
      localId: `track-${i}`,
      subtype: 'element',
      serviceTag: 'decor',
      caption: `Progress track ${i + 1}`,
      renderMode: 'mesh',
      // Stand the torus upright (face the camera) by rotating it about X.
      pose: pose(x, 0, -0.06, Math.PI / 2),
      footprint: { width: (RING_RADIUS + TRACK_TUBE) * 2, height: (RING_RADIUS + TRACK_TUBE) * 2 },
      meshPrimitive: {
        kind: 'torus',
        params: { radius: RING_RADIUS, tube: TRACK_TUBE, segments: RING_SEGMENTS },
      },
      materialSpec: {
        // obsidian recipe
        baseColor: '#15171f',
        metalness: 0.7,
        roughness: 0.18,
        clearcoat: 1.0,
        clearcoatRoughness: 0.12,
        envMapIntensity: 1.1,
      },
      receivesLighting: true,
    });

    // ── Progress ring — the polished metal torus that FILLS to `percent` of its
    // circumference as the page scrolls. INTEGRATED animation: scroll-progress-
    // fill (registry-verified, driver:'scroll'). The fill front (fillColor) mixes
    // over the ring's base metal wherever the swept coord < scroll progress, with
    // a soft leading edge — the ring visibly fills as the viewer scrolls. btt
    // direction reads as a vertical "charge" up the ring.
    members.push({
      localId: `ring-${i}`,
      subtype: 'element',
      serviceTag: 'decor',
      caption: `Progress ring ${i + 1} — ${ring.label}`,
      renderMode: 'mesh',
      // Sit a hair in front of its track, same upright orientation.
      pose: pose(x, 0, 0, Math.PI / 2),
      footprint: { width: (RING_RADIUS + RING_TUBE) * 2, height: (RING_RADIUS + RING_TUBE) * 2 },
      meshPrimitive: {
        kind: 'torus',
        params: { radius: RING_RADIUS, tube: RING_TUBE, segments: RING_SEGMENTS },
      },
      materialSpec: {
        baseColor: ring.progress.baseColor,
        metalness: ring.progress.metalness,
        roughness: ring.progress.roughness,
        clearcoat: ring.progress.clearcoat,
        clearcoatRoughness: 0.1,
        envMapIntensity: ring.progress.env,
      },
      receivesLighting: true,
      animationBindings: [
        {
          id: `ab-stats-ring-${i}-fill`,
          primitive: 'scroll-progress-fill',
          driver: 'scroll',
          params: { direction: 'btt', fillColor: ring.progress.fill, softness: 0.1 },
          order: 0,
        },
      ],
    });

    // ── Percentage label — REAL MSDF text (INV-11), centered inside the ring.
    // Modest fontSize so the digits frame comfortably inside the torus aperture.
    members.push({
      localId: `label-${i}`,
      subtype: 'text',
      serviceTag: 'decor',
      caption: `Stat ${i + 1} value`,
      renderMode: 'text',
      pose: pose(x, 0, 0.12),
      footprint: { width: 1.0, height: 0.4 },
      textSpec: {
        content: ring.label,
        fontFamily: 'Inter',
        fontWeight: 700,
        fontSize: 0.38,
        align: 'center',
        letterSpacing: 0.01,
        fill: { kind: 'gradient', from: '#f0e6cf', to: '#9fc3d6', angleDeg: 90 },
        decompose: 'glyph',
      },
    });
  }

  return members;
}

export const statsRingProgress: ElementClusterDefinition = {
  id: 'stats-ring-progress',
  label: 'Ring Progress Stats',
  category: 'stat-counter',
  caption: 'Polished metal rings that fill to their percentage on scroll',
  description: 'PBR progress rings on a brushed-metal plinth, each filling to its stat as you scroll.',
  members: buildMembers(),
  preview: {
    // Frame the row of rings + plinth in a ~4:3 tile, slight three-quarter
    // view from just above eye level.
    camera: { distance: 5.6, polar: Math.PI / 2.35, azimuth: Math.PI * 0.06 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T1',
  },
  // Warm studio key recommended at place time (additive; never forces a
  // hub-wide change unless the placement opts in).
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.35,
    ambientIntensity: 0.26,
    shadowSoftness: 0.5,
  },
  designRefs: [
    'scroll-driven progress choreography',
    'PBR polished-metal + obsidian materials',
    'kinetic MSDF numeral labels',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(statsRingProgress);

export default statsRingProgress;
