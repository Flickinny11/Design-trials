// smoky-fire — a fire with heavy smoke: bright orange flames at the base feed a
// churning grey smoke column rising above. HARD / GPU primitive. Swaps the host
// plane's material for a MeshBasicNodeMaterial. The lower region renders flame
// (upward-advected value-noise through a blackbody-ish ramp, bright), the upper
// region renders smoke (fbm advected up, grey, lower alpha). A vertical
// smoothstep transition blends flame → smoke; smoke gets denser/greyer toward
// the top, flame brighter at the bottom. opacityNode combines both. seek()
// advances the time uniform; onParamChange() updates the live uniforms. Uniform
// handles are published on target.userData so a headless CPU test can observe
// the animation without a real GPU.
//
// DISTINCT from fire-flame (which is flame-only, additive, no smoke): this is a
// flame BASE plus a churning grey SMOKE COLUMN above it, normal-blended.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
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
  smoothstep,
  clamp as tslClamp,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'rise', label: 'Rise', type: 'knob', min: 0.2, max: 4, step: 0.1, default: 1.4 },
  {
    id: 'smokeAmount',
    label: 'Smoke',
    type: 'fader',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.6,
  },
  { id: 'turbulence', label: 'Turbulence', type: 'knob', min: 0.2, max: 3, step: 0.1, default: 1.3 },
] as const;

export const smokyFirePrimitive: PrimitiveDefinition = {
  name: 'smoky-fire',
  label: 'Smoky Fire',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A fire with heavy smoke — orange flames at the base feeding a churning grey smoke column rising above.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'smoky-fire', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uRise = uniform(num(params.rise, 1.4));
      const uSmoke = uniform(num(params.smokeAmount, 0.6));
      const uTurb = uniform(num(params.turbulence, 1.3));

      // Publish handles so the CPU test (and host) can observe state.
      target.userData.smokyFire = { uTime, uRise, uSmoke, uTurb };

      // ── deterministic TSL value-noise + fbm (no Math.random in shader) ──────
      // TSL node types are intentionally loose here (cast to a generic node) so
      // strict typing of vec2() join-nodes does not pin helper params — mirrors
      // caustics.ts / fire-flame.ts casting discipline.
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
        const u = f.mul(f).mul(float(3).sub(f.mul(2)));
        const a = hash(i);
        const b = hash(i.add(vec2(1, 0)));
        const c = hash(i.add(vec2(0, 1)));
        const d = hash(i.add(vec2(1, 1)));
        const x1 = mix(a, b, u.x);
        const x2 = mix(c, d, u.x);
        return mix(x1, x2, u.y);
      };
      // 4-octave fbm. Accumulator annotated `any` so reassigning the fluent TSL
      // chain doesn't trip the narrow VarNode typing under strict tsc.
      const fbm = (p0: unknown, drift: TVec) => {
        const p = asNode(p0);
        let acc: any = noise(p).mul(0.5);
        acc = acc.add(noise(p.mul(2.02).add(drift.mul(0.5))).mul(0.25));
        acc = acc.add(noise(p.mul(4.03).sub(drift.mul(0.8))).mul(0.15));
        acc = acc.add(noise(p.mul(8.01).add(drift.mul(0.3))).mul(0.1));
        return acc;
      };

      const u = uv();
      const t = uTime;

      // ── FLAME (lower region): noise advected upward fast, blackbody palette ──
      const flameDrift = vec2(float(0), t.mul(uRise).mul(2.2));
      const flameCoord = vec2(u.x.mul(uTurb).mul(3.2), u.y.mul(uTurb).mul(4.5).sub(flameDrift.y));
      const flameNoise = fbm(flameCoord, vec2(t.mul(0.4), t));
      // Vertical flame envelope: bright/wide at the base, narrowing & fading up.
      const flameBase = smoothstep(float(0.95), float(0.0), u.y); // 1 at base → 0 mid/top
      const centerDist = u.x.sub(0.5).abs();
      const flameWidth = mix(float(0.5), float(0.14), tslClamp(u.y.mul(1.6), float(0), float(1)));
      const flameSide = smoothstep(flameWidth, flameWidth.mul(0.4), centerDist);
      const flameThresh = u.y.mul(0.6).add(0.1);
      const flameRaw = max(flameNoise.mul(flameBase).mul(flameSide).sub(flameThresh), float(0)).mul(3.4);
      const flame = tslClamp(flameRaw, float(0), float(1));
      // Blackbody ramp: red → orange → yellow → white-hot core (brighter low).
      const fRed = vec3(0.85, 0.07, 0.02);
      const fOrange = vec3(1.0, 0.4, 0.05);
      const fYellow = vec3(1.0, 0.84, 0.26);
      const fWhite = vec3(1.0, 0.97, 0.82);
      const fr1 = mix(fRed, fOrange, smoothstep(float(0.0), float(0.4), flame));
      const fr2 = mix(fr1, fYellow, smoothstep(float(0.35), float(0.72), flame));
      const flameColor = mix(fr2, fWhite, smoothstep(float(0.7), float(1.0), flame));

      // ── SMOKE (upper region): fbm advected up slower, grey, denser toward top ─
      const smokeDrift = vec2(t.mul(0.25).mul(uRise), t.mul(uRise).mul(1.1));
      const smokeCoord = vec2(u.x.mul(uTurb).mul(2.6), u.y.mul(uTurb).mul(2.8).sub(smokeDrift.y));
      const smokeNoise = fbm(smokeCoord, vec2(smokeDrift.x, smokeDrift.y.mul(0.6)));
      // Smoke presence grows with height: little at the base, dense up top.
      const smokeRamp = smoothstep(float(0.18), float(0.95), u.y);
      // Greyness deepens toward the top (lighter mid → darker grey high).
      const smokeGrey = mix(float(0.42), float(0.16), tslClamp(u.y, float(0), float(1)));
      const smokeColor = vec3(smokeGrey, smokeGrey.mul(0.98), smokeGrey.mul(0.96));
      const smokeDensity = tslClamp(
        smokeNoise.mul(smokeRamp).mul(uSmoke).mul(1.6),
        float(0),
        float(1),
      );

      // ── Vertical transition: flame dominates low, smoke dominates high ──────
      // smokeAmount also pulls the transition lower (more smoke = earlier).
      const transLow = mix(float(0.55), float(0.22), uSmoke);
      const toSmoke = smoothstep(transLow, transLow.add(0.35), u.y);

      // Blend flame & smoke colors by the vertical transition.
      const colorNode = mix(flameColor, smokeColor, toSmoke);

      // Combined opacity: flame alpha where flame dominates, smoke alpha where
      // smoke dominates. Flame fades out as we transition up; smoke fades in.
      const flameAlpha = flame.mul(float(1).sub(toSmoke));
      const smokeAlpha = smokeDensity.mul(toSmoke);
      const opacityNode = tslClamp(max(flameAlpha.mul(1.3), smokeAlpha), float(0), float(1));

      const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        // Looping, time-driven effect — purely stateful.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uRise.value = num(params.rise, 1.4);
          uSmoke.value = num(params.smokeAmount, 0.6);
          uTurb.value = num(params.turbulence, 1.3);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'rise') uRise.value = num(value, 1.4);
          else if (id === 'smokeAmount') uSmoke.value = num(value, 0.6);
          else if (id === 'turbulence') uTurb.value = num(value, 1.3);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
          delete target.userData.smokyFire;
        },
      };
    },
  ),
};
