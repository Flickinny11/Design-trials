// underwater-caustics — slow, deep-blue caustics with a vertical depth fade,
// the dappled light of a pool floor. HARD / GPU primitive. Swaps the host
// plane's material for a MeshBasicNodeMaterial whose colorNode layers slow sines
// (like caustics.ts) tinted deep blue/teal, then composites a vertical depth
// gradient that darkens the lower area plus a soft blue ambient so it never
// reads fully black — it reads underwater. seek() advances the time uniform;
// onParamChange() updates the live uniforms.

import { Mesh, Color, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, float, sin, pow, max, add } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 12, step: 0.1, default: 4 },
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.05, max: 2, step: 0.05, default: 0.4 },
  { id: 'depth', label: 'Depth', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.6 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#1f7fa8' },
] as const;

export const underwaterCausticsPrimitive: PrimitiveDefinition = {
  name: 'underwater-caustics',
  label: 'Underwater Caustics',
  category: 'caustics',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Slow, deep-blue caustics with a depth fade — the dappled light of a pool floor.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'underwater-caustics', category: 'caustics', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#1f7fa8'));
      const uTime = uniform(0);
      const uScale = uniform(num(params.scale, 4));
      const uSpeed = uniform(num(params.speed, 0.4));
      const uDepth = uniform(num(params.depth, 0.6));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Slow layered caustic web: scaled uv driven through offset sines along a
      // few directions; products of the bands form the interference filaments,
      // then sharpened with pow into bright dappled light.
      const u = uv();
      const t = uTime.mul(uSpeed);
      const sx = u.x.mul(uScale);
      const sy = u.y.mul(uScale);

      const a = sin(sx.add(t)).mul(sin(sy.sub(t)));
      const b = sin(sx.sub(sy).mul(0.7).add(t.mul(1.1)));
      const web = max(a.add(b).mul(0.5), float(0));
      const sharp = pow(web, float(3));

      // Vertical depth gradient: darker toward the lower area (u.y near 0),
      // brighter toward the top. depthStrength controls how strong the fade is.
      // gradient = 1 - depth * (1 - u.y)  → at u.y=1 → 1, at u.y=0 → 1-depth.
      const gradient = float(1).sub(uDepth.mul(float(1).sub(u.y)));

      // Tinted dappled light, depth-faded.
      const tint = vec3(uR, uG, uB);
      const caustic = tint.mul(sharp).mul(gradient);

      // Soft blue ambient so it never reads fully black (reads underwater). The
      // ambient itself fades with depth so the lower area is dim, not absent.
      const ambient = vec3(uR.mul(0.06), uG.mul(0.1), uB.mul(0.16)).mul(gradient);

      const colorNode = add(caustic, ambient);

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        duration: () => Infinity,
        seek: (tt: number) => {
          // The effect's phase is uTime * uSpeed — advancing this is the visible
          // motion (the caustic web drifts). Read params live so control changes
          // apply without a rebuild.
          uScale.value = num(params.scale, 4);
          uSpeed.value = num(params.speed, 0.4);
          uDepth.value = num(params.depth, 0.6);
          uTime.value = tt;
          // Mirror the driven phase into shared scratch so the host (and tests)
          // can observe the advancing animation on CPU without a renderer.
          target.userData.uTime = uTime.value;
          target.userData.phase = uTime.value * uSpeed.value;
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'scale') uScale.value = num(value, 4);
          else if (id === 'speed') uSpeed.value = num(value, 0.4);
          else if (id === 'depth') uDepth.value = num(value, 0.6);
          else if (id === 'tint' && typeof value === 'string') {
            const [r, g, bb] = rgb(value);
            uR.value = r;
            uG.value = g;
            uB.value = bb;
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
