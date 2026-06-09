// smoke — a column of soft, rising grey-blue smoke with the ILLUSION of real
// volume built ENTIRELY IN-SHADER on ONE flat quad (subject:'plane',
// non-volumetric → no slab stack, so there are NO slab seams / shelf banding by
// construction).
//
// ROUND-2 FIX (user-advocate gate): the round-1 build used an INLINE low-frequency
// value-noise fbm with cubic-Hermite interpolation. Full-frame, that exposes the
// noise's axis-aligned integer LATTICE as a blocky brick/shelf grid (bandingScore
// ~0.33) and the composite went muddy warm-grey. The fix sources ALL noise from the
// shared `_volume-fbm` helper instead: rotated-octave + QUINTIC (C2-continuous) +
// DOMAIN-WARPED value noise. Per-octave rotation means successive octaves never
// align into a square grid, quintic interp removes inter-cell derivative seams, and
// the warp folds the large-scale "plume body" structure into organic blobs — so
// there is no brick lattice at ANY frequency. Large-scale plume structure comes from
// `fbmWarped` (low warp), NEVER a raw low-frequency value-noise term. The noise
// DOMAIN is fully continuous across the quad — no centered `uv-0.5`/`.abs()` term
// (which would fold a mirror seam down the middle). The palette is a soft, slightly
// COOL grey-blue, with gentle internal lit contrast for volume and a soft grey floor
// so thin smoke never crushes to black. Rising-plume motion + vertical fade.
//
// seek() advances uTime; onParamChange() updates live speed/density/rise/tint
// uniforms. Mirrors fire-flame.ts in alpha-gate / material-restore discipline.

import { Mesh, Color, NormalBlending, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float } from 'three/tsl';
import { defineAnimatable } from '../base';
import {
  num,
  str,
  type ControlValue,
  type PrimitiveDefinition,
} from '../contract';
import { fbmRot, fbmWarped } from './_volume-fbm';

// See nebula.ts / fire-flame.ts: TSL's per-call generic typing is far narrower
// than the runtime node graph it builds, so fbm/value-noise helpers that pass
// nodes through functions trip the strict overloads. We compose through one
// permissive chainable node alias (method-chaining only, which every TSL node
// supports) so the helpers compose without fighting the inferred VarNode
// generics. The graph is identical to the free-function form. (tsc strictness.)
interface TNode {
  add: (x: TNode | number) => TNode;
  sub: (x: TNode | number) => TNode;
  mul: (x: TNode | number) => TNode;
  div: (x: TNode | number) => TNode;
  mix: (a: TNode, b: TNode | number) => TNode;
  smoothstep: (lo: number, hi: number) => TNode;
  clamp: (lo: number, hi: number) => TNode;
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
// Source ALL noise from the shared rotated/quintic/warped helper (no square grid).
const warped = (p: TNode, warp: number, oct: number): TNode =>
  fbmWarped(p as unknown, warp, oct) as unknown as TNode;
const rotFbm = (p: TNode, oct: number): TNode =>
  fbmRot(p as unknown, oct) as unknown as TNode;

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 2, step: 0.05, default: 0.5 },
  { id: 'density', label: 'Density', type: 'knob', min: 0, max: 2, step: 0.05, default: 1 },
  { id: 'rise', label: 'Rise', type: 'knob', min: 0, max: 2, step: 0.05, default: 1 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#9aa6c8' },
] as const;

export const smokePrimitive: PrimitiveDefinition = {
  name: 'smoke',
  label: 'Smoke',
  category: 'smoke',
  difficulty: 'hard',
  subject: 'plane',
  // Single flat quad — the volume is an ILLUSION built in-shader from rotated,
  // quintic, domain-warped fbm. NOT the 5-slab stack (which read as shelf-seams),
  // and NOT inline low-frequency value noise (which read as a brick lattice).
  volumetric: false,
  defaultDriver: 'time',
  description:
    'A column of soft grey-blue smoke with in-shader volume: layered domain-warped fbm rises and curls with depth-faded internal contrast — a smooth rising plume, no slab seams.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'smoke', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#9aa6c8'));

      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 0.5));
      const uDensity = uniform(num(params.density, 1));
      const uRise = uniform(num(params.rise, 1));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      const uvN = uv() as unknown as TNode;
      const drift = (uTime as unknown as TNode).mul(uSpeed as unknown as TNode);
      const rise = uRise as unknown as TNode;

      // ── Continuous domain across the whole quad ───────────────────────────
      // Rising-plume scroll: SUBTRACT an upward drift from y so the field flows
      // up the quad. Higher layers scroll faster (read as nearer foreground).
      // Base frequency >= 7 so the noise cells are small; the helper's rotation +
      // quintic interp + warp guarantee no square grid shows at any octave.
      // NOTE: the domain is a plain scaled/scrolled uv — there is NO centered
      // `uv-0.5`/`.abs()` term anywhere (that would fold a mirror seam down the
      // middle of the plume). Continuous across the quad, left-to-right.
      const riseDrift = (off: number) => drift.mul(rise.mul(0.7).add(0.3)).mul(off);

      // BODY: the broad plume shape — sampled from `fbmWarped` (low warp), the
      // helper's domain-warped field. This is the large-scale structure; it is
      // NEVER a raw low-frequency value-noise term (that is the brick grid).
      const bodyDomain = t2(
        uvN.x.mul(7.2),
        uvN.y.mul(7.2).sub(riseDrift(1.0)),
      );
      const body = warped(bodyDomain, 0.85, 5);

      // MID curls: a second warped field, larger features, slower, offset, gives
      // billowing internal structure layered behind the fine wisps.
      const midDomain = t2(
        uvN.x.mul(11.5).add(31.7),
        uvN.y.mul(11.5).sub(riseDrift(1.35)).add(8.3),
      );
      const mid = warped(midDomain, 1.1, 5);

      // FRONT wisps: fine, fast rotated-fbm detail (no warp needed — the rotation
      // already breaks the grid) reading as the nearest curling tendrils.
      const frontDomain = t2(
        uvN.x.mul(16.0).sub(13.1),
        uvN.y.mul(16.0).sub(riseDrift(1.7)).sub(4.9),
      );
      const front = rotFbm(frontDomain, 5);

      // Composite back→front as translucent sheets (weights fall toward front).
      const layered = body
        .mul(0.6)
        .add(mid.mul(0.3))
        .add(front.mul(0.24))
        .clamp(0, 1);

      // ── Vertical shaping: rising plume, denser at base, thinning toward top ─
      const top = uvN.y; // 0 base → 1 top
      const riseReach = rise.mul(0.45).add(0.55); // how high the column carries
      const verticalFalloff = top.div(riseReach).clamp(0, 1).smoothstep(0.0, 1.0).oneMinus();
      // Emerge softly from the very bottom edge rather than clip flat at uv.y==0.
      const bottomFade = top.smoothstep(0.0, 0.12);

      const dens = layered
        .mul(verticalFalloff)
        .mul(bottomFade)
        .mul(uDensity as unknown as TNode)
        .clamp(0, 1);

      // Alpha-gate so smoke reads as soft puffs against the background, not a flat
      // rectangular wash (fire-flame discipline).
      const alpha = dens.smoothstep(0.05, 0.7).clamp(0, 1);

      // ── Colour: soft, slightly COOL grey-blue smoke with gentle internal lit
      //    contrast so it reads as a LIT volume. Front (fine) crests catch a touch
      //    of light; mid troughs recede and cool. Soft grey floor so thin smoke
      //    never goes black; never warm/olive. ──────────────────────────────────
      const tint = t3(uR as unknown as TNode, uG as unknown as TNode, uB as unknown as TNode);
      // Internal shading centred ~0: front crests brighten (+), mid troughs dim (−).
      const shade = front.sub(mid.mul(0.5)).mul(0.5); // ~[-0.4 .. +0.4]
      const litTint = tint.mul(f1(1).add(shade.mul(0.55))).clamp(0, 1);
      // Bright dense crests lift toward a cool blue-white highlight; cool grey-blue
      // floor keeps thin smoke a soft grey-blue rather than black or warm.
      const lit = litTint
        .mix(t3(0.85, 0.88, 0.96), dens.smoothstep(0.45, 1.0).mul(0.32))
        .add(t3(0.05, 0.06, 0.08));
      const colorNode = lit.clamp(0, 1);

      const opacityNode = alpha;

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: NormalBlending, // smoke/cloud → painter 'over' composite
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles for the CPU test + host wiring.
      target.userData.smoke = { uTime, uSpeed, uDensity, uRise, uR, uG, uB };

      return {
        // Stateful drifting haze — runs continuously off the time driver.
        duration: () => Infinity,
        seek: (t: number) => {
          uTime.value = t;
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 0.5);
          else if (id === 'density') uDensity.value = num(value, 1);
          else if (id === 'rise') uRise.value = num(value, 1);
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
