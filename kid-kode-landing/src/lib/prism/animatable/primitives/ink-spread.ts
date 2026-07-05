// ink-spread — a drop of ink blooms across the plane, an organic stain growing
// from the center with a defined, ragged front. QUALITY-mode primitive (wave
// category). Swaps the host plane's material for a MeshBasicNodeMaterial
// (transparent); opacityNode is a smoothstep around a growing radius uniform
// (uRadius, advanced 0 -> ~0.95 over an eased phase in seek) of length(uv-0.5),
// perturbed by a multi-octave fbm field warped through depth so the boundary is
// organic, not a perfect circle. colorNode is a rich ink tint that deepens
// toward the core. seek() advances uRadius; onParamChange() updates the live
// uniforms. uRadius.value is stashed on target.userData as an observable.

import { Mesh, Color, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float } from 'three/tsl';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, clamp, phase, type ControlValue, type EaseName, type PrimitiveDefinition } from '../contract';

// Permissive chainable node alias — same TNode discipline as nebula.ts so the
// fbm helpers compose without fighting TSL's narrow per-call generics. The graph
// built is identical to the equivalent free-function form.
interface TNode {
  add: (x: TNode | number) => TNode;
  sub: (x: TNode | number) => TNode;
  mul: (x: TNode | number) => TNode;
  div: (x: TNode | number) => TNode;
  floor: () => TNode;
  fract: () => TNode;
  sin: () => TNode;
  dot: (x: TNode) => TNode;
  mix: (a: TNode, b: TNode | number) => TNode;
  smoothstep: (lo: TNode | number, hi: TNode | number) => TNode;
  clamp: (lo: number, hi: number) => TNode;
  pow: (e: number) => TNode;
  length: () => TNode;
  oneMinus: () => TNode;
  x: TNode;
  y: TNode;
}
type V = number | TNode;
const t2 = (x: V, y: V): TNode =>
  (vec2 as unknown as (a: unknown, b: unknown) => unknown)(x, y) as TNode;
const t3 = (r: V, g: V, b: V): TNode =>
  (vec3 as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(r, g, b) as TNode;
const f1 = (x: number): TNode => float(x) as unknown as TNode;

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.5, max: 6, step: 0.1, default: 2.2, unit: 's' },
  { id: 'edgeNoise', label: 'Edge Noise', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.5 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#1b2f6b' },
] as const;

export const inkSpreadPrimitive: PrimitiveDefinition = {
  name: 'ink-spread',
  label: 'Ink Spread',
  category: 'wave',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A drop of ink blooms across the surface, an organic stain growing from the center with a ragged, defined front.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'ink-spread', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#1b2f6b'));

      const uRadius = uniform(0); // grows 0 -> ~0.95 across the eased phase
      const uNoise = uniform(num(params.edgeNoise, 0.5));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Observable handle: stash the live radius value on shared userData so the
      // host (and CPU tests) can read the animation's progress.
      target.userData.inkRadius = 0;

      // --- multi-octave value-noise fbm (smooth Hermite, 5 octaves) ----------
      const hash = (p: TNode): TNode =>
        p.dot(t2(127.1, 311.7)).sin().mul(43758.5453).fract();

      const noise = (p: TNode): TNode => {
        const i = p.floor();
        const f = p.fract();
        const w = f.mul(f).mul(f1(3).sub(f.mul(2))); // f*f*(3-2f)
        const a = hash(i);
        const b = hash(i.add(t2(1, 0)));
        const c = hash(i.add(t2(0, 1)));
        const dd = hash(i.add(t2(1, 1)));
        const ab = a.mix(b, w.x);
        const cd = c.mix(dd, w.x);
        return ab.mix(cd, w.y);
      };

      const fbm = (p0: TNode): TNode => {
        let sum = f1(0);
        let amp = 0.5;
        let p = p0;
        for (let o = 0; o < 5; o++) {
          sum = sum.add(noise(p).mul(amp));
          p = p.mul(2.03);
          amp *= 0.5;
        }
        return sum;
      };

      // Centered uv -> distance from the drop origin.
      const u = uv() as unknown as TNode;
      const centered = t2(u.x.sub(0.5), u.y.sub(0.5));
      const d = centered.length();

      const uNoiseN = uNoise as unknown as TNode;
      const uRadiusN = uRadius as unknown as TNode;

      // Domain-warped fbm field: warp the sample point by a second fbm so the
      // stain boundary is a turbulent, organic edge (not a sine ripple).
      const warp = t2(
        fbm(centered.mul(3.4).add(t2(1.7, 9.2))),
        fbm(centered.mul(3.4).add(t2(5.3, 2.8))),
      );
      const field = fbm(centered.mul(4.2).add(warp.mul(1.6))).sub(0.5); // ~[-0.5,0.5]

      // Ragged radius: push the measured distance in/out by the field, scaled by
      // the edgeNoise knob. A wider scale gives a more torn, blotchy front.
      const raggedD = d.add(field.mul(uNoiseN).mul(0.34));

      // Stain coverage with a DEFINED edge: a tight smoothstep band makes the
      // front read crisply. Inner core stays fully opaque.
      const band = f1(0.045);
      const inner = uRadiusN.sub(band);
      const coverage = raggedD.smoothstep(uRadiusN, inner); // 1 inside, 0 beyond

      // A faint outer halo just past the front so the blot reads as wet ink
      // bleeding into the surface, lifting the formerly-too-faint look.
      const halo = raggedD.smoothstep(uRadiusN.add(0.12), uRadiusN).mul(0.28);
      const opacity = coverage.add(halo).clamp(0, 1);

      // --- colour: richer ink that deepens toward the core --------------------
      // Base tint (controllable). Core is a deeper, more saturated variant; the
      // wet front edge picks up a brighter rim so the boundary pops.
      // Brightened across the board so the ink front reads clearly on the dark
      // bg — base lifted, denser-but-not-black core, and a hot wet rim.
      const base = t3(uR as unknown as TNode, uG as unknown as TNode, uB as unknown as TNode)
        .mul(1.7)
        .add(0.05);
      const deep = base.mul(0.7); // darker, denser core (kept legible)
      const rim = base.mul(2.1).add(0.12); // brighter wet edge

      // Normalized position across the front: 0 at center, 1 at the moving edge.
      const edgeT = d.div(uRadiusN.add(0.001)).clamp(0, 1);
      // Internal density variation so the body isn't a flat fill.
      const grain = fbm(centered.mul(6.0).add(warp.mul(0.8))).mul(0.2).add(0.95);

      const body = deep.mix(base, edgeT.smoothstep(0.0, 0.7));
      const rimMix = edgeT.smoothstep(0.78, 1.0); // strong only near the front
      const col = body.mix(rim, rimMix).mul(grain);

      const colorNode = col as unknown as TNode;

      const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacity;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      const dur = () => num(params.duration, 2.2);

      const apply = (t: number) => {
        // Eased phase 0->1; radius blooms to ~0.95 (covers the centered plane's
        // corner-distance of ~0.707, so the stain fully fills before settling).
        const p = ease('easeOut' as EaseName, phase(t, dur()));
        const radius = p * 0.95;
        uRadius.value = radius;
        uNoise.value = clamp(num(params.edgeNoise, 0.5), 0, 1);
        target.userData.inkRadius = radius;
      };

      return {
        duration: dur,
        seek: (tt) => apply(tt),
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'edgeNoise') uNoise.value = clamp(num(value, 0.5), 0, 1);
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
          target.userData.inkRadius = 0;
        },
      };
    },
  ),
};
