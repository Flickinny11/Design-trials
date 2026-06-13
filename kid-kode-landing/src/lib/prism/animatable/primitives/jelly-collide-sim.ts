// jelly-collide-sim — a soft JELLY cube is thrown horizontally at a wall,
// SQUASHES against it on impact (the XPBD lattice compresses against the wall
// plane, bulging tall), then peels off and recovers as it rebounds. CATALOG
// primitive (hard / wave, subject:'empty' — builds its own soft 2D lattice cube
// mesh). Genuine XPBD: a grid of particles (flat px/py/pz + pvx/pvy/pvz +
// invMass) linked by structural + shear distance constraints, integrated with
// "small steps" XPBD (N substeps of dt/N), one Gauss-Seidel pass per substep in
// fixed order. The wall is a vertical plane at WALL_X: each substep clamps any
// particle that has crossed it back to the wall surface (a hard one-sided
// position constraint), which transfers momentum back into the next velocity
// pass — the cube squashes flat against the wall, the lattice compresses and
// bulges, then springs off and recovers.
//
// Distinct from soft-body-bounce / drop-squash (a FLOOR drop, vertical gravity
// collision): this is a HORIZONTAL throw into a WALL — visible lateral
// compression and rebound, not a downward squat.
//
// Deterministic: no Math.random / Date.now; the only seed is hash1 jitter on the
// initial lattice (a faint asymmetry so the squash isn't suspiciously perfect).
// The reset-and-replay stepper makes the frame at t a pure function of
// (params, t), so every control — including trajectory-only ones (throwSpeed,
// gravity, bounciness) — visibly changes any frozen frame: onParamChange →
// markDirty re-runs the sim to the same pinned t.
//
// duration() is finite (throw → impact → peel-off → recover); the rig loops t
// back to 0 (a rewind → re-throw). The ~0.45 frozen phase lands MID-SQUASH:
// the cube pressed flat against the wall, mid-compression.

import {
  Mesh,
  BufferGeometry,
  BufferAttribute,
  MeshStandardMaterial,
  Color,
  DoubleSide,
} from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';
import {
  hash1,
  resolveSimTier,
  tierPick,
  makeReplayStepper,
  solveDistanceConstraint,
  complianceAlpha,
} from './_sim-core';

// Fixed build-time MAX allocation (sized to the densest tier so geometry never
// reallocates; coarser tiers run a sub-grid and the rest is unused but allocated).
const MAX_N = 9; // up to 9×9 particles
const MAX_PARTS = MAX_N * MAX_N;
const MAX_CELLS = (MAX_N - 1) * (MAX_N - 1);
const MAX_TRIS = MAX_CELLS * 2;

const DT = 1 / 60; // outer step; substepped below
const CUBE_SIZE = 0.92; // edge length of the rest jelly cube (scene units)
const WALL_X = 1.04; // the wall plane sits here; cube flies toward +x into it
const START_X = -0.78; // cube centre launch x (left side of the tile)
const REST_Y = 0.06; // cube vertical centre (a touch above middle)
const FLOOR_Y = -1.18; // a soft floor so gravity doesn't drop it off-tile

const SCHEMA = [
  { id: 'stiffness', label: 'Stiffness', type: 'fader', min: 0.05, max: 0.95, step: 0.01, default: 0.6 },
  { id: 'throwSpeed', label: 'Throw Speed', type: 'knob', min: 1.5, max: 7.5, step: 0.1, default: 2.6, unit: 'u/s' },
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 0, max: 9, step: 0.25, default: 1.4 },
  { id: 'bounciness', label: 'Bounciness', type: 'fader', min: 0.05, max: 0.9, step: 0.01, default: 0.42 },
] as const;

export const jellyCollideSimPrimitive: PrimitiveDefinition = {
  name: 'jelly-collide-sim',
  label: 'Jelly Collide',
  category: 'wave',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A soft jelly cube is thrown at a wall, squashes flat against it on impact — the lattice compressing and bulging — then peels off and springs back. Real XPBD soft body with wall collision.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'jelly-collide-sim', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const tier = resolveSimTier(target);
      // Heavy soft body → coarser lattice + fewer substeps on T0.
      const N = tierPick(tier, { T0: 5, T1: 7, T2: 9 });
      const SUBSTEPS = tierPick(tier, { T0: 6, T1: 8, T2: 10 });
      const parts = N * N;

      // Flat particle state (allocate to MAX; only [0..parts) are live).
      const px = new Float32Array(MAX_PARTS);
      const py = new Float32Array(MAX_PARTS);
      const pz = new Float32Array(MAX_PARTS);
      const pvx = new Float32Array(MAX_PARTS);
      const pvy = new Float32Array(MAX_PARTS);
      const pvz = new Float32Array(MAX_PARTS);
      const prevX = new Float32Array(MAX_PARTS);
      const prevY = new Float32Array(MAX_PARTS);
      const invMass = new Float32Array(MAX_PARTS); // all 1 (no pins — free body)

      // Rest grid offsets (cube-local, centred on origin) — fixed once.
      const rgx = new Float32Array(MAX_PARTS);
      const rgy = new Float32Array(MAX_PARTS);
      const half = CUBE_SIZE / 2;
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const i = r * N + c;
          rgx[i] = -half + (N > 1 ? (c / (N - 1)) * CUBE_SIZE : 0);
          rgy[i] = -half + (N > 1 ? (r / (N - 1)) * CUBE_SIZE : 0);
        }
      }
      const cell = N > 1 ? CUBE_SIZE / (N - 1) : CUBE_SIZE;
      const diag = cell * Math.SQRT2;

      // Constraint list (i, j, restLength) — structural (axis) + shear (diagonal)
      // so the cube resists shear and reads as a solid jelly block, not a net.
      const ci: number[] = [];
      const cj: number[] = [];
      const crest: number[] = [];
      const addC = (a: number, b: number, rest: number) => {
        ci.push(a);
        cj.push(b);
        crest.push(rest);
      };
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const i = r * N + c;
          if (c + 1 < N) addC(i, i + 1, cell); // structural →
          if (r + 1 < N) addC(i, i + N, cell); // structural ↑
          if (c + 1 < N && r + 1 < N) addC(i, i + N + 1, diag); // shear ↗
          if (c + 1 < N && r - 1 >= 0) addC(i, i - N + 1, diag); // shear ↘
        }
      }
      const constraintCount = ci.length;

      const reset = () => {
        const throwSpeed = num(params.throwSpeed, 4.2);
        for (let i = 0; i < parts; i++) {
          // Faint deterministic jitter so the squash develops an organic
          // asymmetry (never Math.random).
          const jx = (hash1(i * 2.13 + 0.7) - 0.5) * cell * 0.04;
          const jy = (hash1(i * 3.71 + 1.9) - 0.5) * cell * 0.04;
          px[i] = START_X + rgx[i] + jx;
          py[i] = REST_Y + rgy[i] + jy;
          pz[i] = (hash1(i * 5.17 + 0.3) - 0.5) * 0.06; // gentle depth
          pvx[i] = throwSpeed; // launch the whole body to the right
          pvy[i] = 0;
          pvz[i] = 0;
          invMass[i] = 1;
        }
      };

      const stepOne = (dt: number) => {
        const g = num(params.gravity, 2.6);
        const stiff = clamp(num(params.stiffness, 0.42), 0.05, 0.95);
        const rest = clamp(num(params.bounciness, 0.5), 0.05, 0.9);
        const dtSub = dt / SUBSTEPS;
        const alphaTilde = complianceAlpha(stiff, dtSub);

        for (let s = 0; s < SUBSTEPS; s++) {
          // 1. Save prev, integrate velocity (gravity) + predict positions.
          for (let i = 0; i < parts; i++) {
            prevX[i] = px[i];
            prevY[i] = py[i];
            pvy[i] -= g * dtSub;
            px[i] += pvx[i] * dtSub;
            py[i] += pvy[i] * dtSub;
            pz[i] += pvz[i] * dtSub;
          }

          // 2. Solve all distance constraints ONCE in fixed order.
          for (let k = 0; k < constraintCount; k++) {
            solveDistanceConstraint(px, py, pz, invMass, ci[k], cj[k], crest[k], alphaTilde);
          }

          // 2b. Wall + floor collision: clamp any particle that crossed the wall
          // back to the surface (a hard one-sided position constraint). The
          // momentum transfer happens in the velocity pass below — the position
          // is pinned to the wall this substep, so (p - prevPos) carries the
          // arrested motion, and we damp the normal component by restitution.
          for (let i = 0; i < parts; i++) {
            if (px[i] > WALL_X) px[i] = WALL_X; // right wall (the target)
            if (py[i] < FLOOR_Y) py[i] = FLOOR_Y; // soft floor
          }

          // 3. Update velocities from (pos - prevPos)/dtSub, then apply
          // restitution on the wall-normal component for particles in contact so
          // the cube actively peels off rather than sticking.
          for (let i = 0; i < parts; i++) {
            pvx[i] = (px[i] - prevX[i]) / dtSub;
            pvy[i] = (py[i] - prevY[i]) / dtSub;
            if (px[i] >= WALL_X - 1e-5 && pvx[i] > 0) {
              pvx[i] = -pvx[i] * rest; // bounce off the wall
            }
            if (py[i] <= FLOOR_Y + 1e-5 && pvy[i] < 0) {
              pvy[i] = -pvy[i] * rest;
            }
          }
        }
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step: stepOne });

      // ── Mesh: a filled grid of triangles deformed by the particles ──────────
      const positions = new Float32Array(MAX_PARTS * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);

      // Index the live N×N grid into two triangles per cell. (Built once for the
      // tier's N; coarser tiers index fewer cells, the rest of MAX is unused.)
      const indices = new Uint16Array(MAX_TRIS * 3);
      let t = 0;
      for (let r = 0; r < N - 1; r++) {
        for (let c = 0; c < N - 1; c++) {
          const a = r * N + c;
          const b = a + 1;
          const d = a + N;
          const e = d + 1;
          indices[t++] = a; indices[t++] = d; indices[t++] = b;
          indices[t++] = b; indices[t++] = d; indices[t++] = e;
        }
      }
      const idxAttr = new BufferAttribute(indices.subarray(0, t), 1);
      geometry.setIndex(idxAttr);
      geometry.setDrawRange(0, t);

      // Jelly look: a translucent ice-tinted body with a brass emissive core, so
      // the folds catch light when the lattice compresses (Observatory Brass +
      // ice/steel — no purple).
      const material = new MeshStandardMaterial({
        color: new Color('#9fe0c4'), // ice-mint jelly body
        emissive: new Color('#d9a86c'), // brass inner glow
        emissiveIntensity: 0.4,
        roughness: 0.18,
        metalness: 0.12,
        transparent: true,
        opacity: 0.86,
        envMapIntensity: 1.25,
        side: DoubleSide,
      });

      const mesh = new Mesh(geometry, material);
      mesh.name = 'jelly-collide-sim';
      target.object.add(mesh);

      const write = () => {
        for (let i = 0; i < parts; i++) {
          positions[i * 3] = px[i];
          positions[i * 3 + 1] = py[i];
          positions[i * 3 + 2] = pz[i];
        }
        posAttr.needsUpdate = true;
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
      };

      reset();
      write();

      return {
        // Throw → impact (~0.35s) → squash/peel (~0.5s) → recover/fly back.
        // Bounded so the loop stays lively; faster throws reach the wall sooner.
        duration: () => 2.4,
        seek: (t2) => {
          stepper.seekStep(t2);
          write();
        },
        // Any control sweep re-runs the sim to the same pinned frame → the frozen
        // squash visibly changes (standing function of the engaged pose).
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          target.object.remove(mesh);
          geometry.dispose();
          material.dispose();
        },
      };
    },
  ),
};
