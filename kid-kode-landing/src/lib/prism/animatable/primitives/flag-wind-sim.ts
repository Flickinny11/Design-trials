// flag-wind-sim — a REAL XPBD cloth flag. A coarse particle grid is pinned along
// its LEFT edge (the pole; invMass=0) and pushed by a WIND FORCE FIELD every
// substep: a steady out-of-plane breeze, a sinusoidal gust that swells and
// fades, and a little deterministic hashed turbulence that varies cell-to-cell.
// The cloth is held together by XPBD distance constraints (structural links to
// the right/down neighbour plus shear diagonals), so the wind doesn't just
// translate vertices — it builds genuine FLAPPING RIPPLES that propagate from
// the pole down the free trailing edge, the way real fabric snaps in a breeze.
//
// DISTINCT from flag-wave (a single kinematic travelling sine weighted by x):
// here nothing is scripted. The fold pattern emerges from force ⊕ constraint
// solve, so neighbouring vertices fight each other, the trailing edge cracks
// and recovers, and gusts pulse through with real momentum and lag.
//
// Determinism: particles are flat px/py/pz + velocities + invMass; the only
// "randomness" is hash-seeded spatial turbulence (no Math.random / Date.now).
// makeReplayStepper resets-and-replays on a backward seek, so the frame at time
// t is a pure function of (params, t) — every control (wind, gust, stiffness,
// gravity) recomputes the frozen pinned frame the verification harness scrubs.
//
// The XPBD sim runs on a COARSE particle grid (tier-sized); its solved positions
// are bilinearly resampled onto the dense host PlaneGeometry (64×64) each write,
// so the rendered cloth stays smooth while the sim stays cheap. duration() is
// Infinity (a continuously wind-driven, looping flag); the ~0.45 frozen phase
// lands mid-flap.

import { Mesh, BufferGeometry, type BufferAttribute } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';
import {
  hash1,
  shash,
  makeReplayStepper,
  solveDistanceConstraint,
  complianceAlpha,
  resolveSimTier,
  tierPick,
} from './_sim-core';

const DT = 1 / 60; // outer step; each is split into SUBSTEPS XPBD substeps
const HALF = 0.9; // host PlaneGeometry(1.8,1.8) → x,y ∈ [-0.9, 0.9]
const SPAN = HALF * 2; // full flag width/height in scene units
const MAX_COLS = 24; // build-time max particle grid (along the pole→free axis)
const MAX_ROWS = 18; // build-time max rows (top→bottom)
const MAX_PARTICLES = MAX_COLS * MAX_ROWS;

const SCHEMA = [
  { id: 'wind', label: 'Wind', type: 'knob', min: 0, max: 12, step: 0.1, default: 5.5 },
  { id: 'gust', label: 'Gust', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.6 },
  { id: 'stiffness', label: 'Stiffness', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.55 },
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 0, max: 12, step: 0.1, default: 3.2 },
] as const;

export const flagWindSimPrimitive: PrimitiveDefinition = {
  name: 'flag-wind-sim',
  label: 'Flag (Wind Sim)',
  category: 'wave',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A real XPBD cloth flag pinned at the pole: a steady wind, swelling gusts, and turbulence push genuine flapping ripples down the fabric — emergent physics, not a scripted sine.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'flag-wind-sim', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? (target.object as unknown as Mesh);
      const geom = mesh.geometry as BufferGeometry;
      const posAttr = geom.getAttribute('position') as BufferAttribute;
      // Cache the dense render mesh's base positions once (we resample the sim
      // onto these, keeping x/y and writing a solved z + small in-plane drift).
      const base = new Float32Array(posAttr.array as ArrayLike<number>);
      const vcount = posAttr.count;
      // Render-mesh extents → normalized (u = pole→free, v = top→bottom).
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < vcount; i++) {
        const bx = base[i * 3], by = base[i * 3 + 1];
        if (bx < minX) minX = bx;
        if (bx > maxX) maxX = bx;
        if (by < minY) minY = by;
        if (by > maxY) maxY = by;
      }
      const spanX = maxX - minX || 1;
      const spanY = maxY - minY || 1;

      // Tier-sized coarse particle grid (heavy cloth → coarser on T0).
      const tier = resolveSimTier(target);
      const cols = tierPick(tier, { T0: 12, T1: 18, T2: MAX_COLS });
      const rows = tierPick(tier, { T0: 9, T1: 14, T2: MAX_ROWS });
      const SUBSTEPS = tierPick(tier, { T0: 6, T1: 8, T2: 8 });

      // Flat particle state (XPBD). Allocated to MAX once; never realloced.
      const px = new Float32Array(MAX_PARTICLES);
      const py = new Float32Array(MAX_PARTICLES);
      const pz = new Float32Array(MAX_PARTICLES);
      const pvx = new Float32Array(MAX_PARTICLES);
      const pvy = new Float32Array(MAX_PARTICLES);
      const pvz = new Float32Array(MAX_PARTICLES);
      const prevX = new Float32Array(MAX_PARTICLES);
      const prevY = new Float32Array(MAX_PARTICLES);
      const prevZ = new Float32Array(MAX_PARTICLES);
      const invMass = new Float32Array(MAX_PARTICLES);
      // Rest grid positions (the flat at-rest flag in the XY plane).
      const restX = new Float32Array(MAX_PARTICLES);
      const restY = new Float32Array(MAX_PARTICLES);

      const idx = (c: number, r: number) => r * cols + c;
      // Rest spacings of the particle grid (constraint rest lengths).
      const dxRest = cols > 1 ? SPAN / (cols - 1) : SPAN;
      const dyRest = rows > 1 ? SPAN / (rows - 1) : SPAN;
      const diagRest = Math.sqrt(dxRest * dxRest + dyRest * dyRest);

      const reset = () => {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const i = idx(c, r);
            const x = -HALF + (cols > 1 ? (c / (cols - 1)) * SPAN : 0);
            const y = HALF - (rows > 1 ? (r / (rows - 1)) * SPAN : 0);
            restX[i] = x;
            restY[i] = y;
            px[i] = x;
            py[i] = y;
            pz[i] = 0;
            pvx[i] = 0;
            pvy[i] = 0;
            pvz[i] = 0;
            // Pin the LEFT edge (the pole): column 0 is static.
            invMass[i] = c === 0 ? 0 : 1;
          }
        }
      };

      // One full outer step: SUBSTEPS XPBD substeps under the wind force field.
      const step = (dt: number) => {
        const windK = num(params.wind, 5.5);
        const gustK = clamp(num(params.gust, 0.6), 0, 1);
        const stiff = clamp(num(params.stiffness, 0.55), 0, 1);
        const grav = num(params.gravity, 3.2);
        const tNow = stepper.now(); // absolute sim time for the gust phase
        const dtSub = dt / SUBSTEPS;
        const alphaStruct = complianceAlpha(stiff, dtSub);
        // Shear diagonals are a touch softer than structural links → drapier.
        const alphaShear = complianceAlpha(stiff * 0.7, dtSub);

        for (let s = 0; s < SUBSTEPS; s++) {
          const subT = tNow + (s + 1) * dtSub;
          // Gust envelope: a swelling/fading breeze (always ≥0 so wind never
          // reverses to a suck). Two detuned sines so the pulse never repeats
          // tightly. gustK scales how violent the swell is.
          const gustEnv = 1 + gustK * (0.5 + 0.5 * Math.sin(subT * 1.7)) * (0.6 + 0.4 * Math.sin(subT * 0.63 + 1.3));
          // Steady wind blows mostly out-of-plane (+z, toward camera) with a
          // gentle downwind +x lean so the free edge streams off the pole.
          const windZ = windK * gustEnv * 0.16;
          const windX = windK * gustEnv * 0.05;

          // 1) integrate velocity (gravity + wind force) + predict positions.
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const i = idx(c, r);
              if (invMass[i] === 0) {
                prevX[i] = px[i]; prevY[i] = py[i]; prevZ[i] = pz[i];
                continue;
              }
              prevX[i] = px[i];
              prevY[i] = py[i];
              prevZ[i] = pz[i];
              // Deterministic spatial turbulence: a hashed gust cell per (c,r)
              // modulated by a per-cell sine in time. Stronger toward the free
              // trailing edge (downwind) so the tail cracks, the pole stays calm.
              const downwind = cols > 1 ? c / (cols - 1) : 0; // 0 pole → 1 free
              const turbPhase = subT * (1.3 + hash1(c * 2.3 + r * 7.1) * 1.6);
              const turbZ = shash(c * 5.7 + r * 3.1) * Math.sin(turbPhase) * windK * 0.06 * gustK;
              const turbX = shash(c * 11.3 + r * 1.9) * Math.sin(turbPhase * 0.8 + 0.7) * windK * 0.03 * gustK;
              const fz = (windZ + turbZ) * (0.25 + 0.75 * downwind);
              const fx = (windX + turbX) * (0.25 + 0.75 * downwind);
              // Gravity pulls the free cloth down; the wind lifts it.
              pvx[i] += fx * dtSub;
              pvy[i] += -grav * dtSub * (0.2 + 0.8 * downwind);
              pvz[i] += fz * dtSub;
              // Light air drag so energy doesn't accumulate unbounded.
              const drag = 1 - 0.6 * dtSub;
              pvx[i] *= drag; pvy[i] *= drag; pvz[i] *= drag;
              // Predict.
              px[i] += pvx[i] * dtSub;
              py[i] += pvy[i] * dtSub;
              pz[i] += pvz[i] * dtSub;
            }
          }

          // 2) solve all distance constraints ONCE in fixed order (Gauss-Seidel).
          //    Structural: right + down links. Shear: the two diagonals.
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const i = idx(c, r);
              if (c + 1 < cols) solveDistanceConstraint(px, py, pz, invMass, i, idx(c + 1, r), dxRest, alphaStruct);
              if (r + 1 < rows) solveDistanceConstraint(px, py, pz, invMass, i, idx(c, r + 1), dyRest, alphaStruct);
              if (c + 1 < cols && r + 1 < rows) solveDistanceConstraint(px, py, pz, invMass, i, idx(c + 1, r + 1), diagRest, alphaShear);
              if (c + 1 < cols && r - 1 >= 0) solveDistanceConstraint(px, py, pz, invMass, i, idx(c + 1, r - 1), diagRest, alphaShear);
            }
          }

          // 3) velocity = (pos - prevPos)/dtSub.
          for (let i = 0; i < cols * rows; i++) {
            if (invMass[i] === 0) continue;
            pvx[i] = (px[i] - prevX[i]) / dtSub;
            pvy[i] = (py[i] - prevY[i]) / dtSub;
            pvz[i] = (pz[i] - prevZ[i]) / dtSub;
          }
        }
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      // Bilinearly sample the solved particle grid (in normalized u/v space) and
      // write the displacement onto the dense host vertices. We offset from the
      // PARTICLE REST position so the dense mesh inherits the cloth's z folds and
      // in-plane stream without snapping its own grid spacing.
      const sampleDisp = (u: number, v: number, out: [number, number, number]) => {
        const fc = clamp(u * (cols - 1), 0, cols - 1);
        const fr = clamp(v * (rows - 1), 0, rows - 1);
        const c0 = Math.floor(fc), r0 = Math.floor(fr);
        const c1 = Math.min(cols - 1, c0 + 1), r1 = Math.min(rows - 1, r0 + 1);
        const tc = fc - c0, tr = fr - r0;
        let dx = 0, dy = 0, dz = 0;
        const corners: Array<[number, number, number]> = [
          [c0, r0, (1 - tc) * (1 - tr)],
          [c1, r0, tc * (1 - tr)],
          [c0, r1, (1 - tc) * tr],
          [c1, r1, tc * tr],
        ];
        for (const [cc, rr, w] of corners) {
          const i = idx(cc, rr);
          dx += (px[i] - restX[i]) * w;
          dy += (py[i] - restY[i]) * w;
          dz += pz[i] * w;
        }
        out[0] = dx; out[1] = dy; out[2] = dz;
      };

      const write = () => {
        const tmp: [number, number, number] = [0, 0, 0];
        for (let i = 0; i < vcount; i++) {
          const bx = base[i * 3];
          const by = base[i * 3 + 1];
          const bz = base[i * 3 + 2];
          const u = clamp((bx - minX) / spanX, 0, 1); // 0 pole → 1 free
          const v = clamp((maxY - by) / spanY, 0, 1); // 0 top → 1 bottom
          sampleDisp(u, v, tmp);
          posAttr.setXYZ(i, bx + tmp[0], by + tmp[1], bz + tmp[2]);
        }
        posAttr.needsUpdate = true;
        geom.computeVertexNormals();
      };

      reset();
      write();

      return {
        // Continuously wind-driven, looping flag — purely stateful.
        duration: () => Infinity,
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Wind / gust / stiffness / gravity all reshape the trajectory; re-run
        // the sim to the same pinned frame so the frozen frame visibly changes.
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          for (let i = 0; i < vcount; i++) {
            posAttr.setXYZ(i, base[i * 3], base[i * 3 + 1], base[i * 3 + 2]);
          }
          posAttr.needsUpdate = true;
          geom.computeVertexNormals();
        },
      };
    },
  ),
};
