// newton-cradle — a real Newton's cradle: ~5 polished steel balls hang in a row
// from thin suspension wires off a top rail. The end ball is released from an
// angle, swings down as a pendulum under genuine gravity, and on contact the
// momentum propagates through the touching at-rest balls so the FAR ball kicks
// out — equal-mass elastic collision down the chain, repeating as it swings back.
// CATALOG primitive (hard / transform, subject:'empty', time-driven).
//
// GENUINE SIMULATION, not an easing curve. Each ball is an independent rigid
// pendulum: angle θ_i about a fixed pivot on the rail, integrated with the real
// nonlinear pendulum law θ'' = -(g/L)·sin θ via semi-implicit (symplectic) Euler
// at a fixed small dt. Collisions are resolved geometrically: adjacent bobs that
// overlap while approaching exchange angular velocity with an equal-mass elastic
// impulse (scaled by restitution). That single local rule, applied left→right
// each step, reproduces the whole Newton's-cradle behaviour — a clean impulse
// races through the dead middle balls and ejects the opposite end; energy bleeds
// out via restitution<1 so the swing decays, exactly like the real toy.
//
// DETERMINISM — no Math.random / Date.now. The only "seed" is the release side
// (the left ball, deterministic). makeReplayStepper resets-and-replays on rewind,
// so the frame at time t is a pure function of (params, t): every control —
// count, swingAngle, restitution, gravity — visibly changes any frozen frame the
// verification harness pins (onParamChange → markDirty re-runs the sim to the
// SAME t while paused).
//
// duration() is finite (a couple of full swing cycles); the rig loops t→0 which
// the stepper treats as a rewind → the cradle re-launches. The ~0.45 frozen
// phase is tuned to land with ONE END BALL SWUNG OUT MID-ARC (engaged frame).

import {
  Group,
  Mesh,
  SphereGeometry,
  CylinderGeometry,
  BufferGeometry,
  BufferAttribute,
  Color,
} from 'three';
import {
  MeshStandardNodeMaterial,
  MeshBasicNodeMaterial,
} from 'three/webgpu';
import { defineAnimatable } from '../base';
import { num, str, type PrimitiveDefinition } from '../contract';
import { makeReplayStepper, clamp, resolveSimTier, tierPick } from './_sim-core';

// ── Geometry constants (tuned to the catalog rig: cam z≈3.2, FOV 40) ─────────
const MAX_BALLS = 7; // fixed build-time allocation; live count clamps to this
const BALL_R = 0.16; // bob radius (world units)
const STRING_L = 1.05; // pendulum length (pivot → bob centre)
const RAIL_Y = 0.95; // top rail height (pivots sit just under it)
const DT = 1 / 240; // stiff contact → small fixed step
const HIDDEN = 9999; // park unused balls far off-screen

const SCHEMA = [
  // Structural: how many balls hang in the row. Re-pins at the frozen frame.
  { id: 'count', label: 'Balls', type: 'knob', min: 3, max: MAX_BALLS, step: 1, default: 5 },
  // Release angle of the end ball (degrees from vertical). Drives the whole
  // energy budget — bigger angle = faster strike = farther kick-out.
  { id: 'swingAngle', label: 'Release Angle', type: 'knob', min: 18, max: 64, step: 1, default: 42, unit: '°' },
  // Collision elasticity. 1 = lossless (eternal), <1 bleeds energy each strike
  // so the swing visibly decays — trajectory-only control, live at the pin.
  { id: 'restitution', label: 'Restitution', type: 'fader', min: 0.7, max: 1, step: 0.01, default: 0.97 },
  // Gravity. Sets the swing tempo (period ∝ 1/√g): at a pinned t a heavier g
  // has carried the swing further → a different standing pose on the frozen frame.
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 4, max: 22, step: 0.5, default: 11 },
  { id: 'ballColor', label: 'Ball', type: 'color', default: '#cfdde6' }, // steel
  { id: 'accentColor', label: 'Wire', type: 'color', default: '#d9a86c' }, // brass rail/wires
] as const;

export const newtonCradlePrimitive: PrimitiveDefinition = {
  name: 'newton-cradle',
  label: "Newton's Cradle",
  category: 'transform',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    "A real Newton's cradle: the end ball swings in under gravity and the far ball kicks out as momentum races through the touching balls — elastic collision physics, not an easing curve.",
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'newton-cradle', category: 'transform', schema: SCHEMA },
    (target, params) => {
      // Heavier sphere tessellation only at full tier; cheap on T0.
      const tier = resolveSimTier(target);
      const seg = tierPick(tier, { T0: 12, T1: 18, T2: 28 });

      // ── Build the scene group: rail + per-ball (wire + bob) ────────────────
      const group = new Group();
      group.name = 'newton-cradle';

      // Pivot X positions: a centred row spaced by one ball diameter so the bobs
      // just touch at rest. Computed for MAX_BALLS; the live count uses a centred
      // sub-row (recomputed in write()).
      const pivotX = new Float32Array(MAX_BALLS);

      // Top rail (a slim brass bar spanning the whole row).
      const railGeo = new CylinderGeometry(0.02, 0.02, MAX_BALLS * BALL_R * 2 + 0.4, 8);
      railGeo.rotateZ(Math.PI / 2); // lie horizontal along X
      const railMat = new MeshStandardNodeMaterial({ roughness: 0.35, metalness: 0.85 });
      const rail = new Mesh(railGeo, railMat);
      rail.position.set(0, RAIL_Y, 0);
      rail.name = 'cradle-rail';
      group.add(rail);

      // Per-ball bobs (lit steel spheres) + suspension wires (thin lines).
      const ballGeo = new SphereGeometry(BALL_R, seg, Math.max(8, seg >> 1));
      const ballMats: MeshStandardNodeMaterial[] = [];
      const balls: Mesh[] = [];
      const wireMats: MeshBasicNodeMaterial[] = [];
      const wires: Mesh[] = [];
      // Reusable wire geometry: a unit segment along +Y from the pivot, scaled &
      // rotated per frame to span pivot→bob (a 2-vertex line drawn as a thin quad
      // would need instancing; a simple thin cylinder reads as a taut wire and is
      // cheap at 7 of them).
      const wireGeo = new CylinderGeometry(0.004, 0.004, 1, 5, 1, true);
      wireGeo.translate(0, -0.5, 0); // origin at the TOP end → scales downward

      for (let i = 0; i < MAX_BALLS; i++) {
        const bm = new MeshStandardNodeMaterial({ roughness: 0.22, metalness: 0.92 });
        const ball = new Mesh(ballGeo, bm);
        ball.name = `cradle-ball-${i}`;
        ballMats.push(bm);
        balls.push(ball);
        group.add(ball);

        const wm = new MeshBasicNodeMaterial({ transparent: true, opacity: 0.85 });
        const wire = new Mesh(wireGeo, wm);
        wire.name = `cradle-wire-${i}`;
        wireMats.push(wm);
        wires.push(wire);
        group.add(wire);
      }
      target.object.add(group);

      // ── Simulation state: one pendulum per ball ────────────────────────────
      // theta[i] = angular displacement from vertical (rad). omega[i] = angular
      // velocity (rad/s). Balls swing in the X–Y plane (about Z at each pivot).
      const theta = new Float32Array(MAX_BALLS);
      const omega = new Float32Array(MAX_BALLS);

      // Live colour caches (avoid per-frame Color churn).
      const ballC = new Color();
      const accentC = new Color();
      let lastBall = '';
      let lastAccent = '';

      // The angle at which two adjacent bobs are exactly touching when both hang.
      // Pivots are spaced 2R apart, strings equal → at theta=0 the bobs touch;
      // any non-zero theta opens a gap on that side. Collision happens as a bob
      // returns toward 0 and meets its neighbour. We resolve by GEOMETRY: the
      // horizontal bob position is pivotX + L·sinθ; bobs i,i+1 collide when their
      // separation < 2R while they are approaching.

      const reset = () => {
        for (let i = 0; i < MAX_BALLS; i++) {
          theta[i] = 0;
          omega[i] = 0;
        }
        // Release the LEFT end ball from swingAngle (negative = pulled out left).
        const releaseRad = (clamp(num(params.swingAngle, 42), 18, 64) * Math.PI) / 180;
        theta[0] = -releaseRad;
        omega[0] = 0;
      };

      const step = (dt: number) => {
        const g = clamp(num(params.gravity, 11), 4, 22);
        const rest = clamp(num(params.restitution, 0.97), 0.7, 1);
        const count = Math.max(3, Math.min(MAX_BALLS, Math.round(num(params.count, 5))));
        const k = g / STRING_L;

        // 1) Integrate every active pendulum (semi-implicit / symplectic Euler:
        //    advance ω with the restoring torque, then θ with the new ω).
        for (let i = 0; i < count; i++) {
          omega[i] += -k * Math.sin(theta[i]) * dt;
          theta[i] += omega[i] * dt;
        }

        // 2) Resolve adjacent-bob collisions left→right. Equal-mass elastic
        //    collision exchanges the velocity COMPONENTS — for two identical
        //    pendulums whose contact normal is ~horizontal at the bottom, the
        //    clean Newton's-cradle result is a swap of angular velocity, damped
        //    by restitution. One left→right Gauss–Seidel pass per step
        //    propagates a strike through the resting middle balls in a single
        //    step's worth of swaps, so the impulse reaches the far ball.
        for (let i = 0; i < count - 1; i++) {
          // Horizontal bob centres.
          const xi = pivotX[i] + STRING_L * Math.sin(theta[i]);
          const xj = pivotX[i + 1] + STRING_L * Math.sin(theta[i + 1]);
          const sep = xj - xi; // >0 normally (j is to the right)
          if (sep < 2 * BALL_R - 1e-4) {
            // Approaching? left bob moving right faster than right bob, OR right
            // bob moving left into the left bob. Relative horizontal velocity.
            const vi = STRING_L * Math.cos(theta[i]) * omega[i];
            const vj = STRING_L * Math.cos(theta[i + 1]) * omega[i + 1];
            const vrel = vj - vi; // closing when negative
            if (vrel < 0) {
              // Equal-mass elastic swap of angular velocity, scaled by restitution.
              // (cosθ≈1 near the bottom where strikes occur, so swapping ω is the
              // correct equal-mass exchange; restitution<1 bleeds the energy.)
              const a = omega[i];
              const b = omega[i + 1];
              omega[i] = b * rest;
              omega[i + 1] = a * rest;
            }
            // Positional de-penetration: push the pair apart along the contact so
            // they never tunnel/stick (split the overlap as equal angle nudges).
            const overlap = 2 * BALL_R - sep;
            const dThetaI = -overlap * 0.5 / (STRING_L * Math.max(0.2, Math.cos(theta[i])));
            const dThetaJ = overlap * 0.5 / (STRING_L * Math.max(0.2, Math.cos(theta[i + 1])));
            theta[i] += dThetaI;
            theta[i + 1] += dThetaJ;
          }
        }
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      const write = () => {
        const count = Math.max(3, Math.min(MAX_BALLS, Math.round(num(params.count, 5))));
        // Live colours read in write() (so even a same-t reseek shows the change).
        const ballHex = str(params.ballColor, '#cfdde6');
        const accentHex = str(params.accentColor, '#d9a86c');
        if (ballHex !== lastBall) {
          ballC.set(ballHex);
          lastBall = ballHex;
        }
        if (accentHex !== lastAccent) {
          accentC.set(accentHex);
          lastAccent = accentHex;
        }
        railMat.color.copy(accentC);

        // Centre the live row: pivots span (count-1)*2R, centred on x=0.
        const rowSpan = (count - 1) * BALL_R * 2;
        for (let i = 0; i < count; i++) {
          pivotX[i] = -rowSpan / 2 + i * BALL_R * 2;
        }

        for (let i = 0; i < MAX_BALLS; i++) {
          if (i < count) {
            const px = pivotX[i];
            // Bob world position from its pendulum angle.
            const bx = px + STRING_L * Math.sin(theta[i]);
            const by = RAIL_Y - STRING_L * Math.cos(theta[i]);
            balls[i].position.set(bx, by, 0);
            balls[i].visible = true;
            ballMats[i].color.copy(ballC);
            // Faint brass-warm emissive on the steel so the bobs read luminous
            // and premium even if the rig's key light is dim (cool steel + warm
            // sheen, NO purple).
            ballMats[i].emissive.copy(ballC).multiplyScalar(0.12);

            // Wire: from the pivot down to the bob. Origin of wireGeo is the TOP
            // (pivot); orient along the pivot→bob direction, scale to its length.
            wires[i].position.set(px, RAIL_Y, 0);
            wires[i].rotation.z = theta[i]; // wire tilts with the swing
            wires[i].scale.set(1, STRING_L, 1);
            wires[i].visible = true;
            wireMats[i].color.copy(accentC);
          } else {
            // Park unused balls/wires far off-screen (deterministic & hidden).
            balls[i].position.set(HIDDEN, HIDDEN, 0);
            balls[i].visible = false;
            wires[i].position.set(HIDDEN, HIDDEN, 0);
            wires[i].visible = false;
          }
        }
      };

      reset();
      write();

      return {
        // A couple of full swing cycles so the loop shows the strike→kick→return
        // rhythm. Period grows as gravity drops / length is fixed: keep bounded.
        duration: () => {
          const g = clamp(num(params.gravity, 11), 4, 22);
          const period = 2 * Math.PI * Math.sqrt(STRING_L / g); // small-angle ref
          return clamp(period * 4, 3, 7);
        },
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Any control sweep re-runs the sim to the same pinned frame → the frozen
        // frame visibly changes (gravity/restitution/angle are trajectory-only;
        // markDirty makes them standing functions of the engaged pose).
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          target.object.remove(group);
          railGeo.dispose();
          railMat.dispose();
          ballGeo.dispose();
          wireGeo.dispose();
          for (const m of ballMats) m.dispose();
          for (const m of wireMats) m.dispose();
        },
      };
    },
  ),
};
