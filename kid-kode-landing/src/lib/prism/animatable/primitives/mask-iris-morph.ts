// mask-iris-morph — a camera iris opens to reveal the card, its aperture
// MORPHING from circle through star to hexagon as it widens. HARD / mask / GPU
// node-material primitive (DESIGN-REFERENCES §8 — SDFs: the aperture is a 2D
// signed-distance boundary in uv space whose shape is an interpolation of a
// circle SDF, a 6-point star SDF, and a hexagon SDF, the mix weights a function
// of the open fraction — "shape interpolates with radius"). A bright rim burns
// at the aperture edge in a warm tint derived from the subject's own color
// pulled toward observatory brass.
//
// DISTINCT from its mask neighbors: iris-wipe is a FIXED circular aperture that
// only grows — this one re-shapes its silhouette mid-open (circle -> star
// spikes -> hex facets); wedge-wipe and diamond-wipe sweep STATIC shapes across
// the card. No other mask primitive animates the aperture's geometry itself.
//
// SUBJECT LOOK IS SACRED (P0): the swapped node material's colorNode samples
// the subject material's texture map when present (bound BY REFERENCE) times
// the subject's own color; with no map a neutral white 1x1 fallback makes the
// tint pass through unchanged. Every seek re-checks the live material — if the
// artifact poured a .map asynchronously or swapped the material instance
// outright, we rebind/adopt on the spot (clone-once-at-create renders white in
// the real app). dispose() restores the LATEST live source material.
//
// CHROME CO-TREATMENT (advocate must-fix 2026-06-12): the card subject is a
// COMPOSITE — the masked face Mesh carries chrome CHILDREN (brass header, ice
// dot, content rows). The mask material only hides the FACE; without
// co-treatment the chrome floats fully visible over a closed iris. Fix: the
// SAME aperture SDF the shader evaluates per-fragment is mirrored on the CPU
// and evaluated at each chrome child's center projected into the face's uv
// space (face geometry bounding box gives the mapping — never hardcoded world
// units); chrome opacity = baseOpacity x smoothstepped open-coverage, biased
// INSIDE the aperture so an element resolves just behind the burning rim as
// the front passes it. Closed iris = nothing of the card visible. Snapshot/
// restore on dispose (the metaball-merge pattern, judged ship-quality).
//
// CPU observables (headless tests, no GPU): uRadius / morph-weight / glow
// uniform handles + look- and chrome-inspector fns, stashed on target.userData.

import {
  Color,
  DataTexture,
  Mesh,
  Vector3,
  type Material,
  type Texture,
} from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  float,
  length,
  atan,
  cos,
  abs,
  fract,
  mix,
  pow,
  max,
  smoothstep,
  texture,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import {
  num,
  str,
  phase,
  clamp,
  type EaseName,
  type PrimitiveDefinition,
} from '../contract';

// Fully-open radius. Card uv corners sit 0.707 from center; the star's valley
// floor is STAR_INNER, so the worst-case boundary at p=1 is
// MAX_RADIUS * STAR_INNER = 1.35 * 0.62 = 0.84 > 0.707 — every path ends with
// the card completely revealed and the rim swept off the surface.
const MAX_RADIUS = 1.35;
const SOFTNESS = 0.045; // alpha feather at the aperture boundary
const RIM_WIDTH = 0.05; // half-width of the glowing blade-edge band
// Chrome reveal band (uv units): a chrome child starts resolving when the
// aperture edge reaches its center and is fully opaque once the edge is
// 2*CHROME_FEATHER past — biased INSIDE the aperture so a closed iris shows
// zero chrome and each element appears just behind the burning rim.
const CHROME_FEATHER = 0.07;
const STAR_INNER = 0.62; // star valley radius (relative to spike tips at 1)
const STAR_SHARPNESS = 1.6; // pow() on the spike profile — pointier blades
const BRASS = new Color('#cd9f55'); // design-system brass-400 (no purple)
const PANEL_FALLBACK = new Color('#1d212b'); // graphite panel
const INK_FALLBACK = new Color('#12151d');

// CPU smoothstep for the morph-weight schedule (shape ~ open fraction).
// NOTE: b < a inverts (same convention as TSL smoothstep) — used for the
// chrome reveal where "inside the aperture" means smaller distance.
const sstep = (a: number, b: number, x: number): number => {
  const u = clamp((x - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

const lerpN = (a: number, b: number, t: number): number => a + (b - a) * t;

// CPU mirror of the shader's aperture SDF (MUST stay in lockstep with the
// colorNode graph below): for a point at face-uv (u,v), how "inside the open
// aperture" is it? 1 = fully revealed, 0 = still behind closed blades. The
// reveal band sits INSIDE the boundary (edge .. edge - 2*CHROME_FEATHER) so a
// chrome element only resolves once the front has actually passed its center.
const apertureCoverage = (
  u: number,
  v: number,
  radius: number,
  wStar: number,
  wHex: number,
): number => {
  const qx = u - 0.5;
  const qy = v - 0.5;
  const d = Math.hypot(qx, qy);
  // GLSL-style fract (positive for negative angles) — mirrors the shader's
  // fract-based 60° sector that dodges the atan wrap seam.
  const s = Math.atan2(qy, qx) * (3 / Math.PI);
  const sector = s - Math.floor(s);
  const angIn = (sector - 0.5) * (Math.PI / 3);
  const mHexV = Math.cos(Math.PI / 6) / Math.cos(angIn);
  const tri = Math.abs(sector * 2 - 1);
  const mStarV = lerpN(STAR_INNER, 1, Math.pow(tri, STAR_SHARPNESS));
  const mShape = lerpN(lerpN(1, mStarV, wStar), mHexV, wHex);
  const edge = radius * mShape;
  return sstep(edge, edge - 2 * CHROME_FEATHER, d);
};

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.5, max: 5, step: 0.1, default: 2.4, unit: 's' },
  {
    id: 'shapePath',
    label: 'Shape Path',
    type: 'dropdown',
    default: 'circle-star-hex',
    options: [
      { value: 'circle-star-hex', label: 'Circle → Star → Hex' },
      { value: 'circle-star', label: 'Circle → Star' },
      { value: 'circle-hex', label: 'Circle → Hex' },
      { value: 'star-hex', label: 'Star → Hex' },
    ],
  },
  { id: 'edgeGlow', label: 'Edge Glow', type: 'knob', min: 0, max: 2.5, step: 0.05, default: 1.1 },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'easeInOut',
    options: ['linear', 'easeOut', 'easeInOut', 'expoOut'],
  },
] as const;

// Duck-typed view of whatever material the artifact mounted on the subject.
interface SourceLook {
  color?: Color;
  emissive?: Color;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  map?: Texture | null;
}

// Per-mesh record: the mask material we installed + the live source material
// whose look (map/color/emissive) we carry and whose reference we restore.
interface MeshRec {
  mesh: Mesh;
  srcMat: Material;
  mat: MeshStandardNodeMaterial;
  texNode: { value: Texture };
  uTint: { value: Color };
  uEmissive: { value: Color };
  uRimColor: { value: Color };
  boundMap: Texture | null;
}

// Per-chrome-child record: its center in FACE uv space + the opacity /
// transparent snapshot of every material it mounts (restored on dispose).
interface ChromeMatSnap {
  mat: Material & { opacity: number };
  opacity: number;
  transparent: boolean;
}
interface ChromeRec {
  u: number;
  v: number;
  mats: ChromeMatSnap[];
}

export const maskIrisMorphPrimitive: PrimitiveDefinition = {
  name: 'mask-iris-morph',
  label: 'Iris Morph',
  category: 'mask',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A camera iris opens to reveal the card, its aperture morphing from circle through star to hexagon as it widens, a warm brass rim burning at the blade edge.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'mask-iris-morph', category: 'mask', schema: SCHEMA },
    (target, params) => {
      // Subject may be a single Mesh (card panel) or a Group (MSDF text-object):
      // mask the mesh itself, or every descendant mesh of the group.
      const meshes: Mesh[] = [];
      const subj = target.subject;
      if (subj) {
        if ((subj as Mesh).isMesh) meshes.push(subj as Mesh);
        else subj.traverse((o) => {
          if ((o as Mesh).isMesh) meshes.push(o as Mesh);
        });
      }

      // Neutral 1x1 white fallback so colorNode = map * tint degrades to pure
      // tint when the subject has no texture. Ours — disposed in dispose().
      const whiteTex = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
      whiteTex.needsUpdate = true;

      // ── Shared aperture uniforms (one iris drives every masked mesh) ──────
      const uRadius = uniform(0);
      const uWStar = uniform(0); // circle -> star morph weight
      const uWHex = uniform(0); // (circle|star) -> hex morph weight
      const uGlow = uniform(clamp(num(params.edgeGlow, 1.1), 0, 2.5));
      const uGlowVis = uniform(Math.min(num(params.edgeGlow, 1.1) * 0.5, 0.9));

      // ── Per-mesh mask material with the shared SDF aperture ──────────────
      const buildRec = (mesh: Mesh): MeshRec => {
        const texNode = texture(whiteTex);
        const uTint = uniform(PANEL_FALLBACK.clone());
        const uEmissive = uniform(INK_FALLBACK.clone());
        const uRimColor = uniform(BRASS.clone());

        // Polar SDF boundary in uv space (§8): for a fragment at distance d and
        // angle theta from the card center, the aperture edge is uRadius * m(theta)
        // where m blends circle (1) -> 6-point star -> hexagon by the weights.
        const q = uv().sub(vec2(0.5, 0.5));
        const d = length(q);
        const theta = atan(q.y, q.x); // radians, (-PI, PI]
        // fract-based sector (avoids the atan wrap seam — fract of a negative is
        // GLSL-positive): 0..1 across each 60° sector, boundaries at k*60°.
        const sector = fract(theta.mul(float(3 / Math.PI)));
        // Hexagon boundary radius (circumradius 1): apothem cos(30°) over the
        // cosine of the in-sector angle — corners land on the sector boundaries.
        const angIn = sector.sub(float(0.5)).mul(float(Math.PI / 3)); // -30°..30°
        const mHex = float(Math.cos(Math.PI / 6)).div(cos(angIn));
        // 6-point star: triangle wave peaking on the SAME sector boundaries, so
        // star spikes morph coherently into hex corners.
        const tri = abs(sector.mul(2).sub(1));
        const mStar = mix(float(STAR_INNER), float(1), pow(tri, float(STAR_SHARPNESS)));
        // Shape interpolates with the open fraction (weights fed from the CPU).
        const mShape = mix(mix(float(1), mStar, uWStar), mHex, uWHex);
        const edge = uRadius.mul(mShape);

        // Inside the aperture -> opaque; feathered at the boundary (inverted
        // smoothstep, same convention as iris-wipe).
        const mask = smoothstep(edge, edge.sub(float(SOFTNESS)), d);
        // Glowing blade edge: a thin band hugging the aperture boundary. It also
        // lifts opacity slightly past the edge so the rim reads as a bright ring.
        const rim = float(1).sub(smoothstep(float(0), float(RIM_WIDTH), abs(d.sub(edge))));

        const mat = new MeshStandardNodeMaterial({ transparent: true });
        // Casts dodge strict TSL typing (same pattern as iris-wipe/caustics).
        (mat as unknown as { colorNode: unknown }).colorNode =
          (texNode as unknown as { rgb: { mul: (v: unknown) => unknown } }).rgb.mul(uTint);
        // TSL's TS overloads widen the mix()-built edge chain to a vec node
        // even though the runtime graph is scalar — loosen add()/max() like the
        // colorNode/opacityNode casts above (exemplar convention).
        (mat as unknown as { emissiveNode: unknown }).emissiveNode =
          (uEmissive as unknown as { add: (v: unknown) => unknown }).add(
            uRimColor.mul(rim).mul(uGlow),
          );
        const maxLoose = max as unknown as (a: unknown, b: unknown) => unknown;
        (mat as unknown as { opacityNode: unknown }).opacityNode =
          maxLoose(mask, rim.mul(uGlowVis));

        const rec: MeshRec = {
          mesh,
          srcMat: mesh.material as Material,
          mat,
          texNode: texNode as unknown as { value: Texture },
          uTint: uTint as unknown as { value: Color },
          uEmissive: uEmissive as unknown as { value: Color },
          uRimColor: uRimColor as unknown as { value: Color },
          boundMap: null,
        };
        mesh.material = mat;
        return rec;
      };

      const recs = meshes.map(buildRec);

      // ── Chrome co-treatment (advocate must-fix): the card face is a Mesh
      // with chrome CHILDREN that the mask material cannot touch. Project each
      // chrome child's center into the face's uv space via the face geometry's
      // bounding box (Box3-measured — no hardcoded world units) and snapshot
      // its materials so every seek can gate chrome opacity by the aperture's
      // open-coverage at that exact point. Group subjects mask every
      // descendant mesh directly, so the chrome set is empty there.
      const face = subj && (subj as Mesh).isMesh ? (subj as Mesh) : null;
      const chromeRecs: ChromeRec[] = [];
      if (face) {
        if (!face.geometry.boundingBox) face.geometry.computeBoundingBox();
        const bb = face.geometry.boundingBox;
        if (bb) {
          const spanX = Math.max(1e-6, bb.max.x - bb.min.x);
          const spanY = Math.max(1e-6, bb.max.y - bb.min.y);
          const center = new Vector3();
          face.updateWorldMatrix(true, false);
          face.traverse((o) => {
            const m = o as Mesh;
            if (!m.isMesh || m === face || !m.material) return;
            if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
            if (m.geometry.boundingBox) m.geometry.boundingBox.getCenter(center);
            else center.set(0, 0, 0);
            m.updateWorldMatrix(true, false);
            center.applyMatrix4(m.matrixWorld);
            face.worldToLocal(center);
            const mats = (Array.isArray(m.material) ? m.material : [m.material]).map(
              (cm): ChromeMatSnap => ({
                mat: cm as Material & { opacity: number },
                opacity: (cm as Material & { opacity: number }).opacity,
                transparent: cm.transparent,
              }),
            );
            chromeRecs.push({
              u: (center.x - bb.min.x) / spanX,
              v: (center.y - bb.min.y) / spanY,
              mats,
            });
          });
        }
      }

      // Gate every chrome child by the aperture coverage at its uv center —
      // the SAME radius/weights the shader is rendering this seek. Closed iris
      // (radius 0) drives every coverage to 0: nothing of the card visible.
      const applyChrome = (radius: number, wStar: number, wHex: number): void => {
        for (const c of chromeRecs) {
          const cov = apertureCoverage(c.u, c.v, radius, wStar, wHex);
          for (const s of c.mats) {
            if (!s.mat.transparent) s.mat.transparent = true;
            s.mat.opacity = s.opacity * cov;
          }
        }
      };

      // Re-check the LIVE material every seek (P0): adopt an externally swapped
      // instance, rebind an asynchronously poured .map by reference, and carry
      // the source color/emissive/roughness/metalness into the mask material.
      const syncLook = (rec: MeshRec): void => {
        if (rec.mesh.material !== rec.mat) {
          // Artifact code mounted a fresh material — that is now the subject's
          // intended look AND the restore target; re-install our mask over it.
          rec.srcMat = rec.mesh.material as Material;
          rec.mesh.material = rec.mat;
        }
        const src = rec.srcMat as unknown as SourceLook;
        const map = src.map ?? null;
        if (map !== rec.boundMap) {
          rec.texNode.value = map ?? whiteTex;
          rec.boundMap = map;
          rec.mat.needsUpdate = true;
        }
        // Tint = the subject's own color (map x color matches standard-material
        // semantics); white when only a map exists; panel fallback when neither.
        if (src.color instanceof Color) rec.uTint.value.copy(src.color);
        else if (map) rec.uTint.value.setRGB(1, 1, 1); // map-only: show it unmodified
        else rec.uTint.value.copy(PANEL_FALLBACK);
        const e = src.emissive instanceof Color ? src.emissive : INK_FALLBACK;
        rec.uEmissive.value.copy(e).multiplyScalar(src.emissiveIntensity ?? 0.42);
        rec.mat.roughness = src.roughness ?? 0.32;
        rec.mat.metalness = src.metalness ?? 0.45;
        // Subject-derived warm rim: the subject tint pulled toward brass, lifted.
        rec.uRimColor.value
          .copy(src.color instanceof Color ? src.color : PANEL_FALLBACK)
          .lerp(BRASS, 0.7)
          .multiplyScalar(1.6);
      };
      recs.forEach(syncLook);
      applyChrome(0, 0, 0); // iris starts closed — chrome hidden from frame one

      // Observables for headless tests + the catalog harness.
      target.userData.irisMorphRadius = uRadius;
      target.userData.irisMorphWeights = { star: uWStar, hex: uWHex };
      target.userData.irisMorphGlow = uGlow;
      target.userData.irisMorphLook = () => ({
        maps: recs.map((r) => r.texNode.value),
        tints: recs.map((r) => r.uTint.value.getHexString()),
      });
      target.userData.irisMorphChrome = () =>
        chromeRecs.map((c) => ({
          u: c.u,
          v: c.v,
          base: c.mats[0]?.opacity ?? 1,
          opacity: c.mats[0]?.mat.opacity ?? 1,
        }));

      // Morph-weight schedule: the shape is a function of the eased open
      // fraction p (§8 — shape interpolates with radius).
      const applyPhase = (t: number): void => {
        const dur = num(params.duration, 2.4);
        const p = ease(str(params.curve, 'easeInOut') as EaseName, phase(t, dur));
        uRadius.value = p * MAX_RADIUS;
        const path = str(params.shapePath, 'circle-star-hex');
        let wStar = 0;
        let wHex = 0;
        if (path === 'circle-star') wStar = sstep(0.15, 0.85, p);
        else if (path === 'circle-hex') wHex = sstep(0.15, 0.85, p);
        else if (path === 'star-hex') {
          wStar = 1; // starts AS the star
          wHex = sstep(0.1, 0.9, p);
        } else {
          // the headline journey: circle -> star (early-mid) -> hex (late)
          wStar = sstep(0.08, 0.48, p);
          wHex = sstep(0.52, 0.92, p);
        }
        uWStar.value = wStar;
        uWHex.value = wHex;
        // Chrome rides the SAME aperture state the shader renders this seek.
        applyChrome(uRadius.value, wStar, wHex);
      };

      // Full state re-application — seek() AND onParamChange() both land here
      // so a control tweak on a PAUSED tile (the capture rig sweeps controls
      // pinned at t=1s) re-evaluates radius/weights/glow/chrome immediately at
      // the last seek time instead of waiting for the next play tick.
      let lastT = 0;
      const applyAll = (t: number): void => {
        lastT = t;
        recs.forEach(syncLook); // live-material re-check first (P0)
        const g = clamp(num(params.edgeGlow, 1.1), 0, 2.5);
        uGlow.value = g;
        uGlowVis.value = Math.min(g * 0.5, 0.9);
        applyPhase(t);
      };

      return {
        duration: () => num(params.duration, 2.4),
        seek: applyAll,
        onParamChange: () => {
          // Every control (duration/shapePath/edgeGlow/curve) feeds the same
          // state pipeline — re-apply at the held time so paused sweeps latch.
          applyAll(lastT);
        },
        dispose: () => {
          for (const rec of recs) {
            // Restore the LATEST live source material (never our mask).
            if (rec.mesh.material === rec.mat) rec.mesh.material = rec.srcMat;
            rec.mat.dispose(); // never the subject's shared map — only our material
          }
          // Hand chrome back exactly as found (opacity AND .transparent).
          for (const c of chromeRecs) {
            for (const s of c.mats) {
              s.mat.opacity = s.opacity;
              s.mat.transparent = s.transparent;
            }
          }
          whiteTex.dispose();
          delete target.userData.irisMorphRadius;
          delete target.userData.irisMorphWeights;
          delete target.userData.irisMorphGlow;
          delete target.userData.irisMorphLook;
          delete target.userData.irisMorphChrome;
        },
      };
    },
  ),
};
