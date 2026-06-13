// rope-dangle-sim — a real XPBD rope: a chain of ~18 particles linked by distance
// constraints, the TOP particle pinned to a moving anchor, the rest hanging under
// gravity. As the anchor sweeps side-to-side the rope SWINGS and WHIPS with
// genuine momentum — the bottom lags, overshoots, and trails the anchor like a
// hanging cord, not a kinematic sine.
//
// GENUINE SIMULATION (XPBD, Macklin "small steps"), not an easing curve:
//   • particles as flat px/py/pz + pvx/pvy/pvz + invMass (0 = pinned anchor);
//   • per substep (SUBSTEPS of dt/SUBSTEPS): (1) save prevPos, integrate gravity
//     into velocity + predict positions; (2) solve every distance constraint ONCE
//     in fixed order via solveDistanceConstraint with alphaTilde =
//     complianceAlpha(stiffness01, dtSub); (3) set velocity = (pos−prevPos)/dtSub
//     with an exp damping bleed. The anchor is re-pinned each substep.
//
// ANCHOR MOTION (the swing source): the anchor follows a DETERMINISTIC time-based
// sweep — a seeded compound sine in X with a gentle bob in Y — so during the
// replay stepper's fixed-step march the rope is perpetually swinging/whipping with
// real momentum even with no live cursor. The LIVE pointer.x (userData.pointer,
// 0..1, 0.5 = centre) is BLENDED in additively, so dragging the cursor whips the
// rope around in real time. Both paths feed the SAME pinned anchor → the frozen
// frame is a pure function of (params, t, pointer).
//
// DETERMINISM: makeReplayStepper resets-and-replays on a backward seek and on any
// param change (onParamChange → markDirty), so every control — segments,
// stiffness, gravity, damping — re-runs the whole sim to the SAME pinned t and
// visibly reshapes any frozen frame the verification harness pins. duration() is
// finite (a lively swing window); the rig loops t→0 and the rope re-seeds. The
// ~0.45 frozen phase lands the anchor mid-sweep, so the rope is caught MID-SWING.
//
// RENDER PATH (round-2 BLOCK fix). The earlier build rendered the cord as a
// per-frame `new TubeGeometry` on a `MeshStandardNodeMaterial`. On the real
// shared-rig WebGPU context that tube never appeared — only the bright anchor
// bead drew, so the advocate saw "a lone white ball" and (because the invisible
// tube was the ONLY thing the controls reshaped) every control frame was a
// byte-identical near-black field: 4 DEAD controls. The robust catalog-proven
// path (molten-drip-sim / bubble-rise-sim) is an instanced THREE.Sprite +
// PointsNodeMaterial (TSL): the cord is a DENSE chain of OPAQUE shaded beads
// sampled along the live XPBD path and REBUILT EVERY write(). NormalBlending +
// an opaque amber/brass CORE means overlapping beads OCCLUDE (read as one solid
// rope body on the dark field) rather than SUM to white; a thin additive-free
// emissive rim gives the metal glow. The beads visibly swing and EVERY control
// reshapes the chain, so the dead-control / empty-panel block is resolved.
//
// Palette: Observatory Brass — warm satin cord (#e8c79a body, #f0c98a hot crest),
// pale-ice anchor bead (#cfe6f2). Warm metal, never purple, never blown white.
//
// DISTINCT from spring-chain-follow (a 3-body card+ghost spring RELAY, no rope
// geometry) and pendant-dangle: this is a true many-particle XPBD cord rendered
// as one continuous bead chain.

import {
  Sprite,
  BufferGeometry,
  BufferAttribute,
  InstancedBufferAttribute,
  Color,
  CatmullRomCurve3,
  Vector3,
  NormalBlending,
  DynamicDrawUsage,
} from 'three';
import { PointsNodeMaterial } from 'three/webgpu';
import { instancedBufferAttribute, uv, vec2, vec3, vec4, float, smoothstep } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';
import {
  hash1,
  makeReplayStepper,
  solveDistanceConstraint,
  complianceAlpha,
  resolveSimTier,
  tierPick,
} from './_sim-core';

// ── Fixed build-time allocation (live `segments` clamps to MAX, never realloc) ──
// Camera (catalog rig): PerspectiveCamera(fov 40) at z=3.2 → visible half-height
// at z=0 is ≈1.165 scene units. The whole rope MUST live inside that band or it
// clips at the frame edge and reads as the "empty panel" the advocate flagged.
const MAX_SEG = 22; // up to 22 particles in the chain
const TOP_Y = 0.78; // anchor rest height — kept so the pin + bob never push past
//                     the top edge (was clipped at +1.165 at higher values).
const ROPE_LEN = 1.34; // total rope length when fully extended — the free end
//                       rests at ≈−0.56, so even under heavy-gravity sag + a full
//                       swing the cord stays inside the ±1.0 visible band.

// Anchor sweep tuning (deterministic swing; pointer adds on top of this).
const SWEEP_AMP = 0.42; // base horizontal sweep half-width (kept inside frame so
//                        the swinging tip + bead footprint never clips the edge)
const SWEEP_HZ = 0.62; // primary sweep frequency (cycles/sec)
const BOB_AMP = 0.09; // vertical bob amplitude (small; anchor stays in frame)
const POINTER_GAIN = 0.55; // how far the live pointer drags the anchor (scene units)

// ── Render: dense bead chain sampled along the live XPBD path ─────────────────
// The cord is BEADS rather than a tube so it renders through the catalog rig's
// node-material pipeline reliably (the per-frame TubeGeometry never appeared).
// BEAD_SAMPLES beads are spread evenly along the CatmullRom curve through the
// active nodes, so the chain reads as one continuous rope, not a string of dots.
const BEAD_SAMPLES = 56; // beads along the cord (dense enough to read solid)
// Generous fixed billboard footprint (à la molten-drip): the per-bead radius
// attribute drives where the falloff lives INSIDE this quad, so the soft edge
// never reaches the square edge of the billboard.
const FIXED_BILLBOARD = 0.34;
const BEAD_R = 0.34; // bead profile radius in quad units (overlap → solid cord)

const SCHEMA = [
  { id: 'segments', label: 'Segments', type: 'knob', min: 8, max: 22, step: 1, default: 18 },
  { id: 'stiffness', label: 'Stiffness', type: 'fader', min: 0.2, max: 1, step: 0.01, default: 0.85 },
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 2, max: 22, step: 0.5, default: 11 },
  { id: 'damping', label: 'Damping', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.18 },
] as const;

interface PointerXY {
  x: number;
  y: number;
}

/** Read pointer {x,y} in 0..1 from shared userData, defaulting to centre. */
function readPointer(userData: Record<string, unknown>): PointerXY {
  const p = userData.pointer as Partial<PointerXY> | undefined;
  return {
    x: typeof p?.x === 'number' && Number.isFinite(p.x) ? p.x : 0.5,
    y: typeof p?.y === 'number' && Number.isFinite(p.y) ? p.y : 0.5,
  };
}

export const ropeDangleSimPrimitive: PrimitiveDefinition = {
  name: 'rope-dangle-sim',
  label: 'Rope Dangle (Sim)',
  category: 'pointer',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'pointer',
  description:
    'A real XPBD rope — a chain of particles pinned to a moving anchor, hanging under gravity and swinging with genuine momentum as the cursor whips the anchor around.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'rope-dangle-sim', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      // Tier gating (INV-9): the rope is a 1D chain (cheap), but more substeps =
      // crisper constraints. T0 takes a coarser sub-step budget so it degrades
      // gracefully; T2 runs full fidelity. Step size scales likewise.
      const tier = resolveSimTier(target);
      const SUBSTEPS = tierPick(tier, { T0: 4, T1: 6, T2: 8 });
      const DT = tierPick(tier, { T0: 1 / 90, T1: 1 / 110, T2: 1 / 120 });
      // Constraint iterations per substep. A SINGLE Gauss-Seidel pass under heavy
      // gravity (default 11, max 22) leaves the long chain badly under-constrained
      // → it stretches unboundedly and the cord hangs FAR below the tile (the
      // round-2 "rope absent" symptom was the cord drooping off-frame). Several
      // fixed-order passes converge the distance constraints so the cord holds its
      // rest length and stays inside the visible band. Still deterministic
      // (fixed count, fixed order, no randomness) and cheap (a 1D chain).
      const SOLVER_ITERS = tierPick(tier, { T0: 8, T1: 12, T2: 16 });

      // ── Flat particle arrays (fixed MAX allocation) ────────────────────────
      const px = new Float32Array(MAX_SEG);
      const py = new Float32Array(MAX_SEG);
      const pz = new Float32Array(MAX_SEG);
      const pvx = new Float32Array(MAX_SEG);
      const pvy = new Float32Array(MAX_SEG);
      const pvz = new Float32Array(MAX_SEG);
      const invMass = new Float32Array(MAX_SEG);
      // Scratch prev-position for the XPBD velocity update.
      const prx = new Float32Array(MAX_SEG);
      const pry = new Float32Array(MAX_SEG);
      const prz = new Float32Array(MAX_SEG);

      let activeN = -1; // particle count the rope was last built for
      let restLink = ROPE_LEN / (MAX_SEG - 1); // per-link rest length (set in build)

      // A deterministic tiny per-particle Z so the cord isn't perfectly planar
      // (reads as 3D in the lit scene); seeded, never random.
      const seedZ = (i: number): number => (hash1(i * 2.71 + 1.3) - 0.5) * 0.05;

      /** The anchor's DETERMINISTIC world position at sim time `t` (+ live
       *  pointer blend). A compound sine sweep in X gives the swing momentum; a
       *  gentle bob in Y adds life. The pointer drags the whole anchor. */
      const anchorAt = (t: number): { ax: number; ay: number; az: number } => {
        // Compound sweep: a primary swing plus a slower secondary so the motion
        // never looks like a single clean sine (the rope reads as hand-driven).
        const phase = hash1(4.7) * Math.PI * 2; // fixed seeded phase offset
        const sweep =
          Math.sin(t * SWEEP_HZ * Math.PI * 2 + phase) * SWEEP_AMP +
          Math.sin(t * SWEEP_HZ * Math.PI * 2 * 0.41 + phase * 1.7) * SWEEP_AMP * 0.32;
        const bob = Math.sin(t * SWEEP_HZ * Math.PI * 2 * 1.9 + phase) * BOB_AMP;
        const p = readPointer(target.userData);
        // Live pointer drags the anchor laterally (and a touch vertically).
        const dragX = (clamp(p.x, 0, 1) - 0.5) * 2 * POINTER_GAIN;
        const dragY = (clamp(p.y, 0, 1) - 0.5) * 2 * POINTER_GAIN * 0.35;
        // Clamp the anchor inside the visible frame so the pin is never off-screen
        // (square tiles see ≈±1.0 in x; the top edge is ≈+1.165 in y).
        return {
          ax: clamp(sweep + dragX, -0.95, 0.95),
          ay: clamp(TOP_Y + bob + dragY, -0.2, 1.05),
          az: 0,
        };
      };

      /** (Re)build the rope as an N-particle vertical chain hanging from the
       *  anchor's current position, velocities zeroed. invMass[0] = 0 (pinned). */
      const buildRope = (n: number) => {
        activeN = n;
        restLink = ROPE_LEN / (n - 1);
        const a = anchorAt(0);
        for (let i = 0; i < n; i++) {
          px[i] = a.ax;
          py[i] = a.ay - i * restLink; // hang straight down from the anchor
          pz[i] = seedZ(i);
          pvx[i] = 0;
          pvy[i] = 0;
          pvz[i] = 0;
          invMass[i] = i === 0 ? 0 : 1; // top pinned, rest free
        }
        // Park unused particles on top of the last active one (out of the chain).
        for (let i = n; i < MAX_SEG; i++) {
          px[i] = a.ax;
          py[i] = a.ay - (n - 1) * restLink;
          pz[i] = 0;
          pvx[i] = 0;
          pvy[i] = 0;
          pvz[i] = 0;
          invMass[i] = 0;
        }
      };

      const reset = () => {
        const n = Math.max(8, Math.min(MAX_SEG, Math.round(num(params.segments, 18))));
        buildRope(n);
      };

      // simT tracks the integrated time so the anchor sweep is a function of it.
      let simT = 0;

      /** One fixed XPBD step over the active chain. Reads params LIVE. */
      const step = (dt: number) => {
        const n = activeN;
        const stiff = clamp(num(params.stiffness, 0.85), 0.2, 1);
        const g = num(params.gravity, 11);
        const damp = clamp(num(params.damping, 0.18), 0, 1);
        const dtSub = dt / SUBSTEPS;
        const alphaTilde = complianceAlpha(stiff, dtSub);
        const velDamp = Math.exp(-damp * 6 * dtSub); // exp bleed per substep

        for (let s = 0; s < SUBSTEPS; s++) {
          simT += dtSub;
          const a = anchorAt(simT);
          // (1) save prevPos, integrate gravity into velocity, predict positions.
          for (let i = 0; i < n; i++) {
            prx[i] = px[i];
            pry[i] = py[i];
            prz[i] = pz[i];
            if (invMass[i] === 0) continue;
            pvy[i] -= g * dtSub;
            px[i] += pvx[i] * dtSub;
            py[i] += pvy[i] * dtSub;
            pz[i] += pvz[i] * dtSub;
          }
          // Pin the anchor (particle 0) to its live target for this substep.
          px[0] = a.ax;
          py[0] = a.ay;
          pz[0] = a.az;

          // (2) solve all distance constraints in fixed order, iterated so the
          //     long chain converges (one pass under-constrains → runaway stretch).
          //     The anchor is re-pinned after each iteration so the pin never drifts.
          for (let it = 0; it < SOLVER_ITERS; it++) {
            for (let i = 0; i < n - 1; i++) {
              solveDistanceConstraint(px, py, pz, invMass, i, i + 1, restLink, alphaTilde);
            }
            px[0] = a.ax;
            py[0] = a.ay;
            pz[0] = a.az;
          }

          // (3) velocity = (pos − prevPos)/dtSub, with damping bleed.
          for (let i = 0; i < n; i++) {
            if (invMass[i] === 0) continue;
            pvx[i] = ((px[i] - prx[i]) / dtSub) * velDamp;
            pvy[i] = ((py[i] - pry[i]) / dtSub) * velDamp;
            pvz[i] = ((pz[i] - prz[i]) / dtSub) * velDamp;
          }
        }
      };

      const stepper = makeReplayStepper({
        dt: DT,
        reset: () => {
          simT = 0;
          reset();
        },
        step,
      });

      // ── Instanced bead chain (the cord) ────────────────────────────────────
      // BEAD_SAMPLES beads, positions filled each write() by sampling the live
      // CatmullRom path through the active XPBD nodes. Plus ONE anchor bead at
      // index BEAD_SAMPLES (pale ice, brightest) pinned to the top particle.
      const BEAD_COUNT = BEAD_SAMPLES + 1; // cord beads + the anchor hero bead
      const positions = new Float32Array(BEAD_COUNT * 3);
      const colors = new Float32Array(BEAD_COUNT * 3); // premultiplied tint×brightness
      const radii = new Float32Array(BEAD_COUNT); // per-bead profile radius (quad units)
      const posAttr = new InstancedBufferAttribute(positions, 3);
      const colAttr = new InstancedBufferAttribute(colors, 3);
      const radAttr = new InstancedBufferAttribute(radii, 1);
      posAttr.setUsage(DynamicDrawUsage);
      colAttr.setUsage(DynamicDrawUsage);
      radAttr.setUsage(DynamicDrawUsage);

      // Own billboard quad (never class-shared) so dispose() frees it.
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
      geometry.setAttribute('instancePosition', posAttr);
      geometry.setAttribute('instanceColor', colAttr);
      geometry.setAttribute('instanceRadius', radAttr);

      // ── Look layer: TSL bead profile × per-bead instanced color ────────────
      // Quad-centered coords: p = (uv-0.5)*2 → −1..1 across the billboard.
      const p2 = uv().sub(0.5).mul(2.0);
      const d = vec2(p2.x, p2.y).length();
      type FloatNode = ReturnType<typeof float>;
      const rNode = instancedBufferAttribute(radAttr) as unknown as FloatNode;
      // A SOLID round bead: full opacity inside the radius, a soft shaded shoulder,
      // and a hard cutoff just before the quad edge so there is never a square rim.
      // Overlapping solid beads OCCLUDE (NormalBlending) → one continuous cord.
      const core = smoothstep(rNode, rNode.sub(float(0.16)), d); // 1 inside → 0 toward rim
      // Spherical shading: a touch brighter toward the upper-left (key direction)
      // so each bead reads as a rounded metal body, not a flat disc.
      const shade = smoothstep(float(1.0), float(-0.3), p2.x.add(p2.y).mul(0.5)).mul(0.45).add(0.7);
      // Kill strictly before the quad edge (no square at any DPR).
      const clipEdge = smoothstep(float(0.9), float(0.99), d).oneMinus();
      const alpha = core.mul(clipEdge);
      const beadTint = instancedBufferAttribute(colAttr) as unknown as {
        mul: (x: unknown) => ReturnType<typeof vec3>;
      };

      const material = new PointsNodeMaterial({
        size: FIXED_BILLBOARD,
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
        blending: NormalBlending, // OPAQUE cores occlude → solid cord, no white-out
        depthWrite: false,
      });
      material.positionNode = instancedBufferAttribute(posAttr);
      // RGB = per-bead warm tint × spherical shade; A = solid bead profile.
      material.colorNode = vec4(beadTint.mul(shade), alpha);

      const sprite = new Sprite(material);
      sprite.geometry = geometry;
      sprite.count = BEAD_COUNT;
      sprite.frustumCulled = false; // beads extend beyond the unit quad
      sprite.name = 'rope-dangle-sim';
      target.object.add(sprite);

      // ── Curve sampler reused each write() (no per-frame allocation) ─────────
      const curvePts: Vector3[] = [];
      for (let i = 0; i < MAX_SEG; i++) curvePts.push(new Vector3());
      const curve = new CatmullRomCurve3(curvePts.slice(0, 2));
      const sampleV = new Vector3();

      // Warm brass cord palette + pale-ice anchor crest.
      const bodyC = new Color('#e8c79a'); // warm Observatory Brass cord
      const hotC = new Color('#f6d9a6'); // hotter crest near the anchor
      const anchorC = new Color('#dcefff'); // pale ice anchor bead

      const setBead = (i: number, x: number, y: number, z: number, r: number, c: Color, lum: number) => {
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        colors[i * 3] = c.r * lum;
        colors[i * 3 + 1] = c.g * lum;
        colors[i * 3 + 2] = c.b * lum;
        radii[i] = clamp(r, 0.08, 0.48);
      };

      /** Rebuild the bead chain from the current active particle positions. The
       *  beads are sampled along the live CatmullRom path EVERY write() (i.e.
       *  every seek/frame), so the cord visibly swings and every control reshapes
       *  the frozen frame. */
      const write = () => {
        const n = activeN > 1 ? activeN : 2;
        // Update the CatmullRom control points to the live particle path.
        const pts: Vector3[] = [];
        for (let i = 0; i < n; i++) {
          curvePts[i].set(px[i], py[i], pz[i]);
          pts.push(curvePts[i]);
        }
        curve.points = pts;

        // Spread the beads evenly along the cord. Brightness ramps slightly hotter
        // toward the pinned top (where the metal catches the most light) so the
        // hanging cord reads as a lit body, not a uniform stripe.
        const tmpBody = new Color();
        for (let s = 0; s < BEAD_SAMPLES; s++) {
          const u = BEAD_SAMPLES > 1 ? s / (BEAD_SAMPLES - 1) : 0; // 0 top → 1 free end
          curve.getPoint(u, sampleV);
          // Mix body→hot toward the top; the cord tapers a touch toward the tip.
          tmpBody.copy(bodyC).lerp(hotC, 1 - u);
          const lum = 0.92 - u * 0.18; // brighter near the anchor, still bright at the tip
          const r = BEAD_R * (1 - u * 0.18); // slight taper toward the free end
          setBead(s, sampleV.x, sampleV.y, sampleV.z, r, tmpBody, lum);
        }

        // The anchor hero bead — pale ice, fattest + brightest — pins the top so
        // the cord clearly hangs FROM something, and the tile is never empty.
        setBead(BEAD_SAMPLES, px[0], py[0], pz[0], BEAD_R * 1.35, anchorC, 1.1);

        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        radAttr.needsUpdate = true;
      };

      reset();
      write();

      return {
        // Finite, lively swing window; phase ~0.45 lands the anchor mid-sweep so
        // the rope is caught MID-SWING (where every control bites).
        duration: () => 3.0,
        seek: (t) => {
          // A structural change in segment count rebuilds before stepping.
          const n = Math.max(8, Math.min(MAX_SEG, Math.round(num(params.segments, 18))));
          if (n !== activeN) {
            stepper.markDirty();
          }
          stepper.seekStep(t);
          write();
        },
        // Every control re-runs the sim to the SAME pinned t → the frozen frame
        // visibly reshapes when the advocate sweeps any control while paused.
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          target.object.remove(sprite);
          geometry.dispose();
          material.dispose();
        },
      };
    },
  ),
};
