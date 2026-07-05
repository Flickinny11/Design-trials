// spark-shower — a welding-style shower of hot sparks sprays out, bounces off
// an unseen floor, and cools from white through yellow to red as each spark
// dies. CATALOG primitive (hard / particles, subject:'empty'). Builds a
// THREE.Points into target.object: a fixed pool of sparks, each with a
// deterministic staggered emit time, a hashed cone velocity, and a finite life.
// Per cycle, a spark's age `localT` drives closed-form ballistic integration
// with gravity and an analytic floor-bounce (reflect vy*restitution at y=floor),
// while a per-spark vertex color cools white->yellow->red and size/opacity fade
// over its life. All per-spark randomness derives from an index hash — never
// Math.random — so seek() is pure, looping, and reproducible across rebuilds.
//
// DISTINCT from `sparks`: this version bounces off a floor and color-cools like
// real welding spatter (sparks does neither).

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

// Fixed pool so the geometry never reallocates. Live `rate` selects how many of
// the pool are emitting; unused sparks are parked far out of view.
const POOL = 480;
const ORIGIN_X = 0; // weld point
const ORIGIN_Y = 0.35;
const FLOOR_Y = -1.25; // the unseen floor sparks bounce off
const LIFE = 1.4; // seconds a spark lives before respawning
const SPEED = 3.2; // base ejection speed
const GRAVITY = 5.0; // base gravity (control-scaled)

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

const SCHEMA = [
  // Emission rate: fraction of the pool that is actively spraying.
  { id: 'rate', label: 'Rate', type: 'knob', min: 40, max: 480, step: 1, default: 300 },
  // Downward acceleration on the sparks.
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 0.2, max: 3, step: 0.05, default: 1 },
  // Floor bounciness: 0.2 (dead) .. 0.8 (lively).
  { id: 'restitution', label: 'Bounce', type: 'fader', min: 0.2, max: 0.8, step: 0.01, default: 0.5 },
  // Spread of the ejection cone.
  { id: 'spread', label: 'Spread', type: 'knob', min: 0.1, max: 1.4, step: 0.01, default: 0.7 },
  { id: 'size', label: 'Size', type: 'knob', min: 0.01, max: 0.1, step: 0.001, default: 0.045 },
] as const;

export const sparkShowerPrimitive: PrimitiveDefinition = {
  name: 'spark-shower',
  label: 'Spark Shower',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A welding-style shower of hot sparks sprays out, bouncing off an unseen floor and cooling from white to red as they die.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'spark-shower', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Per-spark deterministic constants, cached once.
      const emitOffset = new Float32Array(POOL); // phase offset into the life cycle, 0..1
      const dirX = new Float32Array(POOL); // unit-ish ejection direction
      const dirY = new Float32Array(POOL);
      const dirZ = new Float32Array(POOL);
      const speedMul = new Float32Array(POOL); // per-spark speed variance
      for (let i = 0; i < POOL; i++) {
        emitOffset[i] = hash1(i + 0.7);
        // Cone biased upward-and-out: azimuth around, elevation mostly up.
        const az = hash1(i * 2.13 + 1.9) * Math.PI * 2;
        const elev = 0.25 + hash1(i * 3.77 + 5.1) * 0.95; // radians up from horizontal-ish
        const horiz = Math.cos(elev);
        dirX[i] = Math.cos(az) * horiz;
        dirY[i] = Math.sin(elev) + 0.35; // bias upward
        dirZ[i] = Math.sin(az) * horiz;
        speedMul[i] = 0.6 + hash1(i * 5.31 + 9.2) * 0.9;
      }

      const positions = new Float32Array(POOL * 3);
      const colors = new Float32Array(POOL * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      const colAttr = new BufferAttribute(colors, 3);
      geometry.setAttribute('position', posAttr);
      geometry.setAttribute('color', colAttr);

      const material = new PointsMaterial({
        size: num(params.size, 0.045),
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'spark-shower';
      target.object.add(points);

      const HIDDEN_Y = FLOOR_Y - 1000; // park inactive sparks far out of view

      // Cooling palette: white -> yellow -> red over normalized life u in [0,1].
      const white = new Color('#fffdf2');
      const yellow = new Color('#ffd24a');
      const red = new Color('#ff2a12');
      const tmp = new Color();

      // Closed-form ballistic with a single analytic floor bounce. Returns the
      // y at age `age`, having bounced at most once. Spread across two bounces
      // would over-complicate; one bounce reads clearly as welding spatter.
      const integrate = (
        x0: number,
        y0: number,
        z0: number,
        vx: number,
        vy: number,
        vz: number,
        g: number,
        rest: number,
        age: number,
        out: [number, number, number],
      ): void => {
        // Pre-bounce parabola: y(t) = y0 + vy*t - 0.5*g*t^2.
        // Time to hit FLOOR_Y: solve 0.5*g*t^2 - vy*t + (y0 - FLOOR_Y) = 0.
        const a = 0.5 * g;
        const b = -vy;
        const c = y0 - FLOOR_Y;
        const disc = b * b - 4 * a * c;
        let tHit = Infinity;
        if (disc >= 0 && a > 0) {
          const sq = Math.sqrt(disc);
          const r1 = (-b - sq) / (2 * a);
          const r2 = (-b + sq) / (2 * a);
          // smallest strictly-positive root
          if (r1 > 1e-4) tHit = r1;
          else if (r2 > 1e-4) tHit = r2;
        }

        if (age < tHit) {
          out[0] = x0 + vx * age;
          out[1] = y0 + vy * age - 0.5 * g * age * age;
          out[2] = z0 + vz * age;
          return;
        }

        // At bounce: position on the floor, velocity reflected (vy*-rest),
        // horizontal velocities damped slightly by friction.
        const bx = x0 + vx * tHit;
        const bz = z0 + vz * tHit;
        const vyAtHit = vy - g * tHit; // negative (descending)
        const vy2 = -vyAtHit * rest; // upward after bounce
        const fric = 0.7; // tangential damping on impact
        const vx2 = vx * fric;
        const vz2 = vz * fric;
        const age2 = age - tHit;
        out[0] = bx + vx2 * age2;
        out[1] = FLOOR_Y + vy2 * age2 - 0.5 * g * age2 * age2;
        out[2] = bz + vz2 * age2;
      };

      const scratch: [number, number, number] = [0, 0, 0];

      return {
        // Continuous, looping, stateful spray.
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads so control changes take effect with no rebuild.
          const rate = Math.max(1, Math.min(POOL, Math.round(num(params.rate, 300))));
          const gMul = num(params.gravity, 1);
          const rest = clamp(num(params.restitution, 0.5), 0.2, 0.8);
          const spread = num(params.spread, 0.7);
          material.size = num(params.size, 0.045);

          const g = GRAVITY * gMul;

          for (let i = 0; i < rate; i++) {
            // Per-spark looping age: its own clock, staggered by emitOffset.
            let ph = (t / LIFE + emitOffset[i]) % 1;
            if (ph < 0) ph += 1;
            const age = ph * LIFE; // seconds since this spark emitted

            // Ejection velocity: base direction scaled by speed + spread on the
            // lateral components so the cone widens with the spread knob.
            const sp = SPEED * speedMul[i];
            const vx = dirX[i] * sp * spread;
            const vy = dirY[i] * sp;
            const vz = dirZ[i] * sp * spread;

            integrate(ORIGIN_X, ORIGIN_Y, ORIGIN_X, vx, vy, vz, g, rest, age, scratch);
            positions[i * 3] = scratch[0];
            positions[i * 3 + 1] = scratch[1];
            positions[i * 3 + 2] = scratch[2];

            // Color cools white -> yellow -> red over normalized life u.
            const u = ph; // 0 (just emitted) .. 1 (dying)
            if (u < 0.5) {
              tmp.copy(white).lerp(yellow, u / 0.5);
            } else {
              tmp.copy(yellow).lerp(red, (u - 0.5) / 0.5);
            }
            // Fade brightness toward death (additive => darker = fades out).
            const fade = 1 - u * u; // bright early, dim late
            colors[i * 3] = tmp.r * fade;
            colors[i * 3 + 1] = tmp.g * fade;
            colors[i * 3 + 2] = tmp.b * fade;
          }
          // Park inactive pool members out of view (and unlit).
          for (let i = rate; i < POOL; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = HIDDEN_Y;
            positions[i * 3 + 2] = 0;
            colors[i * 3] = 0;
            colors[i * 3 + 1] = 0;
            colors[i * 3 + 2] = 0;
          }
          posAttr.needsUpdate = true;
          colAttr.needsUpdate = true;
        },
        dispose: () => {
          target.object.remove(points);
          geometry.dispose();
          material.dispose();
        },
      };
    },
  ),
};
