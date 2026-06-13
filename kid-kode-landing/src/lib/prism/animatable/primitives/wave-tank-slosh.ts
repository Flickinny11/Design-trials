// wave-tank-slosh — water SLOSHING in a tank. A shallow-water height field on a
// CPU Eulerian grid, driven by a TILT body force so the BULK of the water piles
// up against one wall, reflects, and surges back — low-frequency bulk motion,
// deliberately distinct from the high-frequency concentric `ripple`. CATALOG
// primitive (hard / wave, subject:'plane').
//
// Genuine simulation, NOT a sine: a height grid h[] + vertical-velocity grid v[]
// are integrated by the explicit wave equation (`waveStep2D` from _sim-core).
// Each step a tilt — pointer.x plus a deterministic periodic component — applies
// a horizontal BODY FORCE that biases v[] toward the down-tilt side, so mass
// accumulates against that wall (a real slosh), the closed Neumann walls reflect
// it, and damping bleeds energy. The grid height is bilinearly sampled onto the
// host 'plane' z buffer and re-normalled, so it lights as real ice/steel water.
//
// Deterministic via the reset-replay stepper: the frame at time t is a pure
// function of (params, t). The tilt phase is seeded from a hash (no wallclock,
// no Math.random), so the frozen ~0.45 frame is reproducible and every control
// — slosh / damping / tilt / tension — visibly changes it (onParamChange →
// markDirty re-runs the sim to the same pinned t).

import {
  Mesh,
  Color,
  type BufferAttribute,
  type InterleavedBufferAttribute,
  type MeshStandardMaterial,
} from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';
import {
  makeReplayStepper,
  resolveSimTier,
  tierPick,
  waveStep2D,
  hash1,
} from './_sim-core';

const DT = 1 / 120; // small fixed step for a stable explicit grid
const PLANE_HALF = 0.9; // host plane spans XY ∈ [-0.9, 0.9]
const WATER = '#7fd4ff'; // ice water
const WATER_EMISSIVE = '#16384a'; // steel-blue depth glow

const SCHEMA = [
  // Drive strength of the slosh body force (how hard the tilt pushes the bulk).
  { id: 'slosh', label: 'Slosh', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.62 },
  // Energy loss per step — low damping = water keeps surging wall to wall.
  { id: 'damping', label: 'Damping', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.32 },
  // Static tank tilt bias (pointer.x adds to this live). Tips the resting bulk.
  { id: 'tilt', label: 'Tilt', type: 'knob', min: -1, max: 1, step: 0.02, default: 0.35 },
  // Wave tension (c²): higher = stiffer, faster-travelling surface.
  { id: 'tension', label: 'Tension', type: 'knob', min: 0.4, max: 3, step: 0.05, default: 1.4 },
  // Overall vertical exaggeration of the surface onto the plane.
  { id: 'height', label: 'Height', type: 'knob', min: 0.1, max: 0.6, step: 0.01, default: 0.32, unit: 'u' },
] as const;

export const waveTankSloshPrimitive: PrimitiveDefinition = {
  name: 'wave-tank-slosh',
  label: 'Wave Tank Slosh',
  category: 'wave',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'pointer',
  description:
    'Water sloshing in a tank: a shallow-water height field driven by a tilt body force so the bulk of the water piles against the walls and surges back — low-frequency bulk motion, not a ripple.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'wave-tank-slosh', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? (target.object as unknown as Mesh);
      const geom = mesh.geometry;
      const posAttr = geom.getAttribute('position') as
        | BufferAttribute
        | InterleavedBufferAttribute;
      const vCount = posAttr.count;

      // Recolor the host plane to ice/steel water (lit, transmissive-feeling).
      const mat = mesh.material as MeshStandardMaterial;
      const prevColor = mat.color.clone();
      const prevEmissive = mat.emissive.clone();
      const prevEmissiveI = mat.emissiveIntensity;
      const prevRough = mat.roughness;
      const prevMetal = mat.metalness;
      mat.color = new Color(WATER);
      mat.emissive = new Color(WATER_EMISSIVE);
      mat.emissiveIntensity = 0.5;
      mat.roughness = 0.12;
      mat.metalness = 0.18;
      mat.needsUpdate = true;

      // Cache base vertex XY (so dispose restores) and precompute, per vertex,
      // the bilinear sample weights into the height grid (XY → grid cell).
      const baseX = new Float32Array(vCount);
      const baseY = new Float32Array(vCount);
      const baseZ = new Float32Array(vCount);
      for (let i = 0; i < vCount; i++) {
        baseX[i] = posAttr.getX(i);
        baseY[i] = posAttr.getY(i);
        baseZ[i] = posAttr.getZ(i);
      }

      // ── Height grid (CPU Eulerian shallow water) ──────────────────────────
      // Tier-gated resolution: T0 markedly coarser/cheaper than T2 (HEAVY sim).
      const tier = resolveSimTier(target);
      const N = tierPick(tier, { T0: 28, T1: 40, T2: 56 });
      const MAX_N = 56; // fixed build-time allocation; never realloc per seek
      const h = new Float32Array(MAX_N * MAX_N);
      const v = new Float32Array(MAX_N * MAX_N);

      // Deterministic per-instance tilt phase offset (no Math.random / Date.now).
      const phaseSeed = hash1(7.0) * Math.PI * 2;

      const reset = () => {
        // Start flat and at rest; the tilt body force builds the slosh up.
        h.fill(0);
        v.fill(0);
      };

      const step = (dt: number) => {
        const slosh = clamp(num(params.slosh, 0.62), 0, 1);
        const damping = clamp(num(params.damping, 0.32), 0, 1);
        const tiltBias = num(params.tilt, 0.35);
        const tension = num(params.tension, 1.4);

        // Live pointer.x tilts the tank (0..1, centre 0.5 → no tilt). Plus the
        // static tilt knob and a slow deterministic sway so the surface sloshes
        // even with the pointer parked dead-centre (the catalog tile pins it).
        const ud = target.userData as { pointer?: { x?: number } };
        const px = typeof ud.pointer?.x === 'number' ? ud.pointer.x : 0.5;
        const pointerTilt = (px - 0.5) * 2; // −1..1
        const simT = stepper.now();
        // ~0.4 Hz bulk sway — LOW frequency, this is the slosh, not a ripple.
        const sway = Math.sin(simT * 2.6 + phaseSeed);
        const tilt = clamp(pointerTilt + tiltBias + sway, -2, 2);

        // Surface wave propagation: spreads the pile into the natural sloshing
        // mode and carries the crest wall-to-wall. c² = tension.
        const c2 = tension * 6.0;
        const damp = 1 - damping * 0.02;
        waveStep2D(h, v, N, c2, damp, dt);

        // GRAVITY RESTORING toward a TILT-DEFINED equilibrium plane: a tilted
        // tank's water settles to a sloped surface, HIGH on the down-tilt wall.
        // Accelerate each cell's vertical velocity toward h_eq(x) = ampEq·tilt·x.
        // This is the slosh body force — it drives genuine MASS TRANSPORT across
        // the tank (the bulk piles on a wall), and because `tilt` reverses with
        // the sway/pointer the bulk surges back to the other wall. Strong global
        // damping keeps it a bounded, controllable slosh (no resonant blow-up).
        const ampEq = 0.55 * slosh; // peak equilibrium tilt height
        const kRestore = 26.0; // gravity-like pull toward equilibrium
        const vDamp = Math.exp(-(0.6 + damping * 5.0) * dt); // bulk-mode damping
        for (let y = 0; y < N; y++) {
          const row = y * N;
          for (let x = 0; x < N; x++) {
            const xn = N > 1 ? (x / (N - 1)) * 2 - 1 : 0; // −1..1 across tank
            const hEq = ampEq * tilt * xn;
            const i = row + x;
            v[i] += (hEq - h[i]) * kRestore * dt; // pull surface toward the slope
            v[i] *= vDamp; // bleed energy so the slosh stays bounded
          }
        }
        for (let i = 0, cells = N * N; i < cells; i++) h[i] += v[i] * dt;

        // Volume conservation: the closed tank neither gains nor loses water, so
        // re-centre the mean height to zero (deterministic — mean only).
        let mean = 0;
        const cells = N * N;
        for (let i = 0; i < cells; i++) mean += h[i];
        mean /= cells;
        if (mean !== 0) for (let i = 0; i < cells; i++) h[i] -= mean;
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      // Bilinearly sample the height grid at a normalized plane position.
      const sampleHeight = (sx: number, sy: number): number => {
        // sx, sy ∈ [0,1]; clamp to interior so the 4-tap stays in bounds.
        const fx = clamp(sx, 0, 1) * (N - 1);
        const fy = clamp(sy, 0, 1) * (N - 1);
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const x1 = Math.min(N - 1, x0 + 1);
        const y1 = Math.min(N - 1, y0 + 1);
        const tx = fx - x0;
        const ty = fy - y0;
        const h00 = h[y0 * N + x0];
        const h10 = h[y0 * N + x1];
        const h01 = h[y1 * N + x0];
        const h11 = h[y1 * N + x1];
        const a = h00 + (h10 - h00) * tx;
        const b = h01 + (h11 - h01) * tx;
        return a + (b - a) * ty;
      };

      const write = () => {
        const exaggerate = num(params.height, 0.32);
        for (let i = 0; i < vCount; i++) {
          // Plane XY ∈ [-0.9, 0.9] → grid UV ∈ [0,1].
          const sx = (baseX[i] + PLANE_HALF) / (2 * PLANE_HALF);
          const sy = (baseY[i] + PLANE_HALF) / (2 * PLANE_HALF);
          const z = sampleHeight(sx, sy) * exaggerate;
          posAttr.setZ(i, baseZ[i] + z);
        }
        posAttr.needsUpdate = true;
        geom.computeVertexNormals();
      };

      reset();
      write();

      return {
        // Purely stateful surface sim; the rig loops t (reseek backward → reset
        // and replay), so the slosh keeps surging wall to wall.
        duration: () => Infinity,
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Trajectory-only controls (slosh/damping/tilt/tension) must move the
        // FROZEN frame: the rig re-seeks the same paused t, so re-run the sim.
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          for (let i = 0; i < vCount; i++) {
            posAttr.setXYZ(i, baseX[i], baseY[i], baseZ[i]);
          }
          posAttr.needsUpdate = true;
          geom.computeVertexNormals();
          mat.color = prevColor;
          mat.emissive = prevEmissive;
          mat.emissiveIntensity = prevEmissiveI;
          mat.roughness = prevRough;
          mat.metalness = prevMetal;
          mat.needsUpdate = true;
        },
      };
    },
  ),
};
