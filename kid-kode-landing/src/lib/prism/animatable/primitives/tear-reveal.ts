// tear-reveal — the card is revealed as if torn open along a ragged paper rip
// that sweeps across and peels away. HARD / GPU node-material primitive
// (displacement category). Swaps the host card panel's material for a
// MeshStandardNodeMaterial whose opacityNode is step(tear, uProgress): the
// surface is shown where the ragged tear front has already passed.
//
// The tear edge is a horizontal sweep coordinate warped by a layered-sine noise
// field of uv.y (plus optional small vertical jitter), so the rip is a sharp,
// jagged paper contour rather than a smooth diagonal:
//   tear = uv.x + noise(uv.y*scale)*ragged
//   reveal = step(tear, uProgress)            // 1 where tear < uProgress
// A thin darkened/emissive torn-edge highlight rides the leading front via a
// smoothstep band centered on uProgress. seek() advances uProgress 0 -> ~1.1.
//
// DISTINCT from noise-wipe (a smooth feathered erosion front): tear-reveal is a
// HARD-edged step (no feather) ragged paper tear with a bright torn-edge band.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, sin, step, smoothstep, float } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const ACCENT = '#5d8bff';
const EDGE = '#fff2cc'; // warm torn-edge highlight

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.3, unit: 's' },
  { id: 'raggedness', label: 'Raggedness', type: 'knob', min: 0, max: 0.3, step: 0.005, default: 0.12 },
  { id: 'scale', label: 'Tear Roughness', type: 'knob', min: 4, max: 20, step: 0.5, default: 10 },
] as const;

export const tearRevealPrimitive: PrimitiveDefinition = {
  name: 'tear-reveal',
  label: 'Tear Reveal',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'The card is revealed as if torn open along a ragged paper rip that sweeps across and peels away.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'tear-reveal', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      // Preserve the card's tint so the revealed surface shows its colour.
      const prevMat = mesh ? (mesh.material as Material) : null;
      let tint: [number, number, number] = rgb(ACCENT);
      if (prevMat && (prevMat as unknown as { color?: Color }).color) {
        const c = (prevMat as unknown as { color: Color }).color;
        tint = [c.r, c.g, c.b];
      }
      const [er, eg, eb] = rgb(EDGE);

      const uProgress = uniform(0);
      const uRagged = uniform(num(params.raggedness, 0.12));
      const uScale = uniform(num(params.scale, 10));
      const uR = uniform(tint[0]);
      const uG = uniform(tint[1]);
      const uB = uniform(tint[2]);
      const uER = uniform(er);
      const uEG = uniform(eg);
      const uEB = uniform(eb);

      // Ragged paper-tear front.
      //   noise = layered sines of uv.y*scale (a cheap jagged 1D contour),
      //           remapped to ~[-1,1]; multiplied by raggedness so the rip wiggles
      //   jitter = a finer high-frequency wobble for paper-fibre detail
      //   tear   = uv.x + noise*ragged + jitter   -> the sweep coordinate warped
      //            into a sharp jagged contour
      //   reveal = step(tear, uProgress)           -> 1 where the tear has passed
      const u = uv();
      const sy = u.y.mul(uScale);
      // Layered sins at incommensurate frequencies approximate a jagged contour.
      const n1 = sin(sy);
      const n2 = sin(sy.mul(2.3).add(float(1.7)));
      const n3 = sin(sy.mul(4.7).add(float(3.9)));
      // Accumulate (reassigned fluent chain -> annotate as any per TSL typing).
      let noise: any = n1.mul(0.6);
      noise = noise.add(n2.mul(0.28));
      noise = noise.add(n3.mul(0.12));
      // Optional slight vertical jitter on the edge (high-freq fibre wobble).
      const jitter = sin(u.y.mul(uScale.mul(3.1)).add(float(0.5))).mul(uRagged.mul(0.25));

      const tear = u.x.add(noise.mul(uRagged)).add(jitter);
      // HARD ragged edge: step (no feather), distinguishing from noise-wipe.
      const reveal: any = step(tear, uProgress);

      // Thin torn-edge highlight: a smoothstep band centered on the leading
      // front (tear ~ uProgress). Bright just behind/at the rip, dark elsewhere.
      const dist: any = tear.sub(uProgress).abs();
      const band: any = smoothstep(float(0.06), float(0.0), dist).mul(reveal);

      // Base revealed tint, lifted to a bright/darkened torn-edge along the band.
      const baseCol = vec3(uR, uG, uB);
      const edgeCol = vec3(uER, uEG, uEB);
      const colorNode: any = baseCol.add(edgeCol.sub(baseCol).mul(band));
      // Emissive torn-edge highlight rides the front for a glowing rip.
      const emissiveNode: any = edgeCol.mul(band);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = reveal;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissiveNode;

      if (mesh) mesh.material = mat;

      // Publish live uniform handles so the host/driver (and tests) can observe
      // the tear progress / raggedness / roughness on the CPU.
      target.userData.tearRevealProgress = uProgress;
      target.userData.tearRevealRagged = uRagged;
      target.userData.tearRevealScale = uScale;

      return {
        // seek advances uProgress 0 -> ~1.1 (overshoot so the tear fully clears).
        duration: () => num(params.duration, 1.3),
        seek: (t) => {
          const dur = num(params.duration, 1.3);
          const p = dur <= 0 ? 1.1 : (t / dur) * 1.1;
          uProgress.value = p < 0 ? 0 : p > 1.1 ? 1.1 : p;
          // Read controls live so a change applies on the next seek.
          uRagged.value = num(params.raggedness, 0.12);
          uScale.value = num(params.scale, 10);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'raggedness') uRagged.value = num(value, 0.12);
          else if (id === 'scale') uScale.value = num(value, 10);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
