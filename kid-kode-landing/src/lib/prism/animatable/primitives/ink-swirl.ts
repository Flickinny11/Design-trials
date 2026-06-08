// ink-swirl — ink caught in a vortex: it swirls into spiraling arms, curling
// around a center as it diffuses. HARD / GPU primitive (smoke). Swaps the host
// plane's material for a MeshBasicNodeMaterial whose density is sampled from fbm
// in a *swirled* uv space — the sample coordinate is rotated by an angle that
// grows with radius (arm curl) and drifts with time (spin), so straight ink
// bands wind into spiral arms that rotate around the center and fade outward.
//
// DISTINCT from ink-spread / ink-bloom (purely radial diffusion): here the
// sampling space is a vortex. Per-pixel:
//   centered = uv - 0.5
//   r        = length(centered)
//   ang      = atan(centered.y, centered.x) + r*twist - uTime*spin
//   swirlUv  = vec2(cos(ang), sin(ang)) * r          (vortex-rotated coordinate)
//   density  = fbm(swirlUv*scale) * smoothstep(0.6, 0.0, r)
//   color    = dark ink tint ; alpha = density
// seek() advances uTime so the spiral arms rotate continuously. Loops forever
// (duration === Infinity). Live knobs: spin, twist (arm curl 1..8), scale.

import { Mesh, Color, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, length, atan, cos, sin, smoothstep } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'spin', label: 'Spin', type: 'knob', min: 0.1, max: 4, step: 0.05, default: 1 },
  { id: 'twist', label: 'Twist', type: 'knob', min: 1, max: 8, step: 0.1, default: 4 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 10, step: 0.1, default: 4 },
  { id: 'tint', label: 'Ink', type: 'color', default: '#10131f' },
] as const;

export const inkSwirlPrimitive: PrimitiveDefinition = {
  name: 'ink-swirl',
  label: 'Ink Swirl',
  category: 'smoke',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Ink caught in a vortex swirls into spiraling arms, curling around a center as it diffuses.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'ink-swirl', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#10131f'));

      const uTime = uniform(0);
      const uSpin = uniform(num(params.spin, 1));
      const uTwist = uniform(num(params.twist, 4));
      const uScale = uniform(num(params.scale, 4));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // ── fbm built from stacked sin-hash octaves (pure TSL), per smoke.ts ────
      const hash = (p: any) =>
        p.dot(vec2(127.1, 311.7)).sin().mul(43758.5453).fract();

      const noise = (p: any) => {
        const i = p.floor();
        const f = p.fract();
        const u = f.mul(f).mul(float(3).sub(f.mul(2)));
        const a = hash(i);
        const b = hash(i.add(vec2(1, 0)));
        const c = hash(i.add(vec2(0, 1)));
        const d = hash(i.add(vec2(1, 1)));
        const x1 = a.mix(b, u.x);
        const x2 = c.mix(d, u.x);
        return x1.mix(x2, u.y);
      };

      const fbm = (p: any) => {
        // accumulator gets reassigned through fluent ops -> annotate `any`
        // (the narrow VarNode typing fails strict tsc otherwise).
        let acc: any = noise(p).mul(0.5);
        acc = acc.add(noise(p.mul(2)).mul(0.25));
        acc = acc.add(noise(p.mul(4)).mul(0.15));
        acc = acc.add(noise(p.mul(8)).mul(0.1));
        return acc;
      };

      // ── vortex: rotate the sample coordinate by angle(r, time) ─────────────
      const centered = uv().sub(0.5);
      const r = length(centered);
      // ang = atan(y, x) + r*twist - time*spin  → arms curl with radius, spin in time
      const ang = atan(centered.y, centered.x)
        .add(r.mul(uTwist))
        .sub(uTime.mul(uSpin));
      const swirlUv = vec2(cos(ang), sin(ang)).mul(r);

      // density from fbm of the swirled coordinate, faded toward the rim.
      const falloff = smoothstep(float(0.6), float(0.0), r);
      const density = fbm(swirlUv.mul(uScale)).mul(falloff);

      const colorNode = vec3(uR, uG, uB);
      const opacityNode = density.clamp(0, 1);

      const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Observable handles for tests / driver.
      target.userData.inkSwirlTime = uTime;
      target.userData.inkSwirlScale = uScale;

      return {
        // Continuously swirling vortex — runs forever off the time driver.
        duration: () => Infinity,
        seek: (t: number) => {
          uTime.value = t;
          // Read params live so control changes apply without a rebuild.
          uSpin.value = num(params.spin, 1);
          uTwist.value = num(params.twist, 4);
          uScale.value = num(params.scale, 4);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'spin') uSpin.value = num(value, 1);
          else if (id === 'twist') uTwist.value = num(value, 4);
          else if (id === 'scale') uScale.value = num(value, 4);
          else if (id === 'tint' && typeof value === 'string') {
            const [r2, g2, b2] = rgb(value);
            uR.value = r2;
            uG.value = g2;
            uB.value = b2;
          }
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.inkSwirlTime;
          delete target.userData.inkSwirlScale;
          mat.dispose();
        },
      };
    },
  ),
};
