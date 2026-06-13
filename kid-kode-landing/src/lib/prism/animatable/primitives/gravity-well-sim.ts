// gravity-well-sim — a STREAM of particles flies past a gravity well anchored at
// the pointer; real softened inverse-square attraction bends every path. Fast
// far-passers slingshot through on hyperbolic arcs; slower ones near the well get
// captured into looping orbits. Each particle drags a short trail so the curved
// trajectories read. CATALOG primitive (hard / particles, subject:'empty').
//
// This is an INTEGRATED particle field, NOT a closed-form position(t): every
// particle holds real velocity state (vx/vy/vz) that is advected by the force
// field each fixed step with semi-implicit (symplectic) Euler —
//     a = -G*M * r / (|r|^2 + soft^2)^(3/2)        (softened Newtonian gravity)
//     v += a*dt ;  p += v*dt                         (symplectic → stable orbits)
// — so orbits actually FORM and persist instead of being drawn by a sine. The
// reset-and-replay stepper makes the frame at time t a pure function of
// (params, pointer, t): every control (mass / softening / speed / count) visibly
// re-bends the FROZEN frame the verification harness pins, via onParamChange →
// markDirty. Distinct from `gravity-well` (an eased single-card tidal transform):
// that one moves a host card; this integrates hundreds of free particles.
//
// duration() is finite; the rig loops t→0 (the stepper treats that as a rewind →
// the stream re-seeds and replays). The ~0.45 frozen phase lands MID-FLOW: a
// full stream curving around the well with a captured loop forming.

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
import { hash1, hash2, shash, makeReplayStepper, resolveSimTier, tierPick } from './_sim-core';

const DT = 1 / 120;        // small step → softened-gravity orbits stay stable
const MAX_COUNT = 220;     // fixed build-time allocation (live count clamps to this)
const TRAIL = 6;           // trail samples per particle (head + tail history)
const SPAWN_X = -1.55;     // particles enter just off the left edge
const KILL_X = 1.75;       // recycled once they exit far right
const Y_SPAN = 1.25;       // vertical spread of the incoming stream
const Z_SPAN = 0.5;        // gentle depth so the stream reads with parallax
const EPS = 1e-4;

// Map a 0..1 pointer coord to the rig's world space (0.5 → 0, edges → ±~1.4).
const ptrToWorld = (p: number): number => (clamp(p, 0, 1) - 0.5) * 2.8;

const SCHEMA = [
  { id: 'mass', label: 'Well Mass', type: 'knob', min: 0.4, max: 6, step: 0.1, default: 2.4 },
  { id: 'count', label: 'Count', type: 'knob', min: 40, max: 220, step: 1, default: 160 },
  { id: 'speed', label: 'Stream Speed', type: 'knob', min: 0.3, max: 2.4, step: 0.05, default: 1.1 },
  { id: 'softening', label: 'Softening', type: 'fader', min: 0.06, max: 0.6, step: 0.01, default: 0.18 },
] as const;

export const gravityWellSimPrimitive: PrimitiveDefinition = {
  name: 'gravity-well-sim',
  label: 'Gravity Well Stream',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'pointer',
  description:
    'A stream of particles flies past a gravity well at the pointer; real softened inverse-square attraction bends their paths — some slingshot past, some are captured into orbits — leaving curved trails. Physics, integrated, not a closed-form curve.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'gravity-well-sim', category: 'particles', schema: SCHEMA },
    (target, params) => {
      const tier = resolveSimTier(target);
      // Heavy O(n) field per particle each step → fewer on weak tiers.
      const tierCap = tierPick(tier, { T0: 70, T1: 130, T2: MAX_COUNT });

      // Live integrated state (closure-held flat arrays, fixed MAX alloc).
      const px = new Float32Array(MAX_COUNT);
      const py = new Float32Array(MAX_COUNT);
      const pz = new Float32Array(MAX_COUNT);
      const vx = new Float32Array(MAX_COUNT);
      const vy = new Float32Array(MAX_COUNT);
      const vz = new Float32Array(MAX_COUNT);
      // Trail ring buffer: per particle, TRAIL recent (x,y,z) samples.
      const trail = new Float32Array(MAX_COUNT * TRAIL * 3);

      // Deterministic respawn of one particle off the left edge, with a hashed
      // lane / speed / launch phase. `gen` decorrelates successive recyclings of
      // the same slot so the stream never falls into a repeating lockstep.
      const respawn = (i: number, gen: number, baseSpeed: number) => {
        const lane = shash(i * 1.7 + gen * 3.1);          // -1..1 vertical lane
        const speedJ = 0.7 + hash2(i, gen * 2.3 + 0.5) * 0.6; // 0.7..1.3 speed jitter
        const back = hash1(i * 0.93 + gen * 5.7);          // 0..1 stagger behind edge
        const x = SPAWN_X - back * 1.0;                    // staggered entry so it's continuous
        const y = lane * Y_SPAN;
        const z = shash(i * 4.3 + gen * 1.9) * Z_SPAN;
        px[i] = x;
        py[i] = y;
        pz[i] = z;
        // Mostly rightward, with a small hashed vertical aim so paths fan.
        vx[i] = baseSpeed * speedJ;
        vy[i] = shash(i * 2.6 + gen * 4.1) * 0.18 * baseSpeed;
        vz[i] = shash(i * 6.1 + gen * 2.7) * 0.05 * baseSpeed;
        // Seed the whole trail at the spawn point (no streak from origin).
        for (let s = 0; s < TRAIL; s++) {
          const o = (i * TRAIL + s) * 3;
          trail[o] = x;
          trail[o + 1] = y;
          trail[o + 2] = z;
        }
      };

      // Per-slot recycle counter (bumped each respawn → new hashed lane).
      const gen = new Int32Array(MAX_COUNT);

      const reset = () => {
        const baseSpeed = num(params.speed, 1.1);
        for (let i = 0; i < MAX_COUNT; i++) {
          gen[i] = 0;
          respawn(i, 0, baseSpeed);
        }
      };

      const pushTrail = (i: number) => {
        // Shift history back one slot, write current head at index 0.
        const base = i * TRAIL * 3;
        for (let s = TRAIL - 1; s > 0; s--) {
          const dst = base + s * 3;
          const src = base + (s - 1) * 3;
          trail[dst] = trail[src];
          trail[dst + 1] = trail[src + 1];
          trail[dst + 2] = trail[src + 2];
        }
        trail[base] = px[i];
        trail[base + 1] = py[i];
        trail[base + 2] = pz[i];
      };

      const step = (dt: number) => {
        const G = num(params.mass, 2.4);             // well strength (G*M lumped)
        const baseSpeed = num(params.speed, 1.1);
        const soft = clamp(num(params.softening, 0.18), 0.06, 0.6);
        const count = Math.max(1, Math.min(tierCap, Math.round(num(params.count, 160))));
        // Well sits at the live pointer (recompute each step so a moved cursor
        // re-bends the stream). Center default when no pointer supplied.
        const ptr = target.userData.pointer as { x?: number; y?: number } | undefined;
        const wx = ptrToWorld(num(ptr?.x, 0.5));
        const wy = ptrToWorld(num(ptr?.y, 0.5));
        const soft2 = soft * soft;

        for (let i = 0; i < count; i++) {
          // Softened inverse-square attraction toward the well.
          const rx = wx - px[i];
          const ry = wy - py[i];
          const rz = -pz[i]; // well is on the z=0 plane
          const r2 = rx * rx + ry * ry + rz * rz + soft2;
          const invR = 1 / Math.sqrt(r2);
          const accel = G * invR * invR; // = G / (r^2 + soft^2)
          const ax = accel * rx * invR;
          const ay = accel * ry * invR;
          const az = accel * rz * invR;
          // Semi-implicit (symplectic) Euler: velocity first, then position.
          vx[i] += ax * dt;
          vy[i] += ay * dt;
          vz[i] += az * dt;
          px[i] += vx[i] * dt;
          py[i] += vy[i] * dt;
          pz[i] += vz[i] * dt;
          pushTrail(i);
          // Recycle: gone off the right, or flung far out of frame (slingshot
          // escapees), or fell into a tight captured orbit that has decayed deep
          // into the core — re-stream a fresh particle from the left.
          const offRight = px[i] > KILL_X;
          const offFrame =
            Math.abs(px[i]) > 2.6 || Math.abs(py[i]) > 2.2 || Math.abs(pz[i]) > 1.6;
          if (offRight || offFrame) {
            gen[i]++;
            respawn(i, gen[i], baseSpeed);
          }
        }
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      // ── Render: head points + trail points as one additive Points cloud ─────
      // Layout: for each particle, TRAIL vertices (head at trail index 0). The
      // head is brightest; tail samples dim → a short comet streak. Unused slots
      // park far off-screen.
      const VERTS = MAX_COUNT * TRAIL;
      const positions = new Float32Array(VERTS * 3);
      const colors = new Float32Array(VERTS * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      const colAttr = new BufferAttribute(colors, 3);
      geometry.setAttribute('position', posAttr);
      geometry.setAttribute('color', colAttr);

      const material = new PointsMaterial({
        size: 0.05,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      const points = new Points(geometry, material);
      points.name = 'gravity-well-sim';
      target.object.add(points);

      const HIDDEN = 1000;
      // Ice / steel / mint palette (Observatory Brass family; no purple).
      const HEAD = new Color('#bfeaff'); // bright ice head
      const TAILC = new Color('#5fa8c8'); // cool steel-blue tail

      const write = () => {
        const count = Math.max(1, Math.min(tierCap, Math.round(num(params.count, 160))));
        for (let i = 0; i < count; i++) {
          const tb = i * TRAIL * 3;
          for (let s = 0; s < TRAIL; s++) {
            const v = i * TRAIL + s;
            const o = v * 3;
            positions[o] = trail[tb + s * 3];
            positions[o + 1] = trail[tb + s * 3 + 1];
            positions[o + 2] = trail[tb + s * 3 + 2];
            // Fade head→tail along the streak.
            const f = 1 - s / TRAIL;
            const k = f * f; // quadratic falloff: punchy head, faint tail
            colors[o] = TAILC.r + (HEAD.r - TAILC.r) * k;
            colors[o + 1] = TAILC.g + (HEAD.g - TAILC.g) * k;
            colors[o + 2] = TAILC.b + (HEAD.b - TAILC.b) * k;
          }
        }
        for (let v = count * TRAIL; v < VERTS; v++) {
          const o = v * 3;
          positions[o] = HIDDEN;
          positions[o + 1] = HIDDEN;
          positions[o + 2] = HIDDEN;
          colors[o] = 0;
          colors[o + 1] = 0;
          colors[o + 2] = 0;
        }
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
      };

      reset();
      stepper.reset();
      write();

      return {
        // Long enough that the stream fully establishes and orbits form; the
        // ~0.45 frozen phase lands mid-flow. Bounded so the loop stays lively.
        duration: () => 6,
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Every control re-runs the integration to the same pinned t → the
        // frozen frame visibly re-bends when the advocate sweeps mass / softening
        // / speed / count. (count is ALSO read live in write(), so even a same-t
        // reseek without markDirty shows the extra particles.)
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
