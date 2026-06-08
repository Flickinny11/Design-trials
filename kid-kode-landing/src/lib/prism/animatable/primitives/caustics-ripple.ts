// caustics-ripple — a caustic web that breathes in radial ripple rings: light
// through disturbed water. HARD / GPU primitive. Swaps the host plane's material
// for a MeshBasicNodeMaterial whose colorNode layers sines of uv*scale (the
// caustic web, like caustics.ts) and then MODULATES that web by a radial ripple
// term sin(length(uv-0.5)*ringFreq - uTime*speed), so the caustics pulse outward
// in rings. seek() advances the time uniform; onParamChange() updates live uniforms.

import { Mesh, Color, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, sin, pow, max, length } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 12, step: 0.1, default: 5 },
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 4, step: 0.1, default: 1.2 },
  { id: 'ringFreq', label: 'Ring Freq', type: 'knob', min: 1, max: 40, step: 0.5, default: 14 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#5ad4ff' },
] as const;

export const causticsRipplePrimitive: PrimitiveDefinition = {
  name: 'caustics-ripple',
  label: 'Caustics Ripple',
  category: 'caustics',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A caustic web pulsing in radial ripple rings, like light through disturbed water.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'caustics-ripple', category: 'caustics', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#5ad4ff'));
      const uTime = uniform(0);
      const uScale = uniform(num(params.scale, 5));
      const uSpeed = uniform(num(params.speed, 1.2));
      const uRingFreq = uniform(num(params.ringFreq, 14));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Layered caustic web (as in caustics.ts): scaled uv driven through offset
      // sines along a few directions; products of the bands form the filaments.
      const u = uv();
      const t = uTime.mul(uSpeed);
      const sx = u.x.mul(uScale);
      const sy = u.y.mul(uScale);

      const a = sin(sx.add(t)).mul(sin(sy.sub(t)));
      const b = sin(sx.sub(sy).mul(0.7).add(t.mul(1.3)));
      const web = max(a.add(b).mul(0.5), float(0));
      const sharp = pow(web, float(3));

      // Radial ripple term: rings expanding from the plane's center, breathing
      // the caustics in and out. length(uv-0.5) is the radius from center; the
      // ring phase advances with time so the rings travel outward.
      const radius = length(u.sub(vec2(0.5, 0.5)));
      const ring = sin(radius.mul(uRingFreq).sub(uTime.mul(uSpeed))).mul(0.5).add(0.5);

      const colorNode = vec3(uR, uG, uB).mul(sharp).mul(ring);

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose the time + ring uniform handles on the shared scratch space so the
      // host (and conformance tests) can observe the driven animation state.
      target.userData.causticsRippleUniforms = { uTime, uRingFreq, uScale, uSpeed };

      return {
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uScale.value = num(params.scale, 5);
          uSpeed.value = num(params.speed, 1.2);
          uRingFreq.value = num(params.ringFreq, 14);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'scale') uScale.value = num(value, 5);
          else if (id === 'speed') uSpeed.value = num(value, 1.2);
          else if (id === 'ringFreq') uRingFreq.value = num(value, 14);
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
