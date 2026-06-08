// ink-bloom — a drop of ink blooms into water. HARD / GPU smoke primitive.
// Swaps the host plane's material for a MeshBasicNodeMaterial whose density is a
// growing feathered blob centered on the plane: d = length(uv-0.5), and a value
// noise (fbm of sin) of (uv*scale + time*flow) wobbles the bloom edge so the
// cloud unfurls with turbulent, feathered tendrils. color = dark ink tint,
// alpha = density. seek() advances uGrow 0->~0.9 and uTime (turbulent unfurl);
// onParamChange() updates live uniforms. DISTINCT from ink-spread: this is a
// center-out diffusing cloud, not a directional spread.

import { Mesh, Color, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  sin,
  dot,
  fract,
  floor,
  length,
  mix,
  smoothstep,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 3, step: 0.1, default: 1 },
  { id: 'turbulence', label: 'Turbulence', type: 'knob', min: 0, max: 0.4, step: 0.01, default: 0.16 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 12, step: 0.1, default: 5 },
  { id: 'flow', label: 'Flow', type: 'knob', min: 0, max: 2, step: 0.05, default: 0.6 },
  { id: 'tint', label: 'Ink', type: 'color', default: '#0b1124' },
] as const;

export const inkBloomPrimitive: PrimitiveDefinition = {
  name: 'ink-bloom',
  label: 'Ink Bloom',
  category: 'smoke',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A drop of ink blooms into water — a dark organic cloud unfurling and diffusing outward with feathered tendrils.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'ink-bloom', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#0b1124'));

      const uGrow = uniform(0); // bloom radius 0 -> ~0.9
      const uTime = uniform(0); // turbulent unfurl clock
      const uTurb = uniform(num(params.turbulence, 0.16));
      const uScale = uniform(num(params.scale, 5));
      const uFlow = uniform(num(params.flow, 0.6));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // ── Value noise (hash of sin) + 3-octave fbm. Deterministic, GLSL-free.
      // TSL node chains are loosely typed; treat node args as a loose `TSLNode`
      // with method/swizzle access typed open (mirrors caustics.ts's casts).
      interface TSLNode {
        mul(...a: unknown[]): TSLNode;
        add(...a: unknown[]): TSLNode;
        sub(...a: unknown[]): TSLNode;
        x: TSLNode;
        y: TSLNode;
      }
      const N = (v: unknown): TSLNode => v as unknown as TSLNode;
      const v2 = (x: number, y: number) => N(vec2(x, y));
      const hash = (p: TSLNode): TSLNode => {
        const dotted = N(dot(p as never, vec2(127.1, 311.7)));
        const sined = N(sin(dotted as never));
        return N(fract(sined.mul(43758.5453) as never));
      };
      const vnoise = (p: TSLNode): TSLNode => {
        const i = N(floor(p as never));
        const f = N(fract(p as never));
        const u = f.mul(f).mul(N(float(3).sub(f.mul(2) as never))); // smoothstep weights
        const a = hash(i);
        const b = hash(i.add(v2(1, 0)));
        const c = hash(i.add(v2(0, 1)));
        const d = hash(i.add(v2(1, 1)));
        return N(mix(mix(a as never, b as never, u.x as never), mix(c as never, d as never, u.x as never), u.y as never));
      };

      const u = uv();
      // Drift coordinate: scaled uv pushed by the flow clock so tendrils unfurl.
      const flowT = uTime.mul(uFlow);
      const p = N(u.mul(uScale).add(vec2(flowT, flowT.mul(0.7))));
      const p2 = N(p.mul(2.03).add(v2(5.2, 1.3)));
      const p3 = N(p.mul(4.07).add(v2(9.1, 7.7)));
      const fbm = vnoise(p)
        .mul(0.5)
        .add(vnoise(p2).mul(0.25))
        .add(vnoise(p3).mul(0.125));

      // Distance from center, perturbed by the noise so the edge is feathered.
      const d = length(u.sub(vec2(0.5, 0.5))).add(fbm.sub(0.4375).mul(uTurb) as never);

      // density = 1 inside the growing radius, feathered to 0 just outside it.
      const edge = float(0.12);
      const density = smoothstep(uGrow, uGrow.sub(edge), d);

      const colorNode = vec3(uR, uG, uB).mul(density);

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = density;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish live uniform handles to the shared scratch space (contract:
      // userData is "uniform handles, etc.") so the host/tests can observe.
      target.userData.inkBloom = { uGrow, uTime, uTurb, uScale, uFlow };

      // Bloom over the first ~3.2s; uGrow goes 0 -> ~0.9 then settles.
      const DURATION = 3.6;
      return {
        duration: () => DURATION,
        seek: (tt) => {
          uTime.value = tt * num(params.speed, 1);
          // grow phase 0..1 across the duration, eased toward a settled max.
          const ph = Math.min(Math.max(tt / DURATION, 0), 1);
          const grown = 1 - Math.pow(1 - ph, 2); // expo-ish ease-out
          uGrow.value = grown * 0.92;
          // live param reads (no rebuild)
          uTurb.value = num(params.turbulence, 0.16);
          uScale.value = num(params.scale, 5);
          uFlow.value = num(params.flow, 0.6);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'turbulence') uTurb.value = num(value, 0.16);
          else if (id === 'scale') uScale.value = num(value, 5);
          else if (id === 'flow') uFlow.value = num(value, 0.6);
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
