// iridescence — an oil-on-water slick of cycling iridescent colors swirls
// across the plane. HARD / GPU primitive. Swaps the host plane's material for a
// MeshBasicNodeMaterial whose colorNode builds an fbm (fractal Brownian motion)
// field over the scaled uv, offsets it by a time uniform, and feeds it through a
// sin-based rainbow palette to produce swirling oil-slick hues. seek() advances
// the time uniform; onParamChange() updates the live uniforms.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, sin, fract, dot, floor, mix } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.05, max: 3, step: 0.05, default: 0.6 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 12, step: 0.1, default: 4 },
  { id: 'saturation', label: 'Saturation', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.85 },
] as const;

export const iridescencePrimitive: PrimitiveDefinition = {
  name: 'iridescence',
  label: 'Oil Slick',
  category: 'shimmer',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'An oil-on-water slick of cycling iridescent colors swirls across the plane.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'iridescence', category: 'shimmer', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 0.6));
      const uScale = uniform(num(params.scale, 4));
      const uSat = uniform(num(params.saturation, 0.85));

      // ── value-noise + fbm built from TSL nodes (deterministic, hash-based) ──
      // Cast lattice / sample coords to dodge strict TSL Var/Join typing (mirrors
      // dissolve-noise.ts and the node-assignment casts in caustics.ts). Each
      // helper takes ONE typed V2 param and callers cast the arg; the returned
      // node chains naturally through TSL operators.
      type V2 = ReturnType<typeof vec2>;

      // hash: fract(sin(dot(p, k)) * big) — scalar field per lattice corner.
      const hash = (g: V2) => fract(sin(dot(g, vec2(127.1, 311.7))).mul(43758.5453));

      // smooth value noise over a vec2 cell (bilinear hash interpolation).
      const noise = (p: V2) => {
        const i = floor(p);
        const f = fract(p);
        const w = f.mul(f).mul(float(3).sub(f.mul(2))); // smoothstep weights
        const a = hash(i as unknown as V2);
        const b = hash(i.add(vec2(1, 0)) as unknown as V2);
        const c = hash(i.add(vec2(0, 1)) as unknown as V2);
        const d = hash(i.add(vec2(1, 1)) as unknown as V2);
        return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
      };

      // fbm: stack of noise octaves at increasing frequency / decreasing amp.
      const fbm = (p: V2) => {
        const n0 = noise(p).mul(0.5);
        const n1 = noise(p.mul(2.03) as unknown as V2).mul(0.25);
        const n2 = noise(p.mul(4.07) as unknown as V2).mul(0.125);
        const n3 = noise(p.mul(8.11) as unknown as V2).mul(0.0625);
        return n0.add(n1).add(n2).add(n3);
      };

      const u = uv();
      const t = uTime.mul(uSpeed);
      // swirl the sample point: scaled uv drifting over time, plus a circular
      // warp so the slick churns rather than scrolling linearly.
      const sp = vec2(u.x, u.y).mul(uScale);
      const warped = vec2(
        sp.x.add(sin(sp.y.mul(0.7).add(t))),
        sp.y.add(sin(sp.x.mul(0.7).sub(t))),
      );
      const field = fbm(warped as unknown as V2).add(t.mul(0.5));

      // sin-based rainbow palette: phase the field through 3 offset sines to get
      // an oil-slick spectrum. base 0.5 + 0.5*sin keeps it in [0,1], then pull
      // toward grey by (1-saturation).
      const phaseBase = field.mul(6.2831853);
      const rRaw = sin(phaseBase).mul(0.5).add(0.5);
      const gRaw = sin(phaseBase.add(2.0943951)).mul(0.5).add(0.5);
      const bRaw = sin(phaseBase.add(4.1887902)).mul(0.5).add(0.5);
      const grey = float(0.5);
      const r = mix(grey, rRaw, uSat);
      const g = mix(grey, gRaw, uSat);
      const b = mix(grey, bRaw, uSat);

      const colorNode = vec3(r, g, b);

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish the uniform handles into the host scratch space (contract:
      // userData is "uniform handles, etc."). Their `.value` is CPU-observable.
      target.userData.iridescence = { uTime, uSpeed, uScale, uSat };

      return {
        // Looping/stateful oil-slick effect: continuous, no settle.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 0.6);
          uScale.value = num(params.scale, 4);
          uSat.value = num(params.saturation, 0.85);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 0.6);
          else if (id === 'scale') uScale.value = num(value, 4);
          else if (id === 'saturation') uSat.value = num(value, 0.85);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
