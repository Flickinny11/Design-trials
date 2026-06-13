// shockwave-scatter — a radial SHOCKWAVE expands from the centre across a regular
// GRID of elements (dots/tiles). As the expanding force ring sweeps past each
// element it is PUSHED outward (an impulse the moment the ring crosses, plus the
// integrated velocity that follows); a spring then pulls it back toward its grid
// slot — a propagating displacement wave through a layout. After the wave passes
// and the grid settles, the shock RECHARGES and re-fires from the centre. CATALOG
// primitive (medium / displacement, subject:'empty').
//
// Genuine integrated particle field, NOT a closed-form position(t): each grid
// element holds velocity state (vx/vy) integrated with semi-implicit (symplectic)
// Euler. The shock contributes a force only while the ring radius is near the
// element's distance from centre (a thin moving annulus), so the outward impulse
// is delivered by the FIELD as it sweeps — never stamped analytically. A Hookean
// spring toward the slot plus drag returns it. Because the stepper resets-and-
// replays on backward seek, the frame at time t is a pure function of (params, t),
// so every control — power, springBack, ringSpeed, gridSize — visibly changes any
// frozen frame the harness pins (onParamChange → markDirty).
//
// duration() is one fire→settle→recharge cycle; the catalog rig loops t back to 0
// (a rewind → re-fire). The ~0.45 frozen phase lands MID-EXPANSION: the ring is
// partway across the grid, a visible bulge wave of displaced elements trailing
// behind it.

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Color,
  AdditiveBlending,
} from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';
import { hash2, makeReplayStepper, resolveSimTier, tierPick } from './_sim-core';

const DT = 1 / 120; // stiff spring contact → small step
const HALF = 1.2; // grid half-extent in X/Y about the origin
const MAX_DIM = 11; // build-time max grid edge (MAX_DIM^2 elements allocated)
const MAX_COUNT = MAX_DIM * MAX_DIM;
const RING_WIDTH = 0.36; // thickness of the moving force annulus (world units)
const MAX_RADIUS = 2.0; // ring fully past the corners by here
const CYCLE = 2.6; // seconds per fire→settle→recharge cycle
const EXPAND_FRAC = 0.62; // fraction of the cycle the ring spends expanding

const SCHEMA = [
  { id: 'power', label: 'Shock Power', type: 'knob', min: 0.5, max: 6, step: 0.1, default: 3.4 },
  { id: 'springBack', label: 'Spring Back', type: 'fader', min: 0.1, max: 1, step: 0.01, default: 0.55 },
  { id: 'ringSpeed', label: 'Ring Speed', type: 'knob', min: 0.6, max: 3.5, step: 0.05, default: 1.5 },
  { id: 'gridSize', label: 'Grid Size', type: 'knob', min: 4, max: 11, step: 1, default: 9 },
] as const;

export const shockwaveScatterPrimitive: PrimitiveDefinition = {
  name: 'shockwave-scatter',
  label: 'Shockwave Scatter',
  category: 'displacement',
  difficulty: 'medium',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A radial shockwave expands from the centre across a regular grid; each element is pushed outward as the ring sweeps past, then springs back to its slot — a propagating displacement wave, then it recharges and re-fires. Real impulse + spring integration.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'shockwave-scatter', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const tier = resolveSimTier(target);
      // Heavy O(grid^2) spring field → cheaper grid on T0 so it degrades well.
      const maxDim = tierPick(tier, { T0: 7, T1: 9, T2: MAX_DIM });

      // Per-element slot (home) positions for the FULL build-time grid. The live
      // `gridSize` control re-derives the active layout each reset; elements
      // outside the active grid are parked off-screen.
      const homeX = new Float32Array(MAX_COUNT);
      const homeY = new Float32Array(MAX_COUNT);
      // Live integrated state (closure-held).
      const px = new Float32Array(MAX_COUNT);
      const py = new Float32Array(MAX_COUNT);
      const vx = new Float32Array(MAX_COUNT);
      const vy = new Float32Array(MAX_COUNT);
      // Per-element radial distance from centre (recomputed per reset) and a
      // one-shot latch so the ring delivers its sharp impulse exactly once as it
      // crosses — the rest of the push is integrated velocity + the annulus force.
      const dist = new Float32Array(MAX_COUNT);
      const kicked = new Uint8Array(MAX_COUNT);

      let activeCount = 0; // number of live elements this cycle

      // Lay out a `dim x dim` centred grid into the home arrays and seed live
      // state at home (resting). Reads gridSize LIVE so the control re-layouts.
      const layout = () => {
        const want = Math.round(num(params.gridSize, 9));
        const dim = Math.max(4, Math.min(maxDim, want));
        activeCount = dim * dim;
        const span = HALF * 2;
        const stepGrid = dim > 1 ? span / (dim - 1) : 0;
        let i = 0;
        for (let gy = 0; gy < dim; gy++) {
          for (let gx = 0; gx < dim; gx++) {
            const hx = -HALF + gx * stepGrid;
            const hy = -HALF + gy * stepGrid;
            homeX[i] = hx;
            homeY[i] = hy;
            dist[i] = Math.hypot(hx, hy);
            i++;
          }
        }
      };

      const reset = () => {
        layout();
        for (let i = 0; i < activeCount; i++) {
          px[i] = homeX[i];
          py[i] = homeY[i];
          vx[i] = 0;
          vy[i] = 0;
          kicked[i] = 0;
        }
      };

      // The ring radius is a function of integrated sim time within the cycle —
      // but the DISPLACEMENT it causes is integrated, not stamped: the ring only
      // supplies a force/impulse, and each element carries its own velocity.
      let simClock = 0; // total integrated time, used to phase the ring

      const ringRadius = (ringSpeed: number): number => {
        const cyc = ((simClock % CYCLE) + CYCLE) % CYCLE;
        const expandDur = CYCLE * EXPAND_FRAC;
        if (cyc >= expandDur) return MAX_RADIUS + 10; // ring gone (recharging)
        // Ring sweeps 0 → MAX_RADIUS over the expand window, scaled by ringSpeed.
        const frac = (cyc / expandDur) * clamp(ringSpeed / 1.5, 0.4, 2.4);
        return frac * MAX_RADIUS;
      };

      const step = (dt: number) => {
        const power = num(params.power, 3.4);
        const spring01 = clamp(num(params.springBack, 0.55), 0.1, 1);
        const ringSpeed = num(params.ringSpeed, 1.5);

        // Spring stiffness + drag derived from springBack: more springBack → a
        // snappier return and a quicker settle.
        const k = 30 + spring01 * 90; // Hooke constant toward the slot
        const drag = Math.exp(-(3.2 + spring01 * 7) * dt); // velocity retention

        const r = ringRadius(ringSpeed);
        const half = RING_WIDTH;

        for (let i = 0; i < activeCount; i++) {
          // --- Shock force: only elements whose distance is within the moving
          //     annulus feel an outward push. This is the FIELD sweeping by, so
          //     the impulse arrives at different times for different rings of the
          //     grid → a propagating wave, not a synchronized stamp.
          const dr = dist[i] - r;
          if (dr > -half && dr < half && r < MAX_RADIUS) {
            // Bell across the annulus (peak at the ring centre).
            const f = 1 - Math.abs(dr) / half;
            const env = f * f;
            // Outward radial direction from centre (fallback for the dead-centre
            // element: use a deterministic hashed jitter so it still scatters).
            let nx = px[i];
            let ny = py[i];
            const len = Math.hypot(nx, ny);
            if (len > 1e-4) {
              nx /= len;
              ny /= len;
            } else {
              const a = hash2(i, 1.7) * Math.PI * 2;
              nx = Math.cos(a);
              ny = Math.sin(a);
            }
            // Sharp one-shot impulse the first time the ring reaches this element
            // (the leading-edge "kick"), then a continuous annulus force while it
            // straddles the ring. Both are velocity contributions → integrated.
            if (!kicked[i] && dr <= 0) {
              const impulse = power * 1.6;
              vx[i] += nx * impulse;
              vy[i] += ny * impulse;
              kicked[i] = 1;
            }
            const force = power * 14 * env;
            vx[i] += nx * force * dt;
            vy[i] += ny * force * dt;
          }

          // --- Spring back toward the home slot (Hooke) + drag. This is what
          //     makes the displaced element RETURN, so the grid heals behind the
          //     ring and is ready to re-fire next cycle.
          const sx = homeX[i] - px[i];
          const sy = homeY[i] - py[i];
          vx[i] += sx * k * dt;
          vy[i] += sy * k * dt;
          vx[i] *= drag;
          vy[i] *= drag;

          // --- Integrate position (semi-implicit Euler: v already updated).
          px[i] += vx[i] * dt;
          py[i] += vy[i] * dt;
        }

        // Re-arm the per-element kick latch once the ring is gone (next cycle can
        // fire it again). Done once per step, cheap.
        if (r >= MAX_RADIUS) {
          for (let i = 0; i < activeCount; i++) kicked[i] = 0;
        }

        simClock += dt;
      };

      const stepper = makeReplayStepper({
        dt: DT,
        reset: () => {
          simClock = 0;
          reset();
        },
        step,
      });

      // --- Geometry / material: round additive points (a brass→ice grid), never
      //     1px squares (sizeAttenuation round-ish points, soft additive falloff).
      const positions = new Float32Array(MAX_COUNT * 3);
      const colors = new Float32Array(MAX_COUNT * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      const colAttr = new BufferAttribute(colors, 3);
      geometry.setAttribute('position', posAttr);
      geometry.setAttribute('color', colAttr);

      const material = new PointsMaterial({
        size: 0.16,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.96,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'shockwave-scatter';
      target.object.add(points);

      const HIDDEN = HALF + 1000;
      const brass = new Color('#ecd49d'); // Observatory brass (rest)
      const ice = new Color('#7fd4ff'); // ice (excited / displaced)

      const write = () => {
        for (let i = 0; i < activeCount; i++) {
          positions[i * 3] = px[i];
          positions[i * 3 + 1] = py[i];
          positions[i * 3 + 2] = 0;
          // Tint by displacement magnitude: a resting element reads brass, a
          // displaced (riding-the-wave) element flares to ice — so the bulge
          // wave is visible as a band of cool colour, read LIVE so a same-t
          // re-seek still shows colour shift if anything moved.
          const off = Math.hypot(px[i] - homeX[i], py[i] - homeY[i]);
          const m = clamp(off / 0.55, 0, 1);
          colors[i * 3] = brass.r + (ice.r - brass.r) * m;
          colors[i * 3 + 1] = brass.g + (ice.g - brass.g) * m;
          colors[i * 3 + 2] = brass.b + (ice.b - brass.b) * m;
        }
        for (let i = activeCount; i < MAX_COUNT; i++) {
          positions[i * 3] = HIDDEN;
          positions[i * 3 + 1] = HIDDEN;
          positions[i * 3 + 2] = 0;
          colors[i * 3] = 0;
          colors[i * 3 + 1] = 0;
          colors[i * 3 + 2] = 0;
        }
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
      };

      stepper.reset();
      write();

      return {
        duration: () => CYCLE,
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Any control sweep re-runs the sim to the same pinned frame → the frozen
        // frame visibly changes (standing function of the engaged pose).
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          target.object.remove(points);
          geometry.dispose();
          material.dispose();
        },
      };
    },
  ),
};
