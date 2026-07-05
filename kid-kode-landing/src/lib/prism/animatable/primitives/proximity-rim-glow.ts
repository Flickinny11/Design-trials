// proximity-rim-glow — the card's EDGE wakes as the cursor nears: a warm brass
// rim light kindles along the pointer-facing border, breathing with distance.
// MEDIUM / pointer primitive. NON-DESTRUCTIVE: the subject's own material is
// NEVER touched (pointer-shine.ts discipline). The rim lives on a dedicated
// ADDITIVE overlay shell — a MeshBasicNodeMaterial (AdditiveBlending,
// depthWrite:false) parented under the subject — so off-glow it contributes
// nothing and the artifact's baked look shows through untouched.
//
// The rim's TSL opacity is a fresnel-style EDGE term — pow(1 - |normal·view|,
// power) — bright at grazing angles (the silhouette edge), dark across the flat
// face (bevel-glass.ts / fresnel-glow.ts edge math, but as an ADDITIVE overlay
// here, never a material swap). That edge term is MULTIPLIED by:
//   • proximity   — a CPU-computed smoothstep of the pointer's distance to the
//     card center (the rim only wakes as the cursor nears), exponentially
//     smoothed each seek so a pinned engaged pointer settles to a steady lit
//     hold and relaxes home when the cursor leaves;
//   • directional bias — dot(view-space edge direction, pointer-offset
//     direction): the rim kindles BRIGHTER on the edge the cursor faces, so the
//     light reads as coming from the pointer (bias=0 lights the whole rim
//     evenly; bias=1 lights only the pointer-facing arc);
//   • a slow breathing modulation (deterministic sin of t) so the engaged hold
//     never reads frozen.
// Plus a subtle whole-card lean (≤ a few degrees) toward the pointer on the
// owning object so the kindled edge reads physical, not painted-on. The lean is
// exponentially smoothed (dt-normalized) and relaxes to the home pose when the
// pointer disengages — no jitter, no overshoot at any control extreme.
//
// DISTINCT FROM:
//   • pointer-shine — a travelling SPECULAR glint ON the surface (a uv-centred
//     cross/star); THIS is an EDGE rim, proximity-gated and directional.
//   • spotlight-follow — a SOFT radial brightness disc ON the surface (and it
//     SWAPS the material); THIS is a fresnel EDGE rim on an additive shell that
//     never touches the subject material.
//   • hover-lift — lift only, no glow.
// Reference: DESIGN-REFERENCES.md §7 Cursify 'Glow' preset (edge-light take).

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
  vec2,
  vec3,
  float,
  abs,
  sin,
  max,
  mix,
  pow,
  oneMinus,
  normalView,
  positionViewDirection,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'intensity', label: 'Glow Intensity', type: 'knob', min: 0, max: 3, step: 0.05, default: 1.6 },
  { id: 'rimTightness', label: 'Rim Tightness', type: 'knob', min: 1, max: 6, step: 0.05, default: 3 },
  { id: 'proximityRange', label: 'Proximity Range', type: 'fader', min: 0.2, max: 0.9, step: 0.01, default: 0.55 },
  { id: 'directionalBias', label: 'Directional Bias', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.6 },
] as const;

const OVERLAY_NAME = 'proximity-rim-glow-overlay';
// Warm brass rim tint (Observatory-Brass world — no purple). Slightly hotter
// than the subject's brass chrome so the kindled edge reads as light, not paint.
const RIM_TINT = '#f2c179';
// Whole-card lean: subtle, peaks at a few degrees so the whole envelope stays
// well inside the tile frame.
const MAX_LEAN_RAD = (3.5 * Math.PI) / 180;
// Breathing: slow sine on t, kept >0 so the engaged hold never blacks out.
const BREATHE_SPEED = 1.7;
// Exponential smoothing reference framerate (matches pointer-attract-scale).
const SMOOTH_FPS = 60;

interface PointerXY {
  x: number;
  y: number;
}

export const proximityRimGlowPrimitive: PrimitiveDefinition = {
  name: 'proximity-rim-glow',
  label: 'Proximity Rim Glow',
  category: 'pointer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'pointer',
  description:
    "The card's edge wakes as the cursor nears — a warm brass rim light kindling along the pointer-facing edge, breathing with distance.",
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'proximity-rim-glow', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D | null = target.subject ?? null;
      // Lean the OWNING object so the subject + overlay tilt together and the
      // lean composes above whatever transforms the subject itself carries.
      const leanObj: Object3D = target.object;
      const baseRotX = leanObj.rotation.x;
      const baseRotY = leanObj.rotation.y;

      // ── Live uniforms (also published for the host/driver + CPU tests) ─────
      const uProximity = uniform(0); // 0 disengaged → 1 at center
      const uPower = uniform(num(params.rimTightness, 3)); // rim tightness
      const uIntensity = uniform(num(params.intensity, 1.6));
      const uBias = uniform(num(params.directionalBias, 0.6)); // 0 even → 1 pointer-side
      const uTime = uniform(0);
      // Pointer-offset direction in screen XY (unit), defaulting to +x.
      const uPointerDir = uniform(new Vector2(1, 0));
      const uColor = uniform(new Color(RIM_TINT));
      // Standing "sensing reach" gain driven by proximityRange. A wider range
      // means the card's edge is MORE awake at any given cursor distance — so at
      // the SAME pinned engaged offset a larger range yields a stronger, wider
      // rim (not just a slower distance falloff). This is the standing-pose
      // coupling the advocate harness samples: it pins the cursor and sweeps
      // proximityRange with same-t (dt≈0) re-seeks, so the rim must re-render
      // from the control alone. uRangeGain scales the rim brightness; uRangeSoft
      // softens the fresnel power so the lit edge band visibly WIDENS as the
      // range opens up.
      const uRangeGain = uniform(1);
      const uRangeSoft = uniform(1);

      // ── TSL rim (fresnel EDGE term) ────────────────────────────────────────
      // fresnel = 1 - |normalView · viewDir|: ~0 across the flat face, ~1 at the
      // grazing silhouette edge. pow(fresnel, power) tightens the rim into the
      // border as `rimTightness` rises.
      const fresnel = oneMinus(normalView.dot(positionViewDirection).abs());
      // Effective tightness = rimTightness softened by the sensing reach: a wider
      // proximityRange (uRangeSoft > 1) divides the power down so the lit edge
      // band WIDENS, a tighter range raises it so the rim pulls into the border.
      // Floored at 1 so the rim never inverts into a face flood.
      const effPower = max(uPower.div(uRangeSoft) as never, float(1));
      const edge = pow(fresnel, effPower);

      // Directional bias: how much this fragment's view-space edge direction
      // faces the pointer. normalView.xy is the screen-projected edge direction;
      // dot with the pointer-offset direction → 1 on the pointer-facing arc, ≤0
      // on the far side. Clamp the far side off (max(.,0)) and mix between an
      // even rim (bias 0) and a pointer-biased rim (bias 1).
      const edgeDir = (normalView.xy as unknown as { normalize: () => unknown }).normalize();
      const facing = max((edgeDir as { dot: (o: unknown) => unknown }).dot(uPointerDir) as never, float(0));
      const directional = mix(float(1), facing, uBias);

      // Breathing keeps the engaged hold alive: 0.78 + 0.22*sin(t).
      const breathe = float(0.78).add(sin(uTime.mul(BREATHE_SPEED)).mul(0.22));

      // Additive rim color. Off-proximity uProximity≈0 → black → invisible under
      // additive blending, so the subject shows through untouched at rest.
      const rim = edge
        .mul(directional)
        .mul(uProximity)
        .mul(uRangeGain)
        .mul(breathe)
        .mul(uIntensity);
      const colorNode = uColor.mul(rim);

      const rimMat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        // Pull the (possibly coplanar) shell a hair toward the camera so it
        // never z-fights the artifact's own surface.
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      (rimMat as unknown as { colorNode: unknown }).colorNode = colorNode;

      // ── Additive overlay SHELL — subject material NEVER touched ─────────────
      let overlay: Mesh | null = null;
      let ownedGeometry: BufferGeometry | null = null;

      if (subject && (subject as Mesh).isMesh) {
        // Mesh subject: wear the subject's exact geometry (same silhouette, same
        // normals → the fresnel edge hugs the artifact's real border), slightly
        // scaled out so the additive shell reads just proud of the surface.
        const subjectMesh = subject as Mesh;
        overlay = new Mesh(subjectMesh.geometry, rimMat);
        overlay.name = OVERLAY_NAME;
        overlay.scale.setScalar(1.012);
        overlay.renderOrder = (subjectMesh.renderOrder ?? 0) + 1;
        subjectMesh.add(overlay);
      } else if (subject) {
        // Group subject (e.g. MSDF 'text-object'): fit a quad to the group's
        // measured bbox, slightly in front. All dimensions derive from the
        // measurement — mounted artifacts vary wildly in size (never hardcoded).
        subject.updateWorldMatrix(true, true);
        const worldBox = new Box3().setFromObject(subject);
        if (!worldBox.isEmpty()) {
          const inv = new Matrix4().copy(subject.matrixWorld).invert();
          const localBox = worldBox.clone().applyMatrix4(inv);
          const size = localBox.getSize(new Vector3());
          const center = localBox.getCenter(new Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const w = Math.max(size.x, maxDim * 1e-3) * 1.04;
          const h = Math.max(size.y, maxDim * 1e-3) * 1.04;

          ownedGeometry = new PlaneGeometry(w, h);
          overlay = new Mesh(ownedGeometry, rimMat);
          overlay.name = OVERLAY_NAME;
          overlay.position.copy(center);
          overlay.position.z = localBox.max.z + maxDim * 0.02;
          overlay.renderOrder = (subject.renderOrder ?? 0) + 1;
          subject.add(overlay);
        }
      }

      // Publish live handles so the host/driver — and CPU tests — can observe
      // the engaged state without a GPU.
      target.userData.proximityRimGlowUniforms = {
        uProximity,
        uPower,
        uIntensity,
        uBias,
        uPointerDir,
        uTime,
        uColor,
        uRangeGain,
        uRangeSoft,
      };

      // ── Pointer read (0..1, finite-guarded) ────────────────────────────────
      const readPointer = (): PointerXY => {
        const p = (target.userData as { pointer?: Partial<PointerXY> }).pointer;
        const x = p && typeof p.x === 'number' && Number.isFinite(p.x) ? p.x : 0.5;
        const y = p && typeof p.y === 'number' && Number.isFinite(p.y) ? p.y : 0.5;
        return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
      };

      // Smoothed proximity + lean state (relative to base), exponentially
      // approached each seek so a pinned pointer settles to a steady engaged
      // hold and disengaging relaxes home.
      let proxState = 0;
      let leanX = 0;
      let leanY = 0;
      let lastT = -Infinity;
      // Last pointer offset/distance from center, captured each seek so a
      // control tweak (onParamChange) can recompute the STANDING engaged
      // proximity from the pinned cursor with no re-seek — the advocate sweeps
      // controls with same-t (dt≈0) re-seeks, so the settled hold must respond
      // to proximityRange immediately.
      let lastDist = 0;

      // Standing proximity at a pinned cursor distance for a given sensing
      // range: smoothstep falloff, 1 at center → 0 beyond range. This IS the
      // settled equilibrium for a stationary pointer, so it's the value a pinned
      // engaged pose holds — and it RISES with `range` at the same distance.
      const computeProxTarget = (dist: number, range: number): number => {
        const r = clamp(range, 0.2, 0.9);
        const k = clamp(1 - dist / r, 0, 1);
        return k * k * (3 - 2 * k);
      };

      // Standing rim-shape gains for the sensing range, relative to the schema
      // default (0.55). A wider range makes the edge MORE awake: brighter rim
      // (uRangeGain ↑) over a WIDER band (uRangeSoft ↑ → softer fresnel power).
      // Both are smooth, monotonic, and bounded so the rim never explodes or
      // floods the face at the control extremes.
      const RANGE_DEFAULT = 0.55;
      const applyRangeGains = (range: number) => {
        const r = clamp(range, 0.2, 0.9);
        // Normalize the 0.2..0.9 range to ~0.57..2.57 around the default: a
        // larger reach kindles a stronger rim at the same distance.
        const norm = r / RANGE_DEFAULT;
        uRangeGain.value = clamp(0.4 + norm, 0.5, 3);
        // Softening factor widens the lit edge band as the range opens up,
        // bounded so the rim stays an edge (effPower floored at 1 in TSL).
        uRangeSoft.value = clamp(0.6 + norm * 0.6, 0.6, 2.2);
      };
      applyRangeGains(num(params.proximityRange, RANGE_DEFAULT));

      // Re-apply the smoothed pose to the live uniforms/transform. Called from
      // seek AND onParamChange so a control tweak reshapes the frame at the last
      // seek state with no re-seek.
      const applyPose = () => {
        uProximity.value = clamp(proxState, 0, 1);
        uPower.value = clamp(num(params.rimTightness, 3), 1, 6);
        uIntensity.value = clamp(num(params.intensity, 1.6), 0, 3);
        uBias.value = clamp(num(params.directionalBias, 0.6), 0, 1);
        leanObj.rotation.x = baseRotX + leanX;
        leanObj.rotation.y = baseRotY + leanY;
      };

      return {
        // Stateful pointer effect: tracks the live pointer, never "ends".
        duration: () => Infinity,
        seek: (t) => {
          const p = readPointer();
          const offX = p.x - 0.5;
          const offY = p.y - 0.5;
          const dist = Math.hypot(offX, offY); // 0 center → ~0.707 corner
          lastDist = dist;

          // Proximity target: smoothstep falloff over `proximityRange` (a wider
          // range keeps the rim lit further out). 1 at center → 0 beyond range.
          const range = clamp(num(params.proximityRange, RANGE_DEFAULT), 0.2, 0.9);
          const proxTarget = computeProxTarget(dist, range); // standing equilibrium
          // Keep the standing rim-shape gains coherent with the live range so
          // the engaged hold reflects the current sensing reach.
          applyRangeGains(range);

          // Pointer-offset direction in screen XY (unit). When the cursor sits
          // dead center the direction is undefined → keep the previous value so
          // uPointerDir never goes NaN.
          if (dist > 1e-4) {
            (uPointerDir.value as Vector2).set(offX / dist, offY / dist).normalize();
          }

          // Lean target toward the pointer: yaw follows horizontal offset, pitch
          // follows vertical (negated so the top tips back toward the cursor).
          // Gated by a soft proximity weight (same `proximityRange` falloff, but
          // shaped to stay strong across the engaged band and vanish for a far/
          // disengaged cursor) so an engaged pointer visibly faces the card while
          // a far pointer leaves it at the home pose (idle legibility) and a
          // center pointer (offset 0) leans not at all.
          const leanWeight = Math.sqrt(proxTarget); // broaden the engaged band
          const leanTargetY = clamp(offX * 2, -1, 1) * MAX_LEAN_RAD * leanWeight;
          const leanTargetX = -clamp(offY * 2, -1, 1) * MAX_LEAN_RAD * leanWeight;

          // dt-normalized exponential approach (semi-implicit, critically
          // stable — no overshoot at any control extreme). Backward seek snaps
          // for reproducible replay.
          let alpha = 0.18;
          if (Number.isFinite(lastT)) {
            const dt = t - lastT;
            if (dt < 0) {
              proxState = proxTarget;
              leanX = leanTargetX;
              leanY = leanTargetY;
            } else {
              alpha = 1 - Math.pow(1 - 0.18, Math.max(0, dt) * SMOOTH_FPS);
            }
          }
          alpha = clamp(alpha, 0, 1);
          proxState += (proxTarget - proxState) * alpha;
          leanX += (leanTargetX - leanX) * alpha;
          leanY += (leanTargetY - leanY) * alpha;
          lastT = t;

          uTime.value = t;
          applyPose();
        },
        onParamChange: (id: string, value: ControlValue) => {
          // Re-apply at the last seek state (no re-seek needed).
          if (id === 'rimTightness') uPower.value = clamp(num(value, 3), 1, 6);
          else if (id === 'intensity') uIntensity.value = clamp(num(value, 1.6), 0, 3);
          else if (id === 'directionalBias') uBias.value = clamp(num(value, 0.6), 0, 1);
          else if (id === 'proximityRange') {
            // proximityRange reshapes the STANDING engaged pose directly. The
            // advocate sweeps it at a pinned cursor with same-t re-seeks (dt≈0),
            // so the smoothing path can't move proxState — recompute the
            // standing equilibrium from the last pinned distance and snap the
            // settled hold to it, plus refresh the rim-shape gains. At the same
            // pinned offset, a wider range ⇒ higher proximity + stronger/wider
            // rim; the frozen frame re-renders from the control alone.
            const range = clamp(num(value, RANGE_DEFAULT), 0.2, 0.9);
            applyRangeGains(range);
            // Only re-derive the settled proximity once the pointer has been
            // read at least once (a real engaged seek happened); before that,
            // leave proxState at rest so the idle frame stays dark.
            if (Number.isFinite(lastT)) {
              proxState = computeProxTarget(lastDist, range);
            }
          }
          // Re-apply the current pose now so the uniforms/transform stay coherent
          // at the pinned seek state.
          applyPose();
        },
        dispose: () => {
          // Restore the home pose and remove + dispose ONLY what we created. The
          // subject's own material/geometry are never touched at any point.
          leanObj.rotation.x = baseRotX;
          leanObj.rotation.y = baseRotY;
          if (overlay) {
            overlay.parent?.remove(overlay);
            overlay = null;
          }
          ownedGeometry?.dispose();
          ownedGeometry = null;
          rimMat.dispose();
        },
      };
    },
  ),
};
