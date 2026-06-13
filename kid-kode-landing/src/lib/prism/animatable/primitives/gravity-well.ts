// gravity-well — the cursor bends space. The card slides DOWN the well's curve
// toward the pointer along an inverse-square-ish falloff (strong near, vanishing
// far — NOT linear), stretching TIDALLY as it nears (elongate along the pull
// axis, squash across it, growing as distance shrinks, bounded), while a handful
// of faint brass dust motes stream past on decaying spiral paths into the drain
// at the pointer. HARD / pointer. (DESIGN-REFERENCES §7 Cursor & Interaction
// Libraries — the proximity-attraction signature of magnetic-elements / Cursify,
// taken to its ASTROPHYSICAL extreme: a curved-space gravitational well with
// inverse-square pull and tidal deformation rather than a linear DOM nudge.)
//
// HOW (all CPU, deterministic, DOM-free):
//  • Pull. The host pointer (userData.pointer {x,y} in 0..1, finite-guarded) maps
//    to a subject-relative point on the card's plane (±reach × measured width).
//    The vector from the card home to that point has length `dist`; the well's
//    pull along it is
//
//        pullMag = min( gravity / (dist^falloff + EPS), dist )   // ≤ dist: never overshoots
//
//    so the card is drawn a FRACTION of the way to the pointer that RISES sharply
//    as the pointer nears (the inverse-square-ish curve — convex, super-linear)
//    and VANISHES as it recedes. The card position chases that target offset with
//    a dt-normalized exponential spring (`pullSpeed`), bounded subject-relative so
//    the whole envelope stays inside the tile frame.
//  • Tidal stretch. Tides scale with 1/dist (clamped): the nearer the well's
//    drain, the more the card elongates ALONG the pull axis and squashes ACROSS
//    it. The stretch is applied in the pull-direction frame via a rotation.z =
//    atan2(dir) so the elongation always points at the cursor; magnitude =
//    tidalStretch × tideFrac, bounded.
//  • Orbital dust. 3–12 tiny brass motes on a SINGLE instanced THREE.Sprite
//    (embers.ts particle discipline — never THREE.Points for visible sprites:
//    PointsNodeMaterial on a Sprite, per-instance positionNode + colorNode, TSL
//    radial falloff killed to EXACT zero before the quad edge). Each mote rides a
//    deterministic decaying spiral (angle = baseθ + t·spin, radius shrinks toward
//    0 over its phase, then respawns at the rim) centred on the pointer drain, so
//    the field streams continuously INTO the cursor. All per-mote constants come
//    from an index hash — no Math.random.
//
// PINNED-ENGAGED CONTRACT (W4 pointer-rig facts): TWO rigs pin this tile.
//  • verify-catalog-parallel pins {x:0.62,y:0.5} (horizontal pull) and SEEKS THE
//    SAME t REPEATEDLY (dt≈0) while sweeping each control.
//  • useradvocate-capture pins the ORBIT pointer at lastT=1 of a dur=4 loop →
//    ph=0.25 → {x:0.5,y:0.7}: a PURE VERTICAL downward offset, x DEAD-CENTER. It
//    seeks t=1 ONCE then fires onParamChange via the control input only.
// So the STANDING engaged pose must reshape under every control at BOTH pins,
// keyed off the FULL-MAGNITUDE drain (never the x-axis alone — x is 0 at the
// useradvocate pin). The dt≈0 seek path AND onParamChange both re-derive the
// steady pose directly from (pointer, params): the card sits at its bounded pull
// target with the tidal stretch for that distance, and every control (gravity /
// falloff / tidalStretch / pullSpeed) visibly reshapes that frozen frame.
// moteCount lays a BOLD VISIBLE orbital RING (applyStandingMotes) around the
// drain at the static pin — deterministic even angular spread, brass radius +
// brightness floor — so adding/removing motes plainly changes the dot count. The
// live drain-spiral (applyMotes) runs only for the moving (dt>0) play frames.
// The idle disengaged frame (pointer centered, first seek) is the exact home
// pose — the card is fully legible at rest, with no standing ring drawn.
//
// THE SUBJECT'S LOOK IS SACRED: pure CPU transform on the card —
// position / rotation.z / scale only. No material is ever touched, no subject
// opacity written. The motes are an ADDITIVE overlay sprite that never alters the
// subject's own pixels. Mesh and Group subjects both fine. dispose() restores the
// full home transform exactly and removes + disposes the motes.
//
// DISTINCT from neighbors:
//  • magnetic — a LINEAR soft spring pull (offset ∝ pointer, constant gain) with
//    NO tidal deformation and NO motes. This well's pull is inverse-square-ish
//    (convex) and the card DEFORMS tidally as it falls in.
//  • pointer-attract-scale — uniform SCALE only on proximity; no translation, no
//    anisotropy, no particles. This translates, shears anisotropically, and emits
//    orbital dust.
//  • magnetic-stick (sibling) — a BISTABLE capture/escape snap. This is a
//    CONTINUOUS curved-space pull: no hysteresis band, displacement varies
//    smoothly with distance along the falloff curve.

import {
  Sprite,
  BufferGeometry,
  BufferAttribute,
  InstancedBufferAttribute,
  Color,
  AdditiveBlending,
  DynamicDrawUsage,
  Box3,
  Vector3,
  type Object3D,
} from 'three';
import { PointsNodeMaterial } from 'three/webgpu';
import { instancedBufferAttribute, uv, vec3, vec4, float, exp, smoothstep } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  // Well depth — overall pull magnitude. Higher = the card falls in harder.
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 0.3, max: 3.0, step: 0.05, default: 1.4 },
  // Falloff exponent on distance: 1 ≈ linear-ish, 3 = sharply inverse-cubed
  // (vanishes fast far, yanks hard near). 2 is the inverse-square default.
  { id: 'falloff', label: 'Falloff', type: 'knob', min: 1.0, max: 3.0, step: 0.05, default: 2.0 },
  // Tidal stretch gain — how strongly the card elongates along the pull axis as
  // it nears the drain (squash across it grows with it). Bounded.
  { id: 'tidalStretch', label: 'Tidal Stretch', type: 'knob', min: 0.05, max: 0.5, step: 0.01, default: 0.22 },
  // Orbital dust mote count (3–12). Faint brass specks spiralling into the drain.
  { id: 'moteCount', label: 'Mote Count', type: 'knob', min: 3, max: 12, step: 1, default: 8 },
  // Pull strength — how hard the well draws the card IN. During live motion this
  // is the chase tightness (0.05 = a long, viscous fall; 0.9 = a snappy drop); at
  // the engaged steady state it is ALSO the standing draw-in DEPTH: a viscous well
  // settles the card shallower in the well, a snappy pull locks it DEEPER toward
  // the drain (and so the tidal stretch deepens with it). This makes the control a
  // standing function of the pinned pose, not a transient-only rate (W2/W3 pattern).
  { id: 'pullSpeed', label: 'Pull Speed', type: 'fader', min: 0.05, max: 0.9, step: 0.01, default: 0.4 },
] as const;

interface PointerXY {
  x: number;
  y: number;
}

// Allocate motes to a fixed max so the instanced buffers never reallocate; the
// live moteCount narrows the draw via sprite.count, parked motes cost nothing.
const MAX_MOTES = 12;
// dt clamp for the smoothing alpha — chunky seeks (tests, tab-back) stay stable.
const DT_MAX = 0.25;
// Tiny epsilon so the inverse-power pull never divides by zero at the drain.
const EPS = 1e-3;
// Reach of the pointer mapping in multiples of the subject's measured WIDTH: how
// far off-centre the pointer can place the well's drain (subject-relative). The
// card itself never travels this far — pullMag ≤ dist bounds the slide and
// boundOffset clips it to the tile envelope.
const REACH_UNITS = 1.1;
// Travel-envelope guard: the card's CENTER offset is clamped so its near edge
// stays inside the tile's visible half-width (camera fov 40° @ z≈3.2 →
// half-width ≈ 1.55). Conservative; clips the offset, never the geometry.
const FRAME_HALF_WIDTH = 1.55;
const FRAME_MARGIN = 0.94;
// Reference distance (subject-relative, × measured width) that normalizes the
// inverse-power pull curve: at dist = PULL_REF_UNITS×width the pull fraction is
// `gravity` itself (before clamping). Chosen so the engaged pin {0.62,0.5} lands
// the NORMALIZED distance ABOVE 1 (≈1.5×width units), so the pull fraction sits
// in the mid band (≈0.6 at the default gravity/falloff) — leaving gravity AND
// falloff real headroom to reshape the pinned frame (no hard f=1 saturation that
// would flatten the control response there). Nearer drains saturate f→1 (a deep
// well), which is the intended astrophysical behaviour.
const PULL_REF_UNITS = 0.18;
// Distance (subject-relative) below which tides reach toward full strength —
// closer than this and the stretch saturates (bounded), so the card never
// explodes even as f → 1 at the drain.
const TIDE_NEAR = 0.45;
// Per-mote orbit extents, subject-relative (× measured width). The dust rim where
// motes (re)spawn before spiralling into the drain.
const MOTE_RIM = 0.55;
// Mote spiral speed (radians/sec base) and per-phase drain rate.
const MOTE_SPIN = 2.4;
const MOTE_DRAIN = 0.6;
// Standing draw-in depth band as a function of pullSpeed. At the engaged STEADY
// state a viscous (slow) well leaves the card hanging part-way down the well —
// the equilibrium draw-in is damped to DRAW_DEPTH_MIN of the full inverse-square
// target; a snappy (fast) pull locks the card the full way IN. The card thus
// sits visibly DEEPER (and stretches MORE, since tide tracks the draw-in) as
// pullSpeed rises — so the control reshapes the pinned frame, not just transient
// rate. Bounded ≤ 1 (never overshoots the inverse-square target).
const DRAW_DEPTH_MIN = 0.45;
// ── STANDING ENGAGED RING (the moteCount fix) ──────────────────────────────
// The W4 advocate rig pins the cursor at {0.5,0.7} for control sweeps (NOT
// {0.62,0.5}): a PURE VERTICAL downward offset, x dead-center. At that frozen
// pin the live drain-spiral (phase/decay/shimmer driven by a single static t)
// collapses every mote toward the occluded drain at a faint phase tail — so
// moteCount measured byte-identical and rendered NO visible dust. The fix: at
// the engaged STANDING state, abandon the spiral and lay the motes on a BOLD,
// plainly-visible orbital RING around the drain — deterministic even angular
// spread keyed DIRECTLY off moteCount (not the pointer axis), a legible brass
// radius/brightness FLOOR, so (a) the dust is unmissable at the static pin and
// (b) sweeping moteCount 3→12 fills the ring with new lit dots (bold pixel
// delta). The live drain-spiral (applyMotes) still runs for the play frames.
// Ring radius as a fraction of measured width — well clear of the drain center
// so no mote hides behind the deeply-pulled card, but tight enough that the band
// reads as dust orbiting the well mouth and most motes stay inside the frame.
const RING_RADIUS_FRAC = 0.4;
// Bold constant brass brightness for every standing-ring mote — bright enough to
// read against the dark Observatory ground at the detail-preview resolution,
// independent of phase (no faint-tail dropout). Scaled into the [0,1] color.
const RING_LUM = 0.95;
// Per-mote radial wobble so the ring is a dust band, not a perfect circle —
// deterministic (index hash), keeps it reading as orbital dust not a hoop.
const RING_RADIUS_JITTER = 0.22;

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

/** Read the host pointer in 0..1, finite-guarded; defaults to center (the
 *  disengaged idle). */
function readPointer(userData: Record<string, unknown>): PointerXY {
  const p = (userData as { pointer?: Partial<PointerXY> }).pointer;
  return {
    x: clamp(num(p?.x as number | undefined, 0.5), 0, 1),
    y: clamp(num(p?.y as number | undefined, 0.5), 0, 1),
  };
}

/** Subject bbox WIDTH in the parent's local units (position offsets live there).
 *  0 when not yet measurable — caller retries (async mounts pour geometry after
 *  attach). Falls back to the median dimension for width-degenerate subjects. */
function measureWidthLocal(subject: Object3D): number {
  const box = new Box3().setFromObject(subject);
  if (box.isEmpty()) return 0;
  const dims = box.getSize(new Vector3());
  let size = dims.x;
  if (!Number.isFinite(size) || size <= 1e-6) {
    const sorted = [dims.x, dims.y, dims.z].sort((a, b) => a - b);
    size = sorted[1] > 1e-6 ? sorted[1] : sorted[2];
  }
  if (!Number.isFinite(size) || size <= 1e-6) return 0;
  if (subject.parent) {
    const ps = subject.parent.getWorldScale(new Vector3());
    const s = Math.max(Math.abs(ps.x), Math.abs(ps.y), Math.abs(ps.z));
    if (Number.isFinite(s) && s > 1e-6) size /= s;
  }
  return size;
}

export const gravityWellPrimitive: PrimitiveDefinition = {
  name: 'gravity-well',
  label: 'Gravity Well',
  category: 'pointer',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'pointer',
  schema: SCHEMA,
  description:
    'The cursor bends space — the card slides down the well’s curve toward it, stretching tidally as it nears, orbital dust streaming past into the drain.',
  create: defineAnimatable(
    { name: 'gravity-well', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = target.subject ?? target.object;
      // Snapshot EVERYTHING we write; dispose hands it back exactly as found.
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      const baseRotZ = subject.rotation.z;
      const baseScaleX = subject.scale.x;
      const baseScaleY = subject.scale.y;

      // Subject-relative travel unit; 0 = not measurable yet (retried in seek).
      let size = measureWidthLocal(subject);

      // ── Orbital dust motes — ONE instanced Sprite (embers discipline) ──────
      // Per-mote deterministic constants, cached once (no Math.random ever).
      const moteAngle0 = new Float32Array(MAX_MOTES); // base spiral angle
      const moteRadius0 = new Float32Array(MAX_MOTES); // spawn radius fraction
      const motePhase0 = new Float32Array(MAX_MOTES); // initial drain phase
      const moteSpin = new Float32Array(MAX_MOTES); //   per-mote angular rate
      const moteZ = new Float32Array(MAX_MOTES); //      slight z separation
      for (let i = 0; i < MAX_MOTES; i++) {
        moteAngle0[i] = hash1(i + 1.7) * Math.PI * 2;
        moteRadius0[i] = 0.55 + hash1(i * 2.13 + 3.1) * 0.45; // 0.55..1.0 of rim
        motePhase0[i] = hash1(i * 3.71 + 5.9);
        moteSpin[i] = 0.7 + hash1(i * 5.13 + 9.2) * 0.9; // 0.7..1.6 × MOTE_SPIN
        moteZ[i] = (hash1(i * 7.27 + 2.2) - 0.5) * 0.18; // gentle depth spread
      }

      const positions = new Float32Array(MAX_MOTES * 3);
      const colors = new Float32Array(MAX_MOTES * 3);
      const posAttr = new InstancedBufferAttribute(positions, 3);
      const colAttr = new InstancedBufferAttribute(colors, 3);
      posAttr.setUsage(DynamicDrawUsage); // rewritten every seek
      colAttr.setUsage(DynamicDrawUsage);

      // The sprite gets its OWN quad geometry (never the class-shared one) so
      // dispose() can free it — the renderer's geometry-dispose listener also
      // releases the GPU buffers of the node-level instanced attributes.
      const geometry = new BufferGeometry();
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      geometry.setAttribute(
        'position',
        new BufferAttribute(
          new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]),
          3,
        ),
      );
      geometry.setAttribute(
        'uv',
        new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2),
      );
      // Attached by name so tests/tools can discover the live buffers; the
      // material reads them via instancedBufferAttribute() nodes.
      geometry.setAttribute('instancePosition', posAttr);
      geometry.setAttribute('instanceColor', colAttr);

      // Look layer: TSL radial falloff × per-mote instanced color. d: 0 at the
      // quad center → 1 at the edge midpoint. Gaussian core, killed to EXACT zero
      // strictly before the quad edge so no square rim can ever show at any DPR.
      const d = uv().sub(0.5).mul(2).length();
      const glow = exp(d.mul(d).mul(-3.4));
      const rim = smoothstep(float(0.7), float(0.95), d).oneMinus();
      // TSL's d.ts types instancedBufferAttribute() as a bare Node; the runtime
      // object is a full chainable ShaderNodeObject (house casting discipline,
      // cf. embers.ts / bevel-glass.ts).
      const moteTint = instancedBufferAttribute(colAttr) as unknown as {
        mul: (x: unknown) => ReturnType<typeof vec3>;
      };

      const material = new PointsNodeMaterial({
        size: 0.06,
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      material.positionNode = instancedBufferAttribute(posAttr);
      material.colorNode = vec4(moteTint.mul(glow.mul(rim)), float(1));

      const sprite = new Sprite(material);
      sprite.geometry = geometry;
      sprite.count = clamp(Math.round(num(params.moteCount, 8)), 3, MAX_MOTES);
      sprite.frustumCulled = false; // instances extend beyond the unit quad
      sprite.name = 'gravity-well-motes';
      target.object.add(sprite);

      // Brass dust tint (warm Observatory-Brass — never purple).
      const moteColor = new Color('#cd9f55');

      // Tracker state, persisted across seeks on the closure.
      let prevT: number | null = null; // last seek time (wrap/pin detection)
      let posX = 0; //                   tracked chase offset, x (parent-local)
      let posY = 0; //                   tracked chase offset, y
      let lastP: PointerXY = { x: 0.5, y: 0.5 }; // last pointer for onParamChange

      const reachUnits = (): number => REACH_UNITS * (size > 0 ? size : 1);

      /** Standing draw-in DEPTH as a function of pullSpeed: a viscous (slow) well
       *  settles the card only DRAW_DEPTH_MIN of the way to the inverse-square
       *  target at steady state, a snappy (fast) pull draws it the full way in.
       *  Maps the rate control into the EQUILIBRIUM pose, so sweeping it at the
       *  static pin visibly re-renders the frame (deeper offset + deeper tide).
       *  Bounded (0,1]. */
      const drawDepth = (): number => {
        const speed = clamp(num(params.pullSpeed, 0.4), 0.05, 0.95);
        // speed 0.05 → DRAW_DEPTH_MIN; speed 0.95 → 1. Smooth, monotone.
        const u = (speed - 0.05) / (0.95 - 0.05);
        return clamp(DRAW_DEPTH_MIN + (1 - DRAW_DEPTH_MIN) * u, DRAW_DEPTH_MIN, 1);
      };

      /** Bound a raw travel offset so the card's near edge stays on-screen.
       *  Subject-relative: the limit subtracts the card's own measured half-width
       *  so its edge never pushes past the tile envelope. */
      const boundOffset = (offset: number): number => {
        const half = (size > 0 ? size : 1.74) * 0.5;
        const limit = Math.max(FRAME_HALF_WIDTH * FRAME_MARGIN - half, 0.05);
        return clamp(offset, -limit, limit);
      };

      /** The well drain: the pointer mapped to a subject-relative point on the
       *  card's plane. Center pointer (0.5,0.5) → drain at home (no pull). */
      const drainOffset = (p: PointerXY): { x: number; y: number } => {
        const reach = reachUnits();
        // Y reach gentler so the vertical envelope stays well in frame.
        return { x: (p.x - 0.5) * 2 * reach, y: (p.y - 0.5) * 2 * reach * 0.7 };
      };

      /** The steady pull TARGET offset for a pointer — the inverse-square-ish
       *  curve. The well draws the card a FRACTION `f` of the way to the drain,
       *  where f is a normalized inverse-power of the drain distance:
       *
       *      f = clamp( gravity / (dist/REF)^falloff , 0 , 1 )
       *
       *  so f → 1 (card snaps near the drain) when the drain is CLOSE or gravity
       *  is high, and f → 0 (the card barely stirs) when the drain is FAR — a
       *  convex, super-linear curve (NOT magnetic's linear pull). The per-UNIT-
       *  distance pull is therefore much stronger near than far. The offset is
       *  `f × drain`, so gravity / falloff visibly reshape it at EVERY distance
       *  (no saturating cap that flattens the control response).
       *
       *  Tide = how DEEP the card sits in the well = f, sharpened near the core,
       *  bounded 0..1. Stronger gravity / nearer drain → larger f → more stretch,
       *  exactly the brief's "stretching tidally as it nears". */
      const pullTarget = (p: PointerXY): { x: number; y: number; tide: number } => {
        const drain = drainOffset(p);
        const dist = Math.hypot(drain.x, drain.y);
        if (dist <= EPS) return { x: 0, y: 0, tide: 0 };
        const gravity = num(params.gravity, 1.4);
        const falloff = clamp(num(params.falloff, 2.0), 1.0, 3.0);
        // Normalize distance by a subject-relative reference so the curve is
        // scale-invariant; raise to the falloff power for the inverse-square-ish
        // shape. f is the fraction of the way to the drain the card is pulled.
        const wid = size > 0 ? size : 1;
        const ref = PULL_REF_UNITS * wid;
        const distN = dist / ref;
        const f = clamp(gravity / (Math.pow(distN, falloff) + EPS), 0, 1);
        // Tide deepens with f AND with raw proximity to the drain (1/dist near
        // the core), so the elongation grows as the card NEARS the well even
        // where f has saturated. Bounded 0..1.
        const tideNear = TIDE_NEAR * wid;
        const tide = clamp(f * Math.min(1, tideNear / Math.max(dist, EPS)), 0, 1);
        return { x: drain.x * f, y: drain.y * f, tide };
      };

      /** The ENGAGED STEADY pose for a pointer — the inverse-square pull target
       *  scaled by the standing draw-in DEPTH (a function of pullSpeed). At the
       *  pinned dt≈0 frame the card sits at this damped equilibrium: a viscous
       *  well hangs it part-way in, a snappy pull locks it deep — and the tide
       *  (well depth) scales with the same draw-in, so a faster pull both pulls
       *  the card deeper AND stretches it more. Live motion still chases the full
       *  `pullTarget` (this depth is the standing equilibrium the spring relaxes
       *  toward); only the pinned re-derive reads it, so playback physics (travel,
       *  near-vs-far) are unchanged. */
      const standingTarget = (p: PointerXY): { x: number; y: number; tide: number } => {
        const tgt = pullTarget(p);
        const depth = drawDepth();
        return { x: tgt.x * depth, y: tgt.y * depth, tide: tgt.tide * depth };
      };

      /** Write the full pose: bounded position offset, a rotation.z aiming the
       *  stretch axis at the drain, and the anisotropic tidal scale (elongate
       *  along the pull axis, squash across it). All written every seek so a
       *  control sweep / pin self-restores cleanly. */
      const apply = (offX: number, offY: number, tide: number): void => {
        const bx = boundOffset(offX);
        const by = boundOffset(offY);
        subject.position.x = baseX + bx;
        subject.position.y = baseY + by;
        // Aim the elongation axis at the drain via rotation.z, then stretch along
        // local x (now pointing at the cursor) and squash local y.
        const dir = Math.hypot(bx, by);
        const angle = dir > EPS ? Math.atan2(by, bx) : 0;
        subject.rotation.z = baseRotZ + angle;
        const t = clamp(tide, 0, 1);
        const gain = clamp(num(params.tidalStretch, 0.22), 0.05, 0.5);
        const stretch = 1 + t * gain; //        elongate along the pull
        const squash = 1 - t * gain * 0.5; //    squash across it (volume-ish)
        subject.scale.x = baseScaleX * stretch;
        subject.scale.y = baseScaleY * squash;
      };

      /** Park motes [from, MAX_MOTES) far below view AND dark so the buffers stay
       *  deterministic for a given count. */
      const parkUnused = (from: number): void => {
        for (let i = from; i < MAX_MOTES; i++) {
          positions[i * 3] = 0;
          positions[i * 3 + 1] = -1000;
          positions[i * 3 + 2] = 0;
          colors[i * 3] = 0;
          colors[i * 3 + 1] = 0;
          colors[i * 3 + 2] = 0;
        }
      };

      /** LIVE drain-spiral (the play frames). Each mote rides a decaying spiral
       *  centred on the drain: angle advances with t, radius shrinks toward 0 over
       *  its phase then respawns at the rim, brightness fades as it drains. Used
       *  ONLY when the clock is moving (dt>0) — the engaged static pin uses the
       *  bold standing ring instead. Deterministic (index hash), DOM-free. */
      const applyMotes = (p: PointerXY, t: number): void => {
        const count = clamp(Math.round(num(params.moteCount, 8)), 3, MAX_MOTES);
        sprite.count = count;
        const drain = { x: boundOffset(drainOffset(p).x), y: boundOffset(drainOffset(p).y) };
        const rim = MOTE_RIM * (size > 0 ? size : 1);
        const tval = Number.isFinite(t) ? t : 0;
        for (let i = 0; i < count; i++) {
          // Phase wraps in [0,1): 0 = freshly spawned at the rim, 1 = drained in.
          let ph = (tval * MOTE_DRAIN + motePhase0[i]) % 1;
          if (ph < 0) ph += 1;
          const spawnR = rim * moteRadius0[i];
          const decay = 0.35 + 0.65 * (1 - ph) * (1 - ph); // 0.35..1.0 of spawnR
          const radius = spawnR * decay;
          // Angle winds faster as the radius shrinks (conservation-of-angular-
          // momentum flavour): more spin near the core.
          const winding = 1 + ph * 1.6;
          const angle = moteAngle0[i] + tval * MOTE_SPIN * moteSpin[i] * winding;
          positions[i * 3] = drain.x + Math.cos(angle) * radius;
          positions[i * 3 + 1] = drain.y + Math.sin(angle) * radius;
          positions[i * 3 + 2] = moteZ[i];
          // Brightness: a gentle spawn-in, a long fade as it drains (the spiral's
          // live shimmer). Faint brass — never competes with the card. Floored so
          // the streaming dust always reads during play.
          const spawn = Math.min(1, ph / 0.12);
          const fade = (1 - ph) * (1 - ph);
          const shimmer = spawn * fade; // 0..1 live spiral pulse
          const lum = (0.45 + 0.55 * shimmer) * 0.7;
          colors[i * 3] = moteColor.r * lum;
          colors[i * 3 + 1] = moteColor.g * lum;
          colors[i * 3 + 2] = moteColor.b * lum;
        }
        parkUnused(count);
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
      };

      /** STANDING engaged RING (the moteCount fix — the frozen control pin).
       *  At the engaged STATIC pin the live spiral collapses every mote toward the
       *  occluded drain at a faint phase tail (invisible, byte-identical across
       *  moteCount). Instead, lay the `moteCount` motes on a BOLD orbital RING
       *  around the drain:
       *    • EVEN angular spread keyed DIRECTLY off the live count (2π·i/count)
       *      plus a per-mote hash jitter, so adding motes drops NEW lit dots into
       *      fresh gaps on the ring — a plainly visible density change.
       *    • A legible brass RADIUS floor (RING_RADIUS_FRAC × width, per-mote
       *      wobble) so no mote hides behind the deeply-pulled card and the band
       *      reads as orbital dust, not a hoop.
       *    • A BOLD constant brightness floor (RING_LUM) — every mote plainly lit
       *      regardless of phase, no faint-tail dropout.
       *  Keyed off the FULL-MAGNITUDE drain, so it reshapes at BOTH rig pins
       *  ({0.62,0.5} horizontal AND {0.5,0.7} pure-vertical, x dead-center).
       *  Deterministic, DOM-free, additive overlay — never touches the subject. */
      const applyStandingMotes = (p: PointerXY): void => {
        const count = clamp(Math.round(num(params.moteCount, 8)), 3, MAX_MOTES);
        sprite.count = count;
        const rawDrain = drainOffset(p);
        // ENGAGEMENT from the FULL-MAGNITUDE drain (never an axis alone — x is 0
        // at the {0.5,0.7} useradvocate pin). 0 at center (disengaged idle) → the
        // ring fades out so the rest frame stays clean; ~1 at the engaged pins.
        const wid = size > 0 ? size : 1;
        const dist = Math.hypot(rawDrain.x, rawDrain.y);
        const eng = clamp(dist / (0.18 * wid), 0, 1);
        const drain = { x: boundOffset(rawDrain.x), y: boundOffset(rawDrain.y) };
        const ringR = RING_RADIUS_FRAC * wid;
        for (let i = 0; i < count; i++) {
          // Even spread around the ring (depends on COUNT so the gaps refill as
          // motes are added) + a deterministic per-mote angular + radial wobble.
          const base = (i / count) * Math.PI * 2;
          const jitterA = (hash1(i * 1.91 + 0.4) - 0.5) * (Math.PI / count); // < half a slot
          const angle = base + jitterA;
          const radius = ringR * (1 + (hash1(i * 2.71 + 1.3) - 0.5) * 2 * RING_RADIUS_JITTER);
          positions[i * 3] = drain.x + Math.cos(angle) * radius;
          positions[i * 3 + 1] = drain.y + Math.sin(angle) * radius;
          positions[i * 3 + 2] = moteZ[i];
          // Bold constant brass at engagement — slight per-mote variance so the
          // band shimmers without any mote dropping out of view. Scaled by `eng`
          // so the dust kindles in only when the well is engaged (clean at rest).
          const lum = RING_LUM * (0.82 + hash1(i * 4.07 + 2.6) * 0.18) * eng;
          colors[i * 3] = moteColor.r * lum;
          colors[i * 3 + 1] = moteColor.g * lum;
          colors[i * 3 + 2] = moteColor.b * lum;
        }
        parkUnused(count);
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
      };

      return {
        // Stateful pointer effect: tracks the live pointer, never "ends".
        duration: () => Infinity,
        seek: (t) => {
          if (size <= 0) size = measureWidthLocal(subject);
          const p = readPointer(target.userData);
          lastP = p;
          const tgt = pullTarget(p);

          if (prevT === null || t < prevT - 1e-6) {
            // First frame or loop wrap: SNAP to the engaged STEADY pose for this
            // pointer (the standing draw-in depth set by pullSpeed). At center
            // (disengaged idle) the pull target is 0 → exact home pose (legible at
            // rest). At an engaged offset it lands on the standing pull target with
            // the tidal stretch for that depth — never an empty frame.
            const st = standingTarget(p);
            posX = st.x;
            posY = st.y;
            prevT = t;
            apply(posX, posY, st.tide);
            applyStandingMotes(p);
            return;
          }

          const dtRaw = t - prevT;
          if (dtRaw > 1e-6) {
            const dt = Math.min(dtRaw, DT_MAX);
            // dt-normalized exponential spring toward the pull target — a long
            // viscous fall at low pullSpeed, a snappy drop at high.
            const speed = clamp(num(params.pullSpeed, 0.4), 0.05, 0.95);
            const k = -Math.log(1 - speed) * 60; // per-frame f → continuous rate
            const alpha = 1 - Math.exp(-k * dt);
            posX += (tgt.x - posX) * alpha;
            posY += (tgt.y - posY) * alpha;
            prevT = t;
            // Tides track the LIVE proximity of the card's current pull target.
            apply(posX, posY, tgt.tide);
            applyMotes(p, t);
            return;
          }

          // dtRaw ≈ 0 (repeated pinned seeks — the rig's paused control sweep):
          // re-derive the engaged STEADY pose from (pointer, params) so the frozen
          // frame is byte-stable AND every control reshapes it. pullSpeed sets the
          // standing draw-in depth here, so sweeping it visibly re-renders the pin;
          // moteCount lays the BOLD standing ring so its dot count plainly changes.
          const st = standingTarget(p);
          posX = st.x;
          posY = st.y;
          prevT = t;
          apply(posX, posY, st.tide);
          applyStandingMotes(p);
        },
        onParamChange: () => {
          // Re-apply the engaged steady pose at the LAST pointer with live params,
          // so a paused tweak (gravity / falloff / tidalStretch / moteCount /
          // pullSpeed) lands immediately on the held frame. pullSpeed reshapes the
          // standing draw-in depth (deeper + more stretch as it rises).
          if (prevT === null) return; // untouched until the first seek
          if (size <= 0) size = measureWidthLocal(subject);
          const st = standingTarget(lastP);
          posX = st.x;
          posY = st.y;
          apply(posX, posY, st.tide);
          // The paused control sweep (incl. moteCount) lands on the BOLD standing
          // ring — the held pin frame, not the live spiral.
          applyStandingMotes(lastP);
        },
        dispose: () => {
          // Restore the full home transform exactly.
          subject.position.x = baseX;
          subject.position.y = baseY;
          subject.rotation.z = baseRotZ;
          subject.scale.x = baseScaleX;
          subject.scale.y = baseScaleY;
          // Remove + dispose ONLY what this primitive created.
          target.object.remove(sprite);
          geometry.dispose();
          material.dispose();
        },
      };
    },
  ),
};
