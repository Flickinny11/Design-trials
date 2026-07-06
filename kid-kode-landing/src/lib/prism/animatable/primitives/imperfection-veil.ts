// imperfection-veil — a dust/scratch/smudge breakup over the subject (W-PHOTO
// D4, cinematic floor). Perfection reads digital; this overlays a transparent
// imperfection texture (dark dust specks + faint bright scratches) so a surface
// carries the micro-grime the eye trusts. A NODE-ATTACHABLE floor piece
// registered in the catalog (DEV-1); the atelier factory (D6) uses the roughness
// form (applyImperfection) on the watch's real PBR materials.
//
// mask/card/easy. The veil drifts slowly (dust catching light) and amount/scale/
// seed reshape it. dispose() removes it cleanly.

import {
  Box3,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  PlaneGeometry,
  Vector3,
  type DataTexture,
} from "three";
import type { PrimitiveDefinition } from "../contract";
import { defineAnimatable } from "../base";
import { num } from "../contract";
import { makeImperfectionOverlay } from "@/lib/prism/cinematic-floor/imperfection";

const SCHEMA = [
  {
    id: "amount",
    label: "Amount",
    type: "fader",
    min: 0,
    max: 1,
    step: 0.02,
    default: 0.45,
  },
  {
    id: "scale",
    label: "Grain scale",
    type: "fader",
    min: 0.5,
    max: 4,
    step: 0.1,
    default: 1.6,
    unit: "x",
  },
  {
    id: "seed",
    label: "Seed",
    type: "fader",
    min: 1,
    max: 64,
    step: 1,
    default: 7,
  },
  {
    id: "drift",
    label: "Drift",
    type: "fader",
    min: 0,
    max: 1,
    step: 0.02,
    default: 0.25,
  },
] as const;

export const imperfectionVeilPrimitive: PrimitiveDefinition = {
  name: "imperfection-veil",
  label: "Imperfection Veil",
  category: "mask",
  difficulty: "easy",
  subject: "card",
  defaultDriver: "time",
  schema: SCHEMA,
  description:
    "A dust/scratch/smudge breakup over the subject — the R1 floor cue that keeps " +
    "a surface from reading as digital-perfect.",
  create: defineAnimatable(
    { name: "imperfection-veil", category: "mask", schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const box = new Box3().setFromObject(subject);
      const size = new Vector3();
      box.getSize(size);
      const w = Math.max(0.001, size.x || 1);
      const h = Math.max(0.001, size.y || 1);
      const center = new Vector3();
      box.getCenter(center);
      const faceZ = box.max.z + Math.max(0.002, (size.z || 0.1) * 0.02);

      const geo = new PlaneGeometry(w * 1.02, h * 1.02);
      let tex: DataTexture = makeImperfectionOverlay({
        seed: num(params.seed, 7),
        strength: 1,
      });
      const mat = new MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: num(params.amount, 0.45),
        depthWrite: false,
        blending: NormalBlending,
        side: DoubleSide,
      });
      const mesh = new Mesh(geo, mat);
      mesh.name = "imperfection-veil";
      mesh.position.set(center.x, center.y, faceZ);
      mesh.renderOrder = 5;
      const applyScale = () => {
        const s = num(params.scale, 1.6);
        tex.repeat.set(s, s);
      };
      applyScale();
      target.object.add(mesh);

      return {
        duration: () => Infinity,
        seek: (t: number) => {
          const d = num(params.drift, 0.25);
          tex.offset.set(
            Math.sin(t * 0.13) * 0.04 * d,
            Math.cos(t * 0.11) * 0.04 * d,
          );
        },
        onParamChange: (id: string) => {
          if (id === "amount") mat.opacity = num(params.amount, 0.45);
          else if (id === "scale") applyScale();
          else if (id === "seed") {
            const next = makeImperfectionOverlay({
              seed: num(params.seed, 7),
              strength: 1,
            });
            next.repeat.copy(tex.repeat);
            tex.dispose();
            tex = next;
            mat.map = tex;
            mat.needsUpdate = true;
          }
        },
        dispose: () => {
          target.object.remove(mesh);
          geo.dispose();
          mat.dispose();
          tex.dispose();
        },
      };
    },
  ),
};
