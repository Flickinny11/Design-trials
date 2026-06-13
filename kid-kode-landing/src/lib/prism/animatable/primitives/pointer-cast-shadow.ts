// pointer-cast-shadow — the cursor becomes the room's lamp. The card throws a
// soft TRUE shadow away from the pointer, stretching long when the light rakes
// low across the surface and snapping tight underfoot when the cursor hovers
// overhead; the lit side of the card gets a faint directional rim and the card
// leans gently away from the light. POINTER / medium.
//
// TECHNIQUE — DESIGN-REFERENCES.md §7 (Cursor & Interaction Libraries), the
// "cursor-as-light" interaction pattern: the pointer's subject-space position is
// treated as a point light. Implemented natively on our three/webgpu+TSL stack
// (no mouse-follower / cursify DOM libs): a single soft shadow QUAD (TSL radial
// falloff opacity, deep graphite — never pure black, depthWrite off) sits just
// behind/below the card, displaced OPPOSITE the pointer direction and stretched
// along that axis. Shadow length grows as the light drops low/off-axis and
// tightens beneath when the pointer is overhead; softness blurs the falloff with
// distance. The card itself receives (a) an ADDITIVE directional rim brightening
// on the pointer side (pointer-shine discipline — the subject's own material is
// NEVER touched) and (b) a faint lean away from the light. All extents are
// subject-relative (Box3.setFromObject measured) so the whole envelope stays in
// the tile frame; nothing is hardcoded in world units.
//
// PHYSICS — the pointer position drives critically-stable exponential springs
// (dt-normalized, semi-implicit) toward a target light vector, so the pinned
// engaged frame holds a visible offset shadow while every control still reshapes
// it. A small decaying `lastImpulse` velocity envelope (from per-seek pointer
// delta) gives the shadow a transient extra reach on a fast cursor flick, then
// settles — so the look reads alive even when the rig pins the pointer (velocity
// ~0) at the engaged point. Deterministic: no Math.random; finite-guarded.
//
// DISTINCT FROM neighbors:
//   • spotlight-follow — a BRIGHT radial hotspot painted ON the surface (it
//     swaps the card material's emissive). pointer-cast-shadow is the inverse:
//     a DARK soft shadow thrown BEHIND the card with directional displacement +
//     stretch physics, and it NEVER swaps the subject material.
//   • hover-lift / static drop-shadow class — a fixed shadow under a lifted
//     card. Here the shadow has live directional physics: it sweeps, rotates,
//     and elongates with the cursor-as-light angle.
//   • proximity-rim-glow (sibling) — rim brightening only, no shadow. Here the
//     rim is a secondary cue; the cast shadow with its physics is the subject.

import {
  AdditiveBlending,
  Box3,
  Color,
  Mesh,
  PlaneGeometry,
  Vector2,
  Vector3,
  type Object3D,
} from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  length,
  smoothstep,
  oneMinus,
  dot,
  max,
  clamp as tslClamp,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  // Shadow length — how far the shadow stretches when the light rakes low.
  { id: 'shadowLength', label: 'Shadow length', type: 'fader', min: 0.2, max: 1, step: 0.01, default: 0.62 },
  // Softness — blur of the shadow's falloff (penumbra width).
  { id: 'softness', label: 'Softness', type: 'knob', min: 0.05, max: 1, step: 0.01, default: 0.55 },
  // Shadow opacity — how deep the graphite shadow reads at its core.
  { id: 'opacity', label: 'Shadow opacity', type: 'fader', min: 0.1, max: 1, step: 0.01, default: 0.62 },
  // Rim light intensity — the additive directional brightening on the lit side.
  { id: 'rimIntensity', label: 'Rim light', type: 'knob', min: 0, max: 3, step: 0.05, default: 1.1 },
] as const;

const SHADOW_NAME = 'pointer-cast-shadow-quad';
const RIM_NAME = 'pointer-cast-shadow-rim';

// Deep graphite (Observatory-Brass world) — a true soft shadow, never pure
// black; reads as a lit room's cast shadow, not a hole.
const SHADOW_RGB: [number, number, number] = [0.04, 0.045, 0.06];
// Warm-bone rim, derived from the brass/ice world (no purple).
const RIM_RGB: [number, number, number] = [0.92, 0.86, 0.72];

interface XY {
  x: number;
  y: number;
}

export const pointerCastShadowPrimitive: PrimitiveDefinition = {
  name: 'pointer-cast-shadow',
  label: 'Pointer Cast Shadow',
  category: 'pointer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'pointer',
  schema: SCHEMA,
  description:
    'The cursor becomes the room lamp — the card throws a soft true shadow away from it, raking long when the light is low and snapping tight underfoot when it hovers above.',
  create: defineAnimatable(
    { name: 'pointer-cast-shadow', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = target.subject ?? target.object;

      // Snapshot the home pose so dispose() restores EVERYTHING.
      const baseRotY = subject.rotation.y;
      const baseRotZ = subject.rotation.z;

      // ── Measure the subject so all extents are subject-relative (RA framing).
      // Local-frame size: scale/displace the shadow + rim relative to this, so
      // the whole envelope stays inside the tile no matter the artifact size.
      subject.updateWorldMatrix(true, true);
      const worldBox = new Box3().setFromObject(subject);
      const sizeV = new Vector3(1, 1, 1);
      const centerV = new Vector3(0, 0, 0);
      if (!worldBox.isEmpty()) {
        worldBox.getSize(sizeV);
        worldBox.getCenter(centerV);
      }
      const halfW = Math.max(sizeV.x * 0.5, 1e-3);
      const halfH = Math.max(sizeV.y * 0.5, 1e-3);
      const halfDepth = Math.max(sizeV.z * 0.5, 1e-3);
      const span = Math.max(sizeV.x, sizeV.y);

      // ── Shadow quad: sized a touch larger than the card so its soft penumbra
      // reads, sitting just behind on −z. Its position/scale are driven each
      // seek; its TSL material is built once.
      const uDir = uniform(new Vector2(0, -1)); // light→shadow direction (subject space)
      const uLength = uniform(num(params.shadowLength, 0.62));
      const uSoftness = uniform(clamp(num(params.softness, 0.55), 0.05, 1));
      const uOpacity = uniform(clamp(num(params.opacity, 0.62), 0, 1));

      // Radial falloff in the quad's uv space, elongated along uDir so the blob
      // becomes an oval thrown along the light axis. d = distance from center in
      // a frame stretched perpendicular to uDir.
      const u = uv();
      const p = vec2(u.x.sub(0.5), u.y.sub(0.5)).mul(2); // -1..1
      // Project onto / across the light axis. Along-axis gets compressed (so the
      // oval lengthens that way), cross-axis stays tight.
      const along = dot(p, uDir);
      const across = p.sub(uDir.mul(along));
      // Stretch factor grows with length: along-axis radius scales up.
      const stretch = float(1).add(uLength.mul(1.6));
      const dAlong = along.div(stretch);
      const d = length(vec2(dAlong, length(across)));
      // Soft edge: core opaque, fading to 0 at the rim; softness widens penumbra.
      const edge0 = oneMinus(uSoftness).mul(0.5);
      const falloff = oneMinus(smoothstep(edge0, float(1.0), d));
      const shadowAlpha = falloff.mul(uOpacity);

      const shadowMat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        // Deep graphite; alpha carries the soft falloff. Not additive — a shadow
        // DARKENS, it does not glow. depthWrite off so it never occludes.
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });
      (shadowMat as unknown as { colorNode: unknown }).colorNode = vec3(
        SHADOW_RGB[0],
        SHADOW_RGB[1],
        SHADOW_RGB[2],
      );
      (shadowMat as unknown as { opacityNode: unknown }).opacityNode = tslClamp(
        shadowAlpha,
        float(0),
        float(1),
      );

      // Base quad slightly larger than the card; scale/position driven per seek.
      const shadowGeo = new PlaneGeometry(span * 1.5, span * 1.5);
      const shadow = new Mesh(shadowGeo, shadowMat);
      shadow.name = SHADOW_NAME;
      shadow.renderOrder = -1; // draw behind the card
      target.object.add(shadow);

      // ── Rim overlay: an ADDITIVE quad fitted to the subject's silhouette that
      // brightens the lit (pointer) side. NEVER touches the subject material —
      // pointer-shine discipline. Reuses the subject geometry when the subject
      // is a Mesh (exact silhouette/uv); otherwise a fitted quad.
      const uPointer = uniform(new Vector2(0.5, 0.5));
      const uRim = uniform(clamp(num(params.rimIntensity, 1.1), 0, 3));

      const ru = uv();
      // Brighten the side of the card facing the pointer: gradient peaking at the
      // pointer's uv, falling across the face. A directional ramp, not a hotspot.
      const toPointer = vec2(uPointer.x.sub(ru.x), uPointer.y.sub(ru.y));
      const rimFall = oneMinus(tslClamp(length(toPointer).mul(1.3), float(0), float(1)));
      // Concentrate to the rim band (edge of the face) so it reads as a lit edge,
      // not a flat wash: weight by proximity to the uv border on the lit side.
      const edgeBand = max(
        oneMinus(smoothstep(float(0), float(0.32), ru.x)),
        max(
          smoothstep(float(0.68), float(1.0), ru.x),
          max(
            oneMinus(smoothstep(float(0), float(0.32), ru.y)),
            smoothstep(float(0.68), float(1.0), ru.y),
          ),
        ),
      );
      const rimGlow = rimFall.mul(edgeBand).mul(uRim);
      const rimColor = vec3(RIM_RGB[0], RIM_RGB[1], RIM_RGB[2]).mul(rimGlow);

      const rimMat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      (rimMat as unknown as { colorNode: unknown }).colorNode = rimColor;

      let rim: Mesh | null = null;
      let ownedRimGeo: PlaneGeometry | null = null;
      const subjectMesh = subject as Mesh;
      if (subjectMesh.isMesh && subjectMesh.geometry) {
        rim = new Mesh(subjectMesh.geometry, rimMat);
        rim.name = RIM_NAME;
        rim.renderOrder = (subjectMesh.renderOrder ?? 0) + 1;
        subjectMesh.add(rim);
      } else {
        // Group subject: fit a quad to the measured silhouette, just in front.
        ownedRimGeo = new PlaneGeometry(Math.max(sizeV.x, 1e-3), Math.max(sizeV.y, 1e-3));
        rim = new Mesh(ownedRimGeo, rimMat);
        rim.name = RIM_NAME;
        rim.position.set(centerV.x, centerV.y, centerV.z + halfDepth + span * 0.02);
        rim.renderOrder = (subject.renderOrder ?? 0) + 1;
        subject.add(rim);
      }

      // Expose live uniform handles on shared scratch space so the host/driver —
      // and CPU tests — can observe the shadow + rim state without a GPU.
      target.userData.pointerCastShadowUniforms = {
        shadow: { uDir, uLength, uSoftness, uOpacity },
        rim: { uPointer, uRim },
      };

      // ── Spring state (subject-space). curOff = current light→shadow direction
      // (a unit-ish vector scaled by engagement); curLean = current lean angle;
      // velocity envelope for the fast-flick reach boost. ──────────────────────
      let curOffX = 0;
      let curOffY = -0.001; // start barely under the card so an idle frame still reads
      let curLean = 0; // rotation.y lean (yaw away from light)
      let curRoll = 0; // rotation.z faint roll, away from light
      let lastImpulse = 0; // decaying velocity envelope
      let prevPx = 0.5;
      let prevPy = 0.5;
      let prevT = Number.NaN;
      let havePrev = false;

      const readPointer = (): { p: XY; engaged: boolean } => {
        const raw = (target.userData as { pointer?: Partial<XY> }).pointer;
        const x = raw && typeof raw.x === 'number' && Number.isFinite(raw.x) ? raw.x : 0.5;
        const y = raw && typeof raw.y === 'number' && Number.isFinite(raw.y) ? raw.y : 0.5;
        const cx = clamp(x, 0, 1);
        const cy = clamp(y, 0, 1);
        // Engagement: how far the pointer is from dead-center (the disengaged
        // idle state). 0 at center → 1 at a corner. Disengaged ⇒ home pose.
        const offX = cx - 0.5;
        const offY = cy - 0.5;
        const eng = clamp(Math.hypot(offX, offY) * 2, 0, 1);
        return { p: { x: cx, y: cy }, engaged: eng > 0.02 };
      };

      // Critically-stable exponential spring: x += (target-x)*(1-exp(-rate*dt)).
      // Deterministic, never overshoots/jitters, stable at any dt.
      const springTo = (cur: number, tgt: number, rate: number, dt: number): number => {
        const k = 1 - Math.exp(-rate * Math.max(dt, 0));
        return cur + (tgt - cur) * k;
      };

      const apply = () => {
        // Shadow direction = OPPOSITE the pointer (light) direction. The pointer
        // sits at {x,y}; the card is centered at 0.5,0.5; the light comes FROM
        // the pointer, so the shadow is thrown along (center - pointer).
        const dirLen = Math.hypot(curOffX, curOffY) || 1e-4;
        (uDir.value as Vector2).set(curOffX / dirLen, curOffY / dirLen);

        // How "low / off-axis" the light is = engagement magnitude → longer
        // shadow + farther displacement; overhead (low engagement) → tight.
        const eng = clamp(Math.hypot(curOffX, curOffY), 0, 1);
        const lengthCtrl = clamp(num(params.shadowLength, 0.62), 0.2, 1);
        // Effective stretch grows with both the control and the rake angle, plus
        // a transient kick from a fast flick (lastImpulse) — keeps the pinned
        // engaged frame alive and lets the velocity envelope read.
        const reach = eng * (0.55 + lengthCtrl) + lastImpulse * 0.25;

        // Place the shadow center: opposite the light, offset by subject-relative
        // reach, dropped slightly behind the card on −z. Tight underfoot (a small
        // downward bias) when overhead so an idle/overhead frame still shows it.
        const offsetMag = (0.18 + reach) * span * 0.55;
        shadow.position.set(
          centerV.x + curOffX * offsetMag,
          centerV.y + curOffY * offsetMag - halfH * 0.12,
          centerV.z - halfDepth - span * 0.04,
        );
        // Stretch the quad along the throw: longer with the length control + rake.
        const scaleAlong = 1 + (lengthCtrl + eng) * 1.1;
        shadow.scale.set(1 + eng * 0.15, scaleAlong, 1);
        // Rotate the quad so its long axis follows the throw direction.
        shadow.rotation.z = Math.atan2(curOffY, curOffX) - Math.PI / 2;

        // Uniforms (read controls live so sweeps reshape the pinned frame).
        uLength.value = clamp(num(params.shadowLength, 0.62) * (0.5 + eng), 0, 2);
        uSoftness.value = clamp(num(params.softness, 0.55), 0.05, 1);
        uOpacity.value = clamp(num(params.opacity, 0.62) * (0.35 + eng * 0.65), 0, 1);

        // Rim: the LIT edge faces the light (the pointer side), which in uv space
        // is the opposite of the shadow throw — i.e. center MINUS the throw
        // offset. Mapped into 0..1 uv so the rim band reads coherently with the
        // cast shadow. Intensity (below) fades out near home (disengaged).
        (uPointer.value as Vector2).set(clamp(0.5 - curOffX, 0, 1), clamp(0.5 - curOffY, 0, 1));
        uRim.value = clamp(num(params.rimIntensity, 1.1) * (0.25 + eng * 0.75), 0, 3);

        // Card leans AWAY from the light (yaw + faint roll), bounded and gentle.
        subject.rotation.y = baseRotY + curLean;
        subject.rotation.z = baseRotZ + curRoll;
      };

      return {
        // Stateful pointer effect: tracks the live pointer, never "ends".
        duration: () => Infinity,
        seek: (t) => {
          const { p, engaged } = readPointer();
          // dt from consecutive seek times, clamped to a sane frame budget.
          let dt = havePrev && Number.isFinite(prevT) ? t - prevT : 1 / 60;
          if (!Number.isFinite(dt) || dt <= 0) dt = 1 / 60;
          dt = clamp(dt, 1 / 240, 1 / 12);

          // Per-seek pointer velocity (dt-normalized). Pinned ⇒ ~0; a flick ⇒
          // large. Feeds a decaying impulse envelope so the pinned frame stays
          // engaged and fast moves read as extra reach.
          const vx = havePrev ? (p.x - prevPx) / dt : 0;
          const vy = havePrev ? (p.y - prevPy) / dt : 0;
          const speed = Number.isFinite(vx) && Number.isFinite(vy) ? Math.hypot(vx, vy) : 0;
          // Envelope: rise to speed, decay exponentially each seek.
          const decay = 1 - Math.exp(-3.5 * dt);
          lastImpulse += (clamp(speed * 0.12, 0, 1.5) - lastImpulse) * decay;
          if (!Number.isFinite(lastImpulse)) lastImpulse = 0;

          // Target light→shadow offset: away from the pointer (center - pointer).
          // Disengaged (pointer at center) ⇒ target ~0 ⇒ springs home.
          const tgtOffX = engaged ? 0.5 - p.x : 0;
          const tgtOffY = engaged ? 0.5 - p.y : 0;

          // Spring the offset, lean, and roll toward the targets. Rates tuned
          // for a smooth, critically-stable follow (no jitter, no overshoot).
          curOffX = springTo(curOffX, tgtOffX, 9, dt);
          curOffY = springTo(curOffY, tgtOffY, 9, dt);

          // Lean AWAY from the light: pointer on the left (p.x<0.5 ⇒ tgtOffX>0)
          // ⇒ light from left ⇒ card tips its far edge up = negative yaw. Bounded.
          const leanTarget = engaged ? clamp(-(0.5 - p.x) * 0.6, -0.34, 0.34) : 0;
          const rollTarget = engaged ? clamp((0.5 - p.y) * 0.3, -0.2, 0.2) : 0;
          curLean = springTo(curLean, leanTarget, 8, dt);
          curRoll = springTo(curRoll, rollTarget, 8, dt);

          apply();

          prevPx = p.x;
          prevPy = p.y;
          prevT = t;
          havePrev = true;
        },
        onParamChange: (id: string, value: ControlValue) => {
          // Re-apply the pose at the LAST seek state so a control tweak reshapes
          // the pinned frame with no new seek (criterion: controls work live).
          if (id === 'softness') uSoftness.value = clamp(num(value, 0.55), 0.05, 1);
          // shadowLength / opacity / rimIntensity feed through `apply()` reads.
          apply();
        },
        dispose: () => {
          // Restore the subject's home pose EXACTLY.
          subject.rotation.y = baseRotY;
          subject.rotation.z = baseRotZ;
          // Remove + dispose ONLY what this primitive created. The subject's own
          // material/geometry are never touched at any point.
          shadow.parent?.remove(shadow);
          shadowGeo.dispose();
          shadowMat.dispose();
          if (rim) {
            rim.parent?.remove(rim);
            rim = null;
          }
          ownedRimGeo?.dispose();
          ownedRimGeo = null;
          rimMat.dispose();
          delete (target.userData as { pointerCastShadowUniforms?: unknown }).pointerCastShadowUniforms;
        },
      };
    },
  ),
};
