// charged-particles-sim — charged motes drift through a crossed magnetic +
// electric field and follow REAL Lorentz-force paths: F = q(E + v×B). With B
// pointing along +z, v×B curves each mote in the xy-plane, so a moving charge
// spirals on a circular arc (cyclotron motion) whose handedness flips with the
// sign of q. Positive charges (brass/amber) and negative charges (ice) therefore
// peel off in OPPOSITE directions, and a small z-component on B/velocity gives
// the streams a gentle helical lean. The electric field E adds a steady drift
// that pushes + and − charges apart — so the two species visibly separate.
//
// CATALOG primitive (hard / particles, subject:'empty'). This is an INTEGRATED
// particle system, not a closed-form field-line drawing: each mote holds true
// velocity state (vx,vy,vz) that is advected by the force field every fixed step
// via semi-implicit (symplectic) Euler — v += (F/m)*dt; p += v*dt — with light
// drag so it stays bounded inside the tile. This is the distinction the audit
// flagged: magnetic-field draws closed-form field lines; THIS integrates the
// motion of charges THROUGH the field.
//
// Determinism: the only entropy is hash1/hash2/shash seeding of initial
// positions/velocities/charge-sign at reset; the integrator is otherwise pure.
// makeReplayStepper resets-and-replays on backward seek, so the frame at time t
// is a pure function of (params, t) and every control (field B, charge spread,
// count, speed) re-shapes any frozen frame the harness pins. The ~0.45 frozen
// phase lands mid-flight, where the two species have curved into two interleaving
// streams — positive arcs braiding through negative arcs.

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
import {
  hash1,
  hash2,
  shash,
  makeReplayStepper,
  resolveSimTier,
  tierPick,
} from './_sim-core';

const DT = 1 / 90; // tight step → smooth cyclotron arcs at high B
const MAX_COUNT = 480; // build-time max; live `count` clamps to this
const SPAN = 1.35; // working half-extent in x/y (camera-safe envelope)
const WRAP = 1.95; // recycle a mote once it flies past this radius

// Two species: + (brass/amber, charge +1) and − (ice, charge −1). Colours are
// baked per-mote into a vertex-colour buffer so one additive Points draw shows
// both streams (no purple anywhere).
const COL_POS = new Color('#ecd49d'); // warm brass/amber — positive
const COL_NEG = new Color('#7fd4ff'); // cool ice — negative

const SCHEMA = [
  // B field strength along z → cyclotron radius. Higher = tighter curl.
  { id: 'field', label: 'Field (B)', type: 'knob', min: 0.5, max: 9, step: 0.1, default: 4.5 },
  // Charge magnitude spread: scatters |q| across motes so radii vary → richer braid.
  { id: 'charge', label: 'Charge Spread', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.55 },
  { id: 'count', label: 'Count', type: 'knob', min: 60, max: 480, step: 1, default: 320 },
  // Injection speed of the two streams.
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.3, max: 3, step: 0.05, default: 1.4 },
] as const;

export const chargedParticlesSimPrimitive: PrimitiveDefinition = {
  name: 'charged-particles-sim',
  label: 'Charged Particles',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Charged motes drift through a crossed magnetic + electric field and follow real Lorentz-force curved/helical paths (F = q(E + v×B)); positive (brass) and negative (ice) charges curl opposite ways and drift apart — integrated velocity, not field-line drawing.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'charged-particles-sim', category: 'particles', schema: SCHEMA },
    (target, params) => {
      const tier = resolveSimTier(target);
      // Heavy O(n) integrator — degrade count hard on T0 so a tile stays smooth.
      const tierCap = tierPick(tier, { T0: 140, T1: 300, T2: MAX_COUNT });

      // ── Deterministic per-mote seeds ──────────────────────────────────────
      // Two interleaving streams: even-index motes are the + stream injected
      // from the left moving right; odd-index are the − stream injected from the
      // right moving left. A hashed |q| magnitude and a small z give variety and
      // a helical lean. Charge SIGN is parity-locked so the two species are
      // genuinely distinct populations (not a random mix).
      const seedX = new Float32Array(MAX_COUNT);
      const seedY = new Float32Array(MAX_COUNT);
      const seedZ = new Float32Array(MAX_COUNT);
      const seedVX = new Float32Array(MAX_COUNT);
      const seedVY = new Float32Array(MAX_COUNT);
      const seedVZ = new Float32Array(MAX_COUNT);
      const qSign = new Float32Array(MAX_COUNT); // +1 / −1 (species, parity-locked)

      const seed = () => {
        for (let i = 0; i < MAX_COUNT; i++) {
          const pos = (i & 1) === 0; // even → positive species
          qSign[i] = pos ? 1 : -1;
          // Stagger entry along the stream axis so motes don't all arrive at once.
          const along = hash2(i, 1.7); // 0..1 position along the injection line
          const lane = shash(i * 1.3 + 4.1); // −1..1 transverse lane offset
          // Stage each stream INSIDE the wrap envelope (so a mote integrates
          // before it can recycle) on the inflow side, then let it curl across
          // and fly out the far side where it recycles back to launch.
          if (pos) {
            seedX[i] = -0.55 - along * 0.75; // left inflow, x ∈ [−1.30, −0.55]
            seedY[i] = lane * 0.55 + 0.12;
            seedVX[i] = 1; // moving right (speed applied live)
            seedVY[i] = shash(i * 2.7 + 0.5) * 0.18;
          } else {
            seedX[i] = 0.55 + along * 0.75; // right inflow, x ∈ [0.55, 1.30]
            seedY[i] = lane * 0.55 - 0.12;
            seedVX[i] = -1; // moving left
            seedVY[i] = shash(i * 2.7 + 9.5) * 0.18;
          }
          seedZ[i] = shash(i * 3.9 + 2.2) * 0.3;
          seedVZ[i] = shash(i * 5.1 + 6.4) * 0.12; // small → helical lean
        }
      };
      seed();

      // ── Live integrated state (closure-held flat arrays) ──────────────────
      const px = new Float32Array(MAX_COUNT);
      const py = new Float32Array(MAX_COUNT);
      const pz = new Float32Array(MAX_COUNT);
      const vx = new Float32Array(MAX_COUNT);
      const vy = new Float32Array(MAX_COUNT);
      const vz = new Float32Array(MAX_COUNT);
      // `age` lets a recycled mote re-enter with its seeded launch state.
      const recycleSeed = (i: number, sp: number) => {
        px[i] = seedX[i];
        py[i] = seedY[i];
        pz[i] = seedZ[i];
        vx[i] = seedVX[i] * sp;
        vy[i] = seedVY[i] * sp;
        vz[i] = seedVZ[i] * sp;
      };

      const reset = () => {
        const sp = num(params.speed, 1.4);
        for (let i = 0; i < MAX_COUNT; i++) recycleSeed(i, sp);
      };

      // One fixed integration step: apply the Lorentz force F = q(E + v×B) to
      // every active mote and advance it with semi-implicit Euler. B = (0,0,Bz)
      // so v×B = (vy*Bz, −vx*Bz, 0) — the in-plane rotation that makes the
      // cyclotron arc. E is a small +x drift that pushes + and − apart. Light
      // drag keeps speeds bounded so the braid stays inside the tile.
      const step = (dt: number) => {
        const count = Math.max(1, Math.min(tierCap, Math.round(num(params.count, 320))));
        const Bz = num(params.field, 4.5);
        const spread = clamp(num(params.charge, 0.55), 0, 1);
        const sp = num(params.speed, 1.4);
        const Ex = 0.55; // electric drift magnitude (× q below)
        const drag = 0.013; // per-step velocity bleed
        const wrap2 = WRAP * WRAP;

        for (let i = 0; i < count; i++) {
          // Effective charge: sign × (live-spread magnitude). hash1 gives a
          // stable per-mote 0..1; spread fans |q| around 1 so radii vary.
          const q = qSign[i] * (1 + (hash1(i * 0.911 + 0.3) - 0.5) * 2 * spread * 0.8);

          // Lorentz acceleration (unit mass). With B = (0,0,Bz), the cross
          // product v×B = (vy·Bz, −vx·Bz, 0) — the in-plane rotation that bends
          // the path into a cyclotron arc; sign(q) flips the handedness. E is a
          // small +x drift (× q) that pushes + and − species apart. The z axis
          // has no magnetic term (B is purely +z), so vz is carried ballistically
          // and the seeded vz gives each stream its gentle helical lean.
          const ax = q * (Ex + vy[i] * Bz);
          const ay = q * (-vx[i] * Bz);

          // Semi-implicit Euler: integrate velocity first, then position.
          vx[i] += ax * dt;
          vy[i] += ay * dt;
          // Drag — bounded orbits, no runaway energy.
          vx[i] -= vx[i] * drag;
          vy[i] -= vy[i] * drag;
          vz[i] -= vz[i] * drag;
          px[i] += vx[i] * dt;
          py[i] += vy[i] * dt;
          pz[i] += vz[i] * dt;

          // Recycle a mote that has spiralled out of the working envelope so the
          // two streams keep flowing (continuous, looping injection).
          if (px[i] * px[i] + py[i] * py[i] > wrap2) recycleSeed(i, sp);
        }
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      // ── Render: one additive Points, per-mote vertex colour (brass / ice) ──
      const positions = new Float32Array(MAX_COUNT * 3);
      const colors = new Float32Array(MAX_COUNT * 3);
      for (let i = 0; i < MAX_COUNT; i++) {
        const c = (i & 1) === 0 ? COL_POS : COL_NEG;
        // Slight per-mote brightness jitter for a luminous, non-flat field.
        const j = 0.78 + hash2(i, 11.3) * 0.22;
        colors[i * 3] = c.r * j;
        colors[i * 3 + 1] = c.g * j;
        colors[i * 3 + 2] = c.b * j;
      }
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);
      geometry.setAttribute('color', new BufferAttribute(colors, 3));

      const material = new PointsMaterial({
        size: 0.07,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'charged-particles-sim';
      target.object.add(points);

      const HIDDEN = WRAP + 1000; // park motes above the live count off-screen

      const write = () => {
        const count = Math.max(1, Math.min(tierCap, Math.round(num(params.count, 320))));
        for (let i = 0; i < count; i++) {
          positions[i * 3] = px[i];
          positions[i * 3 + 1] = py[i];
          positions[i * 3 + 2] = pz[i];
        }
        for (let i = count; i < MAX_COUNT; i++) {
          positions[i * 3] = HIDDEN;
          positions[i * 3 + 1] = HIDDEN;
          positions[i * 3 + 2] = 0;
        }
        posAttr.needsUpdate = true;
      };

      reset();
      write();

      return {
        // Continuous injected field — loops cleanly; rig pins ~0.45 mid-flight.
        duration: () => Infinity,
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Trajectory controls (field B, charge spread) only re-shape the path,
        // so they MUST re-run the sim to the same pinned t to change the frozen
        // frame. markDirty makes every control a standing function of the pose.
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
