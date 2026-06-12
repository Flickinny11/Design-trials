// domain-warp-morph — the card dissolves through surreal domain-warped liquid
// — its surface smearing into flowing organic channels — and re-forms on the
// other side. HARD / mask / GPU node-material primitive, mined from
// DESIGN-REFERENCES §9 "Domain warping — feed noise into noise for surreal
// organic patterns": q = fbm(p), r = fbm(p + 4q), field = fbm(p + 4r).
//
// A bell envelope m = bell(phase) gates the whole morph so ENTRY AND EXIT ARE
// CLEAN: at m=0 the sampling uv is undisplaced and the alpha threshold sits
// below the field's range (fully opaque — the card's own look). Mid-morph the
// uv sampling coordinates are domain-warp displaced (the subject's own texture
// smears along the warp channels) while a warped-noise threshold eats most of
// the surface into flowing ridges; a warm bone edge-glow rides the dissolve
// front. The flow clock drifts the noise domain over time so the channels run
// like liquid while the card is dissolved.
//
// SUBJECT'S LOOK IS SACRED: the colorNode samples the subject's live texture
// map when present (shared by REFERENCE — never cloned/copied) and falls back
// to a gradient field of the subject material's own color when map-less (the
// catalog card). Mounted artifacts pour textures ASYNCHRONOUSLY after attach
// and applyImageSpec may swap the material wholesale, so every seek re-checks
// the live material + map identity and rebuilds/rebinds when either changed.
//
// DISTINCT from its neighbors:
//   - noise-wipe: a single noise-contoured threshold FRONT sweeps once across
//     the card — no coordinate warping, the surface never smears. Here the
//     sampling coordinates themselves are domain-warped and the threshold is a
//     bell-gated eat-and-restore, not a one-way sweep.
//   - datamosh: blocky DIGITAL smear — rectangular per-block shifts snapping
//     clean. This is its organic opposite: continuous fluid channels from
//     nested fbm, no blocks, no hard edges.
//   - swirl-warp: one analytic angular twist about the center that unwinds.
//     This warp is non-parametric layered noise — flowing liquid channels with
//     no rotational symmetry, plus an alpha eat that swirl-warp never does.

import { Mesh, Color, type Material, type Object3D, type Texture } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  float,
  vec2,
  vec3,
  sin,
  dot,
  fract,
  floor,
  mix,
  smoothstep,
  clamp,
  abs,
  max,
  texture,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, phase, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.8, max: 5, step: 0.1, default: 2.4, unit: 's' },
  { id: 'warpStrength', label: 'Warp Strength', type: 'knob', min: 0, max: 2, step: 0.05, default: 0.9 },
  { id: 'flowSpeed', label: 'Flow Speed', type: 'knob', min: 0, max: 3, step: 0.05, default: 0.9, unit: 'x' },
  { id: 'octaves', label: 'Octaves', type: 'knob', min: 3, max: 5, step: 1, default: 4 },
] as const;

/** CPU smoothstep on [0,1] (clamped) — mirrors the GPU curve for the envelope. */
const sstep = (x: number): number => {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * (3 - 2 * c);
};
/** Bell envelope: 0 at phase 0 and 1 (clean entry/exit), saturated 1 across
 *  the middle ~30–70% of the timeline (peak smear). */
const bell = (ph: number): number => sstep(ph / 0.35) * sstep((1 - ph) / 0.35);

/** Subject may be a Mesh or a Group (MSDF text-object): first Mesh with a
 *  material is the representative surface the morph rides. */
const findRepresentativeMesh = (root: Object3D | null): Mesh | null => {
  if (!root) return null;
  let found: Mesh | null = null;
  root.traverse((o) => {
    if (found) return;
    const mesh = o as Mesh;
    if (mesh.isMesh && mesh.material) found = mesh;
  });
  return found;
};

/** The artifact's live material with the fields we read. */
type SourceMaterial = Material & {
  map?: Texture | null;
  color?: Color;
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
  opacity: number;
};

interface MatSnap {
  mat: Material & { opacity: number };
  opacity: number;
  transparent: boolean;
}

export const domainWarpMorphPrimitive: PrimitiveDefinition = {
  name: 'domain-warp-morph',
  label: 'Domain Warp Morph',
  category: 'mask',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'The card dissolves through surreal domain-warped liquid — its surface smearing into flowing organic channels — and re-forms on the other side.',
  create: defineAnimatable(
    { name: 'domain-warp-morph', category: 'mask', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject;
      const repMesh = findRepresentativeMesh(subject);

      // ── Live uniforms (shared across material rebuilds) ──────────────────
      const uMorph = uniform(0); // bell(phase): 0 clean → 1 peak smear → 0
      const uWarp = uniform(num(params.warpStrength, 0.9));
      const uFlowT = uniform(0); // t * flowSpeed — drifts the noise domain
      const uOctaves = uniform(num(params.octaves, 4));
      const uR = uniform(0.65); // subject tint, synced live each seek
      const uG = uniform(0.69);
      const uB = uniform(0.75);

      // ── Live-source tracking (late texture pour / wholesale swap) ────────
      const liveFirst = (): SourceMaterial | null => {
        if (!repMesh) return null;
        const m = repMesh.material;
        return ((Array.isArray(m) ? m[0] : m) as SourceMaterial | undefined) ?? null;
      };
      let srcMat: SourceMaterial | null = liveFirst();
      let builtMap: Texture | null = (srcMat?.map as Texture | null | undefined) ?? null;
      let mat: MeshStandardNodeMaterial | null = null;

      const syncTint = () => {
        const c = srcMat?.color;
        if (c) {
          uR.value = c.r;
          uG.value = c.g;
          uB.value = c.b;
        }
      };
      syncTint();

      // ── Chrome co-fade: the card's children melt with the surface ────────
      // Snapshot opacity AND .transparent so dispose hands everything back
      // exactly as it arrived. Scalar fade only — no transforms touched.
      const chromeSnaps: MatSnap[] = [];
      if (subject) {
        subject.traverse((o) => {
          const mesh = o as Mesh;
          if (!mesh.isMesh || mesh === repMesh || !mesh.material) return;
          const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const m of list) {
            chromeSnaps.push({
              mat: m as Material & { opacity: number },
              opacity: (m as Material & { opacity: number }).opacity,
              transparent: m.transparent,
            });
          }
        });
      }

      // ── Build/rebuild the node material around the CURRENT map/tint ──────
      // texture() binds a Texture instance at graph build, so a map identity
      // change requires a rebuild; the uniforms persist across rebuilds so
      // drive state carries over seamlessly.
      const buildMat = () => {
        const old = mat;

        // TSL accumulator typing is loose (matches swirl-warp / noise-wipe) so
        // fluent reassignments type-check under strict tsc.
        type TNode = any;

        // Hash-based value noise (deterministic, texture-free): hash each
        // lattice corner, bilinearly interpolate with smoothstep weights.
        const hash = (g: TNode): TNode =>
          fract(sin(dot(g, vec2(127.1, 311.7))).mul(43758.5453));
        const valueNoise = (p: TNode): TNode => {
          const i: TNode = floor(p);
          const f: TNode = fract(p);
          const w: TNode = f.mul(f).mul(float(3).sub(f.mul(2)));
          const a = hash(i);
          const b = hash(i.add(vec2(1, 0)));
          const c = hash(i.add(vec2(0, 1)));
          const d = hash(i.add(vec2(1, 1)));
          return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
        };

        // 3-octave fbm for the warp vectors (q, r) — iquilez-style: the inner
        // warps don't need full octave depth, which keeps the SwiftShader
        // fallback inside budget (the brief's 3-4 octave guidance).
        const fbm3 = (p: TNode): TNode => {
          let v: TNode = valueNoise(p).mul(0.5);
          v = v.add(valueNoise(p.mul(2.03)).mul(0.25));
          v = v.add(valueNoise(p.mul(4.07)).mul(0.125));
          return v.div(0.875);
        };

        // Octave-gated fbm for the FINAL field: 5 octaves unrolled, each
        // multiplied by clamp(uOctaves - i, 0, 1) and renormalized by the
        // gated amplitude sum — the 3..5 knob is live, no rebuild needed.
        const fbmGated = (p: TNode): TNode => {
          let v: TNode = float(0);
          let norm: TNode = float(0);
          let amp = 0.5;
          let freq = 1;
          for (let i = 0; i < 5; i++) {
            const gate = clamp(uOctaves.sub(float(i)), float(0), float(1));
            v = v.add(valueNoise(p.mul(freq)).mul(gate).mul(amp));
            norm = norm.add(gate.mul(amp));
            amp *= 0.5;
            freq *= 2.03;
          }
          return v.div(max(norm, float(0.001)));
        };

        // ── Domain warp (§9): q = fbm(p), r = fbm(p + 4q), field = fbm(p+4r)
        const u: TNode = uv();
        const p: TNode = u.mul(3.2).add(vec2(uFlowT.mul(0.35), uFlowT.mul(-0.22)));
        const warpAmt: TNode = uWarp.mul(2.2);
        const q: TNode = vec2(fbm3(p), fbm3(p.add(vec2(5.2, 1.3))));
        const r: TNode = vec2(
          fbm3(p.add(q.mul(warpAmt)).add(vec2(1.7, 9.2))),
          fbm3(p.add(q.mul(warpAmt)).add(vec2(8.3, 2.8))),
        );
        const field: TNode = fbmGated(p.add(r.mul(warpAmt)));

        // Mid-morph the SAMPLING coordinates are displaced along the warp
        // (gated by the bell so entry/exit sample the untouched surface).
        const warpVec: TNode = r.sub(vec2(0.5, 0.5)).mul(2);
        const sampleUv: TNode = u.add(warpVec.mul(uWarp).mul(uMorph).mul(0.22));

        // Warped-noise threshold eats/restores alpha. At m=0 the threshold
        // sits below the field's range → fully opaque (clean). At m=1 it
        // rises to 0.62 → most of the surface is eaten into flowing channels.
        const edge = float(0.12);
        const thr = mix(float(-0.25), float(0.62), uMorph);
        const keep = smoothstep(thr, thr.add(edge), field);

        // Warm bone edge-glow riding the dissolve front (Observatory-Brass
        // world; gated by the bell so the resting card carries no glow).
        const front = abs(field.sub(thr.add(edge.mul(0.5))));
        const glow = smoothstep(edge.mul(2), float(0), front).mul(uMorph);

        const tint = vec3(uR, uG, uB);
        const next = new MeshStandardNodeMaterial({ transparent: true });
        next.roughness = srcMat?.roughness ?? 0.32;
        next.metalness = srcMat?.metalness ?? 0.45;
        if (typeof srcMat?.envMapIntensity === 'number') {
          next.envMapIntensity = srcMat.envMapIntensity;
        }

        let colorNode: TNode;
        let opacityNode: TNode;
        if (builtMap) {
          // The subject's own texture, shared by REFERENCE, sampled at the
          // domain-warped coordinates — the artwork itself smears.
          const tex = texture(builtMap, sampleUv);
          colorNode = tex.rgb;
          opacityNode = keep.mul(tex.a);
        } else {
          // Map-less fallback (the catalog card): warp a gradient field of
          // the subject material's OWN color — never an invented fill. At
          // m=0 the shade term is 1 → the card's resting tint, untouched.
          const grad = sampleUv.y.mul(0.35).add(0.82);
          const shade = mix(float(1), float(0.45).add(field.mul(0.95)), uMorph);
          colorNode = tint.mul(grad).mul(shade);
          opacityNode = keep;
        }

        (next as unknown as { colorNode: unknown }).colorNode = colorNode;
        (next as unknown as { opacityNode: unknown }).opacityNode = opacityNode;
        (next as unknown as { emissiveNode: unknown }).emissiveNode = vec3(0.93, 0.84, 0.64)
          .mul(glow)
          .mul(0.9)
          .add(tint.mul(uMorph).mul(0.12));

        mat = next;
        if (repMesh) repMesh.material = next;
        old?.dispose();
      };
      buildMat();

      // Expose live uniform handles + the map-binding probe on the shared
      // scratch space so the host (and CPU tests) observe drive state.
      target.userData.domainWarpMorph = {
        uMorph,
        uWarp,
        uFlowT,
        uOctaves,
        sampledMap: () => builtMap,
      };

      return {
        duration: () => num(params.duration, 2.4),
        seek: (t) => {
          // ── Live-source rebind (late texture pour / wholesale swap) ──────
          if (repMesh) {
            const live = liveFirst();
            if (live !== (mat as unknown as SourceMaterial | null)) {
              // applyImageSpec (or the mount) swapped the artifact's material
              // wholesale, overwriting ours: adopt it as the new source.
              srcMat = live;
              builtMap = (srcMat?.map as Texture | null | undefined) ?? null;
              syncTint();
              buildMat();
            } else if (((srcMat?.map as Texture | null | undefined) ?? null) !== builtMap) {
              // The texture pour landed on the source material AFTER attach.
              builtMap = (srcMat?.map as Texture | null | undefined) ?? null;
              buildMat();
            }
            syncTint(); // tint changes flow live, no rebuild
          }

          const dur = num(params.duration, 2.4);
          const m = bell(phase(t, dur));
          uMorph.value = m;
          uFlowT.value = t * num(params.flowSpeed, 0.9);
          // Read controls live so changes apply on the next seek, no rebuild.
          uWarp.value = num(params.warpStrength, 0.9);
          uOctaves.value = num(params.octaves, 4);

          // Chrome melts with the dissolving surface and re-forms with it.
          for (const snap of chromeSnaps) {
            if (!snap.mat.transparent) snap.mat.transparent = true;
            snap.mat.opacity = snap.opacity * (1 - 0.85 * m);
          }
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'warpStrength') uWarp.value = num(value, 0.9);
          else if (id === 'octaves') uOctaves.value = num(value, 4);
          // flowSpeed/duration are read live in seek; no structural reaction.
        },
        dispose: () => {
          // Restore the LATEST source material (it may have been poured or
          // swapped since create) — we never mutated it, only replaced it.
          if (repMesh && srcMat) repMesh.material = srcMat;
          mat?.dispose();
          mat = null;
          for (const snap of chromeSnaps) {
            snap.mat.opacity = snap.opacity;
            snap.mat.transparent = snap.transparent;
          }
        },
      };
    },
  ),
};
