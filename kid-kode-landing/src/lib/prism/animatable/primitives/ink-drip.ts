// ink-drip — ink bleeds DOWNWARD in dripping tendrils: several vertical drip
// columns at fixed x positions, each finger of dark fluid creeping down and
// spreading with organic fbm-modulated edges. HARD / smoke primitive. Swaps the
// host plane's material for a MeshBasicNodeMaterial whose opacityNode is the max
// over columns of a downward-growing finger mask; colorNode is a dark ink tint.
//
// Per column c at fixed x_c, reach grows with time:
//   reach_c = clamp((uTime - delay_c) * speed, 0, 1)
// and a finger fills the band uv.y in [1 - reach, 1] from the TOP downward via
//   finger = smoothstep(reach, reach - soft, uv.y)
// (uv.y measured from the top: top = 1, bottom = 0), gated by a column-width
// window modulated by fbm so the tendril edge wavers organically. density is the
// max over columns; alpha = density. DISTINCT from ink-spread (radial): gravity
// pulls every finger straight down.
//
// Uniform handles are published on target.userData so the CPU conformance test
// can observe a concrete .value change across the timeline (headless has no GPU
// to read pixels from). seek() advances uTime and reads knobs live so control
// tweaks apply on the next frame with no rebuild; onParamChange() mirrors them.

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
  mix,
  abs,
  max,
  clamp as tslClamp,
  smoothstep,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

/** Plain-JS fractional part (deterministic per-column scalars; not a TSL node). */
const jsFract = (x: number): number => x - Math.floor(x);

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 3, step: 0.05, default: 0.7 },
  { id: 'columns', label: 'Columns', type: 'knob', min: 3, max: 10, step: 1, default: 6 },
  { id: 'width', label: 'Width', type: 'knob', min: 0.2, max: 1.5, step: 0.05, default: 0.7 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#0a0814' },
] as const;

const MAX_COLUMNS = 10;

export const inkDripPrimitive: PrimitiveDefinition = {
  name: 'ink-drip',
  label: 'Ink Drip',
  category: 'smoke',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Ink bleeds downward in dripping tendrils, fingers of dark fluid creeping down and spreading.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'ink-drip', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#0a0814'));

      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 0.7));
      const uColumns = uniform(clamp(Math.round(num(params.columns, 6)), 3, MAX_COLUMNS));
      const uWidth = uniform(num(params.width, 0.7));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Publish handles so the host (and the CPU test) can observe .value.
      target.userData.uTime = uTime;
      target.userData.uSpeed = uSpeed;
      target.userData.uColumns = uColumns;
      target.userData.uWidth = uWidth;

      // TSL node objects carry deeply-narrowed generic types; treat them as an
      // opaque chainable node (mirrors caustics.ts / clouds.ts casting so tsc
      // strictness passes alongside vitest).
      type TNode = {
        add: (n: unknown) => TNode;
        sub: (n: unknown) => TNode;
        mul: (n: unknown) => TNode;
        div: (n: unknown) => TNode;
        x: TNode;
        y: TNode;
      };
      const N = (n: unknown): TNode => n as TNode;
      const E = (n: TNode): never => n as unknown as never;

      // Value-noise hash + 2D value noise + fbm (deterministic, GPU-cheap).
      const hash = (p: TNode): TNode => {
        const d = N(dot(E(p), vec2(127.1, 311.7) as unknown as never));
        const s = N(sin(E(d.mul(43758.5453))));
        return N(fract(E(s)));
      };
      const noise = (p: TNode): TNode => {
        const i = N(floor(E(p)));
        const f = N(fract(E(p)));
        const u = f.mul(f).mul(N(float(3)).sub(f.mul(2)));
        const a = hash(i);
        const b = hash(i.add(vec2(1, 0)));
        const c = hash(i.add(vec2(0, 1)));
        const d = hash(i.add(vec2(1, 1)));
        const x1 = N(mix(E(a), E(b), E(u.x)));
        const x2 = N(mix(E(c), E(d), E(u.x)));
        return N(mix(E(x1), E(x2), E(u.y)));
      };
      const fbm = (p: TNode): TNode => {
        let sum: any = N(float(0));
        let amp: any = N(float(0.5));
        let freq: any = p;
        for (let o = 0; o < 4; o++) {
          sum = sum.add(noise(freq).mul(amp));
          freq = freq.mul(2.03);
          amp = amp.mul(0.5);
        }
        return sum;
      };

      const u = N(uv());
      // uv.y measured from the TOP: top edge = 1, bottom edge = 0. Ink starts at
      // the top and creeps down, so "reach" of 1 means the finger fills the band.
      const yTop = N(float(1).sub(E(u.y)));

      const speed = uSpeed;
      const widthU = uWidth;

      // density accumulates as the MAX over up to MAX_COLUMNS drip columns; a
      // column only contributes when its index < uColumns (active count).
      let density: any = N(float(0));

      for (let cIdx = 0; cIdx < MAX_COLUMNS; cIdx++) {
        // Deterministic per-column params from the index (no Math.random).
        const fc = cIdx + 1;
        const xPos = (cIdx + 0.5) / MAX_COLUMNS; // fixed x in [0,1]
        // staggered delay + per-column speed jitter, deterministic.
        const delay = jsFract(Math.sin(fc * 12.9898) * 43758.5453) * 0.9;
        const spdJit = 0.65 + jsFract(Math.sin(fc * 78.233) * 12543.123) * 0.7;

        // active gate: 1 while cIdx < uColumns, else 0 (smoothstep over the
        // integer boundary so changing the columns knob reacts live).
        const active = N(
          smoothstep(
            E(N(uColumns).sub(float(0.5))),
            E(N(uColumns).add(float(0.5))),
            float(cIdx) as unknown as never,
          ),
        );
        const gate = N(float(1).sub(E(active))); // 1 when cIdx < columns

        // reach_c = clamp((uTime - delay) * speed * jitter, 0, 1)
        const reach = N(
          tslClamp(
            E(N(uTime).sub(float(delay)).mul(speed).mul(float(spdJit))),
            float(0) as unknown as never,
            float(1) as unknown as never,
          ),
        );

        // finger = smoothstep(reach, reach - soft, yTop) -> 1 above the front
        // (yTop < reach, i.e. nearer the top), 0 below it. Downward creep.
        const soft = N(float(0.18));
        const finger = N(
          smoothstep(E(reach), E(reach.sub(E(soft))), E(yTop)),
        );

        // organic horizontal extent: half-width modulated by fbm so the tendril
        // edge wavers as it descends. Wider knob -> fatter columns.
        const colHalf = N(float(0.5).div(float(MAX_COLUMNS)).mul(E(N(widthU))));
        const noiseField = fbm(N(vec2(float(xPos).mul(7) as unknown as never, E(yTop.mul(4)))));
        const wob = N(noiseField.sub(float(0.5)).mul(colHalf).mul(float(1.4)));
        const dx = N(abs(E(N(u.x).sub(float(xPos)).sub(E(wob)))));
        const band = N(
          smoothstep(E(colHalf), E(colHalf.mul(float(0.25))), E(dx)),
        );

        // column contribution; gated by active count.
        const col = N(finger.mul(E(band)).mul(E(gate)));
        density = N(max(E(N(density)), E(col)));
      }

      const dens = N(tslClamp(E(N(density)), float(0) as unknown as never, float(1) as unknown as never));
      const color = vec3(uR, uG, uB);

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = color;
      (mat as unknown as { opacityNode: unknown }).opacityNode = E(N(dens));

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 0.7);
          uColumns.value = clamp(Math.round(num(params.columns, 6)), 3, MAX_COLUMNS);
          uWidth.value = num(params.width, 0.7);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 0.7);
          else if (id === 'columns') uColumns.value = clamp(Math.round(num(value, 6)), 3, MAX_COLUMNS);
          else if (id === 'width') uWidth.value = num(value, 0.7);
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
