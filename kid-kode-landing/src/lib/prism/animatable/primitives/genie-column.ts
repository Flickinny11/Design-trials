// genie-column — a twisting column of smoke rises and coils like a genie
// emerging from a lamp, braiding tighter as it ascends. HARD / GPU primitive
// (smoke category). Swaps the host plane's material for a MeshBasicNodeMaterial
// whose density is a tight column centered on a twisting x-axis:
//
//   cx   = 0.5 + sin(uv.y*coil - uTime*rise) * twist * uv.y   (braid grows w/ height)
//   dist = abs(uv.x - cx)
//   width tapers with height (tighter braid toward the crown)
//   density = smoothstep(width, 0, dist) * fbm(vec2(uv.x*4, uv.y*6 - uTime*rise))
//             * envelope(uv.y)
//
// warm-grey tint. seek() advances the time uniform; onParamChange() updates the
// live uniforms.
//
// DISTINCT from smoke-plume.ts (a LOOSE, billowing, widening plume) and
// wispy-smoke.ts (thin filaments): genie-column is a TIGHT, braiding, twisting
// COLUMN whose center serpentines harder as it climbs and whose body NARROWS
// toward the top — a coiling rope of smoke, not a spreading cloud.

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
// this by treating nodes opaquely and casting at the material-assignment
// boundary). We do the same: every node is an opaque `N` with chainable methods
// funnelled through `n()` so tsc never tries to unify the narrow generic
// variants.
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
  { id: 'rise', label: 'Rise', type: 'knob', min: 0.1, max: 3, step: 0.05, default: 1.0 },
  { id: 'coil', label: 'Coil', type: 'knob', min: 2, max: 10, step: 0.1, default: 5 },
  { id: 'twist', label: 'Twist', type: 'knob', min: 0, max: 0.4, step: 0.01, default: 0.22 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#a89c90' },
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
  // Reassigned fluent accumulator — annotate as `any` so the narrow VarNode
  // typing doesn't fail strict tsc (the splat-reveal / pool-caustics gotcha).
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

export const genieColumnPrimitive: PrimitiveDefinition = {
  name: 'genie-column',
  label: 'Genie Column',
  category: 'smoke',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A twisting column of smoke rises and coils like a genie emerging from a lamp, braiding as it ascends.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'genie-column', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#a89c90'));

      const uTime = uniform(0);
      const uRise = uniform(num(params.rise, 1.0));
      const uCoil = uniform(num(params.coil, 5));
      const uTwist = uniform(num(params.twist, 0.22));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Publish uniform handles so the host (and CPU tests) can observe motion.
      target.userData.genieColumn = { uTime, uRise, uCoil, uTwist };

      const u = uv();
      const ux = n(u).x;
      const uy = n(u).y;

      // ── Twisting column centerline ───────────────────────────────────────
      // The center x of the column serpentines with a phase set by height*coil
      // and advanced by time*rise. The twist AMPLITUDE grows with height (uv.y)
      // so the braid is tight at the base and swings wider as it climbs — a
      // coiling rope, not a static sine.
      const cx = n(float(0.5)).add(
        n(sin(uy.mul(uCoil).sub(n(uTime).mul(uRise)) as never)).mul(uTwist).mul(uy),
      );
      const dist = n(ux.sub(cx)).abs();

      // ── Body width tapers with height ────────────────────────────────────
      // Wide-ish at the base, narrowing toward the crown so the column reads as
      // a tightening braid that thins out as it ascends.
      const width = n(float(0.16)).sub(uy.mul(0.10));

      // 1 at the centerline, smoothly 0 past the (height-dependent) half-width.
      const body = n(
        float(1) as never,
      ).sub(
        n(smoothstep(float(0) as never, width as never, dist as never)),
      );

      // ── Turbulence advected upward ───────────────────────────────────────
      // uv.y - uTime*rise scrolls the noise downward so the smoke appears to
      // rise; sampled tighter in x (×4) than in y (×6) for a streaky braid.
      const noisePos = n(
        vec2(ux.mul(4) as never, uy.mul(6).sub(n(uTime).mul(uRise)) as never),
      );
      const turb = fbm(noisePos);

      // ── Vertical envelope ────────────────────────────────────────────────
      // Faint at the very base (the lamp's mouth) and the very top
      // (dissipation): a soft window so the column emerges and fades at the
      // crown rather than hard-edging the plane.
      const envelope = n(
        smoothstep(float(0) as never, float(0.14) as never, uy as never),
      ).mul(
        n(float(1)).sub(n(smoothstep(float(0.7) as never, float(1.1) as never, uy as never))),
      );

      const density = body.mul(turb).mul(envelope);

      // Warm-grey smoke; lift faintly where the braid is densest.
      const colorNode = vec3(uR, uG, uB).add(vec3(0.05, 0.045, 0.04).mul(density as never));
      const opacityNode = tslClamp(
        density.mul(1.4) as never,
        float(0) as never,
        float(0.92) as never,
      );

      const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        // Stateful, continuously coiling column — runs off the time driver.
        duration: () => Infinity,
        seek: (t: number) => {
          uTime.value = t;
          // Read params live so control changes apply without a rebuild.
          uRise.value = num(params.rise, 1.0);
          uCoil.value = num(params.coil, 5);
          uTwist.value = num(params.twist, 0.22);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'rise') uRise.value = num(value, 1.0);
          else if (id === 'coil') uCoil.value = num(value, 5);
          else if (id === 'twist') uTwist.value = num(value, 0.22);
          else if (id === 'tint' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uR.value = r;
            uG.value = g;
            uB.value = b;
          }
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.genieColumn;
          mat.dispose();
        },
      };
    },
  ),
};
