// crumble — the card crumbles into a shower of falling shards. HARD /
// displacement primitive. DISTINCT from shatter (which displaces a plane's
// vertices outward/in-place): crumble builds a fresh NxM grid of small fragment
// meshes covering the card area into target.object, hides the host subject, and
// in seek lets each fragment break off (after a deterministic per-fragment
// stagger from an index hash), accelerate downward under gravity
// (y -= 0.5*g*localT^2), tumble, and fade away. Observable on CPU: a fragment's
// position.y decreases as t advances, and its rotation/opacity change. The
// fragment group is torn down and the subject's visibility restored in dispose.

import {
  Group,
  Mesh,
  PlaneGeometry,
  MeshStandardMaterial,
  Color,
  DoubleSide,
  type Material,
} from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, phase, str, clamp, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 4, step: 0.1, default: 1.6, unit: 's' },
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 0.5, max: 6, step: 0.1, default: 2.4 },
  { id: 'fragments', label: 'Fragments', type: 'knob', min: 3, max: 8, step: 1, default: 5 },
  {
    id: 'curve',
    label: 'Stagger Curve',
    type: 'curve',
    default: 'easeIn',
    options: ['linear', 'easeIn', 'easeOut', 'easeInOut'],
  },
] as const;

const CARD_W = 1.74;
const CARD_H = 1.12;
const FACE_COLOR = '#33406a';
const EDGE_COLOR = '#5d8bff';

/** Deterministic per-fragment hash in [0,1) from its grid coords + a salt. */
function fragHash(fx: number, fy: number, salt: number): number {
  const v = Math.sin(fx * 12.9898 + fy * 78.233 + salt * 37.719) * 43758.5453;
  return v - Math.floor(v);
}

interface Frag {
  mesh: Mesh;
  mat: MeshStandardMaterial;
  homeX: number;
  homeY: number;
  // deterministic per-fragment motion params
  delay: number; // normalized stagger start [0..1)
  velX: number; // horizontal drift speed
  spinX: number; // tumble rates
  spinY: number;
  spinZ: number;
}

export const crumblePrimitive: PrimitiveDefinition = {
  name: 'crumble',
  label: 'Crumble',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'The card crumbles into a shower of falling shards — fragments break off, tumble, and fall away under gravity.',
  create: defineAnimatable(
    { name: 'crumble', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject;

      // The fragment group lives in target.object alongside the (hidden) subject.
      const group = new Group();
      group.name = 'crumble-fragments';
      target.object.add(group);

      // Track the maximum grid we may build so we never recreate meshes during a
      // live `fragments` change — build the densest grid once, then in seek only
      // animate (and toggle visibility of) the fragments the current grid uses.
      const MAX_N = 8;

      const frags: Frag[][] = [];
      for (let ix = 0; ix < MAX_N; ix++) {
        const col: Frag[] = [];
        for (let iy = 0; iy < MAX_N; iy++) {
          const mat = new MeshStandardMaterial({
            color: new Color(FACE_COLOR),
            emissive: new Color(EDGE_COLOR),
            emissiveIntensity: 0.35,
            roughness: 0.4,
            metalness: 0.3,
            side: DoubleSide,
            transparent: true,
            opacity: 1,
          });
          const mesh = new Mesh(new PlaneGeometry(1, 1), mat);
          mesh.name = `frag-${ix}-${iy}`;
          mesh.visible = false;
          // deterministic per-fragment motion descriptors
          const delay = fragHash(ix, iy, 1) * 0.55;
          const velX = (fragHash(ix, iy, 2) - 0.5) * 1.2;
          const spinX = (fragHash(ix, iy, 3) - 0.5) * 6;
          const spinY = (fragHash(ix, iy, 4) - 0.5) * 6;
          const spinZ = (fragHash(ix, iy, 5) - 0.5) * 6;
          col.push({ mesh, mat, homeX: 0, homeY: 0, delay, velX, spinX, spinY, spinZ });
          group.add(mesh);
        }
        frags.push(col);
      }

      let lastGrid = -1;

      /** Lay out the fragments for an NxN grid: size + home position, show used. */
      function layout(grid: number): void {
        const fw = CARD_W / grid;
        const fh = CARD_H / grid;
        for (let ix = 0; ix < MAX_N; ix++) {
          for (let iy = 0; iy < MAX_N; iy++) {
            const f = frags[ix][iy];
            const used = ix < grid && iy < grid;
            if (!used) {
              f.mesh.visible = false;
              continue;
            }
            f.mesh.scale.set(fw, fh, 1);
            // home (rest) position: cell center over the card area
            f.homeX = -CARD_W / 2 + fw * (ix + 0.5);
            f.homeY = -CARD_H / 2 + fh * (iy + 0.5);
          }
        }
        lastGrid = grid;
      }

      function applyP(p: number): void {
        const grid = Math.round(clamp(num(params.fragments, 5), 3, 8));
        if (grid !== lastGrid) layout(grid);

        const g = num(params.gravity, 2.4);
        const curve = str(params.curve, 'easeIn') as EaseName;

        for (let ix = 0; ix < grid; ix++) {
          for (let iy = 0; iy < grid; iy++) {
            const f = frags[ix][iy];
            f.mesh.visible = true;
            // Per-fragment local progress after its stagger delay, eased.
            const span = 1 - f.delay;
            const localRaw = span <= 0 ? p : clamp((p - f.delay) / span, 0, 1);
            const lt = ease(curve, localRaw);

            // Gravity fall: y decreases ~ 0.5*g*lt^2 (accelerating downward).
            const fall = 0.5 * g * lt * lt;
            f.mesh.position.x = f.homeX + f.velX * lt;
            f.mesh.position.y = f.homeY - fall;
            f.mesh.position.z = lt * 0.15; // slight lift off the card plane

            // Tumble.
            f.mesh.rotation.x = f.spinX * lt;
            f.mesh.rotation.y = f.spinY * lt;
            f.mesh.rotation.z = f.spinZ * lt;

            // Fade out as it falls away.
            f.mat.opacity = 1 - localRaw;
          }
        }

        // The card itself is hidden once any crumbling has begun; restored at rest.
        if (subject) subject.visible = p <= 0;
      }

      return {
        duration: () => num(params.duration, 1.6),
        seek: (t) => {
          const p = phase(t, num(params.duration, 1.6));
          applyP(p);
        },
        onParamChange: (id) => {
          if (id === 'fragments') {
            // Force a re-layout on the next seek.
            lastGrid = -1;
          }
        },
        dispose: () => {
          if (subject) subject.visible = true;
          target.object.remove(group);
          for (let ix = 0; ix < MAX_N; ix++) {
            for (let iy = 0; iy < MAX_N; iy++) {
              const f = frags[ix][iy];
              (f.mesh.geometry as { dispose(): void }).dispose();
              (f.mat as Material).dispose();
            }
          }
        },
      };
    },
  ),
};
