// carousel-coverflow-depth — Apple Coverflow in real 3D (§13 prebuilt-library
// element). A curved row of glossy cards: the CENTER card is upright, forward,
// and in sharp focus (a polished glass tile catching the rig's IBL); the wing
// cards recede in Z, fan out in X, and yaw to BILLBOARD toward the viewing axis
// — so the row reads as a shallow arc of angled panels, the classic Coverflow
// "wall that bends away from you". Depth is sold three ways at once, all
// physical (never a CSS blur fake):
//   1. Geometric recession — wing cards step back in Z along a circular arc, so
//      perspective shrinks them and the focus card pops.
//   2. Roughness gradient — the further a card sits from focus, the rougher its
//      material, so its highlights smear and it reads "soft / out of focus"
//      under the studio IBL (a real PBR depth-of-field, not a post blur).
//   3. Yaw fan — each wing turns toward the center axis, presenting a raking
//      three-quarter face that catches less key light and recedes optically.
//
// Palette: Observatory Brass — a polished-glass focus card flanked by obsidian,
// chrome, and warm-brass wings (NO purple). An MSDF caption (renderMode:'text',
// real glyphs — INV-11) frames the row beneath the focus card.
//
// INTEGRATED animation:
//   • wing cards — `scroll-orbit-scrub` (driver:'time'): the whole arc swings
//     around the focus point on a continuous loop, each card flying past the
//     camera with BOUNDED facing parallax (yaw saturates short of edge-on, so a
//     wing never turns its blank back face) — the Coverflow scrub, always fully
//     present at every phase (pure transform; no opacity/scale-from-0). On a
//     real placed page the same binding re-drivers to 'scroll' via the Animation
//     Picker. Verified registered (src/lib/prism/animatable/primitives/scroll-orbit-scrub.ts).
//   • focus card — `float` (driver:'time'): the in-focus glass tile breathes a
//     gentle, CONTINUOUS idle bob+tilt so it always reads alive and selected,
//     while staying FULLY PRESENT at every loop phase (a pure transform — never
//     fades or scales from zero). It REPLACES the prior `depth-pop`, which (as a
//     reveal primitive on driver:'time') collapsed the focus card to opacity-0 /
//     scale-0.3 at the start of every cycle — the advocate "pops from 0" defect.
//     `float` leaves the glass `materialSpec` untouched so the transmission +
//     clearcoat highlight is preserved. Verified registered
//     (src/lib/prism/animatable/primitives/float.ts).
//
// This is a real, editable cluster: every card / caption is a PrismNode you can
// move, recolor, re-skin, or re-bind post-place. The center focus tile is
// procedural glass (PBR + IBL); the opaque wings are skinned with real premium
// album-art sample imagery so the row reads as populated covers, not blank panels.
//
// Tier: T1 full-fidelity (clean fallback to T0 — the cards still read as lit,
// arranged glass/metal panels with a crisp MSDF caption without screen-space
// GI). INV-9.

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';
import type { MaterialSpec, ScenePosition } from '@/lib/prism-graph/types';

// ── Row geometry ─────────────────────────────────────────────────────────────
// Odd count so there is a true center card in focus. Index 3 of 7 is the focus.
const CARD_COUNT = 7;
const FOCUS_INDEX = (CARD_COUNT - 1) / 2; // 3

// Tall portrait tiles (Coverflow album-art proportions).
const CARD_W = 0.92;
const CARD_H = 1.28;
const CARD_DEPTH = 0.06;

// The arc the wings recede along. Cards fan out in X and bow back in Z so the
// row is a shallow circular segment opening toward the camera.
const X_STEP = 0.78; // lateral pitch between adjacent cards
const Z_FALLOFF = 0.42; // how far each step recedes into the scene
const FOCUS_FORWARD = 0.55; // the focus card sits this far in front of the arc
const YAW_PER_STEP = 0.46; // radians a wing turns toward the focus per step (~26°)
const MAX_YAW = 1.15; // saturate the billboard yaw so no wing goes edge-on (~66°)

// ── Palette: Observatory Brass, physically-plausible PBR (NEVER purple) ───────
// The center card is polished glass; the OPAQUE wings are glossy album-print
// cards skinned with real sample album-art (see WING_ALBUM_ART below).
// Roughness is overridden per-card by the depth-of-focus gradient below, so this
// is the *base* glass recipe (focus distance = 0 keeps it at its crispest).
const GLASS_FOCUS: MaterialSpec = {
  baseColor: '#bfe0ef', // ice-blue tinted glass
  transmission: 0.92,
  ior: 1.5,
  dispersion: 0.04,
  clearcoat: 1.0,
  clearcoatRoughness: 0.04,
  roughness: 0.06,
  thickness: 0.5,
  metalness: 0.0,
  envMapIntensity: 1.6,
};

// ── Album art on the OPAQUE wing cards ───────────────────────────────────────
// The wing cards are the carousel's content surfaces, so each shows REAL premium
// sample album-art on its visible front face (baseColorMapUrl MULTIPLIES the lit
// base material). Keyed by signed offset from focus so the two sides carry
// distinct, varied art (never one image repeated). All portrait / ~square refs —
// they fit the tall Coverflow album-tile footprint (0.92 × 1.28). The central
// GLASS focus card is intentionally absent here — it stays a clear glass tile.
const WING_ALBUM_ART: Record<number, string> = {
  [-3]: '/prism-mock/library-content/editorial-silk.png', // far-left  — flowing amber/teal silk
  [-2]: '/prism-mock/library-content/portrait-b.png', //      mid-left  — editorial portrait, man
  [-1]: '/prism-mock/library-content/product-scent.png', //   near-left — luxury perfume bottle
  [1]: '/prism-mock/library-content/product-audio.png', //    near-right— premium headphones
  [2]: '/prism-mock/library-content/portrait-a.png', //       mid-right — editorial portrait, woman
  [3]: '/prism-mock/orrery/refs/watch-hero.png', //           far-right — luxury watch on black
};

// Glossy "album print" surfacing applied alongside the album-art map on each wing
// card: lit photo-print look (the map carries the color; baseColor stays white so
// the photo isn't tinted), a soft clearcoat sheen so the card catches the rig's
// IBL like a laminated cover. envMapIntensity is left to the per-card DOF gradient.
const ALBUM_PRINT_SURFACE = {
  baseColor: '#ffffff',
  metalness: 0.0,
  roughness: 0.42,
  clearcoat: 0.6,
  clearcoatRoughness: 0.12,
} as const;

const identityRotScale = {
  rotationX: 0,
  rotationZ: 0,
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
} as const;

function buildCards(): ClusterMemberTemplate[] {
  const cards: ClusterMemberTemplate[] = [];

  for (let i = 0; i < CARD_COUNT; i++) {
    const offset = i - FOCUS_INDEX; // signed steps from focus (… -2,-1,0,1,2 …)
    const dist = Math.abs(offset); // focus distance in steps
    const isFocus = dist === 0;

    // Arc layout: fan in X, recede in Z (focus pulled forward), billboard yaw
    // toward the center axis (saturated so no card goes edge-on).
    const x = offset * X_STEP;
    const z = isFocus ? FOCUS_FORWARD : -dist * Z_FALLOFF;
    const rawYaw = -offset * YAW_PER_STEP; // turn toward focus (sign opposes X)
    const rotationY = Math.max(-MAX_YAW, Math.min(MAX_YAW, rawYaw));

    // Depth-of-focus material: copy the base recipe, then roughen + dim env with
    // distance so far cards read optically "soft" — a real PBR DOF, no post blur.
    // The focus card keeps its pure GLASS recipe. The OPAQUE wings switch to a
    // glossy album-print surface carrying REAL sample album-art on the front face
    // (baseColorMapUrl), so each wing reads as a populated cover, not a blank
    // metal panel — while the DOF env falloff still sells recession.
    const baseMat: MaterialSpec = isFocus
      ? GLASS_FOCUS
      : { ...ALBUM_PRINT_SURFACE, baseColorMapUrl: WING_ALBUM_ART[offset] };
    const roughnessBoost = dist * 0.07;
    const material: MaterialSpec = {
      ...baseMat,
      roughness: Math.min(0.85, (baseMat.roughness ?? 0.2) + roughnessBoost),
      envMapIntensity: Math.max(0.6, (baseMat.envMapIntensity ?? 1.2) - dist * 0.12),
    };

    const pose: ScenePosition = {
      x,
      y: 0,
      z,
      rotationY,
      ...identityRotScale,
    };

    const card: ClusterMemberTemplate = {
      localId: isFocus ? 'card-focus' : `card-wing-${offset > 0 ? 'r' : 'l'}${dist}`,
      subtype: 'card',
      serviceTag: 'decor',
      caption: isFocus ? 'Coverflow focus card' : `Coverflow card ${i + 1}`,
      renderMode: 'mesh',
      pose,
      footprint: { width: CARD_W, height: CARD_H },
      meshPrimitive: {
        kind: 'cube',
        params: { width: CARD_W, height: CARD_H, depth: CARD_DEPTH },
      },
      materialSpec: material,
      receivesLighting: true,
    };

    if (isFocus) {
      // INTEGRATED animation (focus): a gentle CONTINUOUS float so the in-focus
      // glass tile reads alive and selected — a buoyant idle bob + slow tilt that
      // catches the IBL differently as it moves. driver:'time' ambient. CRUCIAL:
      // `float` is a pure, always-present transform (duration = Infinity, no
      // opacity/scale ramp), so the focus card is FULLY PRESENT at every phase —
      // it never "pops from 0" the way the prior depth-pop did. The glass
      // materialSpec is left untouched (float touches only position.y/rotation.z),
      // so the transmission + clearcoat highlight survives intact.
      card.animationBindings = [
        {
          id: 'ab-coverflow-focus-float',
          primitive: 'float',
          driver: 'time',
          params: { speed: 0.85, amplitude: 0.05, tiltDeg: 2.5 },
          order: 0,
        },
      ];
    } else {
      // INTEGRATED animation (wings): scroll-orbit-scrub swings the arc around
      // the focus — each wing flies past the camera with BOUNDED facing parallax
      // (yaw saturates short of edge-on; no blank back face) and a banked roll.
      // driver:'time' so the preview loop continuously orbits the cards through
      // focus (the primitive's CPU phase fallback scrubs the full sweep when no
      // scroll signal is present) — always fully present, no opacity/scale ramp.
      // Outer wings scrub a wider arc (more travel). On a placed page the
      // Animation Picker can re-driver this binding back to 'scroll'.
      card.animationBindings = [
        {
          id: `ab-coverflow-scrub-${offset > 0 ? 'r' : 'l'}${dist}`,
          primitive: 'scroll-orbit-scrub',
          driver: 'time',
          params: {
            orbitDeg: 120 + dist * 30,
            arcDepth: 0.35,
            counterTiltDeg: 10,
            reverse: offset < 0,
          },
          order: 0,
        },
      ];
    }

    cards.push(card);
  }

  return cards;
}

// ── MSDF caption framing the focus card (INV-11: real glyphs, modest size) ────
const caption: ClusterMemberTemplate = {
  localId: 'caption',
  subtype: 'text',
  serviceTag: 'decor',
  caption: 'Coverflow caption',
  renderMode: 'text',
  pose: {
    x: 0,
    y: -0.92,
    z: FOCUS_FORWARD + 0.04,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
  },
  footprint: { width: 1.6, height: 0.34 },
  textSpec: {
    content: 'IN FOCUS',
    fontFamily: 'Inter',
    fontWeight: 600,
    fontSize: 0.3,
    align: 'center',
    letterSpacing: 0.06,
    fill: { kind: 'gradient', from: '#e8d6a6', to: '#bfe0ef', angleDeg: 12 },
    decompose: 'glyph',
  },
};

export const carouselCoverflowDepth: ElementClusterDefinition = {
  id: 'carousel-coverflow-depth',
  label: 'Coverflow Depth Carousel',
  category: 'carousel',
  caption: 'A curved row of cards — center in focus, neighbors angled and depth-soft',
  description: 'Apple Coverflow in real 3D: a glass focus tile flanked by receding, billboarding metal cards.',
  members: [...buildCards(), caption],
  preview: {
    // Frame the whole arc head-on, very slightly above, so the focus card reads
    // sharp and the wings clearly recede on either side in a ~4:3 tile.
    camera: { distance: 5.6, polar: Math.PI / 2.1, azimuth: 0 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T1',
  },
  // Warm-key studio look at place time (additive; never forces a hub-wide
  // change unless the placement opts in). The glass focus card needs strong IBL
  // to sell its transmission + clearcoat highlight.
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.45,
    ambientIntensity: 0.26,
    shadowSoftness: 0.6,
  },
  designRefs: [
    'Apple Coverflow 3D carousel',
    'PBR transmission glass',
    'depth-of-field via roughness gradient',
    'scroll-choreographed orbit scrub',
  ],
  tier: 'T1',
  featured: true,
};

// Self-register so the catalog barrel only needs a side-effect import.
registerElement(carouselCoverflowDepth);

export default carouselCoverflowDepth;
