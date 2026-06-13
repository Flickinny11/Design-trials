// jelly-collide-sim — a soft JELLY cube is thrown horizontally at a wall,
// SQUASHES FLAT against it on impact (the XPBD lattice compresses against the
// wall plane, bulging tall), then peels off and recovers as it rebounds.
// CATALOG primitive (hard / wave, subject:'empty' — builds its own soft 2D
// lattice cube mesh + a visible wall plane). Genuine XPBD: a grid of particles
// (flat px/py/pz + pvx/pvy/pvz + invMass) linked by structural + shear + BEND
// distance constraints, integrated with "small steps" XPBD (N substeps of dt/N),
// several Gauss-Seidel passes per substep in fixed order. The wall is a vertical
// plane at WALL_X: each substep clamps any particle that has crossed it back to
// the wall surface (a hard one-sided position constraint), which transfers
// momentum back into the next velocity pass — the cube squashes flat against the
// wall, the lattice compresses and bulges, then springs off and recovers.
//
// Cohesion (anti-rupture, advocate round-1): the lattice was tearing into a
// jagged low-poly torn mass on impact because a single solver pass + only
// axis/shear links let cells invert under the violent wall clamp. The fix keeps
// the same XPBD math but holds the blob TOGETHER: (1) BEND constraints (skip-1
// links along each axis) resist sharp folding; (2) several Gauss-Seidel passes
// per substep converge the lattice instead of leaving it crumpled; (3) a
// per-particle speed clamp prevents the impact from exploding into spikes; (4)
// light velocity damping makes the body LINGER flat against the wall (a clear,
// sustained squash) before it peels. The mesh is smooth-shaded
// (computeVertexNormals over a 9×9 grid at T2) so it reads as a rounded jelly
// blob with mass, not crumpling foil.
//
// Containment (advocate round-1): the body used to fly off the bottom-right
// corner and end cut off at the frame edge. A soft left wall + raised floor +
// gravity that only acts while airborne keep it inside the viewport for the
// whole throw → squash → peel → recover loop.
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
// duration() is finite (throw → impact → squash → peel-off → recover); the rig
// loops t back to 0 (a rewind → re-throw). The ~0.45 frozen phase lands the cube
// pressed FLAT against the wall, mid-compression — so bounciness (which sets how
// deep it holds and how hard it peels) visibly moves that frozen frame.

import {
  Mesh,
  PlaneGeometry,
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
const CUBE_SIZE = 0.86; // edge length of the rest jelly cube (scene units)
const WALL_X = 1.04; // the wall plane sits here; cube flies toward +x into it
const START_X = -0.78; // cube centre launch x (left side of the tile)
const REST_Y = 0.0; // cube vertical centre (middle of the tile)
const FLOOR_Y = -0.92; // soft floor — kept well inside the viewport bottom
const LEFT_X = -1.2; // soft left wall — body can never escape off the left

const SCHEMA = [
  { id: 'stiffness', label: 'Stiffness', type: 'fader', min: 0.05, max: 0.95, step: 0.01, default: 0.6 },
  { id: 'throwSpeed', label: 'Throw Speed', type: 'knob', min: 1.5, max: 7.5, step: 0.1, default: 3.0, unit: 'u/s' },
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
      // Several Gauss-Seidel passes per substep so the lattice CONVERGES and
      // stays a cohesive blob instead of crumpling into a torn low-poly mass.
      const ITERS = tierPick(tier, { T0: 4, T1: 5, T2: 6 });
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
      const bend = cell * 2; // skip-1 rest length (anti-fold bend link)

      // Constraint list (i, j, restLength) — structural (axis) + shear (diagonal)
      // + bend (skip-1) so the cube resists shear AND sharp folding, reading as a
      // solid jelly block that squashes coherently rather than tearing.
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
          if (c + 2 < N) addC(i, i + 2, bend); // bend → (resists horizontal fold)
          if (r + 2 < N) addC(i, i + 2 * N, bend); // bend ↑ (resists vertical fold)
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

      // Cap any single particle's speed so a hard wall clamp can never fling a
      // vertex out into a spike (the source of the jagged "torn" look).
      const MAX_SPEED = 9.0;

      const stepOne = (dt: number) => {
        const g = num(params.gravity, 2.6);
        const stiff = clamp(num(params.stiffness, 0.42), 0.05, 0.95);
        const rest = clamp(num(params.bounciness, 0.5), 0.05, 0.9);
        const dtSub = dt / SUBSTEPS;
        const alphaTilde = complianceAlpha(stiff, dtSub);
        // Light per-substep velocity damping → the blob LINGERS flat against the
        // wall (a clear, held squash) and settles in-frame instead of pinging off.
        const velDamp = Math.exp(-0.9 * dtSub);

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

          // 2. Solve all distance constraints over SEVERAL Gauss-Seidel passes in
          // fixed order so the lattice converges to a cohesive shape (no tearing).
          for (let it = 0; it < ITERS; it++) {
            for (let k = 0; k < constraintCount; k++) {
              solveDistanceConstraint(px, py, pz, invMass, ci[k], cj[k], crest[k], alphaTilde);
            }
          }

          // 2b. Wall + floor + soft-left-wall collision: clamp any particle that
          // crossed a boundary back to the surface (hard one-sided position
          // constraints). The momentum transfer happens in the velocity pass
          // below — the position is pinned to the wall this substep, so
          // (p - prevPos) carries the arrested motion, damped by restitution.
          for (let i = 0; i < parts; i++) {
            if (px[i] > WALL_X) px[i] = WALL_X; // right wall (the target)
            if (px[i] < LEFT_X) px[i] = LEFT_X; // soft left wall (keep in frame)
            if (py[i] < FLOOR_Y) py[i] = FLOOR_Y; // soft floor (keep in frame)
          }

          // 3. Update velocities from (pos - prevPos)/dtSub, damp, clamp speed,
          // then apply restitution on the contact-normal component for particles
          // touching a boundary so the cube actively PEELS off rather than
          // sticking — bounciness sets how hard it springs back.
          for (let i = 0; i < parts; i++) {
            let vx = ((px[i] - prevX[i]) / dtSub) * velDamp;
            let vy = ((py[i] - prevY[i]) / dtSub) * velDamp;
            if (px[i] >= WALL_X - 1e-5 && vx > 0) vx = -vx * rest; // bounce off wall
            if (px[i] <= LEFT_X + 1e-5 && vx < 0) vx = -vx * rest;
            if (py[i] <= FLOOR_Y + 1e-5 && vy < 0) vy = -vy * rest;
            // Clamp speed so the impact can never explode a vertex into a spike.
            const sp = Math.hypot(vx, vy);
            if (sp > MAX_SPEED) {
              const k2 = MAX_SPEED / sp;
              vx *= k2;
              vy *= k2;
            }
            pvx[i] = vx;
            pvy[i] = vy;
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
      // ice/steel — no purple). Smooth-shaded via computeVertexNormals.
      const material = new MeshStandardMaterial({
        color: new Color('#9fe0c4'), // ice-mint jelly body
        emissive: new Color('#d9a86c'), // brass inner glow
        emissiveIntensity: 0.4,
        roughness: 0.18,
        metalness: 0.12,
        transparent: true,
        opacity: 0.88,
        envMapIntensity: 1.25,
        side: DoubleSide,
      });

      const mesh = new Mesh(geometry, material);
      mesh.name = 'jelly-collide-sim';
      target.object.add(mesh);

      // ── Visible WALL plane the cube slams into (steel slab, brass rim glow) ──
      // A real surface so the squash reads as "flat against a wall", not a body
      // crumpling in empty space. Slightly behind the cube's z so it never clips.
      const wallGeo = new PlaneGeometry(0.16, 2.4);
      const wallMat = new MeshStandardMaterial({
        color: new Color('#7f8a96'), // cool steel slab
        emissive: new Color('#d9a86c'), // faint brass edge glow
        emissiveIntensity: 0.12,
        roughness: 0.55,
        metalness: 0.45,
        side: DoubleSide,
      });
      const wall = new Mesh(wallGeo, wallMat);
      wall.name = 'jelly-collide-sim-wall';
      wall.position.set(WALL_X + 0.08, 0, -0.12);
      mesh.add(wall); // child of the jelly mesh so it disposes/transforms together

      const write = () => {
        for (let i = 0; i < parts; i++) {
          positions[i * 3] = px[i];
          positions[i * 3 + 1] = py[i];
          positions[i * 3 + 2] = pz[i];
        }
        posAttr.needsUpdate = true;
        geometry.computeVertexNormals(); // smooth shading → rounded jelly, not facets
        geometry.computeBoundingSphere();
      };

      reset();
      write();

      return {
        // Throw → impact (~0.6s at default throwSpeed) → held squash/peel
        // (~0.6s) → recover/settle. Bounded so the loop stays lively; faster
        // throws reach the wall sooner. The 0.45 pin (~1.08s) lands during the
        // sustained wall squash, so bounciness (peel hardness) moves the frame.
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
          wallGeo.dispose();
          wallMat.dispose();
          geometry.dispose();
          material.dispose();
        },
      };
    },
  ),
};
