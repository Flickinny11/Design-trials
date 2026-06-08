// dust-cloud — a drifting cloud of fine dust catching light. HARD / TSL
// primitive. Swaps the host plane's material for a MeshBasicNodeMaterial whose
// opacityNode is a low-density drifting fbm haze (thresholded soft so it stays
// thin/hazy) and whose colorNode is a warm dusty tint with a faint high-
// frequency sparkle term so individual motes glint. seek() advances a time
// uniform; onParamChange() updates live uniforms. DISTINCT from clouds
// (volumetric) and fog: this is a thin sideways-billowing dust haze with
// glinting motes, not a dense volume.

import { Mesh, Color, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  sin,
  cos,
  fract,
  floor,
  dot,
  mix,
  max,
  smoothstep,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'drift', label: 'Drift', type: 'knob', min: 0, max: 2, step: 0.05, default: 0.6 },
  { id: 'density', label: 'Density', type: 'fader', min: 0, max: 0.6, step: 0.01, default: 0.28 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 10, step: 0.1, default: 4 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#d8b078' },
] as const;

export const dustCloudPrimitive: PrimitiveDefinition = {
  name: 'dust-cloud',
  label: 'Dust Cloud',
  category: 'smoke',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A drifting cloud of fine dust catches light — soft low-density haze slowly billowing sideways with motes glinting.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'dust-cloud', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#d8b078'));

      const uTime = uniform(0);
      const uDrift = uniform(num(params.drift, 0.6));
      const uDensity = uniform(num(params.density, 0.28));
      const uScale = uniform(num(params.scale, 4));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // ── value noise + fbm (deterministic, no Math.random) ──────────────
      // TSL node ops return a broad Node type; cast through V2 (a vec2-ish node)
      // to dodge strict TSL typing, exactly as caustics.ts casts node assigns.
      type V2 = ReturnType<typeof vec2>;
      const v2 = (n: unknown): V2 => n as V2;

      const hash = (p: V2) =>
        fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));

      const vnoise = (p: V2) => {
        const i = v2(floor(p));
        const f = v2(fract(p));
        // smooth interpolant
        const u = f.mul(f).mul(float(3).sub(f.mul(2)));
        const a = hash(i);
        const b = hash(v2(i.add(vec2(1, 0))));
        const c = hash(v2(i.add(vec2(0, 1))));
        const d = hash(v2(i.add(vec2(1, 1))));
        const x1 = mix(a, b, u.x);
        const x2 = mix(c, d, u.x);
        return mix(x1, x2, u.y);
      };

      const fbm = (p: V2) => {
        let f = vnoise(p).mul(0.5);
        f = f.add(vnoise(v2(p.mul(2.03))).mul(0.25));
        f = f.add(vnoise(v2(p.mul(4.07))).mul(0.125));
        f = f.add(vnoise(v2(p.mul(8.11))).mul(0.0625));
        return f;
      };

      // Drift: mostly sideways (driftX), gentle vertical billow (driftY * 0.3).
      const t = uTime.mul(uDrift);
      const driftX = t;
      const driftY = t.mul(0.3);
      const u = uv();
      const p = v2(u.mul(uScale).add(vec2(driftX, driftY)));

      // Low-density haze: fbm thresholded soft (smoothstep) and scaled by the
      // low density control so the cloud stays thin and hazy.
      const cloud = fbm(p);
      const haze = smoothstep(float(0.45), float(0.85), cloud).mul(uDensity);

      // Sparkle motes: a high-frequency noise field, sharply gated and twinkling
      // slowly over time so individual dust motes glint as they catch light.
      const spField = vnoise(v2(u.mul(uScale.mul(6)).add(vec2(driftX.mul(0.5), 0))));
      const twinkle = sin(uTime.mul(3).add(spField.mul(40))).mul(0.5).add(0.5);
      const sparkle = smoothstep(float(0.93), float(1), spField).mul(twinkle).mul(haze.mul(4));

      // Warm dusty tint + the glinting sparkle term lifting toward near-white.
      const baseTint = vec3(uR, uG, uB);
      const colorNode = mix(baseTint, vec3(1, 0.96, 0.85), sparkle).mul(
        float(0.6).add(haze.mul(1.5)),
      );

      // Opacity = soft haze plus the bright mote pinpoints, kept low overall.
      const opacityNode = max(haze, sparkle);

      const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose live uniform handles on the shared scratch space so the host (or
      // a test) can observe the CPU-side animation state without reading pixels.
      target.userData.dustCloudUniforms = {
        time: uTime,
        drift: uDrift,
        density: uDensity,
        scale: uScale,
      };

      return {
        // Stateful drifting haze — loops continuously.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uDrift.value = num(params.drift, 0.6);
          uDensity.value = num(params.density, 0.28);
          uScale.value = num(params.scale, 4);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'drift') uDrift.value = num(value, 0.6);
          else if (id === 'density') uDensity.value = num(value, 0.28);
          else if (id === 'scale') uScale.value = num(value, 4);
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
