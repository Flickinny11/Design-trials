// ragdoll-dangle — a simple articulated RAGDOLL (head, torso, two arms, two legs)
// hung from a pinned anchor that follows the pointer, flopping under real gravity
// with floppy limb momentum. POINTER / hard / subject:'empty' (self-generated
// bone cylinders + joint spheres). The figure is a stick-man of SIX mass-points
// linked into a tree by XPBD distance constraints (anchor→head→torso, torso→each
// limb); the anchor is the only pinned point (invMass=0) and it tracks the
// cursor's horizontal offset plus a deterministic swing, so a steady cursor still
// gives the whole body a momentum-driven swing — the limbs lag, overshoot, and
// flop behind the torso like a marionette held by one hand.
//
// GENUINE SIMULATION, NOT EASING (PHYSICS-AUTHORING-GUIDE XPBD recipe):
//   particles stored as flat px/py/pz + pvx/pvy/pvz + invMass (0 = pinned). Per
//   substep (8 substeps of dt/8):
//     1. save prevPos; integrate velocity (gravity) + predict positions;
//     2. solve ALL distance constraints ONCE in a fixed Gauss-Seidel order, each
//        with alphaTilde = complianceAlpha(stiffness, dtSub) from _sim-core;
//     3. velocity = (pos - prevPos)/dtSub, then a per-second exponential drag.
//   Limb bones use a SOFTER compliance than the spine (the `floppiness` control
//   scales how slack the limbs hang), so the arms and legs swing loosely while
//   the head→torso spine stays firmer — that read is what makes it a RAGDOLL and
//   not a rigid armature.
//
// DETERMINISM (the harness pins frozen frames by reseeking + sweeping controls):
//   the anchor's swing is a pure function of sim time (deterministic sines, no
//   Math.random / Date.now) layered on the LIVE pointer offset. Driven by
//   makeReplayStepper: seek(t) = stepper.seekStep(t); write(). A backward seek or
//   any control change (onParamChange → stepper.markDirty()) replays from a seeded
//   rest pose to the same t, so the frame at t is a pure function of (params, t).
//   gravity / stiffness / damping / floppiness all reshape the FROZEN frame
//   because markDirty re-runs the sim; the anchor X is ALSO read live in write()
//   so even a same-t reseek without markDirty still tracks the cursor.
//
// duration() is finite (a swing-and-settle window); the rig loops t→0, which the
// replay stepper treats as a rewind → the ragdoll re-drops and swings. The
// ~0.45 frozen phase is timed to land MID-FLOP (the limbs trailing the torso at
// the far side of a swing), where every control has bold, visible effect.
//
// DISTINCT from pendant-dangle (a single CARD on one angular-spring pivot) and
// spring-lattice (a flat grid of points): this is a multi-body ARTICULATED chain
// — six linked masses with per-limb compliance — rendered as a posed stick-figure
// of brass/ice bones and joints, not a card and not a point cloud.

import {
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { defineAnimatable } from '../base';
import { clamp, num, type PrimitiveDefinition } from '../contract';
import {
  complianceAlpha,
  makeReplayStepper,
  solveDistanceConstraint,
} from './_sim-core';

const DT = 1 / 90; // outer fixed step
const SUBSTEPS = 8; // XPBD "small steps"
const DT_SUB = DT / SUBSTEPS;
const SOLVER_ITERS = 4; // Gauss-Seidel passes per substep (spine convergence)

// ── Skeleton topology (six mass-points + one pinned anchor = 7 particles) ─────
// Index map: 0 anchor (pinned hand) · 1 head · 2 torso · 3 armL · 4 armR ·
// 5 legL · 6 legR. The anchor is the hang point; the head dangles below it.
const ANCHOR = 0;
const HEAD = 1;
const TORSO = 2;
const ARM_L = 3;
const ARM_R = 4;
const LEG_L = 5;
const LEG_R = 6;
const N = 7;

// Rest layout (figure-local units; the whole rig is small enough for the tile).
// y grows UP; the anchor sits highest and the legs hang lowest.
const REST: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0.95, 0], // anchor (pinned hand, above the head)
  [0, 0.6, 0], // head
  [0, 0.18, 0], // torso (chest/hip midpoint)
  [-0.34, 0.3, 0.04], // arm L (out + slightly forward)
  [0.34, 0.3, -0.04], // arm R
  [-0.16, -0.34, 0.02], // leg L
  [0.16, -0.34, -0.02], // leg R
];

// Bone list as [i, j, isLimb]. isLimb=true → the SOFTER limb compliance (scaled
// by `floppiness`); the spine (anchor→head→torso) stays firmer so the body reads
// as hung-and-swinging rather than a loose bag of points.
const BONES: ReadonlyArray<readonly [number, number, boolean]> = [
  [ANCHOR, HEAD, false], // hang link
  [HEAD, TORSO, false], // neck/spine
  [TORSO, ARM_L, true],
  [TORSO, ARM_R, true],
  [TORSO, LEG_L, true],
  [TORSO, LEG_R, true],
  // A few cross-stays so the figure keeps a body shape instead of collapsing to
  // a line — shoulders span, hips span (limb-soft so they still flop).
  [ARM_L, ARM_R, true],
  [LEG_L, LEG_R, true],
];

// Joint visual radii (figure-local). Head reads larger; limbs are small joints.
const JOINT_R: Record<number, number> = {
  [ANCHOR]: 0.05,
  [HEAD]: 0.13,
  [TORSO]: 0.085,
  [ARM_L]: 0.055,
  [ARM_R]: 0.055,
  [LEG_L]: 0.06,
  [LEG_R]: 0.06,
};

const BONE_R = 0.028; // bone-cylinder radius (figure-local)

// Palette — Observatory Brass bones, ice/steel joints (NO purple).
const BONE_COLOR = '#cda86c'; // brass
const BONE_EMISSIVE = '#7a5a2e';
const JOINT_COLOR = '#cfdde6'; // steel-ice
const JOINT_EMISSIVE = '#2b4150';
const HEAD_COLOR = '#9fe0c4'; // soft mint for the head so it reads as "the head"

// Anchor swing — deterministic so a steady cursor still flops the body. The hand
// sweeps side-to-side; the limbs lag behind under their own momentum.
const SWING_AMP = 0.42; // horizontal sweep half-width (figure-local)
const SWING_W = 2.05; // primary angular freq (rad/s)
const SWING_W2 = 3.31; // a faster incommensurate component for liveliness
const BOB_AMP = 0.06; // small vertical bob of the hand

const SCHEMA = [
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 2, max: 22, step: 0.5, default: 11 },
  { id: 'stiffness', label: 'Spine Stiffness', type: 'fader', min: 0.05, max: 1, step: 0.01, default: 0.7 },
  { id: 'damping', label: 'Damping', type: 'fader', min: 0, max: 6, step: 0.05, default: 1.4 },
  { id: 'floppiness', label: 'Floppiness', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.65 },
] as const;

export const ragdollDanglePrimitive: PrimitiveDefinition = {
  name: 'ragdoll-dangle',
  label: 'Ragdoll Dangle',
  category: 'pointer',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'pointer',
  description:
    'A stick-figure ragdoll hangs from a pinned hand that follows the cursor and flops under real gravity — the arms and legs lag, swing, and overshoot with floppy momentum.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'ragdoll-dangle', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      // ── Particle state (flat arrays; XPBD recipe) ──────────────────────────
      const px = new Float32Array(N);
      const py = new Float32Array(N);
      const pz = new Float32Array(N);
      const pvx = new Float32Array(N);
      const pvy = new Float32Array(N);
      const pvz = new Float32Array(N);
      const prevX = new Float32Array(N);
      const prevY = new Float32Array(N);
      const prevZ = new Float32Array(N);
      const invMass = new Float32Array(N);
      // Per-bone rest length, precomputed from REST (constant topology).
      const restLen = new Float32Array(BONES.length);
      for (let b = 0; b < BONES.length; b++) {
        const [i, j] = BONES[b];
        const dx = REST[i][0] - REST[j][0];
        const dy = REST[i][1] - REST[j][1];
        const dz = REST[i][2] - REST[j][2];
        restLen[b] = Math.sqrt(dx * dx + dy * dy + dz * dz);
      }

      /** Live pointer offset from rig center, in figure-local x (guarded). The
       *  anchor tracks the cursor; absent/centered pointer → 0 (pure swing). */
      const pointerOffX = (): number => {
        const p = target.userData.pointer as { x?: number } | undefined;
        const x = p && Number.isFinite(p.x as number) ? (p.x as number) : 0.5;
        return clamp((x - 0.5) * 2, -1, 1) * 0.55; // -0.55..0.55 figure-local
      };

      /** Deterministic anchor position at sim time t (+ live pointer). Pure given
       *  (t, pointer) — the swing makes the body flop even with a steady cursor. */
      const anchorAt = (t: number): { x: number; y: number; z: number } => {
        const swing = SWING_AMP * (0.78 * Math.sin(SWING_W * t) + 0.22 * Math.sin(SWING_W2 * t + 0.7));
        const bob = BOB_AMP * Math.sin(SWING_W * 2 * t + 0.3);
        return {
          x: REST[ANCHOR][0] + swing + pointerOffX(),
          y: REST[ANCHOR][1] + bob,
          z: REST[ANCHOR][2],
        };
      };

      const reset = () => {
        for (let i = 0; i < N; i++) {
          px[i] = REST[i][0];
          py[i] = REST[i][1];
          pz[i] = REST[i][2];
          pvx[i] = 0;
          pvy[i] = 0;
          pvz[i] = 0;
          invMass[i] = 1; // dynamic
        }
        invMass[ANCHOR] = 0; // pinned hang point
        // Seed the anchor at its t=0 location.
        const a = anchorAt(0);
        px[ANCHOR] = a.x;
        py[ANCHOR] = a.y;
        pz[ANCHOR] = a.z;
      };

      // simT advances exactly one DT per step() (so anchorAt reads the right t).
      let simT = 0;

      const step = (dt: number) => {
        const gravity = num(params.gravity, 11);
        const stiff = clamp(num(params.stiffness, 0.7), 0.05, 1);
        const flop = clamp(num(params.floppiness, 0.65), 0, 1);
        const damp = clamp(num(params.damping, 1.4), 0, 6);

        // The SPINE (anchor→head→torso) is kept rigid INDEPENDENT of the knobs so
        // the body always hangs from the hand within the tile frame — a real
        // skeleton's bones don't stretch. The `stiffness` knob (with floppiness)
        // governs the LIMBS: high stiffness + low floppiness → limbs hold their
        // pose firmly; low stiffness / high floppiness → limbs hang slack and lag
        // the swinging torso. Both map to a SOFTER-than-spine compliance, so even
        // the loosest limbs stay attached and on-frame (no taffy stretch).
        const alphaSpine = complianceAlpha(0.995, DT_SUB); // ~rigid
        const limbStiff = clamp(stiff * (1 - 0.85 * flop), 0.06, 1) * 0.6 + 0.3;
        const alphaLimb = complianceAlpha(limbStiff, DT_SUB);

        const tStart = simT;
        for (let s = 0; s < SUBSTEPS; s++) {
          const subT = tStart + (s / SUBSTEPS) * dt;
          // Anchor is kinematically driven (pinned): place it on its path.
          const a = anchorAt(subT + DT_SUB);
          px[ANCHOR] = a.x;
          py[ANCHOR] = a.y;
          pz[ANCHOR] = a.z;

          // 1. save prev + integrate velocity (gravity) + predict positions.
          for (let i = 0; i < N; i++) {
            prevX[i] = px[i];
            prevY[i] = py[i];
            prevZ[i] = pz[i];
            if (invMass[i] === 0) continue;
            pvy[i] -= gravity * DT_SUB;
            px[i] += pvx[i] * DT_SUB;
            py[i] += pvy[i] * DT_SUB;
            pz[i] += pvz[i] * DT_SUB;
          }

          // 2. solve all distance constraints, fixed order, SOLVER_ITERS passes
          // for convergence (the spine in particular must not creep under heavy
          // gravity — a single Gauss-Seidel pass under-converges a 22-g pull).
          for (let it = 0; it < SOLVER_ITERS; it++) {
            for (let b = 0; b < BONES.length; b++) {
              const [i, j, isLimb] = BONES[b];
              solveDistanceConstraint(
                px, py, pz, invMass, i, j, restLen[b],
                isLimb ? alphaLimb : alphaSpine,
              );
            }
          }

          // 3. velocity from positions, then exponential drag.
          const dragF = Math.exp(-damp * DT_SUB);
          for (let i = 0; i < N; i++) {
            if (invMass[i] === 0) {
              pvx[i] = 0; pvy[i] = 0; pvz[i] = 0;
              continue;
            }
            pvx[i] = ((px[i] - prevX[i]) / DT_SUB) * dragF;
            pvy[i] = ((py[i] - prevY[i]) / DT_SUB) * dragF;
            pvz[i] = ((pz[i] - prevZ[i]) / DT_SUB) * dragF;
          }
        }
        simT += dt;
      };

      const stepper = makeReplayStepper({
        dt: DT,
        reset: () => {
          simT = 0;
          reset();
        },
        step,
      });

      // ── Visual rig: brass bone cylinders + ice/mint joint spheres ──────────
      const group = new Group();
      group.name = 'ragdoll-dangle';

      const jointMat = new MeshStandardMaterial({
        color: new Color(JOINT_COLOR),
        emissive: new Color(JOINT_EMISSIVE),
        emissiveIntensity: 0.4,
        roughness: 0.3,
        metalness: 0.6,
        envMapIntensity: 1.1,
      });
      const headMat = new MeshStandardMaterial({
        color: new Color(HEAD_COLOR),
        emissive: new Color('#2c5a48'),
        emissiveIntensity: 0.45,
        roughness: 0.32,
        metalness: 0.4,
        envMapIntensity: 1.15,
      });
      const boneMat = new MeshStandardMaterial({
        color: new Color(BONE_COLOR),
        emissive: new Color(BONE_EMISSIVE),
        emissiveIntensity: 0.3,
        roughness: 0.34,
        metalness: 0.68,
        envMapIntensity: 1.2,
      });

      // Joint spheres (unit sphere geo, scaled per joint).
      const jointGeo = new SphereGeometry(1, 18, 14);
      const joints: Mesh[] = [];
      for (let i = 0; i < N; i++) {
        const mat = i === HEAD ? headMat : jointMat;
        const m = new Mesh(jointGeo, mat);
        m.name = `ragdoll-joint-${i}`;
        m.scale.setScalar(JOINT_R[i] ?? 0.06);
        joints.push(m);
        group.add(m);
      }

      // Bone cylinders — a unit cylinder (height 1, +y) posed per seek by
      // computing a position+orientation+length between its two particles. We
      // build a shared unit-Y cylinder and orient it with a quaternion each write.
      const boneGeo = new CylinderGeometry(BONE_R, BONE_R, 1, 10, 1, true);
      const bones: Mesh[] = [];
      for (let b = 0; b < BONES.length; b++) {
        const m = new Mesh(boneGeo, boneMat);
        m.name = `ragdoll-bone-${b}`;
        bones.push(m);
        group.add(m);
      }

      target.object.add(group);

      // Scratch vectors (no per-seek allocation).
      const up = new Vector3(0, 1, 0);
      const a = new Vector3();
      const bv = new Vector3();
      const dir = new Vector3();
      const mid = new Vector3();

      const write = () => {
        // Joints follow particle positions.
        for (let i = 0; i < N; i++) {
          joints[i].position.set(px[i], py[i], pz[i]);
        }
        // Bones span their two particles: pose center + orient unit-Y → dir +
        // scale.y to the live length.
        for (let b = 0; b < BONES.length; b++) {
          const [i, j] = BONES[b];
          a.set(px[i], py[i], pz[i]);
          bv.set(px[j], py[j], pz[j]);
          dir.subVectors(bv, a);
          const len = dir.length();
          mid.addVectors(a, bv).multiplyScalar(0.5);
          const m = bones[b];
          m.position.copy(mid);
          if (len > 1e-5) {
            dir.multiplyScalar(1 / len);
            m.quaternion.setFromUnitVectors(up, dir);
            m.scale.set(1, len, 1);
          } else {
            m.scale.set(1, 1e-4, 1);
          }
        }
      };

      stepper.reset();
      write();

      return {
        // Finite swing-and-settle window; the rig loops it (replay = rewind).
        // ~0.45 of this lands mid-flop on the far side of the first big swing.
        duration: () => 3.4,
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Every control sweep replays the sim to the same pinned t → the frozen
        // frame visibly reshapes (gravity/stiffness/damping/floppiness all live).
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          target.object.remove(group);
          jointGeo.dispose();
          boneGeo.dispose();
          jointMat.dispose();
          headMat.dispose();
          boneMat.dispose();
        },
      };
    },
  ),
};
