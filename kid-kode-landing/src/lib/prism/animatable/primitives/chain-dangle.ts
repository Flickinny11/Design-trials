// chain-dangle — a hanging CHAIN of discrete rigid BEADS: ~10 brass spheres
// linked tip-to-tip by XPBD distance constraints, the top bead PINNED to an
// anchor that follows the cursor's horizontal position, the rest swinging under
// real gravity with genuine pendulum coupling bead-to-bead. POINTER / hard,
// subject:'empty' (the primitive builds its own Group of sphere meshes — there
// is no host subject to deform). Mined from DESIGN-REFERENCES §7 Cursor &
// Interaction Libraries (the hanging-chain / beaded-pendant cursor pattern):
// drag the anchor and the chain whips, the lower beads lagging and overshooting
// before the links pull them back into line.
//
// PHYSICS (the XPBD recipe from PHYSICS-AUTHORING-GUIDE.md, NOT an easing curve):
// each bead is a mass particle in flat px/py/pz + pvx/pvy/pvz + invMass arrays
// (the top bead's invMass = 0 → pinned to the anchor). Per fixed sim step the
// makeReplayStepper drives `step(dt)`, which runs SUBSTEPS substeps of dt/SUBSTEPS:
//   1. save prevPos; integrate velocity (gravity − linear damping) → predict pos;
//      re-pin the top bead onto the live anchor position each substep.
//   2. solve every distance constraint ONCE in a fixed index order (Gauss-Seidel
//      "small steps" XPBD) with alphaTilde = complianceAlpha(stiffness01, dtSub) —
//      a stiffer link resists stretching, a soft link sags and stretches.
//   3. set velocity = (pos − prevPos)/dtSub (positional XPBD velocity update).
// Because the stepper resets-and-replays on a backward seek and NOTHING reads
// Math.random / Date.now (all seeding via hash1/shash from _sim-core), the frame
// at time t is a pure function of (params, pointer, t) — exactly what the frozen-
// pin verification needs.
//
// THE ANCHOR follows the cursor: anchorX = center + (pointer.x − 0.5)·REACH plus a
// deterministic ambient sway (a pure function of simT) so the chain is ALWAYS in
// motion — at the ~0.45 frozen phase the anchor is mid-sweep and the lower beads
// trail BEHIND it in a curved, lagging arc (the engaged "chain mid-swing" pose).
// The pointer enters only as a steady additive offset, so a pinned pointer holds a
// reproducible swing the controls reshape.
//
// CONTROLS (all LIVE, all reshape the frozen pinned frame via markDirty):
//   • links     — bead count (structural; clamped to MAX, unused beads parked).
//   • gravity   — fall acceleration: heavier → the chain hangs straighter / swings
//                 with a snappier tempo and the lower beads trail farther on a sweep.
//   • damping   — linear velocity drag: low rings and overshoots, high sits firm.
//   • stiffness — link compliance: stiff holds a taut rigid chain, soft lets the
//                 links stretch and the chain sag + lag more on the swing.
//   • beadSize  — bead radius (read LIVE in write(), so even a no-markDirty same-t
//                 reseek shows a control change).
// onParamChange → stepper.markDirty() (NON-NEGOTIABLE): the verification rig sweeps
// each control while PAUSED, re-seeking the SAME t; markDirty re-runs the sim to that
// t so gravity/damping/stiffness — which only touch the trajectory — visibly reshape
// the frozen frame.
//
// DISTINCT from rope-dangle-sim (a CONTINUOUS tube — a swept solid), from
// spring-chain-follow (ghost CLONES of a card on damped springs, no gravity hang),
// and from pendant-dangle (a SINGLE rigid card on one angular pendulum spring).
// THIS is a real multi-body XPBD chain of DISCRETE beads with link constraints and
// gravity — drag the top, the whole strand of beads swings and whips.

import {
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';
import {
  makeReplayStepper,
  solveDistanceConstraint,
  complianceAlpha,
  resolveSimTier,
  tierPick,
  shash,
} from './_sim-core';

// ── Fixed build-time allocation (a live `links` control clamps to this) ──────
const MAX_BEADS = 14; // up to 14 beads; default ~10
const DT = 1 / 60; // outer fixed step
const ANCHOR_Y = 1.05; // pin height (top of the tile); chain hangs below
const REACH = 0.9; // pointer.x offset → anchor horizontal travel (world units)
const TAU = Math.PI * 2;
const HIDDEN = 9999; // park unused beads far off-screen
// Gauss-Seidel constraint iterations per substep. A real chain is nearly
// INEXTENSIBLE — a single pass per substep lets soft links over-stretch under
// strong gravity (the strand would shoot out of frame). A few fixed-order passes
// hold the chain together while `stiffness` still governs how much it sags/lags
// (the compliance term differs per pass). Deterministic (fixed ordering).
const CONSTRAINT_ITERS = 4;
// Hard envelope: solved beads are clamped into the tile so no control extreme
// can ever push the strand off-screen (the camera frames roughly x,y∈[−1.4,1.4]).
const ENV = 1.35;

// Observatory-Brass + steel palette (NO purple).
const BRASS = '#d9a86c';
const BRASS_DEEP = '#8f6f3e';
const STEEL = '#cfdde6';

const SCHEMA = [
  { id: 'links', label: 'Links', type: 'knob', min: 5, max: 14, step: 1, default: 10 },
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 3, max: 16, step: 0.5, default: 9, unit: 'm/s²' },
  { id: 'damping', label: 'Damping', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.18 },
  { id: 'stiffness', label: 'Link Stiffness', type: 'fader', min: 0.1, max: 1, step: 0.01, default: 0.85 },
  { id: 'beadSize', label: 'Bead Size', type: 'fader', min: 0.4, max: 1.4, step: 0.02, default: 1 },
] as const;

export const chainDanglePrimitive: PrimitiveDefinition = {
  name: 'chain-dangle',
  label: 'Chain Dangle',
  category: 'pointer',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'pointer',
  description:
    'A hanging chain of discrete brass beads linked by real distance constraints, the top pinned to the cursor and the strand swinging under gravity with genuine bead-to-bead coupling — physics, not an easing curve.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'chain-dangle', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const tier = resolveSimTier(target);
      // Heavy multi-body solve → coarser substeps on T0 so it degrades gracefully;
      // absolute cost is modest at every tier (≤14 beads, ≤8 substeps).
      const SUBSTEPS = tierPick(tier, { T0: 4, T1: 6, T2: 8 });

      // ── Particle state (flat arrays, fixed MAX allocation, never realloc) ────
      const px = new Float32Array(MAX_BEADS);
      const py = new Float32Array(MAX_BEADS);
      const pz = new Float32Array(MAX_BEADS);
      const pvx = new Float32Array(MAX_BEADS);
      const pvy = new Float32Array(MAX_BEADS);
      const pvz = new Float32Array(MAX_BEADS);
      const invMass = new Float32Array(MAX_BEADS);
      const prevX = new Float32Array(MAX_BEADS);
      const prevY = new Float32Array(MAX_BEADS);
      const prevZ = new Float32Array(MAX_BEADS);

      // The active bead count + the per-link rest length (set on (re)build).
      let beadCount = -1;
      let restLink = 0.16;

      /** Live link count, clamped to [5, MAX_BEADS]. */
      const liveLinks = (): number =>
        Math.round(clamp(num(params.links, 10), 5, MAX_BEADS));

      /** Live anchor world position: center x + pointer offset + ambient sway.
       *  Pointer enters as a STEADY additive offset (the rig pins it during a
       *  control sweep), and a deterministic sway keeps the chain perpetually in
       *  motion so the ~0.45 frozen phase lands mid-swing. */
      const anchorAt = (simT: number): { x: number; y: number; z: number } => {
        const p = (target.userData as { pointer?: { x?: unknown } }).pointer;
        const pxn =
          p && typeof p.x === 'number' && Number.isFinite(p.x) ? clamp(p.x, 0, 1) : 0.5;
        // Deterministic ambient horizontal sway (pure fn of simT, no Math.random):
        // two incommensurate sines, brisk enough that the lower beads visibly LAG
        // the anchor mid-sweep (the engaged "chain trailing" pose) yet bounded so
        // the strand stays in-frame. The anchor never sits still → a paused frame
        // is always mid-swing.
        const sway =
          0.6 * Math.sin((TAU * simT) / 1.15) + 0.28 * Math.sin((TAU * simT) / 0.53 + 1.1);
        const ax = (pxn - 0.5) * 2 * (REACH * 0.5) + sway * REACH * 0.6;
        return { x: ax, y: ANCHOR_Y, z: 0 };
      };

      /** (Re)build the chain for N beads: seat them in a slightly-curved resting
       *  hang below the anchor (deterministic micro-jitter via hash so the very
       *  first frame already reads as a dangling strand, never a dead vertical
       *  line), pin the top bead, zero velocities, set the rest link length. */
      const buildChain = (n: number): void => {
        beadCount = n;
        // Rest hang spans ~from ANCHOR_Y down to about y = −0.8 → fit the link gap.
        const span = 1.85;
        restLink = span / (n - 1);
        const a = anchorAt(0);
        for (let i = 0; i < n; i++) {
          // Initial pose: hang straight down from the anchor, with a tiny
          // deterministic lateral bias per bead so coupling has something to
          // resolve (a clean physical settle, not a frozen plumb line).
          px[i] = a.x + shash(i * 1.7 + 0.3) * 0.02 * i;
          py[i] = a.y - restLink * i;
          pz[i] = shash(i * 2.9 + 0.7) * 0.015;
          pvx[i] = 0;
          pvy[i] = 0;
          pvz[i] = 0;
          invMass[i] = i === 0 ? 0 : 1; // bead 0 pinned to the anchor
        }
        for (let i = n; i < MAX_BEADS; i++) {
          invMass[i] = 0;
          pvx[i] = pvy[i] = pvz[i] = 0;
        }
      };

      /** One outer fixed step: SUBSTEPS substeps of XPBD. Reads gravity/damping/
       *  stiffness LIVE so control changes apply on the next replay (no rebuild). */
      const step = (dt: number): void => {
        const n = beadCount;
        const g = clamp(num(params.gravity, 11), 3, 22);
        const damp = clamp(num(params.damping, 0.18), 0, 1);
        const stiff = clamp(num(params.stiffness, 0.85), 0.1, 1);
        const dtSub = dt / SUBSTEPS;
        const alphaTilde = complianceAlpha(stiff, dtSub);
        // Linear velocity drag per substep (frame-rate-normalized so the control
        // reads consistently regardless of substep count).
        const dragMul = Math.exp(-(0.5 + damp * 6) * dtSub);

        // Use the END-of-outer-step anchor time so the pin tracks the live sweep.
        const aEnd = anchorAt(stepper.now() + dt);

        for (let s = 0; s < SUBSTEPS; s++) {
          // (1) save prev, integrate velocity (gravity + drag), predict positions.
          for (let i = 0; i < n; i++) {
            prevX[i] = px[i];
            prevY[i] = py[i];
            prevZ[i] = pz[i];
            if (invMass[i] === 0) continue; // pinned bead set below
            pvx[i] *= dragMul;
            pvy[i] = pvy[i] * dragMul - g * dtSub;
            pvz[i] *= dragMul;
            px[i] += pvx[i] * dtSub;
            py[i] += pvy[i] * dtSub;
            pz[i] += pvz[i] * dtSub;
          }
          // Hard-pin the top bead onto the live anchor (invMass 0 → never moved by
          // the solver, so this is the single source of its position).
          px[0] = aEnd.x;
          py[0] = aEnd.y;
          pz[0] = aEnd.z;

          // (2) solve every distance constraint in fixed index order. A few
          // Gauss-Seidel passes per substep keep the chain nearly inextensible
          // (a real chain) while `stiffness` still tunes the residual sag/lag.
          for (let it = 0; it < CONSTRAINT_ITERS; it++) {
            for (let i = 0; i < n - 1; i++) {
              solveDistanceConstraint(px, py, pz, invMass, i, i + 1, restLink, alphaTilde);
            }
          }

          // (3) velocity = (pos − prevPos)/dtSub for the free beads. Bead
          // positions are clamped into the tile envelope so no control extreme
          // can fling the strand off-screen; the velocity reflects the clamp.
          const inv = 1 / dtSub;
          for (let i = 1; i < n; i++) {
            px[i] = clamp(px[i], -ENV, ENV);
            py[i] = clamp(py[i], -ENV, ENV);
            pz[i] = clamp(pz[i], -0.6, 0.6);
            pvx[i] = (px[i] - prevX[i]) * inv;
            pvy[i] = (py[i] - prevY[i]) * inv;
            pvz[i] = (pz[i] - prevZ[i]) * inv;
          }
        }
      };

      const reset = (): void => {
        buildChain(liveLinks());
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      // ── Visual: one Group of brass sphere bead meshes (built ONCE, max count) ─
      const group = new Group();
      group.name = 'chain-dangle';
      const beadGeo = new SphereGeometry(1, 18, 14); // unit sphere; scaled per bead
      const beads: Mesh[] = [];
      for (let i = 0; i < MAX_BEADS; i++) {
        // Brass head bead, steel-tinted lower beads → a readable metal strand
        // (gradient along the chain, never a flat fill).
        const mix = i / (MAX_BEADS - 1);
        const col = new Color(BRASS).lerp(new Color(STEEL), mix * 0.55);
        const mat = new MeshStandardMaterial({
          color: col,
          emissive: new Color(BRASS_DEEP),
          emissiveIntensity: i === 0 ? 0.4 : 0.18,
          roughness: 0.28,
          metalness: 0.72,
          envMapIntensity: 1.15,
        });
        const m = new Mesh(beadGeo, mat);
        m.name = `chain-bead-${i}`;
        beads.push(m);
        group.add(m);
      }
      target.object.add(group);

      /** Copy solved particle positions → bead meshes; read `beadSize` LIVE so
       *  even a no-markDirty same-t reseek shows a control change. Unused beads
       *  parked far off-screen. */
      const write = (): void => {
        const n = beadCount > 0 ? beadCount : liveLinks();
        const sizeK = clamp(num(params.beadSize, 1), 0.4, 1.4);
        // Bead radius scales with the link gap so a long chain has proportionate
        // beads (never overlapping spheres); slightly larger at the brass tip.
        const baseR = restLink * 0.42 * sizeK;
        for (let i = 0; i < n; i++) {
          const m = beads[i];
          m.visible = true;
          m.position.set(px[i], py[i], pz[i]);
          const r = baseR * (i === 0 ? 1.18 : 1) * (1 - (i / (n + 6)) * 0.18);
          m.scale.setScalar(Math.max(r, 1e-3));
        }
        for (let i = n; i < MAX_BEADS; i++) {
          beads[i].visible = false;
          beads[i].position.set(HIDDEN, HIDDEN, 0);
        }
      };

      reset();
      write();

      return {
        // Purely stateful chain (pointer + ambient driven) — never "ends".
        duration: () => Infinity,
        seek: (t) => {
          // A live link-count change restructures the chain: rebuild on next replay.
          if (liveLinks() !== beadCount) stepper.markDirty();
          stepper.seekStep(t);
          write();
        },
        // NON-NEGOTIABLE: trajectory-only controls (gravity/damping/stiffness) must
        // reshape the FROZEN pinned frame, so the rig's paused same-t reseek re-runs
        // the sim to that t and the frame visibly changes.
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          target.object.remove(group);
          beadGeo.dispose();
          for (const m of beads) (m.material as MeshStandardMaterial).dispose();
        },
      };
    },
  ),
};
