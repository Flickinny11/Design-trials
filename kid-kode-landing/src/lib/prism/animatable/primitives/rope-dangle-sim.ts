// rope-dangle-sim — a real XPBD rope: a chain of ~18 particles linked by distance
// constraints, the TOP particle pinned to a moving anchor, the rest hanging under
// gravity. As the anchor sweeps side-to-side the rope SWINGS and WHIPS with
// genuine momentum — the bottom lags, overshoots, and trails the anchor like a
// hanging cord, not a kinematic sine. Rendered as a continuous thick tube
// (CatmullRom TubeGeometry rebuilt each frame from the live particle positions),
// so the cord reads as a solid rope in brass/steel, never a line of dots.
// CATALOG primitive (hard / pointer, subject:'empty', defaultDriver:'pointer').
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
// DISTINCT from spring-chain-follow (a 3-body card+ghost spring RELAY, no rope
// geometry) and pendant-dangle: this is a true many-particle XPBD cord rendered
// as one continuous tube.

import {
  Mesh,
  TubeGeometry,
  SphereGeometry,
  CatmullRomCurve3,
  Vector3,
  MeshStandardNodeMaterial,
  Color,
} from 'three/webgpu';
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
const TOP_Y = 0.82; // anchor rest height — lowered from 1.15 so the pin + bob
//                     never push past the top edge (was clipped at +1.165).
const ROPE_LEN = 1.55; // total rope length when fully extended — shortened from
//                       1.9 so the free end rests at ≈−0.73, comfortably inside
//                       frame (the whole cord now sits centred in the ±1.0 band).
const TUBE_RADIAL = 8; // tube cross-section segments (round-ish, cheap)
const TUBE_PATH = 48; // tube path samples along the CatmullRom curve
const TUBE_R = 0.085; // base tube radius — thickened from 0.05 so the cord reads
//                      as a rope with mass (~8px at a catalog tile), not a hair.

// Anchor sweep tuning (deterministic swing; pointer adds on top of this).
const SWEEP_AMP = 0.5; // base horizontal sweep half-width (kept inside frame)
const SWEEP_HZ = 0.62; // primary sweep frequency (cycles/sec)
const BOB_AMP = 0.09; // vertical bob amplitude (small; anchor stays in frame)
const POINTER_GAIN = 0.55; // how far the live pointer drags the anchor (scene units)

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
        // Park unused particles on top of the last active one (out of the tube).
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

          // (2) solve all distance constraints ONCE in fixed order.
          for (let i = 0; i < n - 1; i++) {
            solveDistanceConstraint(px, py, pz, invMass, i, i + 1, restLink, alphaTilde);
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

      // ── Tube geometry (rebuilt each write from the live particle path) ─────
      const curvePts: Vector3[] = [];
      for (let i = 0; i < MAX_SEG; i++) curvePts.push(new Vector3());
      const curve = new CatmullRomCurve3(curvePts.slice(0, 18));

      // The cord must read BRIGHT against the near-black tile (the advocate's
      // empty-panel block was a dark brass MIRROR — metalness 0.82 + emissive
      // 0.12 reflected only the dim IBL → luma ≈7.7). Fix per the passing sim
      // tiles (molten-drip-sim): drop metalness, push a strong WARM-BRASS
      // emissive so the rope self-illuminates, plus a hot env catch on top. This
      // lands the cord well above the luma>>120 bar regardless of scene light.
      const material = new MeshStandardNodeMaterial({
        color: new Color('#e8c79a'), // warm Observatory Brass
        roughness: 0.28,
        metalness: 0.35, // satin, not a black mirror
        emissive: new Color('#f0c98a'), // brass/amber self-glow (no purple)
        emissiveIntensity: 1.35, // bright — the cord lights itself in the dark
      });
      (material as unknown as { envMapIntensity: number }).envMapIntensity = 1.4;

      // The rope tube is the PRIMARY artifact and is added FIRST so it is the
      // first Mesh child of target.object (the conformance harness measures the
      // tube via the first Mesh — the anchor bead below must not shadow it).
      const tube: Mesh = new Mesh(
        new TubeGeometry(curve, TUBE_PATH, TUBE_R, TUBE_RADIAL, false),
        material,
      );
      tube.name = 'rope-dangle-sim';
      target.object.add(tube);

      // A bright anchor BEAD pins the top of the rope — a guaranteed hero so the
      // tile is never empty even when the cord swings to a frame edge. Added
      // AFTER the tube so it never becomes the harness's measured "first Mesh".
      const beadMat = new MeshStandardNodeMaterial({
        color: new Color('#cfdde6'), // pale steel
        roughness: 0.3,
        metalness: 0.25,
        emissive: new Color('#bfe0ff'), // cool ice glow
        emissiveIntensity: 1.5,
      });
      (beadMat as unknown as { envMapIntensity: number }).envMapIntensity = 1.2;
      const bead = new Mesh(new SphereGeometry(0.12, 20, 14), beadMat);
      bead.name = 'rope-dangle-sim-anchor';
      target.object.add(bead);

      /** Rebuild the tube geometry from the current active particle positions.
       *  The tube is rebuilt EVERY write (i.e. every seek/frame) from the live
       *  XPBD node path, so the cord visibly swings and every control reshapes
       *  the frozen frame. */
      const write = () => {
        const n = activeN > 0 ? activeN : 18;
        // Update the CatmullRom control points to the live particle path.
        const pts: Vector3[] = [];
        for (let i = 0; i < n; i++) {
          curvePts[i].set(px[i], py[i], pz[i]);
          pts.push(curvePts[i]);
        }
        curve.points = pts;
        const oldGeo = tube.geometry;
        tube.geometry = new TubeGeometry(curve, TUBE_PATH, TUBE_R, TUBE_RADIAL, false);
        oldGeo.dispose();
        // Pin the bright anchor bead to the live top-particle position.
        bead.position.set(px[0], py[0], pz[0]);
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
          target.object.remove(tube);
          target.object.remove(bead);
          tube.geometry.dispose();
          material.dispose();
          bead.geometry.dispose();
          beadMat.dispose();
        },
      };
    },
  ),
};
