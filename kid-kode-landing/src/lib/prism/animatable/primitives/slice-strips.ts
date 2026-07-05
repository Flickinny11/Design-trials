// slice-strips — the card splits into horizontal strips that slide in from
// alternating sides and snap into alignment. CATALOG primitive (hard /
// displacement, subject:'card'). Builds N thin plane meshes into target.object
// covering the card and hides the real subject. Strip k starts offset on x by
// (k even ? -off : +off) and eases to 0 via easeOut with a per-strip stagger
// (index-hashed for slight deterministic variation); opacity ramps with the
// same eased phase. CPU-driven and observable: a strip's position.x converges
// to 0 across the phase. DISTINCT from a blinds/alpha wipe — these are real
// strip meshes physically sliding into place. Deterministic (index hash, no
// Math.random) so seek() is reproducible.

import {
  Box3,
  Vector3,
  Mesh,
  Group,
  PlaneGeometry,
  MeshStandardMaterial,
  Color,
  type Object3D,
} from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, phase, clamp, type PrimitiveDefinition } from '../contract';

const MAX_STRIPS = 16;

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.2, unit: 's' },
  { id: 'strips', label: 'Strips', type: 'knob', min: 4, max: 16, step: 1, default: 8 },
  { id: 'offset', label: 'Offset', type: 'fader', min: 1, max: 6, step: 0.1, default: 3 },
] as const;

export const sliceStripsPrimitive: PrimitiveDefinition = {
  name: 'slice-strips',
  label: 'Slice Strips',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'The card splits into horizontal strips that slide in from alternating sides and snap into alignment.',
  create: defineAnimatable(
    { name: 'slice-strips', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;

      // Measure the card's footprint so the strips cover it exactly.
      const box = new Box3().setFromObject(subject);
      const size = new Vector3();
      const center = new Vector3();
      box.getSize(size);
      box.getCenter(center);
      // Guard against a degenerate/empty box in headless contexts.
      const cardW = Number.isFinite(size.x) && size.x > 0 ? size.x : 1.74;
      const cardH = Number.isFinite(size.y) && size.y > 0 ? size.y : 1.12;
      const cx = Number.isFinite(center.x) ? center.x : subject.position.x;
      const cy = Number.isFinite(center.y) ? center.y : subject.position.y;
      const cz = Number.isFinite(center.z) ? center.z : subject.position.z;

      const ACCENT = '#5d8bff';
      const PANEL = '#1b2444';

      // Container for all strip meshes; lives in target.object alongside subject.
      const stripGroup = new Group();
      stripGroup.name = 'slice-strips';
      target.object.add(stripGroup);

      // Build MAX_STRIPS strip meshes up front (no realloc on control change).
      // Each strip is a thin horizontal plane; full height is recomputed in seek
      // from the live `strips` count via per-strip scale + y placement, so the
      // `strips` knob takes effect with no rebuild.
      const strips: Mesh[] = [];
      const unitGeom = new PlaneGeometry(1, 1, 1, 1);
      for (let k = 0; k < MAX_STRIPS; k++) {
        const mat = new MeshStandardMaterial({
          color: new Color(k % 2 ? ACCENT : PANEL),
          emissive: new Color('#101a3a'),
          emissiveIntensity: 0.4,
          roughness: 0.34,
          metalness: 0.42,
          envMapIntensity: 1.1,
          transparent: true,
          opacity: 0,
        });
        const m = new Mesh(unitGeom, mat);
        m.name = `slice-strip-${k}`;
        m.visible = false;
        stripGroup.add(m);
        strips.push(m);
      }

      // Per-strip deterministic stagger fraction in [0, 0.45].
      const stagger = new Float32Array(MAX_STRIPS);
      for (let k = 0; k < MAX_STRIPS; k++) {
        stagger[k] = hash1(k * 1.37 + 0.7) * 0.45;
      }

      // Capture subject base visibility to restore on dispose.
      const subjectWasVisible = subject.visible;
      subject.visible = false;

      const restoreSubjectMaterials = (root: Object3D) => {
        root.traverse((o) => {
          const mm = (o as Mesh).material;
          if (mm) {
            const arr = Array.isArray(mm) ? mm : [mm];
            for (const mat of arr) {
              (mat as { opacity?: number }).opacity = 1;
            }
          }
        });
      };

      return {
        duration: () => num(params.duration, 1.2),
        seek: (t) => {
          const dur = num(params.duration, 1.2);
          const off = num(params.offset, 3);
          const n = Math.round(clamp(num(params.strips, 8), 4, MAX_STRIPS));
          const gp = phase(t, dur);

          const stripH = cardH / n;

          for (let k = 0; k < MAX_STRIPS; k++) {
            const m = strips[k];
            if (k >= n) {
              m.visible = false;
              continue;
            }
            m.visible = true;

            // Geometry footprint (scale the unit plane), top strip first.
            m.scale.set(cardW, stripH, 1);
            const restY = cy + cardH / 2 - stripH * (k + 0.5);

            // Per-strip eased phase with deterministic stagger, renormalized so
            // every strip still completes by p=1.
            const s = stagger[k];
            const local = clamp((gp - s) / Math.max(1e-3, 1 - s), 0, 1);
            const e = ease('easeOut', local);

            // Alternating-side x offset shrinking from `off` to 0.
            const dir = k % 2 === 0 ? -1 : 1;
            const slideX = dir * off * (1 - e);

            m.position.set(cx + slideX, restY, cz);
            (m.material as { opacity: number }).opacity = e;
          }
        },
        dispose: () => {
          target.object.remove(stripGroup);
          for (const m of strips) {
            (m.material as MeshStandardMaterial).dispose();
          }
          unitGeom.dispose();
          subject.visible = subjectWasVisible;
          restoreSubjectMaterials(subject);
        },
      };
    },
  ),
};
