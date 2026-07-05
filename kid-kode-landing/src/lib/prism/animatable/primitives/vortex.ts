// vortex — a continuous whirlpool of particles spiraling inward. HARD /
// particles / empty subject. The host hands an empty target.object; this
// primitive generates its own THREE.Points cloud and animates it.
//
// Each particle i has a deterministic base radius and base angle (index hash).
// In seek the angle advances by t*swirl/(radius+eps) so INNER particles spin
// FASTER than outer ones (the signature whirlpool shear). The radius is pulled
// inward (baseRadius - t*inflow) and wrapped within a ring range so particles
// that reach the eye recycle back out to the rim — a continuous, looping flow.
// A small y bob lifts particles as they accelerate toward the glowing center.
// Mapped to the x/z plane (top-down whirlpool). Cyan→white additive points.
// Looping (duration Infinity), deterministic (all randomness from an index hash).

import {
  Points,
  BufferGeometry,
  Float32BufferAttribute,
  PointsMaterial,
  Color,
  AdditiveBlending,
} from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

const MAX_COUNT = 500; // upper bound; live `count` selects how many are active
const R_INNER = 0.18; // eye radius — particles recycle out once they pass this
const R_OUTER = 1.6; // rim radius
const R_RANGE = R_OUTER - R_INNER;
const EPS = 0.12; // softens the 1/radius angular blow-up near the eye

/** Deterministic [0,1) hash for index i with a seed offset. */
function hash(i: number, seed: number): number {
  const v = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

const SCHEMA = [
  { id: 'swirl', label: 'Swirl', type: 'knob', min: 0.2, max: 6, step: 0.05, default: 2.4 },
  { id: 'inflow', label: 'Inflow', type: 'knob', min: 0.05, max: 1.4, step: 0.01, default: 0.5 },
  { id: 'count', label: 'Count', type: 'knob', min: 100, max: 500, step: 10, default: 320 },
] as const;

export const vortexPrimitive: PrimitiveDefinition = {
  name: 'vortex',
  label: 'Vortex',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Particles spiral inward into a glowing vortex, accelerating as they near the eye then recycling outward — a continuous whirlpool.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'vortex', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Deterministic per-particle base radius, base angle, and bob phase.
      const baseRadius = new Float32Array(MAX_COUNT);
      const baseAngle = new Float32Array(MAX_COUNT);
      const bobPhase = new Float32Array(MAX_COUNT);
      for (let i = 0; i < MAX_COUNT; i++) {
        // sqrt distribution spreads particles evenly across the disc area.
        baseRadius[i] = R_INNER + Math.sqrt(hash(i, 1.0)) * R_RANGE;
        baseAngle[i] = hash(i, 2.0) * Math.PI * 2;
        bobPhase[i] = hash(i, 3.0) * Math.PI * 2;
      }

      const positions = new Float32Array(MAX_COUNT * 3);
      const geom = new BufferGeometry();
      geom.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geom.setDrawRange(0, num(params.count, 320));

      const mat = new PointsMaterial({
        color: new Color('#7fe3ff'), // cyan/white
        size: 0.055,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: AdditiveBlending,
        sizeAttenuation: true,
      });

      const points = new Points(geom, mat);
      points.name = 'vortex-swirl';
      target.object.add(points);

      const posAttr = geom.getAttribute('position') as Float32BufferAttribute;

      const applyCount = () => {
        const c = Math.max(1, Math.min(MAX_COUNT, Math.round(num(params.count, 320))));
        geom.setDrawRange(0, c);
        return c;
      };

      return {
        duration: () => Infinity,
        seek: (t: number) => {
          // Read params live so control changes apply with no rebuild.
          const count = applyCount();
          const swirl = num(params.swirl, 2.4);
          const inflow = num(params.inflow, 0.5);
          const arr = posAttr.array as Float32Array;
          for (let i = 0; i < count; i++) {
            // Radius pulled inward over time, wrapped within the ring range so a
            // particle reaching the eye recycles back out to the rim.
            let r = (baseRadius[i] - t * inflow - R_INNER) % R_RANGE;
            if (r < 0) r += R_RANGE;
            r += R_INNER;
            // Inner particles spin faster: angular speed ~ swirl / (r + eps).
            const angle = baseAngle[i] + (t * swirl) / (r + EPS);
            arr[i * 3] = Math.cos(angle) * r;
            // slight vertical bob that grows as the particle nears the eye
            const lift = (R_OUTER - r) / R_RANGE; // 0 at rim → 1 at eye
            arr[i * 3 + 1] = Math.sin(t * 1.3 + bobPhase[i]) * 0.08 + lift * 0.12;
            arr[i * 3 + 2] = Math.sin(angle) * r;
          }
          posAttr.needsUpdate = true;
        },
        onParamChange: (id: string) => {
          if (id === 'count') applyCount();
        },
        dispose: () => {
          target.object.remove(points);
          geom.dispose();
          mat.dispose();
        },
      };
    },
  ),
};
