// scrub-morph — scroll scrubs a combined rotate-and-scale morph back and forth.
// CPU transform primitive (medium / scroll), subject 'card'. Reads the host's
// scroll driver (userData.scroll, 0..1) — falling back to phase(t) when no
// scroll input is present — and maps it onto rotation.y = lerp(0, maxRot, s)
// and a uniform scale = lerp(1, maxScale, s). Fully scrubbable / bidirectional:
// dragging scroll back unwinds the morph. An optional `wobble` toggle adds a
// small sin to the rotation so the morph breathes as it scrubs.

import { type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, bool, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'maxRotDeg', label: 'Max Rotation', type: 'knob', min: 0, max: 360, step: 1, default: 180, unit: 'deg' },
  { id: 'maxScale', label: 'Max Scale', type: 'fader', min: 0.2, max: 3, step: 0.05, default: 1.6 },
  { id: 'wobble', label: 'Wobble', type: 'toggle', default: false },
] as const;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Read the host scroll driver (0..1); fall back to time-phase when absent. */
function readScroll(userData: Record<string, unknown>, t: number, dur: number): number {
  const s = userData.scroll;
  if (typeof s === 'number' && Number.isFinite(s)) return clamp(s, 0, 1);
  return phase(t, dur);
}

export const scrubMorphPrimitive: PrimitiveDefinition = {
  name: 'scrub-morph',
  label: 'Scrub Morph',
  category: 'scroll',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'Scroll scrubs a combined rotate-and-scale morph back and forth — fully scrubbable.',
  create: defineAnimatable(
    { name: 'scrub-morph', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = target.subject ?? target.object;
      const baseRotY = subject.rotation.y;
      const baseScaleX = subject.scale.x;
      const baseScaleY = subject.scale.y;
      const baseScaleZ = subject.scale.z;
      return {
        // Scrubbable along a scroll timeline; expose a finite nominal length so
        // the fallback phase(t) maps t in [0,1]s onto scroll 0..1.
        duration: () => 1,
        seek: (t) => {
          // Read params LIVE so setControl applies on the next seek (no rebuild).
          const s = readScroll(target.userData, t, 1);
          const maxRot = (num(params.maxRotDeg, 180) * Math.PI) / 180;
          const maxScale = num(params.maxScale, 1.6);

          let rot = lerp(0, maxRot, s);
          if (bool(params.wobble, false)) {
            // A small breathing sin layered on top — peaks mid-scrub, vanishes
            // at the endpoints so the settled poses stay clean.
            rot += Math.sin(s * Math.PI * 2) * 0.25;
          }
          const scale = lerp(1, maxScale, s);

          subject.rotation.y = baseRotY + rot;
          subject.scale.set(
            baseScaleX * scale,
            baseScaleY * scale,
            baseScaleZ * scale,
          );
        },
        dispose: () => {
          subject.rotation.y = baseRotY;
          subject.scale.set(baseScaleX, baseScaleY, baseScaleZ);
        },
      };
    },
  ),
};
