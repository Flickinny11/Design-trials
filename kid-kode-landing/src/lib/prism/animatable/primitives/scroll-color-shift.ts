// scroll-color-shift — scroll re-lights the card through a color sweep. Reads
// userData.scroll (0..1) and maps it to a found material's emissiveIntensity
// (lerp loGlow..hiGlow) while shifting that material's color + emissive hue
// around the wheel by scroll*hueRange. Scroll-driven, CPU-observable: the
// material's emissiveIntensity tracks scroll, and the swept hue is recoverable
// from material.color. Restores the material's original color/emissive on
// dispose. MEDIUM / scroll / card.

import { Mesh, Color, MeshStandardMaterial, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'hueRange', label: 'Hue Range', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.6 },
  { id: 'loGlow', label: 'Low Glow', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.2 },
  { id: 'hiGlow', label: 'High Glow', type: 'fader', min: 0.5, max: 3, step: 0.05, default: 1.6 },
] as const;

/** First MeshStandardMaterial found on the subtree (the card panel). */
function findStandardMaterial(root: Object3D): MeshStandardMaterial | null {
  let found: MeshStandardMaterial | null = null;
  root.traverse((o) => {
    if (found) return;
    const m = (o as Mesh).material;
    if (m && !Array.isArray(m) && (m as MeshStandardMaterial).isMeshStandardMaterial) {
      found = m as MeshStandardMaterial;
    }
  });
  return found;
}

export const scrollColorShiftPrimitive: PrimitiveDefinition = {
  name: 'scroll-color-shift',
  label: 'Scroll Color Shift',
  category: 'scroll',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'Scroll drives a hue/emissive shift across the card — scrolling re-lights it through a color sweep.',
  create: defineAnimatable(
    { name: 'scroll-color-shift', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mat = findStandardMaterial(subject);

      // Capture base hue so the sweep is relative to the material's own color.
      const baseColor = mat ? mat.color.clone() : new Color('#5d8bff');
      const baseEmissive = mat ? mat.emissive.clone() : new Color('#101a3a');
      const baseEmissiveIntensity = mat ? mat.emissiveIntensity : 1;
      const baseHSL = { h: 0, s: 0, l: 0 };
      baseColor.getHSL(baseHSL);
      const baseEmHSL = { h: 0, s: 0, l: 0 };
      baseEmissive.getHSL(baseEmHSL);

      // Observable: emissiveIntensity tracks scroll. Mirrored onto userData so
      // the host/driver can read it back without poking the material.
      const observable = { emissiveIntensity: baseEmissiveIntensity };
      (target.userData as Record<string, unknown>).emissiveIntensity = baseEmissiveIntensity;

      const readScroll = (): number => {
        const s = (target.userData as Record<string, unknown>).scroll;
        return clamp(typeof s === 'number' ? s : 0, 0, 1);
      };

      const apply = (scroll: number): void => {
        const hueRange = num(params.hueRange, 0.6);
        const loGlow = num(params.loGlow, 0.2);
        const hiGlow = num(params.hiGlow, 1.6);
        const glow = loGlow + (hiGlow - loGlow) * scroll;
        observable.emissiveIntensity = glow;
        (target.userData as Record<string, unknown>).emissiveIntensity = glow;
        if (!mat) return;
        const h = ((baseHSL.h + scroll * hueRange) % 1 + 1) % 1;
        const hEm = ((baseEmHSL.h + scroll * hueRange) % 1 + 1) % 1;
        mat.color.setHSL(h, baseHSL.s, baseHSL.l);
        mat.emissive.setHSL(hEm, baseEmHSL.s, baseEmHSL.l);
        mat.emissiveIntensity = glow;
        mat.needsUpdate = true;
      };

      // Settle to the base (scroll=0) state on construction.
      apply(0);

      return {
        // Stateful, scroll-driven: not a fixed-length timeline.
        duration: () => Infinity,
        seek: (_t) => {
          // Driver advances scroll on userData; map it live so control tweaks
          // apply on the next seek with no rebuild.
          apply(readScroll());
        },
        dispose: () => {
          if (mat) {
            mat.color.copy(baseColor);
            mat.emissive.copy(baseEmissive);
            mat.emissiveIntensity = baseEmissiveIntensity;
            mat.needsUpdate = true;
          }
          (target.userData as Record<string, unknown>).emissiveIntensity = baseEmissiveIntensity;
        },
      };
    },
  ),
};
