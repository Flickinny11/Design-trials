// smoke-trail — a thin wisp of smoke that snakes along a curving parametric path,
// like the ribbon left by a sparkler drawn through the air. HARD / GPU primitive.
// Swaps the host plane's material for a transparent MeshBasicNodeMaterial whose
// alpha is the MAX over a handful of fixed sample points along the path
// p(s) = (0.5 + sin(s*2PI + uTime*0.3)*0.3, s) of exp(-dist(uv, p)/width). Older
// samples (lower s, the tail) are dimmed so the head reads bright and the tail
// fades. An fbm field disperses the ribbon so it breaks up like real smoke. seek
// advances uTime so the path snakes; the trail re-evaluates every frame.
//
// DISTINCT from wispy-smoke (a diffuse rising field of curling filaments): this is
// a single DIRECTED snaking ribbon — a head-to-tail trail, not an area haze.

import { Mesh, Color, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, sin, exp, length } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0, max: 3, step: 0.05, default: 1 },
  { id: 'width', label: 'Width', type: 'knob', min: 0.01, max: 0.1, step: 0.005, default: 0.04 },
  { id: 'dispersion', label: 'Dispersion', type: 'knob', min: 0, max: 1.5, step: 0.05, default: 0.5 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#c4cad8' },
] as const;

// Number of fixed sample points along s used to approximate distToPath.
const SAMPLES = 9;

export const smokeTrailPrimitive: PrimitiveDefinition = {
  name: 'smoke-trail',
  label: 'Smoke Trail',
  category: 'smoke',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A thin wisp of smoke trails along a curving path, like the ribbon left by a sparkler drawn through the air.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'smoke-trail', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#c4cad8'));

      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 1));
      const uWidth = uniform(num(params.width, 0.04));
      const uDispersion = uniform(num(params.dispersion, 0.5));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Publish uniform handles so the host (and CPU tests) can read live state.
      target.userData.smokeTrail = { uTime, uSpeed, uWidth, uDispersion };

      // Animation phase: speed scales how fast the ribbon snakes.
      const phaseT = uTime.mul(uSpeed);

      // ── value-noise fbm built from a sin-hash (pure TSL) — for dispersion ──
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

      // fbm dispersion field: a drifting low-frequency noise that warps the
      // density so the ribbon disperses into smoke rather than reading as a
      // crisp line. 2 octaves is plenty for a soft break-up.
      const dp = vec2(coord.x.mul(4).add(phaseT.mul(0.4)), coord.y.mul(4).sub(phaseT.mul(0.6)));
      let fbm: any = noise(dp).mul(0.65);
      fbm = fbm.add(noise(dp.mul(2.2).add(vec2(phaseT.mul(0.2), 0))).mul(0.35));
      // Map fbm ~[0,1] to a multiplier around 1, scaled by the dispersion knob.
      const disperse = float(1).sub(uDispersion.mul(fbm.sub(0.5)));

      // Parametric path p(s) = (0.5 + sin(s*2PI + uTime*0.3)*0.3, s), s in 0..1.
      // distToPath(uv) ~= MIN over fixed s-samples of |uv - p(s)|. We accumulate
      // density as the MAX over samples of exp(-dist/width), with OLDER samples
      // (lower s — the tail) faded so the HEAD (high s) is brightest.
      // (max/min over a reassigned TSL accumulator: annotate `any` per the
      // TSL-typing gotcha so strict tsc accepts the narrowing.)
      let density: any = float(0);
      for (let k = 0; k < SAMPLES; k++) {
        const s = k / (SAMPLES - 1); // 0 (tail) .. 1 (head)
        const px = float(0.5).add(sin(phaseT.mul(0.3).add(s * Math.PI * 2)).mul(0.3));
        const py = float(s);
        const d = length(coord.sub(vec2(px, py)));
        // exp(-dist/width): a bright core that falls off within ~width.
        const core = exp(d.div(uWidth.add(0.001)).negate());
        // Head bright, tail faint: fade factor rises with s.
        const fade = float(0.25 + 0.75 * s);
        density = density.max(core.mul(fade));
      }

      // Disperse the ribbon with the fbm field, then soften.
      const amount = density.mul(disperse.clamp(0, 1.5)).clamp(0, 1);

      // Soft grey-blue smoke; brighten faintly along the bright core.
      const colorNode = vec3(uR, uG, uB).add(vec3(0.08, 0.08, 0.1).mul(amount));
      const opacityNode = amount.clamp(0, 0.95);

      const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        // Stateful snaking trail — runs continuously off the time driver.
        duration: () => Infinity,
        seek: (t: number) => {
          uTime.value = t;
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 1);
          uWidth.value = num(params.width, 0.04);
          uDispersion.value = num(params.dispersion, 0.5);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 1);
          else if (id === 'width') uWidth.value = num(value, 0.04);
          else if (id === 'dispersion') uDispersion.value = num(value, 0.5);
          else if (id === 'tint' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uR.value = r;
            uG.value = g;
            uB.value = b;
          }
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.smokeTrail;
          mat.dispose();
        },
      };
    },
  ),
};
