// smoke-burst — a poof of smoke bursts radially outward from the center,
// billowing turbulently then thinning away — looping. HARD / GPU primitive
// (smoke category). Swaps the host plane's material for a MeshBasicNodeMaterial
// whose density field is a growing radial shell that expands and fades within
// each burst cycle:
//   lt      = fract(uTime*burstRate)            (0..1 burst phase, loops)
//   r       = length(uv - 0.5)                  (radius from center)
//   grow    = lt*maxR                           (shell radius grows over burst)
//   noisy   = r + fbm(uv*scale + uTime)*turb    (turbulent, broken edges)
//   density = smoothstep(grow, grow-edge, noisy) * (1 - lt)
// The smoothstep gives 1 inside the expanding shell and 0 past its turbulent
// edge; (1 - lt) fades the whole poof out as the burst completes, so each cycle
// reads as a fresh outward puff that thins to nothing then restarts. seek()
// advances the time uniform; onParamChange() updates the live uniforms.
//
// DISTINCT from smoke-plume.ts (a directed, curling rising COLUMN) and
// smoke-ring.ts (a single toroidal ring that translates UP): this is a RADIAL
// expanding poof centered on the plane — it grows outward in all directions
// from the center and fades, with no preferred direction.

import { Mesh, Color, type Material } from 'three';
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
  length,
  smoothstep,
  clamp as tslClamp,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

// The three/tsl chain types are loose and fight strict tsc (caustics.ts dodges
// this by casting at the material-assignment boundary; smoke-plume.ts funnels
// builder calls through an opaque `N`). We do the same here.
type N = {
  add: (o: unknown) => N;
  sub: (o: unknown) => N;
  mul: (o: unknown) => N;
  abs: () => N;
  x: N;
  y: N;
};
const n = (node: unknown): N => node as N;

const SCHEMA = [
  { id: 'burstRate', label: 'Burst Rate', type: 'knob', min: 0.1, max: 2, step: 0.05, default: 0.6, unit: 'hz' },
  { id: 'turbulence', label: 'Turbulence', type: 'knob', min: 0, max: 0.6, step: 0.01, default: 0.22 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 10, step: 0.1, default: 4 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#aab0bf' },
] as const;

// Value-noise hash + fbm, built purely from TSL nodes so it runs on the GPU.
// Deterministic — no Math.random.
function hash(p: N): N {
  const d = n(dot(p as never, vec2(127.1, 311.7) as never));
  return n(fract(n(sin(d as never)).mul(43758.5453) as never));
}

function valueNoise(p: N): N {
  const i = n(floor(p as never));
  const f = n(fract(p as never));
  const u = f.mul(f).mul(n(float(3)).sub(f.mul(2)));

  const a = hash(i);
  const b = hash(i.add(vec2(1, 0)));
  const c = hash(i.add(vec2(0, 1)));
  const d = hash(i.add(vec2(1, 1)));

  const ab = n(mix(a as never, b as never, u.x as never));
  const cd = n(mix(c as never, d as never, u.x as never));
  return n(mix(ab as never, cd as never, u.y as never));
}

function fbm(p: N): N {
  let value: N = n(float(0));
  let amp = 0.5;
  let freq = 1.0;
  for (let o = 0; o < 4; o++) {
    const sample = valueNoise(p.mul(freq)).mul(amp);
    value = value.add(sample);
    amp *= 0.5;
    freq *= 2.0;
  }
  return value;
}

export const smokeBurstPrimitive: PrimitiveDefinition = {
  name: 'smoke-burst',
  label: 'Smoke Burst',
  category: 'smoke',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A poof of smoke bursts outward from the center, billowing turbulently then thinning away — looping.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'smoke-burst', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#aab0bf'));

      const uTime = uniform(0);
      const uBurstRate = uniform(num(params.burstRate, 0.6));
      const uTurb = uniform(num(params.turbulence, 0.22));
      const uScale = uniform(num(params.scale, 4));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Publish uniform handles so the host (and CPU tests) can observe motion.
      target.userData.smokeBurst = { uTime, uBurstRate, uTurb, uScale };

      const u = uv();
      const ux = n(u).x;
      const uy = n(u).y;

      // Burst phase: fract(uTime*burstRate) loops 0..1 — each cycle is one poof.
      const lt = n(fract(n(uTime).mul(uBurstRate) as never));

      // Radius from the center of the plane.
      const r = n(length(n(vec2(ux.sub(0.5) as never, uy.sub(0.5) as never)) as never));

      // The shell radius grows from 0 outward over the burst. maxR ~0.75 so the
      // poof reaches well past the plane edge by the end of its cycle.
      const maxR = float(0.75);
      const grow = lt.mul(maxR);

      // Turbulent edge: add an fbm field (advected with time so the billow churns)
      // to the radius before the smoothstep, breaking the shell into puffy lobes.
      const noise = fbm(
        n(vec2(ux as never, uy as never)).mul(uScale).add(n(uTime).mul(0.5)),
      );
      const noisy = r.add(noise.mul(uTurb));

      // 1 inside the expanding shell, smoothly 0 past its (turbulent) edge.
      const edge = float(0.28);
      const shell = n(
        smoothstep(grow as never, n(grow).sub(edge) as never, noisy as never),
      );

      // Fade the whole poof out across the burst (densest at the start, gone by
      // the end) so each loop is a fresh expand-and-thin puff.
      const fade = n(float(1)).sub(lt);
      const density = shell.mul(fade);

      // Smoke greys; lift faintly where the poof is densest.
      const colorNode = vec3(uR, uG, uB).add(
        vec3(0.07, 0.07, 0.08).mul(density as never),
      );
      const opacityNode = tslClamp(
        density.mul(1.25) as never,
        float(0) as never,
        float(0.92) as never,
      );

      const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        // Stateful, continuously looping burst — runs off the time driver.
        duration: () => Infinity,
        seek: (t: number) => {
          uTime.value = t;
          // Read params live so control changes apply without a rebuild.
          uBurstRate.value = num(params.burstRate, 0.6);
          uTurb.value = num(params.turbulence, 0.22);
          uScale.value = num(params.scale, 4);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'burstRate') uBurstRate.value = num(value, 0.6);
          else if (id === 'turbulence') uTurb.value = num(value, 0.22);
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
          delete target.userData.smokeBurst;
          mat.dispose();
        },
      };
    },
  ),
};
