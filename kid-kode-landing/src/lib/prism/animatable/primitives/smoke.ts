// smoke — a column of rising, scrolling fbm noise rendered as soft grey-blue
// haze. HARD / GPU primitive. Swaps the host plane's material for a
// MeshBasicNodeMaterial whose color + alpha come from layered scrolling noise
// (fbm built by stacking sin/hash octaves in TSL) that drifts upward over a
// time uniform; denser toward the base of the plane.

import { Mesh, Color, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 2, step: 0.05, default: 0.5 },
  { id: 'density', label: 'Density', type: 'knob', min: 0, max: 2, step: 0.05, default: 1 },
  { id: 'rise', label: 'Rise', type: 'knob', min: 0, max: 2, step: 0.05, default: 1 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#9aa6c8' },
] as const;

export const smokePrimitive: PrimitiveDefinition = {
  name: 'smoke',
  label: 'Smoke',
  category: 'smoke',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A column of soft grey-blue haze: layered scrolling fbm noise rises over time, denser at the base.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'smoke', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#9aa6c8'));

      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 0.5));
      const uDensity = uniform(num(params.density, 1));
      const uRise = uniform(num(params.rise, 1));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // ── fbm built from stacked sin/hash octaves (pure TSL) ────────────────
      // Cheap value-noise via a sin-hash; smoothed by bilinear blend of corners.
      const hash = (p: any) =>
        p.dot(vec2(127.1, 311.7)).sin().mul(43758.5453).fract();

      const noise = (p: any) => {
        const i = p.floor();
        const f = p.fract();
        // smoothstep weights
        const u = f.mul(f).mul(float(3).sub(f.mul(2)));
        const a = hash(i);
        const b = hash(i.add(vec2(1, 0)));
        const c = hash(i.add(vec2(0, 1)));
        const d = hash(i.add(vec2(1, 1)));
        const x1 = a.mix(b, u.x);
        const x2 = c.mix(d, u.x);
        return x1.mix(x2, u.y);
      };

      // Coordinate that scrolls upward over time (rising plume).
      const coord = uv();
      const drift = uTime.mul(uSpeed);
      const p0 = vec2(coord.x.mul(3), coord.y.mul(3).sub(drift));

      // 4 octaves of fbm.
      let f = noise(p0).mul(0.5);
      f = f.add(noise(p0.mul(2).add(vec2(0, drift.mul(0.5)))).mul(0.25));
      f = f.add(noise(p0.mul(4).sub(vec2(0, drift.mul(0.8)))).mul(0.15));
      f = f.add(noise(p0.mul(8).add(vec2(drift.mul(0.3), 0))).mul(0.1));

      // Denser toward the base (uv.y == 0); rise lifts the falloff upward.
      const baseFalloff = float(1).sub(coord.y).pow(uRise.add(0.001));
      const amount = f.mul(uDensity).mul(baseFalloff);

      // Soft grey-blue tint; brighten slightly with density of the puff.
      const colorNode = vec3(uR, uG, uB).add(vec3(0.06, 0.07, 0.1).mul(amount));
      const opacityNode = amount.clamp(0, 1);

      const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        // Stateful drifting haze — runs continuously off the time driver.
        duration: () => Infinity,
        seek: (t: number) => {
          uTime.value = t;
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 0.5);
          else if (id === 'density') uDensity.value = num(value, 1);
          else if (id === 'rise') uRise.value = num(value, 1);
          else if (id === 'tint' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uR.value = r;
            uG.value = g;
            uB.value = b;
          }
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
