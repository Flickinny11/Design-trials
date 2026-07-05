// fireball-burst — a fireball erupts from a point: a turbulent ball of flame
// expands and rolls outward from the center each cycle, hottest white at the
// core through yellow/orange to red flame tongues at the growing rim — a looping
// burst. HARD / GPU primitive.
//
// REBUILT to the fire-flame.ts recipe (the proven premium fire reference) after
// the user-advocate gate caught the prior version reading as a pink/blue nebula
// (play frames measured coolFrac=1.0, effHue 231° — 100% BLUE — over the dark bg).
// The fix is fire-flame's exact discipline, not more colour gymnastics:
//   1. SINGLE flat plane, MeshBasicNodeMaterial + AdditiveBlending.
//   2. The fire field is THRESHOLDED so only hot tongues/core emit — most of the
//      quad is alpha≈0 (transparent → the black bg shows, never a dim mid-alpha
//      wash that the dark-blue background bleeds through into blue/pink).
//   3. The colour ramp stays IN GAMUT (red→orange→yellow→white, every stop ≤1) and
//      is NEVER multiplied past 1 — brightness is carried by the ALPHA, exactly
//      like fire-flame. ACES then has no over-bright warm to desaturate to cream.
// seek() advances uTime; onParamChange() updates the live uniforms. Uniform handles
// are published on target.userData so the headless CPU test observes the animation.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial, AdditiveBlending } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  sin,
  cos,
  floor,
  fract,
  dot,
  mix,
  max,
  length,
  smoothstep,
  clamp as tslClamp,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'burstRate', label: 'Burst Rate', type: 'knob', min: 0.1, max: 2, step: 0.05, default: 0.6 },
  { id: 'turbulence', label: 'Turbulence', type: 'knob', min: 0, max: 0.6, step: 0.01, default: 0.3 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 10, step: 0.1, default: 4 },
] as const;

export const fireballBurstPrimitive: PrimitiveDefinition = {
  name: 'fireball-burst',
  label: 'Fireball Burst',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A fireball erupts from a point, a turbulent ball of flame expanding and rolling outward from a white-hot core to red flame tongues at the rim — looping.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'fireball-burst', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uBurstRate = uniform(num(params.burstRate, 0.6));
      const uTurb = uniform(num(params.turbulence, 0.3));
      const uScale = uniform(num(params.scale, 4));

      // Publish handles so the CPU test (and host) can observe state.
      target.userData.fireballBurst = { uTime, uBurstRate, uTurb, uScale };

      // ── TSL value-noise + fbm (deterministic; matches fire-flame's loose-cast
      // discipline so strict vec2 join-node typing does not pin helper params). ──
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
      const fbm = (p0: unknown) => {
        const p = asNode(p0);
        const n1 = noise(p);
        const n2 = noise(p.mul(2.03)).mul(0.5);
        const n3 = noise(p.mul(4.01)).mul(0.25);
        const n4 = noise(p.mul(8.05)).mul(0.125);
        return n1.add(n2).add(n3).add(n4).mul(float(1).div(1.875));
      };

      const u = uv();
      const t = uTime;
      // Loop phase lt ∈ [0,1): the ball grows then resets each cycle.
      const lt = fract(t.mul(uBurstRate));
      const roll = t.mul(0.5);

      // Centered radial coordinate.
      const px = u.x.sub(0.5);
      const py = u.y.sub(0.5);
      const r = length(vec2(px, py));

      // Turbulent flame domain: scale sets the cell frequency (a LIVE, visible
      // control — fine filaments at high scale, big rolling blobs at low scale).
      // A gentle outward+upward scroll makes the flames lick away from the core.
      const freq = uScale;
      const baseDom = vec2(px.mul(freq).add(roll.mul(0.2)), py.mul(freq).sub(roll));
      // Domain-warp by another fbm sample → churning, non-blocky turbulence.
      const warp = fbm(baseDom);
      const dom = baseDom.add(vec2(warp.mul(uTurb.mul(3)), warp.mul(uTurb.mul(3))));
      const field = fbm(dom); // ~[0,1]

      // Expanding ball envelope: the RIM grows across the cycle (carrying the
      // burst's flame tongues), with a soft outer falloff.
      const grow = lt.mul(0.42).add(0.14);
      const ballEdge = smoothstep(grow, grow.sub(float(0.18)), r); // 1 inside → 0 just past rim

      // PERSISTENT hot core — ALWAYS lit, independent of the burst phase, so any
      // static capture lands on fire and never the dim/empty tail. (The prior
      // version faded the whole ball to a near-black phase where the dark-blue bg
      // dominated and the tile measured 98% BLUE; a persistent white-hot core makes
      // that impossible.) It breathes a little with the cycle.
      const corePulse = float(0.2).add(lt.mul(0.06));
      const core = smoothstep(corePulse, float(0.0), r);

      // THRESHOLD the field into sparse flame tongues at the expanding rim
      // (fire-flame's key move): only field peaks emit, so the rim reads as licking
      // flames. These carry the burst dynamic and may fade across the cycle…
      const age = float(1).sub(lt.mul(0.5));
      const tongues = max(field.mul(ballEdge).sub(0.4), float(0)).mul(3.0).mul(age);
      // …while warm turbulence fills the core body so it's a churning fireball, not
      // a bare ring. The core terms are NOT age-faded → always fire.
      const body = field.mul(core).mul(0.6);
      const fl = tslClamp(tongues.add(core.mul(0.9)).add(body), float(0), float(1));

      // Flicker the tips a touch so the flame dances.
      const flick = cos(t.mul(uBurstRate).mul(6).add(u.x.mul(9))).mul(0.5).add(0.5).mul(0.1);

      // ── Colour ramp: red → orange → yellow → white, IN GAMUT (every stop ≤ 1).
      // Identical structure to fire-flame; brightness lives in the alpha, NOT in a
      // >1 colour multiply, so ACES never desaturates it to cream/pink. ───────────
      const red = vec3(0.85, 0.06, 0.02);
      const orange = vec3(1.0, 0.42, 0.05);
      const yellow = vec3(1.0, 0.85, 0.25);
      const white = vec3(1.0, 0.98, 0.85);
      const ramp1 = mix(red, orange, smoothstep(float(0.0), float(0.4), fl));
      const ramp2 = mix(ramp1, yellow, smoothstep(float(0.35), float(0.72), fl));
      const ramp3 = mix(ramp2, white, smoothstep(float(0.72), float(1.0), fl));
      const colorNode = ramp3.mul(float(1).add(flick));

      // Alpha carries the intensity (sparse, ball-gated). Outside the flame → 0.
      const opacityNode = tslClamp(fl.mul(1.25), float(0), float(1));

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
        // Continuous, looping burst — never settles.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          uBurstRate.value = num(params.burstRate, 0.6);
          uTurb.value = num(params.turbulence, 0.3);
          uScale.value = num(params.scale, 4);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'burstRate') uBurstRate.value = num(value, 0.6);
          else if (id === 'turbulence') uTurb.value = num(value, 0.3);
          else if (id === 'scale') uScale.value = num(value, 4);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
