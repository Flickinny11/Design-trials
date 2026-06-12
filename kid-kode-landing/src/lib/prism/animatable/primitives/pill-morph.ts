// pill-morph — the card breathes between its rectangular self and a compact
// pill: a TSL rounded-rect SDF mask in uv space rounds the corners fully
// (radius 0 -> 0.5, half the squeezed height) IN SYNC with a non-uniform scale
// squeeze toward a wide pill footprint, then releases back — the
// morphing-button / View-Transitions container morph (DESIGN-REFERENCES §14)
// made physical. The card's content chrome folds away as it compacts, so the
// held pill reads as a clean button. MEDIUM / mask / time-driven.
//
// In-place by design: position is never touched (travelling to a corner is
// morph-into-card's job). DISTINCT from morph-into-card (state-driven travel
// to a docked corner card — this one breathes in place on the clock) and from
// accordion-y / unfold (pure scale accordions with no silhouette change —
// pill-morph's signature is the corner-radius silhouette morph synchronized
// with the squeeze).
//
// SUBJECT'S LOOK IS SACRED (P0): the mask material's colorNode samples the
// subject material's texture map when present (shared by reference) and falls
// back to the subject material's own color — never an invented fill. Mounted
// artifacts pour .map ASYNCHRONOUSLY after attach (and applyImageSpec may swap
// the whole material), so every seek re-reads the live source material and
// rebinds/re-installs when the material instance or its map identity changed.

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
  float,
  length,
  max,
  min,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { clamp, num, phase, str, type EaseName, type PrimitiveDefinition } from '../contract';

// Pill height as a fraction of the card's measured height — "compact".
const PILL_H = 0.34;
// Breath shape: ramp up over [0, RISE], hold full pill, ramp down over
// [1-RISE, 1]. RISE = 0.42 leaves a 0.42..0.58 hold so the pill registers.
const RISE = 0.42;
// SDF edge half-width (height-normalized units) — a crisp antialiased rim.
const SOFT = 0.02;
// Last-ditch color when the source material exposes neither map nor color:
// the card panel's own design-world graphite (never a saturated invention).
const GRAPHITE = '#1d212b';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.8, max: 5, step: 0.1, default: 2.4, unit: 's' },
  { id: 'pillAspect', label: 'Pill Aspect', type: 'knob', min: 2, max: 6, step: 0.1, default: 3.2 },
  { id: 'squeeze', label: 'Squeeze', type: 'fader', min: 0, max: 1, step: 0.01, default: 1 },
  {
    id: 'curve',
    label: 'Radius Curve',
    type: 'curve',
    default: 'easeInOut',
    options: ['linear', 'easeIn', 'easeOut', 'easeInOut', 'expoOut', 'backOut'],
  },
] as const;

/** Source-material surface we carry into the mask material. */
type SrcMat = Material & {
  map?: Texture | null;
  color?: Color;
  emissive?: Color;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
};

/** First Mesh descendant (or the subject itself when it is a Mesh) — the
 *  appearance source. The subject may be a Group (MSDF text-object). */
function findRepresentativeMesh(subject: Object3D): Mesh | null {
  let found: Mesh | null = null;
  subject.traverse((o) => {
    if (found) return;
    const mesh = o as Mesh;
    if (mesh.isMesh && mesh.material) found = mesh;
  });
  return found;
}

interface MatSnap {
  mat: Material & { opacity: number };
  opacity: number;
  transparent: boolean;
}

export const pillMorphPrimitive: PrimitiveDefinition = {
  name: 'pill-morph',
  label: 'Pill Morph',
  category: 'mask',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'The card breathes between its rectangular self and a compact pill — corners rounding fully as the aspect squeezes — the morphing-button made physical.',
  create: defineAnimatable(
    { name: 'pill-morph', category: 'mask', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;

      // ── Measure the subject in ITS OWN local frame (never hardcoded) ─────
      // The pill footprint targets derive from the measured width/height, so
      // the morph scales to ANY mounted artifact.
      subject.updateWorldMatrix(true, true);
      const worldBox = new Box3().setFromObject(subject);
      let w0 = 1.6;
      let h0 = 1.0;
      if (!worldBox.isEmpty()) {
        const localBox = worldBox
          .clone()
          .applyMatrix4(new Matrix4().copy(subject.matrixWorld).invert());
        const w = localBox.max.x - localBox.min.x;
        const h = localBox.max.y - localBox.min.y;
        if (w > 1e-6 && h > 1e-6) {
          w0 = w;
          h0 = h;
        }
      }

      const baseScaleX = subject.scale.x;
      const baseScaleY = subject.scale.y;

      // ── Appearance source + mask material ────────────────────────────────
      const repMesh = findRepresentativeMesh(subject);
      // Material arrays are out of contract for the mask swap — fall back to a
      // scale-only morph rather than mangling a multi-material mesh.
      const maskable = Boolean(repMesh && repMesh.material && !Array.isArray(repMesh.material));
      /** The app-owned material we replaced — updated if the app swaps in a
       *  fresh material after attach, so dispose restores the LATEST one. */
      let srcMat: SrcMat | null = maskable ? (repMesh!.material as SrcMat) : null;

      // Chrome = every OTHER mesh material on the subtree (header/dot/rows on
      // the catalog card). Content folds away as the card compacts into a
      // button. Snapshot opacity + .transparent for exact restore.
      const chrome: MatSnap[] = [];
      subject.traverse((o) => {
        const mesh = o as Mesh;
        if (!mesh.isMesh || mesh === repMesh || !mesh.material) return;
        const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of list) {
          chrome.push({
            mat: m as Material & { opacity: number },
            opacity: (m as Material & { opacity: number }).opacity,
            transparent: m.transparent,
          });
          m.transparent = true;
        }
      });

      // Rounded-rect SDF in a height-normalized uv space whose x axis carries
      // the VISIBLE aspect (so the animated corner radius is circular, not
      // elliptical, while the squeeze changes the card's physical aspect).
      //   p = (uv - 0.5) * (aspect, 1)        — rect spans ±(aspect/2, 0.5)
      //   q = |p| - (aspect/2 - r, 0.5 - r)
      //   d = |max(q, 0)| + min(max(q.x, q.y), 0) - r   — signed, < 0 inside
      // r = 0.5 (half the height) closes the short sides into a full pill.
      const uRadius = uniform(0);
      const uAspect = uniform(w0 / h0);
      const uR = uniform(0);
      const uG = uniform(0);
      const uB = uniform(0);
      // TSL intermediate-node type (mirrors splat-reveal / foam) — sidesteps
      // the narrow fluent return types so the SDF assembly type-checks.
      type TNode = any;
      const p: TNode = uv().sub(vec2(0.5, 0.5)).mul(vec2(uAspect, float(1)));
      const bx: TNode = max(uAspect.mul(0.5).sub(uRadius), float(0));
      const by: TNode = max(float(0.5).sub(uRadius), float(0));
      const q: TNode = abs(p).sub(vec2(bx, by));
      const outside: TNode = length(max(q, vec2(0, 0)));
      const inside: TNode = min(max(q.x, q.y), float(0));
      const d: TNode = outside.add(inside).sub(uRadius);
      const mask: TNode = smoothstep(float(SOFT), float(-SOFT), d);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      (mat as unknown as { opacityNode: unknown }).opacityNode = mask;

      // What the colorNode is currently built FROM — compared against the live
      // source each seek so the async texture pour upgrades us in place.
      let boundSrc: SrcMat | null = null;
      let boundMap: Texture | null = null;

      /** Carry the live source's look into the mask material: sample its map
       *  when present (texture shared BY REFERENCE — never cloned, never
       *  disposed by us), else its own color. PBR + emissive ride along so the
       *  masked panel keeps its sheen. */
      const rebind = (src: SrcMat | null) => {
        boundSrc = src;
        boundMap = (src?.map as Texture | null | undefined) ?? null;
        if (boundMap) {
          (mat as unknown as { colorNode: unknown }).colorNode = texture(boundMap);
        } else {
          const c = src?.color instanceof Color ? src.color : new Color(GRAPHITE);
          uR.value = c.r;
          uG.value = c.g;
          uB.value = c.b;
          (mat as unknown as { colorNode: unknown }).colorNode = vec3(uR, uG, uB);
        }
        if (src?.emissive instanceof Color) mat.emissive.copy(src.emissive);
        if (typeof src?.emissiveIntensity === 'number') mat.emissiveIntensity = src.emissiveIntensity;
        if (typeof src?.roughness === 'number') mat.roughness = src.roughness;
        if (typeof src?.metalness === 'number') mat.metalness = src.metalness;
        mat.needsUpdate = true; // node graph changed — recompile
      };

      /** Resolve the live source material. If the app swapped a whole new
       *  material onto the mesh after we attached, adopt it as the new source
       *  and re-install the mask on top. */
      const liveSource = (): SrcMat | null => {
        if (!maskable || !repMesh) return null;
        const cur = repMesh.material;
        if (!Array.isArray(cur) && cur && cur !== mat) {
          srcMat = cur as SrcMat;
          repMesh.material = mat;
        }
        return srcMat;
      };

      if (maskable && repMesh) {
        rebind(srcMat);
        repMesh.material = mat;
      }

      // Observables for the host / tests (no renderer needed).
      target.userData.pillRadius = uRadius;
      target.userData.pillAspect = uAspect;

      return {
        duration: () => num(params.duration, 2.4),
        seek: (t) => {
          // (P0) LATE TEXTURE POUR / MATERIAL SWAP — re-check the live source
          // every seek; rebind the moment either identity changes.
          if (maskable) {
            const src = liveSource();
            const liveMap = (src?.map as Texture | null | undefined) ?? null;
            if (src !== boundSrc || liveMap !== boundMap) rebind(src);
          }

          const pNorm = phase(t, num(params.duration, 2.4));
          const curveName = str(params.curve, 'easeInOut') as EaseName;
          // Breath: eased rise to full pill, hold, eased release.
          const up = ease(curveName, clamp(pNorm / RISE, 0, 1));
          const down = ease(curveName, clamp((pNorm - (1 - RISE)) / RISE, 0, 1));
          const m = up * (1 - down);

          // Corner radius 0 -> 0.5: at 0.5 (half the squeezed height) the
          // short sides are fully round — a true pill silhouette.
          uRadius.value = 0.5 * m;

          // Non-uniform squeeze toward the compact pill footprint, in sync
          // with the radius. Targets are fractions of the MEASURED card size:
          // height -> PILL_H, width -> aspect * pill height (capped just
          // inside the card so the pill always reads as a squeeze, not growth).
          const squeeze = clamp(num(params.squeeze, 1), 0, 1);
          const A = clamp(num(params.pillAspect, 3.2), 2, 6);
          const h1 = PILL_H;
          const w1 = Math.min(A * PILL_H * (h0 / w0), 0.98);
          const sx = 1 + (w1 - 1) * squeeze * m;
          const sy = 1 + (h1 - 1) * squeeze * m;
          subject.scale.x = baseScaleX * sx;
          subject.scale.y = baseScaleY * sy;

          // Keep the SDF space registered with the VISIBLE rect so the corner
          // radius stays circular throughout the squeeze.
          uAspect.value = (w0 * sx) / (h0 * sy);

          // Content folds away as the card becomes a button (and returns).
          for (const snap of chrome) snap.mat.opacity = snap.opacity * (1 - m);
        },
        dispose: () => {
          // Hand back the LATEST app-owned material (adopted on swap), the
          // exact base scale, and every chrome opacity/.transparent we touched.
          if (maskable && repMesh && srcMat) repMesh.material = srcMat;
          subject.scale.x = baseScaleX;
          subject.scale.y = baseScaleY;
          for (const snap of chrome) {
            snap.mat.opacity = snap.opacity;
            snap.mat.transparent = snap.transparent;
          }
          delete target.userData.pillRadius;
          delete target.userData.pillAspect;
          // Ours alone — material.dispose() never touches the shared map.
          mat.dispose();
        },
      };
    },
  ),
};
