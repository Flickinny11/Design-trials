// cardstack-fan-spread — a deck that fans open like a hand of cards (§13
// prebuilt-library element, category 'card-stack'). Five thin, beveled PBR
// cards sit stacked at the cluster origin and SPREAD into a fan arc: each card
// is rotated about Z and stepped along X + lifted on a shallow Y arc, so the
// frozen still already reads as a fanned hand. A modest MSDF label frames the
// face card (real glyphs — INV-11, never diffusion).
//
// THE MOVE (the SR-smashing flourish): a card deck that fans open. The cards
// wear premium Observatory-Brass PBR — alternating brushed brass / pale gold /
// ice-steel / pewter / obsidian, each with clearcoat + low roughness so the
// fan catches studio IBL like a hand of metal playing cards. This is a real
// 3D rotating/folding fan rendered with PBR + lighting, not CSS transforms.
//
// INTEGRATED animation (two bindings, two drivers — the suggested pair):
//   • every card carries `card-fold` (registry 'card-fold', transform / time,
//     verified registered): the fan ambiently unfolds open from a folded crease
//     on a loop — the deck "breathes" open.
//   • the face card carries `hover-lift` (registry 'hover-lift', pointer /
//     pointer, verified registered): as the cursor nears, the lead card lifts
//     toward the viewer, scales up and brightens — the cursor-reactive flourish
//     that picks a card out of the fan.
//
// This is a TEMPLATE: every member is a real, editable PrismNode (move / scale
// / recolor / re-skin / swap animation post-place). Photorealism is procedural
// PBR + IBL (free) — no hero imagery needed.
//
// Tier: T1 full-fidelity, clean T0 fallback (the cards still read as lit,
// fanned brushed panels + a crisp MSDF label without screen-space GI). INV-9.

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';
import type { ScenePosition } from '@/lib/prism-graph/types';

const CARD_COUNT = 5;

// Card footprint (scene units) — a tall, thin playing-card panel.
const CARD_W = 1.05;
const CARD_H = 1.5;
const CARD_DEPTH = 0.06;

// The fan geometry: cards pivot from a shared bottom hinge. Each step adds a
// little Z-rotation (the spread), an X offset (so they don't overlap fully),
// and a shallow Y rise toward the arc's outer edges. Centered on card index 2.
const FAN_SPREAD_RAD = 0.26; // per-card rotation step about Z (≈15°)
const FAN_STEP_X = 0.42; // per-card horizontal step
const FAN_ARC_Y = 0.1; // shallow Y arc so the fan curves like a held hand

// Alternating premium PBR — Observatory Brass (warm brass / pale gold) against
// cool ice-steel + pewter, anchored by one obsidian face card. Every recipe is
// physically plausible; NEVER purple. Card data colors are graph data, not
// chrome. The face card (index 2, the lead) is the polished obsidian one so the
// hover-lift pulls the richest card out of the fan.
const CARD_PALETTE: Array<{
  baseColor: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
  iridescence?: number;
  iridescenceIOR?: number;
}> = [
  { baseColor: '#9fc3d6', metalness: 0.7, roughness: 0.22, clearcoat: 0.7 }, // ice steel
  { baseColor: '#d8c089', metalness: 0.82, roughness: 0.3, clearcoat: 0.7 }, // pale gold
  { baseColor: '#15171f', metalness: 0.7, roughness: 0.18, clearcoat: 1.0, iridescence: 0.45, iridescenceIOR: 1.4 }, // obsidian (lead/face card)
  { baseColor: '#cbb06f', metalness: 0.88, roughness: 0.26, clearcoat: 0.7 }, // antique brass
  { baseColor: '#aebfcb', metalness: 0.6, roughness: 0.2, clearcoat: 0.6 }, // pewter
];

/** A full 9-field local pose (cluster origin); instantiator adds the drop anchor. */
function pose(
  x: number,
  y: number,
  z: number,
  rotationZ: number,
): ScenePosition {
  return {
    x,
    y,
    z,
    rotationX: 0,
    rotationY: 0,
    rotationZ,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
  };
}

function buildCards(): ClusterMemberTemplate[] {
  const cards: ClusterMemberTemplate[] = [];
  const mid = (CARD_COUNT - 1) / 2; // 2 for a 5-card fan
  for (let i = 0; i < CARD_COUNT; i++) {
    const off = i - mid; // -2 … +2 around the centered face card
    const pal = CARD_PALETTE[i % CARD_PALETTE.length];
    // Fan layout: spread about Z, step along X, shallow Y arc (outer cards dip),
    // and a tiny Z depth stagger so the fan reads as overlapping leaves.
    const x = off * FAN_STEP_X;
    const y = -Math.abs(off) * FAN_ARC_Y; // outer cards sit slightly lower (held-hand curve)
    const z = -Math.abs(off) * 0.02;
    const rotationZ = -off * FAN_SPREAD_RAD; // left cards tilt one way, right the other
    const isFace = i === 2;
    cards.push({
      localId: `card-${i}`,
      subtype: 'card',
      serviceTag: 'decor',
      caption: isFace ? 'Fan lead card' : `Fan card ${i + 1}`,
      renderMode: 'mesh',
      pose: pose(x, y, z, rotationZ),
      footprint: { width: CARD_W, height: CARD_H },
      meshPrimitive: {
        kind: 'cube',
        params: { width: CARD_W, height: CARD_H, depth: CARD_DEPTH },
      },
      materialSpec: {
        baseColor: pal.baseColor,
        metalness: pal.metalness,
        roughness: pal.roughness,
        clearcoat: pal.clearcoat,
        clearcoatRoughness: 0.12,
        ...(pal.iridescence !== undefined
          ? { iridescence: pal.iridescence, iridescenceIOR: pal.iridescenceIOR }
          : {}),
        // Small emissive seat so hover-lift (which scales emissiveIntensity with
        // proximity) has something to brighten on the lead card.
        emissive: '#1a1d26',
        emissiveIntensity: isFace ? 0.18 : 0.08,
        envMapIntensity: 1.35,
      },
      receivesLighting: true,
      // INTEGRATED animation #1: ambient `card-fold` — the fan unfolds open from
      // a folded crease on a loop. Staggered phase via per-card duration so the
      // cards don't all snap in lockstep (the deck breathes open).
      animationBindings: [
        {
          id: `ab-fan-fold-${i}`,
          primitive: 'card-fold',
          driver: 'time',
          params: { duration: 1.4 + Math.abs(off) * 0.18, axis: 'y', creaseLift: 0.85 },
          order: 0,
        },
        // INTEGRATED animation #2 (face card only): `hover-lift` — as the cursor
        // nears, the lead card lifts toward the viewer, scales up and brightens,
        // picking the richest card out of the fan.
        ...(isFace
          ? [
              {
                id: `ab-fan-hover-${i}`,
                primitive: 'hover-lift',
                driver: 'pointer' as const,
                params: { lift: 0.7, pop: 0.22, falloff: 1.5 },
                order: 1,
              },
            ]
          : []),
      ],
    });
  }
  return cards;
}

// ── MSDF label that frames the face card (INV-11 — real glyphs, modest size so
// it sits inside the lead tile rather than spilling past the fan). ───────────
const label: ClusterMemberTemplate = {
  localId: 'label',
  subtype: 'text',
  serviceTag: 'decor',
  caption: 'Fan label',
  renderMode: 'text',
  pose: pose(0, -0.05, CARD_DEPTH / 2 + 0.06, 0), // just proud of the obsidian face card
  footprint: { width: 0.9, height: 0.4 },
  textSpec: {
    content: 'ACE',
    fontFamily: 'Inter',
    fontWeight: 700,
    fontSize: 0.34,
    align: 'center',
    letterSpacing: 0.06,
    fill: { kind: 'gradient', from: '#e8d6a6', to: '#9fc3d6', angleDeg: 18 },
    decompose: 'glyph',
  },
};

const cardstackFanSpread: ElementClusterDefinition = {
  id: 'cardstack-fan-spread',
  label: 'Fan Spread Stack',
  category: 'card-stack',
  caption: 'A deck that fans open like a hand of cards',
  description: 'Five PBR cards spread into a fan; ambient card-fold + a cursor-reactive lead lift.',
  members: [...buildCards(), label],
  preview: {
    // Frame the whole fan head-on with a hint of three-quarter tilt so the
    // beveled depth + clearcoat sheen read across the spread.
    camera: { distance: 5.4, polar: Math.PI / 2.3, azimuth: Math.PI * 0.06 },
    frozenPhase: 0.42,
    loopSeconds: 6,
    tier: 'T1',
  },
  // Warm-key studio recommendation at place time (additive; never forces a
  // hub-wide change unless the placement opts in).
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.35,
    ambientIntensity: 0.3,
    shadowSoftness: 0.55,
  },
  designRefs: [
    'card-fold unfold transition',
    'magnetic cursor physics (proximity hover-lift)',
    'PBR clearcoat metal cards',
    'fanned card-stack composition',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(cardstackFanSpread);
export default cardstackFanSpread;
