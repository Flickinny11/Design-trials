// heat-column — a shimmering column of rising heat-haze and embers glows over an
// unseen ember bed: a warm, ember-red base climbing through orange to a few
// near-white hot specks, the air wobbling and rising. HARD / GPU primitive.
// DISTINCT from fire-flame: no licking flame tongues, just a soft rising heat glow
// with sparse embers.
//
// REBUILT to the fire-flame.ts recipe after the user-advocate gate caught the
// prior version reading as a STATIC OLIVE-GREEN haze (measured effHue 58°,
// warmFrac 0.23) with two DEAD controls (rise, wobble registered no change). The
// fixes:
//   1. SINGLE flat plane, MeshBasicNodeMaterial + AdditiveBlending (no slab stack).
//   2. The warm field is alpha-gated and the colour ramp is strictly IN GAMUT and
//      strongly R-led (ember-red → orange → hot-gold), so there is NO mid value
//      where G approaches R — the olive cast is mathematically impossible. Never
//      multiplied past 1; brightness lives in the ALPHA (fire-flame discipline).
//   3. `rise` now also sets the column HEIGHT (taller at high rise) so it has an
//      unambiguous effect on a paused frame, not only on motion; `wobble` drives a
//      clear horizontal heat-shear; `intensity` scales the glow. All three LIVE.
// seek() advances uTime; onParamChange() updates the live uniforms. Uniform handles
// are published on target.userData for the headless CPU test.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial, AdditiveBlending } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  sin,
  floor,
  fract,
  dot,
  mix,
  max,
  pow,
  smoothstep,
  clamp as tslClamp,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'rise', label: 'Rise', type: 'knob', min: 0.1, max: 3, step: 0.05, default: 1 },
  { id: 'wobble', label: 'Wobble', type: 'knob', min: 0, max: 0.1, step: 0.005, default: 0.05 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 2, step: 0.05, default: 1 },
] as const;

export const heatColumnPrimitive: PrimitiveDefinition = {
  name: 'heat-column',
  label: 'Heat Column',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A shimmering column of rising heat-haze and embers glows over an unseen ember bed, the warm air distorting and wobbling upward from a glowing base.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'heat-column', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uRise = uniform(num(params.rise, 1));
      const uWobble = uniform(num(params.wobble, 0.05));
      const uIntensity = uniform(num(params.intensity, 1));

      // Publish uniform handles for the CPU test (and host introspection).
      target.userData.heatColumnUniforms = { uTime, uRise, uWobble, uIntensity };

      // ── TSL value-noise + fbm (fire-flame's loose-cast discipline). ───────────
      type TVec = ReturnType<typeof vec2>;
      const asNode = (p: unknown) => p as TVec;
      const hash = (p0: unknown) => {
        const p = asNode(p0);
        return fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
      };
      const noise = (p0: unknown) => {
        const p = asNode(p0);
        const i = floor(p);
        const f = fract(p);
        const w = f.mul(f).mul(float(3).sub(f.mul(2)));
        const a = hash(i);
        const b = hash(i.add(vec2(1, 0)));
        const c = hash(i.add(vec2(0, 1)));
        const d = hash(i.add(vec2(1, 1)));
        const x1 = mix(a, b, w.x);
        const x2 = mix(c, d, w.x);
        return mix(x1, x2, w.y);
      };
      const fbm = (p0: unknown) => {
        const p = asNode(p0);
        const n1 = noise(p);
        const n2 = noise(p.mul(2.02)).mul(0.5);
        const n3 = noise(p.mul(4.04)).mul(0.25);
        const n4 = noise(p.mul(8.01)).mul(0.125);
        return n1.add(n2).add(n3).add(n4).mul(float(1).div(1.875));
      };

      const u = uv();
      const t = uTime;

      // Heat-shimmer: shear x by a vertically-travelling wobble. uWobble is a clear,
      // LIVE amplitude — at high wobble the column visibly snakes.
      const cx = sin(u.y.mul(5).add(t.mul(1.3))).mul(uWobble.mul(3.0));
      const wx = u.x.add(cx);

      // Centered soft column envelope.
      const distC = wx.sub(0.5).abs();
      const column = smoothstep(float(0.42), float(0.06), distC); // 1 centre → 0 edges

      // Rising advection. uRise scrolls the field upward (motion) AND, below, sets
      // the column height — so it has a visible effect on a paused frame too.
      const dom = vec2(wx.mul(4), u.y.mul(5).sub(t.mul(uRise.mul(1.2))));
      const warp = fbm(dom);
      const turb = fbm(dom.add(vec2(warp.mul(1.3), warp.mul(1.3))));
      const fieldN = float(0.4).add(turb.mul(0.6)); // ~[0.4,1]

      // Vertical falloff: hot/bright at the base, fading up. uRise lowers the
      // exponent → a TALLER column at higher rise (unambiguous static signature).
      const riseClamped = tslClamp(uRise, float(0.3), float(3));
      const vert = pow(tslClamp(float(1).sub(u.y), float(0), float(1)), float(1.7).div(riseClamped));

      // Warm field, gated by the column. intensity scales the whole glow (LIVE).
      const heat = column.mul(vert).mul(fieldN).mul(uIntensity).mul(1.3);
      // Embers: sparse hot specks where the field peaks (thresholded → discrete).
      const ember = smoothstep(float(0.82), float(0.97), turb).mul(column).mul(vert).mul(0.9);
      const fl = tslClamp(heat.add(ember), float(0), float(1));

      // ── Warm ramp: ember-red → orange → hot-gold, IN GAMUT and strongly R-led at
      // every stop (G ≤ ~0.45·R until the near-white top), so an olive/green mid is
      // impossible. Brightness lives in the alpha, not a >1 colour multiply. ──────
      const emberRed = vec3(0.7, 0.07, 0.02);
      const orange = vec3(1.0, 0.4, 0.06);
      const hotGold = vec3(1.0, 0.82, 0.45);
      const ramp1 = mix(emberRed, orange, smoothstep(float(0.1), float(0.55), fl));
      const colorNode = mix(ramp1, hotGold, smoothstep(float(0.7), float(1.0), fl));

      // Alpha carries intensity; gated by the column shape so the rest is transparent.
      const opacityNode = tslClamp(fl.mul(1.2), float(0), float(1));

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        // Stateful / looping upward advection — animate continuously.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          uRise.value = num(params.rise, 1);
          uWobble.value = num(params.wobble, 0.05);
          uIntensity.value = num(params.intensity, 1);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'rise') uRise.value = num(value, 1);
          else if (id === 'wobble') uWobble.value = num(value, 0.05);
          else if (id === 'intensity') uIntensity.value = num(value, 1);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.heatColumnUniforms;
          mat.dispose();
        },
      };
    },
  ),
};
