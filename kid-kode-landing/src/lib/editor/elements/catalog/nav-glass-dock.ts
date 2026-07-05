// nav-glass-dock — a macOS-dock-style navigation cluster (§13 navigation
// element). A row of clear ice-glass nav pills (capsule primitives wearing a
// transmissive, cool-tinted MeshPhysical recipe) floating just above a
// brushed-chrome base rail, each pill captioned with a crisp MSDF label. The
// SR-smashing move is the dock magnify: as the cursor sweeps the row, the pills
// magnetically lean toward it AND the nearest pill lifts + scales + brightens —
// the macOS dock magnification, but rendered with real PBR transmission glass
// and IBL rather than CSS blur.
//
// INTEGRATED animation (all verified registered). The macOS-dock pointer move
// is preserved; the time-driven motion is now CONTINUOUS + always-visible so the
// hover-preview loop reads complete + premium at every phase (the old
// `frosted-glass` time sweep clouded the pills to a muddy roughness-0.78 brown
// lump over the dark backdrop — removed):
//   • each pill — `magnetic` (driver:'pointer'): springs toward the live
//     pointer, bounded reach, so the row leans into the cursor like a dock.
//   • each pill — `hover-lift` (driver:'pointer'): proximity lift toward the
//     viewer + scale-up + specular bloom — the dock-magnify on the nearest pill.
//   • each pill — `dispersion` (driver:'time', glass): keeps the pill as CLEAN
//     clear-glass (roughness ~0.04, transmission 1) while a rainbow fresnel rim
//     breathes through RGB — premium ice-glass that never frosts or muddies.
//   • each pill + label — `float` (driver:'time', transform): a gentle buoyant
//     bob; transform-only, so it never swaps the material and the dock is always
//     fully visible. Labels carry the same float so caption stays locked to plate.
//
// Photorealism is procedural PBR + IBL (free) — no imagery needed. Every member
// is a real, editable PrismNode (move / recolor / re-skin / swap animation
// post-place).
//
// Tier: T1 full-fidelity, clean T0 fallback — the pills still read as lit, clear
// ice-glass capsules over a brushed-chrome rail with crisp MSDF labels even
// without screen-space GI or the live dispersion rim. INV-9.

import { registerElement } from '../registry';
import type { ElementClusterDefinition, ClusterMemberTemplate } from '../contract';
import type { ScenePosition } from '@/lib/prism-graph/types';

// ── Dock geometry (cluster-local, origin 0,0,0; the instantiator offsets by the
// drop anchor) ──────────────────────────────────────────────────────────────
// Three pill+label pairs + one base rail = 7 members (within the 3–8 bar);
// three pills are enough to read the dock-magnify sweep across the row.
const PILL_COUNT = 3;
// Wider center-to-center spacing than the pill's X extent (capsule length 0.42
// + 2·radius 0.27 ≈ 0.96) so each pill — and its label — sits clearly apart;
// the prior 1.18 gap let adjacent pills nearly touch and labels bled across
// neighbors (the illegible-overlap defect).
const PILL_GAP = 1.6; // center-to-center spacing along X
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
    // Stagger the time-motion cadence slightly across the row so the dock never
    // reads as one rigid bar — each pill bobs + shifts its rim on its own beat.
    const dispSpeed = (i / PILL_COUNT) * 0.4;

    // ── The glass pill: a capsule wearing a clean transmissive ice-glass
    // MeshPhysical recipe (the `dispersion` time-binding swaps in its own clear
    // clear-glass material at runtime; this base recipe is the T0/static
    // fallback look and reads as ice-clear glass on its own). ─────────────────
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
        // A capsule laid on its side reads as a rounded nav pill. Slimmer
        // radius than before so neighboring pills keep a clean gap.
        kind: 'capsule',
        params: { radius: 0.27, length: 0.42, segments: 32 },
      },
      // Premium CLEAN ice-glass: very low roughness + high transmission + thin
      // thickness + full clearcoat so each pill reads as a clear ice-glass plate
      // (NOT a frosted brown lump). A whisper of dispersion gives the rainbow
      // edge; a cool ice-steel tint keeps it on the Observatory-Brass cold side
      // (never warm/brown). NO warm emissive — the prior brass emissive over the
      // dark backdrop was what muddied the glass to brown. hover-lift's bloom
      // amplifies the clearcoat/specular instead.
      materialSpec: {
        baseColor: '#e6eef5', // bright cool ice-glass tint (reads clear, not brown)
        metalness: 0.0,
        roughness: 0.08, // ~0.1: crisp clear glass, no frosted haze
        transmission: 0.9, // high transmission so it reads as glass, not plastic
        ior: 1.45,
        dispersion: 0.05, // faint rainbow edge for premium glass
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        thickness: 0.18, // thin slab → light passes through clean, no muddy depth
        envMapIntensity: 1.5,
        // No emissive tint: clean glass. (Was '#c9a86a' @ 0.12 — the brown cast.)
        opacity: 1,
      },
      receivesLighting: true,
      // INTEGRATED animation: magnetic lean + dock-magnify lift (pointer, the
      // macOS-dock behavior) PLUS two CONTINUOUS, always-visible time motions so
      // the hover-preview loop is full + premium at every phase:
      //   • `dispersion` (time, glass) — keeps the pill as CLEAN clear-glass
      //     (roughness ~0.04, transmission 1) with a rainbow fresnel rim that
      //     breathes through RGB. This REPLACES the old `frosted-glass` binding,
      //     which clouded the pill to a muddy roughness ~0.78 frosted lump over
      //     the dark backdrop (the brown defect). Dispersion never frosts → the
      //     glass stays ice-clear and legible across the whole loop.
      //   • `float` (time, transform) — a gentle buoyant bob; transform-only, so
      //     it never swaps/muddies the material. Always fully visible.
      // (Pointer bindings sit steady at rest in the time-only preview rig.)
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
          id: `ab-navdock-dispersion-${i}`,
          primitive: 'dispersion',
          driver: 'time',
          params: { spread: 1.5, ior: 1.45, speed: 0.6 + dispSpeed },
          order: 2,
        },
        {
          id: `ab-navdock-float-${i}`,
          primitive: 'float',
          driver: 'time',
          // Gentle bob; tiny tilt so the row breathes without looking unstable.
          params: { speed: 0.7 + dispSpeed, amplitude: 0.05, tiltDeg: 2 },
          order: 3,
        },
      ],
    });

    // ── The pill label: real MSDF text (INV-11), sitting clearly IN FRONT of
    // the glass plate (raised z) so it never reads through the glass. High
    // contrast: bright near-white fill + a thin charcoal outline + soft shadow
    // so each word stays crisply legible against the bright clear glass behind
    // it. (Was warm ivory #f2ead7 with no outline — it washed out / read dark.)
    members.push({
      localId: `label-${i}`,
      subtype: 'text',
      serviceTag: 'decor',
      caption: `Dock label ${i + 1}`,
      renderMode: 'text',
      // z 0.34 keeps the glyphs well clear of the capsule's front face
      // (radius 0.27 → front ~0.27) so they composite in front, never inside.
      pose: pose({ x, y: PILL_Y, z: 0.34 }),
      footprint: { width: PILL_W * 0.8, height: 0.3 },
      textSpec: {
        content: PILL_LABELS[i],
        fontFamily: 'Inter',
        fontWeight: 600,
        fontSize: 0.3,
        align: 'center',
        letterSpacing: 0.02,
        fill: { kind: 'solid', color: '#fbfdff' }, // bright near-white, high contrast
        // A thin charcoal outline + soft shadow lock legibility against the
        // bright glass regardless of what refracts behind the glyph.
        outline: { color: '#1c2026', width: 0.16 },
        shadow: { color: '#10141a', offsetX: 0.02, offsetY: -0.03, opacity: 0.55 },
        decompose: 'glyph',
      },
      // Labels track their pill toward the cursor (magnetic) AND share the same
      // gentle float, so the caption stays locked to its magnetized plate and is
      // always fully visible across the preview loop.
      animationBindings: [
        {
          id: `ab-navdock-label-magnetic-${i}`,
          primitive: 'magnetic',
          driver: 'pointer',
          params: { maxOffset: 0.32, strength: 0.18 },
          order: 0,
        },
        {
          id: `ab-navdock-label-float-${i}`,
          primitive: 'float',
          driver: 'time',
          params: { speed: 0.7 + dispSpeed, amplitude: 0.05, tiltDeg: 2 },
          order: 1,
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
      baseColor: '#6b7280', // brushed steel-chrome (lighter than the prior near-black
      // charcoal, which read as a flat black slab) — catches the key as a bright rail.
      metalness: 1.0,
      roughness: 0.12,
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
  caption: 'Clear ice-glass nav pills that magnify toward the cursor',
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
    'chromatic dispersion rim',
  ],
  tier: 'T1',
  featured: true,
};

registerElement(navGlassDock);

export default navGlassDock;
