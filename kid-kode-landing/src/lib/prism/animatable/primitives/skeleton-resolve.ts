// skeleton-resolve — loading-skeleton shimmer bars sweep over a ghost of the
// layout, then dissolve as the real content resolves crisply into place.
// MEDIUM / mask primitive (product-UI skeleton pattern — the DESIGN-REFERENCES
// intro class of techniques separating generic from premium loading states).
//
// Phase 1 (ghost): the card face is swapped for a MeshBasicNodeMaterial whose
// colorNode is a LUMINANCE COLLAPSE of the subject's OWN look (sampled map ×
// material color + emissive lift — never an invented fill), darkened by the
// ghost control and shaped into skeleton bar rows, while a diagonal bone/ice
// shimmer band sweeps across it. The chrome children (header/dot/rows) dim to
// a layout ghost via opacity + emissive. Phase 2 (resolve): the shimmer fades
// as the TRUE sampled color crossfades in, finishing with a brief contrast
// overshoot (sharpening pop) that settles to exactly neutral at t = duration.
//
// LIVE SUBJECT CARRY (P0 lesson): mounted artifacts pour `.map` ASYNCHRONOUSLY
// after attach, so every seek re-checks the live source material — if the
// material instance or its .map identity changed, the node material is rebuilt
// from the live source (texture shared by reference) and re-mounted. dispose()
// restores the LATEST source material and all chrome state.
//
// DISTINCT from neighbors: fade/cross-dissolve are monotone opacity arcs with
// no ghost or sweep band; the shimmer category loops its sheen FOREVER while
// this one RESOLVES — a finite skeleton→content arc; blur-in is a focus pull
// on the true image, never a luminance-collapsed placeholder.

import { Color, Mesh, type Material, type Object3D, type Texture } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec3,
  float,
  dot,
  fract,
  mix,
  smoothstep,
  texture,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import {
  num,
  str,
  clamp,
  phase,
  type ControlValue,
  type PrimitiveDefinition,
} from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

// Timeline shape (fractions of duration). The resolve crossfade occupies the
// back half so the CONTROLS gate's paused t=1s frame (default 2.4s → p≈0.42)
// lands inside the ghost phase where ghost/speed/tint all visibly respond.
const RESOLVE_START = 0.45;
const RESOLVE_END = 0.85;
const POP_START = 0.78; // sharpening pop ramps as the crossfade finishes
const POP_GAIN = 0.35; // peak contrast overshoot (1 → 1.35), settles to 1

/** CPU smoothstep on a pre-normalized x. */
const smooth01 = (x: number): number => {
  const c = clamp(x, 0, 1);
  return c * c * (3 - 2 * c);
};

const SCHEMA = [
  { id: 'duration', label: 'Resolve Duration', type: 'fader', min: 0.8, max: 5, step: 0.1, default: 2.4, unit: 's' },
  { id: 'speed', label: 'Shimmer Speed', type: 'knob', min: 0.2, max: 4, step: 0.05, default: 1.2 },
  { id: 'ghost', label: 'Ghost Darkness', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.6 },
  { id: 'tint', label: 'Shimmer Tint', type: 'color', default: '#7d9fb4' },
] as const;

/** Source material shape we carry: the live map/color/emissive of the subject. */
type SourceMat = Material & {
  map?: Texture | null;
  color?: Color;
  emissive?: Color;
  emissiveIntensity?: number;
};

/** First Mesh descendant carrying a material — the face the skeleton swaps.
 *  Subject may be a Group (MSDF text-object), so traverse rather than assume
 *  Mesh. */
function findRepresentativeMesh(subject: Object3D): Mesh | null {
  let found: Mesh | null = null;
  subject.traverse((o) => {
    if (found) return;
    const mesh = o as Mesh;
    if (mesh.isMesh && mesh.material) found = mesh;
  });
  return found;
}

interface ChromeSnap {
  mat: Material & { opacity: number; emissiveIntensity?: number };
  opacity: number;
  transparent: boolean;
  emissiveIntensity: number | null;
}

export const skeletonResolvePrimitive: PrimitiveDefinition = {
  name: 'skeleton-resolve',
  label: 'Skeleton Resolve',
  category: 'mask',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Loading-skeleton shimmer bars sweep over a ghost of the layout, then dissolve as the real content resolves crisply into place.',
  create: defineAnimatable(
    { name: 'skeleton-resolve', category: 'mask', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mesh = findRepresentativeMesh(subject);

      // ── Shared uniforms (stable across node-material rebuilds) ───────────
      const uResolve = uniform(0); // 0 skeleton → 1 resolved
      const uContrast = uniform(1); // sharpening pop: 1 → ~1.35 → 1
      const uSweep = uniform(0); // shimmer band phase = t * speed
      const uGhost = uniform(clamp(num(params.ghost, 0.6), 0, 1) * 0.85);
      const uSheenAmp = uniform(0.9); // shimmer presence, fades with resolve
      // Subject look carry (synced live each seek — late pours flow through).
      const uColR = uniform(1);
      const uColG = uniform(1);
      const uColB = uniform(1);
      const uEmR = uniform(0);
      const uEmG = uniform(0);
      const uEmB = uniform(0);
      const [tr0, tg0, tb0] = rgb(str(params.tint, '#7d9fb4'));
      const uTintR = uniform(tr0);
      const uTintG = uniform(tg0);
      const uTintB = uniform(tb0);

      // ── Node material built FROM the live source look ─────────────────────
      const buildMat = (src: SourceMat | null): MeshBasicNodeMaterial => {
        const map = (src?.map ?? null) as Texture | null;
        const u = uv();
        const colorVec = vec3(uColR, uColG, uColB);
        // THE SUBJECT'S LOOK IS SACRED: sample its live map (shared by
        // reference) × material color exactly like a standard material;
        // fall back to the material color alone — never an invented fill.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const baseRGB: any = map ? texture(map, u).rgb.mul(colorVec) : colorVec;
        const trueRGB = baseRGB.add(vec3(uEmR, uEmG, uEmB));

        // Ghost = luminance collapse of the TRUE look, darkened by uGhost.
        const luma = dot(trueRGB, vec3(0.2126, 0.7152, 0.0722));
        const ghostRGB = vec3(luma, luma, luma).mul(float(1).sub(uGhost));
        // Skeleton bar rows: horizontal placeholder stripes faintly lifted out
        // of the ghost so phase 1 reads as a real product-UI skeleton.
        const rows = fract(u.y.mul(4.0));
        const barMask = smoothstep(float(0.12), float(0.3), rows).mul(
          float(1).sub(smoothstep(float(0.7), float(0.88), rows)),
        );
        const ghostShaped = ghostRGB.mul(barMask.mul(0.35).add(0.78));

        // Diagonal shimmer band sweeping with uSweep; brighter along the bars.
        const diag = u.x.add(u.y).mul(0.5);
        const band = fract(diag.sub(uSweep));
        const sheen = smoothstep(float(0.32), float(0.5), band).mul(
          float(1).sub(smoothstep(float(0.5), float(0.68), band)),
        );
        const sheenOnBars = sheen.mul(barMask.mul(0.45).add(0.55));
        const skeleton = ghostShaped.add(
          vec3(uTintR, uTintG, uTintB).mul(sheenOnBars).mul(uSheenAmp),
        );

        // Resolve crossfade; the pop extrapolates contrast past 1 around
        // mid-gray (mix with uContrast > 1) for the brief sharpening overshoot.
        const popped = mix(vec3(0.5, 0.5, 0.5), trueRGB, uContrast);
        const out = mix(skeleton, popped, uResolve);

        const m = new MeshBasicNodeMaterial({ transparent: true });
        (m as unknown as { colorNode: unknown }).colorNode = out;
        if (src) m.side = src.side;
        return m;
      };

      // ── Mount + live-rebind bookkeeping ───────────────────────────────────
      const firstMaterial = (m: Mesh): SourceMat | null => {
        const cur = m.material;
        return ((Array.isArray(cur) ? cur[0] : cur) as SourceMat | undefined) ?? null;
      };
      let builtFromSrc: SourceMat | null = mesh ? firstMaterial(mesh) : null;
      let builtFromMap: Texture | null = (builtFromSrc?.map ?? null) as Texture | null;
      let mat = buildMat(builtFromSrc);
      if (mesh) mesh.material = mat;
      let rebuilds = 0;

      // CPU-observable handles for the host + tests (uniforms are stable
      // across rebuilds; carry/rebuild state updated on each rebind).
      target.userData.skeletonResolveUniforms = { uResolve, uContrast, uSweep, uGhost };
      target.userData.skeletonResolveRebuilds = rebuilds;
      target.userData.skeletonResolveCarriedMap = builtFromMap;

      /** Current authoritative source: an externally swapped-in material wins;
       *  otherwise the material we displaced (the factory retains a reference
       *  to it and pours `.map` into it asynchronously). */
      const liveSource = (): SourceMat | null => {
        if (!mesh) return null;
        const cur = firstMaterial(mesh);
        if (cur && cur !== mat) return cur; // external swap landed — new source
        return builtFromSrc;
      };

      /** Rebuild the node material from the live source and re-mount it. */
      const rebind = (src: SourceMat): void => {
        builtFromSrc = src;
        builtFromMap = (src.map ?? null) as Texture | null;
        const next = buildMat(src);
        if (mesh) mesh.material = next;
        mat.dispose();
        mat = next;
        rebuilds += 1;
        target.userData.skeletonResolveRebuilds = rebuilds;
        target.userData.skeletonResolveCarriedMap = builtFromMap;
      };

      /** Pull the live source's color/emissive/opacity into the carry uniforms
       *  (cheap per-frame — late color/emissive pours flow without a rebuild). */
      const syncLook = (): void => {
        const src = builtFromSrc;
        const c = src?.color;
        if (c instanceof Color) {
          uColR.value = c.r;
          uColG.value = c.g;
          uColB.value = c.b;
        } else {
          // No color on the source: identity (white) so a present map shows
          // unmodified — neutral, never an invented tint.
          uColR.value = 1;
          uColG.value = 1;
          uColB.value = 1;
        }
        const e = src?.emissive;
        const ei = src?.emissiveIntensity;
        if (e instanceof Color && typeof ei === 'number') {
          uEmR.value = e.r * ei;
          uEmG.value = e.g * ei;
          uEmB.value = e.b * ei;
        } else {
          uEmR.value = 0;
          uEmG.value = 0;
          uEmB.value = 0;
        }
        if (src && typeof src.opacity === 'number') mat.opacity = src.opacity;
      };

      // ── Chrome children: dim to a layout ghost, restore on resolve ───────
      const chromeSnaps: ChromeSnap[] = [];
      subject.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh || m === mesh || !m.material) return;
        const list = Array.isArray(m.material) ? m.material : [m.material];
        for (const cm of list) {
          const cmat = cm as Material & { opacity: number; emissiveIntensity?: number };
          chromeSnaps.push({
            mat: cmat,
            opacity: cmat.opacity,
            transparent: cmat.transparent,
            emissiveIntensity:
              typeof cmat.emissiveIntensity === 'number' ? cmat.emissiveIntensity : null,
          });
          cmat.transparent = true;
        }
      });

      let lastT = 0;

      const applyFrame = (t: number): void => {
        // Live rebind check FIRST: late texture pours / material swaps land
        // asynchronously after attach (a clone taken once at create would stay
        // map-less and render white in the real app).
        const src = liveSource();
        if (
          mesh &&
          src &&
          (src !== builtFromSrc || ((src.map ?? null) as Texture | null) !== builtFromMap)
        ) {
          rebind(src);
        }
        syncLook();

        const dur = num(params.duration, 2.4);
        const p = phase(t, dur);
        const resolveW = smooth01((p - RESOLVE_START) / (RESOLVE_END - RESOLVE_START));
        const q = clamp((p - POP_START) / (1 - POP_START), 0, 1);
        const pop = Math.sin(Math.PI * q); // 0 → peak → exactly 0 at p = 1

        const dark = clamp(num(params.ghost, 0.6), 0, 1);
        uResolve.value = resolveW;
        uContrast.value = 1 + POP_GAIN * pop;
        uSweep.value = t * num(params.speed, 1.2);
        uGhost.value = dark * 0.85;
        uSheenAmp.value = (1 - resolveW) * 0.9;

        // Layout ghost on the chrome: dimmed opacity + collapsed emissive in
        // phase 1, both returning to base as the content resolves (the pop
        // briefly over-brightens the emissive — the sharpening flourish).
        const dim = 1 - 0.7 * dark;
        const presence = dim + (1 - dim) * resolveW;
        const emFactor = 0.3 + 0.7 * resolveW + 0.45 * pop;
        for (const cSnap of chromeSnaps) {
          cSnap.mat.opacity = cSnap.opacity * presence;
          if (cSnap.emissiveIntensity !== null) {
            cSnap.mat.emissiveIntensity = cSnap.emissiveIntensity * emFactor;
          }
        }
      };

      return {
        duration: () => num(params.duration, 2.4),
        seek: (t) => {
          lastT = t;
          applyFrame(t);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'tint' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uTintR.value = r;
            uTintG.value = g;
            uTintB.value = b;
          }
          // Re-apply the current frame so a paused tweak responds immediately.
          applyFrame(lastT);
        },
        dispose: () => {
          // Restore the LATEST source material (a late pour/swap is the
          // subject's real look now) and every chrome property we touched.
          if (mesh && mesh.material === mat && builtFromSrc) mesh.material = builtFromSrc;
          for (const cSnap of chromeSnaps) {
            cSnap.mat.opacity = cSnap.opacity;
            cSnap.mat.transparent = cSnap.transparent;
            if (cSnap.emissiveIntensity !== null) {
              cSnap.mat.emissiveIntensity = cSnap.emissiveIntensity;
            }
          }
          mat.dispose(); // ours only — the subject's material/map are shared
        },
      };
    },
  ),
};
