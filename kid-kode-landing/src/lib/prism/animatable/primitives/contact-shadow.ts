// contact-shadow — a soft grounded contact shadow under the subject (W-PHOTO
// D4, cinematic floor). The R1 realism cue the gap report flagged missing for
// coverflow/carousel: an object needs a soft occlusion where it meets its
// surface. A NODE-ATTACHABLE floor piece registered in the catalog (DEV-1);
// the same builder (makeContactShadow) drops one under the watch in D6.
//
// mask/card/easy. The shadow tightens+darkens on a slow breath (as if the
// subject bobs); size/opacity/softness reshape it live. dispose() restores.

import { Box3, Vector3 } from "three";
import type { PrimitiveDefinition } from "../contract";
import { defineAnimatable } from "../base";
import { num } from "../contract";
import {
  makeContactShadow,
  type ContactShadow,
} from "@/lib/prism/cinematic-floor/contact-shadow";

const SCHEMA = [
  {
    id: "size",
    label: "Spread",
    type: "fader",
    min: 0.4,
    max: 3,
    step: 0.05,
    default: 1.15,
    unit: "x",
  },
  {
    id: "opacity",
    label: "Darkness",
    type: "fader",
    min: 0,
    max: 1,
    step: 0.02,
    default: 0.55,
  },
  {
    id: "softness",
    label: "Softness",
    type: "fader",
    min: 0,
    max: 2,
    step: 0.05,
    default: 1,
  },
  {
    id: "breath",
    label: "Breath",
    type: "fader",
    min: 0,
    max: 1,
    step: 0.02,
    default: 0.3,
  },
] as const;

export const contactShadowPrimitive: PrimitiveDefinition = {
  name: "contact-shadow",
  label: "Contact Shadow",
  category: "mask",
  difficulty: "easy",
  subject: "card",
  defaultDriver: "time",
  schema: SCHEMA,
  description:
    "A soft grounded contact shadow beneath the subject — the R1 floor cue that " +
    "makes an object sit on a real surface (bloom/AO family).",
  create: defineAnimatable(
    { name: "contact-shadow", category: "mask", schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      // Measure the subject to size + place the shadow under its base (subject-
      // relative — never hardcoded world units).
      const box = new Box3().setFromObject(subject);
      const size = new Vector3();
      box.getSize(size);
      const width = Math.max(0.001, Math.max(size.x, size.z) || size.y || 1);
      const baseY = box.min.y;

      let shadow: ContactShadow | null = null;
      const build = () => {
        shadow?.dispose();
        if (shadow) target.object.remove(shadow.mesh);
        shadow = makeContactShadow({
          size: width * num(params.size, 1.15),
          opacity: num(params.opacity, 0.55),
          softness: num(params.softness, 1),
          y: baseY - width * 0.02,
          ground: true,
        });
        target.object.add(shadow.mesh);
      };
      build();

      const baseScale = shadow ? shadow.mesh.scale.x : 1;

      return {
        duration: () => Infinity,
        seek: (t: number) => {
          if (!shadow) return;
          // Slow breath: shadow tightens/loosens ~as the object would bob.
          const b = num(params.breath, 0.3);
          const s = 1 + Math.sin(t * 0.8) * 0.06 * b;
          shadow.mesh.scale.setScalar(baseScale * s);
        },
        onParamChange: (id: string) => {
          if (id === "size" || id === "opacity" || id === "softness") build();
        },
        dispose: () => {
          if (shadow) {
            target.object.remove(shadow.mesh);
            shadow.dispose();
          }
        },
      };
    },
  ),
};
