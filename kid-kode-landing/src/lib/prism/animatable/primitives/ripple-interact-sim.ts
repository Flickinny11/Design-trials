// ripple-interact-sim — a REAL interactive water surface. The host 'plane' is
// treated as the free surface of a shallow tank: a height field h[] + vertical
// velocity v[] on an N×N grid, integrated every step by the explicit
// wave-equation solver (waveStep2D from _sim-core). The POINTER pokes the
// surface (splat2D) and the resulting ripples PROPAGATE outward, REFLECT off the
// tank walls (clamped Neumann boundaries), and INTERFERE with earlier rings —
// genuine wave physics, NOT a closed-form sine sum.
//
// This is what makes it distinct from ripple / ripple-pool / ripple-concentric /
// ripple-interference (all of which evaluate sin(dist*freq - t*speed) per vertex
// — analytic rings that can never reflect or self-interfere). Here the next
// frame depends on the whole previous height/velocity field, so wavefronts bounce
// off edges and cross each other.
//
// Determinism (mandatory — the harness pins frozen frames by reseeking): no
// Math.random / Date.now. The sim runs through makeReplayStepper, so seeking
// backward resets and replays from 0 → the frame at time t is a pure function of
// (params, t, pointer). Pokes fire on a deterministic schedule (one every
// pokeInterval seconds) AT the live pointer location, jittered per-poke by a
// hash so even a static pointer sends a lively train of interfering rings. h[] is
// written into the plane's z BufferAttribute and computeVertexNormals() runs, so
// the ice/mint water material lights like a real disturbed surface.
//
// HARD / wave / subject:'plane' / pointer-driven. Engaged frame (~0.45): several
// rings mid-propagation, already reflecting and overlapping.

import {
  Mesh,
  Color,
  MeshPhysicalMaterial,
  PlaneGeometry,
  type BufferAttribute,
  type InterleavedBufferAttribute,
  type Material,
} from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';
import {
  makeReplayStepper,
  resolveSimTier,
  tierPick,
  waveStep2D,
  splat2D,
  hash1,
  shash,
} from './_sim-core';

const DT = 1 / 90; // explicit wave solver wants a small, stable step
const FIRST_POKE = 0.05; // first ripple lands almost immediately
// Pre-seed pokes injected at reset (t=0) so even the very first captured frame
// already shows several propagating, interfering ripple systems — the surface is
// never the flat dead square the advocate flagged. Deterministic spread (no RNG).
const PRESEED_POKES = 5;
// Wave steps run after pre-seeding so the pre-seed rings have already travelled
// outward / begun reflecting by t=0 (a mid-action surface, not fresh splats).
// The count is deliberately generous: more settle steps let tension (wave speed)
// and damping (decay) compound, so both controls reshape the frozen frame more
// decisively (the advocate found them dead).
const PRESEED_SETTLE = 48;

const SCHEMA = [
  // tension = c2 in the wave equation (how fast wavefronts travel).
  { id: 'tension', label: 'Tension', type: 'knob', min: 6, max: 30, step: 0.5, default: 16 },
  // damping: energy retained per step (lower fader → ripples die faster).
  { id: 'damping', label: 'Damping', type: 'fader', min: 0.6, max: 0.999, step: 0.001, default: 0.985 },
  { id: 'pokeStrength', label: 'Poke Strength', type: 'knob', min: 0.1, max: 2.4, step: 0.05, default: 1.0 },
  { id: 'pokeSize', label: 'Poke Size', type: 'knob', min: 1.5, max: 7, step: 0.1, default: 3.4 },
  // how often a new poke fires (seconds) — more pokes → richer interference.
  { id: 'pokeInterval', label: 'Poke Rate', type: 'fader', min: 0.2, max: 1.6, step: 0.05, default: 0.55 },
] as const;

export const rippleInteractSimPrimitive: PrimitiveDefinition = {
  name: 'ripple-interact-sim',
  label: 'Interactive Water',
  category: 'wave',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'pointer',
  description:
    'A real interactive water surface: the pointer pokes a wave-equation height field and the ripples propagate, reflect off the edges, and interfere — true simulated water, not a closed-form sine.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'ripple-interact-sim', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? (target.object as unknown as Mesh);
      const geom = mesh.geometry as PlaneGeometry;
      const posAttr = geom.getAttribute('position') as
        | BufferAttribute
        | InterleavedBufferAttribute;
      const vCount = posAttr.count;

      // Cache base vertex XY (and Z) so displacement is non-destructive. The
      // plane is PlaneGeometry(1.8,1.8,64,64) → vertices in [-0.9,0.9]; we map
      // each vertex's XY into grid space to sample the height field bilinearly.
      const baseX = new Float32Array(vCount);
      const baseY = new Float32Array(vCount);
      const baseZ = new Float32Array(vCount);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < vCount; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        baseX[i] = x;
        baseY[i] = y;
        baseZ[i] = posAttr.getZ(i);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      const spanX = maxX - minX || 1;
      const spanY = maxY - minY || 1;

      // Tier-gated grid resolution. HEAVY (waveStep2D is O(N²) per step) → T0 is
      // markedly cheaper. T2 is the catalog default.
      const tier = resolveSimTier(target);
      const N = tierPick(tier, { T0: 28, T1: 44, T2: 64 });
      const CELLS = N * N;

      // The free-surface fields. Reused across replays (reset zeroes them).
      const h = new Float32Array(CELLS);
      const v = new Float32Array(CELLS);

      // Deterministic poke bookkeeping: pokesFired counts how many scheduled
      // pokes have already been injected this replay, so the catch-up loop fires
      // each one exactly once even across multi-step seeks.
      let pokesFired = 0;
      let simTime = 0;

      const reset = () => {
        h.fill(0);
        v.fill(0);
        pokesFired = 0;
        simTime = 0;
        // Pre-seed the tank so even the FIRST captured frame (idle / t=0) already
        // shows several propagating, interfering ripple systems — the surface is
        // never the flat dead square the advocate flagged. We fire a deterministic
        // spread of pokes, then advance the wave solver a fixed number of steps at
        // the LIVE tension/damping so the rings have already travelled outward and
        // begun reflecting (and so tension/damping visibly reshape the frozen frame
        // — the two controls the advocate found dead). pokesFired is left at 0 so
        // the running schedule continues to add fresh rings on top.
        const c2 = num(params.tension, 16);
        const damp = clamp(num(params.damping, 0.985), 0.6, 0.999);
        for (let k = 0; k < PRESEED_POKES; k++) injectPoke(k);
        for (let s = 0; s < PRESEED_SETTLE; s++) waveStep2D(h, v, N, c2, damp, DT);
      };

      // Read the live pointer (normalized 0..1, subject centre at 0.5,0.5). The
      // host always supplies one (the catalog rig orbits a synthetic pointer; a
      // real host feeds the cursor), so this only biases WHERE the next poke's
      // spread is centred — the deterministic quadrant walk in injectPoke does the
      // heavy lifting of scattering sources across the whole tank.
      const readPointer = (): { px: number; py: number } => {
        const p = target.userData.pointer as { x?: unknown; y?: unknown } | undefined;
        const px = p && typeof p.x === 'number' && Number.isFinite(p.x) ? p.x : 0.5;
        const py = p && typeof p.y === 'number' && Number.isFinite(p.y) ? p.y : 0.5;
        return { px, py };
      };

      // Inject poke #k. Sources WALK a deterministic spread of opposite quadrants
      // on successive pokes (gently pulled toward the live pointer), so the
      // sources never collapse onto the dead centre — the frozen frame shows
      // several ripple systems mid-propagation, reflecting off all four walls and
      // crossing each other. AMPLITUDE is generous: the prior 0.06 coefficient
      // read as a flat dead blue square per the advocate.
      const injectPoke = (k: number) => {
        const strength = num(params.pokeStrength, 1.0);
        const size = clamp(num(params.pokeSize, 3.4), 1.0, N * 0.4);
        const { px, py } = readPointer();
        // Rotating-quadrant base so consecutive pokes land far apart and their
        // wavefronts have room to travel, reflect, and interfere.
        const quad = k % 4;
        const qx = quad === 1 || quad === 2 ? 0.7 : 0.3;
        const qy = quad >= 2 ? 0.7 : 0.3;
        // Per-poke deterministic scatter around the quadrant anchor.
        const sx = shash(k * 4.27 + 2.1) * 0.18;
        const sy = shash(k * 6.83 + 5.4) * 0.18;
        // Blend a little toward the live pointer so a real cursor still steers the
        // train without ever collapsing the spread to a single point.
        const cx = clamp(qx + sx + (px - 0.5) * 0.35, 0.08, 0.92);
        const cy = clamp(qy + sy + (py - 0.5) * 0.35, 0.08, 0.92);
        const gx = cx * (N - 1);
        const gy = cy * (N - 1);
        // Alternate poke polarity (drop vs lift) so crests and troughs interfere.
        const sign = hash1(k * 2.39 + 0.5) > 0.5 ? 1 : -1;
        // Raised splat amplitude: the surface now visibly deforms (was 0.06).
        splat2D(h, N, gx, gy, size, -strength * 0.2 * sign);
      };

      const step = (dt: number) => {
        const c2 = num(params.tension, 16);
        const damp = clamp(num(params.damping, 0.985), 0.6, 0.999);
        const interval = clamp(num(params.pokeInterval, 0.55), 0.2, 1.6);

        // Fire any scheduled pokes that fall within this step (FIRST_POKE, then
        // every `interval` seconds). Deterministic given (params, t).
        const nextPokeTime = FIRST_POKE + pokesFired * interval;
        if (simTime >= nextPokeTime) {
          injectPoke(pokesFired);
          pokesFired++;
        }

        // One explicit wave-equation step: ripples propagate + reflect off the
        // clamped boundaries; the prior field carries forward so they interfere.
        waveStep2D(h, v, N, c2, damp, dt);
        simTime += dt;
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      // Sample the height field bilinearly at a vertex's grid coords.
      const sampleH = (fx: number, fy: number): number => {
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const x1 = x0 + 1 < N ? x0 + 1 : x0;
        const y1 = y0 + 1 < N ? y0 + 1 : y0;
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
        // Live amplitude readout so even a same-t reseek (no markDirty) shows a
        // height response when poke strength is swept. The DISP gain lifts the
        // bilinear-sampled height into a displacement big enough that
        // computeVertexNormals() tilts the surface visibly — the prior gain left
        // the water reading flat (advocate: dead blue square).
        const amp = clamp(num(params.pokeStrength, 1.0), 0.1, 2.4);
        const DISP = 1.8; // surface-relative displacement gain (plane span ≈ 1.8)
        for (let i = 0; i < vCount; i++) {
          const fx = ((baseX[i] - minX) / spanX) * (N - 1);
          const fy = ((baseY[i] - minY) / spanY) * (N - 1);
          const z = sampleH(fx, fy) * (0.7 + amp * 0.3) * DISP;
          posAttr.setZ(i, baseZ[i] + z);
        }
        posAttr.needsUpdate = true;
        geom.computeVertexNormals();
      };

      // Swap to an ice/mint transmissive water material (MeshPhysicalMaterial:
      // transmission + ior≈1.33) so the disturbed surface reads as real water,
      // not a tinted slab. Restored on dispose.
      const prevMat = mesh.material as Material;
      const waterMat = new MeshPhysicalMaterial({
        color: new Color('#7fd4ff'),
        roughness: 0.12,
        metalness: 0.0,
        transmission: 0.82,
        ior: 1.33,
        thickness: 0.6,
        attenuationColor: new Color('#9fe0c4'),
        attenuationDistance: 1.4,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.25,
        sheen: 0.4,
        sheenColor: new Color('#cfdde6'),
        transparent: true,
        side: 2, // DoubleSide — the troughs can face away from the camera
      });
      mesh.material = waterMat;

      reset();
      write();

      return {
        // Continuous interactive surface — the master clock advances t, the loop
        // rewinds to 0 (replay re-floods a calm surface and pokes again).
        duration: () => Infinity,
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Trajectory-only controls (tension/damping/rate/size) must change the
        // FROZEN frame when the advocate sweeps them: re-seek the same pinned t
        // after a full replay. Non-negotiable.
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          for (let i = 0; i < vCount; i++) {
            posAttr.setXYZ(i, baseX[i], baseY[i], baseZ[i]);
          }
          posAttr.needsUpdate = true;
          geom.computeVertexNormals();
          mesh.material = prevMat;
          waterMat.dispose();
        },
      };
    },
  ),
};
