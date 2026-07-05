// carousel-photoreal-ring — a photoreal turntable carousel (§13 reference
// element #1). Six premium card members arranged in a ring around the cluster
// origin; each card is a thin beveled box (meshPrimitive cube) wearing a rich
// PBR materialSpec (brass + ice palette, subtle metalness / clearcoat / low
// roughness) so it reads photoreal standalone. The INTEGRATED animation is a
// continuous turntable: every card carries a `spin` binding about Y, so the
// whole ring slowly rotates like Slider Revolution's 3D rotating carousel —
// but rendered with real PBR + IBL instead of CSS transforms.
//
// This is a TEMPLATE Phase 2 copies: every member is a real, editable PrismNode
// (move/scale/recolor/re-skin/swap animation post-place). Photorealism here is
// procedural PBR + lighting (free) — no fal imagery needed.
//
// Tier: T1 full-fidelity (clean fallback to T0 — the cards still read as lit
// brushed cards without screen-space GI). INV-9.

import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';

const CARD_COUNT = 6;
const RING_RADIUS = 1.7;

// Card footprint (scene units) — a wide, thin panel.
const CARD_W = 1.0;
const CARD_H = 1.4;
const CARD_DEPTH = 0.08;

// Each ring panel now wears REAL premium sample imagery on its front face. The
// baseColorMapUrl photo MULTIPLIES baseColor, so baseColor is pinned to pure
// white (#ffffff) and the material is tuned to a glossy "photo print / poster"
// look (low metalness, mid roughness, clearcoat sheen) so the photo reads true
// and luminous rather than tinted brushed metal. Imagery is VARIED across
// panels — dramatic architecture, golden landscapes, botanical macro, luxury
// interior, and a portrait product still — matched to the tall card footprint.
const CARD_IMAGES = [
  '/prism-mock/library-content/arch-warm.png', // brass+glass atrium, warm gold
  '/prism-mock/library-content/landscape-dune.png', // golden sand dunes at sunrise
  '/prism-mock/library-content/landscape-peak.png', // misty mountain peaks, golden hour
  '/prism-mock/library-content/botanical.png', // dark orchid macro, chiaroscuro
  '/prism-mock/library-content/arch-interior.png', // luxury minimalist interior
  '/prism-mock/library-content/product-scent.png', // luxury perfume bottle (portrait)
];

function buildCards(): ClusterMemberTemplate[] {
  const cards: ClusterMemberTemplate[] = [];
  for (let i = 0; i < CARD_COUNT; i++) {
    const angle = (i / CARD_COUNT) * Math.PI * 2;
    const x = Math.sin(angle) * RING_RADIUS;
    const z = Math.cos(angle) * RING_RADIUS;
    const imageUrl = CARD_IMAGES[i % CARD_IMAGES.length];
    cards.push({
      localId: `card-${i}`,
      subtype: 'card',
      serviceTag: 'decor',
      caption: `Carousel card ${i + 1}`,
      renderMode: 'mesh',
      // Each card faces outward from the ring center (rotates to look at the
      // axis), so the carousel reads as a turntable of upright panels.
      pose: {
        x,
        y: 0,
        z,
        rotationX: 0,
        rotationY: angle,
        rotationZ: 0,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
      },
      footprint: { width: CARD_W, height: CARD_H },
      meshPrimitive: {
        kind: 'cube',
        params: { width: CARD_W, height: CARD_H, depth: CARD_DEPTH },
      },
      materialSpec: {
        // Real premium imagery on the front face. White base so the photo
        // shows true; glossy photo-print finish (low metalness, mid roughness,
        // clearcoat sheen) for a luminous poster look under IBL.
        baseColor: '#ffffff',
        baseColorMapUrl: imageUrl,
        metalness: 0.0,
        roughness: 0.42,
        clearcoat: 0.6,
        clearcoatRoughness: 0.12,
        envMapIntensity: 1.0,
      },
      receivesLighting: true,
      // INTEGRATED animation: a slow turntable spin about Y (registry
      // primitive 'spin', verified registered). The whole ring of cards turns.
      animationBindings: [
        {
          id: `ab-carousel-card-${i}`,
          primitive: 'spin',
          driver: 'time',
          params: { cycle: 9, turns: 1, axis: 'y' },
          order: 0,
        },
      ],
    });
  }
  return cards;
}

export const carouselPhotorealRing: ElementClusterDefinition = {
  id: 'carousel-photoreal-ring',
  label: 'Photoreal Ring Carousel',
  category: 'carousel',
  caption: 'A turntable of brushed-metal cards orbiting in 3D',
  description: 'Six PBR cards on a slow turntable — a real 3D rotating carousel.',
  members: buildCards(),
  preview: {
    // Frame the whole ring from slightly above, three-quarter view.
    camera: { distance: 6.2, polar: Math.PI / 2.5, azimuth: Math.PI * 0.1 },
    frozenPhase: 0.35,
    loopSeconds: 9,
    tier: 'T1',
  },
  // Recommend a warm-key studio look at place time (additive; never forces a
  // hub-wide change unless the placement opts in).
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.2,
    ambientIntensity: 0.3,
    shadowSoftness: 0.6,
  },
  designRefs: ['Slider Revolution 3D carousel', 'turntable product showcase'],
  tier: 'T1',
  featured: true,
};
