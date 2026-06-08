// smoked-glass — dark tinted smoked glass card: semi-transmissive with a smoky
// grey absorption (attenuationColor) and a faint internal cloudiness that
// slowly drifts with time. HARD / GPU primitive (glass). Swaps the host card
// panel's material for a MeshPhysicalNodeMaterial (transmission ~0.9, mid
// thickness, low-mid roughness, dark grey attenuationColor). A subtle emissive
// fbm — built in 'three/tsl' and driven by a uTime uniform — adds the slowly
// drifting internal smokiness. seek() advances uTime (reads knob params live);
// onParamChange() mirrors the structural uniforms. DISTINCT from frosted-glass
// (white roughness clouding) — this is dark smoky absorption, not frost.

import { Mesh, Color, type Material } from 'three';
import { MeshPhysicalNodeMaterial } from 'three/webgpu';
import {
  uniform,
  positionLocal,
  float,
  vec2,
  vec3,
  sin,
  dot,
  fract,
  floor,
  mix,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'tint', label: 'Tint', type: 'color', default: '#2a2c30' },
  { id: 'thickness', label: 'Thickness', type: 'fader', min: 0.2, max: 3, step: 0.05, default: 1.2 },
  { id: 'cloudiness', label: 'Cloudiness', type: 'knob', min: 0, max: 0.4, step: 0.005, default: 0.18 },
] as const;

export const smokedGlassPrimitive: PrimitiveDefinition = {
  name: 'smoked-glass',
  label: 'Smoked Glass',
  category: 'glass',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'Dark tinted smoked glass — semi-transmissive with a smoky grey absorption and soft moving internal cloudiness.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'smoked-glass', category: 'glass', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [tr, tg, tb] = rgb(str(params.tint, '#2a2c30'));

      // uTime drives the slow internal cloud drift; uCloud scales its strength.
      const uTime = uniform(0);
      const uCloud = uniform(num(params.cloudiness, 0.18));
      const uTintR = uniform(tr);
      const uTintG = uniform(tg);
      const uTintB = uniform(tb);

      // Deterministic value-noise + 3-octave fbm in TSL (no RNG, no GLSL).
      // Params/intermediates typed `any` to dodge strict VarNode narrowing
      // (same casting discipline as the TSL reference primitives).
      const hash = (p: any): any =>
        fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));

      const valueNoise = (p: any): any => {
        const i: any = floor(p);
        const f: any = fract(p);
        // smooth interpolation weights
        const u: any = f.mul(f).mul(f.mul(-2).add(3));
        const a = hash(i);
        const b = hash(i.add(vec2(1, 0)));
        const c = hash(i.add(vec2(0, 1)));
        const d = hash(i.add(vec2(1, 1)));
        const ab = mix(a, b, u.x);
        const cd = mix(c, d, u.x);
        return mix(ab, cd, u.y);
      };

      // Sample over the card face, drifting the noise field with uTime so the
      // internal cloudiness slowly migrates. fbm accumulator typed `any` to
      // dodge strict VarNode narrowing on reassignment.
      const baseUv = vec2(positionLocal.x.mul(2.4), positionLocal.y.mul(2.4));
      const drift = vec2(uTime.mul(0.07), uTime.mul(-0.045));
      let fbm: any = float(0);
      let amp: any = float(0.5);
      let freq: any = float(1.0);
      for (let o = 0; o < 3; o++) {
        fbm = fbm.add(valueNoise(baseUv.mul(freq).add(drift.mul(freq))).mul(amp));
        amp = amp.mul(0.5);
        freq = freq.mul(2.0);
      }
      // Center the cloud around 0 then scale by cloudiness — faint internal haze.
      const cloud = fbm.sub(0.5).mul(uCloud);

      // Emissive smoky haze: a dim grey lifted by the drifting cloud field. Kept
      // subtle so it reads as internal cloudiness inside dark tinted glass.
      const haze = vec3(0.32, 0.33, 0.35).mul(cloud.add(uCloud).max(float(0)));

      const mat = new MeshPhysicalNodeMaterial({
        transparent: true,
        transmission: 0.9,
        thickness: num(params.thickness, 1.2),
        roughness: 0.28,
        metalness: 0.0,
        ior: 1.5,
        envMapIntensity: 1.1,
      });
      // Dark grey smoky absorption — the load-bearing distinction from frost.
      mat.attenuationColor = new Color(tr, tg, tb);
      mat.attenuationDistance = 0.6;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = haze;
      // Faint tint on the surface color too, so the card reads dark/smoky.
      (mat as unknown as { colorNode: unknown }).colorNode = mix(
        vec3(uTintR, uTintG, uTintB),
        haze.add(vec3(uTintR, uTintG, uTintB)),
        float(0.5),
      );

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles to host scratch space (contract: userData holds
      // uniform handles). uTime drift is the load-bearing observable.
      target.userData.uTime = uTime;
      target.userData.uCloud = uCloud;

      return {
        // Continuous slow drift → Infinity (purely stateful, per contract).
        duration: () => Infinity,
        seek: (t) => {
          uTime.value = t;
          // Read knob params live so control changes apply with no rebuild.
          uCloud.value = num(params.cloudiness, 0.18);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'cloudiness') uCloud.value = num(value, 0.18);
          else if (id === 'thickness') {
            (mat as unknown as { thickness: number }).thickness = num(value, 1.2);
          } else if (id === 'tint' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uTintR.value = r;
            uTintG.value = g;
            uTintB.value = b;
            mat.attenuationColor = new Color(r, g, b);
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
