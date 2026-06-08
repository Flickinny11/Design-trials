// wispy-smoke — thin curling wisps of smoke that rise and dissipate, slower and
// softer than billowing smoke. HARD / GPU primitive. Swaps the host plane's
// material for a transparent MeshBasicNodeMaterial whose color + alpha come from
// layered fbm sampled with the uv ADVECTED UPWARD (y offset by -uTime*rise) and
// a HORIZONTAL CURL (uv.x offset by sin(uv.y*k + uTime)). Distinct from smoke.ts:
// curling thin filaments + alpha that fades toward the TOP (smoke.ts is denser at
// the base; this is wisps that thin out as they rise). Low density, soft grey.

import { Mesh, Color, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, sin } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'rise', label: 'Rise', type: 'knob', min: 0, max: 1.5, step: 0.05, default: 0.4 },
  { id: 'curl', label: 'Curl', type: 'knob', min: 0, max: 1.5, step: 0.05, default: 0.5 },
  { id: 'density', label: 'Density', type: 'knob', min: 0, max: 1.5, step: 0.05, default: 0.5 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#b8bccb' },
] as const;

export const wispySmokePrimitive: PrimitiveDefinition = {
  name: 'wispy-smoke',
  label: 'Wispy Smoke',
  category: 'smoke',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Thin curling wisps of smoke rise and dissipate, slower and softer than billowing smoke.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'wispy-smoke', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#b8bccb'));

      const uTime = uniform(0);
      const uRise = uniform(num(params.rise, 0.4));
      const uCurl = uniform(num(params.curl, 0.5));
      const uDensity = uniform(num(params.density, 0.5));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Publish uniform handles so the host (and CPU tests) can read live state.
      target.userData.wispySmoke = { uTime, uRise, uCurl, uDensity };

      // ── value-noise fbm built from a sin-hash (pure TSL) ──────────────────
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

      const coord = uv();
      // Advect the sample upward: subtracting from y scrolls the field down so
      // the wisps appear to rise. Slow (rise default 0.4) for a gentle plume.
      const advectedY = coord.y.add(uTime.mul(uRise));
      // Horizontal curl: shift uv.x by a sine of (uv.y*k + time) so the column
      // serpentines side-to-side as it climbs — the "wispy" curl.
      const k = float(6.0);
      const curlOffset = sin(coord.y.mul(k).add(uTime)).mul(uCurl.mul(0.18));
      const curledX = coord.x.add(curlOffset);

      const p0 = vec2(curledX.mul(2.4), advectedY.mul(2.4));

      // 3 thin octaves of fbm (fewer than smoke.ts for a wispier, sparser look).
      let f = noise(p0).mul(0.55);
      f = f.add(noise(p0.mul(2.1).add(vec2(uTime.mul(0.2), uTime.mul(uRise).mul(0.5)))).mul(0.3));
      f = f.add(noise(p0.mul(4.3).sub(vec2(0, uTime.mul(uRise).mul(0.9)))).mul(0.15));

      // Thin the field into wisps: sharpen and bias low so only filaments show.
      const filament = f.sub(0.42).max(float(0)).mul(2.6);

      // Alpha fades toward the TOP (uv.y == 1): wisps dissipate as they rise.
      const fadeTop = float(1).sub(coord.y).clamp(0, 1);
      const amount = filament.mul(uDensity).mul(fadeTop);

      // Soft grey; lighten faintly where the wisp is densest.
      const colorNode = vec3(uR, uG, uB).add(vec3(0.05, 0.05, 0.06).mul(amount));
      const opacityNode = amount.clamp(0, 0.85);

      const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        // Stateful, continuously drifting wisps — runs off the time driver.
        duration: () => Infinity,
        seek: (t: number) => {
          uTime.value = t;
          // Read params live so control changes apply without a rebuild.
          uRise.value = num(params.rise, 0.4);
          uCurl.value = num(params.curl, 0.5);
          uDensity.value = num(params.density, 0.5);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'rise') uRise.value = num(value, 0.4);
          else if (id === 'curl') uCurl.value = num(value, 0.5);
          else if (id === 'density') uDensity.value = num(value, 0.5);
          else if (id === 'tint' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uR.value = r;
            uG.value = g;
            uB.value = b;
          }
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.wispySmoke;
          mat.dispose();
        },
      };
    },
  ),
};
