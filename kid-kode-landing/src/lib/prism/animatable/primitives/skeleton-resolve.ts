// skeleton-resolve — the classic product-UI loading skeleton: light bone-grey
// placeholder BARS (laid out from the subject's OWN measured content bounds)
// sit on a flattened ghost plate while a shimmer band sweeps across them; then
// a soft diagonal resolve front wipes the true content (face + chrome) back
// in, the bars dissolving exactly as the front passes. MEDIUM / mask.
//
// ADVOCATE FIX (2026-06-12): the previous build collapsed the subject to its
// own luminance for the ghost — on the map-less dark graphite card a
// luminance collapse of near-black IS near-black, so there was NO visible
// skeleton state and the chrome stayed floating over it. Now phase 1 is a
// real skeleton: design-world BONE bars (each derived by projecting a chrome
// child's measured Box3 into the face's uv chart — the placeholder mirrors
// the actual layout) over a bone-grey plate whose darkness the `ghost` knob
// drives, with the tintable shimmer band riding the bars. CHROME CO-TREATMENT
// (the metaball-merge pattern): chrome opacity = baseOpacity × CPU-evaluated
// resolve-front coverage at that child's projected uv center — fully hidden
// during the ghost phase, reappearing exactly as the front passes, never
// floating over a placeholder.
//
// PBR CARRY: the swapped material is a MeshStandardNodeMaterial whose
// roughness / metalness / envMapIntensity / side / opacity are synced from
// the live source each seek, so the RESOLVED face shades under the rig
// lighting exactly like the original. The skeleton phase is emissive-driven
// (albedo gated to 0 by the front) so it reads flat and unlit — the classic
// placeholder look. colorNode samples the live map × source color (never an
// invented fill); a late texture pour or material swap rebuilds + re-mounts
// the node material (P0 lesson: factories pour `.map` asynchronously).
//
// Timeline: t=1s at the default 2.4s duration (the CONTROLS gate's pinned
// frame, p≈0.42) lands inside the ghost phase, where ghost (plate darkness),
// speed (band position) and tint (band colour) all visibly change the frozen
// frame; duration min (0.8s) is fully resolved at t=1s — a maximal sweep.
//
// DISTINCT from neighbors: fade/cross-dissolve are monotone opacity arcs with
// no placeholder state; the shimmer category loops its sheen FOREVER while
// this one RESOLVES — a finite skeleton→content arc; blur-in is a focus pull
// on the true image, never a bars-and-plate placeholder.

import {
  Box3,
  Color,
  Matrix4,
  Mesh,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  abs,
  dot,
  float,
  fract,
  length,
  max as tslMax,
  mix,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
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

// Design-world bone (Observatory Brass family — same hex as swap-flip-morph).
const BONE = '#e9e0cd';

// Timeline shape (fractions of duration). The resolve crossfade occupies the
// back half so the CONTROLS gate's paused t=1s frame (default 2.4s → p≈0.42)
// lands inside the ghost phase where ghost/speed/tint all visibly respond.
const RESOLVE_START = 0.45;
const RESOLVE_END = 0.85;
const POP_START = 0.78; // sharpening pop ramps as the crossfade finishes
const POP_GAIN = 0.35; // peak contrast overshoot (1 → 1.35), settles to 1

// Resolve-front softness in diagonal units (diag spans 0..1 across the face).
const FRONT_SOFT = 0.18;
const MAX_BARS = 6;

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

/** Source material shape we carry: the live map/color/emissive/PBR look. */
type SourceMat = Material & {
  map?: Texture | null;
  color?: Color;
  emissive?: Color;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
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

/** Linear local-XY → uv chart of the face mesh's FRONT surface, fitted from
 *  the geometry's own attributes (never hardcoded world units). Falls back to
 *  a bounding-box mapping when the front-vert fit is degenerate. */
interface UvChart {
  su: number; // du/dx
  bu: number;
  sv: number; // dv/dy
  bv: number;
}

function fitUvChart(mesh: Mesh): UvChart | null {
  const geo = mesh.geometry;
  const posA = geo.getAttribute('position');
  const norA = geo.getAttribute('normal');
  const uvA = geo.getAttribute('uv');
  if (posA && norA && uvA) {
    let minX = Infinity;
    let maxX = -Infinity;
    let uAtMin = 0;
    let uAtMax = 0;
    let minY = Infinity;
    let maxY = -Infinity;
    let vAtMin = 0;
    let vAtMax = 0;
    let n = 0;
    for (let i = 0; i < posA.count; i++) {
      if (norA.getZ(i) <= 0.9) continue; // front-facing verts only
      n++;
      const x = posA.getX(i);
      const y = posA.getY(i);
      if (x < minX) {
        minX = x;
        uAtMin = uvA.getX(i);
      }
      if (x > maxX) {
        maxX = x;
        uAtMax = uvA.getX(i);
      }
      if (y < minY) {
        minY = y;
        vAtMin = uvA.getY(i);
      }
      if (y > maxY) {
        maxY = y;
        vAtMax = uvA.getY(i);
      }
    }
    if (
      n >= 4 &&
      maxX - minX > 1e-5 &&
      maxY - minY > 1e-5 &&
      Math.abs(uAtMax - uAtMin) > 1e-5 &&
      Math.abs(vAtMax - vAtMin) > 1e-5
    ) {
      const su = (uAtMax - uAtMin) / (maxX - minX);
      const sv = (vAtMax - vAtMin) / (maxY - minY);
      return { su, bu: uAtMin - su * minX, sv, bv: vAtMin - sv * minY };
    }
  }
  if (!geo.boundingBox) geo.computeBoundingBox();
  const bb = geo.boundingBox;
  if (!bb) return null;
  const sx = bb.max.x - bb.min.x;
  const sy = bb.max.y - bb.min.y;
  if (sx < 1e-5 || sy < 1e-5) return null;
  return { su: 1 / sx, bu: -bb.min.x / sx, sv: 1 / sy, bv: -bb.min.y / sy };
}

/** Skeleton bar: uv-space center + WORLD-unit half extents (the SDF is
 *  evaluated in face-local world units so bars stay round under the face's
 *  anisotropic uv chart). */
interface BarRect {
  cu: number;
  cv: number;
  hw: number; // world half-width
  hh: number; // world half-height
}

interface ChromeSnap {
  mat: Material & { opacity: number; emissiveIntensity?: number };
  opacity: number;
  transparent: boolean;
  emissiveIntensity: number | null;
  /** Diagonal coordinate of this child's projected uv center — the CPU
   *  mirror of the shader's resolve front (chrome co-treatment). */
  d: number;
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
    'Bone-grey loading-skeleton bars shimmer over a ghost plate, then a soft front wipes the real content back in.',
  create: defineAnimatable(
    { name: 'skeleton-resolve', category: 'mask', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mesh = findRepresentativeMesh(subject);
      const chart = mesh ? fitUvChart(mesh) : null;

      // ── Shared uniforms (stable across node-material rebuilds) ───────────
      const uResolve = uniform(0); // 0 skeleton → 1 resolved
      const uFront = uniform(-FRONT_SOFT); // resolve front along the diagonal
      const uContrast = uniform(1); // sharpening pop: 1 → ~1.35 → 1
      const uSweep = uniform(0); // shimmer band phase = t * speed
      const uGhost = uniform(clamp(num(params.ghost, 0.6), 0, 1));
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

      // ── Skeleton bar layout from the subject's MEASURED bounds ───────────
      // Project each chrome child's Box3 (in the face's local frame) through
      // the face's uv chart: the placeholder bars mirror the real layout.
      subject.updateMatrixWorld(true);
      const invFace = mesh ? new Matrix4().copy(mesh.matrixWorld).invert() : null;
      const relBox = new Box3();
      const relMat = new Matrix4();

      const chromeMeshes: Mesh[] = [];
      subject.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh && m !== mesh && m.material) chromeMeshes.push(m);
      });

      const bars: BarRect[] = [];
      const chromeD = new Map<Mesh, number>();
      if (mesh && chart && invFace) {
        for (const m of chromeMeshes) {
          if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
          const bb = m.geometry.boundingBox;
          if (!bb) continue;
          relMat.multiplyMatrices(invFace, m.matrixWorld);
          relBox.copy(bb).applyMatrix4(relMat);
          const cx = (relBox.min.x + relBox.max.x) / 2;
          const cy = (relBox.min.y + relBox.max.y) / 2;
          const cu = chart.su * cx + chart.bu;
          const cv = chart.sv * cy + chart.bv;
          const hw = (relBox.max.x - relBox.min.x) / 2;
          const hh = (relBox.max.y - relBox.min.y) / 2;
          // Chrome co-treatment coordinate (clamped onto the face so chrome
          // outside the chart — Group/text siblings — still resolves).
          chromeD.set(m, (clamp(cu, 0, 1) + (1 - clamp(cv, 0, 1))) * 0.5);
          // Bar only if the rect actually lands on the face.
          const huv = Math.abs(hw * chart.su);
          const hvv = Math.abs(hh * chart.sv);
          if (hw > 1e-4 && hh > 1e-4 && cu + huv > -0.02 && cu - huv < 1.02 && cv + hvv > -0.02 && cv - hvv < 1.02) {
            bars.push({ cu, cv, hw, hh });
          }
        }
        bars.sort((a, b) => b.hw * b.hh - a.hw * a.hh);
        bars.length = Math.min(bars.length, MAX_BARS);
      }
      if (bars.length === 0 && chart) {
        // No measurable chrome (plane subject, off-face siblings): generic
        // skeleton rows in uv space, converted to world units via the chart.
        const w = (uvW: number) => uvW / Math.abs(chart.su);
        const h = (uvH: number) => uvH / Math.abs(chart.sv);
        bars.push(
          { cu: 0.36, cv: 0.8, hw: w(0.24), hh: h(0.045) },
          { cu: 0.5, cv: 0.55, hw: w(0.4), hh: h(0.035) },
          { cu: 0.45, cv: 0.38, hw: w(0.33), hh: h(0.035) },
          { cu: 0.36, cv: 0.21, hw: w(0.24), hh: h(0.035) },
        );
      }

      // ── Node material built FROM the live source look ─────────────────────
      const buildMat = (src: SourceMat | null): MeshStandardNodeMaterial => {
        const map = (src?.map ?? null) as Texture | null;
        const u = uv();
        const colorVec = vec3(uColR, uColG, uColB);
        // THE SUBJECT'S LOOK IS SACRED: sample its live map (shared by
        // reference) × material color exactly like a standard material;
        // fall back to the material color alone — never an invented fill.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type TNode = any;
        const baseRGB: TNode = map ? texture(map, u).rgb.mul(colorVec) : colorVec;
        const trueRGB: TNode = baseRGB;
        const trueEm = vec3(uEmR, uEmG, uEmB);

        // ── Skeleton lane (emissive-driven so it reads flat/unlit) ─────────
        const boneV = vec3(...rgb(BONE));
        // Ghost plate: bone-grey, darkness driven by the ghost knob, plus a
        // faint carry of the subject's own luminance so a poured map ghosts
        // through (subject-derived — never an invented pattern).
        const luma: TNode = dot(trueRGB, vec3(0.2126, 0.7152, 0.0722));
        const plateLevel: TNode = float(0.3).sub(uGhost.mul(0.245));
        const plate: TNode = boneV.mul(plateLevel).add(vec3(luma, luma, luma).mul(0.22));

        // Light bone bars from the measured layout (rounded-rect SDFs in
        // face-local WORLD units — round under the anisotropic uv chart).
        const invSu = chart ? 1 / chart.su : 1;
        const invSv = chart ? 1 / chart.sv : 1;
        let barMask: TNode = float(0);
        for (const b of bars) {
          const px: TNode = u.x.sub(float(b.cu)).mul(float(invSu));
          const py: TNode = u.y.sub(float(b.cv)).mul(float(invSv));
          const r = Math.min(b.hw, b.hh) * 0.9;
          const bx = Math.max(b.hw - r, 1e-4);
          const by = Math.max(b.hh - r, 1e-4);
          const qx: TNode = abs(px).sub(float(bx));
          const qy: TNode = abs(py).sub(float(by));
          const dist: TNode = length(vec2(tslMax(qx, float(0)), tslMax(qy, float(0)))).sub(float(r));
          const feather = Math.max(Math.min(b.hw, b.hh) * 0.5, 0.004);
          barMask = tslMax(barMask, float(1).sub(smoothstep(float(0), float(feather), dist)));
        }
        const barCol: TNode = boneV.mul(0.62);
        const skeletonBase: TNode = mix(plate, barCol, barMask);

        // Diagonal shimmer band sweeping with uSweep; brightest ON the bars
        // (the classic skeleton shimmer), faint on the plate.
        const diag: TNode = u.x.add(float(1).sub(u.y)).mul(0.5);
        const band: TNode = fract(diag.sub(uSweep));
        const sheen: TNode = smoothstep(float(0.36), float(0.5), band).mul(
          float(1).sub(smoothstep(float(0.5), float(0.64), band)),
        );
        const skeleton: TNode = skeletonBase.add(
          vec3(uTintR, uTintG, uTintB)
            .mul(sheen)
            .mul(barMask.mul(0.78).add(0.22))
            .mul(uSheenAmp),
        );

        // ── Resolve: a soft diagonal front wipes true content back in ──────
        // (same diag axis as the shimmer; bars dissolve as the front passes —
        // the CPU mirrors this exact coverage for the chrome co-treatment).
        const reveal: TNode = smoothstep(diag.sub(float(FRONT_SOFT)), diag.add(float(FRONT_SOFT)), uFront);

        // Resolved albedo carries the sharpening pop (contrast extrapolated
        // past 1 around mid-grey); skeleton side gates albedo to 0 so the
        // placeholder stays flat/unlit. Resolved emissive = the source's own
        // emissive plus a brief bone flash that settles to exactly neutral.
        const popped: TNode = mix(vec3(0.5, 0.5, 0.5), trueRGB, uContrast);
        const resolvedEm: TNode = trueEm.add(boneV.mul(uContrast.sub(1)).mul(0.35));

        const m = new MeshStandardNodeMaterial({ transparent: true });
        (m as unknown as { colorNode: unknown }).colorNode = popped.mul(reveal);
        (m as unknown as { emissiveNode: unknown }).emissiveNode = skeleton
          .mul(reveal.oneMinus())
          .add(resolvedEm.mul(reveal));
        if (src) {
          m.side = src.side;
          if (typeof src.roughness === 'number') m.roughness = src.roughness;
          if (typeof src.metalness === 'number') m.metalness = src.metalness;
          if (typeof src.envMapIntensity === 'number') m.envMapIntensity = src.envMapIntensity;
        }
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
      target.userData.skeletonResolveUniforms = { uResolve, uContrast, uSweep, uGhost, uFront };
      target.userData.skeletonResolveRebuilds = rebuilds;
      target.userData.skeletonResolveCarriedMap = builtFromMap;
      target.userData.skeletonResolveBars = bars;

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

      /** Pull the live source's color/emissive/PBR look into the carry
       *  uniforms + material props (cheap per-frame — late pours flow without
       *  a rebuild; the resolved face shades like the original). */
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
        if (src) {
          if (typeof src.opacity === 'number') mat.opacity = src.opacity;
          if (typeof src.roughness === 'number') mat.roughness = src.roughness;
          if (typeof src.metalness === 'number') mat.metalness = src.metalness;
          if (typeof src.envMapIntensity === 'number') mat.envMapIntensity = src.envMapIntensity;
        }
      };

      // ── Chrome co-treatment: hidden under the skeleton, wiped back in by
      // the SAME front the shader uses (coverage evaluated at each child's
      // projected uv center — never floats over the placeholder).
      const chromeSnaps: ChromeSnap[] = [];
      for (const m of chromeMeshes) {
        const d = chromeD.get(m) ?? 0.5;
        const list = Array.isArray(m.material) ? m.material : [m.material];
        for (const cm of list) {
          const cmat = cm as Material & { opacity: number; emissiveIntensity?: number };
          chromeSnaps.push({
            mat: cmat,
            opacity: cmat.opacity,
            transparent: cmat.transparent,
            emissiveIntensity:
              typeof cmat.emissiveIntensity === 'number' ? cmat.emissiveIntensity : null,
            d,
          });
          cmat.transparent = true;
        }
      }

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
        const front = -FRONT_SOFT + resolveW * (1 + 2 * FRONT_SOFT);

        uResolve.value = resolveW;
        uFront.value = front;
        uContrast.value = 1 + POP_GAIN * pop;
        uSweep.value = t * num(params.speed, 1.2);
        uGhost.value = clamp(num(params.ghost, 0.6), 0, 1);
        uSheenAmp.value = (1 - resolveW) * 0.9;

        // Chrome co-treatment: opacity = base × front coverage at this
        // child's center (the CPU mirror of the shader's reveal), so each
        // chrome piece reappears exactly as the wipe passes it. The pop
        // briefly over-brightens the emissive — the sharpening flourish.
        for (const cSnap of chromeSnaps) {
          const cov = smooth01((front - cSnap.d + FRONT_SOFT) / (2 * FRONT_SOFT));
          cSnap.mat.opacity = cSnap.opacity * cov;
          if (cSnap.emissiveIntensity !== null) {
            cSnap.mat.emissiveIntensity = cSnap.emissiveIntensity * cov * (1 + 0.6 * pop);
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
          delete target.userData.skeletonResolveBars;
          mat.dispose(); // ours only — the subject's material/map are shared
        },
      };
    },
  ),
};
