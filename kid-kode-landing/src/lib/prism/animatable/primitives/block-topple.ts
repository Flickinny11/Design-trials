// block-topple — a small tower of stacked rigid blocks (BoxGeometry meshes) is
// hit by a horizontal impulse at the top; the stack TOPPLES and scatters under
// gravity, each block tumbling and bouncing off the floor with restitution.
// CATALOG primitive (hard / transform, subject:'empty').
//
// Genuine rigid-body simulation, NOT an easing curve. Each block is a real 2D
// rigid body with full state (x, y, angle, vx, vy, omega) and a box inertia.
// Per fixed step we integrate gravity (semi-implicit / symplectic Euler), then
// resolve floor contact at the box's four CORNERS: a corner below the floor gets
// a positional push-out plus a normal impulse with restitution applied at its
// lever arm from the centre of mass — so an off-centre hit produces real torque
// and the block TUMBLES (omega changes), exactly like a toppling brick. The top
// block is launched by the horizontal impulse; because the tower starts in
// contact, the impulse is propagated DOWN the stack at seed time (deterministic
// momentum transfer, top blocks get the most), so the whole stack leans, breaks
// apart and scatters rather than a single block flying off.
//
// Determinism: the only "randomness" is deterministic index hashes (no
// Math.random / Date.now). The replay stepper resets-and-replays on backward
// seek, so the frame at time t is a pure function of (params, t) — every
// control (blocks / impulse / gravity / bounciness) visibly changes any frozen
// frame the verification harness pins. duration() is finite (the settle time);
// the rig loops t→0, which the stepper treats as a rewind → the tower restacks.
// The ~0.45 frozen phase lands MID-TOPPLE, where every control reads.

import {
  Group,
  Mesh,
  BoxGeometry,
  MeshStandardMaterial,
  Color,
  type Material,
} from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';
import { hash1, makeReplayStepper, resolveSimTier, tierPick } from './_sim-core';

const DT = 1 / 120; // stiff contact → small step
const MAX_BLOCKS = 8; // fixed build-time allocation; live `blocks` clamps to this
const FLOOR_Y = -0.95; // floor plane (block CENTRES rest a half-height above it)
const BW = 0.46; // block width  (x)
const BH = 0.3; // block height (y)
const BD = 0.46; // block depth  (z) — visual only, sim is 2D in x/y
const HALF_W = BW / 2;
const HALF_H = BH / 2;
// Moment of inertia of a thin rectangular plate about its centre (mass = 1):
// I = (w² + h²) / 12. invInertia = 1/I.
const INV_INERTIA = 12 / (BW * BW + BH * BH);

// Brass / ice / steel — alternating tones up the tower (NO purple).
const FACE_TONES = ['#ecd49d', '#cfdde6', '#d9a86c', '#9fe0c4', '#7fd4ff'];

const SCHEMA = [
  { id: 'blocks', label: 'Blocks', type: 'knob', min: 3, max: 8, step: 1, default: 5 },
  { id: 'impulse', label: 'Hit Impulse', type: 'knob', min: 1, max: 5, step: 0.1, default: 2.6 },
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 3, max: 18, step: 0.5, default: 11 },
  { id: 'bounciness', label: 'Bounciness', type: 'fader', min: 0.05, max: 0.7, step: 0.01, default: 0.32 },
] as const;

export const blockTopplePrimitive: PrimitiveDefinition = {
  name: 'block-topple',
  label: 'Block Topple',
  category: 'transform',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A stacked tower of rigid blocks is hit by a horizontal impulse and topples, the blocks tumbling and bouncing off the floor under gravity — real per-block rigid physics, not an easing curve.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'block-topple', category: 'transform', schema: SCHEMA },
    (target, params) => {
      // HEAVY-ish: substeps cost on tier. T2 (catalog default) = full fidelity.
      const tier = resolveSimTier(target);
      const SUBSTEPS = tierPick(tier, { T0: 1, T1: 2, T2: 3 });

      // ── Live rigid-body state (closure-held flat arrays) ──────────────────
      const x = new Float32Array(MAX_BLOCKS);
      const y = new Float32Array(MAX_BLOCKS);
      const ang = new Float32Array(MAX_BLOCKS);
      const vx = new Float32Array(MAX_BLOCKS);
      const vy = new Float32Array(MAX_BLOCKS);
      const omega = new Float32Array(MAX_BLOCKS);

      // The resting tower y for block i (centre height): i-th block stacked on
      // the floor. Block 0 sits at FLOOR_Y + HALF_H, each above by BH.
      const restY = (i: number) => FLOOR_Y + HALF_H + i * BH;

      const reset = () => {
        const impulse = num(params.impulse, 5);
        const n = Math.max(1, Math.min(MAX_BLOCKS, Math.round(num(params.blocks, 5))));
        for (let i = 0; i < MAX_BLOCKS; i++) {
          // Deterministic micro-jitter on the resting stack so the topple has a
          // little organic lean (seeded, never random).
          const jx = (hash1(i * 2.17 + 0.3) * 2 - 1) * 0.012;
          x[i] = jx;
          y[i] = restY(i);
          ang[i] = (hash1(i * 3.71 + 1.1) * 2 - 1) * 0.02;
          // Horizontal impulse propagated DOWN the stack: the top block takes the
          // full hit; lower blocks take a deterministically decaying share, so the
          // tower leans and breaks apart from the top. A touch of upward + spin so
          // the launched blocks visibly tumble off the stack.
          const fromTop = n - 1 - i; // 0 at top
          const share = i < n ? Math.pow(0.55, fromTop) : 0; // 1, .55, .30, …
          vx[i] = impulse * share;
          vy[i] = impulse * share * 0.12; // slight lift off the stack
          omega[i] = -impulse * share * 1.1; // topple-forward spin (tumble)
        }
      };

      // One fixed integration step (split into SUBSTEPS for stable contact).
      const step = (dt: number) => {
        const g = num(params.gravity, 10);
        const rest = clamp(num(params.bounciness, 0.32), 0.05, 0.7);
        const n = Math.max(1, Math.min(MAX_BLOCKS, Math.round(num(params.blocks, 5))));
        const sdt = dt / SUBSTEPS;

        for (let s = 0; s < SUBSTEPS; s++) {
          for (let i = 0; i < n; i++) {
            // Integrate (semi-implicit Euler): a→v→x.
            vy[i] -= g * sdt;
            x[i] += vx[i] * sdt;
            y[i] += vy[i] * sdt;
            ang[i] += omega[i] * sdt;

            // ── Floor contact at the four box corners ──────────────────────
            // For each corner below FLOOR_Y, push it out and apply a normal
            // impulse with restitution at its lever arm → linear + angular
            // response (real tumbling). Resolve corners in fixed order.
            const ca = Math.cos(ang[i]);
            const sa = Math.sin(ang[i]);
            for (let c = 0; c < 4; c++) {
              // Corner local offsets (±HALF_W, ±HALF_H).
              const lx = c & 1 ? HALF_W : -HALF_W;
              const ly = c & 2 ? HALF_H : -HALF_H;
              // World corner position.
              const wx = lx * ca - ly * sa; // relative to centre
              const wy = lx * sa + ly * ca;
              const cornerY = y[i] + wy;
              if (cornerY >= FLOOR_Y) continue;

              const pen = FLOOR_Y - cornerY; // positive penetration
              // Positional correction: lift the whole body so the corner sits on
              // the floor (Baumgarte-free, full push-out — stable for a tile).
              y[i] += pen;

              // Velocity of the contact point: v_p = v + omega × r (2D).
              // r = (wx, wy); omega is scalar about z.
              const vpy = vy[i] + omega[i] * wx; // y-component of point velocity
              if (vpy >= 0) continue; // separating → no impulse

              // Normal n = (0, 1). Effective mass along n:
              // 1/m + (r×n)² * invI ; r×n (z) = wx*1 - wy*0 = wx.
              const rn = wx;
              const effInvMass = 1 + rn * rn * INV_INERTIA;
              const jImp = (-(1 + rest) * vpy) / effInvMass;
              // Apply impulse jn = (0, jImp) at r.
              vy[i] += jImp;
              omega[i] += rn * jImp * INV_INERTIA;

              // Tangential friction: damp the contact-point x velocity so a
              // landed block grinds to a stop instead of skating forever.
              const vpx = vx[i] - omega[i] * wy;
              const friction = 0.35;
              const dvx = -vpx * friction;
              vx[i] += dvx;
              omega[i] -= wy * dvx * INV_INERTIA;
            }

            // Gentle global angular + horizontal damping (air/contact losses) so
            // the scatter SETTLES into a finite duration rather than spinning on.
            omega[i] *= 1 - 0.4 * sdt;
            vx[i] *= 1 - 0.9 * sdt; // strong horizontal drag → blocks stay in frame

            // Soft containment: a spring pulling stray blocks back toward the
            // visible envelope (|x| ≲ 1.4) so a hard hit tumbles in-frame instead
            // of launching off-screen. Deterministic, only acts past the wall.
            const WALL = 1.35;
            if (x[i] > WALL) vx[i] -= (x[i] - WALL) * 9 * sdt;
            else if (x[i] < -WALL) vx[i] -= (x[i] + WALL) * 9 * sdt;
          }
        }
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      // ── Geometry: MAX_BLOCKS box meshes built once into target.object ─────
      const group = new Group();
      group.name = 'block-topple';
      const meshes: Mesh[] = [];
      const geos: BoxGeometry[] = [];
      const mats: MeshStandardMaterial[] = [];
      for (let i = 0; i < MAX_BLOCKS; i++) {
        const geo = new BoxGeometry(BW, BH, BD);
        const tone = FACE_TONES[i % FACE_TONES.length];
        const mat = new MeshStandardMaterial({
          color: new Color(tone),
          emissive: new Color(tone),
          emissiveIntensity: 0.18,
          roughness: 0.45,
          metalness: 0.55,
        });
        const mesh = new Mesh(geo, mat);
        mesh.name = `block-${i}`;
        group.add(mesh);
        meshes.push(mesh);
        geos.push(geo);
        mats.push(mat);
      }
      target.object.add(group);

      const HIDDEN = 9999; // park unused blocks far off-screen

      const write = () => {
        // LIVE reads in write(): block count clamps visible meshes here, and the
        // bounciness tints emissive a touch so even a same-t reseek shows the
        // control. (markDirty handles trajectory-only controls; this is belt-and-
        // braces per the guide's "at least one control read live in write()".)
        const n = Math.max(1, Math.min(MAX_BLOCKS, Math.round(num(params.blocks, 5))));
        const rest = clamp(num(params.bounciness, 0.32), 0.05, 0.7);
        for (let i = 0; i < MAX_BLOCKS; i++) {
          const m = meshes[i];
          if (i < n) {
            m.visible = true;
            m.position.set(x[i], y[i], 0);
            m.rotation.z = ang[i];
            mats[i].emissiveIntensity = 0.12 + rest * 0.3;
          } else {
            m.visible = false;
            m.position.set(HIDDEN, HIDDEN, 0);
          }
        }
      };

      reset();
      write();

      return {
        // Settle window: the active topple resolves in ~0.8s of sim time, so the
        // loop is short and lively. Tuned so the rig's ~0.45·duration frozen pin
        // lands MID-TOPPLE (blocks rotating ~50–80°, some still airborne). Lower
        // gravity and bouncier floors keep blocks tumbling longer → a touch more.
        duration: () => {
          const g = num(params.gravity, 11);
          const rest = clamp(num(params.bounciness, 0.32), 0.05, 0.7);
          return clamp(1.0 + (12 - g) * 0.03 + rest * 0.5, 0.85, 1.6);
        },
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Non-negotiable: re-runs the sim to the same pinned frame so every
        // trajectory-only control (gravity / impulse) visibly changes the frozen
        // frame when the advocate sweeps it while paused.
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          target.object.remove(group);
          for (let i = 0; i < MAX_BLOCKS; i++) {
            geos[i].dispose();
            (mats[i] as Material).dispose();
          }
        },
      };
    },
  ),
};
