// nav-glass-dock — a macOS-dock-style navigation cluster (§13 navigation
// element). A row of frosted-glass nav pills (capsule primitives wearing a
// transmissive, lightly-brass-tinted MeshPhysical recipe) floating just above a
// polished-chrome base rail, each pill captioned with a crisp MSDF label. The
// SR-smashing move is the dock magnify: as the cursor sweeps the row, the pills
// magnetically lean toward it AND the nearest pill lifts + scales + brightens —
// the macOS dock magnification, but rendered with real PBR transmission glass
// and IBL rather than CSS blur.
//
// INTEGRATED animation (the three suggested bindings, all verified registered):
//   • each pill — `magnetic` (driver:'pointer', registry 'magnetic', pointer
//     category): the pill springs toward the live pointer, bounded reach, so the
//     row leans into the cursor like a dock.
//   • each pill — `hover-lift` (driver:'pointer', registry 'hover-lift', pointer
//     category): proximity lift toward the viewer + scale-up + emissive bloom —
//     the dock-magnify on the pill nearest the cursor.
//   • each pill — `frosted-glass` (driver:'time', registry 'frosted-glass',
//     glass category): a slow transmission roughness sweep clouds the glass from
//     clear to frosted and back, so the frost "breathes" across the dock even at
//     rest. GPU/hard; degrades to the static transmissive recipe at T0.
//
// Photorealism is procedural PBR + IBL (free) — no imagery needed. Every member
// is a real, editable PrismNode (move / recolor / re-skin / swap animation
// post-place).
//
// Tier: T1 full-fidelity, clean T0 fallback — the pills still read as lit,
// lightly-tinted glass capsules over a chrome rail with crisp MSDF labels even
// without screen-space GI or the live frost sweep. INV-9.

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';
import type { ScenePosition } from '@/lib/prism-graph/types';

// ── Dock geometry (cluster-local, origin 0,0,0; the instantiator offsets by the
// drop anchor) ──────────────────────────────────────────────────────────────
// Three pill+label pairs + one base rail = 7 members (within the 3–8 bar);
// three pills are enough to read the dock-magnify sweep across the row.
const PILL_COUNT = 3;
const PILL_GAP = 1.18; // center-to-center spacing along X
const PILL_W = 0.96; // capsule visual width (footprint)
const PILL_H = 0.62; // capsule visual height
const PILL_Y = 0.18; // pills float just above the rail
const ROW_SPAN = (PILL_COUNT - 1) * PILL_GAP;

// Labels for each dock pill — graph data (real MSDF glyphs, INV-11), not chrome.
const PILL_LABELS = ['Home', 'Work', 'About'];

/** Identity ScenePosition with a per-member override, kept fully explicit
 *  (all 9 fields) per the contract. */
function pose(over: Partial<ScenePosition>): ScenePosition {
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
    ...over,
  };
}

function buildPills(): ClusterMemberTemplate[] {
  const members: ClusterMemberTemplate[] = [];
  for (let i = 0; i < PILL_COUNT; i++) {
    const x = -ROW_SPAN / 2 + i * PILL_GAP;
    // Stagger the frost-sweep speed slightly across the row so the dock never
    // reads as one rigid bar — each pill clouds + clears on its own cadence.
    const frostSpeed = 0.6 + (i / PILL_COUNT) * 0.4;

    // ── The glass pill: a capsule wearing a transmissive, lightly brass-tinted
    // MeshPhysical recipe (frosted-glass swaps in its own transmissive material
    // at runtime; this base recipe is the T0/static fallback look). ──────────
    members.push({
      localId: `pill-${i}`,
      subtype: 'element',
      serviceTag: 'decor',
      caption: `Dock pill ${i + 1} (${PILL_LABELS[i]})`,
      renderMode: 'mesh',
      // Rotate the capsule onto its side (axis along X) and flatten it in depth
      // via the pose scale so it reads as a horizontal rounded pill plate, not
      // an upright bean.
      pose: pose({
        x,
        y: PILL_Y,
        z: 0,
        rotationZ: Math.PI / 2,
        scaleZ: 0.4,
      }),
      footprint: { width: PILL_W, height: PILL_H },
      meshPrimitive: {
        // A capsule laid on its side reads as a rounded nav pill.
        kind: 'capsule',
        params: { radius: 0.31, length: 0.42, segments: 32 },
      },
      // Premium glass: high transmission, low roughness, full clearcoat, a touch
      // of dispersion for the rainbow edge, faint warm ice tint (Observatory
      // Brass — never purple).
      materialSpec: {
        baseColor: '#cfdbe4', // cool ice-steel glass tint
        metalness: 0.0,
        roughness: 0.06,
        transmission: 0.92,
        ior: 1.5,
        dispersion: 0.04,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        thickness: 0.5,
        envMapIntensity: 1.4,
        // A whisper of warm emissive so hover-lift's emissive bloom has
        // something to amplify (brass glow when magnified).
        emissive: '#c9a86a',
        emissiveIntensity: 0.12,
        opacity: 1,
      },
      receivesLighting: true,
      // INTEGRATED animation: magnetic lean + dock-magnify lift + breathing
      // frost. All three suggested bindings, real registry names.
      animationBindings: [
        {
          id: `ab-navdock-magnetic-${i}`,
          primitive: 'magnetic',
          driver: 'pointer',
          params: { maxOffset: 0.32, strength: 0.18 },
          order: 0,
        },
        {
          id: `ab-navdock-hoverlift-${i}`,
          primitive: 'hover-lift',
          driver: 'pointer',
          params: { lift: 0.55, pop: 0.22, falloff: 2.2 },
          order: 1,
        },
        {
          id: `ab-navdock-frost-${i}`,
          primitive: 'frosted-glass',
          driver: 'time',
          params: { speed: frostSpeed, frostiness: 0.78, grain: 0.35 },
          order: 2,
        },
      ],
    });

    // ── The pill label: real MSDF text, modest size so it frames inside the
    // tile, sitting just in front of the glass plate. ───────────────────────
    members.push({
      localId: `label-${i}`,
      subtype: 'text',
      serviceTag: 'decor',
      caption: `Dock label ${i + 1}`,
      renderMode: 'text',
      pose: pose({ x, y: PILL_Y, z: 0.22 }),
      footprint: { width: PILL_W * 0.8, height: 0.3 },
      textSpec: {
        content: PILL_LABELS[i],
        fontFamily: 'Inter',
        fontWeight: 600,
        fontSize: 0.3,
        align: 'center',
        letterSpacing: 0.01,
        fill: { kind: 'solid', color: '#f2ead7' }, // warm ivory, reads on glass
        decompose: 'glyph',
      },
      // Labels track their pill toward the cursor too, so the caption never
      // detaches from the magnetized plate.
      animationBindings: [
        {
          id: `ab-navdock-label-magnetic-${i}`,
          primitive: 'magnetic',
          driver: 'pointer',
          params: { maxOffset: 0.32, strength: 0.18 },
          order: 0,
        },
      ],
    });
  }

  // ── The base rail: a polished-chrome bar under the dock that the glass pills
  // float over and reflect into — gives the cluster a grounded, premium dock
  // chassis. A thin, wide cube wearing the polished-chrome recipe. ───────────
  members.push({
    localId: 'rail',
    subtype: 'element',
    serviceTag: 'decor',
    caption: 'Dock base rail',
    renderMode: 'mesh',
    pose: pose({ x: 0, y: -0.34, z: -0.02 }),
    footprint: { width: ROW_SPAN + PILL_W + 0.6, height: 0.22 },
    meshPrimitive: {
      kind: 'cube',
      params: { width: ROW_SPAN + PILL_W + 0.6, height: 0.16, depth: 0.42 },
    },
    materialSpec: {
      baseColor: '#2a2e36', // charcoal chrome
      metalness: 1.0,
      roughness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.6,
      opacity: 1,
    },
    receivesLighting: true,
  });

  return members;
}

const navGlassDock: ElementClusterDefinition = {
  id: 'nav-glass-dock',
  label: 'Glass Dock Nav',
  category: 'navigation',
  caption: 'Frosted-glass nav pills that magnify toward the cursor',
  description:
    'A macOS-style dock of transmissive glass pills on a chrome rail that lean + magnify under the pointer.',
  members: buildPills(),
  preview: {
    // Frame the whole row head-on, a touch above + a hair to the side, so all
    // three pills + the rail read in a ~4:3 tile with a little glass refraction.
    camera: { distance: 5.4, polar: Math.PI / 2.3, azimuth: Math.PI * 0.06 },
    frozenPhase: 0.4,
    loopSeconds: 6,
    tier: 'T1',
  },
  // A cool studio key so the glass picks up clean refractions + the chrome rail
  // throws crisp highlights. Additive recommendation; never forces a hub change.
  sceneLighting: {
    tier: 'auto',
    envIntensity: 1.4,
    ambientIntensity: 0.26,
    shadowSoftness: 0.5,
  },
  designRefs: [
    'PBR transmission glass',
    'magnetic cursor physics',
    'macOS dock magnification',
    'frosted-glass roughness sweep',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(navGlassDock);

export default navGlassDock;
