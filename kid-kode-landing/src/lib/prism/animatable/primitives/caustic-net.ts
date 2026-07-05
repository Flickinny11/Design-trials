// caustic-net — a flowing web of thin caustic filaments painted over the plane.
// HARD / GPU primitive. Swaps the host plane's material for a MeshStandard-
// NodeMaterial whose emissiveNode builds a thin filament net: three interfering
// sine bands form a field `f`, and `net = pow(1 - clamp(f), thinPow)` lights up
// only the thin lines where f~0 (bright threads), then tints. seek() advances a
// time uniform so the net weaves and drifts. DISTINCT from pool-caustics
// (cells) — this is thin filament threads.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, float, sin, abs, pow, clamp as tslClamp } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 3, step: 0.1, default: 1 },
  { id: 'density', label: 'Density', type: 'knob', min: 2, max: 24, step: 0.5, default: 9 },
  { id: 'thinness', label: 'Thinness', type: 'knob', min: 2, max: 8, step: 0.1, default: 4 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#7fe9ff' },
] as const;

export const causticNetPrimitive: PrimitiveDefinition = {
  name: 'caustic-net',
  label: 'Caustic Net',
  category: 'caustics',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A flowing web of caustic filaments — thin bright threads of light weaving and drifting like reflections off rippled water.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'caustic-net', category: 'caustics', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#7fe9ff'));
      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 1));
      const uDensity = uniform(num(params.density, 9));
      const uThin = uniform(num(params.thinness, 4));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Thin filament net: three interfering sine bands form a field `f`. Where
      // f~0, `net = pow(1 - clamp(f,0,1), thinPow)` peaks → bright thin threads.
      // Density scales the band frequencies (a/b/c); time weaves and drifts them.
      const u = uv();
      const t = uTime.mul(uSpeed);
      const a = uDensity;
      const b = uDensity.mul(1.13);
      const c = uDensity.mul(0.77);

      const band1 = sin(u.x.mul(a).add(t)).mul(sin(u.y.mul(b).sub(t.mul(1.2))));
      const band2 = sin(u.x.sub(u.y).mul(c).add(t.mul(0.7)));
      const f = abs(band1.add(band2));
      const net = pow(float(1).sub(tslClamp(f, float(0), float(1))), uThin);

      const emissiveNode = vec3(uR, uG, uB).mul(net);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        // Stateful, continuously weaving net — loops forever.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 1);
          uDensity.value = num(params.density, 9);
          uThin.value = num(params.thinness, 4);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 1);
          else if (id === 'density') uDensity.value = num(value, 9);
          else if (id === 'thinness') uThin.value = num(value, 4);
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
