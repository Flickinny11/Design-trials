// cloth-drape-sim — REAL XPBD cloth. The 'plane' subject geometry is driven by a
// coarse grid of mass particles: the TOP corners (or the whole top edge) are
// PINNED (invMass=0) and every other particle drapes under gravity, held in a
// fabric by structural (axis-neighbour) + shear (diagonal) distance constraints.
// The result is genuine catenary folds that sag, billow, and settle with a
// gentle sway — NOT a closed-form sine (cf. cloth-sway / drape-fold, which are
// kinematic). The solved particle positions are written back into the full
// PlaneGeometry vertex buffer by bilinear sampling and the normals recomputed,
// so the lighting tracks the folds. CATALOG primitive (hard / wave, subject:'plane').
//
// XPBD ("small steps", Macklin 2019): per fixed step we run N substeps of dt/N;
// each substep predicts positions from velocity+gravity, then solves all
// distance constraints ONCE in a fixed Gauss-Seidel order with
// alphaTilde = complianceAlpha(stiffness, dtSub), then sets velocity from
// (p - pPrev)/dtSub. A small deterministic out-of-plane bias (hash-seeded, never
// Math.random) breaks the flat symmetry so the sheet folds in 3D. Because the
// replay stepper resets-and-replays on a backward seek, the frame at time t is a
// pure function of (params, t) — so gravity / stiffness / pinMode / damping all
// visibly change any frozen frame the verification harness pins (markDirty).
//
// duration() is finite (the settle time); the catalog rig loops t→0, which the
// stepper treats as a rewind → the cloth re-drops. The ~0.45 frozen phase lands
// MID-DRAPE, while the fabric is still falling into its folds with the most sway.

import { PlaneGeometry, type Mesh } from 'three';
import { defineAnimatable } from '../base';
import { num, str, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';
import {
  makeReplayStepper,
  solveDistanceConstraint,
  complianceAlpha,
  resolveSimTier,
  tierPick,
  shash,
} from './_sim-core';

const DT = 1 / 90; // outer fixed step
const SUBSTEPS = 8; // XPBD small-steps per outer step
const SPAN = 1.8; // matches the plane subject (PlaneGeometry(1.8,1.8))
const HALF = SPAN / 2;
// Full subject geometry resolution (PlaneGeometry(1.8,1.8,64,64) → 65×65 verts).
const MESH_SEG = 64;
const MESH_N = MESH_SEG + 1;

const SCHEMA = [
  { id: 'stiffness', label: 'Stiffness', type: 'fader', min: 0.05, max: 1, step: 0.01, default: 0.55 },
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 2, max: 16, step: 0.5, default: 8.5 },
  {
    id: 'pinMode',
    label: 'Pinning',
    type: 'dropdown',
    options: [
      { value: 'corners', label: 'Top Corners' },
      { value: 'top-edge', label: 'Top Edge' },
    ],
    default: 'corners',
  },
  { id: 'damping', label: 'Damping', type: 'fader', min: 0, max: 0.6, step: 0.01, default: 0.06 },
] as const;

export const clothDrapeSimPrimitive: PrimitiveDefinition = {
  name: 'cloth-drape-sim',
  label: 'Cloth Drape (XPBD)',
  category: 'wave',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Real XPBD cloth: the plane is a grid of mass particles pinned at the top that drape under gravity into catenary folds with structural and shear constraints, settling with a gentle sway — physics, not a sine.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'cloth-drape-sim', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const subject = (target.subject ?? target.object) as Mesh;

      // Tier sizes the coarse simulation grid; heavy cloth → coarser on T0.
      const tier = resolveSimTier(target);
      const GN = tierPick(tier, { T0: 9, T1: 13, T2: 17 }); // GN×GN particles
      const COUNT = GN * GN;

      // ── Coarse particle state (flat arrays; XPBD recipe) ──────────────────
      const px = new Float32Array(COUNT);
      const py = new Float32Array(COUNT);
      const pz = new Float32Array(COUNT);
      const pvx = new Float32Array(COUNT);
      const pvy = new Float32Array(COUNT);
      const pvz = new Float32Array(COUNT);
      const prevX = new Float32Array(COUNT);
      const prevY = new Float32Array(COUNT);
      const prevZ = new Float32Array(COUNT);
      const invMass = new Float32Array(COUNT);

      // Rest grid (the flat hung sheet) — column c, row r. r=0 is the TOP edge.
      const restX = (c: number) => -HALF + (GN > 1 ? (c / (GN - 1)) * SPAN : 0);
      const restY = (r: number) => HALF - (GN > 1 ? (r / (GN - 1)) * SPAN : 0);
      const idx = (r: number, c: number) => r * GN + c;
      const cellLen = GN > 1 ? SPAN / (GN - 1) : SPAN;
      const diagLen = cellLen * Math.SQRT2;

      // Constraint list built ONCE (fixed Gauss-Seidel order → deterministic).
      // [i, j, restLength]. Structural (right/down) + shear (both diagonals).
      const cons: Array<[number, number, number]> = [];
      for (let r = 0; r < GN; r++) {
        for (let c = 0; c < GN; c++) {
          const i = idx(r, c);
          if (c + 1 < GN) cons.push([i, idx(r, c + 1), cellLen]); // structural →
          if (r + 1 < GN) cons.push([i, idx(r + 1, c), cellLen]); // structural ↓
          if (r + 1 < GN && c + 1 < GN) cons.push([i, idx(r + 1, c + 1), diagLen]); // shear ↘
          if (r + 1 < GN && c - 1 >= 0) cons.push([i, idx(r + 1, c - 1), diagLen]); // shear ↙
        }
      }

      // Cache the original subject geometry so dispose() restores it exactly.
      const originalGeometry = subject.geometry;
      // Our own deformable plane (same footprint/resolution as the subject's).
      const clothGeo = new PlaneGeometry(SPAN, SPAN, MESH_SEG, MESH_SEG);
      const posAttr = clothGeo.attributes.position;

      const reset = () => {
        const pinTopEdge = str(params.pinMode, 'corners') === 'top-edge';
        // Corner-pin GATHER: a curtain hung from two points draws its top edge
        // inward, so the fabric is wider than its pinned span — that horizontal
        // compression is exactly what buckles a real drape into vertical folds.
        // We pull the two pinned corners inward by GATHER of the half-span and
        // give the free top-row material a small inward+forward lean so the
        // fold direction is seeded deterministically (never Math.random).
        const GATHER = 0.34;
        for (let r = 0; r < GN; r++) {
          for (let c = 0; c < GN; c++) {
            const i = idx(r, c);
            const isTop = r === 0;
            const isCorner = isTop && (c === 0 || c === GN - 1);
            const pinned = pinTopEdge ? isTop : isCorner;

            let x = restX(c);
            if (!pinTopEdge && isCorner) x *= 1 - GATHER; // draw pinned corners in
            px[i] = x;
            py[i] = restY(r);
            // Deterministic out-of-plane seed. A standing sinusoidal ripple
            // across the columns (so adjacent columns lean opposite ways) plus a
            // tiny hash jitter gives the sheet a clear fold direction to buckle
            // into under the gather compression — reproducible across reseeks.
            // Corner pinning (a gathered curtain) buckles into DEEPER folds than
            // a flat-held top edge, so the seed is stronger for 'corners' — the
            // silhouettes genuinely differ between the two pinnings.
            const colPhase = GN > 1 ? c / (GN - 1) : 0;
            const foldAmp = pinTopEdge ? 0.03 : 0.07;
            pz[i] = Math.sin(colPhase * Math.PI * 3) * foldAmp + shash(i * 2.3 + 11.0) * 0.01;
            pvx[i] = 0;
            pvy[i] = 0;
            pvz[i] = 0;
            invMass[i] = pinned ? 0 : 1;
          }
        }
      };

      const step = (dt: number) => {
        const g = num(params.gravity, 8.5);
        const stiff = clamp(num(params.stiffness, 0.55), 0.05, 1);
        const damp = clamp(num(params.damping, 0.06), 0, 0.6);
        const dtSub = dt / SUBSTEPS;
        const alphaTilde = complianceAlpha(stiff, dtSub);
        const velKeep = 1 - damp; // per-substep velocity retention

        for (let s = 0; s < SUBSTEPS; s++) {
          // 1) integrate velocity (gravity) + predict positions.
          for (let i = 0; i < COUNT; i++) {
            prevX[i] = px[i];
            prevY[i] = py[i];
            prevZ[i] = pz[i];
            if (invMass[i] === 0) continue; // pinned anchor
            pvy[i] -= g * dtSub;
            px[i] += pvx[i] * dtSub;
            py[i] += pvy[i] * dtSub;
            pz[i] += pvz[i] * dtSub;
          }
          // 2) solve every distance constraint ONCE in fixed order.
          for (let k = 0; k < cons.length; k++) {
            const con = cons[k];
            solveDistanceConstraint(px, py, pz, invMass, con[0], con[1], con[2], alphaTilde);
          }
          // 3) derive velocity from the position change; apply damping.
          for (let i = 0; i < COUNT; i++) {
            if (invMass[i] === 0) {
              pvx[i] = 0;
              pvy[i] = 0;
              pvz[i] = 0;
              continue;
            }
            pvx[i] = ((px[i] - prevX[i]) / dtSub) * velKeep;
            pvy[i] = ((py[i] - prevY[i]) / dtSub) * velKeep;
            pvz[i] = ((pz[i] - prevZ[i]) / dtSub) * velKeep;
          }
        }
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      // Bilinear sample of the coarse particle field at grid coords (u,v) in
      // [0..GN-1]. Writes the interpolated (x,y,z) into out[0..2].
      const sample = (u: number, v: number, out: Float32Array) => {
        const c0 = Math.min(GN - 1, Math.floor(u));
        const r0 = Math.min(GN - 1, Math.floor(v));
        const c1 = Math.min(GN - 1, c0 + 1);
        const r1 = Math.min(GN - 1, r0 + 1);
        const fc = u - c0;
        const fr = v - r0;
        const i00 = idx(r0, c0);
        const i01 = idx(r0, c1);
        const i10 = idx(r1, c0);
        const i11 = idx(r1, c1);
        const w00 = (1 - fc) * (1 - fr);
        const w01 = fc * (1 - fr);
        const w10 = (1 - fc) * fr;
        const w11 = fc * fr;
        out[0] = px[i00] * w00 + px[i01] * w01 + px[i10] * w10 + px[i11] * w11;
        out[1] = py[i00] * w00 + py[i01] * w01 + py[i10] * w10 + py[i11] * w11;
        out[2] = pz[i00] * w00 + pz[i01] * w01 + pz[i10] * w10 + pz[i11] * w11;
      };

      const tmp = new Float32Array(3);
      const write = () => {
        // Map each full-mesh vertex (column mc, row mr) into coarse-grid coords
        // and bilinear-sample the solved particle field onto it. Row 0 of the
        // PlaneGeometry is its TOP edge (y = +HALF), matching r=0 of the sim.
        for (let mr = 0; mr < MESH_N; mr++) {
          const v = (mr / (MESH_N - 1)) * (GN - 1);
          for (let mc = 0; mc < MESH_N; mc++) {
            const u = (mc / (MESH_N - 1)) * (GN - 1);
            sample(u, v, tmp);
            const vi = mr * MESH_N + mc;
            posAttr.setXYZ(vi, tmp[0], tmp[1], tmp[2]);
          }
        }
        posAttr.needsUpdate = true;
        clothGeo.computeVertexNormals();
        clothGeo.computeBoundingSphere();
      };

      reset();
      // Swap the subject onto our deformable cloth geometry (material kept — the
      // brass/steel plane material drapes; mountable-safe: we never touch material).
      subject.geometry = clothGeo;
      write();

      return {
        // Settle window: gentler gravity / softer cloth take longer to drape.
        // Bounded so the loop stays lively; 0.45·duration lands mid-drape.
        duration: () => clamp(3.2 - num(params.gravity, 8.5) * 0.06, 2.2, 3.4),
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Trajectory-only controls (gravity/stiffness/pinMode/damping) must
        // change the FROZEN frame → re-run the sim to the same pinned t.
        onParamChange: (_id: string, _value: ControlValue) => stepper.markDirty(),
        dispose: () => {
          subject.geometry = originalGeometry;
          clothGeo.dispose();
        },
      };
    },
  ),
};
