// fire-flame — licking flames rise with a hot gradient from a white/yellow core
// through orange to red flickering tips. HARD / GPU primitive. Swaps the host
// plane's material for a MeshBasicNodeMaterial (transparent, additive look)
// whose colorNode is fbm noise advected upward (uv.y - uTime*speed) masked by a
// vertical flame envelope (bright/wide at base, narrow/fading at top). The
// color ramp goes white -> yellow -> orange -> red toward the tips, and alpha
// fades at the top. seek() advances the time uniform; onParamChange() updates
// the live uniforms. Uniform handles are published on target.userData so a
// headless CPU test can observe the animation without a real GPU.

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
  smoothstep,
  clamp as tslClamp,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 4, step: 0.1, default: 1.4 },
  { id: 'height', label: 'Height', type: 'knob', min: 0.3, max: 2, step: 0.05, default: 1 },
  { id: 'turbulence', label: 'Turbulence', type: 'knob', min: 0.2, max: 3, step: 0.1, default: 1.3 },
] as const;

export const fireFlamePrimitive: PrimitiveDefinition = {
  name: 'fire-flame',
  label: 'Fire',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Licking flames rise with a hot gradient from white core to orange to red tips.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'fire-flame', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 1.4));
      const uHeight = uniform(num(params.height, 1));
      const uTurb = uniform(num(params.turbulence, 1.3));

      // Publish handles so the CPU test (and host) can observe state.
      target.userData.fireFlame = { uTime, uSpeed, uHeight, uTurb };

      // ── TSL value-noise + fbm (deterministic; no Math.random in shader) ────
      // TSL node types are intentionally loose here (cast to a generic node) so
      // strict typing of vec2() join-nodes does not pin helper params — mirrors
      // caustics.ts's casting discipline.
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
        // smooth interpolation weights
        const u = f.mul(f).mul(float(3).sub(f.mul(2)));
        const a = hash(i);
        const b = hash(i.add(vec2(1, 0)));
        const c = hash(i.add(vec2(0, 1)));
        const d = hash(i.add(vec2(1, 1)));
        const x1 = mix(a, b, u.x);
        const x2 = mix(c, d, u.x);
        return mix(x1, x2, u.y);
      };

      const u = uv();
      const t = uTime.mul(uSpeed);

      // Advect the noise field upward over time; turbulence scales the field
      // frequency. Flames "lick" upward as uv.y - t scrolls the pattern.
      const flow = vec2(u.x.mul(uTurb).mul(3), u.y.mul(uTurb).mul(4).sub(t.mul(2)));

      // fbm: 4 octaves.
      const n1 = noise(flow);
      const n2 = noise(flow.mul(2.03).add(vec2(t.mul(0.5), t))).mul(0.5);
      const n3 = noise(flow.mul(4.01).sub(vec2(t, t.mul(0.7)))).mul(0.25);
      const n4 = noise(flow.mul(8.05).add(vec2(t.mul(0.3), t.mul(1.7)))).mul(0.125);
      const fbm = n1.add(n2).add(n3).add(n4).mul(float(1).div(1.875));

      // Vertical flame envelope: wide/bright at the base (uv.y≈0), narrowing and
      // fading toward the top (uv.y≈1). uHeight stretches how high flames reach.
      const yUp = u.y.div(max(uHeight, float(0.001)));
      const baseGlow = smoothstep(float(1.05), float(0.0), yUp); // 1 at base → 0 at top
      // Horizontal narrowing: flame body pinches toward the center as it rises.
      const centerDist = u.x.sub(0.5).abs();
      const width = mix(float(0.55), float(0.12), tslClamp(yUp, float(0), float(1)));
      const sideMask = smoothstep(width, width.mul(0.4), centerDist);

      // Combine noise with the envelope; subtract a rising threshold so the
      // flame tongues break up and flicker near the top.
      const threshold = yUp.mul(0.55).add(0.12);
      const flame = max(fbm.mul(baseGlow).mul(sideMask).sub(threshold), float(0)).mul(3.2);
      const fl = tslClamp(flame, float(0), float(1));

      // Color ramp: red (tips) → orange → yellow → white (core/hot).
      const red = vec3(0.85, 0.06, 0.02);
      const orange = vec3(1.0, 0.42, 0.05);
      const yellow = vec3(1.0, 0.85, 0.25);
      const white = vec3(1.0, 0.98, 0.85);
      const ramp1 = mix(red, orange, smoothstep(float(0.0), float(0.4), fl));
      const ramp2 = mix(ramp1, yellow, smoothstep(float(0.35), float(0.72), fl));
      const ramp3 = mix(ramp2, white, smoothstep(float(0.7), float(1.0), fl));
      // Flicker the tip color with a little temporal cosine so the tips dance.
      const flick = cos(uTime.mul(uSpeed).mul(6).add(u.x.mul(9))).mul(0.5).add(0.5).mul(0.12);
      const colorNode = ramp3.mul(float(1).add(flick));

      // Alpha: flame intensity, additionally faded toward the top so tips dissolve.
      const topFade = smoothstep(float(1.0), float(0.25), yUp);
      const opacityNode = tslClamp(fl.mul(1.3).mul(topFade), float(0), float(1));

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
        // Looping, time-driven effect — purely stateful.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 1.4);
          uHeight.value = num(params.height, 1);
          uTurb.value = num(params.turbulence, 1.3);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 1.4);
          else if (id === 'height') uHeight.value = num(value, 1);
          else if (id === 'turbulence') uTurb.value = num(value, 1.3);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
          delete target.userData.fireFlame;
        },
      };
    },
  ),
};
