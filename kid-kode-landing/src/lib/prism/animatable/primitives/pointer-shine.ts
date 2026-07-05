// pointer-shine — a sharp anamorphic glint flares at the pointer location,
// twinkling as it tracks the cursor across glossy glass. HARD / pointer
// primitive. NON-DESTRUCTIVE: the subject's own material is NEVER touched.
// The glint lives on a dedicated additive overlay mesh parented under the
// subject — a MeshBasicNodeMaterial whose colorNode builds a crisp cross/star
// streak centred at uPointer (a vec2 in 0..1 uv space): two perpendicular
// exponential lobes (one long + thin, one short + thin) plus a small radial
// core, the whole glint modulated by a twinkle term. Additive blending means
// black contributes nothing, so off-glint the overlay is invisible and the
// artifact's baked look shows through untouched.
//
// Overlay fitting:
//   - Mesh subject  → the overlay REUSES the subject's geometry (same
//     silhouette, same uv space) with identity local transform under the
//     subject, depthWrite off + polygon offset so it sits just proud.
//   - Group subject (e.g. the MSDF 'text-object') → a quad fitted to the
//     group's measured Box3, slightly in front (offset scaled from the
//     measured size — never hardcoded world units).
//
// seek() reads userData.pointer -> uPointer and advances uTime; controls read
// live so length/intensity/twinkle/color tweak with no rebuild. DISTINCT from
// spotlight-follow (which is a SOFT radial hotspot) — this is a SHARP
// anamorphic streak.

import {
  AdditiveBlending,
  Box3,
  Color,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  float,
  abs,
  exp,
  sin,
  length,
  max,
  add,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'length', label: 'Length', type: 'knob', min: 0.5, max: 6, step: 0.05, default: 2.4 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 4, step: 0.05, default: 2.2 },
  { id: 'twinkle', label: 'Twinkle', type: 'knob', min: 0, max: 12, step: 0.1, default: 6 },
  // Glint tint — a user-facing color control (cool-white default).
  { id: 'color', label: 'Color', type: 'color', default: '#ebf5ff' },
] as const;

const OVERLAY_NAME = 'pointer-shine-overlay';
const DEFAULT_COLOR = '#ebf5ff';

export const pointerShinePrimitive: PrimitiveDefinition = {
  name: 'pointer-shine',
  label: 'Pointer Shine',
  category: 'pointer',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'pointer',
  description:
    'A sharp anamorphic glint flares at the pointer location, twinkling as it tracks the cursor across glossy glass.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'pointer-shine', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D | null = target.subject ?? null;

      // Live uniforms. uPointer is the glint centre in 0..1 uv space.
      const uPointer = uniform(new Vector2(0.5, 0.5));
      const uTime = uniform(0);
      // uLength scales the long streak falloff (larger length -> smaller falloff
      // coefficient -> longer streak). uIntensity scales the whole glint.
      const uLength = uniform(num(params.length, 2.4));
      const uIntensity = uniform(num(params.intensity, 2.2));
      const uTwinkle = uniform(num(params.twinkle, 6));
      const uColor = uniform(new Color(str(params.color, DEFAULT_COLOR)));

      const u = uv();
      const dx = abs(u.x.sub(uPointer.x));
      const dy = abs(u.y.sub(uPointer.y));

      // Falloff coefficients. The "loose" coefficient controls the long axis of
      // each streak lobe and scales inversely with uLength; the "tight"
      // coefficient is large and fixed so the streak stays razor-thin across.
      const kLoose = float(40).div(uLength);
      const kTight = float(220);

      // Horizontal lobe: long across x, thin across y.
      const lobeH = exp(dx.mul(kLoose).negate()).mul(exp(dy.mul(kTight).negate()));
      // Vertical lobe: long across y, thin across x.
      const lobeV = exp(dy.mul(kLoose).negate()).mul(exp(dx.mul(kTight).negate()));
      // Small radial core at the centre.
      const dr = length(vec2(dx, dy));
      const core = exp(dr.mul(float(90)).negate());

      // Cross/star streak + core. Use max for the cross so the two lobes read
      // as a crisp star rather than a smeared sum.
      const streak: any = max(add(lobeH, lobeV), core);

      // Twinkle: 0.7 + 0.3*sin(uTime*tw), so the glint pulses but never dies.
      const twinkle = float(0.7).add(sin(uTime.mul(uTwinkle)).mul(0.3));

      // Tinted glint, scaled by streak * intensity * twinkle. Under additive
      // blending zero glint = fully invisible overlay.
      const glint = streak.mul(uIntensity).mul(twinkle);
      const colorNode = uColor.mul(glint);

      // ── Additive overlay — the subject's material is NEVER touched ──────
      const glintMat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        // Pull the overlay a hair toward the camera so the (potentially
        // coplanar) overlay never z-fights the artifact's own surface.
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      (glintMat as unknown as { colorNode: unknown }).colorNode = colorNode;

      let overlay: Mesh | null = null;
      let ownedGeometry: BufferGeometry | null = null;

      if (subject && (subject as Mesh).isMesh) {
        // Mesh subject: wear the subject's exact geometry (same silhouette,
        // same uv space) with identity local transform under the subject so it
        // co-moves under any transform animation.
        const subjectMesh = subject as Mesh;
        overlay = new Mesh(subjectMesh.geometry, glintMat);
        overlay.name = OVERLAY_NAME;
        overlay.renderOrder = (subjectMesh.renderOrder ?? 0) + 1;
        subjectMesh.add(overlay);
      } else if (subject) {
        // Group subject (e.g. MSDF 'text-object'): fit a quad to the group's
        // measured bbox, slightly in front. All dimensions derive from the
        // measurement — mounted artifacts vary wildly in size.
        subject.updateWorldMatrix(true, true);
        const worldBox = new Box3().setFromObject(subject);
        if (!worldBox.isEmpty()) {
          // Express the box in the subject's local frame so the quad can be
          // parented to the subject (co-moves) without double transforms.
          const inv = new Matrix4().copy(subject.matrixWorld).invert();
          const localBox = worldBox.clone().applyMatrix4(inv);
          const size = localBox.getSize(new Vector3());
          const center = localBox.getCenter(new Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const w = Math.max(size.x, maxDim * 1e-3);
          const h = Math.max(size.y, maxDim * 1e-3);

          ownedGeometry = new PlaneGeometry(w, h);
          overlay = new Mesh(ownedGeometry, glintMat);
          overlay.name = OVERLAY_NAME;
          overlay.position.copy(center);
          // "Slightly in front" — proportional to the measured size.
          overlay.position.z = localBox.max.z + maxDim * 0.02;
          overlay.renderOrder = (subject.renderOrder ?? 0) + 1;
          subject.add(overlay);
        }
      }

      // Expose live uniform handles on shared scratch space so the host/driver —
      // and CPU tests — can observe glint centre/intensity/time without a GPU.
      target.userData.pointerShineUniforms = { uPointer, uTime, uLength, uIntensity, uTwinkle, uColor };

      const readPointer = (): { x: number; y: number } => {
        const p = target.userData.pointer as { x: number; y: number } | undefined;
        return {
          x: clamp(typeof p?.x === 'number' ? p.x : 0.5, 0, 1),
          y: clamp(typeof p?.y === 'number' ? p.y : 0.5, 0, 1),
        };
      };

      return {
        // Stateful / pointer-driven: twinkles continuously across t.
        duration: () => Infinity,
        seek: (t) => {
          const p = readPointer();
          (uPointer.value as Vector2).set(p.x, p.y);
          uTime.value = t;
          // Read controls live so changes apply with no rebuild.
          uLength.value = num(params.length, 2.4);
          uIntensity.value = num(params.intensity, 2.2);
          uTwinkle.value = num(params.twinkle, 6);
          (uColor.value as Color).set(str(params.color, DEFAULT_COLOR));
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'length') uLength.value = num(value, 2.4);
          else if (id === 'intensity') uIntensity.value = num(value, 2.2);
          else if (id === 'twinkle') uTwinkle.value = num(value, 6);
          else if (id === 'color') (uColor.value as Color).set(str(value, DEFAULT_COLOR));
        },
        dispose: () => {
          // Remove + dispose ONLY what this primitive created. The subject's
          // own material/geometry are never touched at any point.
          if (overlay) {
            overlay.parent?.remove(overlay);
            overlay = null;
          }
          ownedGeometry?.dispose();
          ownedGeometry = null;
          glintMat.dispose();
        },
      };
    },
  ),
};
